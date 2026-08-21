import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { useState } from "react";
import { createContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import { useEffect, useContext } from "react";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const [otpRequired, setOtpRequired] =
    useState(false);

  const [loginId, setLoginId] =
    useState(null);

  const [pendingEmail, setPendingEmail] =
    useState(null);

  const login = (userdata) => {
    setUser(userdata);

    localStorage.setItem(
      "user",
      JSON.stringify(userdata)
    );
  };

  const logout = async () => {
    setUser(null);

    setOtpRequired(false);
    setLoginId(null);
    setPendingEmail(null);

    localStorage.removeItem("user");

    try {
      await signOut(auth);
    } catch (error) {
      console.error(
        "Error during sign out:",
        error
      );
    }
  };

  const handlegooglesignin = async () => {
    try {
      const result =
        await signInWithPopup(
          auth,
          provider
        );

      const firebaseuser =
        result.user;

      const payload = {
        email: firebaseuser.email,
        name: firebaseuser.displayName,
        image:
          firebaseuser.photoURL ||
          "https://github.com/shadcn.png",
      };

      const response =
        await axiosInstance.post(
          "/user/login",
          payload
        );

      // New device/browser/IP detected
      if (response.data.otpRequired) {
        setOtpRequired(true);
        setLoginId(
          response.data.loginId
        );
        setPendingEmail(
          firebaseuser.email
        );

        return;
      }

      // Normal trusted login
      login(response.data.result);
    } catch (error) {
      console.error(error);
    }
  };

  const sendLoginOTP = async () => {
    try {
      if (
        !pendingEmail ||
        !loginId
      ) {
        return {
          success: false,
        };
      }

      const response =
        await axiosInstance.post(
          "/user/login/send-otp",
          {
            email: pendingEmail,
            loginId,
          }
        );

      return {
        success: true,
        message:
          response.data.message,
      };
    } catch (error) {
      console.error(
        "Send OTP error:",
        error
      );

      return {
        success: false,
        message:
          error.response?.data
            ?.message ||
          "Unable to send OTP",
      };
    }
  };

  const verifyLoginOTP = async (
    otp,
    rememberDevice = true
  ) => {
    try {
      if (
        !pendingEmail ||
        !loginId
      ) {
        return {
          success: false,
        };
      }

      const response =
        await axiosInstance.post(
          "/user/login/verify-otp",
          {
            email: pendingEmail,
            otp,
            loginId,
            rememberDevice,
          }
        );

      if (
        response.data.authenticated
      ) {
        login(response.data.result);

        setOtpRequired(false);
        setLoginId(null);
        setPendingEmail(null);

        return {
          success: true,
          message:
            response.data.message,
        };
      }

      return {
        success: false,
        message:
          "OTP verification failed",
      };
    } catch (error) {
      console.error(
        "Verify OTP error:",
        error
      );

      return {
        success: false,
        message:
          error.response?.data
            ?.message ||
          "Invalid OTP",
      };
    }
  };

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (firebaseuser) => {
          if (!firebaseuser) {
            return;
          }

          try {
            const payload = {
              email:
                firebaseuser.email,
              name:
                firebaseuser.displayName,
              image:
                firebaseuser.photoURL ||
                "https://github.com/shadcn.png",
            };

            const response =
              await axiosInstance.post(
                "/user/login",
                payload
              );

            // New device/browser/IP
            if (
              response.data.otpRequired
            ) {
              setOtpRequired(true);

              setLoginId(
                response.data.loginId
              );

              setPendingEmail(
                firebaseuser.email
              );

              return;
            }

            // Trusted login
            login(
              response.data.result
            );
          } catch (error) {
            console.error(error);

            await logout();
          }
        }
      );

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        login,
        logout,
        handlegooglesignin,

        otpRequired,
        loginId,
        pendingEmail,

        sendLoginOTP,
        verifyLoginOTP,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () =>
  useContext(UserContext);