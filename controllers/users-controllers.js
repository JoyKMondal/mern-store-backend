const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const HttpError = require("../models/http-error");
const User = require("../models/user");
const Product = require("../models/product");
const Wishlist = require("../models/wishlist");

const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key:
        `${process.env.SENDGRID_KEY}`,
    },
  })
);

const signup = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { name, email, password, userType } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Signing up failed, please try again later1.",
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please login instead.",
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Hashing password failed, please try again. ",
      500
    );
    return next(error);
  }

  let imageUrl;
  if (req.file) {
    if (process.env.NODE_ENV === "production") {
      // Prod: Upload from memory buffer
      const { uploadToCloudinary } = require("../middleware/file-upload");
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
        console.log("Signup: Cloudinary URL:", imageUrl);
      } catch (err) {
        return next(new HttpError("Image upload failed", 500));
      }
    } else {
      // Dev: Use local path
      imageUrl = req.file.path;
    }
  } else {
    return next(new HttpError("No image provided", 422));
  }

  const createdUser = new User({
    name,
    email,
    password: hashedPassword,
    image: imageUrl,
    products: [],
    wishlists: [],
    cart: {},
    userType,
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Creating User failed, please try again.", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again.", 500);
    return next(error);
  }

  transporter.sendMail({
    to: email,
    from: "joykumarmondal007@gmail.com",
    subject: "Signup succeeded!",
    html: "<h1>You successfully signed up! Stay with us for exciting offer and discount.</h1>",
  });
  
  res.status(201).json({
    userId: createdUser.id,
    email: createdUser.email,
    token: token,
    userType: userType,
  });
};

const login = async (req, res, next) => {
  const { email, password, userType } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      "Finding user failed, please try again later.",
      500
    );
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      "User doesn't exists, could not log you in.",
      403
    );
    return next(error);
  }

  if (existingUser.userType !== userType) {
    const error = new HttpError(
      "Invalid credentials, provide valid user type.",
      403
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      "Could not log you in, please check your credentials and try again.",
      500
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      "Password isnot valid, could not log you in. ",
      403
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError(
      "Signing in failed, could not log you in. ",
      403
    );
    return next(error);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
    userType: userType,
  });
};

const getUserById = async (req, res, next) => {
  const userId = req.params.uid;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find user for the provided user id.",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError(
      "Could not find a user for the provided id.",
      404
    );
    return next(error);
  }

  res.json({ user: user.toObject({ getters: true }) });
};

const updateUser = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { name, email, password } = req.body;
  const userId = req.params.uid;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Could not find user for the provided user id.",
      500
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      "Hashing password failed, please try again. ",
      500
    );
    return next(error);
  }

  user.name = name;
  user.email = email;
  user.password = hashedPassword;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError(
      "Saving user failed, could not update the user.",
      500
    );
    return next(error);
  }

  res.status(200).json({ user: user.toObject({ getters: true }) });
};

const createWishlist = async (req, res, next) => {
  const {
    title,
    author,
    category,
    description,
    stock,
    price,
    image,
    productId,
    userId,
  } = req.body;

  const createdProduct = new Wishlist({
    title,
    author,
    description,
    category,
    stock,
    price,
    imageUrl: image,
    creator: userId,
    itemId: productId,
  });

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Finding user failed, please try again",
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);
    return next(error);
  }

  try {
    await createdProduct.save();
    user.wishlists.push(createdProduct);
    await user.save();
  } catch (err) {
    const error = new HttpError(
      "Creating wishlist failed, please try again later2.",
      500
    );
    return next(error);
  }

  res.status(201).json({ product: createdProduct });
};

const deleteWishlist = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    // product = await Wishlist.find({ itemId: productId }).populate("creator");
    product = await Wishlist.findById(productId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Populating wishlist failed, could not delete item.",
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError("Could not find product for this id.", 404);
    return next(error);
  }

  try {
    await product.deleteOne({ creator: product.id });
    product.creator.wishlists.pull(product);
    await product.creator.save();
  } catch (err) {
    const error = new HttpError(
      "Pulling and Saving failed, could not delete product.",
      500
    );
    return next(error);
  }

  res.status(200).json({ message: "wishlist removed!" });
};

const getWishlistByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithProducts;
  try {
    // userWithProducts = await User.findById(userId).populate("wishlists");
    userWithProducts = await Wishlist.find({ creator: userId });
  } catch (err) {
    const error = new HttpError(
      "Fetching wishlists failed, please try again later",
      500
    );
    return next(error);
  }

  if (!userWithProducts || userWithProducts.length === 0) {
    return next(
      new HttpError("Could not find places for the provided user id.", 404)
    );
  }

  res.json({
    products: userWithProducts.map((product) =>
      product.toObject({ getters: true })
    ),
  });
};

const postCart = async (req, res, next) => {
  const { productId, userId } = req.body;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError("could not find user", 500);
    return next(error);
  }

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError("could not find the product", 500);
    return next(error);
  }

  try {
    await user.addToCart(product);
  } catch (err) {
    const error = new HttpError(
      "Adding product to cart failed, please try again later.",
      500
    );
    return next(error);
  }

  res.json({
    cart: user.cart.items.map((product) => product.toObject({ getters: true })),
  });
};

const deleteCart = async (req, res, next) => {
  const userId = req.params.uid;
  const productId = req.params.pid;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError("could not find user", 500);
    return next(error);
  }

  try {
    await user.removeFromCart(productId);
  } catch (err) {
    const error = new HttpError(
      "Removing product from cart failed, please try again later.",
      500
    );
    return next(error);
  }

  res.json({
    message: "product removed from cart!",
    cart: user.cart.items.map((product) => product.toObject({ getters: true })),
  });
};

const getCartByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userCards;
  try {
    userCards = await User.findById(userId).populate("cart.items.productId");
  } catch (err) {
    const error = new HttpError(
      "Fetching cart items failed, please try again later",
      500
    );
    return next(error);
  }

  const products = userCards.cart.items;
  let total = 0;

  products.forEach((p) => {
    total += p.quantity * p.productId.price;
  });

  res.json({
    products: userCards.cart.items.map((product) =>
      product.toObject({ getters: true })
    ),
    total: total,
  });
};

const increaseCartQuantity = async (req, res, next) => {
  const { productId, userId } = req.body;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError("could not find user", 500);
    return next(error);
  }

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError("could not find the product", 500);
    return next(error);
  }

  try {
    await user.increaseQuantity(product);
  } catch (err) {
    const error = new HttpError(
      "Increasing quantity failed, please try again later.",
      500
    );
    return next(error);
  }

  res.json({
    cart: user.cart.items.map((product) => product.toObject({ getters: true })),
  });
};

const decreaseCartQuantity = async (req, res, next) => {
  const { productId, userId } = req.body;

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError("could not find user", 500);
    return next(error);
  }

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError("could not find the product", 500);
    return next(error);
  }

  try {
    await user.decreaseQuantity(product);
  } catch (err) {
    const error = new HttpError(
      "Decreasing quantity failed, please try again later.",
      500
    );
    return next(error);
  }

  res.json({
    cart: user.cart.items.map((product) => product.toObject({ getters: true })),
  });
};

exports.signup = signup;
exports.login = login;
exports.getUserById = getUserById;
exports.updateUser = updateUser;
exports.createWishlist = createWishlist;
exports.deleteWishlist = deleteWishlist;
exports.getWishlistByUserId = getWishlistByUserId;
exports.getCartByUserId = getCartByUserId;
exports.postCart = postCart;
exports.deleteCart = deleteCart;
exports.increaseCartQuantity = increaseCartQuantity;
exports.decreaseCartQuantity = decreaseCartQuantity;
