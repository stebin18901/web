import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchDemoContent } from "../utils/demoContent";

export default function DemoViewer() {
  const [demo, setDemo] = useState({ title: "Demo", html: "", updatedAt: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDemoContent();
        setDemo(data);
      } catch (err) {
        setError(err.message || "Unable to load demo content.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 55%, #ffffff 100%)",
        padding: "24px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe4f0",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#2563eb", fontWeight: 700 }}>Student Demo</p>
              <h1 style={{ margin: "6px 0 8px", color: "#0f172a" }}>{demo.title || "Demo"}</h1>
              <p style={{ margin: 0, color: "#475569" }}>
                {loading
                  ? "Loading live demo..."
                  : demo.updatedAt
                  ? `Last updated: ${new Date(demo.updatedAt).toLocaleString()}`
                  : "No saved HTML yet. Add content from the admin Demo tab."}
              </p>
            </div>
            <Link
              to="/login"
              style={{
                textDecoration: "none",
                background: "#0f172a",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              Back to login
            </Link>
          </div>
        </div>

        {error ? (
          <div
            style={{
              background: "#fff1f2",
              color: "#be123c",
              border: "1px solid #fecdd3",
              borderRadius: 18,
              padding: 16,
            }}
          >
            {error}
          </div>
        ) : (
          <iframe
            title="Saved demo content"
            srcDoc={
              demo.html ||
              "<html><body style='font-family:Arial,sans-serif;padding:24px'>No demo HTML saved yet.</body></html>"
            }
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            style={{
              width: "100%",
              minHeight: "75vh",
              border: "1px solid #dbe4f0",
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
            }}
          />
        )}
      </div>
    </div>
  );
}
