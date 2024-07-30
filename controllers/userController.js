const Product = require("../models/productsModel");
const users = require("../models/userModel");
const bcrypt = require("bcrypt");
const { sendMail, generateOTP } = require("../mail");


// Function to render the signup page
const userSignupLoad = async (req, res) => {
    try {
      // Render the login page 
      
      res.render("login");
    } catch (error) {
      console.log(error.message);
    }
  };


// Function to securely hash a password using bcrypt
const securePassword = async (password) => {
    try {
      // Hash the password with a salt factor of 10
      const passwordHash = await bcrypt.hash(password, 10);
      return passwordHash;
    } catch (error) {
      console.log(error.message);
    }
};


// Function to handle user signup and send OTP for verification
const insertUser = async (req, res) => {
    try {
      
         // Extract user details from request body
      const { firstname, secondname, email, mobile, password } =
      req.body;

      const customer = await users.findOne({ email: email });

      if(customer){
        res.send('User already exists')
      }else{
            // Generate a random OTP and send it via email
        const otp = generateOTP();
        sendMail(email, "OTP Verification", `Your OTP is: ${otp}`);

        // Store user details in session for verification
        req.session.userDetails = {
          firstname,
          secondname,
          email,
          mobile,
          password: await securePassword(password),
          otp
        };

        // Render the OTP verification page with the email
        res.render("verify-otp", { email });
      }

    
      
     
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Internal server error" });
    }
};


// Function to verify the entered OTP and create a new user
const verifyOTP = async (req, res) => {
    var email;
  
    try {
      // Extract OTP from request body
      const otp = Object.values(req.body).join("");
      const { userDetails } = req.session;
  
      // Get email from session
      email = userDetails.email;
  
      // Check if the entered OTP matches the generated OTP
      if (otp === userDetails.otp) {
        // Create a new user in the database
        const newUser = new users({
          firstName: userDetails.firstname,
          secondName: userDetails.secondname,
          email: userDetails.email,
          mobile: userDetails.mobile,
          password: userDetails.password,
          is_admin: 0
        });
  
        // Save the new user to the database
        await newUser.save();
  
        // Clear user details from session
        req.session.userDetails = null;
  
        // Render the OTP verification page with success message
        return res.redirect("/signin");

      } else {
        // Render the OTP verification page with error message
        return res.render("verify-otp", {
          email: email,
          errorMessage: "Incorrect OTP",
        });
      }
    } catch (error) {
      console.error(error.message);
      // Render the OTP verification page with error message
      return res.render("verify-otp", {
        email: email,
        errorMessage: "An error occurred. Please try again.",
      });
    }
};



// Function to resend OTP for email verification
const resendOTP = async (req, res) => {
    try {
      const { email } = req.body;
  
      // Check if email is provided
      if (!email) {
        return res
          .status(400)
          .json({ message: "Email is required for OTP resend." });
      }
  
      // Generate a new OTP and send it via email
      const newOTP = generateOTP();
      await sendMail(email, "Your Subject", `Your new OTP is: ${newOTP}`);
  
      // Update session with the new OTP
      req.session.userDetails = {
        ...req.session.userDetails,
        otp: newOTP,
      };
  
      // Render the OTP verification page with success message
      return res.render("verify-otp", {
        email,
        successMessage: "OTP has been resent successfully.",
      });
    } catch (error) {
      console.error(error.message);
      // Return internal server error if any issue occurs
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
};

// Function to render the home page with products
const userHome = async (req, res) => {
    try {
      // Fetch all products from the database and render the home page
      const filteredProducts = await Product.find({isListed:true})
      .populate({
        path: 'category',
        match: { isListed: true }})
        .exec();

        const products = filteredProducts.filter(product => product.category !== null);
      res.render("home", { products });
    } catch (error) {
      console.log(error.message);
    }
};


// Function to render the signin page
const getSignin = async (req, res) => {
    try {
      
      res.render("signinuser");
    } catch (error) {
      console.log(error.message);
    }
};

// Function to check User is valid or not
const checkUserValid = async (req, res) => {
    try {
      // Extract email and password from the request body
      const email = req.body.email;
      const password = req.body.password;
      // Find the customer with the provided email
      const customer = await users.findOne({ email: email });
  
      // Check if the customer exists
      if (!customer) {
        return res.render("signinuser", { message: "Invalid email" });
      } else if (customer.is_blocked === 1) {
        // Check if the customer is blocked
        res.render("signinuser", { message: "You are blocked" });
      } else if (password) {
        // Check if the password is provided
        const passwordMatch = await bcrypt.compare(password, customer.password);
        if (!passwordMatch) {
          res.render("signinuser", { message: "Invalid password" });
        } else {
          // Set user_id in session and redirect to home page
          req.session.user_id = customer._id;
          res.redirect("/shop");
        }
      } else {
        res.render("signinuser", { message: "You are not verified" });
      }
    } catch (error) {
      console.log(error.message);
    }
};

// Function to log out the user by destroying the session
const logout = async (req, res) => {
  try {
    // Destroy the session and redirect to the home page
    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    console.log(error.message);
    res.redirect("/");
  }
};

const loadShop = async (req, res) => {
    try {
      // Extract page and category from query parameters
      const page = parseInt(req.query.page) || 1;
      const pageSize = 6;
  
      // Fetch distinct categories from the Product model
      // const categories = await Product.distinct('category')
      
      const filteredCategories = await Product.find()
      .populate({
        path: 'category',
        match: { isListed: true }})
      .exec();
      const categories = filteredCategories.filter(category => category.category !== null);
      console.log(categories)
      const name =await Product.distinct('name');
      const price = await Product.distinct('price');
  
      // Extract selected category and sort options from query parameters
      const selectedCategory = req.query.category;
      const sortOption = req.query.sort;

      // Define query based on selected category
      const query = { isListed: true };
      if (selectedCategory && selectedCategory !== "all") {
        query.category = selectedCategory;
      }
      

      // Define sort criteria based on sort option
    let sortCriteria = {};
    switch (sortOption) {
      case 'price-low-high':
        sortCriteria = { price: 1 };
        break;
      case 'price-high-low':
        sortCriteria = { price: -1 };
        break;
      case 'new-arrivals':
        sortCriteria = { createdAt: -1 };
        break;
      case 'az':
        sortCriteria = { name: 1 };
        break;
      case 'za':
        sortCriteria = { name: -1 };
        break;
      default:
        sortCriteria = {};
    }


      // Fetch products based on query and pagination
      const filteredProducts = await Product.find(query)
      .populate({
        path: 'category',
        match: { isListed: true }})
        .sort(sortCriteria)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec();

        const products = filteredProducts.filter(product => product.category !== null);
         console.log("Hi"+products)
  
      // Count total products for pagination
      const totalProducts = await Product.countDocuments(query);
  
      // Render the shop page with products, pagination, and categories
      res.render("shop", {
        products,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / pageSize),
        categories,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  };

const loadProductDetails = async (req, res) => {
    try {
      // Check if user is logged in, otherwise redirect to home
      if (!req.session || !req.session.user_id) {
        return res.redirect("/");
      }
      // Extract product id from route parameters
      const productId = req.params.productId;
      // Fetch product details from Product model
      // const product = await Product.findById(productId);
      const product = await Product.findById(productId)
      .populate({
        path: 'category',
        match: { isListed: true }})
        .exec();

        
  
      // Render the productDetails page with product details
      res.render("productDetails", { product});
    } catch (error) {
      console.log(error.message);
      res.status(500).send("Internal Server Error");
    }
};


// Export all the defined functions
module.exports = {
    userSignupLoad,
    insertUser,
    userHome,
    verifyOTP,
    resendOTP,
    loadShop,
    loadProductDetails,
    getSignin,
    checkUserValid,
    logout,
    
  };