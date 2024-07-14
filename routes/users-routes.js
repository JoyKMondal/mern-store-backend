const express = require("express");
const { check } = require("express-validator");

const usersControllers = require("../controllers/users-controllers");
const checkAuth = require("../middleware/check-auth");
const fileUpload = require("../middleware/file-upload");

const router = express.Router();

router.post(
  "/signup",
  fileUpload.single("image"),
  [
    check("name").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  usersControllers.signup
);

router.post("/login", usersControllers.login);

router.get("/:uid", usersControllers.getUserById);

router.patch("/:uid", usersControllers.updateUser);

router.get("/list/:uid", usersControllers.getWishlistByUserId);

router.get("/product/cart/:uid", usersControllers.getCartByUserId);

router.use(checkAuth);

router.post("/cart/add", usersControllers.postCart);

router.patch("/cart/increase-quantity", usersControllers.increaseCartQuantity);

router.patch("/cart/decrease-quantity", usersControllers.decreaseCartQuantity);

router.delete("/:uid/cart/:pid", usersControllers.deleteCart);

router.post("/wishlist", usersControllers.createWishlist);

router.delete("/wishlist/:pid", usersControllers.deleteWishlist);

module.exports = router;
