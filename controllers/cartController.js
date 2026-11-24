
const Cart = require("../models/Cart");
const Product = require("../models/Product");

// GET CART
exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({
      user: req.user._id
    }).populate("items.product");

    if (!cart) {
      return res.json({
        user: req.user._id,
        items: []
      });
    }

    // Remove items whose product references are invalid
    const originalLength = cart.items.length;

    cart.items = cart.items.filter(
      item => item.product !== null
    );

    if (cart.items.length !== originalLength) {
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// ADD TO CART
exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const quantity = Number(req.body.quantity || 1);

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Valid product ID and quantity are required"
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    let cart = await Cart.findOne({
      user: req.user._id
    });

    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: []
      });
    }

    // Remove any old invalid references before adding
    const populatedCart = await Cart.findById(cart._id)
      .populate("items.product");

    if (populatedCart) {
      cart.items = populatedCart.items.filter(
        item => item.product !== null
      );
    }

    const existingItem = cart.items.find(
      item => item.product.toString() === productId
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    if (newQuantity > product.stock) {
      return res.status(400).json({
        message: "Requested quantity exceeds available stock"
      });
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: productId,
        quantity
      });
    }

    await cart.save();

    cart = await Cart.findById(cart._id)
      .populate("items.product");

    res.status(200).json({
      message: "Product added to cart",
      cart
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// UPDATE QUANTITY
exports.updateCart = async (req, res) => {
  try {
    const quantity = Number(req.body.quantity);
    const { productId } = req.params;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Quantity must be a positive integer"
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    if (quantity > product.stock) {
      return res.status(400).json({
        message: "Requested quantity exceeds available stock"
      });
    }

    const cart = await Cart.findOne({
      user: req.user._id
    });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      });
    }

    const item = cart.items.find(
      item => item.product.toString() === productId
    );

    if (!item) {
      return res.status(404).json({
        message: "Item not found in cart"
      });
    }

    item.quantity = quantity;
    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate("items.product");

    res.json({
      message: "Cart updated",
      cart: updatedCart
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// REMOVE ITEM
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      user: req.user._id
    });

    if (!cart) {
      return res.status(404).json({
        message: "Cart not found"
      });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== req.params.productId
    );

    await cart.save();

    const updatedCart = await Cart.findById(cart._id)
      .populate("items.product");

    res.json({
      message: "Product removed",
      cart: updatedCart
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// CLEAR CART
exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [] } }
    );

    res.json({
      message: "Cart cleared successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};
