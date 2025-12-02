import { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import "./NewsFeed.css";

const NewsFeed = () => {
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch user details and create personalized news
  useEffect(() => {
    const fetchNews = async () => {
      if (!user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();

          const dynamicNews = [
  {
    user: "Career Update",
    message: `${userData.name} has begun a new learning journey in Class ${userData.class}. A strong foundation is expected to shape future achievements.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Progress Report",
    message: `${userData.name} is steadily preparing for upcoming quizzes. Consistent practice is building momentum day by day.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Leaderboard Watch",
    message: `${userData.name} is in pursuit of higher ranks on the class leaderboard. The competition remains close among peers.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Skill Development",
    message: `${userData.name} is focusing on strengthening key concepts. Recent practice sessions indicate steady improvement.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Achievement Tracker",
    message: `${userData.name} is on track to complete this week’s quiz goals. A milestone badge could be earned soon.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Performance Insight",
    message: `Initial results show ${userData.name} is developing accuracy and speed. Upcoming challenges will test consistency.`,
    createdAt: new Date().toLocaleString(),
  },
  {
    user: "Class Challenge",
    message: `${userData.name} has entered this week’s class-wide challenge. Steady performance could secure a top position.`,
    createdAt: new Date().toLocaleString(),
  },
];


          setNews(dynamicNews);
        }
      } catch (error) {
        console.error("Error fetching user news:", error);
      }
    };

    fetchNews();
  }, [user]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % news.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + news.length) % news.length);
  };

  if (news.length === 0) return null;

  return (
    <div className="news-feed-container">
      <h2 className="news-feed-title">📰 Game News</h2>

      <div className="news-slider">
        <div className="news-card">
          <div className="news-content">
            <h3 className="news-user">{news[currentIndex].user}</h3>
            <p className="news-message">{news[currentIndex].message}</p>
            <span className="news-time">{news[currentIndex].createdAt}</span>
          </div>
          <button className="slider-btn left" onClick={prevSlide}>
            ⬅
          </button>
          <button className="slider-btn right" onClick={nextSlide}>
            ➡
          </button>
        </div>
      </div>

      <div className="slider-dots">
        {news.map((_, index) => (
          <span
            key={index}
            className={`dot ${index === currentIndex ? "active" : ""}`}
            onClick={() => setCurrentIndex(index)}
          ></span>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
