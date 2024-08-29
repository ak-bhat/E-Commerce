const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Product = require("../models/productsModel");
const category = require("../models/categoryModel");
const Category = require("../models/categoryModel");
const { Order } = require("../models/ordersModel");
const express = require('express');
const app = express();
const PDFDocument = require("pdfkit");
const XLSX = require('xlsx');
const Coupon = require("../models/couponModel");
const Offer = require("../models/offerModel");
// const { default: orders } = require("razorpay/dist/types/orders");


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


// DASHBOARD OF ADMIN


const loadHome = async (req, res) => {
  try {
    const userCount = await User.countDocuments({ is_admin: 0 });
    const averageUsers = userCount / 8;

    let iconClass = "mdi mdi-arrow-bottom-left";
    if (averageUsers >= 1) {
      iconClass = "mdi mdi-arrow-top-right";
    }

    const userData = await User.findById(req.session.admin_id);

    const revenueResult = await Order.aggregate([
      { $match: { OrderStatus: "Delivered" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue =
      revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayShippedOrders = await Order.find({
      updatedAt: { $gte: today },
      OrderStatus: "Delivered",
    }).populate("products.productId");

    let dailyIncome = 0;
    todayShippedOrders.forEach((order) => {
      if (order.updatedAt.getDate() === today.getDate()) {
        dailyIncome += order.totalAmount;
      }
    });

    const pendingOrdersCount = await Order.countDocuments({
      OrderStatus: "Pending",
    });

    const paymentMethodCounts = await Order.aggregate([
      { $match: { OrderStatus: "Delivered" } },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
        },
      },
    ]);

    const paymentMethods = {};
    paymentMethodCounts.forEach((method) => {
      if (method._id === "Online Payment") {
        paymentMethods.OnlinePayment = method.count;
      } else if (method._id === "Cash on Delivery") {
        paymentMethods.CashOnDelivery = method.count;
      }
    });

    let orders = [];
    if (req.query.startDate && req.query.endDate) {
      orders = await Order.find({
        orderDate: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate),
        },
      })
        .populate("userId", "firstName lastName")
        .populate("products.productId", "name  quantity");
    }

    let startDate = req.query.startDate || "";
    let endDate = req.query.endDate || "";

    const shippedOrdersToday = await Order.find({
      updatedAt: { $gte: today },
      OrderStatus: "Delivered",
    });

    const amountsCollectedToday = [];
    let runningTotal = 0;
    shippedOrdersToday.forEach((order) => {
      if (order.updatedAt.getDate() === today.getDate()) {
        runningTotal += order.totalAmount;
        amountsCollectedToday.push(runningTotal);
      }
    });

    const ordersGroupedByDay = shippedOrdersToday.reduce((acc, order) => {
      const orderDate = order.updatedAt.toISOString().split("T")[0];
      if (!acc[orderDate]) {
        acc[orderDate] = {
          totalAmount: 0,
          orderCount: 0,
        };
      }
      acc[orderDate].totalAmount += order.totalAmount;
      acc[orderDate].orderCount++;
      return acc;
    }, {});

    const labels = Object.keys(ordersGroupedByDay);
    const amounts = labels.map((date) => ordersGroupedByDay[date].totalAmount);
    const orderCounts = labels.map(
      (date) => ordersGroupedByDay[date].orderCount
    );

    const topSoldProducts = await Order.aggregate([
      { $match: { OrderStatus: "Delivered" } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalSold: { $sum: "$products.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
    ]);

    const productIds = topSoldProducts.map((product) => product._id);
    const soldQuantities = topSoldProducts.map((product) => product.totalSold);

    const topProductNames = await Product.find(
      { _id: { $in: productIds } },
      "name"
    );

    // Top Category
    const topSoldCategories = await Order.aggregate([
      { $match: { OrderStatus: "Delivered" } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          totalSold: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 6 }
    ]);
    
    const categoryIds = topSoldCategories.map(category => category._id);
    const soldCatQuantities = topSoldCategories.map(category => category.totalSold);
    // console.log(topSoldCategories)
    
    const topCategoryNames = await Category.find(
      { _id: { $in: categoryIds } },
      "categoryName"
    );
    // console.log(topCategoryNames)


    // Monthly Sales


    const currentYear = new Date().getFullYear();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthlySales = [];

    for (let i = 0; i < 12; i++) {
      const startDate = new Date(currentYear, i, 1);
      const endDate = new Date(currentYear, i + 1, 0);

      const result = await Order.aggregate([
        {
          $match: {
            orderDate: { $gte: startDate, $lte: endDate },
            OrderStatus: "Delivered",
          },
        },
        {
          $group: {
            _id: null,
            productsSold: { $sum: { $size: "$products" } },
          },
        },
      ]);

      const productsSold = result.length > 0 ? result[0].productsSold : 0;
      monthlySales.push({ month: monthNames[i], productsSold });
    }

    res.render("home", {
      admin: userData,
      userCount,
      averageUsers,
      totalRevenue,
      iconClass,
      pendingOrdersCount,
      dailyIncome,
      paymentMethods,
      orders,
      startDate,
      endDate,
      amountsCollectedToday: JSON.stringify(amountsCollectedToday),
      labels: JSON.stringify(labels),
      amounts: JSON.stringify(amounts),
      orderCounts: JSON.stringify(orderCounts),
      topProductNames: JSON.stringify(topProductNames),
      soldQuantities: JSON.stringify(soldQuantities),
      monthlySales: JSON.stringify(monthlySales),
      topCategoryNames: JSON.stringify(topCategoryNames),
      soldCatQuantities:JSON.stringify(soldCatQuantities)
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};


const salesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const orders = await Order.find({
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate("userId", "firstName secondName")
      .populate("products.productId", "name quantity category");

    const doc = new PDFDocument();
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Sales Report.pdf"'
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Add the report title
    doc.fontSize(18).text("Sales Report", { align: "center", underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).text(`Gravity Team`, { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(10).text(
      `Report covering the period from ${new Date(startDate).toDateString()} to ${new Date(endDate).toDateString()}.`,
      { align: "center" }
    );
    doc.moveDown(2);

    // Add summary
    doc.fontSize(12).text(`Total Orders: ${orders.length}`);
    const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
    doc.text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`);
    doc.moveDown(2);

    // Define table headers with specific column widths
    const addTableHeaders = () => {
      const startY = doc.y;
      doc.fontSize(12)
        .text("No", 50, startY, { width: 50, align: "left" })
        .text("Order ID", 100, startY, { width: 120, align: "left" })
        .text("User", 220, startY, { width: 100, align: "left" })
        .text("Order Date", 290, startY, { width: 100, align: "left" })
        .text("Total Amount", 400, startY, { width: 100, align: "right" });

      doc.moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke(); // Draw a line under headers
      doc.moveDown(2);
    };

    const drawRowLines = (yPosition) => {
      const verticalLineAdjustment = -25; // Move vertical lines slightly to the left
      const lineHeight = 100; // Increase the height of the vertical lines
    
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke(); // Horizontal line
    
      // Adjusted vertical lines with increased height
      doc.moveTo(100 + verticalLineAdjustment, yPosition - lineHeight).lineTo(100 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "No"
      doc.moveTo(220 + -20, yPosition - lineHeight).lineTo(220 + -20, yPosition).stroke(); // Vertical line after "Order ID"
      doc.moveTo(290 + verticalLineAdjustment, yPosition - lineHeight).lineTo(290 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "User"
      doc.moveTo(400 + verticalLineAdjustment, yPosition - lineHeight).lineTo(400 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "Order Date"
    };
    

    addTableHeaders();

    const maxY = 750; // The y position where you want to start a new page

    orders.forEach((order, index) => {
      const userFullName = `${order.userId.firstName} ${order.userId.secondName}`;
      const orderDate = `${order.orderDate.toDateString()} ${order.orderDate.toLocaleTimeString()}`;

      const orderHeightEstimate = 20 + order.products.length * 15 + 10; // Estimate the height needed for the order and its products

      // Check if adding this order will exceed the page limit
      if (doc.y + orderHeightEstimate > maxY) {
        doc.addPage(); // Add a new page
        addTableHeaders(); // Re-add the headers on the new page
      }

      // Add the order details
      const currentY = doc.y;
      doc.fontSize(10)
        .text(`${index + 1}`, 50, currentY, { width: 50, align: "left" })
        .text(`${order._id}`, 100, currentY, { width: 100, align: "left" })
        .text(`${userFullName}`, 220, currentY, { width: 100, align: "left" })
        .text(orderDate, 290, currentY, { width: 100, align: "left" })
        .text(`₹${order.totalAmount.toFixed(2)}`, 380, currentY, { width: 100, align: "right" });

      doc.moveDown();

      drawRowLines(doc.y + 22); // Draw horizontal line after each row and vertical lines between columns

      order.products.forEach((product) => {
        // Check if the product list will exceed the page limit
        if (doc.y + 15 > maxY) {
          doc.addPage(); // Add a new page
          addTableHeaders(); // Re-add the headers on the new page
          doc.moveDown(); // Adjust the positioning
        }

        // Add the product details
        doc.fontSize(10).text(`- ${product.productId.name} (${product.quantity} units)`, {
          indent: 20,
          align: "left",
        });

        doc.moveDown();
      });

      doc.moveDown(1.5); // Add space after each order
    });

    doc.end();
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};


const salesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Fetch orders within the specified date range
    const orders = await Order.find({
      orderDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    })
      .populate('userId', 'firstName secondName')
      .populate('products.productId', 'name quantity category');

    // Prepare data for the Excel sheet
    const data = [];

    // Add headers to the first row of data
    data.push(['No', 'Order ID', 'User', 'Order Date', 'Total Amount', 'Products','Order Status']);

    orders.forEach((order, index) => {
      const userFullName = `${order.userId.firstName} ${order.userId.secondName}`;
      const orderDate = `${order.orderDate.toDateString()} ${order.orderDate.toLocaleTimeString()}`;
      const products = order.products.map(
        (product) => `${product.productId.name} (${product.quantity} units)`
      ).join(', ');
      const orderStatus = `${order.OrderStatus}`

      // Add each order's data as a new row
      data.push([
        index + 1,
        order._id.toString(),
        userFullName,
        orderDate,
        `₹${order.totalAmount.toFixed(2)}`,
        products,
        orderStatus
      ]);
    });

    // Create a new workbook and add the data to a sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename="Sales Report.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Write the Excel file to the response
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    res.send(excelBuffer);

  } catch (error) {
    console.error(error.message);
    res.status(500).send('Internal Server Error');
  }
};



// USER MANAGEMENT

const adminUsers = async (req, res) => {
  try {
    // Get page and limit from query parameters, with defaults
    const page = parseInt(req.query.page) || 1; // Current page, default to 1
    const limit = parseInt(req.query.limit) || 10; // Items per page, default to 10

    // Calculate the total number of non-admin users
    const totalUsers = await User.countDocuments({ is_admin: 0 });

    // Calculate the number of pages
    const totalPages = Math.ceil(totalUsers / limit);

    // Calculate the number of users to skip based on the current page
    const skip = (page - 1) * limit;

    // Fetch the users for the current page
    const users = await User.find({ is_admin: 0 })
      .skip(skip)
      .limit(limit);
    // const users = await User.find({ is_admin: 0 });
    res.render("users", { 
      users: users,
      currentPage: page,
      totalPages: totalPages,
     });
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
      
      
      if(user.is_blocked===1){
        const sessionID = user.session;
        req.sessionStore.destroy(sessionID, (err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
        });
      }
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
    const perPage = 10; // Number of categories per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Get the total count of categories for pagination
    const totalCategories = await category.countDocuments();

    // Fetch categories with pagination
    const categories = await category.find()
      .skip((perPage * page) - perPage) // Skip the previous pages of categories
      .limit(perPage); // Limit the number of categories per page

    // Fetch offers and categories with offers as before
    const offers = await Offer.find({ isListed: true });
    const categoriesWithOffers = await category.find({ offer: { $ne: null } });

    let successMessage = null;
    if (req.query.success) {
      successMessage = "The category has been updated.";
    }

    res.render("category", {
      categories,
      successMessage,
      offers,
      currentPage: page, // Pass the current page to the view
      totalPages: Math.ceil(totalCategories / perPage) // Calculate total pages
    });
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
    const perPage = 10; // Number of products per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Get the total count of products for pagination
    const totalProducts = await Product.countDocuments();

    // Fetch products with pagination
    const products = await Product.find()
      .populate('category', 'categoryName')
      .skip((perPage * page) - perPage) // Skip the previous pages of products
      .limit(perPage); // Limit the number of products per page

    // Fetch offers as before
    const offers = await Offer.find({ isListed: true });

    res.render("products", {
      Product: products,
      offers: offers,
      currentPage: page, // Pass the current page to the view
      totalPages: Math.ceil(totalProducts / perPage) // Calculate total pages
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching products");
  }
};


const applyOffer = async (req, res) => {
  const { productId } = req.params;
  const { offerId } = req.body;

  try {
    const product = await Product.findById(productId);
    const selectedOffer = await Offer.findById(offerId);

    if (product && selectedOffer) {
      const discountedPrice =
        product.price - Math.round(product.price * (selectedOffer.offerDiscount / 100));

      product.offer = selectedOffer._id;
      product.offerPrice = discountedPrice;
      await product.save();

      res.status(200).send("Offer applied successfully");
    } else {
      res.status(404).send("Product or offer not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error applying offer");
  }
};


const removeProductOffer = async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findById(productId);

    if (product && product.offer) {
      product.offer = null;
      product.offerPrice = null;
      await product.save();

      res.status(200).send("Offer removed successfully");
    } else {
      res.status(404).send("Product or offer not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error removing offer");
  }
};

const applyCategoryOffer = async (req, res) => {
  try {
    
    const { category, offerDiscount } = req.body;
    console.log(offerDiscount)
    const categoryNew = await Category.find({_id:category})
    const products = await Product.find({ category });
    console.log(categoryNew[0])

    // console.log(products)
    for (const product of products) {
      if (!product.offer) {
        product.catOfferPrice =
          product.price - Math.round(product.price * (offerDiscount / 100));

        const offer = await Offer.findOne({ offerDiscount });
        if (offer) {
          product.offer = offer._id;
        }

        await product.save();
      }
    }

    const offer = await Offer.findOne({ offerDiscount });
    console.log(offer)
    if (offer) {
      categoryNew[0].offer = offer._id;
      categoryNew[0].offerDiscount = offerDiscount;
    }
    await categoryNew[0].save()
    

    res
      .status(200)
      .send("Category offer applied successfully to eligible products.");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error applying category offer");
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    const products = await Product.find({category:categoryId});
    // console.log(products)

    for (const product of products) {

      product.catOfferPrice = null;
      product.offer = null;
      await product.save();
    }

    const productsWithSameCategory = await Product.find({
      category: products.category,
    });

    for (const otherProduct of productsWithSameCategory) {
      if (otherProduct._id.toString() !== productId) {
        otherProduct.catOfferPrice = null;
        otherProduct.offer = null;
        await otherProduct.save();
      }
    }
    const category = await Category.find({_id:categoryId});
    // console.log("1st"+category);
    if(category){
      category[0].offer=null;
      category[0].offerDiscount=null;
    }
    await category[0].save();
    // console.log(category);

    res
      .status(200)
      .send(
        "Category offer removed successfully from all products with the same category."
      );
  } catch (error) {
    console.error(error);
    res.status(500).send("Error removing category offer");
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
    
                    // console.log('The images : ',productImages)
    
                    const categoryBody = req.body.category;
                    const categoryName = await category.find({ categoryName: categoryBody});
                    // console.log(categoryName)
                    // console.log(categoryName[0]._id)
                     const product = new Product({
                         name: req.body.name,
                         category: categoryName[0]._id,
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

    const { name, category, quantity, description, price } =
      req.body;

    const product = await Product.findById(productId);

    product.name = name;
    product.quantity = quantity;
    product.category = category;
    product.description = description;
    product.price = price;

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        product.productImage.push({ data: file.buffer, contentType: file.mimetype });
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
    const products = await Product.findOne({ _id: id }).populate('category', 'categoryName');
    // console.log(products.category.categoryName)
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
  console.log(category)

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
      productImage: product.productImage.concat(newImageData),
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
      // console.log(product.productImage)
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
    const perPage = 10; // Number of orders per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Get the total count of orders for pagination
    const totalOrders = await Order.countDocuments();

    // Fetch orders with pagination, populate related products, and sort them
    const orders = await Order.find()
      .populate("products.productId")
      .lean()
      .sort({ _id: -1 }) // Sort orders by ID in descending order
      .skip((perPage * page) - perPage) // Skip the previous pages of orders
      .limit(perPage); // Limit the number of orders per page

    res.render("ordersPage", {
      orders,
      currentPage: page, // Pass the current page to the view
      totalPages: Math.ceil(totalOrders / perPage), // Calculate total pages
    });
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
    const { orderId, status, productId } = req.body;
    if(status=="Pending"){
      // await Order.findByIdAndUpdate(orderId, { OrderStatus: status, paymentStatus:"Pending" });

      const order = await Order.findById(orderId);
      order.OrderStatus=status;
      order.paymentStatus="Pending"
      // console.log(order)

      const productIndex = order.products.findIndex(
        (item) => item.productId.toString() === productId
      );
    // console.log(productIndex)
    const productInOrder = order.products[productIndex];
    const product = await Product.findById(productInOrder.productId);
   

    const updatedQuantity = product.quantity - productInOrder.quantity;
    await Product.findByIdAndUpdate(product._id, { quantity: updatedQuantity });

    order.products[productIndex].ProductOrderStatus = "Pending";
    await order.save();

    }else{
      await Order.findByIdAndUpdate(orderId, { OrderStatus: status });
    }
    res.status(200).json({ message: "Order status  successfully" });
    // res.render('/adminOrders',{message: "Order status  successfully" );
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
    console.log("Hi")
    const allProducts = order.products;
    const anyPendingProduct = allProducts.some(
      (product) => product.ProductOrderStatus === "Pending"
    );

    // if (status==='Cancelled') {
      
    // }

    order.paymentStatus = anyPendingProduct ? "Pending" : "Success";

    await order.save();

    res.send("Product Order Status updated successfully");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error updating Product Order Status");
  }
};



//CODE RELATED TO COUPON


const loadAddCoupon = async (req, res) => {
  try {
    res.render("addCoupon");
  } catch (error) {
    console.log(error.message);
  }
};


const addCoupon = async (req, res) => {
  try {
    const {
      couponCode,
      couponName,
      discountAmountDropdown,
      customDiscountAmount,
      validFrom,
      validTo,
      minimumSpend,
    } = req.body;

    const selectedDiscountAmount = customDiscountAmount
      ? parseInt(customDiscountAmount)
      : parseInt(discountAmountDropdown);

    const existingCoupon = await Coupon.findOne({ code: couponCode });

    if (existingCoupon) {
      const errorMessage =
        "Coupon code already exists. Please generate a new one.";
      return res.redirect(
        "/admin/addCoupon?error=" + encodeURIComponent(errorMessage)
      );
    }

    const newCoupon = new Coupon({
      code: couponCode,
      couponName,
      discountAmount: selectedDiscountAmount,
      validFrom,
      validTo,
      minimumSpend,
    });

    await newCoupon.save();

    const successMessage = "Coupon added successfully";
    res.redirect(
      "/admin/addCoupon?success=" + encodeURIComponent(successMessage)
    );
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const loadCoupon = async (req, res) => {
  try {
    const perPage = 10; // Number of coupons per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Get the total count of coupons for pagination
    const totalCoupons = await Coupon.countDocuments();

    // Fetch coupons with pagination
    const coupons = await Coupon.find()
      .skip((perPage * page) - perPage) // Skip the previous pages of coupons
      .limit(perPage); // Limit the number of coupons per page

    // Determine if each coupon is still valid
    const currentDate = new Date();
    coupons.forEach((coupon) => {
      coupon.isValid = currentDate <= coupon.validTo;
    });

    const successMessage = req.query.success;
    const errorMessage = req.query.error;

    res.render("coupon", {
      coupons,
      currentPage: page, // Pass the current page to the view
      totalPages: Math.ceil(totalCoupons / perPage), // Calculate total pages
      successMessage,
      errorMessage,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};



const editCoupon = async (req, res) => {
  try {
    const {
      couponId,
      couponName,
      discountAmount,
      validFrom,
      validTo,
      minimumSpend,
    } = req.body;

    // Validate and update the coupon in the database
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        couponName,
        discountAmount,
        validFrom,
        validTo,
        minimumSpend,
      },
      { new: true } // Return the updated document
    );

    res.redirect("/coupon?success=Coupon updated successfully");
  } catch (error) {
    console.error(error);
    res.redirect("/coupon?error=Failed to update coupon");
  }
};


const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;

    if (!couponId) {
      return res.status(400).send("Invalid coupon ID");
    }

    const deletedCoupon = await Coupon.findById(couponId);
    console.log(deletedCoupon)
    if (!deletedCoupon) {
      return res.status(404).send("Coupon not found");
    }
    deletedCoupon.isListed = !deletedCoupon.isListed;
    await deletedCoupon.save()
    res.redirect(
      "/admin/coupon?success=" +
      encodeURIComponent("Coupon deleted successfully")
    );
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};


//CODES RELATED TO OFFERS


const loadOffers = async (req, res) => {
  try {
    const perPage = 10; // Number of offers per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Get the total count of offers for pagination
    const totalOffers = await Offer.countDocuments();

    // Fetch offers with pagination
    const offers = await Offer.find()
      .skip((perPage * page) - perPage) // Skip the previous pages of offers
      .limit(perPage); // Limit the number of offers per page

    res.render("offers", {
      offers,
      currentPage: page, // Pass the current page to the view
      totalPages: Math.ceil(totalOffers / perPage) // Calculate total pages
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Error fetching offers");
  }
};



const addOffer = async (req, res) => {
  try {
    const { offerName, offerDiscount, expiryDate } = req.body;

    if (!offerName || !offerDiscount || !expiryDate) {
      return res.status(400).send("Please provide all required fields.");
    }

    const newOffer = new Offer({
      offerName,
      offerDiscount,
      expiryDate,
    });

    await newOffer.save();

    res.redirect("/admin/offers");
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const editOffer = async (req,res) => {
  try {
    const { offerId, offerName, offerDiscount, expiryDate } = req.body;

    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
    {
      offerName,
      offerDiscount,
      expiryDate, 
    },{
      new:true //Return updated offer
    })
    res.redirect("/offers?success=Coupon updated successfully");
  } catch (error) {
    console.error(error);
    res.redirect("Failed to update offer");
  }
}


const removeOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    // console.log(offerId)
  

    const existingOffer = await Offer.findById(offerId);
    // console.log(existingOffer)
    if (!existingOffer) {
      return res.status(404).send("Offer not found.");
    }
    existingOffer.isListed = !existingOffer.isListed;

    await existingOffer.save();

    await Product.updateMany(
      { offer: offerId },
      { $unset: { offer: "", offerPrice: "", catOfferPrice:""} }
    );
    await category.updateMany(
      { offer:offerId },
      { $unset: { offer: "", offerDiscount: ""} }
    )
    res.redirect("/admin/offers");
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};




// EXPORT

module.exports = {
  verifyLogin,
  logout,
  loadHome,
  salesReport,
  salesReportExcel,

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
  updateProductOrderStatus,

  loadAddCoupon,
  loadCoupon,
  addCoupon,
  deleteCoupon,

  loadOffers,
  addOffer,
  editOffer,
  removeOffer,
  applyOffer,
  removeProductOffer,

  applyCategoryOffer,
  removeCategoryOffer,

  editCoupon,

};
