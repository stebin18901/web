// pages/QuizPage.js
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuiz } from "../context/QuizContext";

const QuizPage = () => {
  const { quizId } = useParams();
  const { quizzes } = useQuiz();
  const quiz = quizzes.find((q) => q.id === quizId);

  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  if (!quiz) return <p className="text-center text-red-500">Quiz not found</p>;

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = () => {
    console.log("Submitted Answers:", answers);
    setSubmitted(true);
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-4">{quiz.title}</h1>
      <p className="text-gray-600 mb-4">{quiz.description}</p>

      {quiz.questions.map((question, index) => (
        <div key={question.id} className="mb-4">
          <h2 className="text-lg font-semibold">
            {index + 1}. {question.text}
          </h2>
          <div className="mt-2">
            {question.options.map((option, i) => (
              <button
                key={i}
                className={`block w-full p-2 border rounded mb-2 ${
                  answers[question.id] === option ? "bg-blue-500 text-white" : "bg-white"
                }`}
                onClick={() => handleAnswer(question.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        className="bg-green-500 text-white px-4 py-2 rounded mt-4"
        onClick={handleSubmit}
        disabled={submitted}
      >
        {submitted ? "Submitted" : "Submit Answers"}
      </button>
    </div>
  );
};

export default QuizPage;
