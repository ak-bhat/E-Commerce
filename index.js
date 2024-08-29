const express = require("express");
const app = express();
const nocache = require("nocache");
require('dotenv').config();
const path = require("path");
const passport = require('./passport');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const blocked = require("./middlewares/blocked");
const adminRoute = require("./routes/adminRoute");
const cookieSession = require('cookie-session'); 


const userRoute = require("./routes/userRoute");

const MongoDBStore = require("connect-mongodb-session")(session);
mongoose.connect("mongodb+srv://akbhat:HYcENpqyVAgWxQHh@cluster0.pj6x3bi.mongodb.net/");

const store = new MongoDBStore({
  uri: "mongodb+srv://akbhat:HYcENpqyVAgWxQHh@cluster0.pj6x3bi.mongodb.net/",
  collection: "sessions",
});


app.set("view engine", "ejs");
app.set("views", "./views");
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/assetsAdmin", express.static(path.join(__dirname, "assetsAdmin")));
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: store,
    cookie:{
      secure:false,
      httpOnly:true,
      maxAge:72*60*60*1000
    }
  })
); 


app.use(passport.initialize());
app.use(passport.session());

app.use("/admin", adminRoute);
app.use("/users", adminRoute);
app.use("/products", adminRoute);
app.use("/addProduct", adminRoute);
app.use("/", adminRoute);
app.use("/addCategory", adminRoute);
app.use("/editCategory", adminRoute);
app.use("/category", adminRoute);
app.use("/updateProduct",adminRoute);

app.use(blocked.isBlocked);

app.use("/", userRoute);

app.all('*', (req, res) => {
  res.status(404).send('<h1>404! Page not found</h1>');
});


app.listen(3000, () => {
    console.log(
      'Server is successfully running'
    );
  });