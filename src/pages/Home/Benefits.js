// Benefits.js
import React, { useState } from 'react';
import { FaCheckCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import styles from './Benefits.module.css';

const benefitsData = [
  {
    title: "Personalized learning paths",
    details: "Our intelligent algorithm analyzes your strengths and weaknesses to create a custom curriculum, ensuring you focus on what matters most for your growth."
  },
  {
    title: "Interactive and engaging content",
    details: "Beyond static videos, our platform includes quizzes, interactive exercises, and real-time simulations to make learning an active and memorable experience."
  },
  {
    title: "Expert instructors",
    details: "Learn from industry professionals with years of real-world experience. They don't just teach the theory; they share practical insights you can apply immediately."
  },
  {
    title: "Flexible schedules",
    details: "Your education should fit your life, not the other way around. Access all materials 24/7 and learn at a pace that's comfortable for you, from anywhere in the world."
  },
  {
    title: "Progress tracking and analytics",
    details: "Stay motivated and on track with a dashboard that visualizes your progress. See your completion rates, quiz scores, and areas for improvement at a glance."
  },
  {
    title: "24/7 access to materials",
    details: "All course videos, readings, and exercises are available around the clock. Rewatch lessons, review concepts, and learn on your schedule without any restrictions."
  },
];

const Benefits = () => {
  const [openBenefit, setOpenBenefit] = useState(null);

  const handleToggle = (index) => {
    setOpenBenefit(openBenefit === index ? null : index);
  };

  return (
    <section className={styles.benefitsSection}>
      <div className={styles.benefitsContent}>
        <div className={styles.benefitsText}>
          <h2 className={styles.sectionTitle}>Transform Your Learning Experience</h2>
          <p>
            Our platform combines cutting-edge technology with proven
            educational methodologies to create an unparalleled learning
            journey.
          </p>
          <div className={styles.benefitsList}>
            {benefitsData.map((benefit, index) => (
              <div key={index} className={styles.benefitItem}>
                <div 
                  className={styles.benefitTitleContainer} 
                  onClick={() => handleToggle(index)}
                >
                  <div className={styles.benefitIcon}>
                    <FaCheckCircle />
                  </div>
                  <span className={styles.benefitTitle}>{benefit.title}</span>
                  <div className={styles.dropdownIcon}>
                    {openBenefit === index ? <FaChevronUp /> : <FaChevronDown />}
                  </div>
                </div>
                {openBenefit === index && (
                  <p className={styles.benefitDetails}>{benefit.details}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.benefitsImage}>
          <img
            src="/images/loginPage.png"
            alt="Learning benefits"
            className={styles.benefitsImg}
          />
        </div>
      </div>
    </section>
  );
};

export default Benefits;