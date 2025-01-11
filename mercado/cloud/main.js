const Product = Parse.Object.extend("Products");
const Category = Parse.Object.extend("Category");
// Use Parse.Cloud.define to define as many cloud functions as you want.
// For example:
Parse.Cloud.define("hello", (request) => {
	return "imael e um caneco";
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
		}
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
		}
	});
});

Parse.Cloud.define("sign-up", async (request)=>{
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
Parse.Cloud.define("chenge-password",async (request)=>{
	if(request.user == null) throw "INVALID USER";
	const user = await Parse.User.logIn(request.params.email,request.params.currentPassword);
	if(user.id != request.user.id) throw "INVALID USER";
	try {
		user.set("password",request.params.password);
		user.save(null,{useMasterKey: true});
	}catch (e){
		throw "ERRO";
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
}



