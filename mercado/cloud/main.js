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
