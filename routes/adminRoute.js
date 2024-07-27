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

adminRoute.get('/products', adminController.getProducts);
adminRoute.get('/addProduct', adminController.addProduct);
adminRoute.post('/addProduct',upload.array('productImage',3), adminController.saveProduct);
adminRoute.post('/deleteProduct/:id',adminController.deleteProduct);
adminRoute.get('/updateProduct/:id/Edit',adminController.loadupdateProduct);
adminRoute.post(
  '/updateProduct/:id/Edit',
  upload.fields([{ name: 'images', maxCount: 3 }, { name: 'newImages', maxCount: 3 }]),
  adminController.updateProduct
);
adminRoute.delete('/updateProduct/:id/deleteImage/:index', adminController.deleteProductImage);
adminRoute.post('/deleteImage', (req, res) => {
  const { index } = req.body;
  
  res.status(200).json({ success: true });
});

adminRoute.get('/category', adminController.loadCategory);
adminRoute.get('/addCategory', adminController.addCategory);
adminRoute.post('/saveCategory', adminController.saveCategory);
adminRoute.post('/toggleCategory/:id', adminController.toggleCategory);
adminRoute.get('/editCategory/:id', adminController.editCategory);
adminRoute.post('/updateCategory/:id', adminController.updateCategory);


adminRoute.get('/adminOrders',adminController.loadOrder);
adminRoute.get('/manageOrder', adminController.manageOrder);
adminRoute.post('/updateOrderStatus', adminController.updateOrderStatus);
adminRoute.post('/updateProductOrderStatus', adminController.updateProductOrderStatus);


module.exports = adminRoute;
