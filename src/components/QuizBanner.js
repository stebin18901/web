import React from "react";
import { motion } from "framer-motion";

const sentence = "Hi there! Our quiz questions will improve over time with your feedback.";

const textAnimation = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { delay: 0.2, staggerChildren: 0.03 },
  },
};

const letterAnimation = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
};

const QuizBanner = () => {
  return (
    <div className="Banner">
      <img src="/images/boy_attitude.png" alt="Boy" />
      <motion.div
        className="speech-bubble"
        variants={textAnimation}
        initial="hidden"
        animate="visible"
      >
        {sentence.split("").map((char, idx) => (
          <motion.span key={idx} variants={letterAnimation}>
            {char}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};

export default QuizBanner;
