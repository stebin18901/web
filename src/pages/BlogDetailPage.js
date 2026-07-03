import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./BlogPages.css";
import { BLOG_COLLECTION, BLOG_SITE_URL, formatBlogDate, normalizeBlog } from "../utils/blogs";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.png`;

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

  useEffect(() => {
    const previousTitle = document.title;
    const metaNodes = [];
    const linkNodes = [];
    const scriptNodes = [];

    const upsertMeta = (key, value, attr = "name") => {
      if (!value) return;
      const node = document.createElement("meta");
      node.setAttribute(attr, key);
      node.setAttribute("content", value);
      document.head.appendChild(node);
      metaNodes.push(node);
    };

    if (!blog) {
      document.title = "Hepsy Blog";
      return () => {
        document.title = previousTitle;
      };
    }

    document.title = `${blog.seoTitle} | Hepsy`;
    upsertMeta("description", blog.seoDescription);
    upsertMeta("keywords", blog.seoKeywords.join(", "));
    upsertMeta("og:title", blog.seoTitle, "property");
    upsertMeta("og:description", blog.seoDescription, "property");
    upsertMeta("og:type", "article", "property");
    upsertMeta("og:url", blog.canonicalUrl, "property");
    if (blog.featureImage) upsertMeta("og:image", blog.featureImage, "property");
    upsertMeta("twitter:card", blog.featureImage ? "summary_large_image" : "summary");
    upsertMeta("twitter:title", blog.seoTitle);
    upsertMeta("twitter:description", blog.seoDescription);
    if (blog.featureImage) upsertMeta("twitter:image", blog.featureImage);

    const canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", blog.canonicalUrl || `${BLOG_SITE_URL}/blogs/${slug}`);
    document.head.appendChild(canonical);
    linkNodes.push(canonical);

    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: blog.seoTitle,
      description: blog.seoDescription,
      image: blog.featureImage ? [blog.featureImage] : [],
      author: {
        "@type": "Person",
        name: blog.author || "Hepsy Team",
      },
      publisher: {
        "@type": "Organization",
        name: "Hepsy",
        logo: {
          "@type": "ImageObject",
          url: `${BLOG_SITE_URL}/images/logo.png`,
        },
      },
      mainEntityOfPage: blog.canonicalUrl || `${BLOG_SITE_URL}/blogs/${slug}`,
      datePublished: blog.publishedAtMs ? new Date(blog.publishedAtMs).toISOString() : undefined,
      dateModified: blog.updatedAt ? new Date(blog.updatedAtMs || blog.publishedAtMs).toISOString() : undefined,
      keywords: blog.seoKeywords.join(", "),
    };
    const schemaNode = document.createElement("script");
    schemaNode.type = "application/ld+json";
    schemaNode.text = JSON.stringify(schema);
    document.head.appendChild(schemaNode);
    scriptNodes.push(schemaNode);

    return () => {
      document.title = previousTitle;
      metaNodes.forEach((node) => node.remove());
      linkNodes.forEach((node) => node.remove());
      scriptNodes.forEach((node) => node.remove());
    };
  }, [blog, slug]);

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
                          ? `linear-gradient(180deg, rgba(11, 18, 38, 0.16) 0%, rgba(11, 18, 38, 0.84) 100%), url(${item.featureImage})`
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
