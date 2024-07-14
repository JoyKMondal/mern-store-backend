const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const commentSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  userImageUrl: {
    type: String,
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  productId: {
    type: mongoose.Types.ObjectId,
    ref: "Product",
    required: true,
  },
});

module.exports = mongoose.model("Comment", commentSchema);
