import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./BlogPages.css";
import { BLOG_COLLECTION, formatBlogDate, normalizeBlog } from "../utils/blogs";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

export default function BlogListPage() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadBlogs = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, BLOG_COLLECTION));
        if (!active) return;
        const items = snap.docs
          .map((entry) => normalizeBlog({ id: entry.id, ...entry.data() }))
          .filter((entry) => entry.status === "published")
          .sort((a, b) => b.publishedAtMs - a.publishedAtMs || b.createdAtMs - a.createdAtMs);
        setBlogs(items);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBlogs();
    return () => {
      active = false;
    };
  }, []);

  const featured = useMemo(() => blogs[0] || null, [blogs]);
  const rest = useMemo(() => blogs.slice(1), [blogs]);

  return (
    <div className="blog-page-shell">
      <header className="blog-page-nav">
        <Link className="blog-page-brand" to="/">
          <img src={HEPSY_LOGO} alt="Hepsy logo" />
          <span>
            <strong>HEPSY</strong>
            <small>Stories & Updates</small>
          </span>
        </Link>
        <div className="blog-page-nav-actions">
          <Link to="/" className="blog-page-nav-link">Back Home</Link>
          <Link to="/login" className="blog-page-nav-cta">Student Login</Link>
        </div>
      </header>

      <main className="blog-page-main">
        <section className="blog-page-hero">
          <span className="blog-page-kicker">Editorial Desk</span>
          <h1>Hepsy blogs, launches, and student-focused ideas in one place.</h1>
          <p>Explore product updates, study guidance, school stories, and practical academic ideas from the Hepsy team.</p>
        </section>

        {featured && (
          <section className="blog-featured-card">
            <div
              className="blog-featured-visual"
              style={{
                backgroundImage: featured.featureImage
                  ? `linear-gradient(180deg, rgba(7, 12, 24, 0.12), rgba(7, 12, 24, 0.82)), url(${featured.featureImage})`
                  : "linear-gradient(145deg, rgba(109, 121, 255, 0.18), rgba(20, 200, 161, 0.18))",
              }}
            />
            <div className="blog-featured-copy">
              <span>{featured.category}</span>
              <h2>{featured.title}</h2>
              <p>{featured.excerpt}</p>
              <div className="blog-meta-row">
                <small>{formatBlogDate(featured.publishedAt)}</small>
                <small>{featured.readTime} min read</small>
                <small>{featured.author}</small>
              </div>
              <Link to={`/blogs/${featured.slug}`} className="blog-page-nav-cta">
                Read Feature
              </Link>
            </div>
          </section>
        )}

        <section className="blog-grid-section">
          <div className="blog-grid-heading">
            <div>
              <span className="blog-page-kicker">Latest Posts</span>
              <h2>Fresh reads from the Hepsy notebook.</h2>
            </div>
          </div>

          {loading ? (
            <div className="blog-empty-card">Loading blog articles...</div>
          ) : blogs.length === 0 ? (
            <div className="blog-empty-card">No published blogs yet. Add one from the admin blog studio.</div>
          ) : (
            <div className="blog-list-grid">
              {(featured ? rest : blogs).map((blog) => (
                <Link
                  key={blog.id}
                  to={`/blogs/${blog.slug}`}
                  className="blog-list-card"
                  style={{
                    backgroundImage: blog.featureImage
                      ? `linear-gradient(180deg, rgba(11, 18, 38, 0.56) 0%, rgba(11, 18, 38, 0.84) 100%), url(${blog.featureImage})`
                      : "linear-gradient(145deg, rgba(109, 121, 255, 0.12), rgba(20, 200, 161, 0.16))",
                  }}
                >
                  <span className="blog-card-category">{blog.category}</span>
                  <div className="blog-list-card-copy">
                    <h3>{blog.title}</h3>
                    <p>{blog.excerpt}</p>
                    <div className="blog-meta-row">
                      <small>{formatBlogDate(blog.publishedAt)}</small>
                      <small>{blog.readTime} min read</small>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
