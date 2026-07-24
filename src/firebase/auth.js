import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
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
export const login = async (emailOrPayload, password, options = {}) => {
  try {
    let email = "";
    let loginPassword = "";
    let authType = options.authType || "standard";
    let schoolId = options.schoolId || "";

    if (typeof emailOrPayload === "object" && emailOrPayload !== null) {
      const payload = emailOrPayload;
      email = String(payload.email || "").trim();
      loginPassword = String(payload.password || "").trim();
      authType = payload.authType || authType;
      schoolId = String(payload.schoolId || "").trim();
    } else {
      email = String(emailOrPayload || "").trim();
      loginPassword = String(password || "").trim();
    }

    if (!email || !loginPassword) {
      throw new Error("Email and password are required.");
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, loginPassword);
    const user = userCredential.user;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    const existingData = userDoc.exists() ? userDoc.data() : {};
    const normalizedSchoolId = schoolId || String(existingData.schoolId || "").trim() || null;

    await setDoc(
      userDocRef,
      {
        email: user.email,
        authType,
        schoolId: normalizedSchoolId,
        updatedAt: new Date().toISOString(),
        ...(userDoc.exists()
          ? {}
          : {
              name: user.displayName || "",
              role: "student",
              membership: "free",
              isPremium: false,
              subscriptionId: null,
              planId: null,
              expiresAt: null,
              createdAt: new Date().toISOString(),
            }),
      },
      { merge: true }
    );

    return {
      uid: user.uid,
      email: user.email,
      authType,
      schoolId: normalizedSchoolId,
      user,
    };
  } catch (error) {
    throw error;
  }
};

export const loginWithGoogle = async (authType = "standard") => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");

    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    const existingData = userDoc.exists() ? userDoc.data() : {};

    await setDoc(
      userDocRef,
      {
        email: user.email,
        authType,
        schoolId: existingData.schoolId || null,
        updatedAt: new Date().toISOString(),
        ...(userDoc.exists()
          ? {}
          : {
              name: user.displayName || "",
              role: "student",
              membership: "free",
              isPremium: false,
              subscriptionId: null,
              planId: null,
              expiresAt: null,
              createdAt: new Date().toISOString(),
            }),
      },
      { merge: true }
    );

    return {
      uid: user.uid,
      email: user.email,
      authType,
      schoolId: existingData.schoolId || null,
      user,
    };
  } catch (error) {
    throw error;
  }
};

// 🟢 Logout function
export const logout = () => signOut(auth);

export { auth };
