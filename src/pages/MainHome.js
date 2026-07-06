import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./MainHome.css";
import Footer from "../components/Footer";
import { BLOG_COLLECTION, formatBlogDate, normalizeBlog } from "../utils/blogs";
import SeoHelmet from "../components/SeoHelmet";
import {
  absoluteUrl,
  buildHomePageSchema,
  buildOrganizationSchema,
  buildWebsiteSchema,
} from "../utils/schema";

const heroTitleWords = ["Modern", "school", "routine."];
const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.png`;

const stats = [
  { value: "Classes 6-10", label: "Structured coverage for core school years" },
  { value: "Daily Practice", label: "Short, focused sessions that build consistency" },
  { value: "Instant Reports", label: "Clear progress snapshots for students and parents" },
];

const snapshotPoints = [
  "Live quiz performance tracking",
  "Topic-wise revision targets",
  "Student and parent friendly reports",
];

const steps = [
  {
    title: "Join League",
    text: "Students join in minutes and unlock a structured learning system right away.",
  },
  {
    title: "Daily Practice",
    text: "Daily quizzes, revision sets, and guided questions build momentum without feeling heavy.",
  },
  {
    title: "Level Up",
    text: "Reports and insights show what to improve next, making progress easier to sustain.",
  },
];

const planFeatures = [
  "Unlimited quiz access",
  "All classes access (6-10)",
  "Weekly challenges and streaks",
  "Leaderboards and rankings",
  "Progress tracking dashboard",
  "Notes and study materials",
  "New content updates",
];

const plans = [
  {
    name: "Quarterly Stage",
    duration: "3 months",
    price: "Rs 590",
    meta: "Rs 197/month",
    ctaClass: "btn btn-outline",
  },
  {
    name: "Mid-Season Pass",
    duration: "6 months",
    price: "Rs 990",
    meta: "Rs 165/month",
    ctaClass: "btn btn-secondary",
  },
  {
    name: "Championship Pass",
    duration: "12 months",
    price: "Rs 1590",
    meta: "Rs 133/month",
    featured: true,
    badge: "Best Value",
    ctaClass: "btn btn-primary",
  },
];

export default function MainHome() {
  const canvasRef = useRef(null);
  const [blogs, setBlogs] = useState([]);

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles = [];
    const particleCount = 60;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random() * 0.5 + 0.2,
      }));
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < -8) {
          p.y = height + 8;
          p.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 200, 161, ${p.alpha})`;
        ctx.fill();
      });
      frame = requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;

    const loadBlogs = async () => {
      const snap = await getDocs(collection(db, BLOG_COLLECTION));
      if (!active) return;
      const items = snap.docs
        .map((entry) => normalizeBlog({ id: entry.id, ...entry.data() }))
        .filter((entry) => entry.status === "published")
        .sort((a, b) => b.publishedAtMs - a.publishedAtMs || b.createdAtMs - a.createdAtMs)
        .slice(0, 6);
      setBlogs(items);
    };

    loadBlogs();
    return () => {
      active = false;
    };
  }, []);

  const homeBlogs = useMemo(() => blogs.slice(0, 6), [blogs]);
  const homeTitle = "Hepsy Learning Platform | Quiz-Based Study, Reports, and Subscription Plans";
  const homeDescription =
    "Hepsy helps students build daily momentum with quiz-based learning, progress reports, notes, and flexible subscription passes for Classes 6 to 10.";
  const homeSchemas = useMemo(
    () => [
      buildOrganizationSchema(),
      buildWebsiteSchema(),
      buildHomePageSchema({
        description: homeDescription,
        plans: plans.map((plan) => ({
          name: plan.name,
          url: "/pricing",
        })),
      }),
    ],
    [homeDescription]
  );

  return (
    <>
      <SeoHelmet
        title={homeTitle}
        description={homeDescription}
        keywords={[
          "Hepsy learning platform",
          "quiz based learning",
          "student dashboard",
          "online study plans",
          "classes 6 to 10",
        ]}
        canonicalUrl={absoluteUrl("/")}
        image={absoluteUrl("/images/banner.png")}
        schemas={homeSchemas}
      />
      <div className="home-shell">
        <div className="retro-grid-overlay" />
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <canvas id="stars" ref={canvasRef} />

        <header className="nav">
          <div className="container1 nav-bar">
            <a className="brand" href="#top" aria-label="Hepsy Home">
              <img className="logo logo-image" src={HEPSY_LOGO} alt="Hepsy logo" />
              <span className="brand-copy">
                <strong>HEPSY</strong>
                <small>LEARNING</small>
              </span>
            </a>

            <nav className="links" aria-label="Primary navigation">
              <a href="#overview">Overview</a>
              <a href="#platform">Platform</a>
              <a href="#pricing">Pricing</a>
              <a href="#schools">Schools</a>
              <Link to="/login" className="login-link">Student Login</Link>
              <button className="btn btn-primary nav-cta" onClick={() => scrollToId("pricing")}>
                Start Learning
              </button>
            </nav>
          </div>
        </header>

        <main>
          <section className="hero-section" id="overview">
            <div className="hero-stage hero-stage-full">
              <div
                className="hero-stage-backdrop"
                style={{
                  backgroundImage: `linear-gradient(90deg, rgba(5, 9, 20, 0.96) 0%, rgba(7, 12, 28, 0.8) 40%, rgba(5, 9, 20, 0.4) 70%, rgba(5, 9, 20, 0.95) 100%), linear-gradient(180deg, rgba(5, 9, 20, 0) 50%, rgba(5, 9, 20, 1) 100%), url(${process.env.PUBLIC_URL}/images/banner.png)`,
                }}
              />
              <div className="container1 hero-stage-content">
                <div className="hero-copy hero-copy-wide reveal show motion-ready">
                  <span className="eyebrow motion-text" style={{ "--motion-delay": 0 }}>
                    <span className="dot" /> JEE | NEET | UPSC | FOUNDATION
                  </span>
                  <div className="hero-title-stack">
                    <span className="hero-mini-label motion-text" style={{ "--motion-delay": 1 }}>
                      NOW STREAMING SMARTER STUDY SESSIONS
                    </span>
                    <h1 className="h1 hero-title-cinematic" aria-label={heroTitleWords.join(" ")}>
                      {heroTitleWords.map((word, index) => (
                        <span className="hero-title-word-wrap" key={word}>
                          <span
                            className="hero-title-word motion-text"
                            style={{ "--motion-delay": index + 2 }}
                          >
                            {word}
                          </span>
                        </span>
                      ))}
                    </h1>
                  </div>
                  <p className="lead motion-text" style={{ "--motion-delay": 5 }}>
                    Built for students who love the feeling of big moments, Hepsy turns daily study into a cinematic
                    rhythm with fast quizzes, smart revision, motivating ranks, and one clean space to keep momentum alive.
                  </p>

                  <div className="hero-actions motion-text" style={{ "--motion-delay": 6 }}>
                    <Link to="/login" className="btn btn-primary btn-lg">
                      Start Learning
                    </Link>
                    <button className="btn btn-secondary btn-lg" onClick={() => scrollToId("pricing")}>
                      View Plans
                    </button>
                    <button className="btn btn-ghost btn-lg" onClick={() => scrollToId("platform")}>
                      Explore Platform
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="trust-strip">
            <div className="marquee">
              <div className="row">
                <span className="pill">{"// ADAPTIVE ASSESSMENTS"}</span>
                <span className="pill">{"// NCERT-ALIGNED TOPICS"}</span>
                <span className="pill">{"// PARENT-FRIENDLY REPORTS"}</span>
                <span className="pill">{"// WEEKLY CHAMPIONSHIPS"}</span>
                <span className="pill">{"// DIGITAL STUDY NOTES"}</span>
                <span className="pill">{"// STUDENT-FIRST UI"}</span>
                <span className="pill">{"// ADAPTIVE ASSESSMENTS"}</span>
                <span className="pill">{"// NCERT-ALIGNED TOPICS"}</span>
                <span className="pill">{"// PARENT-FRIENDLY REPORTS"}</span>
              </div>
            </div>
          </section>

          <section className="container1 snapshot-section">
            <div className="snapshot-card reveal motion-ready">
              <div className="snapshot-copy">
                <span className="section-tag motion-text" style={{ "--motion-delay": 0 }}>LIVE HUD SNAPSHOT</span>
                <h2 className="section-title motion-text" style={{ "--motion-delay": 1 }}>Big-exam energy with a simpler daily study routine.</h2>
                <p className="section-subtitle motion-text" style={{ "--motion-delay": 2 }}>
                  Get a clear daily path. Practice, review performance, track progress, and build confidence without confusion.
                </p>
                <div className="snapshot-points">
                  {snapshotPoints.map((point) => (
                    <div className="snapshot-point" key={point}>
                      <span className="tick">+</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="snapshot-visual">
                <div className="visual-card visual-image-card">
                  <div className="visual-scanline" />
                  <img src="/images/self.png" alt="Hepsy space overview" className="crm-img" />
                  <div className="visual-floating-note">
                    <span>LEARNING LOUNGE</span>
                    <strong>Your revision space, all in one place.</strong>
                  </div>
                </div>

                <div className="visual-card visual-primary snapshot-metrics-card">
                  <div className="visual-header">
                    <span className="visual-kicker">CORE METRICS</span>
                    <span className="visual-pill">SYS READY</span>
                  </div>
                  <div className="visual-metrics">
                    {stats.map((stat) => (
                      <div className="metric-card" key={stat.value}>
                        <strong>{stat.value}</strong>
                        <span>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="container1 platform-section" id="platform">
            <div className="section-heading reveal motion-ready blog-section-head">
              <span className="section-tag motion-text" style={{ "--motion-delay": 0 }}>HEPSY BLOG DESK</span>
              <h2 className="section-title motion-text" style={{ "--motion-delay": 1 }}>Stories, study ideas, and product updates in a six-card editorial wall.</h2>
              <p className="section-subtitle motion-text" style={{ "--motion-delay": 2 }}>
                Fresh reads from the Hepsy team, built to feel visual first on the homepage and deeper on the full blog pages.
              </p>
              <div className="blog-section-actions motion-text" style={{ "--motion-delay": 3 }}>
                <p className="section-coverage">Latest 6 published articles</p>
                <Link to="/blogs" className="blog-view-more">View More</Link>
              </div>
            </div>

            {homeBlogs.length === 0 ? (
              <div className="blog-home-empty reveal">
                No blogs published yet. Add your first article from <strong>/admin189201</strong> in the new Blogs section.
              </div>
            ) : (
              <div className="feature-grid blog-feature-grid">
                {homeBlogs.map((blog) => (
                  <Link
                    to={`/blogs/${blog.slug}`}
                    className="feature reveal home-blog-card"
                    key={blog.id}
                    style={{
                      backgroundImage: blog.featureImage
                        ? `linear-gradient(180deg, rgba(5, 9, 20, 0.18) 0%, rgba(5, 9, 20, 0.88) 100%), url(${blog.featureImage})`
                        : "linear-gradient(145deg, rgba(109, 121, 255, 0.18), rgba(20, 200, 161, 0.18))",
                    }}
                  >
                    <h3 className="card-title-shift">{blog.title}</h3>
                    <p>{blog.excerpt}</p>
                    <div className="home-blog-meta">
                      <span>{formatBlogDate(blog.publishedAt)}</span>
                      <span>{blog.readTime} min read</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="container1 journey-section">
            <div className="journey-card reveal motion-ready">
              <div className="journey-copy">
                <span className="section-tag motion-text" style={{ "--motion-delay": 0 }}>CAMPAIGN FLOW</span>
                <h2 className="motion-text" style={{ "--motion-delay": 1 }}>Simple enough to start fast, structured enough to improve outcomes.</h2>
                <p className="motion-text" style={{ "--motion-delay": 2 }}>
                  A simple path helps students start fast and stay engaged. This flow shows how they move from joining to building real academic momentum.
                </p>
              </div>

              <div className="journey-steps">
                {steps.map((step, index) => (
                  <div className="journey-step" key={step.title}>
                    <span className="step-number">0{index + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="container1 pricing-section" id="pricing">
            <div className="section-heading reveal motion-ready">
              <span className="section-tag motion-text" style={{ "--motion-delay": 0 }}>TIER SELECTION</span>
              <h2 className="section-title motion-text" style={{ "--motion-delay": 1 }}>Straightforward plans with real value at every level.</h2>
              <p className="section-subtitle motion-text" style={{ "--motion-delay": 2 }}>
                All core features unlock immediately. Choose the duration that matches your academic plan and learning pace.
              </p>
            </div>

            <div className="pricing">
              {plans.map((plan) => (
                <article className={`price-card reveal${plan.featured ? " featured" : ""}`} key={plan.name}>
                  {plan.badge ? <div className="ribbon">{plan.badge}</div> : null}
                  <span className="plan-duration">{plan.duration}</span>
                  <h3>{plan.name}</h3>
                  <div className="price">
                    {plan.price} <span className="per">/ {plan.meta}</span>
                  </div>
                  <div className="ul">
                    {planFeatures.map((feature) => (
                      <div className="li" key={`${plan.name}-${feature}`}>
                        <span className="tick">+</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Link className={`${plan.ctaClass} w-full`} to="/subscribe">
                    Activate Pass
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="container1 schools-section" id="schools">
            <div className="school-grid">
              <div className="school-card reveal motion-ready">
                <span className="card-cue card-cue-corner" aria-hidden="true">+</span>
                <span className="section-tag motion-text" style={{ "--motion-delay": 0 }}>INSTITUTIONAL HUB</span>
                <h2 className="motion-text card-title-shift" style={{ "--motion-delay": 1 }}>Bring your school into the same polished digital experience.</h2>
                <p className="motion-text" style={{ "--motion-delay": 2 }}>
                  Set up classes, manage academic structure, and connect student workflows through one organized admin system built for schools.
                </p>
                <Link
                  to="/school-admin"
                  className="btn btn-primary btn-lg school-button motion-text"
                  style={{ "--motion-delay": 3 }}
                >
                  Launch Command Center
                </Link>
              </div>

              <div className="school-preview reveal motion-ready">
                <div className="school-preview-image" style={{ backgroundImage: "url('/images/Teacher.png')" }}>
                  <div className="school-preview-overlay">
                    <span className="card-cue card-cue-overlay" aria-hidden="true">+</span>
                    <span className="preview-badge motion-text" style={{ "--motion-delay": 0 }}>ADMIN PORTAL</span>
                    <h3 className="motion-text card-title-shift" style={{ "--motion-delay": 1 }}>Setup, organize, and scale from one place.</h3>
                    <p className="motion-text" style={{ "--motion-delay": 2 }}>Clean onboarding flow for institutions, class management, and academic configuration.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer />
    </>
  );
}
