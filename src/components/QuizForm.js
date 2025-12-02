import React, { useState } from "react";
import { addQuiz } from "../firebase/firestore";

const subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "Social Studies"];

const QuizForm = ({ refreshQuizzes }) => {
  const [quiz, setQuiz] = useState({
    title: "",
    description: "",
    image: "",
    googleFormLink: "",
    subject: "Mathematics",
    class: "6",
  });

  const handleChange = (e) => {
    setQuiz({ ...quiz, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addQuiz(quiz);
    refreshQuizzes(); // Refresh the quiz list
    setQuiz({ title: "", description: "", image: "", googleFormLink: "", subject: "Mathematics", class: "6" });
  };

  return (
    <form onSubmit={handleSubmit} className="quiz-form">
      <h2>Create a Quiz</h2>
      <input type="text" name="title" placeholder="Quiz Title" value={quiz.title} onChange={handleChange} required />
      <textarea name="description" placeholder="Description" value={quiz.description} onChange={handleChange} required />
      <input type="text" name="image" placeholder="Image URL" value={quiz.image} onChange={handleChange} required />
      <input type="url" name="googleFormLink" placeholder="Google Form Link" value={quiz.googleFormLink} onChange={handleChange} required />
      
      <select name="subject" value={quiz.subject} onChange={handleChange}>
        {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
      </select>

      <select name="class" value={quiz.class} onChange={handleChange}>
        {[6, 7, 8, 9].map((cls) => <option key={cls} value={cls}>Class {cls}</option>)}
      </select>

      <button type="submit">Add Quiz</button>
    </form>
  );
};

export default QuizForm;
