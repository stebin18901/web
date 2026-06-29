import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export const DEMO_CONTENT_COLLECTION = "publicContent";
export const DEMO_CONTENT_DOC = "studentDemo";

export const getDemoContentRef = () =>
  doc(db, DEMO_CONTENT_COLLECTION, DEMO_CONTENT_DOC);

export const fetchDemoContent = async () => {
  const snap = await getDoc(getDemoContentRef());
  if (!snap.exists()) {
    return {
      title: "Demo",
      html: "",
      updatedAt: "",
    };
  }

  const data = snap.data();
  return {
    title: String(data.title || "Demo").trim() || "Demo",
    html: String(data.html || ""),
    updatedAt: String(data.updatedAt || ""),
  };
};
