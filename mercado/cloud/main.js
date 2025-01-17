const EfiPay = require('sdk-node-apis-efi');
const Product = Parse.Object.extend("Products");
const Category = Parse.Object.extend("Category");
const CartItem = Parse.Object.extend("CartItem");
const OrderItem = Parse.Object.extend("OrderItem");
const Order = Parse.Object.extend("Order");
Date.prototype.addSeconds = function(s){
	this.setTime(this.getTime() + (s * 1000));
	return this;
}

var options = module.exports = {
    sandbox: true,
    client_id: 'Client_Id_6a682c246111158e1a71f3b74bc8b81315858f01',
    client_secret: 'Client_Secret_dee97a978ca51b2d826892addb3e0adfdeddb42b',
    certificate: __dirname + '/homologacao-676206-mercadinhohomolog.p12',
	cert_base64: false,
};
const efipay = new EfiPay(options);

Parse.Cloud.define("hello", async (request) => {
	return "hello word from mercadinho";
});

Parse.Cloud.define("webhook", async (request) => {
	if(request.user == null) throw "INVALID_USER";
	if(request.user.id != "vc2Wy1s3lB") throw "INVALID_USER_ID";
	return "ola mundo!";
});
//mundoflutter.shop

Parse.Cloud.define("sign-up", async (request) => {
	if(request.params.fullName == null) throw "INVALID FULLNAME";
	if(request.params.cpf == null) throw "INVALID CPF";
	if(request.params.phone == null) throw "INVALID PHONE";

	const user = new Parse.User();
	user.set("username",request.params.email);
	user.set("email",request.params.email);
	user.set("password",request.params.password);
	user.set("fullName",request.params.fullName);
	user.set("cpf",request.params.cpf);
	user.set("phone",request.params.phone);

	try {
		const resultUser = await user.signUp(null,{useMasterKey: true});
		const userJSON = resultUser.toJSON();
		return formaterUser(userJSON);
	}catch (e){
		throw "INVALID DATA";
	}
});

Parse.Cloud.define("get-order",async (request)=>{
	if(request.user == null) throw "IVALID_USER";
	const queryOrder = new Parse.Query(Order);
	queryOrder.equalTo("user",request.user);
	const queryResult = await queryOrder.find({useMasterKey: true});
	return queryResult.map(function(order){
		order = order.toJSON();
		return {

			id: order.objectId,
			createdAt: order.createdAt,
			total: order.total,
			due: order.due.iso,
			imageQRCode: order.imageQRCode,
			copiaecola: order.copiaecola,
		};
	});
});

Parse.Cloud.define("checkout",async (request)=>{
	if(request.user == null) throw "invalid user";
	const queryCartItems = new Parse.Query(CartItem);
	queryCartItems.equalTo("user",request.user);
	queryCartItems.include("product");
	cartResultItems = await queryCartItems.find({useMasterKey: true});
	let total = 0.0;
	for(let item of cartResultItems){
		item = item.toJSON();
		total += item.quantity * item.product.price;
	}
	if(request.params.total != total) throw "total invalid";
	const dueSeconds = 3600;
	const due = new Date().addSeconds(dueSeconds);
	const charge = await createChage(dueSeconds,request.user.get("cpf"),request.user.get("fullName"),total);
	const qrCodeData = await generateQRCode(charge.loc.id);
	const order = new Order();
	order.set("total",total);
	order.set("user",request.user);
	order.set("due",due);
	order.set("imageQRCode",qrCodeData.imagemQrcode);
	order.set("copiaecola",qrCodeData.qrcode);
	order.set("txid",charge.txid);

	const orderResult = await order.save(null,{useMasterKey: true});
	for(let item of cartResultItems){
		const orderItem = new OrderItem();
		orderItem.set("order",orderResult);
		orderItem.set("product",item.get("product"));
		orderItem.set("quantity",item.get("quantity"));
		orderItem.set("price",item.toJSON().product.price);


		await orderItem.save(null,{useMasterKey: true});
	}
	await Parse.Object.destroyAll(cartResultItems,{useMasterKey: true});
	return {
		id: orderResult.id,
		total: total,
		imageQRCode:qrCodeData.imagemQrcode,
		copiaecola: qrCodeData.qrcode,
		due:due.toISOString(),
	};
});

Parse.Cloud.define("get-product-list", async (request)=>{
	const queryProducts = new Parse.Query(Product);

	const itemsPerPage = request.params.itemsPerPage || 20;
	if(itemsPerPage > 100) throw "quantidade invalida";
	if(request.params.title != null){
		queryProducts.fullText("title",request.params.title);
	}
	if(request.params.categoryId != null){
		//buscar por categorias
		const category = new Category();
		category.id = request.params.categoryId;
		queryProducts.equalTo("category",category);
	}
	queryProducts.include("category");
	queryProducts.skip(itemsPerPage * request.params.page || 0);
	queryProducts.limit(itemsPerPage);

	const products = await queryProducts.find({useMasterKey: true});
	return products.map(function(product){
		product = product.toJSON();
		return {
			id: product.objectId,
			title: product.title,
			price: product.price,
			description: product.description,
			isSelling: product.isSelling,
			image: product.image.url,
			category: {
				title: product.category.title,
				id: product.category.objectId
			}
		};
	});
});

Parse.Cloud.define("get-category-list",async (request)=>{
	const queryCategory  = new Parse.Query(Category);

	const categores = await queryCategory.find({useMasterKey: true});
	return categores.map(function(categores){
		categores = categores.toJSON();
		return {
			title: categores.title,
			id: categores.objectId
		};
	});
});

Parse.Cloud.define("add-to-cart", async (request)=>{
	if(request.params.productId == null) throw "product invalid";
	if(request.params.quantity == null) throw "quantity invalid";
	const cartItem = new CartItem();
	cartItem.set("quantity",request.params.quantity);
	const product = new Product();
	product.id = request.params.productId;
	cartItem.set("product",product);
	cartItem.set("user",request.user);
	const cartResult = await cartItem.save(null,{useMasterKey: true});
	return cartResult.id;
});

Parse.Cloud.define("nodify-quantity",async (request)=>{
	if(request.params.cartItemId == null) throw "invalid cartItem";
	if(request.params.quantity == null) throw "invalid quantity";
	const cartItem = new CartItem();
	cartItem.id = request.params.cartItemId;
	if(request.params.quantity > 0){
		cartItem.set("quantity",request.params.quantity);
		await cartItem.save(null,{useMasterKey: true});
	}else{
		await cartItem.destroy({useMasterKey: true});
	}

});

Parse.Cloud.define("get-cart-items",async (request)=>{
	const queryCartItems = new Parse.Query("CartItem");
	queryCartItems.equalTo("user",request.user);
	queryCartItems.include("product");
	queryCartItems.include("product.category");
	cartResult = await queryCartItems.find({useMasterKey: true});
	return cartResult.map(function(cartItem){
		cartItem = cartItem.toJSON();
		return {
			id: cartItem.objectId,
			quantity: cartItem.quantity,
			product: formaterProduct(cartItem.product),

		}
	});

});

Parse.Cloud.define("get-order-items",async (request)=>{
	if(request.params.orderId == null) throw "INVALID_ORDER";
	if(request.user == null) throw "IVALID_USER";
	const order = new Order();
	order.id = request.params.orderId;
	const queryOrder = new Parse.Query(OrderItem);
	queryOrder.equalTo("order",order);
	queryOrder.include("product");
	queryOrder.include("product.category");
	const orderResult = await queryOrder.find({useMasterKey: true});
	return orderResult.map(function(order){
		order = order.toJSON();
		return {
			id: order.objectId,
			quantity: order.quantity,
			price: order.price,
			product:formaterProduct(order.product)
		}
	});

});

Parse.Cloud.define("login",async (request)=>{
	try {
		const user = await Parse.User.logIn(request.params.email,request.params.password);
		const userJSON = user.toJSON();
		return formaterUser(userJSON);

	}catch (e){
		throw "INVALID CREDENTIALS";
	}

});

Parse.Cloud.define("validate-token",async (request)=>{
	try{
		return formaterUser(request.user.toJSON());
	}catch (e){
		throw "INVALID TOKEN";
	}
});

function formaterUser(userJSON){
	return {
		id: userJSON.objectId,
		name: userJSON.fullName,
		email: userJSON.email,
		phone: userJSON.phone,
		cpf: userJSON.cpf,
		tokem:userJSON.sessionToken
		
	};
};

function formaterProduct(productJSON){
	return {
		id: productJSON.objectId,
		title: productJSON.title,
		price: productJSON.price,
		description: productJSON.description,
		isSelling: productJSON.isSelling,
		image: productJSON.image.url != null ? productJSON.image.url: "",
		category: {
			title: productJSON.category.title,
			id: productJSON.category.objectId
		}
	};
};

async function createChage(dueSeconds,cpf,fullname,total) {
	
	let body = {
		"calendario": {
			"expiracao": dueSeconds,
		},
		"devedor": {
			"cpf": cpf.replace(/\D/g,""),
			"nome": fullname,
		},
		"valor": {
			"original": total.toString(),
		},
		"chave": "familiafsds16@gmail.com", // Informe sua chave Pix cadastrada na efipay.	
	
	};
	
	const response = await efipay.pixCreateImmediateCharge({}, body);
	return response;
	//return response;
};

async function generateQRCode(locId) {
	let params = {
		"id":locId
	}
	const response = await efipay.pixGenerateQRCode(params);
	return response;
}