import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";


const firebaseConfig = {
  apiKey: "AIzaSyBQsaWdnRS3g8s7PtGym3pZzfgGFWOsqQM",
  authDomain: "dreamprojects-cda5b.firebaseapp.com",
  projectId: "dreamprojects-cda5b",
  storageBucket: "dreamprojects-cda5b.appspot.com",
  messagingSenderId: "1073238502278",
  appId: "1:1073238502278:web:14d03032e8cf4093ed9a07",
  measurementId: "G-BF0LDLJCJ4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.settings.appVerificationDisabledForTesting = false;
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, app, storage, functions };
