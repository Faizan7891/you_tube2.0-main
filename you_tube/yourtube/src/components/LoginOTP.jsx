import { useState } from "react";
import { useUser } from "@/lib/AuthContext";

const LoginOTP = () => {
  const {
    otpRequired,
    pendingEmail,
    sendLoginOTP,
    verifyLoginOTP,
  } = useUser();

  const [otp, setOtp] = useState("");
  const [rememberDevice, setRememberDevice] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [verifying, setVerifying] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  if (!otpRequired) {
    return null;
  }

  const handleSendOTP = async () => {
    setSending(true);
    setError("");
    setMessage("");

    const result =
      await sendLoginOTP();

    if (result.success) {
      setMessage(
        "OTP sent to your registered email."
      );
    } else {
      setError(
        result.message ||
          "Unable to send OTP."
      );
    }

    setSending(false);
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError(
        "Please enter the 6-digit OTP."
      );
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");

    const result =
      await verifyLoginOTP(
        otp,
        rememberDevice
      );

    if (!result.success) {
      setError(
        result.message ||
          "Invalid OTP."
      );
    }

    setVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

        <h2 className="text-2xl font-bold">
          Verify Your Login
        </h2>

        <p className="mt-2 text-sm text-gray-600">
          We detected a login from a new
          browser, device, IP address, or
          location.
        </p>

        <p className="mt-3 text-sm">
          OTP will be sent to:
        </p>

        <p className="font-semibold">
          {pendingEmail}
        </p>

        {/* SEND OTP */}

        <button
          onClick={handleSendOTP}
          disabled={sending}
          className="mt-5 w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
        >
          {sending
            ? "Sending..."
            : "Send OTP"}
        </button>

        {/* OTP */}

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit OTP"
          value={otp}
          onChange={(e) =>
            setOtp(
              e.target.value.replace(
                /\D/g,
                ""
              )
            )
          }
          className="mt-4 w-full rounded-lg border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-black"
        />

        {/* TRUST DEVICE */}

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) =>
              setRememberDevice(
                e.target.checked
              )
            }
          />

          Trust this device for 30 days
        </label>

        {/* VERIFY */}

        <button
          onClick={handleVerify}
          disabled={
            verifying ||
            otp.length !== 6
          }
          className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
        >
          {verifying
            ? "Verifying..."
            : "Verify OTP"}
        </button>

        {/* MESSAGE */}

        {message && (
          <p className="mt-4 text-center text-sm text-green-600">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-red-600">
            {error}
          </p>
        )}

      </div>
    </div>
  );
};

export default LoginOTP;