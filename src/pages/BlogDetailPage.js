import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./BlogPages.css";
import { BLOG_COLLECTION, formatBlogDate, normalizeBlog } from "../utils/blogs";
import SeoHelmet from "../components/SeoHelmet";
import { absoluteUrl, buildArticleSchema } from "../utils/schema";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

export default function BlogDetailPage() {
  const { slug } = useParams();
  const [blog, setBlog] = useState(null);
  const [allBlogs, setAllBlogs] = useState([]);
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
        setAllBlogs(items);
        setBlog(items.find((entry) => entry.slug === slug) || null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadBlogs();
    return () => {
      active = false;
    };
  }, [slug]);

  const paragraphs = useMemo(
    () => String(blog?.content || "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
    [blog]
  );
  const related = useMemo(
    () => allBlogs.filter((entry) => entry.slug !== slug).slice(0, 3),
    [allBlogs, slug]
  );

  return (
    <div className="blog-page-shell">
      <SeoHelmet
        title={blog ? `${blog.seoTitle} | Hepsy` : "Hepsy Blog"}
        description={blog?.seoDescription || "Stories, study ideas, and product updates from Hepsy."}
        keywords={blog?.seoKeywords || ["Hepsy blog", "study tips", "education"]}
        canonicalUrl={blog?.canonicalUrl}
        type="article"
        image={absoluteUrl(blog?.featureImage)}
        schemas={blog ? [buildArticleSchema(blog)] : []}
      />
      <header className="blog-page-nav">
        <Link className="blog-page-brand" to="/">
          <img src={HEPSY_LOGO} alt="Hepsy logo" />
          <span>
            <strong>HEPSY</strong>
            <small>Stories & Updates</small>
          </span>
        </Link>
        <div className="blog-page-nav-actions">
          <Link to="/blogs" className="blog-page-nav-link">All Blogs</Link>
          <Link to="/" className="blog-page-nav-link">Back Home</Link>
        </div>
      </header>

      <main className="blog-page-main">
        {loading ? (
          <div className="blog-empty-card">Loading article...</div>
        ) : !blog ? (
          <div className="blog-empty-card">This blog could not be found or is not published yet.</div>
        ) : (
          <>
            <article className="blog-detail-article">
              <div className="blog-detail-head">
                <span className="blog-page-kicker">{blog.category}</span>
                <h1>{blog.title}</h1>
                <p>{blog.excerpt}</p>
                <div className="blog-meta-row">
                  <small>{formatBlogDate(blog.publishedAt)}</small>
                  <small>{blog.readTime} min read</small>
                  <small>{blog.author}</small>
                </div>
              </div>

              <div
                className="blog-detail-hero-image"
                style={{
                  backgroundImage: blog.featureImage
                    ? `url(${blog.featureImage})`
                    : "linear-gradient(145deg, rgba(109, 121, 255, 0.2), rgba(20, 200, 161, 0.2))",
                }}
              />

              <div className="blog-detail-body">
                {blog.contentHtml ? (
                  <div className="blog-rich-content" dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />
                ) : paragraphs.length > 0 ? (
                  paragraphs.map((paragraph, index) => <p key={`${blog.id}-${index}`}>{paragraph}</p>)
                ) : (
                  <p>{blog.excerpt}</p>
                )}
              </div>
            </article>

            {related.length > 0 && (
              <section className="blog-grid-section">
                <div className="blog-grid-heading">
                  <div>
                    <span className="blog-page-kicker">Keep Reading</span>
                    <h2>More from the Hepsy notebook.</h2>
                  </div>
                </div>
                <div className="blog-list-grid">
                  {related.map((item) => (
                    <Link
                      key={item.id}
                      to={`/blogs/${item.slug}`}
                      className="blog-list-card"
                      style={{
                        backgroundImage: item.featureImage
                          ? `linear-gradient(180deg, rgba(11, 18, 38, 0.42) 0%, rgba(11, 18, 38, 0.84) 100%), url(${item.featureImage})`
                          : "linear-gradient(145deg, rgba(109, 121, 255, 0.12), rgba(20, 200, 161, 0.16))",
                      }}
                    >
                      <span className="blog-card-category">{item.category}</span>
                      <div className="blog-list-card-copy">
                        <h3>{item.title}</h3>
                        <p>{item.excerpt}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
