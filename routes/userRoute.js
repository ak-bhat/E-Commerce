const express = require('express');
const path = require("path");
const userRoute = express();
const userControl = require("../controllers/userController.js");

userRoute.use("/static", express.static(path.join(__dirname, "public")));
userRoute.use("/assets", express.static(path.join(__dirname, "assets")));
userRoute.set("views", "./views/users");