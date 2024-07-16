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
        // Create a new user in the database
        const newUser = new users({
          firstName: req.session.userDetails.firstname,
          secondName: req.session.userDetails.secondname,
          email: req.session.userDetails.email,
          mobile: req.session.userDetails.mobile,
          password: req.session.userDetails.password,
          is_admin: 0
        });
  
        // Save the new user to the database
        await newUser.save();
  
      // Render the OTP verification page with the email
      res.render("verify-otp", { email });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Internal server error" });
    }
};

// Function to verify the entered OTP and create a new user
const verifyOTP = async (req, res) => {
    let email;
  
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
        return res.render("singinuser", {
          email: email,
          successMessage: "User created successfully",
        });
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


// Function to insert Google User
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.CLIENT_ID);

// Function to insert Google user
const insertGoogleUser = async (req, res) => {
  try {
    const token = req.body.token;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub, email, name} = payload;
    const [firstname, secondname] = name.split(' ');

    // Check if user already exists
    let user = await users.findOne({ email });
    if (!user) {
      // Create a new user in the database
      user = new users({
        firstName: firstname,
        secondName: secondname || '',
        email: email,
        mobile: '', 
        googleId: sub,
        is_admin: 0,
      });

      // Save the new user to the database
      await user.save();
    }

    // Set session user
    req.session.user = user;

    // Redirect to the user profile or dashboard
    res.redirect('/shop'); // Adjust the redirect URL as per your application
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Internal server error" });
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
      const products = await Product.find({});
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
      const categories = await Product.distinct("category");
  
      // Extract selected category from query parameters
      const selectedCategory = req.query.category;
  
      // Define query based on selected category
      const query = { isListed: true };
      if (selectedCategory && selectedCategory !== "all") {
        query.category = selectedCategory;
      }
  
      // Fetch products based on query and pagination
      const products = await Product.find(query)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
  
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
      const product = await Product.findById(productId);
  
      // Render the productDetails page with product details
      res.render("productDetails", { product });
    } catch (error) {
      console.log(error.message);
      res.status(500).send("Internal Server Error");
    }
};

const userProfile = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
    const user = await users.findById(loggedInUserId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Render the user profile page with user details and addresses
    res.render("userProfile", { user});
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// Export all the defined functions
module.exports = {
    userSignupLoad,
    insertUser,
    insertGoogleUser,
    userHome,
    verifyOTP,
    resendOTP,
    loadShop,
    loadProductDetails,
    getSignin,
    checkUserValid,
    logout,
    userProfile
  };