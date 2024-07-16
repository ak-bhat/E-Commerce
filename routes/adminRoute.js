const express = require("express");
const fs = require('fs');
const adminRoute = express();
const auth = require("../middlewares/adminAuth");
const adminController = require("../controllers/adminController");
const bodyParser = require("body-parser");
const path = require('path');
const busboy = require('connect-busboy');

adminRoute.set('view engine', 'ejs');
adminRoute.set('views', './views/admin');

adminRoute.use(bodyParser.json());
adminRoute.use(bodyParser.urlencoded({ extended: true }));
adminRoute.use(busboy());

adminRoute.get('/admin', auth.isLogout, adminController.loadLogin);
adminRoute.post('/admin', adminController.verifyLogin);
adminRoute.get('/logout', auth.isLogin, adminController.logout);

adminRoute.get('/users', auth.isLogin, adminController.adminUsers);
adminRoute.post('/block-user', auth.isLogin, adminController.blockUser);

adminRoute.get('/products', adminController.getProducts);
adminRoute.get('/addProduct', adminController.addProduct);
// adminRoute.post('/products', adminController.saveProduct);

adminRoute.get('/category', adminController.loadCategory);
adminRoute.get('/addCategory', adminController.addCategory);
// adminRoute.post('/saveCategory', adminController.saveCategory);
adminRoute.get('/editCategory/:id', adminController.editCategory);
adminRoute.post('/updateCategory/:id', adminController.updateCategory);

module.exports = adminRoute;
