// 
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PaymentAttempt = require("../models/PaymentAttempt");

const Razorpay = require("razorpay");
const crypto = require("crypto");

// Razorpay configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Validate delivery address
const validateAddress = ({
  fullName,
  phone,
  address,
  city,
  state,
  pincode
}) => {
  return (
    fullName &&
    phone &&
    /^[0-9]{10}$/.test(String(phone)) &&
    address &&
    city &&
    state &&
    /^[0-9]{6}$/.test(String(pincode))
  );
};

// ========================================
// 1. PLACE COD ORDER
// ========================================
const placeOrder = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      city,
      state,
      pincode
    } = req.body;

    if (!validateAddress(req.body)) {
      return res.status(400).json({
        message: "Please provide a valid delivery address"
      });
    }

    const cart = await Cart.findOne({
      user: req.user._id
    }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty"
      });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        return res.status(400).json({
          message: "A product is no longer available"
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `${product.name} has insufficient stock`
        });
      }

      const price = Number(product.price);

      subtotal += price * item.quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price,
        quantity: item.quantity
      });
    }

    const shippingCharge = subtotal >= 1000 ? 0 : 50;
    const totalAmount = subtotal + shippingCharge;

    // Reduce stock only when sufficient stock remains.
    for (const item of cart.items) {
      const updated = await Product.updateOne(
        {
          _id: item.product._id,
          stock: { $gte: item.quantity }
        },
        {
          $inc: { stock: -item.quantity }
        }
      );

      if (updated.modifiedCount !== 1) {
        return res.status(409).json({
          message: `${item.product.name} stock has changed. Please try again.`
        });
      }
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress: {
        fullName,
        phone,
        address,
        city,
        state,
        pincode
      },
      subtotal,
      shippingCharge,
      totalAmount,
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Placed"
    });

    cart.items = [];
    await cart.save();

    return res.status(201).json({
      message: "Order placed successfully",
      order
    });

  } catch (error) {
    console.error("Place order error:", error);

    return res.status(500).json({
      message: "Unable to place order",
      error: error.message
    });
  }
};

// ========================================
// 2. CREATE RAZORPAY ORDER
// ========================================
const createRazorpayOrder = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      address,
      city,
      state,
      pincode
    } = req.body;

    if (!validateAddress(req.body)) {
      return res.status(400).json({
        message: "Please provide a valid delivery address"
      });
    }

    const cart = await Cart.findOne({
      user: req.user._id
    }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty"
      });
    }

    let subtotal = 0;
    const items = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product) {
        return res.status(400).json({
          message: "A product is no longer available"
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `${product.name} has insufficient stock`
        });
      }

      const price = Number(product.price);

      subtotal += price * item.quantity;

      items.push({
        product: product._id,
        name: product.name,
        image: product.image,
        price,
        quantity: item.quantity
      });
    }

    const shippingCharge = subtotal >= 1000 ? 0 : 50;
    const totalAmount = subtotal + shippingCharge;

    // Create Razorpay order (amount is in paise)
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    // Save payment attempt in MongoDB
    await PaymentAttempt.create({
      user: req.user._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      items,
      shippingAddress: {
        fullName,
        phone,
        address,
        city,
        state,
        pincode
      },
      subtotal,
      shippingCharge,
      totalAmount
    });

    return res.status(201).json({
      message: "Payment order created",
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error("Create Razorpay order:", error);

    return res.status(500).json({
      message: "Unable to create payment order"
    });
  }
};

// ========================================
// 3. VERIFY RAZORPAY PAYMENT
// ========================================
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Payment details are missing"
      });
    }

    const attempt = await PaymentAttempt.findOne({
      user: req.user._id,
      razorpayOrderId: razorpay_order_id
    });

    if (!attempt) {
      return res.status(404).json({
        message: "Payment attempt not found"
      });
    }

    if (attempt.status === "Completed") {
      return res.status(409).json({
        message: "This payment has already been processed"
      });
    }

    // Verify Razorpay signature
    const body =
      `${attempt.razorpayOrderId}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    const received = Buffer.from(razorpay_signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({
        message: "Invalid payment signature"
      });
    }

    // Verify payment details with Razorpay
    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.order_id !== attempt.razorpayOrderId ||
      payment.status !== "captured" ||
      payment.amount !== attempt.amount ||
      payment.currency !== "INR"
    ) {
      return res.status(400).json({
        message: "Payment is not captured or does not match"
      });
    }

    // Check stock availability
    for (const item of attempt.items) {
      const product = await Product.findById(item.product);

      if (!product || product.stock < item.quantity) {
        return res.status(409).json({
          message: `${item.name} is no longer available in the requested quantity. Please contact support for payment assistance.`
        });
      }
    }

    // Reduce stock
    for (const item of attempt.items) {
      const updated = await Product.updateOne(
        {
          _id: item.product,
          stock: { $gte: item.quantity }
        },
        {
          $inc: { stock: -item.quantity }
        }
      );

      if (updated.modifiedCount !== 1) {
        return res.status(409).json({
          message: "Stock changed during payment processing. Please contact support."
        });
      }
    }

    // Create final order
    const order = await Order.create({
      user: req.user._id,
      items: attempt.items,
      shippingAddress: attempt.shippingAddress,
      subtotal: attempt.subtotal,
      shippingCharge: attempt.shippingCharge,
      totalAmount: attempt.totalAmount,
      paymentMethod: "Razorpay",
      paymentStatus: "Paid",
      orderStatus: "Placed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id
    });

    // Mark payment attempt completed
    attempt.status = "Completed";
    await attempt.save();

    // Clear cart
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [] } }
    );

    return res.status(200).json({
      message: "Payment verified and order placed successfully",
      order
    });

  } catch (error) {
    console.error("Verify Razorpay payment:", error);

    return res.status(500).json({
      message: "Payment verification failed. Please contact support."
    });
  }
};

// ========================================
// 4. GET MY ORDERS
// ========================================
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      orders
    });

  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      message: "Unable to fetch orders"
    });
  }
};

// ========================================
// 5. GET SINGLE ORDER
// ========================================
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    return res.status(200).json({
      order
    });

  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      message: "Unable to fetch order"
    });
  }
};

// ========================================
// EXPORT ALL CONTROLLER FUNCTIONS
// ========================================
module.exports = {
  placeOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getMyOrders,
  getOrderById
};
