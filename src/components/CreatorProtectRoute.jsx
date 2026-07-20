import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function CreatorProtectRoute({ element }) {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!user?.uid) {
        if (active) setStatus("unauthenticated");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!active) return;

        if (snap.exists() && String(snap.data().role || "").toLowerCase() === "creator") {
          setStatus("authorized");
          return;
        }

        setStatus("forbidden");
      } catch {
        if (active) setStatus("forbidden");
      }
    };

    verify();
    return () => {
      active = false;
    };
  }, [user]);

  if (status === "checking") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f7fb" }}>
        <div style={{ padding: "18px 22px", borderRadius: "18px", background: "rgba(255,255,255,0.92)", border: "1px solid rgba(20,200,161,0.14)", color: "#31425d", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700 }}>
          Checking creator access...
        </div>
      </div>
    );
  }

  if (status !== "authorized") {
    const params = new URLSearchParams();
    params.set("next", location.pathname || "/creator");
    if (status === "forbidden") {
      params.set("mode", "unauthorized");
    }
    return <Navigate to={`/creator-login?${params.toString()}`} replace />;
  }

  return element;
}
