
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// GET WISHLIST
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      user: req.user._id
    }).populate("products");

    res.json(wishlist || {
      user: req.user._id,
      products: []
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADD TO WISHLIST
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required"
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    let wishlist = await Wishlist.findOne({
      user: req.user._id
    });

    if (!wishlist) {
      wishlist = new Wishlist({
        user: req.user._id,
        products: []
      });
    }

    const exists = wishlist.products.some(
      id => id.toString() === productId
    );

    if (exists) {
      return res.status(400).json({
        message: "Product already in wishlist"
      });
    }

    wishlist.products.push(productId);

    await wishlist.save();

    wishlist = await Wishlist.findById(wishlist._id)
      .populate("products");

    res.json({
      message: "Added to wishlist",
      wishlist
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// REMOVE FROM WISHLIST
exports.removeFromWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({
      user: req.user._id
    });

    if (!wishlist) {
      return res.status(404).json({
        message: "Wishlist not found"
      });
    }

    wishlist.products = wishlist.products.filter(
      id => id.toString() !== req.params.productId
    );

    await wishlist.save();

    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate("products");

    res.json({
      message: "Removed from wishlist",
      wishlist: updatedWishlist
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
