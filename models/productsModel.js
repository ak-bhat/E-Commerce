const mongoose = require("mongoose");

const productsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  image: [
    {
      data: {
        type: Buffer,
        required: true,
      },
      contentType: {
        type: String,
        required: true,
      },
    },
  ],
  isListed: {
    type: Boolean,
    default: true,
  },
  price: {
    type: Number,
    required: true,
  }
});


module.exports = mongoose.model("products", productsSchema);