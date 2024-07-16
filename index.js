const express = require("express");
const app = express();
const nocache = require("nocache");
require('dotenv').config();
const path = require("path");
require('./passport')
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const session = require("express-session");
const blocked = require("./middlewares/blocked");
const adminRoute = require("./routes/adminRoute");

const userRoute = require("./routes/userRoute");

const MongoDBStore = require("connect-mongodb-session")(session);
mongoose.connect("mongodb+srv://akbhat:HYcENpqyVAgWxQHh@cluster0.pj6x3bi.mongodb.net/");

const store = new MongoDBStore({
  uri: "mongodb+srv://akbhat:HYcENpqyVAgWxQHh@cluster0.pj6x3bi.mongodb.net/",
  collection: "sessions",
});

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    store: store,
  })
);

app.set("view engine", "ejs");
app.set("views", "./views");

app.use('/products', express.static(path.join(__dirname, '/public/upload')));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/assetsAdmin", express.static(path.join(__dirname, "assetsAdmin")));
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use("/admin", adminRoute);
app.use("/users", adminRoute);
app.use("/products", adminRoute);
app.use("/addProduct", adminRoute);
app.use("/", adminRoute);
app.use("/addCategory", adminRoute);
app.use("/editCategory", adminRoute);
app.use("/category", adminRoute);

app.use(blocked.isBlocked);

app.use("/", userRoute);


app.listen(3000, () => {
    console.log(
      'Server is successfully running'
    );
  });