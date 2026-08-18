import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBXy66jAMpbiDYi2-qt1QUvdqZ5AoU0WcY",
  authDomain: "development-be3e1.firebaseapp.com",
  projectId: "development-be3e1",
  storageBucket: "development-be3e1.firebasestorage.app",
  messagingSenderId: "698859961722",
  appId: "1:698859961722:web:c2e9a13c7fc923a42deac3",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider };