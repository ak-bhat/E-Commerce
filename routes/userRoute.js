const express = require('express');
const path = require("path");
const userRoute = express();
const session = require("express-session");
const config = require('../config/config');
const userControl = require("../controllers/userController.js");
const auth = require("../middlewares/auth.js");



userRoute.use(
    session({
      secret: config.sessionSecret,
      resave: false, 
      saveUninitialized: true, 
    })
  );



userRoute.use("/static", express.static(path.join(__dirname, "public")));
userRoute.use("/assets", express.static(path.join(__dirname, "assets")));
userRoute.set("views", "./views/users");

userRoute.get("/",userControl.userHome);
userRoute.get('/user-logout', auth.isLogin, userControl.logout);
userRoute.get('/login',auth.isLogout,userControl.userSignupLoad);
userRoute.post('/login',userControl.insertUser);
userRoute.post('/verify-otp',userControl.verifyOTP);
userRoute.post('/resend-otp',userControl.resendOTP);


userRoute.get('/signin',auth.isLogout,userControl.getSignin);
userRoute.post('/signin',userControl.checkUserValid);


userRoute.get("/shop",userControl.loadShop);
userRoute.get("/productDetails/:productId", auth.isLogin,userControl.loadProductDetails);

userRoute.get("/userProfile",auth.isLogin,userControl.userProfile);


module.exports = userRoute;
