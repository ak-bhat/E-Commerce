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
  category: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "category",
  required: true
},
  description:{
    type:String,
    required:true
  },
  price:{
    type:Number,
    required:true
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
  },
  offerPrice: {
    type: Number,
    default: null,
  },
  catOfferPrice: {
    type: Number,
    default: null,
  },
  quantity:{
    type:Number,
    required:true
  },
  isListed:{
    type:Boolean,
    default:true
  }
},{
  timestamps:true
});

productsSchema.methods.applyCategoryOffer = async function (
  category,
  offerDiscount
) {
  if (this.category === category && this.price) {
    this.catOfferPrice = this.price - this.price * (offerDiscount / 100);
  }
};



module.exports = mongoose.model("products", productsSchema);