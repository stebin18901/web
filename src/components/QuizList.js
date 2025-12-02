import React, { useEffect, useState } from "react";
import { getQuizzes, deleteQuiz } from "../firebase/firestore";

const QuizList = ({ refreshKey }) => {
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const quizData = await getQuizzes();
      setQuizzes(quizData);
    };
    fetchQuizzes();
  }, [refreshKey]);

  return (
    <div className="quiz-list">
      <h2>Existing Quizzes</h2>
      {quizzes.length === 0 ? <p>No quizzes available.</p> : quizzes.map((quiz) => (
        <div key={quiz.id} className="quiz-item">
          <img src={quiz.image} alt={quiz.title} />
          <div>
            <h3>{quiz.title}</h3>
            <p>{quiz.description}</p>
            <p><strong>Subject:</strong> {quiz.subject} | <strong>Class:</strong> {quiz.class}</p>
            <a href={quiz.googleFormLink} target="_blank" rel="noopener noreferrer">Take Quiz</a>
            <button onClick={() => deleteQuiz(quiz.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuizList;
