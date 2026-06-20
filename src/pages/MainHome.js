import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./MainHome.css";
import Footer from "../components/Footer";

const highlights = [
  "Adaptive self-assessment journeys",
  "NCERT-aligned practice and revision",
  "Actionable performance reports",
  "Motivating leaderboards and streaks",
];

const stats = [
  { value: "Classes 6-10", label: "Structured coverage for core school years" },
  { value: "Daily Practice", label: "Short, focused sessions that build consistency" },
  { value: "Instant Reports", label: "Clear progress snapshots for students and parents" },
];

const features = [
  {
    title: "Guided Practice",
    text: "Hints, explanations, and stepwise reinforcement help students learn instead of just guessing answers.",
  },
  {
    title: "Exam-Focused Coverage",
    text: "Concept practice is aligned with school expectations, revision cycles, and competitive exam habits.",
  },
  {
    title: "Parent Visibility",
    text: "Performance summaries make it easy for families to understand consistency, strengths, and gaps.",
  },
  {
    title: "Challenge-Driven Learning",
    text: "Leaderboards, streaks, and weekly targets turn routine homework into something students want to return to.",
  },
  {
    title: "Study Material Hub",
    text: "Notes, revision support, and practice resources live in one clean mobile-first experience.",
  },
  {
    title: "School Growth Support",
    text: "Institutions can pair learning outcomes with digital visibility and a stronger academic brand.",
  },
];

const steps = [
  {
    title: "Join",
    text: "Students subscribe in minutes and get immediate access to structured learning tools.",
  },
  {
    title: "Practice",
    text: "Daily quizzes, revision sets, and guided questions build momentum with low friction.",
  },
  {
    title: "Improve",
    text: "Reports and insights highlight where to focus next, making progress easier to sustain.",
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
    name: "Quarterly",
    duration: "3 months",
    price: "Rs 590",
    meta: "Rs 197/month",
    ctaClass: "btn btn-outline",
  },
  {
    name: "Half-Yearly",
    duration: "6 months",
    price: "Rs 990",
    meta: "Rs 165/month",
    ctaClass: "btn btn-secondary",
  },
  {
    name: "Yearly",
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
    const particleCount = 80;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.8 + 0.5,
        speed: Math.random() * 0.25 + 0.05,
        alpha: Math.random() * 0.35 + 0.1,
      }));
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.y -= particle.speed;
        if (particle.y < -8) {
          particle.y = height + 8;
          particle.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
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
      { threshold: 0.14 }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="home-shell">
        <div className="gradient-bg" />
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <canvas id="stars" ref={canvasRef} />

        <header className="nav">
          <div className="container1 nav-bar">
            <a className="brand" href="#top" aria-label="Hepsy Home">
              <span className="logo">H</span>
              <span className="brand-copy">
                <strong>Hepsy</strong>
                <small>Self Learning Platform</small>
              </span>
            </a>

            <nav className="links" aria-label="Primary navigation">
              <a href="#overview">Overview</a>
              <a href="#platform">Platform</a>
              <a href="#pricing">Pricing</a>
              <a href="#schools">Schools</a>
              <Link to="/login">Student Login</Link>
              <button className="btn btn-primary nav-cta" onClick={() => scrollToId("pricing")}>
                Start Learning
              </button>
            </nav>
          </div>
        </header>

        <main>
          <section className="hero-section" id="overview">
            <div className="container1 hero-grid">
              <div className="hero-copy reveal show">
                <span className="eyebrow">
                  <span className="dot" /> Smart practice for stronger results
                </span>
                <h1 className="h1">A sharper, more motivating home for everyday learning.</h1>
                <p className="lead">
                  Hepsy helps students build confidence through guided self-assessment, revision support, and progress
                  tracking that feels clear, modern, and rewarding.
                </p>

                <div className="hero-actions">
                  <Link to="/login" className="btn btn-primary btn-lg">
                    Student Login
                  </Link>
                  <Link to="/subscribe" className="btn btn-secondary btn-lg">
                    Subscribe Now
                  </Link>
                  <button className="btn btn-ghost btn-lg" onClick={() => scrollToId("platform")}>
                    Explore Platform
                  </button>
                </div>

                <div className="hero-highlights">
                  {highlights.map((item) => (
                    <div className="highlight-chip" key={item}>
                      <span className="highlight-mark">+</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-visual reveal">
                <div className="visual-card visual-primary">
                  <div className="visual-header">
                    <span className="visual-kicker">Learning Snapshot</span>
                    <span className="visual-pill">Live Progress</span>
                  </div>
                  <h3>Daily performance that students can actually understand.</h3>
                  <p>
                    Practice flow, revision targets, and simple milestones all sit inside one clean dashboard.
                  </p>

                  <div className="visual-metrics">
                    {stats.map((stat) => (
                      <div className="metric-card" key={stat.value}>
                        <strong>{stat.value}</strong>
                        <span>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="visual-card visual-image-card">
                  <img src="/images/self.png" alt="Hepsy self learning preview" className="crm-img" />
                </div>
              </div>
            </div>
          </section>

          <section className="trust-strip">
            <div className="marquee">
              <div className="row">
                <span className="pill">Adaptive assessments</span>
                <span className="pill">NCERT-aligned topics</span>
                <span className="pill">Parent-friendly reports</span>
                <span className="pill">Weekly challenges</span>
                <span className="pill">Notes and revision tools</span>
                <span className="pill">Student-first design</span>
                <span className="pill">Adaptive assessments</span>
                <span className="pill">NCERT-aligned topics</span>
                <span className="pill">Parent-friendly reports</span>
                <span className="pill">Weekly challenges</span>
                <span className="pill">Notes and revision tools</span>
                <span className="pill">Student-first design</span>
              </div>
            </div>
          </section>

          <section className="container1 platform-section" id="platform">
            <div className="section-heading reveal">
              <span className="section-tag">Platform Experience</span>
              <h2 className="section-title">Everything students need to stay consistent, not just busy.</h2>
              <p className="section-subtitle">
                The homepage now leads with clarity: what Hepsy offers, why it matters, and how quickly students can get
                value from it.
              </p>
            </div>

            <div className="feature-grid">
              {features.map((feature) => (
                <article className="feature reveal" key={feature.title}>
                  <div className="feature-icon">{feature.title.charAt(0)}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="container1 journey-section">
            <div className="journey-card reveal">
              <div className="journey-copy">
                <span className="section-tag">How It Works</span>
                <h2>Simple enough to start fast, structured enough to improve outcomes.</h2>
                <p>
                  A good learning homepage should remove friction. This flow helps students and schools understand the
                  path from signup to progress without making the page feel crowded.
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
            <div className="section-heading reveal">
              <span className="section-tag">Pricing</span>
              <h2 className="section-title">Straightforward plans with real value at every level.</h2>
              <p className="section-subtitle">
                Each plan keeps the same core experience, with the yearly option giving the strongest long-term value.
              </p>
            </div>

            <div className="pricing">
              {plans.map((plan) => (
                <article className={`price-card reveal${plan.featured ? " featured" : ""}`} key={plan.name}>
                  {plan.badge ? <div className="ribbon">{plan.badge}</div> : null}
                  <span className="plan-duration">{plan.duration}</span>
                  <h3>{plan.name}</h3>
                  <div className="price">
                    {plan.price} <span className="per">{plan.meta}</span>
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
                    Subscribe Now
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="container1 schools-section" id="schools">
            <div className="school-grid">
              <div className="school-card reveal">
                <span className="section-tag">For Institutions</span>
                <h2>Bring your school into the same polished digital experience.</h2>
                <p>
                  Schools can use the admin portal to set up classes, organize academic structure, and create a better
                  learning environment around the student platform.
                </p>
                <Link to="/school-admin" className="btn btn-primary btn-lg school-button">
                  Go to School Admin
                </Link>
              </div>

              <div className="school-preview reveal">
                <div className="school-preview-image" style={{ backgroundImage: "url('/images/sir.png')" }}>
                  <div className="school-preview-overlay">
                    <span className="preview-badge">Admin Portal</span>
                    <h3>Setup, organize, and scale from one place.</h3>
                    <p>Clean onboarding flow for institutions, class management, and academic configuration.</p>
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
