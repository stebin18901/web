// context/LeaderboardContext.js
import { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

const LeaderboardContext = createContext();

export const LeaderboardProvider = ({ children }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch leaderboard from Firestore
    const fetchLeaderboard = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "leaderboard"));
        const leaderboardData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLeaderboard(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <LeaderboardContext.Provider value={{ leaderboard, loading }}>
      {children}
    </LeaderboardContext.Provider>
  );
};

// Custom Hook to use LeaderboardContext
export const useLeaderboard = () => useContext(LeaderboardContext);
