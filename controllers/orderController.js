const address = require("../models/addressModel");
const Product = require("../models/productsModel");

const { Order } = require("../models/ordersModel");
const users = require("../models/userModel");
const Cart = require("../models/cartModel");



const createOrder = async (req, res) => {
  try {
    const loggedInUserId = req.session.user_id;
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

        const priceToUse = cartItem.product.price;

        totalAmount += quantityInCart * priceToUse;

        
      }
      


      instance.orders.create(totalAmount, function (err, order) {
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

      const addressId = req.body.selectedAddress;
      const shippingAddress = addressId
        ? await address.findById(addressId)
        : null;

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

        const priceToUse = cartItem.product.price;

        totalAmount += quantityInCart * priceToUse;
      }
    

     
      const paymentMethod = req.body.paymentMethod;
      

      for (const cartItem of cartItems) {
        const product = await Product.findById(cartItem.product._id);
        const quantityInCart = cartItem.count;

        product.quantity -= quantityInCart;
        await product.save();
      }

      const newOrder = new Order({
        userId: loggedInUserId,
        shippingAddress: shippingAddress ? shippingAddress._id : null,
        products: cartItems.map((item) => ({
          productId: item.product._id,
          quantity: item.count,
          ProductOrderStatus: "Pending",
          returnOrderStatus: {},
        })),
        OrderStatus: "Pending",
        StatusLevel: 1,
        paymentStatus: "Pending",
        totalAmount,
        paymentMethod,
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

const loadCheckout = async (req, res) => {
  try {
    const user_id = req.session.user_id;

    const cart = await Cart.findOne({ user: user_id }).populate(
      "products.product"
    );
    const addresses = await address.find({ userId: user_id });


    if (cart) {
      const cartItems = cart.products;
      let subtotal = 0;

      cartItems.forEach((cartItem) => {
        const itemTotal = cartItem.count * cartItem.product.price;
        subtotal += itemTotal;

      });

      res.render("checkout", {
        cartItems,
        addresses,
        subtotal: subtotal,
        user_id,
      });
    } else {
      res.render("checkout", {
        cartItems: [],
        addresses: [],
        subtotal: 0,
      });
    }
  } catch (error) {
    console.log("Failed to load checkout page", error);
    res.status(500).send("Failed to load checkout page");
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

const orderPlaced = async (req, res) => {
  try {
    res.render("/orderPlaced");
  } catch (error) {
    console.log("error to load the orderPlaced page");
  }
};

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


    if (order.paymentMethod === "Cash on Delivery") {
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

    let returnAmount = product.price * productInOrder.quantity;


    if (returnReason === "Defective or Damaged Product") {
      const user = await users.findById(order.userId);

      if (!user) {
        return res.status(404).send("User not found");
      }

      user.wallet.balance += returnAmount;


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
  orderPlaced,
  placeOrder,
  loadOrders,
  loadOrderDetails,
  cancelOrder,
  returnProduct,
  createOrder,
  loadOrderPlaced,
};
