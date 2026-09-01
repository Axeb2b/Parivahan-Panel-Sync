import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth, signInWithCustomToken } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBPnv-sbBjTql8w0PcEOCGkBx41c5TC8bk",
  authDomain: "axexodiweb.firebaseapp.com",
  databaseURL: "https://axexodiweb-default-rtdb.firebaseio.com",
  projectId: "axexodiweb",
  storageBucket: "axexodiweb.firebasestorage.app",
  messagingSenderId: "389800586861",
  appId: "1:389800586861:android:bc07658134ed77dad59964",
};

// Only imported by lazy route chunks (device-detail, all-sms, otps, …) so the
// firebase SDK stays out of the main bundle. Primary RTDB reads are open-rule.
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

/** Sign the panel's Firebase SDK in with a server-minted custom token. */
export async function signInWithFirebaseToken(token?: string | null) {
  if (!token) return;
  try {
    await signInWithCustomToken(auth, token);
  } catch {
    /* ignore */
  }
}
