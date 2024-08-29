const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
  },
  discountAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  validFrom: {
    type: Date,
    required: true,
  },
  validTo: {
    type: Date,
    required: true,
  },
  couponName: {
    type: String,
    required: true,
  },
  minimumSpend: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  isListed:{
    type:Boolean,
    default:true
  },
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
