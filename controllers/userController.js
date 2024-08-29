const Product = require("../models/productsModel");
const Category = require("../models/categoryModel")
const users = require("../models/userModel");
const bcrypt = require("bcrypt");
const { sendMail, generateOTP } = require("../mail");
const Wishlist = require("../models/wishlist");
const Cart = require("../models/cartModel");
const address = require("../models/addressModel");



// Function to render the signup page
const userSignupLoad = async (req, res) => {
    try {
    // Extract referral code from query parameters
    let ref = req.query.ref;
    let user_id= req.query.userId;
    // Render the login page with referral code
    res.render("login", { ref,user_id });
    } catch (error) {
      console.log(error.message);
    }
  };


// Generate Referral Code
const generateReferral = async (req,res)=>{
  try {
    const loggedInUserId = req.session.user_id;
  const user = await users.findById(loggedInUserId);
  const referralCode = user.referralCode;
  const generatedReferralCode = referralCode || generateRandomReferralCode();
  if(!user.referralCode){
    user.referralCode = generatedReferralCode;
  }
  // console.log(user.id)
         // Fetch addresses associated with the user
  const addresses = await address.find({ userId: loggedInUserId });
  res.render('userProfile', {user,generatedReferralCode,addresses});
  } catch (error) {
    console.error(error);
  }

}

// Function to generate a random referral code
const generateRandomReferralCode = () => {
  return Math.random().toString(36).substring(2, 10);
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
      const ref = req.query.ref;
      const user_id= req.query.userId;

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
        res.render("verify-otp", { email,ref, user_id });
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

        // If user has a referral code, award bonus to referring and new user
        const ref = req.query.ref;
        const user_id = req.query.userId;
      if (ref) {
        const referringUser = await users.findOne({
          _id:user_id
        });

        if (referringUser) {
          referringUser.wallet.balance += 200;
          referringUser.wallet.history.push({
            type: "Credit",
            amount: 200,
            reason: "Referral bonus for new user registration",
          });
          await referringUser.save();

          newUser.wallet.balance += 100;
          newUser.wallet.history.push({
            type: "Credit",
            amount: 100,
            reason: "Referral bonus for using a referral link",
          });
          await newUser.save();
        }
      }
  
        // Clear user details from session
        req.session.userDetails = null;
  
        // Render the OTP verification page with success message
        return res.redirect(`/signin?ref=${ref}&user_id=${user_id}`);

      } else {
        // Render the OTP verification page with error message
        const ref = req.query.ref;
        const user_id = req.query.userId;
        return res.render("verify-otp", {
          email: email,
          errorMessage: "Incorrect OTP",
          ref,
          user_id
        });
      }
    } catch (error) {
      console.error(error.message);
      // Render the OTP verification page with error message
      const ref = req.query.ref;
      const user_id = req.query.userId;
      return res.render("verify-otp", {
        email: email,
        errorMessage: "An error occurred. Please try again.",
        ref,
        user_id
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
      const ref = req.query.ref;
      const user_id = req.query.userId;
      return res.render("verify-otp", {
        email,
        successMessage: "OTP has been resent successfully.",
        ref,
        user_id,
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
      
      const categories = await Category.find({ isListed: true });
      // console.log(categories)
   
      // const categories = filteredCategories.filter(category => category.category !== null);
      // console.log(categories)
      // const name =await Product.distinct('name');
      // const price = await Product.distinct('price');
  
      // Extract selected category and sort options from query parameters
      const selectedCategory = req.query.category;
      const sortOption = req.query.sort;


      // Define query based on selected category
      const query = { isListed: true };
      if (selectedCategory && selectedCategory !== "all") {
        query.category = selectedCategory;
      }
      
      // search queries
      const searchQuery = req.query.searchQuery || '';

      if (searchQuery) {
        query.name = { $regex: searchQuery, $options: 'i' }; // Case-insensitive search
    }
    // console.log(query)

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
        //  console.log("Hi"+products)
  
      // Count total products for pagination
      const totalProducts = await Product.countDocuments(query);
        // console.log(sortOption)
      // Render the shop page with products, pagination, and categories
      res.render("shop", {
        products,
        selectedCategory: selectedCategory,
        searchQuery,
        currentPage: page,
        totalPages: Math.ceil(totalProducts / pageSize),
        categories,
        sortOption
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


const loadWishlist = async (req, res) => {
  try {
    // Extract user id from session
    const userId = req.session.user_id;
    const perPage = 10; // Number of products per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Fetch user's wishlist and populate product details
    const wishlist = await Wishlist.findOne({ user: userId })
      .populate("products.product")
      .lean(); // Convert to plain JavaScript objects

    if (!wishlist) {
      // Handle case where wishlist is not found
      return res.render("wishlist", { userWishlist: null });
    }

    const totalProducts = wishlist.products.length; // Total number of products in the wishlist
    const totalPages = Math.ceil(totalProducts / perPage); // Calculate total pages

    // Slice the products array to get only the products for the current page
    const paginatedProducts = wishlist.products.slice((page - 1) * perPage, page * perPage);

    // Render the wishlist page with paginated products
    res.render("wishlist", {
      userWishlist: {
        ...wishlist,
        products: paginatedProducts
      },
      currentPage: page, // Pass the current page to the view
      totalPages // Pass total pages to the view
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};


const addToWishlist = async (req, res) => {
  try {
    // Extract product id from request body
    const { productId } = req.body;
    // console.log(productId)
    // Extract user id from session
    const userId = req.session.user_id;
    const wishlist = await Wishlist.findOne({ user: userId });
    // Update or create user's wishlist and add product to it
    // const wishlist = await Wishlist.findOneAndUpdate(
    //   { user: userId },
    //   { $addToSet: { products: { product: productId } } },
    //   { upsert: true, new: true }
    // );
    // Check if the product is already in the wishlist
    const productExists = wishlist.products.some((item) => item.product.toString() === productId);
    if (productExists) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

     // Add the product to the wishlist if not already present
     wishlist.products.push({ product: productId });
     await wishlist.save();

    // Respond with success message and updated wishlist
    res.json({ message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const wishListToCart = async (req, res) => {
  try {
    // Extract product id from request body
    const { productId } = req.body;
    // Extract user id from session
    const userId = req.session.user_id;

    // Fetch product details
    const product = await Product.findById(productId);
    // Check if product is out of stock
    if (!product || product.quantity <= 0) {
      return res
        .status(400)
        .json({
          error:
            "This product is out of stock and cannot be added to the cart.",
        });
    }

    // Update or create user's cart and add product to it
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $addToSet: { products: { product: productId } } },
      { upsert: true, new: true }
    );

    // Respond with success message and updated cart
    res.json({ message: "Product added to cart", cart });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const removeFromWishList = async (req, res) => {
  try {
    const user_id = req.session.user_id;
    const { productId } = req.params;
    // console.log(productId)

    const wishList = await Wishlist.findOne({ user: user_id });

    if (!wishList) {
      return res.status(404).json({ message: "wishList not found" });
    }

    wishList.products = wishList.products.filter(
      (prod) => prod.product.toString() !== productId
    );
    await wishList.save();

    return res.json({ message: "Product successfully removed from Wish List" });
  } catch (error) {
    console.error("Failed to remove product from Wish List:", error);
    return res
      .status(500)
      .json({ message: "Failed to remove product from cart" });
  }
};


// Export all the defined functions
module.exports = {
    userSignupLoad,
    generateReferral,
    insertUser,
    userHome,
    verifyOTP,
    resendOTP,
    loadShop,
    loadProductDetails,
    getSignin,
    checkUserValid,
    logout,
    loadWishlist,
    wishListToCart,
    addToWishlist,
    removeFromWishList,
    

};