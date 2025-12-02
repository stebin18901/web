import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import styles from "./FeatureDetails.module.css";
import { FaArrowLeft, FaCheckCircle } from "react-icons/fa";

const FeatureDetails = () => {
  const { featureId } = useParams();
  const navigate = useNavigate();
  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeature = async () => {
      try {
        const db = getFirestore();
        const featureRef = doc(db, "features", featureId);
        const docSnap = await getDoc(featureRef);

        if (docSnap.exists()) {
          setFeature({
            id: docSnap.id,
            ...docSnap.data()
          });
        } else {
          setError("Feature not found");
        }
      } catch (err) {
        console.error("Error fetching feature:", err);
        setError("Failed to load feature details");
      } finally {
        setLoading(false);
      }
    };

    fetchFeature();
  }, [featureId]);

  if (loading) return <div className={styles.loading}>Loading feature details...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!feature) return <div className={styles.empty}>Feature not available</div>;

  return (
    <div className={styles.featureDetailsContainer}>
      <button 
        className={styles.backButton}
        onClick={() => navigate(-1)}
      >
        <FaArrowLeft /> Back to Home
      </button>

      <div className={styles.featureHeader}>
        <h1>{feature.title}</h1>
        <div className={styles.featureMeta}>
          <span className={styles.featureBadge}>
            <FaCheckCircle /> Featured
          </span>
        </div>
      </div>

      <div className={styles.featureContent}>
        <div className={styles.featureImageWrapper}>
          <img
            src={feature.image}
            alt={feature.title}
            className={styles.featureImage}
          />
        </div>

        <div className={styles.featureDescription}>
          <h2>About This Feature</h2>
          <div 
            className={styles.htmlContent}
            dangerouslySetInnerHTML={{ __html: feature.blogHtml }}
          />

          {feature.benefits && (
            <div className={styles.benefitsSection}>
              <h3>Key Benefits</h3>
              <ul>
                {feature.benefits.map((benefit, index) => (
                  <li key={index}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureDetails;