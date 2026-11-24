
// const express = require("express");
// const router = express.Router();

// const {
//   placeOrder,
//   getMyOrders,
//   getOrderById
// } = require("../controllers/orderController");

// const { protect } = require("../middleware/authMiddleware");

// router.post("/", protect, placeOrder);
// router.get("/my-orders", protect, getMyOrders);
// router.get("/:id", protect, getOrderById);

// module.exports = router;

const express = require("express");
const router = express.Router();

// Import order controller functions
const {
  placeOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyOrders,
  getOrderById
} = require("../controllers/orderController");

// Import authentication middleware
const { protect } = require("../middleware/authMiddleware");

// ========================================
// COD ORDER
// ========================================
router.post("/", protect, placeOrder);

// ========================================
// RAZORPAY PAYMENT ROUTES
// ========================================
router.post(
  "/razorpay/create",
  protect,
  createRazorpayOrder
);

router.post(
  "/razorpay/verify",
  protect,
  verifyRazorpayPayment
);

// ========================================
// ORDER HISTORY
// ========================================
router.get(
  "/my-orders",
  protect,
  getMyOrders
);

// ========================================
// GET SINGLE ORDER
// ========================================
router.get(
  "/:id",
  protect,
  getOrderById
);

module.exports = router;
