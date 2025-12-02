import React, { useState } from "react";
import "./Story.css"; // Import your custom styles

const stories = [
  { id: 1, title: "Math Basics", image: "images/Gemini_Generated_Image_8g4eju8g4eju8g4e.jpeg", questions: [
    { id: 1, question: "What is 12 × 4?", options: ["24", "36", "48", "52"], correct: 2 },
    { id: 2, question: "What is 5 + 7?", options: ["10", "12", "15", "18"], correct: 1 }
  ]},
  { id: 2, title: "Science Quiz", image: "images/aa.jpg", questions: [
    { id: 1, question: "What is H2O commonly known as?", options: ["Oxygen", "Water", "Hydrogen", "Carbon"], correct: 1 },
  ]},
];

const Story = () => {
  const [currentStory, setCurrentStory] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState({});

  const handleStoryClick = (story) => {
    setCurrentStory(story);
    setCurrentQuestion(0);
  };

  const handleAnswer = (questionId, optionIndex) => {
    setResponses((prev) => ({
      ...prev,
      [`${currentStory.id}-${questionId}`]: optionIndex,
    }));
    if (currentQuestion < currentStory.questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      setCurrentStory(null); // Close story after last question
    }
  };

  const renderHomePage = () => (
    <div className="stories-container">
      {stories.map((story) => (
        <div
          key={story.id}
          className="story-card"
          style={{ backgroundImage: `url(${story.image})` }}
          onClick={() => handleStoryClick(story)}
        >
          <h3>{story.title}</h3>
        </div>
      ))}
    </div>
  );

  const renderStoryView = () => {
    const question = currentStory.questions[currentQuestion];
    return (
      <div className="story-view">
        <h2>{question.question}</h2>
        <div className="options-container">
          {question.options.map((option, index) => (
            <button
              key={index}
              className="option-button"
              onClick={() => handleAnswer(question.id, index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {currentStory ? renderStoryView() : renderHomePage()}
    </div>
  );
};

export default Story;
