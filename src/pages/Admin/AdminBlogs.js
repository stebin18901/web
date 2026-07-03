import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../firebase/firebaseConfig";
import "./AdminBlogs.css";
import {
  BLOG_COLLECTION,
  convertPlainTextToHtml,
  createBlogSlug,
  estimateReadTime,
  formatBlogDate,
  htmlToPlainText,
  normalizeBlog,
  sanitizeBlogHtml,
} from "../../utils/blogs";

const initialForm = {
  id: "",
  title: "",
  slug: "",
  category: "Hepsy Blog",
  author: "Hepsy Team",
  excerpt: "",
  content: "",
  contentHtml: "",
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  focusKeyword: "",
  status: "draft",
  featureImage: "",
  featureImagePath: "",
};

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [featureFile, setFeatureFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const editorRef = useRef(null);

  const featurePreview = useMemo(() => {
    if (featureFile) return URL.createObjectURL(featureFile);
    return form.featureImage || "";
  }, [featureFile, form.featureImage]);

  useEffect(() => {
    let active = true;

    const loadBlogs = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, BLOG_COLLECTION));
        if (!active) return;
        const items = snap.docs
          .map((entry) => normalizeBlog({ id: entry.id, ...entry.data() }))
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

  useEffect(() => {
    return () => {
      if (featurePreview && featureFile) URL.revokeObjectURL(featurePreview);
    };
  }, [featurePreview, featureFile]);

  useEffect(() => {
    if (!editorRef.current) return;
    const sanitized = sanitizeBlogHtml(form.contentHtml || "");
    if (editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }
  }, [form.contentHtml]);

  const syncForm = (key, value) => {
    setForm((prev) => {
      if (key === "title") {
        const nextTitle = value;
        const nextSlug =
          prev.slug && prev.slug !== createBlogSlug(prev.title) ? prev.slug : createBlogSlug(nextTitle);
        const nextSeoTitle = prev.seoTitle || nextTitle;
        return { ...prev, title: nextTitle, slug: nextSlug, seoTitle: nextSeoTitle };
      }
      return { ...prev, [key]: value };
    });
  };

  const resolveUniqueSlug = (baseSlug, currentId = "") => {
    const cleanBase = createBlogSlug(baseSlug);
    let candidate = cleanBase;
    let counter = 2;
    const taken = new Set(
      blogs
        .filter((entry) => entry.id !== currentId)
        .map((entry) => String(entry.slug || "").trim().toLowerCase())
    );

    while (taken.has(candidate)) {
      candidate = `${cleanBase}-${counter}`;
      counter += 1;
    }
    return candidate;
  };

  const uploadFeatureImage = async (slugValue) => {
    if (!featureFile) {
      return {
        featureImage: form.featureImage || "",
        featureImagePath: form.featureImagePath || "",
      };
    }

    const path = `blogs/${slugValue}_${Date.now()}_${featureFile.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, featureFile);
    const featureImage = await getDownloadURL(fileRef);
    return { featureImage, featureImagePath: path };
  };

  const resetForm = () => {
    setForm(initialForm);
    setFeatureFile(null);
  };

  const runEditorCommand = (command, value = null) => {
    if (typeof document === "undefined") return;
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const nextHtml = sanitizeBlogHtml(editorRef.current?.innerHTML || "");
    syncForm("contentHtml", nextHtml);
    syncForm("content", htmlToPlainText(nextHtml));
  };

  const handleEditorInput = () => {
    const nextHtml = sanitizeBlogHtml(editorRef.current?.innerHTML || "");
    setForm((prev) => ({
      ...prev,
      contentHtml: nextHtml,
      content: htmlToPlainText(nextHtml),
    }));
  };

  const handleEditorPaste = (event) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    const pasted = sanitizeBlogHtml(html || convertPlainTextToHtml(text));
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, pasted);
    handleEditorInput();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const slug = resolveUniqueSlug(form.slug || form.title, form.id);
      const imageData = await uploadFeatureImage(slug);
      const cleanedHtml = sanitizeBlogHtml(form.contentHtml || "");
      const trimmedContent = htmlToPlainText(cleanedHtml);
      const resolvedKeywords = form.seoKeywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const payload = {
        title: form.title.trim(),
        slug,
        category: form.category.trim() || "Hepsy Blog",
        author: form.author.trim() || "Hepsy Team",
        excerpt: form.excerpt.trim(),
        content: trimmedContent,
        contentHtml: cleanedHtml,
        seoTitle: form.seoTitle.trim() || form.title.trim(),
        seoDescription: form.seoDescription.trim() || form.excerpt.trim(),
        seoKeywords: resolvedKeywords,
        focusKeyword: form.focusKeyword.trim() || resolvedKeywords[0] || "",
        featureImage: imageData.featureImage,
        featureImagePath: imageData.featureImagePath,
        status: form.status,
        readTime: estimateReadTime(trimmedContent),
        updatedAt: serverTimestamp(),
      };

      if (form.status === "published") {
        payload.publishedAt = serverTimestamp();
      }

      if (form.id) {
        if (featureFile && form.featureImagePath && form.featureImagePath !== imageData.featureImagePath) {
          try {
            await deleteObject(ref(storage, form.featureImagePath));
          } catch {}
        }
        await updateDoc(doc(db, BLOG_COLLECTION, form.id), payload);
        setStatusMessage("Blog updated successfully.");
      } else {
        await addDoc(collection(db, BLOG_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatusMessage("Blog created successfully.");
      }

      const refreshed = await getDocs(collection(db, BLOG_COLLECTION));
      setBlogs(
        refreshed.docs
          .map((entry) => normalizeBlog({ id: entry.id, ...entry.data() }))
          .sort((a, b) => b.publishedAtMs - a.publishedAtMs || b.createdAtMs - a.createdAtMs)
      );
      resetForm();
    } catch (error) {
      setErrorMessage(error?.message || "Failed to save blog.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (blog) => {
    setErrorMessage("");
    setStatusMessage("");
    setFeatureFile(null);
    setForm({
      id: blog.id,
      title: blog.title,
      slug: blog.slug,
      category: blog.category,
      author: blog.author,
      excerpt: blog.excerpt,
      content: blog.content,
      contentHtml: blog.contentHtml || convertPlainTextToHtml(blog.content || ""),
      seoTitle: blog.seoTitle || "",
      seoDescription: blog.seoDescription || "",
      seoKeywords: Array.isArray(blog.seoKeywords) ? blog.seoKeywords.join(", ") : "",
      focusKeyword: blog.focusKeyword || "",
      status: blog.status,
      featureImage: blog.featureImage,
      featureImagePath: blog.featureImagePath || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (blog) => {
    if (!window.confirm(`Delete "${blog.title}"?`)) return;
    try {
      await deleteDoc(doc(db, BLOG_COLLECTION, blog.id));
      if (blog.featureImagePath) {
        try {
          await deleteObject(ref(storage, blog.featureImagePath));
        } catch {}
      }
      setBlogs((prev) => prev.filter((entry) => entry.id !== blog.id));
      if (form.id === blog.id) resetForm();
    } catch (error) {
      setErrorMessage(error?.message || "Failed to delete blog.");
    }
  };

  return (
    <div className="admin-blogs-shell">
      <div className="admin-blogs-grid">
        <section className="admin-blogs-panel">
          <span className="admin-blogs-kicker">Content / Blog Studio</span>
          <h2 className="admin-blogs-title">Create rich blog entries with feature image, summary, and full detail.</h2>
          <p className="admin-blogs-copy">
            Published posts automatically appear on the home page, the full blog list, and their own detail pages.
          </p>

          <form className="admin-blogs-form" onSubmit={handleSubmit}>
            <div className="admin-blogs-field">
              <label htmlFor="blog-title">Title</label>
              <input
                id="blog-title"
                className="admin-blogs-input"
                value={form.title}
                onChange={(event) => syncForm("title", event.target.value)}
                placeholder="Enter blog title"
                required
              />
            </div>

            <div className="admin-blogs-field-row">
              <div className="admin-blogs-field">
                <label htmlFor="blog-slug">Slug</label>
                <input
                  id="blog-slug"
                  className="admin-blogs-input"
                  value={form.slug}
                  onChange={(event) => syncForm("slug", createBlogSlug(event.target.value))}
                  placeholder="blog-slug"
                  required
                />
              </div>
              <div className="admin-blogs-field">
                <label htmlFor="blog-status">Status</label>
                <select
                  id="blog-status"
                  className="admin-blogs-select"
                  value={form.status}
                  onChange={(event) => syncForm("status", event.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            <div className="admin-blogs-field-row">
              <div className="admin-blogs-field">
                <label htmlFor="blog-category">Category</label>
                <input
                  id="blog-category"
                  className="admin-blogs-input"
                  value={form.category}
                  onChange={(event) => syncForm("category", event.target.value)}
                  placeholder="Study Tips / Product Update / School Story"
                />
              </div>
              <div className="admin-blogs-field">
                <label htmlFor="blog-author">Author</label>
                <input
                  id="blog-author"
                  className="admin-blogs-input"
                  value={form.author}
                  onChange={(event) => syncForm("author", event.target.value)}
                  placeholder="Hepsy Team"
                />
              </div>
            </div>

            <div className="admin-blogs-field">
              <label htmlFor="blog-excerpt">Short excerpt</label>
              <textarea
                id="blog-excerpt"
                className="admin-blogs-textarea"
                value={form.excerpt}
                onChange={(event) => syncForm("excerpt", event.target.value)}
                placeholder="Short preview text for home page and blog cards"
                required
              />
            </div>

            <div className="admin-blogs-field">
              <label htmlFor="blog-content">Full blog content</label>
              <div className="admin-blogs-editor-shell">
                <div className="admin-blogs-editor-toolbar">
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<h2>")}>H2</button>
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<h3>")}>H3</button>
                  <button type="button" onClick={() => runEditorCommand("bold")}>Bold</button>
                  <button type="button" onClick={() => runEditorCommand("italic")}>Italic</button>
                  <button type="button" onClick={() => runEditorCommand("insertUnorderedList")}>List</button>
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<blockquote>")}>Quote</button>
                  <button type="button" onClick={() => runEditorCommand("hiliteColor", "#fff3a3")}>Highlight</button>
                  <button type="button" onClick={() => runEditorCommand("removeFormat")}>Clear</button>
                </div>
                <div
                  id="blog-content"
                  ref={editorRef}
                  className="admin-blogs-rich-editor"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onPaste={handleEditorPaste}
                  data-placeholder="Paste your article here. Headings, bold text, highlights, quotes, and lists will be preserved."
                />
              </div>
            </div>

            <div className="admin-blogs-panel seo-panel">
              <span className="admin-blogs-kicker">SEO Essentials</span>
              <p className="admin-blogs-copy">
                Keep these focused for marketing pages. If left blank, the blog title and excerpt will be used automatically.
              </p>

              <div className="admin-blogs-form seo-form">
                <div className="admin-blogs-field">
                  <label htmlFor="blog-seo-title">Meta title</label>
                  <input
                    id="blog-seo-title"
                    className="admin-blogs-input"
                    value={form.seoTitle}
                    onChange={(event) => syncForm("seoTitle", event.target.value)}
                    placeholder="SEO title for Google results"
                  />
                </div>

                <div className="admin-blogs-field">
                  <label htmlFor="blog-seo-description">Meta description</label>
                  <textarea
                    id="blog-seo-description"
                    className="admin-blogs-textarea"
                    value={form.seoDescription}
                    onChange={(event) => syncForm("seoDescription", event.target.value)}
                    placeholder="Short description for search and social previews"
                  />
                </div>

                <div className="admin-blogs-field-row">
                  <div className="admin-blogs-field">
                    <label htmlFor="blog-focus-keyword">Focus keyword</label>
                    <input
                      id="blog-focus-keyword"
                      className="admin-blogs-input"
                      value={form.focusKeyword}
                      onChange={(event) => syncForm("focusKeyword", event.target.value)}
                      placeholder="primary keyword"
                    />
                  </div>
                  <div className="admin-blogs-field">
                    <label htmlFor="blog-seo-keywords">SEO keywords</label>
                    <input
                      id="blog-seo-keywords"
                      className="admin-blogs-input"
                      value={form.seoKeywords}
                      onChange={(event) => syncForm("seoKeywords", event.target.value)}
                      placeholder="keyword 1, keyword 2, keyword 3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="admin-blogs-field">
              <label htmlFor="blog-feature-image">Feature image</label>
              <input
                id="blog-feature-image"
                type="file"
                accept="image/*"
                className="admin-blogs-input"
                onChange={(event) => setFeatureFile(event.target.files?.[0] || null)}
              />
            </div>

            <div
              className={`admin-blogs-feature-preview ${featurePreview ? "has-image" : ""}`}
              style={
                featurePreview
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(7, 12, 24, 0.12), rgba(7, 12, 24, 0.78)), url(${featurePreview})`,
                    }
                  : undefined
              }
            >
              {featurePreview ? (
                <div className="admin-blogs-feature-copy">
                  <span>{form.category || "Hepsy Blog"}</span>
                  <strong>{form.title || "Blog preview card"}</strong>
                </div>
              ) : (
                <div className="admin-blogs-empty">Upload a feature image to preview how the public card will feel.</div>
              )}
            </div>

            <div className="admin-blogs-actions">
              <button type="submit" className="admin-blogs-btn primary" disabled={saving}>
                {saving ? "Saving..." : form.id ? "Update Blog" : "Publish Blog"}
              </button>
              <button type="button" className="admin-blogs-btn secondary" onClick={resetForm}>
                Clear Form
              </button>
            </div>
          </form>

          {statusMessage && <div className="admin-blogs-status">{statusMessage}</div>}
          {errorMessage && <div className="admin-blogs-status error">{errorMessage}</div>}
        </section>

        <section className="admin-blogs-panel">
          <span className="admin-blogs-kicker">Library</span>
          <h2 className="admin-blogs-title">Manage published and draft blogs.</h2>
          <p className="admin-blogs-copy">Edit slugs, revise images, switch draft/published status, or remove old entries.</p>

          <div className="admin-blogs-list">
            {loading ? (
              <div className="admin-blogs-empty">Loading blogs...</div>
            ) : blogs.length === 0 ? (
              <div className="admin-blogs-empty">No blogs yet. Your first published post will appear here.</div>
            ) : (
              blogs.map((blog) => (
                <article key={blog.id} className="admin-blogs-card">
                  <div className="admin-blogs-card-head">
                    <div>
                      <span className="admin-blogs-pill">{blog.status}</span>
                      <h3>{blog.title}</h3>
                    </div>
                  </div>
                  <p>{blog.excerpt}</p>
                  <div className="admin-blogs-meta">
                    <span>{blog.category}</span>
                    <span>{blog.author}</span>
                    <span>{formatBlogDate(blog.publishedAt)}</span>
                    <span>{blog.readTime} min read</span>
                    {blog.focusKeyword ? <span>SEO: {blog.focusKeyword}</span> : null}
                  </div>
                  <div className="admin-blogs-card-actions">
                    <button type="button" className="admin-blogs-card-btn edit" onClick={() => handleEdit(blog)}>
                      Edit
                    </button>
                    <button type="button" className="admin-blogs-card-btn delete" onClick={() => handleDelete(blog)}>
                      Delete
                    </button>
                    {blog.status === "published" && (
                      <a
                        href={`/blogs/${blog.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="admin-blogs-card-btn link"
                      >
                        Open
                      </a>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
