import "./Subjects.css";
import SubjectList from "../pages/new/SubjectList";
import BannerList from "./Front/BannerList";
import Calendar from "./Calendar";
import NewsFeed from "../pages/new/NewsFeed";

const Subjects = () => {
  const banners = [
    {
      imageUrl: process.env.PUBLIC_URL + "/images/subwall.png",
      title: "Mathematics Quest",
      description: "Sharpen your math skills through fun challenges!",
      buttonText: "Start Now",
      onButtonClick: () => alert("Math coming soon 🚀")
    },
    {
      imageUrl: process.env.PUBLIC_URL + "/images/interact.webp",
      title: "Science Adventures",
      description: "Explore physics, chemistry, and more!",
      buttonText: "Explore",
      onButtonClick: () => alert("Science coming soon 🔬")
    },
    {
      imageUrl: process.env.PUBLIC_URL + "/images/battle.webp",
      title: "Coding Arena",
      description: "Learn coding with interactive problems.",
      buttonText: "Enter Arena",
      onButtonClick: () => alert("Coding arena soon 💻")
    }
  ];

  return (
    <div className="subjects-container">
      {/* LEFT SIDE - CALENDAR + BANNERS */}
      <div className="left-section">
        <div className="calendar-wrapper">
          <Calendar />
        </div>
        <div className="banner-wrapper">
          <NewsFeed />
        </div>
      </div>

      {/* RIGHT SIDE - SUBJECT LIST */}
      <aside className="right-section">
        <SubjectList />
      </aside>
    </div>
  );
};

export default Subjects;
