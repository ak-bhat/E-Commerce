const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "products",
      },
      count: {
        type: Number,
        default: 1,
      },
    },
  ],
  appliedCoupon: {
    type: String,
  }
});

module.exports = mongoose.model("cart", cartSchema);
