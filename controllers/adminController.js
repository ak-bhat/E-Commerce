const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Product = require("../models/productsModel");
const category = require("../models/categoryModel");
const path = require('path');
const fs = require('fs');




// CODES RELATED TO ADMIN LOGIN, LOGOUT AND REL ADMIN

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message);
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




// EXPORT

module.exports = {
  verifyLogin,
  logout,
  adminUsers,
  blockUser,
  loadLogin,
  securePassword,
  addProduct,
  // saveProduct,
  getProducts,
  loadCategory,
  addCategory,
  saveCategory,
  editCategory,
  updateCategory,
};
