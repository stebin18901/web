import { useState } from "react";
import Navbar from "../components/Navbar";
import styles from "./Home.module.css";

import BannerM from "./Home/BannerM";
import Feature from "./Home/Feature";
import Benefits from "./Home/Benefits";
import Pricing from "../components/Pricing";
import Footer from "./Home/Footer";

const Home = () => {
  const [activeTab, setActiveTab] = useState("banner");

  const renderContent = () => {
    switch (activeTab) {
      case "banner":
        return <BannerM />;
      case "feature":
        return <Feature />;
      case "benefits":
        return <Benefits />;
      case "pricing":
        return <Pricing />;
     
      case "footer":
        return <Footer />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.mainContainer}>
      <Navbar />

      <div className={styles.tabsWrapper}>
        <button
          className={`${styles.tabButton} ${activeTab === "banner" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("banner")}
        >
          Home
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "feature" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("feature")}
        >
          Features
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "benefits" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("benefits")}
        >
          Benefits
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "pricing" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("pricing")}
        >
          Pricing
        </button>
        
        <button
          className={`${styles.tabButton} ${activeTab === "footer" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("footer")}
        >
          Contact Us
        </button>
      </div>

      <div className={styles.tabsContentWrapper}>{renderContent()}</div>
    </div>
  );
};

export default Home;