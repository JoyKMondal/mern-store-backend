const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const wishlistSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  author: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  stock: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  creator: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  itemId: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Wishlist", wishlistSchema);
