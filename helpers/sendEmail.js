const nodemailer = require("nodemailer");
require("dotenv").config();

const config = {
  host: "smtp.meta.ua",
  port: 465,
  secure: true,
  auth: {
    user: process.env.META_EMAIL,
    pass: process.env.META_PASSWORD,
  },
};

const transporter = nodemailer.createTransport(config);

const sendEmail = async (data) => {
  const email = { ...data, from: "doubleakop@meta.ua" };
  await transporter
    .sendMail(email)
    .then((info) => console.log(info))
    .catch((error) => console.log(error));
  return true;
};

module.exports = sendEmail;
