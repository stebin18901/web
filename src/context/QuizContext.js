// context/QuizContext.js
import { createContext, useContext, useState, useEffect } from "react";
import { getQuizzes } from "../firebase/firestore";

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch quizzes from Firestore
    const fetchData = async () => {
      try {
        const quizData = await getQuizzes();
        setQuizzes(quizData);
      } catch (error) {
        console.error("Error fetching quizzes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <QuizContext.Provider value={{ quizzes, loading }}>
      {children}
    </QuizContext.Provider>
  );
};

// Custom Hook to use QuizContext
export const useQuiz = () => useContext(QuizContext);
