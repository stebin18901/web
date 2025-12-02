// firebase/firestore.js
import { db, storage } from "./firebaseConfig";
import { collection, addDoc, getDocs, deleteDoc, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const quizCollection = collection(db, "quizzes");

// Add a new quiz
export const addQuiz = async (quizData) => {
  await addDoc(quizCollection, quizData);
};

// Fetch all quizzes
export const getQuizzes = async () => {
  const querySnapshot = await getDocs(quizCollection);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Delete a quiz
export const deleteQuiz = async (quizId) => {
  await deleteDoc(doc(db, "quizzes", quizId));
};

// Update Leaderboard
export const updateLeaderboard = async (userId, score) => {
  try {
    const leaderboardRef = doc(db, "leaderboard", userId);
    await setDoc(leaderboardRef, { score }, { merge: true });
  } catch (error) {
    throw error;
  }
};

// ✅ Upload PDF & Get Download URL
export const uploadPdf = async (file) => {
  const storageRef = ref(storage, `notes/${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// ✅ Add Chapter to Firestore
export const addChapter = async (subject, chapterData) => {
  await addDoc(collection(db, `subjects/${subject}/chapters`), chapterData);
};

