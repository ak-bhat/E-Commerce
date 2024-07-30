const express = require("express");
const multer = require('multer');
const adminRoute = express();
const session = require("express-session");
const config = require('../config/config');
const auth = require("../middlewares/adminAuth");
const adminController = require("../controllers/adminController");
const bodyParser = require("body-parser");

// Multer config
const storage = multer.memoryStorage();

const upload = multer({ storage:storage })
  
//   const upload = multer({ storage:storage });


adminRoute.use(
    session({
      secret: config.sessionSecret,
      resave: false, 
      saveUninitialized: true, 
    })
);
  

adminRoute.use(bodyParser.urlencoded({ extended: true })); //common

// adminRoute.set('view engine', 'ejs');
adminRoute.set('views', './views/admin');

adminRoute.get('/admin', auth.isLogout, adminController.loadLogin);
adminRoute.post('/admin', adminController.verifyLogin);
adminRoute.get('/logout', auth.isLogin, adminController.logout);

adminRoute.get('/users', auth.isLogin, adminController.adminUsers);
adminRoute.post('/block-user', auth.isLogin, adminController.blockUser);

adminRoute.get('/products', auth.isLogin, adminController.getProducts);
adminRoute.get('/addProduct', auth.isLogin, adminController.addProduct);
adminRoute.post('/addProduct', auth.isLogin, upload.array('productImage',3), adminController.saveProduct);
adminRoute.post('/deleteProduct/:id', auth.isLogin, adminController.deleteProduct);
adminRoute.get('/updateProduct/:id/Edit', auth.isLogin, adminController.loadupdateProduct);
adminRoute.post(
  '/updateProduct/:id/Edit',
  upload.fields([{ name: 'images', maxCount: 3 }, { name: 'newImages', maxCount: 3 }]),
  adminController.updateProduct
);
adminRoute.delete('/updateProduct/:id/deleteImage/:index', adminController.deleteProductImage);

adminRoute.get('/category', auth.isLogin, adminController.loadCategory);
adminRoute.get('/addCategory', auth.isLogin, adminController.addCategory);
adminRoute.post('/saveCategory', auth.isLogin, adminController.saveCategory);
adminRoute.post('/toggleCategory/:id', auth.isLogin, adminController.toggleCategory);
adminRoute.get('/editCategory/:id', auth.isLogin, adminController.editCategory);
adminRoute.post('/updateCategory/:id', auth.isLogin, adminController.updateCategory);


adminRoute.get('/adminOrders',auth.isLogin, adminController.loadOrder);
adminRoute.get('/manageOrder',auth.isLogin, adminController.manageOrder);
adminRoute.post('/updateOrderStatus', auth.isLogin, adminController.updateOrderStatus);
adminRoute.post('/updateProductOrderStatus', auth.isLogin, adminController.updateProductOrderStatus);

module.exports = adminRoute;
