//Find a Mongo query to show the number of collections, objects, storageSize, indexes … 
//of the imported database
db.stats()
//Number of collections
db.getCollectionNames().length

//Number of indexes per collection
db.getCollectionNames().forEach(function(collection) {
    indexes = db[collection].getIndexes();
    print("Indexes for " + collection + ":");
    printjson(indexes);
 });

//Number of objects per collection
db.getCollectionNames().forEach(function(collection) {
    ndocs = db[collection].count();
    print("Number of documents for " + collection + ":");
    printjson(ndocs);
 });

//Storage size for each collection
db.getCollectionNames().forEach(function(collection){
    size = db[collection].storageSize();
    print("Storage size for " + collection + ":");
    printjson(size);
});

//How many products related to “Tofu” are there?
db.products.find({ProductName: /.*Tofu*./}).count()


//How many products that have less than 10 units in stock
db.products.find({UnitsInStock:{$lt: 10}}).count()


//How many products belong to category “Confections” that have less than 10 units in stock?
db.products.aggregate([
    
    {$lookup: 
        {from: "categories", localField: "CategoryID", foreignField: "CategoryID",
        as: "creators"}
    },
    {$unwind: "$creators"},
    {$match: {
            $and:[
                {UnitsInStock: {$lt : 10}},
                {"creators.CategoryName": {$eq: "Confections"}}
            ]
        }
    }, 

    {$count : "count" }
])

//In one query, return a list of categories and number of products per category 
//with only category ID, category name and the number of products
db.products.aggregate([

    {$lookup:{
            from: "categories", 
            localField: "CategoryID", 
            foreignField: "CategoryID",
            as: "creators"
        }
    },
    {$unwind : "$creators"},

    {$group: {
                _id:  "$CategoryID", 
                Category_Name: {    
                    $first : "$creators.CategoryName",
                },
                totalProducts: {
                    $sum: 1 
                }
        }    
    },
    {$sort: {_id : 1 }}
])


//Find the 2nd page of 10 products, sorted by product name
db.products.aggregate(
    [
        {$skip : 10},
        {$sort: {ProductName: 1}},
        {$limit : 10}
    ]
).pretty()

//Find the top 5 customers (most spending) together with the products they bought on the system
db["order-details"].aggregate([ 
    {$group :{
            _id:"$OrderID",
            count: {$sum:{ $subtract: [
                    {$multiply:["$UnitPrice","$Quantity"]}, 
                    {$multiply: [ {$multiply:["$UnitPrice","$Quantity"]}, "$Discount"]}
                ]}},
            ProductID:{ $push:
                {id:"$ProductID"}
            }
    }},
    
    {$lookup:{
        from :"orders",
        localField:"_id",
        foreignField:"OrderID",
        as :"detailed_Orders"
        }
    },

    {$lookup:{
        from :"customers",
        localField:"detailed_Orders.CustomerID",
        foreignField:"CustomerID",
        as :"who_placed_orders"
        }
    },

    {$lookup:{
        from :"products",
        localField:"ProductID.id",
        foreignField:"ProductID",
        as : "productsJoined"
        }
    },
    {$unwind: "$who_placed_orders"},
    {
    $group :{
            customerName: {$first: "$who_placed_orders.ContactName"},
            _id:"$detailed_Orders.CustomerID",
            productList: {$push: "$productsJoined.ProductName"},
            TotalSpending:{$sum:"$count"},
        }      
    },

    {$sort: {"TotalSpending":-1}},
    {$limit: 5},
    {$project: {
        _id: 0
    }}

]).pretty()


//Find the top 5 categories (best buy) together with their top 5 products of the system 
db["order-details"].aggregate([

    {$group: {
        qty : {$sum: "$Quantity"} ,
        _id: "$ProductID"
    }}, 
    
    {$lookup:{
        from: "products",
        localField: "_id",
        foreignField: "ProductID",
        as: "orderedProducts"
    }},

    {$lookup:{
        from: "categories",
        localField: "orderedProducts.CategoryID",
        foreignField: "CategoryID",
        as: "ofCategory"
    }},
    {$unwind : "$ofCategory"},
    {$group:{
        _id: "$ofCategory.CategoryID",
        CategoryName:  {$first:"$ofCategory.CategoryName"},
        Products_Quantity: {$sum:"$qty"},
        ProductList: {$push:"$orderedProducts.ProductName"}
    }},

    {$sort: {Quantity: -1}},

    {$project: {
        _id: 0,
        "Top5_Products": {$slice:["$ProductList", 5]},
        Products_Quantity: 1,
        CategoryName: 1
    }},

    {$limit : 5},

]).pretty()


//Explain the query to list all customers whose name started with “A”
db.customers.find({ContactName: /^A/}).explain("executionStats")


//Add index to the column containing customers’ name and explain the query again 
//to confirm that it is faster now
db.customers.createIndex({ContactName : 1})
db.customers.find({ContactName: /^A/}).explain("executionStats")
//totalDocsExamined: 10


//Update product collection to embed the category information inside each document

//Steps :
//1. We will loop through each document held by collection Categories
//2. With each Categories' document , we will affix it as nested form inside a Products's document
db.categories.find().forEach(function(ctgrDocs){
    db.products.updateMany({"CategoryID": ctgrDocs.CategoryID},{$set:{"Category":ctgrDocs}})
});

//revert the above change
//db.products.updateMany({},{$unset: {"Category":""}})