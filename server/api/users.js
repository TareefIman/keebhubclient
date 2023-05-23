const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");
const { GMAIL_EMAIL, GMAIL_PASSWORD } = process.env;

require("dotenv").config();

//======================== helper function start ===============================
function validateEmail(email) {
  const res = /\S+@\S+\.\S+/;
  return res.test(email);
}
//======================== helper function end ===============================

/**
 * register route
 */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    let userFound = await User.findOne({ username });
    let userFoundByEmail = await User.findOne({ email });

    if (!validateEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (userFound) {
      return res.status(400).json({
        message: "Username already exists",
      });
    }

    if (userFoundByEmail) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    let user = new User(req.body);
    let salt = bcrypt.genSaltSync(10);
    let hash = bcrypt.hashSync(password, salt);
    user.password = hash;
    await user.save();

    // Send email notification to customer after successful registration
    sendRegistrationEmail(email, username);

    return res.status(200).json({
      message: "Registered successfully",
    });
  } catch (error) {
    return res.status(400).json({
      error,
      message: "Failed to register",
    });
  }
});

// Function to send email after successful registration
const sendRegistrationEmail = (userEmail, userName) => {
  let config = {
    host: "smtp.gmail.com",
    auth: {
      user: GMAIL_EMAIL,
      pass: GMAIL_PASSWORD,
    },
  };

  let transporter = nodemailer.createTransport(config);

  let mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "keebhub",
      link: "https://mailgen.js/",
    },
  });

  let response = {
    body: {
      name: userName,
      intro: "Thank you for registering for our website",
      table: {
        data: [],
      },
      outro:
        "Our website is still in beta. If you have any feedback, please do email us",
    },
  };

  let mail = mailGenerator.generate(response);

  let message = {
    from: GMAIL_EMAIL,
    to: userEmail,
    subject: "Registration Successful",
    html: mail,
  };

  transporter.sendMail(message);
};
// Register route end

/**
 * login route
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    let userFound = await User.findOne({ username });

    if (!userFound) {
      return res.status(400).json({
        message: "Username does not exist",
      });
    }

    let isMatch = bcrypt.compareSync(password, userFound.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    jwt.sign(
      { user: userFound },
      process.env.SECRET_KEY,
      { expiresIn: "720h" },
      (err, token) => {
        if (err) res.status(400).json({ err, msg: "Unable to login" });
        return res.send(token);
      }
    );
  } catch (e) {
    return res.status(400).json({ e, msg: "Invalid Credentials" });
  }
});

// login route end

/**
 * get logged in user
 */

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password"); // don't send back the password
    return res.json(user);
  } catch (e) {
    return res.status(500).send("Server Error");
  }
});

module.exports = router;
