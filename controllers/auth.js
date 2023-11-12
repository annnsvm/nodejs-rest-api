const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const Jimp = require("jimp");
const path = require("path");
const fs = require("fs/promises");
const { v4: uuidv4 } = require("uuid");

const { User } = require("../models/user");

const { HttpErrors, CtrlWrapper } = require("../helpers");
const sendEmail = require("../helpers/sendEmail");

const { SECRET_KEY, BASE_URL } = process.env;

const avatarsDir = path.join(__dirname, "../", "public", "avatars");

const register = async (res, req) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    throw HttpErrors(409, "Email in use");
  }

  const hashPassword = await bcrypt.hash(password, 10);

  const avatarURL = gravatar.url(email);

  const verificationToken = uuidv4();

  const newUser = await User.create({
    email,
    password: hashPassword,
    avatarURL,
  });

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="${BASE_URL}/api/auth/verify/${verificationToken}">Verify email</a>`,
  };

  await sendEmail(verifyEmail);

  res.status(201).json({
    user: newUser,
  });
};

const verifyEmail = async (req, res) => {
  const { verificationToken } = req.params;
  const user = await User.findOne({ verificationToken });
  if (!user) {
    throw HttpErrors(
      res,
      404,
      "User nor found or verification has already been passed"
    );
  }

  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationToken: null,
  });

  res.json({
    message: "Verification successful",
  });
};

const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!email) {
    return HttpErrors(res, 400, "Missing required field email");
  }
  if (!user) {
    return HttpErrors(res, 401, "User not found");
  }
  if (user.verify) {
    return HttpErrors(res, 400, "Verification has already been passed");
  }

  const verifyEmail = {
    to: email,
    subject: "Verify email",
    html: `<a target="_blank" href="${BASE_URL}/api/auth/verify/${user.verificationToken}">Click verify email</a>`,
  };

  await sendEmail(verifyEmail);

  res.json({
    message: "Verification email sent",
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpErrors(401, "Email or password is incorrect");
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpErrors(401, "Email or password is incorrect");
  }

  if (!user.verify) {
    return HttpErrors(res, 401, "User nor verified");
  }
  const payload = {
    id: user._id,
  };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });

  await User.findByIdAndUpdate(user._id, { token });

  res.json({
    token,
    user: {
      email: user.email,
      subscription: user.subscription,
    },
  });
};

const getCurrent = async (req, res) => {
  const { email, subscription } = req.user;
  res.json({
    email,
    subscription,
  });
};

const logout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });
  res.status(204).json({
    message: "",
  });
};

const updateSubscription = async (req, res) => {
  const { _id } = req.user;
  const result = await User.findByIdAndUpdate(_id, req.body, { new: true });
  if (!result) {
    throw HttpErrors(404, "Nor found");
  }

  res.json({
    user: {
      email: result.email,
      subscription: result.subscription,
    },
  });
};

const updateAvatar = async (req, res) => {
  const { id } = req.user;
  const { path: tempPath, originalname } = req.file;
  const fileName = `xs_${id}_${originalname}`;
  const resultUpload = path.join(avatarsDir, fileName);
  await Jimp.read(resultUpload)
    .then((img) => {
      return img.resize(250, Jimp.AUTO).writeAsync(resultUpload);
    })
    .catch((e) => console.log(e));
  await fs.rename(tempPath, resultUpload);
  const avatarURL = path.join("avatars", fileName);
  await User.findByIdAndUpdate(id, { avatarURL });

  res.json({
    avatarURL,
  });
};

module.exports = {
  register: CtrlWrapper(register),
  login: CtrlWrapper(login),
  getCurrent: CtrlWrapper(getCurrent),
  logout: CtrlWrapper(logout),
  updateSubscription: CtrlWrapper(updateSubscription),
  updateAvatar: CtrlWrapper(updateAvatar),
  verifyEmail: CtrlWrapper(verifyEmail),
  resendVerifyEmail: CtrlWrapper(resendVerifyEmail),
};
