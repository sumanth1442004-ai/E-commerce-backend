
require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");

const products = [
  {
    name: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "Mobiles",
    price: 54999,
    originalPrice: 74999,
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600",
    description: "Premium Samsung smartphone",
    stock: 20,
    rating: 4.5,
    featured: true
  },
  {
    name: "Apple iPhone 15",
    brand: "Apple",
    category: "Mobiles",
    price: 59999,
    originalPrice: 69999,
    image: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600",
    description: "Apple smartphone",
    stock: 15,
    rating: 4.7,
    featured: true
  },
  {
    name: "HP Pavilion Laptop",
    brand: "HP",
    category: "Electronics",
    price: 58999,
    originalPrice: 69999,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600",
    description: "Laptop for work and study",
    stock: 12,
    rating: 4.3
  },
  {
    name: "Sony Wireless Headphones",
    brand: "Sony",
    category: "Electronics",
    price: 2999,
    originalPrice: 4999,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
    description: "Wireless headphones",
    stock: 30,
    rating: 4.2
  },
  {
    name: "Men's Casual T-Shirt",
    brand: "Roadster",
    category: "Fashion",
    price: 499,
    originalPrice: 999,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600",
    description: "Comfortable casual T-shirt",
    stock: 50,
    rating: 4.1
  },
  {
    name: "Sports Running Shoes",
    brand: "Puma",
    category: "Fashion",
    price: 2499,
    originalPrice: 3999,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
    description: "Running shoes",
    stock: 25,
    rating: 4.4
  }
];

async function seedProducts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await Product.deleteMany({});
    await Product.insertMany(products);

    console.log("Sample products added successfully");
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

seedProducts();
