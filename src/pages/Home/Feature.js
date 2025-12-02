import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import styles from "./Feature.module.css";
import { FaCheckCircle } from "react-icons/fa";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";

const useAutoPlay = (activeIndex, setActiveIndex, slideCount, interval = 5000) => {
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slideCount);
    }, interval);
    return () => clearInterval(timer);
  }, [activeIndex, setActiveIndex, slideCount, interval]);
};

const Feature = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const sliderRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const db = getFirestore();
        const featuresCollection = collection(db, "features");
        const snapshot = await getDocs(featuresCollection);
        const featuresData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeatures(featuresData);
      } catch (err) {
        console.error("Error fetching features:", err);
        setError("Failed to load features");
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  useAutoPlay(activeIndex, setActiveIndex, features.length, 5000);

  const goToSlide = (index) => {
    setActiveIndex(index);
  };

  const goToPrev = () => {
    setActiveIndex((prev) => (prev === 0 ? features.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % features.length);
  };

  const handleLearnMore = (featureId) => {
    navigate(`/features/${featureId}`);
  };

  if (loading) return <div className={styles.loading}>Loading features...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (features.length === 0) return <div className={styles.empty}>No features available</div>;

  return (
    <section className={styles.featuresSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.titleDecor}>Our Programs</span>
        </h2>
        <p className={styles.sectionSubtitle}>
          Innovative features designed to maximize learning outcomes
        </p>
      </div>

      <div 
        className={styles.sliderContainer}
        ref={sliderRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={styles.sliderTrack} style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {features.map((feature, index) => (
            <div key={feature.id} className={styles.slide}>
              <div 
                className={styles.featureCard}
                style={{ '--accent-color': feature.color || "#4a6bff" }}
              >
                <div className={styles.featureImageContainer}>
                  <img
                    src={feature.image}
                    alt={feature.title}
                    className={styles.featureImage}
                    loading="lazy"
                  />
                  <div className={styles.imageOverlay} />
                </div>
                <div className={styles.featureContent}>
                  <div className={styles.featureBadge}>
                    <FaCheckCircle className={styles.featureIcon} />
                    <span>Featured</span>
                  </div>
                  <h3a>{feature.title}</h3a>
                  <div className={styles.descriptionContainer}>
                    <p>{feature.description}</p>
                  </div>
                  <button 
                    className={styles.learnMoreBtn}
                    onClick={() => handleLearnMore(feature.id)}
                  >
                    <span>Learn More</span>
                    <div className={styles.btnHoverEffect} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {features.length > 1 && (
          <>
            <button 
              className={styles.sliderArrowLeft} 
              onClick={goToPrev}
              aria-label="Previous slide"
            >
              <FiArrowLeft />
              <span className={styles.arrowHoverEffect} />
            </button>
            <button 
              className={styles.sliderArrowRight} 
              onClick={goToNext}
              aria-label="Next slide"
            >
              <FiArrowRight />
              <span className={styles.arrowHoverEffect} />
            </button>
          </>
        )}
      </div>
    </section>
  );
};

export default Feature;