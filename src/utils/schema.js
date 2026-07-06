import { BLOG_SITE_URL } from "./blogs";

export const SITE_NAME = "Hepsy";
export const SITE_URL = BLOG_SITE_URL;
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/images/logo.png`;

export const absoluteUrl = (value = "") => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const path = String(value).startsWith("/") ? value : `/${value}`;
  return `${SITE_URL}${path}`;
};

export const buildOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: absoluteUrl("/images/logo.png"),
});

export const buildWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
  },
});

export const buildHomePageSchema = ({ description, plans = [] }) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `${SITE_NAME} Learning Platform`,
  url: SITE_URL,
  description,
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: plans.map((plan, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: plan.name,
      url: absoluteUrl(plan.url || "/pricing"),
    })),
  },
});

export const buildArticleSchema = (blog) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: blog.seoTitle,
  description: blog.seoDescription,
  image: blog.featureImage ? [absoluteUrl(blog.featureImage)] : [DEFAULT_SOCIAL_IMAGE],
  author: {
    "@type": "Person",
    name: blog.author || `${SITE_NAME} Team`,
  },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/images/logo.png"),
    },
  },
  mainEntityOfPage: blog.canonicalUrl,
  datePublished: blog.publishedAtMs ? new Date(blog.publishedAtMs).toISOString() : undefined,
  dateModified: blog.updatedAtMs
    ? new Date(blog.updatedAtMs).toISOString()
    : blog.publishedAtMs
    ? new Date(blog.publishedAtMs).toISOString()
    : undefined,
  keywords: blog.seoKeywords?.join(", "),
});

export const buildPricingProductSchema = ({ plan, price, features = [] }) => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: plan.name,
  description: plan.description,
  category: "Educational Subscription",
  image: DEFAULT_SOCIAL_IMAGE,
  brand: {
    "@type": "Brand",
    name: SITE_NAME,
  },
  additionalProperty: features.map((feature) => ({
    "@type": "PropertyValue",
    name: "Included feature",
    value: String(feature || "").replace(/^[^A-Za-z0-9]+/, "").trim(),
  })),
  offers: {
    "@type": "Offer",
    price: String(price),
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: absoluteUrl(`/subscribe?plan=${encodeURIComponent(plan.id)}`),
    category: "subscription",
  },
});
