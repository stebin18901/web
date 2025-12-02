import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

export default function PremiumWrapper({ children }) {
  const [isPremium, setIsPremium] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const user = auth.currentUser;
      if (!user) return setIsPremium(false);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().isPremium) {
        setIsPremium(true);
      } else {
        setIsPremium(false);
      }
    };
    fetchStatus();
  }, []);

  if (isPremium === null) return <p>Loading...</p>;

  return isPremium ? (
    children
  ) : (
    <div className="non-premium-message">
      <h2>Premium Required</h2>
      <p>Subscribe for ₹29/month to access this feature.</p>
      <a href="/pricing" className="btn">Upgrade Now</a>
    </div>
  );
}
