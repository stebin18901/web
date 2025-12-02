import React from "react";
import styles from "./StatsOverview.module.css";
import {
  TrendingUp,
  Award,
  PhoneCall,
  School,
  BookOpen,
  CheckCircle2,
  Calendar, // Added for stats
  Users, // Added for stats
  Zap, // Added for programs
} from "lucide-react";

const STATS_DATA = [
  {
    value: "324+",
    label: "Active Students Today",
    Icon: TrendingUp,
    className: styles.positive,
  },
  {
    value: "#3",
    label: "School Rank",
    Icon: Award,
    className: "",
  },
  {
    value: "89%",
    label: "Weekly Participation",
    Icon: Calendar, // Using Calendar icon
    className: "",
  },
];

const PROGRAM_DATA = [
  {
    title: "Entrance Foundation Program",
    desc: "Strong PCM foundation for competitive exams.",
    icon: School,
  },
  {
    title: "Smart Analytics Dashboard",
    desc: "AI insights to improve outcomes.",
    icon: TrendingUp,
  },
  {
    title: "Communication Bridge",
    desc: "Seamless parent-teacher collaboration.",
    icon: Users, // Using Users icon
  },
  {
    title: "Gamified Learning",
    desc: "Exciting challenges for learners.",
    icon: Zap, // Using Zap icon
  },
];

const IMPACT_DATA = [
    "Faster Concept Clarity",
    "Higher Participation",
    "Better Exam Results",
]

export default function StatsOverview() {
  return (
    // The main wrapper centers and spaces content
    <div className={styles.promoWrapper}>

      {/* 🚀 HERO SECTION */}
      <section className={styles.promoHero}>
        <div className={styles.promoHeroText}>
          <h1>Transforming Schools with Smart Learning</h1>
          <p>
            Hepsy empowers teachers and engages students through modern
            technology — boosting results & motivation.
          </p>
          {/* Changed button to an anchor tag for better semantics, styled as a button */}
          <a href="#demo" className={styles.promoCta} role="button">
            Request Free Demo
          </a>
        </div>
        <img
          src="https://cdn-icons-png.flaticon.com/512/9068/9068916.png"
          alt="Hepsy Education Dashboard"
          className={styles.promoHeroImg}
        />
      </section>

      {/* 📈 LIVE STATS SECTION */}
      <section className={styles.promoStats}>
        {STATS_DATA.map(({ value, label, Icon, className }) => (
          <div className={styles.promoStatCard} key={value}>
            <div className={styles.statContent}>
              <h2 className={className}>{value}</h2>
              <p>{label}</p>
            </div>
            {/* Added icon to all stat cards for visual consistency */}
            <Icon size={32} className={className} /> 
          </div>
        ))}
      </section>

      {/* 📘 PROGRAMS SECTION */}
      <section>
        <h2 className={styles.sectionTitle}>Programs We Offer</h2>
        <div className={styles.programGrid}>
          {PROGRAM_DATA.map(({ title, desc, icon: Icon }) => (
            <div className={styles.programCard} key={title}>
              {/* Added a container for the icon to manage spacing and background if needed */}
              <div className={styles.programIconContainer}>
                <Icon className={styles.programIcon} />
              </div>
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 🎯 IMPACT SECTION */}
      <section className={styles.impactCard}>
        <h2 className={styles.impactTitle}>Performance Impact</h2>
        {/* Using the standard bullet list for impact points */}
        <ul className={styles.impactList}>
          {IMPACT_DATA.map((point, index) => (
              <li key={index}>
                  <CheckCircle2 size={18} style={{ marginRight: '8px', color: '#67f3bd' }} />
                  +${[40, 60, 32][index]}% ${point}
              </li>
          ))}
        </ul>
      </section>

      {/* 📰 BLOGS SECTION */}
      <section className={styles.blogSection}>
        <h2 className={styles.sectionTitle}>School Growth Blogs 📚</h2>
        <div className={styles.blogRow}>
          <div className={styles.blogCard}>
            <h4>Improve Academic Excellence</h4>
            <p>Techniques top schools are using today.</p>
          </div>
          <div className={styles.blogCard}>
            <h4>Parent Involvement Matters</h4>
            <p>Modern strategies to boost trust.</p>
          </div>
        </div>
      </section>

      {/* 📞 CTA FOOTER */}
      <section className={styles.footerCta}>
        <h2>Ready to Transform Your School? 🚀</h2>
        <button className={styles.footerBtn}>
          <PhoneCall size={18} style={{ marginRight: '10px' }} /> 
          Contact Our Team
        </button>
      </section>
    </div>
  );
}