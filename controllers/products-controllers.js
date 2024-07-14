const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const HttpError = require("../models/http-error");
const Product = require("../models/product");
const User = require("../models/user");
const Order = require("../models/order");
const Comment = require("../models/comments");

const getProducts = async (req, res, next) => {
  let products;
  try {
    products = await Product.find();
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

  res.json({
    products: products.map((product) => product.toObject({ getters: true })),
  });
};

const getProductById = async (req, res, next) => {
  const productId = req.params.pid;

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a product.",
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

const getProductsByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithProducts;
  try {
    userWithProducts = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      "Fetching products failed, please try again later1",
      500
    );
    return next(error);
  }

  if (!userWithProducts || userWithProducts.products.length === 0) {
    return next(
      new HttpError("Could not find places for the provided user id.", 404)
    );
  }

  res.json({
    products: userWithProducts.products.map((product) =>
      product.toObject({ getters: true })
    ),
  });
};

const postOrder = async (req, res, next) => {
  const userId = req.params.uid;

  let user;
  try {
    user = await User.findById(userId).populate("cart.items.productId");
  } catch (err) {
    const error = new HttpError("could not find user and all of its products", 500);
    return next(error);
  }

  const products = user.cart.items.map((i) => {
    return {
      quantity: i.quantity,
      product: { ...i.productId._doc },
    };
  });

  const order = new Order({
    user: {
      email: user.email,
      userId: userId,
    },
    products: products,
  });

  try {
    await order.save();
  } catch (err) {
    const error = new HttpError("saving order failed", 500);
    return next(error);
  }

  try {
    await user.clearCart();
  } catch (err) {
    const error = new HttpError("clearing cart failed! Please try again.", 500);
    return next(error);
  }

  res.json({
    orders: order.products.map((product) =>
      product.toObject({ getters: true })
    ),
  });
};

const getOrder = async (req, res, next) => {
  const userId = req.params.uid;

  let orders;
  try {
    orders = await Order.find({ "user.userId": userId });
  } catch (err) {
    const error = new HttpError("could not find the order", 500);
    return next(error);
  }

  let total = 0;

  orders.forEach((o) => {
    o.products.forEach((prod) => {
      total += prod.quantity * prod.product.price;
    });
  });

  res.json({
    orders: orders.map((product) => product.toObject({ getters: true })),
    total: total,
  });
};

const cancelOrder = async (req, res, next) => {
  const orderId = req.params.oid;

  let order;
  try {
    order = await Order.findById(orderId);
  } catch (err) {
    const error = new HttpError("could not find order for the provided!", 500);
    return next(error);
  }

  try {
    await order.deleteOne({ _id: orderId });
  } catch (err) {
    const error = new HttpError(
      "Canceling order failed, please try again later.",
      500
    );
    return next(error);
  }

  res.json({
    message: "order removed!",
  });
};

const getInvoice = async (req, res, next) => {
  const orderId = req.params.orderId;
  const userId = req.params.uid;
  const order = await Order.findById(orderId);
  if (!order) {
    return next(new HttpError("No order found.", 500));
  }
  if (order.user.userId.toString() !== userId.toString()) {
    return next(new HttpError("Unauthorized."));
  }
  const invoiceName = "invoice-mern-" + orderId + ".pdf";
  const invoicePath = path.join("data", "invoices", invoiceName);

  const pdfDoc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'inline; filename="' + invoiceName + '"'
  );
  pdfDoc.pipe(fs.createWriteStream(invoicePath));
  pdfDoc.pipe(res);

  pdfDoc.fontSize(28).text("Invoice", {
    underline: true,
  });
  pdfDoc.text("-----------------------");
  let totalPrice = 0;
  order.products.forEach((prod) => {
    totalPrice += prod.quantity * prod.product.price;
    pdfDoc
      .fontSize(16)
      .text(
        prod.product.title +
          " - " +
          prod.quantity +
          " x " +
          "$" +
          prod.product.price
      );
  });
  pdfDoc.text("---");
  pdfDoc.fontSize(20).text("Total Price: $" + totalPrice);
  pdfDoc.fontSize(20).text("Thank you");
  pdfDoc.end();
};

const postComment = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }

  const { title, description, productId, userImageUrl } = req.body;

  const createdComment = new Comment({
    title,
    description,
    productId,
    userImageUrl,
  });

  let product;
  try {
    product = await Product.findById(productId);
  } catch (err) {
    const error = new HttpError(
      "Finding products failed, please try again1",
      500
    );
    return next(error);
  }

  if (!product) {
    const error = new HttpError("Could not find product for provided id", 404);
    return next(error);
  }

  try {
    await createdComment.save();
    product.comments.push(createdComment);
    await product.save();
  } catch (err) {
    const error = new HttpError(
      "Saving comments failed, please try again later.",
      500
    );
    return next(error);
  }

  res.status(201).json({ comments: createdComment });
};

const getCommentsByProductId = async (req, res, next) => {
  const productId = req.params.pid;

  let productWithComments;
  try {
    productWithComments = await Product.findById(productId).populate(
      "comments"
    );
  } catch (err) {
    const error = new HttpError(
      "Fetching comments from products failed, please try again",
      500
    );
    return next(error);
  }

  res.json({
    comments: productWithComments.comments.map((comment) =>
      comment.toObject({ getters: true })
    ),
  });
};

// const getProductsByCategory = async (req, res, next) => {
//   const productCat = req.params.cat_name;

//   let catFilteredProduct;
//   try {
//     catFilteredProduct = await Product.findOne({ category: productCat }).exec();
//   } catch (err) {
//     const error = new HttpError(
//       "Something went wrong, could not find a product.",
//       500
//     );
//     return next(error);
//   }

//   if (!catFilteredProduct) {
//     const error = new HttpError(
//       "Could not find a product for the provided category.",
//       404
//     );
//     return next(error);
//   }

//   res.json({
//     catFilteredProduct: catFilteredProduct.toObject({ getters: true }),
//   });
// };

// const getProductsByBrand = async (req, res, next) => {
//   const productBrand = req.params.brand_name;

//   let brandFilteredProduct;
//   try {
//     brandFilteredProduct = await Product.findOne({
//       author: productBrand,
//     }).exec();
//   } catch (err) {
//     const error = new HttpError(
//       "Something went wrong, could not find a product.",
//       500
//     );
//     return next(error);
//   }

//   if (!brandFilteredProduct) {
//     const error = new HttpError(
//       "Could not find a product for the provided category.",
//       404
//     );
//     return next(error);
//   }

//   res.json({
//     brandFilteredProduct: brandFilteredProduct.toObject({ getters: true }),
//   });
// };

exports.getProducts = getProducts;
exports.getProductById = getProductById;
exports.getProductsByUserId = getProductsByUserId;
exports.getOrder = getOrder;
exports.postOrder = postOrder;
exports.getInvoice = getInvoice;
exports.postComment = postComment;
exports.getCommentsByProductId = getCommentsByProductId;
exports.cancelOrder = cancelOrder;

// exports.getProductsByCategory = getProductsByCategory;
// exports.getProductsByBrand = getProductsByBrand;
