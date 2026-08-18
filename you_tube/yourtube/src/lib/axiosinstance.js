import axios from "axios";
import { auth } from "./firebase";

const axiosInstance = axios.create({
  baseURL: process.env.BACKEND_URL,
});

axiosInstance.interceptors.request.use(async (config) => {
  const firebaseUser = auth.currentUser;

  if (firebaseUser) {
    const token = await firebaseUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default axiosInstance;