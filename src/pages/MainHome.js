import React, { useEffect, useRef, useState } from "react";
import "./MainHome.css";

export default function MainHome() {
  const canvasRef = useRef(null);
  const tiltRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);

  // Smooth scroll helper
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Particle canvas + resize + animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W, H;
    let rafId;
    let stars = [];
    const STAR_COUNT = 120;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    const spawn = () => {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        v: Math.random() * 0.3 + 0.05,
      }));
    };
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        s.x += s.v;
        if (s.x > W) {
          s.x = -10;
          s.y = Math.random() * H;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(17,24,39,.7)";
        ctx.fill();
      }
      rafId = requestAnimationFrame(loop);
    };

    resize();
    spawn();
    loop();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Parallax tilt
  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
    };
    const onLeave = () => {
      el.style.transform = "";
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("show");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Contact form submit
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = {
      schoolName: form[0].value,
      contactPerson: form[1].value,
      email: form[2].value,
      phone: form[3].value,
      interestedIn: form[4].value,
    };

    try {
      await fetch("https://script.google.com/macros/s/AKfycbxTKNqqjLSHfNaxDNzAuUb3E_OrdmgAAUl7JbyKlcnR5fPwhVl90z_tdghTSTwMQ0tQ/exec", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setSubmitted(true);
      alert("Thanks! Your details have been submitted successfully.");
      form.reset();
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong. Please try again later.");
    }
  };


  const YearNow = new Date().getFullYear();

  return (
    <>
      {/* Animated background layers */}
      <div className="gradient-bg" />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <canvas id="stars" ref={canvasRef} />

      {/* NAV */}
      <header className="nav">
        <div className="container1 bar">
          <a className="brand" href="#top" aria-label="Hepsy Home">
            <span className="logo">H</span>
            <span>Hepsy Enterprise Private Limited</span>
          </a>
          <nav className="links">
            <a href="#overview">Overview</a>
            <a href="#den">DEN CRM</a>
            <a href="#pro">DEN CRM Pro</a>
            <a href="#self">Self Learning</a>
            <a href="#pricing">Pricing</a>
            <a href="#contact">Contact</a>
            <button className="btn" onClick={() => scrollToId("pricing")}>
              Get Started
            </button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="hero container1" id="overview">
        <div className="wrap">
          <div>
            <span className="eyebrow">
              <span className="dot" /> DEN – Digital Education Network (CRM + Parent App)
            </span>
            <h1 className="h1">Brighter school ↔ parent communication with built-in self learning</h1>
            <p className="lead">
              DEN CRM keeps schools and families perfectly in sync — instant announcements, fee and event alerts, zero
              miscommunication — bundled with Hepsy&apos;s engaging Self Learning Platform.
            </p>
            <div className="cta">
              <button className="btn" onClick={() => scrollToId("pricing")}>
                See Plans
              </button>
              <button className="btn ghost" onClick={() => scrollToId("den")}>
                Explore Features
              </button>
            </div>
          </div>

          <div className="art" id="tilt" ref={tiltRef}>
            <img
              src="/images/Parentapp.png"
              alt="DEN CRM Dashboard"
              className="crm-img"
              style={{
                width: "100%",
                maxWidth: 420,
                borderRadius: "12px",
                boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
                e.currentTarget.style.boxShadow = "0 14px 30px rgba(0,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
              }}
            />
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee">
        <div className="row">
          <span className="pill">
            <span className="emoji">📣</span> Instant Announcements
          </span>
          <span className="pill">
            <span className="emoji">📲</span> Parent App for All
          </span>
          <span className="pill">
            <span className="emoji">🧾</span> Fee Dues Alerts
          </span>
          <span className="pill">
            <span className="emoji">🎉</span> Event Notifications
          </span>
          <span className="pill">
            <span className="emoji">📊</span> Progress Reports
          </span>
          <span className="pill">
            <span className="emoji">🧠</span> Self Assessment
          </span>
          <span className="pill">
            <span className="emoji">🤝</span> Support 9am–8pm
          </span>
          {/* loop illusion */}
          <span className="pill">
            <span className="emoji">📣</span> Instant Announcements
          </span>
          <span className="pill">
            <span className="emoji">📲</span> Parent App for All
          </span>
          <span className="pill">
            <span className="emoji">🧾</span> Fee Dues Alerts
          </span>
          <span className="pill">
            <span className="emoji">🎉</span> Event Notifications
          </span>
          <span className="pill">
            <span className="emoji">📊</span> Progress Reports
          </span>
          <span className="pill">
            <span className="emoji">🧠</span> Self Assessment
          </span>
          <span className="pill">
            <span className="emoji">🤝</span> Support 9am–8pm
          </span>
        </div>
      </div>

      {/* DEN CRM */}
      <section className="container1" id="den">
        <div className="grid-2">
          <div>
            <h2 className="section-title">DEN CRM</h2>
            <p className="section-lead">
              Interaction between schools and parents is smoother and faster — with no miscommunication.
            </p>

            <div className="grid-3">
              <div className="feature reveal">
                <h3>On-time Notifications</h3>
                <p>Announcements and updates arrive right on the phone.</p>
              </div>
              <div className="feature reveal">
                <h3>Fee Dues Alerts</h3>
                <p>Parents receive timely reminders for dues and payments.</p>
              </div>
              <div className="feature reveal">
                <h3>Events &amp; Calendar</h3>
                <p>All event notifications, neatly organized.</p>
              </div>
              <div className="feature reveal">
                <h3>Data Management</h3>
                <p>Manage all school data in one place.</p>
              </div>
              <div className="feature reveal">
                <h3>Parent App for All</h3>
                <p>Every parent gets access to the app, at no extra cost.</p>
              </div>
              <div className="feature reveal">
                <h3>Support</h3>
                <p>Assistance provided for schools; customer support available.</p>
              </div>
            </div>

            <div className="cta" style={{ marginTop: 18 }}>
              <button className="btn" onClick={() => scrollToId("pricing")}>
                View Pricing
              </button>
              <button className="btn ghost" onClick={() => scrollToId("contact")}>
                Talk to Us
              </button>
            </div>
          </div>

          {/* CRM Image Slot */}
          <div
            className="reveal"
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* Image Row */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: "20px",
              }}
            >


              <img
                src="/images/Crm.png"
                alt="DEN CRM Dashboard"
                className="crm-img"
                style={{
                  width: "100%",
                  maxWidth: 420,
                  borderRadius: "12px",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.03)";
                  e.currentTarget.style.boxShadow = "0 14px 30px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
                }}
              />
            </div>



          </div>
        </div>


      </section>

      {/* DEN CRM PRO */}
      <section className="container1" id="pro">
        <div className="grid-2">
          <div className="reveal">
            <div
              className="cta-band"
              style={{
                background: "linear-gradient(120deg, var(--bg1), var(--bg2))",
                color: "#111",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 6px" }}>DEN CRM Pro + Hepsy Self Learning</h3>
                <p style={{ margin: 0 }}>
                  Interaction between schools and parents is smoother. On-time phone notifications. Manage data for
                  students and teachers. All event notifications included.
                </p>
              </div>
              <button className="btn" onClick={() => scrollToId("pricing")}>
                Choose Pro
              </button>
            </div>
          </div>
          <div>
            <div className="grid-3">
              <div className="feature reveal">
                <h3>Year-long Self Assessment</h3>
                <p>Included for every student.</p>
              </div>
              <div className="feature reveal">
                <h3>Parent App for All</h3>
                <p>Provide access to every parent.</p>
              </div>
              <div className="feature reveal">
                <h3>Onboarding Assistance</h3>
                <p>Help provided in the beginning stage.</p>
              </div>
              <div className="feature reveal">
                <h3>Support Hours</h3>
                <p>Customer support 9am – 8pm.</p>
              </div>
              <div className="feature reveal">
                <h3>Data Control</h3>
                <p>Manage students &amp; teachers in one hub.</p>
              </div>
              <div className="feature reveal">
                <h3>No Miscommunication</h3>
                <p>Clear channels between school &amp; parents.</p>
              </div>
            </div>
          </div>
        </div>
        {/* SEE DEMO LINK */}


      </section>

      {/* SELF LEARNING */}
      <section className="container1" id="self">
        <div className="grid-2">
          <div>
            <h2 className="section-title">Hepsy Self Learning Platform</h2>
            <p className="section-lead">
              Foundation program that boosts self-assessment and daily practice — aligned to NCERT with exam-focused
              questions.
            </p>
            <div className="grid-3">
              <div className="feature reveal">
                <h3>Integrated Hints</h3>
                <p>Questions come with solving hints.</p>
              </div>
              <div className="feature reveal">
                <h3>Relevant Syllabus</h3>
                <p>All syllabus with relevant topics on NCERT.</p>
              </div>
              <div className="feature reveal">
                <h3>Daily Homework</h3>
                <p>Homework becomes engaging and fun.</p>
              </div>
              <div className="feature reveal">
                <h3>Parent Reports</h3>
                <p>All reports sent to parents for tracking.</p>
              </div>
              <div className="feature reveal">
                <h3>School Promotion</h3>
                <p>Schools get featured on Hepsy social media pages.</p>
              </div>
              <div className="feature reveal">
                <h3>On-site Content Capture</h3>
                <p>Hepsy team visits schools to take relevant videos for extra marketing.</p>
              </div>
            </div>
          </div>
          <img
            src="/images/self.png"
            alt="DEN CRM Dashboard"
            className="crm-img"
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: "12px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.boxShadow = "0 14px 30px rgba(0,0,0,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.2)";
            }}
          />
        </div>
      </section>

      {/* PRICING */}
      <section className="container1" id="pricing">
        <h2 className="section-title">Pricing</h2>
        <p className="section-lead">Simple, student-first pricing. Schools share revenue on the Self Learning plans.</p>
        <div className="pricing">
          {/* Plan 1 */}
          <div className="price-card reveal">
            <div className="ribbon">Popular</div>
            <h3>DEN CRM</h3>
            <div className="price">
              ₹299 <span className="per">/ 6 months / student</span>
            </div>
            <div className="ul">
              <div className="li">
                <span className="tick">✓</span>
                <span>Parent-school interaction is smoother (no miscommunication)</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>On-time notification &amp; announcements on phone</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Manage all school data; fee dues notifications to parents</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>All event notifications</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>
                  Self Assessment Program free for 3 months
                </span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Parent App provided to all parents</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Assistance provided for schools</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Customer support</span>
              </div>
            </div>
            <button className="btn" onClick={() => scrollToId("contact")}>
              Start with DEN CRM
            </button>
          </div>

          {/* Plan 2 */}
          <div className="price-card reveal">
            <h3>DEN CRM (Annual)</h3>
            <div className="price">
              ₹499 <span className="per">/ year / student</span>
            </div>
            <div className="ul">
              <div className="li">
                <span className="tick">✓</span>
                <span>All DEN CRM features</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Parent App for all parents</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Assistance for schools • Customer support</span>
              </div>
            </div>
            <button className="btn" onClick={() => scrollToId("contact")}>
              Choose Annual
            </button>
          </div>

          {/* Plan 3 */}
          <div className="price-card reveal">
            <div className="ribbon" style={{ background: "linear-gradient(90deg, var(--bg1), var(--bg2))" }}>
              Best Value
            </div>
            <h3>DEN CRM Pro + Hepsy Self Learning</h3>
            <div className="price">
              ₹599 <span className="per">/ 6 months / student</span>
            </div>
            <div className="ul">
              <div className="li">
                <span className="tick">✓</span>
                <span>Year-long Self Assessment for students</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>On-time phone notifications • All events</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Manage data of students and teachers</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Parent App for all parents</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Onboarding assistance • Support 9am–8pm</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>School promotion on Hepsy social media pages</span>
              </div>
              <div className="li">
                <span className="tick">✓</span>
                <span>Hepsy team visits schools for videos (extra marketing)</span>
              </div>
            </div>
            <button className="btn" onClick={() => scrollToId("contact")}>
              Upgrade to Pro
            </button>
            <div style={{ height: 10 }} />
            <div className="price">
              ₹899 <span className="per">/ year / student</span>
            </div>

          </div>
        </div>
      </section>

      {/* CTA WIDE */}
      <section className="container1">
        <div className="cta-band reveal">
          <div>
            <h3 style={{ margin: 0 }}>Ready to make communication effortless?</h3>
            <p style={{ margin: "6px 0 0" }}>
              Book a quick demo — see the Parent App, CRM dashboard, and the Self Learning experience in action.
            </p>
          </div>
          <button className="btn" onClick={() => scrollToId("contact")}>
            Book a Demo
          </button>
        </div>
      </section>

      {/* CONTACT */}
      <section className="container1" id="contact">
        <div className="grid-2">
          <div>
            <h2 className="section-title">Contact Hepsy</h2>
            <p className="section-lead">
              Tell us a bit about your school and the programs you&apos;re interested in. We&apos;ll reach out shortly.
            </p>
            <form className="feature" onSubmit={onSubmit}>
              <label>
                School Name
                <br />
                <input required className="input" type="text" placeholder="e.g., Sunrise Public School" />
              </label>
              <label>
                Contact Person
                <br />
                <input required className="input" type="text" placeholder="Your name" />
              </label>
              <label>
                Email
                <br />
                <input required className="input" type="email" placeholder="name@school.in" />
              </label>
              <label>
                Phone
                <br />
                <input required className="input" type="tel" placeholder="Your phone number" />
              </label>
              <label>
                Interested In
                <br />
                <select className="input" required defaultValue="DEN">
                  <option value="DEN">DEN CRM</option>
                  <option value="PRO">DEN CRM Pro + Self Learning</option>
                  <option value="SELF">Hepsy Self Learning Platform</option>
                </select>
              </label>
              <button className="btn" type="submit" disabled={submitted}>
                {submitted ? "Submitted ✓" : "Submit"}
              </button>
            </form>
          </div>
          <div className="reveal">
            <div className="feature">
              <h3>Hepsy Enterprise Private Limited</h3>
              <p style={{ margin: ".4rem 0 0" }}>Kerala, India</p>
              <small>Official CRM &amp; Self Learning solutions for schools.</small>
              <div style={{ height: 10 }} />
              <div className="ul">
                <div className="li">
                  <span className="tick">✓</span>
                  <span>Secure • Fast • Mobile-first</span>
                </div>
                <div className="li">
                  <span className="tick">✓</span>
                  <span>Seamless onboarding support</span>
                </div>
                <div className="li">
                  <span className="tick">✓</span>
                  <span>Made for Indian schools</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container1 foot">
          <div>
            <div className="brand">
              <span className="logo">H</span>
              <strong>Hepsy Enterprise Private Limited</strong>
            </div>
            <small>
              © <span>{YearNow}</span> Hepsy Enterprise Pvt Ltd. All rights reserved.
            </small>
          </div>
          <div>
            <strong>Products</strong>
            <div>
              <a href="#den">DEN CRM</a>
            </div>
            <div>
              <a href="#pro">DEN CRM Pro</a>
            </div>
            <div>
              <a href="#self">Self Learning</a>
            </div>
          </div>
          <div>
            <strong>Get Started</strong>
            <div>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <a href="#contact">Book a Demo</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
