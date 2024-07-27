const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Product = require("../models/productsModel");
const category = require("../models/categoryModel");
const { Order } = require("../models/ordersModel");
const express = require('express');
const app = express();


// CODES RELATED TO ADMIN LOGIN, LOGOUT AND REL ADMIN

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message); //err handle needed
  }
};

const verifyLogin = async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;
    const userData = await User.findOne({ email: email });

    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);

      if (passwordMatch) {
        if (userData.is_admin === 0) {
          res.render("login", {
            message: "Your email or password is incorrect.",
          });
        } else {
          req.session.admin_id = userData._id;
          res.redirect("/admin/users");
        }
      } else {
        res.render("login", {
          message: "Your email or password is incorrect.",
        });
      }
    } else {
      res.render("login", { message: "Your email or password is incorrect." });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/admin");
  } catch (error) {
    console.log(error.message);
  }
};

// USER MANAGEMENT

const adminUsers = async (req, res) => {
  try {
    const users = await User.find({ is_admin: 0 });
    res.render("users", { users: users });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

const blockUser = async (req, res) => {
    
  try {
    const userId = req.body.userId;
    const user = await User.findById(userId);

    if (user) {
      user.is_blocked = user.is_blocked === 0 ? 1 : 0;
      await user.save();
      
      if(user.is_blocked===1){
        const sessionID = user.session;
        req.sessionStore.destroy(sessionID, (err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
        });
      }
      res.redirect("/admin/users");
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// CATEGORY MANAGEMENT

const loadCategory = async (req, res) => {
  try {
  
    const categories = await category.find();
    let successMessage = null;

    if (req.query.success) {
      successMessage = "The category has been updated.";
    }

    res.render("category", { categories, successMessage });
  } catch (error) {
    res.render("error", { error });
  }
};

const toggleCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const categoryData = await category.findById(categoryId);

    if (!categoryData) {
      return res.status(404).send("Category not found");
    }

    categoryData.isListed = !categoryData.isListed;
    await categoryData.save();

    res.redirect("/admin/category");
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while toggling the category");
  }
};


const editCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const foundCategory = await category.findById(categoryId);
    res.render("editCategory", { category: foundCategory, errorMessage: null });
  } catch (error) {
    res.render("error", { error });
  }
};

const updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { categoryName, description } = req.body;

    const foundCategory = await category.findById(categoryId);

    if (foundCategory.categoryName !== categoryName) {
      const existingCategory = await category.findOne({
        categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        res.render("editCategory", {
          category: foundCategory,
          errorMessage: "The category already exists.",
        });
        return;
      }
    }

    await category.findByIdAndUpdate(categoryId, { categoryName, description });
    res.redirect("/admin/category?success=1");
  } catch (error) {
    res.render("error", { error });
  }
};

const addCategory = (req, res) => {
  res.render("addCategory");
};

const saveCategory = async (req, res) => {
  try {
    const { categoryName, description } = req.body;

    const existingCategory = await category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
    });

    if (existingCategory) {
      return res.status(200).json({ message: "The category already exists." });
    }

    const newCategory = new category({
      categoryName,
      description,
      isListed: true,
    });

    await newCategory.save();

    return res.status(200).json({ message: "Category added successfully." });
  } catch (error) {
    res.render("error", { error });
  }
};

// PRODUCTS MANAGEMENT

const getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    console.log(products)
    res.render("products", {
      Product: products,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching products");
  }
};

const addProduct = async (req, res) => {
  try {
    const categories = await category.find();
    res.render('addProduct', { categories });
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
};

const saveProduct = async (req, res) => {
  try {
    const {price, description, size, stock, } = req.body;
    const productImages = req.files.map(file => file.filename);
    
                    console.log('The images : ',productImages)
    
                    
                     const product = new Product({
                         name: req.body.name,
                         category: req.body.category,
                         description: req.body.description,
                         price: req.body.price,
                         quantity: req.body.quantity
                     });
                     if (req.files && req.files.length > 0) {
                      req.files.forEach((file) => {
                        product.productImage.push({
                          data: file.buffer,
                          contentType: 'image/png',
                        });
                      });
                    

                    product.save();
                     res.redirect('/admin/products?message=New product created&type=success')}
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding product to the database");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = await Product.findById(productId);
    if (!productData) {
      return res.status(404).send("Product not found");
    }
    productData.isListed = !productData.isListed;
    await productData.save();
    res.redirect("/admin/products");
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while deleting the product");
  }
};

const editProductPage = async (req, res) => {
  try {
    const productId = req.params.productId;

    const product = await Product.findById(productId);

    res.render("editProduct", { product });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching product data");
  }
};

const editProduct = async (req, res) => {
  try {
    const productId = req.params.productId;

    const { name, size, gender, category, quantity, description, price } =
      req.body;

    const product = await Product.findById(productId);

    product.name = name;
    product.size = [size];
    product.gender = gender;
    product.category = category;
    product.quantity = quantity;
    product.description = description;
    product.price = price;

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        product.image.push({ data: file.buffer, contentType: file.mimetype });
      });
    }

    await product.save();
    return res.redirect("/admin/products");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error editing product");
  }
};

const loadupdateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const products = await Product.findOne({ _id: id });
    res.render("updateProduct", {
      products,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const updateProduct = async (req, res) => {
  const { name, size, quantity, category, description, price } = req.body;
  const id = req.params.id;

  try {
    const existingImages =
      req.files && req.files["images"] ? req.files["images"] : [];
    const newImages =
      req.files && req.files["newImages"] ? req.files["newImages"] : [];

    const existingImageData = existingImages.map((image) => ({
      data: image.buffer,
      contentType: image.mimetype,
    }));

    const newImageData = newImages.map((image) => ({
      data: image.buffer,
      contentType: image.mimetype,
    }));

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const imagesToDelete = req.body.deletedImages
      ? JSON.parse(req.body.deletedImages)
      : [];
    if (imagesToDelete.length > 0) {
      imagesToDelete.forEach((index) => {
        if (product.productImage && product.productImage.length > index) {
          product.productImage.splice(index, 1);
        }
      });
    }

    const updatedData = {
      name,
      size,
      quantity,
      category,
      description,
      price,
      image: product.productImage.concat(newImageData),
    };

    product.set(updatedData);
    await product.save({ validateBeforeSave: false });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Error updating product");
  }
};


const deleteProductImage = async (req, res) => {
  const productId = req.params.id;
  const imageIndex = req.params.index;

  try {
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    if (product.productImage && product.productImage.length > imageIndex) {
      product.productImage.splice(imageIndex, 1);

      await product.save({ validateBeforeSave: false });

      res.status(200).send("Image deleted successfully");
    } else {
      res.status(404).send("Image not found");
    }
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).send("Internal Server Error");
  }
};


//CODES RELATED TO ORDERS


const loadOrder = async (req, res) => {
  try {
    const orders = await Order.find().populate("products.productId").lean();

    res.render("ordersPage", { orders });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Error fetching orders");
  }
};


const manageOrder = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("shippingAddress")
      .populate("products.productId");

    res.render("manageOrder", { order });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Error loading manageOrder");
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    // console.log(status)

    await Order.findByIdAndUpdate(orderId, { OrderStatus: status });

    res.json({ message: "Order status  successfully" });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Error updating order status");
  }
};


const updateProductOrderStatus = async (req, res) => {
  try {
    const { orderId, productIndex, status } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const productToUpdate = order.products[productIndex];

    if (!productToUpdate) {
      return res.status(404).send("Product not found");
    }

    productToUpdate.ProductOrderStatus = status;

    const allProducts = order.products;
    const anyPendingProduct = allProducts.some(
      (product) => product.ProductOrderStatus === "Pending"
    );

    order.paymentStatus = anyPendingProduct ? "Pending" : "Success";

    await order.save();

    res.send("Product Order Status updated successfully");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error updating Product Order Status");
  }
};




// EXPORT

module.exports = {
  verifyLogin,
  logout,
  adminUsers,
  blockUser,
  loadLogin,
  securePassword,

  loadCategory,
  addCategory,
  saveCategory,
  toggleCategory,
  editCategory,
  updateCategory,
 
  addProduct,
  saveProduct,
  getProducts,
  editProductPage,
  editProduct,
  loadupdateProduct,
  updateProduct,
  deleteProduct,
  deleteProductImage,
  
  loadOrder,
  manageOrder,
  updateOrderStatus,
  updateProductOrderStatus
};
