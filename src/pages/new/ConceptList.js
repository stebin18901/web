import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import "./ConceptList.css";
import QuizBanner from "../../components/QuizBanner";

const ConceptList = () => {
  const { user } = useAuth();
  const { subject } = useParams();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [conceptsByChapter, setConceptsByChapter] = useState({});
  const [completedReports, setCompletedReports] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const makeSafeFirestoreId = (str) => encodeURIComponent(str);

  useEffect(() => {
    if (!user) return;
    const fetchUserProfile = async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) setUserData(userSnap.data());
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    };
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (!userData) return;
    const fetchConcepts = async () => {
      try {
        const quizSnapshot = await getDocs(collection(db, "quizzes"));
        const chapterMap = {};
        const reportKeysToCheck = [];

        quizSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const metadata = data.metadata;
          if (
            metadata?.subject === subject &&
            metadata?.class?.toString() === userData.class?.toString()
          ) {
            const chapter = metadata.chapter;
            const conceptItem = {
              quizId: docSnap.id,
              concept: metadata.concept,
              questions: data.questions || [],
            };
            const safeConcept = makeSafeFirestoreId(metadata.concept);
            const reportKey = `${user.uid}_${docSnap.id}_${safeConcept}`;
            reportKeysToCheck.push(reportKey);

            if (!chapterMap[chapter]) chapterMap[chapter] = [];
            chapterMap[chapter].push(conceptItem);
          }
        });

        const reportMap = {};
        await Promise.all(
          reportKeysToCheck.map(async (key) => {
            const reportRef = doc(db, "reports", key);
            const reportSnap = await getDoc(reportRef);
            if (reportSnap.exists()) reportMap[key] = true;
          })
        );

        setConceptsByChapter(chapterMap);
        setCompletedReports(reportMap);
      } catch (err) {
        console.error("Error fetching concepts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConcepts();
  }, [userData, subject, user]);

  if (loading) return <p className="loading-text">Loading concepts...</p>;
  if (!userData) return <p className="loading-text">Loading user profile...</p>;

  const filterConcepts = (concepts) =>
    concepts.filter((c) =>
      c.concept.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="concept-container">
      
        <QuizBanner/>
      
      
      <h2 className="subject-title">{subject} – Concepts</h2>

      <input
        type="text"
        placeholder="Search concept..."
        className="search-box"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {Object.keys(conceptsByChapter).length === 0 ? (
        <p className="no-concepts">No concepts found for your class and subject.</p>
      ) : (
        Object.entries(conceptsByChapter).map(([chapterName, concepts], idx) => (
          <div key={idx} className="chapter-section">
            <h3 className="chapter-title">
              Chapter {idx + 1}: {chapterName}
            </h3>
            <div className="concept-grid">
              {filterConcepts(concepts).map((conceptItem, cidx) => {
                const safeConcept = makeSafeFirestoreId(conceptItem.concept);
                const reportId = `${user.uid}_${conceptItem.quizId}_${safeConcept}`;
                const completed = completedReports[reportId];

                return (
                  <div key={cidx} className="concept-card">
                    <h4 className="concept-name">{conceptItem.concept}</h4>
                    <div className="concept-footer">
                      <span
                        className={`badge ${completed ? "badge-completed" : "badge-pending"}`}
                      >
                        {completed ? "Completed" : "Pending"}
                      </span>
                      <button
                        className={`concept-button ${completed ? "completed" : "test"}`}
                        onClick={() =>
                          navigate(
                            completed
                              ? `/reportcard/${conceptItem.quizId}/${safeConcept}`
                              : `/quiz/${conceptItem.quizId}/${safeConcept}`
                          )
                        }
                      >
                        {completed ? "See Report" : "Take Quiz"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ConceptList;
