const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const csrf = require('csurf');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const Jazzcash = require('jazzcash-checkout'); // Import JazzCash library
const Product = require('../models/product');
const Category = require('../models/category');
const Cart = require('../models/cart');
const Order = require('../models/order');
const middleware = require('../middleware');

const app = express();
const router = express.Router();
const csrfProtection = csrf();

const JAZZCASH_MERCHANT_ID = "94669";
const JAZZCASH_PASSWORD = "0123456789";
const JAZZCASH_RETURN_URL = "http://localhost:3000/";
const JAZZCASH_INTEGRITY_SALT = "0123456789"

app.use(bodyParser.urlencoded({ extended: false }));
router.use(csrfProtection);

// Function to format date
function formatDate(date) {
  const yyyy = date.getFullYear().toString();
  const MM = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const HH = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  // return ${yyyy}${MM}${dd}${HH}${mm}${ss};
}

// GET: home page
router.get("/", async (req, res) => {
  try {
    const products = await Product.find({})
      .sort("-createdAt")
      .populate("category");
    res.render("shop/home", { pageName: "Home", products });
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});

// GET: add a product to the shopping cart when "Add to cart" button is pressed
router.get("/add-to-cart/:id", async (req, res) => {
  const productId = req.params.id;
  try {
    let user_cart;
    if (req.user) {
      user_cart = await Cart.findOne({ user: req.user._id });
    }
    let cart;
    if (
      (req.user && !user_cart && req.session.cart) ||
      (!req.user && req.session.cart)
    ) {
      cart = await new Cart(req.session.cart);
    } else if (!req.user || !user_cart) {
      cart = new Cart({});
    } else {
      cart = user_cart;
    }

    const product = await Product.findById(productId);
    const itemIndex = cart.items.findIndex((p) => p.productId == productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].qty++;
      cart.items[itemIndex].price = cart.items[itemIndex].qty * product.price;
      cart.totalQty++;
      cart.totalCost += product.price;
    } else {
      cart.items.push({
        productId: productId,
        qty: 1,
        price: product.price,
        title: product.title,
        productCode: product.productCode,
      });
      cart.totalQty++;
      cart.totalCost += product.price;
    }

    if (req.user) {
      cart.user = req.user._id;
      await cart.save();
    }
    req.session.cart = cart;
    req.flash("success", "Item added to the shopping cart");
    res.redirect(req.headers.referer);
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

// GET: view shopping cart contents
router.get("/shopping-cart", async (req, res) => {
  try {
    let cart_user;
    if (req.user) {
      cart_user = await Cart.findOne({ user: req.user._id });
    }
    if (req.user && cart_user) {
      req.session.cart = cart_user;
      return res.render("shop/shopping-cart", {
        cart: cart_user,
        pageName: "Shopping Cart",
        products: await productsFromCart(cart_user),
      });
    }
    if (!req.session.cart) {
      return res.render("shop/shopping-cart", {
        cart: null,
        pageName: "Shopping Cart",
        products: null,
      });
    }
    return res.render("shop/shopping-cart", {
      cart: req.session.cart,
      pageName: "Shopping Cart",
      products: await productsFromCart(req.session.cart),
    });
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

// GET: reduce one from an item in the shopping cart
router.get("/reduce/:id", async function (req, res, next) {
  const productId = req.params.id;
  let cart;
  try {
    if (req.user) {
      cart = await Cart.findOne({ user: req.user._id });
    } else if (req.session.cart) {
      cart = await new Cart(req.session.cart);
    }

    let itemIndex = cart.items.findIndex((p) => p.productId == productId);
    if (itemIndex > -1) {
      const product = await Product.findById(productId);
      cart.items[itemIndex].qty--;
      cart.items[itemIndex].price -= product.price;
      cart.totalQty--;
      cart.totalCost -= product.price;
      if (cart.items[itemIndex].qty <= 0) {
        await cart.items.remove({ _id: cart.items[itemIndex]._id });
      }
      req.session.cart = cart;
      if (req.user) {
        await cart.save();
      }
      if (cart.totalQty <= 0) {
        req.session.cart = null;
        await Cart.findByIdAndRemove(cart._id);
      }
    }
    res.redirect(req.headers.referer);
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

// GET: remove all instances of a single product from the cart
router.get("/removeAll/:id", async function (req, res, next) {
  const productId = req.params.id;
  let cart;
  try {
    if (req.user) {
      cart = await Cart.findOne({ user: req.user._id });
    } else if (req.session.cart) {
      cart = await new Cart(req.session.cart);
    }

    let itemIndex = cart.items.findIndex((p) => p.productId == productId);
    if (itemIndex > -1) {
      cart.totalQty -= cart.items[itemIndex].qty;
      cart.totalCost -= cart.items[itemIndex].price;
      await cart.items.remove({ _id: cart.items[itemIndex]._id });
    }
    req.session.cart = cart;
    if (req.user) {
      await cart.save();
    }
    if (cart.totalQty <= 0) {
      req.session.cart = null;
      await Cart.findByIdAndRemove(cart._id);
    }
    res.redirect(req.headers.referer);
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

// GET: checkout form with csrf token
router.get("/checkout", middleware.isLoggedIn, async (req, res) => {
  const errorMsg = req.flash("error")[0];

  if (!req.session.cart) {
    return res.redirect("/shopping-cart");
  }

  try {
    const cart = await Cart.findById(req.session.cart._id);
    res.render("shop/checkout", {
      total: cart.totalCost,
      csrfToken: req.csrfToken(),
      errorMsg,
      pageName: "Checkout",
    });
  } catch (err) {
    console.log(err.message);
    res.redirect("/shopping-cart");
  }
});

// POST: handle checkout logic and payment using Stripe or JazzCash
router.post("/checkout", middleware.isLoggedIn, async (req, res) => {
  if (!req.session.cart) {
    return res.redirect("/shopping-cart");
  }

  const cart = await Cart.findById(req.session.cart._id);
  const paymentMethod = req.body.paymentMethod;

  if (paymentMethod === 'stripe') {
    stripe.charges.create({
      amount: cart.totalCost * 100,
      currency: "usd",
      source: req.body.stripeToken,
      description: "Stripe Payment",
    }, async (err, charge) => {
      if (err) {
        req.flash("error", err.message);
        console.log(err);
        return res.redirect("/checkout");
      }
      const order = new Order({
        user: req.user,
        cart: {
          totalQty: cart.totalQty,
          totalCost: cart.totalCost,
          items: cart.items,
        },
        address: req.body.address,
        paymentId: charge.id,
      });
      await order.save();
      await cart.remove();
      req.flash("success", "Successfully purchased with Stripe");
      req.session.cart = null;
      res.redirect("/user/profile");
    });
  } else if (paymentMethod === 'jazzcash') {
    try {
      const jazzcashClient = new Jazzcash();

      const jazzcashData = {
        pp_Amount: cart.totalCost * 100,
        pp_BillReference: "billRef123",
        pp_Description: "Test Payment",
        pp_MobileNumber: "03123456789",
        pp_Language: "EN",
        pp_TxnDateTime: formatDate(new Date()),
        pp_TxnExpiryDateTime: formatDate(new Date(new Date().getTime() + 600000)),
        pp_TxnType: "MWALLET",
        pp_MerchantID: JAZZCASH_MERCHANT_ID,
        pp_Password: JAZZCASH_PASSWORD,
        pp_ReturnURL: JAZZCASH_RETURN_URL,
        pp_SecureHash: "",
      };

      const secureHash = crypto
        .createHash('sha256')
        .update(JAZZCASH_INTEGRITY_SALT + '&' + Object.values(jazzcashData).join('&'))
        .digest('hex');
      jazzcashData.pp_SecureHash = secureHash;

      const paymentUrl = await jazzcashClient.createCharge(jazzcashData);
      res.redirect(paymentUrl);
    } catch (err) {
      req.flash("error", err.message);
      console.log(err);
      return res.redirect("/checkout");
    }
  } else {
    req.flash("error", "Invalid payment method");
    res.redirect("/checkout");
  }
});

// Function to get products from the cart
async function productsFromCart(cart) {
  const products = [];
  for (const item of cart.items) {
    const foundProduct = await Product.findById(item.productId);
    products.push({
      product: foundProduct,
      qty: item.qty,
      price: item.price,
    });
  }
  return products;
}

module.exports = router;