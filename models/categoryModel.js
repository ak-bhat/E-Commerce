const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  categoryName: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isListed: {
    type: Boolean,
    required: true,
  },
  offer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Offer",
  },
  offerDiscount: {
    type: Number,
    default: null,
  },
});

module.exports = mongoose.model("category", categorySchema);