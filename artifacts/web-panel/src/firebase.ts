import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBPnv-sbBjTql8w0PcEOCGkBx41c5TC8bk",
  authDomain: "axexodiweb.firebaseapp.com",
  databaseURL: "https://axexodiweb-default-rtdb.firebaseio.com",
  projectId: "axexodiweb",
  storageBucket: "axexodiweb.firebasestorage.app",
  messagingSenderId: "389800586861",
  appId: "1:389800586861:android:bc07658134ed77dad59964",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);