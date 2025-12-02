// src/pages/SubjectQuizPage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getQuizzes } from "../firebase/firestore";
import QuizCard from "../components/QuizCard";
import './SubjectQuizPage.css'

const SubjectQuizPage = () => {
  const { subject } = useParams();
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const allQuizzes = await getQuizzes();
      setQuizzes(allQuizzes.filter((quiz) => quiz.category === subject));
    };
    fetchQuizzes();
  }, [subject]);

  return (
    <div className="container">
      <h1>{subject} Quizzes</h1>
      <div className="quiz-grid">
        {quizzes.length > 0 ? quizzes.map((quiz) => <QuizCard key={quiz.id} {...quiz} />) : <p>No quizzes available</p>}
      </div>
    </div>
  );
};

export default SubjectQuizPage;
