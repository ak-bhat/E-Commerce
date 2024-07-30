const mongoose = require("mongoose");
const user = require("../models/userModel");
const product = require("../models/productsModel");

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
});

module.exports = mongoose.model("cart", cartSchema);
