const address = require("../models/addressModel");
const Product = require("../models/productsModel");

const { Order } = require("../models/ordersModel");
const users = require("../models/userModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");


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
        amount: Math.max(totalAmount * 100, 100),
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
        }
      } else if (paymentMethod !== "Cash on Delivery") {
        return res
          .status(400)
          .json({
            error:
              "Invalid payment method. Please choose another payment method.",
          });
      }     

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

    if (req.session.appliedCoupon) {
      appliedCoupon = req.session.appliedCoupon;
    }

    if (cart) {
      const cartItems = cart.products;
      let subtotal = 0;
      let discountedSubtotal = 0;

      cartItems.forEach((cartItem) => {
        const itemTotal = cartItem.count * cartItem.product.price;
        subtotal += itemTotal;

        if (cartItem.product.catOfferPrice !== null) {
          discountedSubtotal += cartItem.product.catOfferPrice * cartItem.count;
        } else if (cartItem.product.offerPrice !== null) {
          discountedSubtotal += cartItem.product.offerPrice * cartItem.count;
        } else {
          discountedSubtotal += itemTotal;
        }

      });

      res.render("checkout", {
        cartItems,
        addresses,
        subtotal: discountedSubtotal,
        user_id,
        appliedCoupon,
        activeCoupons,
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
    const orders = await Order.find({ userId: req.session.user_id })
      .populate({
        path: "products.productId",
        select: "name productImage",
      })
      .populate("shippingAddress")
      .sort({orderDate:-1});

    res.render("orders", { orders });
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
      } else if (order.paymentMethod === "Online Payment") {
        order.paymentStatus = "Refunded to wallet";
      }

      await user.save();
    } else if (order.paymentMethod === "Cash on Delivery") {
      order.paymentStatus = "Cancelled";
    }


    order.OrderStatus = "Cancelled";

    await order.save();

    res.status(200).json({ message: "Order successfully cancelled", order });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to cancel order");
  }
};


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

    if (order.OrderStatus !== "Delivered") {
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

    order.products[productIndex].returnOrderStatus = {
      status: "Returned",
      reason: returnReason,
      date: new Date(),
    };

    order.products[productIndex].paymentStatus = "Refund to wallet";

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

    res.status(200).json({ message: "Product successfully returned", order });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Failed to return product");
  }
};

module.exports = {
  loadCheckout,
  // orderPlaced,
  placeOrder,
  loadOrders,
  loadOrderDetails,
  cancelOrder,
  returnProduct,
  createOrder,
  loadOrderPlaced,
  getCoupon,
  fetchWalletBalance
};
