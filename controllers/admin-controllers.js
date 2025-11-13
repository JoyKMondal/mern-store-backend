const { validationResult } = require("express-validator");
const { uploadToCloudinary } = require('../middleware/file-upload');
const mongoose = require("mongoose");
const fs = require("fs");

const HttpError = require("../models/http-error");
const Product = require("../models/product");
const User = require("../models/user");

const getAllProducts = async (req, res, next) => {
  let products;
  try {
    products = await Product.find({});
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find all products.",
      500
    );
    return next(error);
  }

  if (!products) {
    const error = new HttpError("Could not find products.", 404);
    return next(error);
  }

  res.json({ products: products });
};

const getProductsById = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find product for the provided id.",
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError(
      "Could not find a product for the provided id.",
      404
    );
    return next(error);
  }

  res.json({ product: product.toObject({ getters: true }) });
};

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    const error = new HttpError(
      "Fetching users failed, please try again later.",
      500
    );
    return next(error);
  }
  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const createProduct = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, author, category, description, stock, price } = req.body;

  let imageUrl;
  if (req.file) {
    if (process.env.NODE_ENV === "production") {
      // Prod: Upload from memory buffer
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
        console.log("Signup: Cloudinary URL:", imageUrl);
      } catch (err) {
        return next(new HttpError("Product Image upload failed", 500));
      }
    } else {
      // Dev: Use local path
      imageUrl = req.file.path;
    }
  } else {
    return next(new HttpError("No image provided", 422));
  }

  const createdProduct = new Product({
    title,
    author,
    description,
    category,
    stock,
    price,
    imageUrl: imageUrl,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating product failed, please try again!",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);
    return next(error);
  }

  if (user.userType !== "Admin") {
    const error = new HttpError(
      "Creating place failed, please try again. User must be an admin to perform this action",
      404
    );
    return next(error);
  }

  try {
    // const sess = await mongoose.startSession();
    // sess.startTransaction();
    // await createdPlace.save({ session: sess });
    await createdProduct.save();
    user.products.push(createdProduct);
    // await user.save({ session: sess });
    await user.save();
    // await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again later2.",
      500
    );
    return next(error);
  }

  res.status(201).json({ product: createdProduct });
};

const updateProduct = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description, author, price, category, stock } = req.body;
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      "Could not find product, could not update place.",
      500
    );
    return next(error);
  }

  let user;
  try {
    user = await User.findById(product.creator);
  } catch (err) {
    const error = new HttpError("Finding user failed, please try again", 500);
    return next(error);
  }

  if (user.userType !== "Admin") {
    const error = new HttpError(
      "Creating place failed, please try again. User must be an admin to perform update action",
      404
    );
    return next(error);
  }

  if (product.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are not allowed to edit this place.", 401);
    return next(error);
  }

  // Image handling
  let imageUrl = product.imageUrl; // Keep old by default
  if (req.file) {
    if (process.env.NODE_ENV === 'production') {
      // Prod: Upload from buffer
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
        console.log('Update: Cloudinary URL:', imageUrl);
      } catch (err) {
        return next(new HttpError('Image upload failed', 500));
      }
    } else {
      // Dev: Use local path
      imageUrl = req.file.path;
      // Optional: Delete old local file
      if (product.imageUrl) {
        const oldPath = path.join(__dirname, '..', product.imageUrl);
        fs.unlink(oldPath, (err) => {
          if (err) console.log('Delete old file error:', err);
        });
      }
    }
  }

  product.title = title;
  product.description = description;
  product.author = author;
  product.price = price;
  product.category = category;
  product.stock = stock;
  product.imageUrl = imageUrl;

  try {
    await product.save();
  } catch (err) {
    const error = new HttpError(
      "Updating products failed, could not update place.",
      500
    );
    return next(error);
  }

  res.status(200).json({ product: product.toObject({ getters: true }) });
};

const deleteProduct = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Populating products failed, could not delete product.",
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError("Could not find product for this id.", 404);
    return next(error);
  }

  if(product.creator.userType !== 'Admin'){
    const error = new HttpError("User must be an admin to perform delete action", 404);
    return next(error);
  }

  if (product.creator.id !== req.userData.userId) {
    const error = new HttpError("You are not allowed to delete this product.", 401);
    return next(error);
  }

  const imagePath = product.imageUrl;

  try {
    // const sess = await mongoose.startSession();
    // sess.startTransaction();
    // await product.deleteOne({ session: sess });
    await product.deleteOne({ creator: product.id });
    product.creator.products.pull(product);
    // await product.creator.save({ session: sess });
    await product.creator.save();
    // await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete product##.",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted product." });
};

exports.getUsers = getUsers;
exports.getAllProducts = getAllProducts;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.getProductsById = getProductsById;
