const express = require('express');
const app = express();                  //Server created
const path = require("path");



app.set("view engine", "ejs");
app.set("views", "./views");

app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/assetsAdmin", express.static(path.join(__dirname, "assetsAdmin")));

app.get('/',(req,res)=>{
  res.render('./users/login')
})





app.listen(3000, () => {
    console.log(
      'Server is successfully running'
    );
  });