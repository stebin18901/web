export const BLOG_COLLECTION = "blogs";
export const BLOG_SITE_URL = "https://hepsy.in";

export const createBlogSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `blog-${Date.now()}`;

export const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
};

export const estimateReadTime = (content = "") => {
  const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
};

export const htmlToPlainText = (value = "") =>
  String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

export const convertPlainTextToHtml = (value = "") => {
  const paragraphs = String(value || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!paragraphs.length) return "";
  return paragraphs.map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`).join("");
};

export const sanitizeBlogHtml = (value = "") => {
  if (!value || typeof window === "undefined") return String(value || "").trim();

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  const allowed = new Set([
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "MARK",
    "H1",
    "H2",
    "H3",
    "H4",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "A",
    "SPAN",
  ]);

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }

    const tag = node.tagName.toUpperCase();

    if (!allowed.has(tag)) {
      const fragment = doc.createDocumentFragment();
      while (node.firstChild) fragment.appendChild(node.firstChild);
      node.replaceWith(fragment);
      return;
    }

    if (tag === "SPAN") {
      const style = String(node.getAttribute("style") || "").toLowerCase();
      if (style.includes("background") || style.includes("font-weight:700") || style.includes("font-weight: 700")) {
        const replacement = doc.createElement(style.includes("background") ? "mark" : "strong");
        replacement.innerHTML = node.innerHTML;
        node.replaceWith(replacement);
        walk(replacement);
        return;
      }
      const fragment = doc.createDocumentFragment();
      while (node.firstChild) fragment.appendChild(node.firstChild);
      node.replaceWith(fragment);
      return;
    }

    if (tag === "B") {
      const replacement = doc.createElement("strong");
      replacement.innerHTML = node.innerHTML;
      node.replaceWith(replacement);
      walk(replacement);
      return;
    }

    if (tag === "I") {
      const replacement = doc.createElement("em");
      replacement.innerHTML = node.innerHTML;
      node.replaceWith(replacement);
      walk(replacement);
      return;
    }

    if (tag === "H1") {
      const replacement = doc.createElement("h2");
      replacement.innerHTML = node.innerHTML;
      node.replaceWith(replacement);
      walk(replacement);
      return;
    }

    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (tag === "A" && ["href", "target", "rel"].includes(name)) return;
      node.removeAttribute(attr.name);
    });

    if (tag === "A") {
      const href = String(node.getAttribute("href") || "").trim();
      if (!href || /^javascript:/i.test(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }

    [...node.childNodes].forEach(walk);
  };

  [...root.childNodes].forEach(walk);
  return root.innerHTML.trim();
};

export const formatBlogDate = (value) => {
  const millis = toMillis(value);
  if (!millis) return "Draft";
  return new Date(millis).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const normalizeBlog = (blog) => {
  const title = String(blog?.title || "Untitled story").trim();
  const contentHtml = sanitizeBlogHtml(
    String(blog?.contentHtml || "").trim() || convertPlainTextToHtml(blog?.content || "")
  );
  const content = String(blog?.content || "").trim() || htmlToPlainText(contentHtml);
  const excerpt =
    String(blog?.excerpt || "").trim() ||
    htmlToPlainText(contentHtml).split(/\n+/).find(Boolean)?.slice(0, 180) ||
    content.split(/\n+/).find(Boolean)?.slice(0, 180) ||
    "Fresh updates from Hepsy.";
  const seoTitle = String(blog?.seoTitle || "").trim() || title;
  const seoDescription =
    String(blog?.seoDescription || "").trim() ||
    excerpt ||
    "Fresh updates from Hepsy.";
  const keywords = Array.isArray(blog?.seoKeywords)
    ? blog.seoKeywords.map((item) => String(item || "").trim()).filter(Boolean)
    : String(blog?.seoKeywords || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const publishedAt = blog?.publishedAt || blog?.createdAt || blog?.updatedAt || null;

  return {
    id: blog?.id || "",
    title,
    slug: String(blog?.slug || createBlogSlug(title)).trim(),
    excerpt,
    content,
    contentHtml,
    category: String(blog?.category || "Hepsy Blog").trim(),
    author: String(blog?.author || "Hepsy Team").trim(),
    status: String(blog?.status || "draft").trim().toLowerCase(),
    featureImage: String(blog?.featureImage || "").trim(),
    featureImagePath: String(blog?.featureImagePath || "").trim(),
    seoTitle,
    seoDescription,
    seoKeywords: keywords,
    focusKeyword: String(blog?.focusKeyword || keywords[0] || "").trim(),
    canonicalUrl: `${BLOG_SITE_URL}/blogs/${String(blog?.slug || createBlogSlug(title)).trim()}`,
    createdAt: blog?.createdAt || null,
    updatedAt: blog?.updatedAt || null,
    publishedAt,
    readTime: Number(blog?.readTime || estimateReadTime(content)),
    publishedAtMs: toMillis(publishedAt),
    createdAtMs: toMillis(blog?.createdAt),
    updatedAtMs: toMillis(blog?.updatedAt),
  };
};
