import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

export const sendSubscriptionEmail = async ({
  email,
  plan,
  validity,
  amount,
  currency,
  paymentId,
  orderId,
  invoiceNumber,
  startDate,
  expiryDate,
}) => {
  const mailOptions = {
    from: `"YourTube" <${process.env.EMAIL_USER}>`,
    to: email,

    subject: `YourTube Subscription Confirmed - ${plan}`,

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

        <h2>YourTube Subscription Confirmed</h2>

        <p>
          Your payment was successfully verified and your subscription
          has been activated.
        </p>

        <hr />

        <h3>Subscription Details</h3>

        <p><strong>Plan:</strong> ${plan}</p>
        <p><strong>Validity:</strong> ${validity}</p>
        <p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString()}</p>
        <p><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>

        <h3>Payment Details</h3>

        <p><strong>Amount:</strong> ${currency} ${amount}</p>
        <p><strong>Payment ID:</strong> ${paymentId}</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p><strong>Payment Status:</strong> Paid</p>

        <hr />

        <p>
          Thank you for subscribing to YourTube.
        </p>

        <p>
          If you need support, please contact our support team.
        </p>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendLoginOTPEmail = async ({
  email,
  otp,
}) => {
  const mailOptions = {
    from: `"YourTube Security" <${process.env.EMAIL_USER}>`,
    to: email,

    subject: "YourTube Login Verification OTP",

    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">

        <h2>YourTube Login Verification</h2>

        <p>
          We detected a login from a new browser, device,
          IP address, or location.
        </p>

        <p>Your verification OTP is:</p>

        <div style="
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          padding: 15px;
          background: #f3f3f3;
          text-align: center;
        ">
          ${otp}
        </div>

        <p>
          This OTP will expire in 5 minutes.
        </p>

        <p>
          If you did not attempt to log in, please secure
          your account immediately.
        </p>

      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};