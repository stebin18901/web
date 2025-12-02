import React, { useEffect, useState } from "react";
import { getQuizzes } from "../firebase/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";

const QuizSlider = ({ subject }) => {
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const q = query(collection(db, "quizzes"), where("subject", "==", subject));
      const querySnapshot = await getDocs(q);
      const quizList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(quizList);
    };
    fetchQuizzes();
  }, [subject]);

  const settings = {
    dots: true,
    infinite: false,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: 2 } },
      { breakpoint: 768, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <div className="quiz-slider">
      <h2>{subject}</h2>
      <Slider {...settings}>
        {quizzes.map(quiz => (
          <div key={quiz.id} className="quiz-card">
            <img src={quiz.image} alt={quiz.title} />
            <h3>{quiz.title}</h3>
            <p>{quiz.description}</p>
            <a href={quiz.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Play Now
            </a>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default QuizSlider;
