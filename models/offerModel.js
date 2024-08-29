const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  offerName: {
    type: String,
    required: true,
  },
  offerDiscount: {
    type: Number,
  },
  expiryDate: {
    type: Date,
  },
  isListed:{
    type:Boolean,
    default:true
  },
});

const Offer = mongoose.model("Offer", offerSchema);
module.exports = Offer;
