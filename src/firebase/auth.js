import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { app, db } from "./firebaseConfig";
import { doc, setDoc, getDoc } from "firebase/firestore";

const auth = getAuth(app);

// 🟢 Sign up function
export const signUp = async (email, password, name, schoolId, selectedClass, userType) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Default new user document
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      name: name,
      schoolId: userType === "school" ? schoolId : null,
      class: selectedClass,
      role: "student",
      userType: userType,
      membership: "free",
      isPremium: false,              // 🔹 New field
      subscriptionId: null,          // 🔹 Razorpay subscription ID
      planId: null,                  // 🔹 Plan reference
      expiresAt: null,               // 🔹 Optional expiry date
      createdAt: new Date().toISOString(),
    });

    return user;
  } catch (error) {
    throw error;
  }
};

// 🟢 Login function
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Optional: check subscription status (if needed)
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().isPremium) {
      console.log("Premium User Logged In");
    }

    return user;
  } catch (error) {
    throw error;
  }
};

// 🟢 Logout function
export const logout = () => signOut(auth);

export { auth };
