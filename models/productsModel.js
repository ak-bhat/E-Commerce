const { name } = require("ejs");
const mongoose = require("mongoose");

const productsSchema = mongoose.Schema({
  name:{
    type:String,
    required:true
  },
  productImage: [
    {
      data:Buffer,
        
      contentType: {
        type: String,
        default: null,
      },
    },
  ],
  category:{
    type:String,
    required:true
  },
  description:{
    type:String,
    required:true
  },
  price:{
    type:Number,
    required:true
  },
  quantity:{
    type:Number,
    required:true
  },
  isListed:{
    type:Boolean,
    default:true
  }
});


module.exports = mongoose.model("products", productsSchema);