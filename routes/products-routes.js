const express = require("express");
const { check } = require("express-validator");
const checkAuth = require("../middleware/check-auth");

const productsControllers = require("../controllers/products-controllers");

const router = express.Router();

router.get("/", productsControllers.getProducts);

router.get("/:pid", productsControllers.getProductById);

router.get("/user/:uid", productsControllers.getProductsByUserId);

router.get("/order/:uid", productsControllers.getOrder);

router.get("user/:uid/orders/:orderId", productsControllers.getInvoice);

router.get("/comments/:pid", productsControllers.getCommentsByProductId);

router.post(
  "/comments/add",
  [check("title").not().isEmpty(), check("description").not().isEmpty()],
  productsControllers.postComment
);

router.use(checkAuth);

router.post("/order/:uid", productsControllers.postOrder);

router.delete("/order/:oid", productsControllers.cancelOrder);

// ###################################
// router.get("/user/:uid", productsControllers.getPlacesByUserId);
// to see only own places, we need to extract the uid from the req.userData.userId.
// ##################################

// router.get("/category/:cat_name", productsControllers.getProductsByCategory);

// router.get("/brand/:brand_name", productsControllers.getProductsByBrand);

module.exports = router;
