import React, { useEffect, useMemo, useState } from "react";
import { setDoc } from "firebase/firestore";
import { fetchDemoContent, getDemoContentRef } from "../../utils/demoContent";

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Student Demo</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: linear-gradient(135deg, #eff6ff, #ffffff); color: #0f172a; }
      .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
      .card { background: #ffffff; border-radius: 20px; padding: 32px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12); }
      h1 { margin-top: 0; font-size: 32px; }
      p { line-height: 1.6; }
      a { display: inline-block; margin-top: 16px; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Student Demo</h1>
        <p>Paste your own HTML here from the admin panel to replace this demo.</p>
        <a href="/login">Open student login</a>
      </div>
    </div>
  </body>
</html>`;

export default function AdminHtmlDemoManager() {
  const [title, setTitle] = useState("Demo");
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchDemoContent();
        setTitle(data.title || "Demo");
        setHtml(data.html || DEFAULT_HTML);
      } catch (err) {
        setStatus(err.message || "Unable to load saved demo content.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const previewHtml = useMemo(() => html || DEFAULT_HTML, [html]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setHtml(text);
    setStatus(`Loaded ${file.name}. Save to publish it.`);
    event.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      await setDoc(
        getDemoContentRef(),
        {
          title: String(title || "Demo").trim() || "Demo",
          html: previewHtml,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setStatus("Demo content saved successfully.");
    } catch (err) {
      setStatus(err.message || "Failed to save demo content.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-demo-manager">
      <div className="admin-demo-hero">
        <div>
          <span className="admin-demo-kicker">Admin / Demo</span>
          <h2>Upload or paste student demo HTML</h2>
          <p>This content will be shown from the small demo links on the login page and student form.</p>
        </div>
        <a className="admin-demo-open-link" href="/demo-view" target="_blank" rel="noreferrer">
          Open live demo
        </a>
      </div>

      <div className="admin-demo-panel">
        <label className="admin-demo-label">
          Demo label
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Demo" />
        </label>

        <div className="admin-demo-actions">
          <label className="admin-demo-file">
            Load HTML file
            <input type="file" accept=".html,text/html" onChange={handleFileUpload} />
          </label>
          <button type="button" onClick={() => setHtml(DEFAULT_HTML)}>
            Reset sample
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save demo"}
          </button>
        </div>

        <label className="admin-demo-label">
          HTML code
          <textarea
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            placeholder="Paste HTML code here"
            rows={18}
            spellCheck="false"
          />
        </label>

        {status && <p className="admin-demo-status">{status}</p>}

        <div className="admin-demo-preview">
          <div className="admin-demo-preview-head">
            <strong>Preview</strong>
            <span>{loading ? "Loading saved content..." : "Updates after save"}</span>
          </div>
          <iframe
            title="Student demo preview"
            srcDoc={previewHtml}
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
          />
        </div>
      </div>
    </section>
  );
}
