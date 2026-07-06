import React from "react";
import { Helmet } from "react-helmet-async";

export default function SeoHelmet({
  title,
  description,
  keywords = [],
  canonicalUrl,
  type = "website",
  image,
  twitterCard,
  schemas = [],
}) {
  const keywordContent = Array.isArray(keywords) ? keywords.filter(Boolean).join(", ") : String(keywords || "");
  const resolvedTwitterCard = twitterCard || (image ? "summary_large_image" : "summary");
  const validSchemas = Array.isArray(schemas) ? schemas.filter(Boolean) : [];

  return (
    <Helmet prioritizeSeoTags>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {keywordContent ? <meta name="keywords" content={keywordContent} /> : null}
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

      {title ? <meta property="og:title" content={title} /> : null}
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:type" content={type} />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      {image ? <meta property="og:image" content={image} /> : null}

      <meta name="twitter:card" content={resolvedTwitterCard} />
      {title ? <meta name="twitter:title" content={title} /> : null}
      {description ? <meta name="twitter:description" content={description} /> : null}
      {image ? <meta name="twitter:image" content={image} /> : null}

      {validSchemas.map((schema, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
