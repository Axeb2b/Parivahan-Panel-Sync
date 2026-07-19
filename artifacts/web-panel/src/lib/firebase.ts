import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCfshhdQYfhB1nGB74Yaqresr7yGQ57ZcQ",
  authDomain: "yellowstone-7a62e.firebaseapp.com",
  databaseURL: "https://yellowstone-7a62e-default-rtdb.firebaseio.com",
  projectId: "yellowstone-7a62e",
  storageBucket: "yellowstone-7a62e.firebasestorage.app",
  messagingSenderId: "313862509745",
  appId: "1:313862509745:android:354ac65391fc8561683e90",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
