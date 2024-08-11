const express = require('express');
const path = require("path");
const userRoute = express();
const passport = require('passport');
const session = require("express-session");
const config = require('../config/config');
const userControl = require("../controllers/userController.js");
const auth = require("../middlewares/auth.js");
const userProControl = require('../controllers/userProfileController.js')
const cartControl = require("../controllers/cartController");
const orderControl = require("../controllers/orderController");
const { verifyOrder } = require('../controllers/orderController');


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
userRoute.get('/verify-otp',auth.isLogout)
userRoute.post('/verify-otp',userControl.verifyOTP);
userRoute.post('/resend-otp',userControl.resendOTP);

userRoute.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
userRoute.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{
  res.redirect('/')
})

userRoute.get('/signin',auth.isLogout,userControl.getSignin);
userRoute.post('/signin',userControl.checkUserValid);


userRoute.get("/shop",userControl.loadShop);
userRoute.get("/productDetails/:productId", auth.isLogin,userControl.loadProductDetails);
// userRoute.get('/search',userControl.searchProducts)

userRoute.get("/userProfile",auth.isLogin,userProControl.userProfile);
userRoute.get('/userProfile', auth.isLogin, userProControl.getUserAddresses);
userRoute.post("/updateUserProfile", auth.isLogin, userProControl.updateUserProfile);
userRoute.post('/change-password', auth.isLogin, userProControl.changePassword);
userRoute.post('/addAddress', auth.isLogin,userProControl.addAddress);
userRoute.delete('/removeAddress/:addressId', auth.isLogin, userProControl.removeAddress);
userRoute.put('/updateAddress/:addressId', auth.isLogin, userProControl.updateAddress);
userRoute.get('/getAddress/:addressId', auth.isLogin, userProControl.getAddress);
userRoute.get('/referral', auth.isLogin, userControl.generateReferral);


userRoute.post('/addToCart',auth.isLogin,cartControl.addToCartFn);
userRoute.patch('/updateProductCount/:productId', auth.isLogin, cartControl.updateProductCountFn);
userRoute.get('/cart',auth.isLogin,cartControl.loadCart);
userRoute.delete('/removeFromCart/:productId', auth.isLogin, cartControl.removeFromCartFn);

userRoute.get('/wishlist',auth.isLogin, userControl.loadWishlist);
userRoute.post('/addToWishlist', auth.isLogin, userControl.addToWishlist);
userRoute.delete('/removeFromWishList/:productId', auth.isLogin, userControl.removeFromWishList);


userRoute.get('/fetchWalletBalance/:userId', orderControl.fetchWalletBalance);
userRoute.get('/checkout',auth.isLogin,orderControl.loadCheckout);
userRoute.post('/placeOrder', auth.isLogin, orderControl.placeOrder);
userRoute.post('/createOrder',auth.isLogin,orderControl.createOrder);
userRoute.post('/addShippingDetails', auth.isLogin, userProControl.addShippingDetails);
userRoute.get('/loadOrderPlaced',auth.isLogin , orderControl.loadOrderPlaced);
userRoute.post('/api/payment/verify',auth.isLogin,orderControl.verifyOrder);


userRoute.post('/storeAppliedCoupon', (req, res) => {
  const { couponCode } = req.body;
  // req.session.appliedCoupon = couponCode;
  res.json({ success: true });
});


userRoute.get('/orders',auth.isLogin,orderControl.loadOrders);
userRoute.get('/orderDetails/:orderId', auth.isLogin, orderControl.loadOrderDetails);
userRoute.post('/cancelOrder/:orderId/:productId', auth.isLogin, orderControl.cancelOrder);
userRoute.post('/returnProduct/:orderId/:productId', auth.isLogin, orderControl.returnProduct);

module.exports = userRoute;
