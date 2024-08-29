const address = require("../models/addressModel");
const Product = require("../models/productsModel");
require("dotenv").config();
const { Order } = require("../models/ordersModel");
const Offer = require("../models/offerModel")
const users = require("../models/userModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const PDFDocument = require('pdfkit')
const fs = require('fs');

var instance = new Razorpay({
  key_id: process.env.RAZORPAY_ID,
  key_secret: process.env.RAZORPAY_SECRET,
});


const createOrder = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
    const appliedCoupon = req.body.couponCode;
    const user = await users.findById(loggedInUserId);
    const cart = await Cart.findOne({ user: loggedInUserId }).populate(
      "products.product"
    );

    if (cart) {
      const cartItems = cart.products;

      let totalAmount = 0;

      for (const cartItem of cartItems) {
        const product = await Product.findById(cartItem.product._id);
        const quantityInCart = cartItem.count;

        if (product.quantity < quantityInCart) {
          res
            .status(400)
            .send("Insufficient quantity for one or more products");
          return;
        }

        // const priceToUse = cartItem.product.price;
        const priceToUse =
          cartItem.product.catOfferPrice !== null
            ? cartItem.product.catOfferPrice
            : cartItem.product.offerPrice !== null
            ? cartItem.product.offerPrice
            : cartItem.product.price;

        totalAmount += quantityInCart * priceToUse;

        
      }

      if (appliedCoupon) {
        const coupon = await Coupon.findOne({ code: appliedCoupon });
        
        if (coupon) {
          totalAmount -= coupon.discountAmount;
        
        }else{
          return res.status(400).json({coupon:"Unfortunately, the coupon is not valid at the moment."})
        }
      }
    
      const options = {
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: "order1",
      };


      instance.orders.create(options, function (err, order) {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "Failed to create order" });
        } else {
          res.json({ orderId: order.id, totalAmount });
        }
      });
    } else {
      res.status(400).json({ error: "Cart not found" });
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


const verifyOrder = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
    const cart = await Cart.findOne({ user: loggedInUserId }).populate(
      "products.product"
    );
    const { response, selectedAddress, paymentMethod, couponCode } = req.body;
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      response;

    const key_secret = process.env.RAZORPAY_SECRET;
    let hmac = crypto.createHmac("sha256", key_secret);

    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (razorpay_signature === generated_signature) {
      const cartItems = cart.products;

      let couponId = null;
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode });
        if (coupon) {
          couponId = coupon._id;
        }
      }

      const addressId = selectedAddress;
      const shippingAddress = addressId
        // ? await address.findById(addressId)
        // : null;

      let totalAmount = req.body.amount;
      // console.log(typeof(totalAmount))
      for (const cartItem of cartItems) {
        const product = await Product.findById(cartItem.product._id);
        const quantityInCart = cartItem.count;

        product.quantity -= quantityInCart;
        await product.save();
      }

      const newOrder = new Order({
        userId: loggedInUserId,
        shippingAddress: shippingAddress,
        products: cartItems.map((item) => ({
          productId: item.product._id,
          quantity: item.count,
          ProductOrderStatus: "Pending",
          returnOrderStatus: {},
          productPaymentStatus: "Success"
        })),
        OrderStatus: "Pending",
        StatusLevel: 1,
        paymentStatus: "Success",
        totalAmount,
        paymentMethod,
        coupon: couponId,
        trackId: "Generated Track ID",
      });

      await newOrder.save();
      await Cart.findOneAndUpdate(
        { user: loggedInUserId },
        { $set: { products: [] } }
      );

      await users.findByIdAndUpdate(loggedInUserId, {
        $unset: { appliedCoupon: 1 },
      });

      res.json({ success: true, message: "Payment has been verified" });
    } else {
      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const reVerifyOrder = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
    
    const { response } = req.body;
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      response;

    const key_secret = process.env.RAZORPAY_SECRET;
    let hmac = crypto.createHmac("sha256", key_secret);

    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (razorpay_signature === generated_signature) {
      
  
      let totalAmount = req.body.amount;
      let orderId = req.body.orderId;
      // console.log(typeof(totalAmount))

      const order = await Order.findById(orderId);

      // Update existing order details
      order.products.forEach((product) => {
        product.ProductOrderStatus = "Pending";
        product.productPaymentStatus = "Success";
    });
    
      order.OrderStatus = "Pending";
      order.StatusLevel = 1;
      order.paymentStatus = "Success";
      order.totalAmount = totalAmount;
      order.paymentMethod = "Online Payment";
      order.trackId = "Generated Track ID";

      // Save the updated order
      await order.save();
    
      res.json({ success: true, message: "Payment has been verified" });
    } else {
      res.json({ success: false, message: "Payment verification failed" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



const paymentFailed = async (req, res) => {
  try {
    console.log("failed")
    res.status(500).json({ error: "Failed to create order" });
      res.status(200).send({ success: true });
  } catch (error) {
      console.error('Failed to update order status:', error);
      res.status(500).send({ success: false });
  }
};



const placeOrder = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
    const cart = await Cart.findOne({ user: loggedInUserId }).populate(
      "products.product"
    );

    if (cart) {
      const cartItems = cart.products;

      
      const shippingAddress = req.body.selectedAddress;

      const user = await users.findById(loggedInUserId);

      let totalAmount = 0;

      for (const cartItem of cartItems) {
        const product = await Product.findById(cartItem.product._id);
        const quantityInCart = cartItem.count;

        if (product.quantity < quantityInCart) {
          res
            .status(400)
            .send("Insufficient quantity for one or more products");
          return;
        }

        // const priceToUse = cartItem.product.price;

        const priceToUse =
          cartItem.product.catOfferPrice !== null
            ? cartItem.product.catOfferPrice
            : cartItem.product.offerPrice !== null
            ? cartItem.product.offerPrice
            : cartItem.product.price;

        totalAmount += quantityInCart * priceToUse;
      }

      const appliedCouponCode = req.body.couponCode;
      let couponId = null;
   
      if (appliedCouponCode) {
        const coupon = await Coupon.findOne({ code: appliedCouponCode });

        if (coupon) {
          totalAmount -= coupon.discountAmount;
          couponId = coupon._id;
        } else {
          return res
            .status(400)
            .json({
              coupon: "Unfortunately, the coupon is not valid at the moment.",
            });
        }
      }

      // Move quantity reduction logic inside the coupon block

     
      const paymentMethod = req.body.paymentMethod;
      const walletBalance = user.wallet.balance;

      if (paymentMethod === "Wallet Money") {
        if (totalAmount <= walletBalance) {
          await users.findByIdAndUpdate(loggedInUserId, {
            $set: { "wallet.balance": walletBalance - totalAmount },
            $push: {
              "wallet.history": {
                type: "Debit",
                amount: totalAmount,
                date: new Date(),
                reason: "Order Placement",
              },
            },
          });
        } else {
          return res
            .status(400)
            .json({
              error:
                "Insufficient balance in Wallet. Please choose another payment method.",
            });
        }}
      // } else if (paymentMethod !== "Cash on Delivery") {
      //   return res
      //     .status(400)
      //     .json({
      //       error:
      //         "Invalid payment method. Please choose another payment method.",
      //     });
      // }     

      for (const cartItem of cartItems) {
        const product = await Product.findById(cartItem.product._id);
        const quantityInCart = cartItem.count;

        product.quantity -= quantityInCart;
        await product.save();
      }

      if (paymentMethod =='Online Payment') {
        const newOrder = new Order({
          userId: loggedInUserId,
          shippingAddress: shippingAddress,
          products: cartItems.map((item) => ({
            productId: item.product._id,
            quantity: item.count,
            ProductOrderStatus: "Pending - Failed Payment",
            returnOrderStatus: {},
            productPaymentStatus:"Failed",
          })),
          OrderStatus: "Pending - Failed Payment",
          StatusLevel: 1,
          paymentStatus:"Failed",
          totalAmount,
          paymentMethod,
          coupon: couponId || "No Coupon Applied",
          trackId: "Generated Track ID",
        });
  
        await newOrder.save();
      } else {
        const newOrder = new Order({
          userId: loggedInUserId,
          shippingAddress: shippingAddress,
          products: cartItems.map((item) => ({
            productId: item.product._id,
            quantity: item.count,
            ProductOrderStatus: "Pending",
            returnOrderStatus: {},
            productPaymentStatus:paymentMethod === "Wallet Money" ? "Success" : "Pending",
          })),
          OrderStatus: "Pending",
          StatusLevel: 1,
          paymentStatus: paymentMethod === "Wallet Money" ? "Success" : "Pending",
          totalAmount,
          paymentMethod,
          coupon: couponId || "No Coupon Applied",
          trackId: "Generated Track ID",
        });
  
        await newOrder.save();
      }


      await Cart.findOneAndUpdate(
        { user: loggedInUserId },
        { $set: { products: [] } }
      );

      res.json({ orderPlaced: `Order placed using ${paymentMethod}` });
    } else {
      res.redirect("/checkout");
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const fetchWalletBalance = async (req, res) => {
  const loggedInUserId = req.session.user_id;
  const userId = loggedInUserId;

  try {
    const user = await users.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const walletBalance = user.wallet.balance;

    res.json({ balance: walletBalance });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const loadCheckout = async (req, res) => {
  try {
    const user_id = req.session.user_id;

    const activeCoupons = await Coupon.find({});
    const cart = await Cart.findOne({ user: user_id }).populate(
      "products.product"
    );
    const addresses = await address.find({ userId: user_id });

    let appliedCoupon;
    let discountAmount = 0;
    
    if (req.session.appliedCoupon) {
      appliedCoupon = req.session.appliedCoupon;
    }

    if (cart) {
      const cartItems = cart.products;
      let subtotal = 0;
      let discountedSubtotal = 0;
      
      const discountPromises = cartItems.map(async (cartItem) => {
        const itemTotal = cartItem.count * cartItem.product.price;
        subtotal += itemTotal;

        if (cartItem.product.catOfferPrice !== null) {
          discountedSubtotal += cartItem.product.catOfferPrice * cartItem.count;
          const discountPercentage = await Offer.findById(cartItem.product.offer);
          return itemTotal * (discountPercentage.offerDiscount / 100);

        } else if (cartItem.product.offerPrice !== null) {
          discountedSubtotal += cartItem.product.offerPrice * cartItem.count;
          const discountPercentage = await Offer.findById(cartItem.product.offer);
          return itemTotal * (discountPercentage.offerDiscount / 100);

        } else {
          discountedSubtotal += itemTotal;
          return 0;
        }
      });

      const discountAmounts = await Promise.all(discountPromises);
      discountAmount = discountAmounts.reduce((acc, curr) => acc + curr, 0);

      res.render("checkout", {
        cartItems,
        addresses,
        subtotal: discountedSubtotal,
        user_id,
        appliedCoupon,
        activeCoupons,
        discountAmount: discountAmount.toFixed(2),
      });
    } else {
      res.render("checkout", {
        cartItems: [],
        addresses: [],
        subtotal: 0,
        appliedCoupon,
        activeCoupons,
      });
    }
  } catch (error) {
    console.log("Failed to load checkout page", error);
    res.status(500).send("Failed to load checkout page");
  }
};


const getCoupon = async (req, res) => {
  try {
    const { value } = req.body;
    const coupon = await Coupon.findOne({ code: value });

    if (coupon) {
      res.status(200).json({
        couponCode: coupon.code,
        discountAmount: coupon.discountAmount,
        minimumSpend:coupon.minimumSpend,
      });
    } else {
      res.status(404).json({ error: "Coupon not found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
};


// const addShippingDetails = async (req, res) => {
//   try {
//     const loggedInUserId = req.session.user_id;

//     const {
//       firstName,
//       lastName,
//       hcName,
//       streetName,
//       city,
//       state,
//       pincode,
//       email,
//       mobile,
//     } = req.body;

//     const newShippingDetails = new address({
//       userId: loggedInUserId,
//       firstName,
//       lastName,
//       hcName,
//       streetName,
//       city,
//       state,
//       pincode,
//       email,
//       mobile,
//     });

//     await newShippingDetails.save();

//     res.redirect("/checkout");
//   } catch (error) {
//     console.error(error);
//     res.status(500).send("Internal Server Error");
//   }
// };

// const orderPlaced = async (req, res) => {
//   try {
//     res.redirect("/orderPlaced");
//   } catch (error) {
//     console.log("error to load the orderPlaced page");
//   }
// };

const loadOrderPlaced = async (req, res) => {
  try {
    res.render("orderPlaced");
  } catch (error) {
    console.log(error.message);
  }
};

const loadOrders = async (req, res) => {
  try {
    const perPage = 10; // Number of orders per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1

    // Find orders for the current user
    const totalOrders = await Order.countDocuments({ userId: req.session.user_id });
    const orders = await Order.find({ userId: req.session.user_id })
      .populate({
        path: "products.productId",
        select: "name productImage",
      })
      .populate("shippingAddress")
      .sort({ orderDate: -1 })
      .skip((page - 1) * perPage) // Skip the orders for the previous pages
      .limit(perPage); // Limit the number of orders returned

    const totalPages = Math.ceil(totalOrders / perPage); // Calculate total pages

    // Render the orders page with paginated orders
    res.render("orders", {
      orders,
      currentPage: page, // Pass the current page to the view
      totalPages // Pass total pages to the view
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Failed to load orders");
  }
};


const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const orderDetails = await Order.findById(orderId).populate(
      "products.productId"
    );

    res.render("orderDetails", { orderDetails });
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Failed to load order details");
  }
};


const fetchOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const orderDetails = await Order.findById(orderId).populate(
      "products.productId"
    );
    const totalAmount = req.body.amount;
    const options = {
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: "order1",
    };

    instance.orders.create(options, (err, order) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create order" });
      } else {
        res.json({ orderId: order.id ,totalAmount});
      }
    });

  } catch (error) {
    console.log(error.message);
    res.status(500).send("Failed to load order details");
  }
};


const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.params.productId;
    const cancelDescription = req.body.cancelDescription;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const productIndex = order.products.findIndex(
      (item) => item._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).send("Product not found in order");
    }

    const productInOrder = order.products[productIndex];

    if (productInOrder.ProductOrderStatus !== "Pending") {
      return res.status(400).send("Cannot cancel an order that is not pending");
    }

    const product = await Product.findById(productInOrder.productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const updatedQuantity = product.quantity + productInOrder.quantity;
    await Product.findByIdAndUpdate(product._id, { quantity: updatedQuantity });

    order.products[productIndex].ProductOrderStatus = "Cancelled";
    order.products[productIndex].returnOrderStatus = {
      status: "Cancelled",
      reason: cancelDescription,
      date: new Date(),
    };

    let cancelledProductAmount;

    
    // if (order.paymentMethod === "Cash on Delivery") {
    //   order.paymentStatus = "Cancelled";
    // }
    // Check if offerPrice or catOfferPrice is not null in the products model

    if(product.offerPrice !==null){
      cancelledProductAmount = product.offerPrice * productInOrder.quantity;
    }else if(product.catOfferPrice !== null){
      cancelledProductAmount = product.catOfferPrice * productInOrder.quantity;
    }else{
      // Regular Price
      cancelledProductAmount = product.price * productInOrder.quantity;
    }

    if (order.coupon) {
      const coupon = await Coupon.findById(order.coupon._id);

      if (coupon) {
        const numberOfProducts = order.products.length;

        cancelledProductAmount -= coupon.discountAmount;

        if (numberOfProducts > 1) {
          const dividedCouponAmount = coupon.discountAmount / numberOfProducts;
          cancelledProductAmount += dividedCouponAmount;
        }
      }
    }

    
    if (
      productInOrder.ProductOrderStatus === "Cancelled" &&
      (order.paymentMethod === "Online Payment" ||
        order.paymentMethod === "Wallet Money") &&
      order.paymentStatus === "Success"
    ) {
      const user = await users.findById(order.userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      user.wallet.balance += cancelledProductAmount;

      user.wallet.history.push({
        type: "Credit",
        amount: cancelledProductAmount,
        date: new Date(),
        reason: `Order cancellation: ${cancelDescription}`,
      });

      if (order.paymentMethod === "Wallet Money") {
        order.paymentStatus = "Refunded to wallet";
        productInOrder.productPaymentStatus = "Refunded to wallet"
      } else if (order.paymentMethod === "Online Payment") {
        order.paymentStatus = "Refunded to wallet";
        productInOrder.productPaymentStatus = "Refunded to wallet"
      }

      await user.save();
    } else if (order.paymentMethod === "Cash on Delivery") {
      order.paymentStatus = "Cancelled";
      productInOrder.productPaymentStatus = "Cancelled"
    }


    order.OrderStatus = "Cancelled";

    await order.save();
    
    res.status(200).json({ message: "Order successfully cancelled", order });
    
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to cancel order");
  }
};


const requestReturn = async (req,res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.params.productId;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const productIndex = order.products.findIndex(
      (item) => item._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).send("Product not found in order");
    }

    const productInOrder = order.products[productIndex];

    if (order.OrderStatus !== "Delivered") {
      return res
        .status(400)
        .send("Cannot return a product that is not delivered");
    }

    const product = await Product.findById(productInOrder.productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    order.products[productIndex].returnOrderStatus = {
      status: "Return Requested",
      date: new Date(),
    };

    const allProductsReturned = order.products.every(
      (product) =>
        product.returnOrderStatus &&
        product.returnOrderStatus.status === "Return Requested"
    );

    order.OrderStatus = allProductsReturned ? "Return Requested" : "Delivered";

    await order.save();

    res.status(200).json({ message: "Product successfully returned", order });


  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to return product");
  }
}


const returnProduct = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const productId = req.params.productId;
    const returnReason = req.body.returnReason;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const productIndex = order.products.findIndex(
      (item) => item._id.toString() === productId
    );

    if (productIndex === -1) {
      return res.status(404).send("Product not found in order");
    }

    const productInOrder = order.products[productIndex];

    if (order.OrderStatus !== "Approved Request" ) {
      return res
        .status(400)
        .send("Cannot return a product that is not delivered");
    }

    const product = await Product.findById(productInOrder.productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // let returnAmount = product.price * productInOrder.quantity;

    let returnAmount;

    if (product.offerPrice !== null) {
      returnAmount = product.offerPrice * productInOrder.quantity;
    } else if (product.catOfferPrice !== null) {
      returnAmount = product.catOfferPrice * productInOrder.quantity;
    } else {
      returnAmount = product.price * productInOrder.quantity;
    }

    if (order.coupon) {
      const coupon = await Coupon.findById(order.coupon._id);

      if (coupon) {
        const numberOfProducts = order.products.length;

        returnAmount -= coupon.discountAmount;

        if (numberOfProducts > 1) {
          const dividedCouponAmount = coupon.discountAmount / numberOfProducts;
          returnAmount += dividedCouponAmount;
        }
      }
    }


    if (returnReason === "Defective or Damaged Product") {
      const user = await users.findById(order.userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      user.wallet.balance += returnAmount;

      user.wallet.history.push({
        type: "Credit",
        amount: returnAmount,
        date: new Date(),
        reason: `Product return (Defective/Damaged): ${returnReason}`,
      });


      await user.save();
    } else {
      const returnedQuantity = productInOrder.quantity;
      const updatedQuantity = product.quantity + returnedQuantity;

      await Product.findByIdAndUpdate(product._id, {
        quantity: updatedQuantity,
      });

      const user = await users.findById(order.userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      user.wallet.balance += returnAmount;

      user.wallet.history.push({
        type: "Credit",
        amount: returnAmount,
        date: new Date(),
        reason: `Product return (${returnReason}): ${returnReason}`,
      });


      await user.save();
    }

    order.products[productIndex].returnOrderStatus = {
      status: "Returned",
      reason: returnReason,
      date: new Date(),
    };

    // order.products[productIndex].returnOrderStatus = {
    //   status: "Returned",
    //   reason: returnReason,
    //   date: new Date(),
    // };

    order.products[productIndex].productPaymentStatus = "Refund to wallet";

    const allProductsReturned = order.products.every(
      (product) =>
        product.returnOrderStatus &&
        product.returnOrderStatus.status === "Returned"
    );

    order.OrderStatus = allProductsReturned ? "Returned" : "Delivered";

    if (allProductsReturned) {
      order.paymentStatus = "Refund to wallet";
    }

    await order.save();

  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to return product");
  }
};


// Invoice Download

const generateInvoice = async (req, res) => {
  try {
    const doc = new PDFDocument();

  const orderId = req.query.orderId;

  const order = await Order.findById(orderId).populate('products.productId');
  const invoiceNumber = Math.round(Math.random())
  const invoiceDate = new Date();

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="Invoice.pdf"'
  );
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

 // Add the report title
 doc.fontSize(18).text("Order Invoice", { align: "center", underline: true });
 doc.moveDown(0.2);
 doc.fontSize(10).text(`Gravity Fitness`, { align: "center" });
 doc.moveDown(2);

 // Add summary
 doc.fontSize(12).text(`Shipping Address: ${order.shippingAddress}`);
 doc.moveDown(0.2);
 doc.text(`Order Id: ${order._id}`);
 doc.moveDown(0.2);
 doc.text(`Order Date: ${order.date}`);
 doc.moveDown(0.2);
 doc.text(`Invoice Number: ${invoiceNumber}`);
 doc.moveDown(0.2);
 doc.text(`Invoice Date: ${invoiceDate}`);



 doc.moveDown(2);

 // Define table headers with specific column widths
 const addTableHeaders = () => {
   const startY = doc.y;
   doc.fontSize(12)
     .text("No", 10, startY, { width: 30, align: "left" })
     .text("Description", 40, startY, { width: 75, align: "left" })
     .text("Unit Price", 115, startY, { width: 85, align: "left" })
     .text("Discount Price", 200, startY, { width: 60, align: "left" })
     .text("Quantity", 260, startY, { width: 55, align: "left" })
     .text("Tax Rate", 315, startY, { width: 60, align: "left" })
     .text("Tax Type", 365, startY, { width: 60, align: "left" })
     .text("Tax Amount", 425, startY, { width: 60, align: "left" })





   doc.moveTo(10, doc.y + 10).lineTo(690, doc.y + 10).stroke(); // Draw a line under headers
   doc.moveDown(2);
 };

 const drawRowLines = (yPosition) => {
   const verticalLineAdjustment = -25; // Move vertical lines slightly to the left
   const lineHeight = 100; // Increase the height of the vertical lines
 
   doc.moveTo(5, yPosition).lineTo(750, yPosition).stroke(); // Horizontal line
 
  //  // Adjusted vertical lines with increased height
  //  doc.moveTo(100 + verticalLineAdjustment, yPosition - lineHeight).lineTo(100 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "No"
  //  doc.moveTo(220 + -20, yPosition - lineHeight).lineTo(220 + -20, yPosition).stroke(); // Vertical line after "Order ID"
  //  doc.moveTo(290 + verticalLineAdjustment, yPosition - lineHeight).lineTo(290 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "User"
  //  doc.moveTo(400 + verticalLineAdjustment, yPosition - lineHeight).lineTo(400 + verticalLineAdjustment, yPosition).stroke(); // Vertical line after "Order Date"
 };
 console.log(order)

 addTableHeaders();

 const maxY = 750; // The y position where you want to start a new page

 order.products.forEach((product,index) => {
   const productName = `${product.productId.name} `;

   const orderHeightEstimate = 20 + order.products.length * 15 + 10; // Estimate the height needed for the order and its products

   // Check if adding this order will exceed the page limit
   if (doc.y + orderHeightEstimate > maxY) {
     doc.addPage(); // Add a new page
     addTableHeaders(); // Re-add the headers on the new page
   }
   const total = product.quantity * product.productId.price;
   let discount;
   if (product.productId.catOfferPrice) {
      discount = product.productId.catOfferPrice;
   }else if (product.productId.offerPrice) {
      discount = product.productId.offerPrice;
   }else{
      discount = product.productId.price
   }
   // Add the order details
   const currentY = doc.y;
   doc.fontSize(10)
     .text(`${index + 1}`, 10, currentY, { width: 30, align: "left" })
     .text(`${productName}`, 40, currentY, { width: 75, align: "left" })
     .text(`${product.quantity}`, 200, currentY, { width: 60, align: "left" })
     .text(`${discount}`, 115, currentY, { width: 85, align: "left" })
     .text(`${total}`, 260, currentY, { width: 55, align: "left" })
     .text('0%', 315, currentY, { width: 60, align: "left" })
     .text('GST', 365, currentY, { width: 60, align: "left" })
     .text('0', 425, currentY, { width: 60, align: "left" })

   doc.moveDown();

   drawRowLines(doc.y + 8); // Draw horizontal line after each row and vertical lines between columns


   doc.moveDown(1.5); // Add space after each order
 });
 doc.fontSize(10).text(`Grand Total : Rs.${order.totalAmount.toFixed(2)}`, { width: 80, align: "left" });
 doc.end();
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to generate invoice");
  }
  
}

module.exports = {
  loadCheckout,
  // orderPlaced,
  placeOrder,
  loadOrders,
  loadOrderDetails,
  cancelOrder,
  returnProduct,
  requestReturn,
  createOrder,
  loadOrderPlaced,
  getCoupon,
  fetchWalletBalance,
  verifyOrder,
  generateInvoice,
  paymentFailed,
  reVerifyOrder,
  fetchOrderDetails
};
