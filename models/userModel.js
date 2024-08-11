const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  secondName: {
    type: String,
    required: false,
  },
  password: {
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: true,
  },
  mobile: {
    type: Number,
    required: false,
    sparse:true,
    default:null
  },
  googleId:{
    type:String,
    unique:true
  },
  is_admin: {
    type: Number,
    default: 0,
  },
  is_verified: {
    type: Number,
    default: 0,
  },
  is_blocked: {
    type: Number,
    default: 0,
  },
  wallet: {
    balance: {
      type: Number,
      default: 0,
    },

    history: [
      {
        type: {
          type: String,
        },
        amount: {
          type: Number,
        },
        date: {
          type: Date,
          default: Date.now,
          required: true,
        },
        reason: {
          type: String,
        },
      },
    ],
  },
  referralCode: {
    type: String,
    unique: true,
  }
});

module.exports = mongoose.model("users", UserSchema);
