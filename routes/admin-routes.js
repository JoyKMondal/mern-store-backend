const express = require("express");
const { check } = require("express-validator");
const checkAuth = require("../middleware/check-auth");
const fileUpload = require("../middleware/file-upload");

const adminControllers = require("../controllers/admin-controllers");

const router = express.Router();

router.get("/users", adminControllers.getUsers);

router.get("/", adminControllers.getAllProducts);

router.get("/:pid", adminControllers.getProductsById);

router.use(checkAuth);

router.post(
  "/create-product",
  fileUpload.single("image"),
  [
    check("title").not().isEmpty(),
    check("author").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("category").not().isEmpty(),
    check("stock").not().isEmpty(),
    check("price").not().isEmpty(),
  ],
  adminControllers.createProduct
);

router.patch(
  "/:pid",
  fileUpload.single("image"),
  [
    check("title").not().isEmpty(),
    check("author").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("category").not().isEmpty(),
    check("stock").not().isEmpty(),
    check("price").not().isEmpty(),
  ],
  adminControllers.updateProduct
);

router.delete("/:pid", adminControllers.deleteProduct);

module.exports = router;
