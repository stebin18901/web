import React from "react";
import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { Download, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { db } from "../../firebase/firebaseConfig";
import "./AdminSchoolAdminGuideManager.css";

const SAMPLE_PATH = "/data/school-admin-chat-guide.json";

const normalize = (value) => String(value || "").trim();

const prettyJson = (value) => JSON.stringify(value, null, 2);

export default function AdminSchoolAdminGuideManager() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [jsonText, setJsonText] = React.useState("");
  const [preview, setPreview] = React.useState([]);
  const [liveCount, setLiveCount] = React.useState(0);

  const refreshLiveCount = React.useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "schoolAdminChatGuide"));
      setLiveCount(snap.size);
    } catch (error) {
      console.error("Unable to read live school admin guide count", error);
    }
  }, []);

  React.useEffect(() => {
    refreshLiveCount();
  }, [refreshLiveCount]);

  const updatePreviewFromText = (value) => {
    setJsonText(value);
    try {
      const parsed = JSON.parse(value);
      const docs = Array.isArray(parsed?.documents) ? parsed.documents : [];
      setPreview(docs.slice(0, 8));
      setStatus(docs.length ? `Parsed ${docs.length} guide document${docs.length === 1 ? "" : "s"}.` : "JSON parsed, but no documents were found.");
    } catch {
      setPreview([]);
      if (normalize(value)) {
        setStatus("JSON is not valid yet.");
      } else {
        setStatus("");
      }
    }
  };

  const loadSample = async () => {
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch(SAMPLE_PATH);
      const data = await response.json();
      const nextText = prettyJson(data);
      setJsonText(nextText);
      setPreview(Array.isArray(data.documents) ? data.documents.slice(0, 8) : []);
      setStatus(`Loaded sample guide from ${SAMPLE_PATH}.`);
    } catch (error) {
      console.error("Unable to load sample guide JSON", error);
      setStatus("Unable to load the sample guide JSON file.");
    } finally {
      setLoading(false);
    }
  };

  const saveGuide = async () => {
    if (!normalize(jsonText)) {
      setStatus("Paste the guide JSON first.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const parsed = JSON.parse(jsonText);
      const documents = Array.isArray(parsed?.documents) ? parsed.documents : [];
      if (!documents.length) {
        throw new Error("No documents found inside the JSON payload.");
      }

      const batch = writeBatch(db);
      documents.forEach((entry, index) => {
        const docId = normalize(entry.id || entry.slug || `school_admin_guide_${index + 1}`);
        batch.set(
          doc(db, "schoolAdminChatGuide", docId),
          {
            ...entry,
            id: docId,
            active: entry.active !== false,
            prompts: Array.isArray(entry.prompts) ? entry.prompts : [],
            steps: Array.isArray(entry.steps) ? entry.steps : [],
            updatedAt: serverTimestamp(),
            updatedBy: "admin189201",
            source: "admin_json_import",
          },
          { merge: true }
        );
      });
      batch.set(
        doc(db, "schoolAdminChatGuide", "__meta__"),
        {
          type: "meta",
          title: "School Admin Guide Meta",
          version: normalize(parsed?.version || "1.0.0"),
          collection: "schoolAdminChatGuide",
          importedAt: serverTimestamp(),
          importedBy: "admin189201",
          documentsCount: documents.length,
          active: false,
          audience: "admin_only",
        },
        { merge: true }
      );
      await batch.commit();
      setStatus(`Saved ${documents.length} school-admin guide document${documents.length === 1 ? "" : "s"} to Firestore.`);
      setPreview(documents.slice(0, 8));
      refreshLiveCount();
    } catch (error) {
      console.error("Unable to save school admin guide", error);
      setStatus(error.message || "Unable to save the school-admin guide JSON.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-school-guide">
      <section className="admin-school-guide__hero">
        <div>
          <p className="admin-school-guide__eyebrow">School Admin Help Guide</p>
          <h2>Upload chatbot instructions for the school-admin workspace</h2>
          <p>
            Paste the full JSON guide here, save it into the Firestore collection
            <strong> schoolAdminChatGuide</strong>, and the bottom-right school-admin help chatbot will
            automatically use those instructions.
          </p>
        </div>
        <div className="admin-school-guide__stats">
          <article>
            <span>Live docs</span>
            <strong>{liveCount}</strong>
          </article>
          <article>
            <span>Sample file</span>
            <strong>{SAMPLE_PATH}</strong>
          </article>
        </div>
      </section>

      <section className="admin-school-guide__workspace">
        <div className="admin-school-guide__editor">
          <div className="admin-school-guide__toolbar">
            <button type="button" onClick={loadSample} disabled={loading}>
              {loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
              Load sample JSON
            </button>
            <a href={SAMPLE_PATH} download>
              <Download size={15} />
              Download sample
            </a>
            <button type="button" onClick={refreshLiveCount}>
              <RefreshCw size={15} />
              Refresh count
            </button>
            <button type="button" className="primary" onClick={saveGuide} disabled={saving}>
              {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
              {saving ? "Saving..." : "Save to Firestore"}
            </button>
          </div>

          <textarea
            value={jsonText}
            onChange={(event) => updatePreviewFromText(event.target.value)}
            placeholder='Paste JSON like: { "version": "1.0.0", "documents": [...] }'
          />

          {status ? <div className="admin-school-guide__status">{status}</div> : null}
        </div>

        <div className="admin-school-guide__preview">
          <h3>Preview</h3>
          {!preview.length ? (
            <div className="admin-school-guide__empty">No parsed guide documents yet.</div>
          ) : (
            <div className="admin-school-guide__preview-list">
              {preview.map((item, index) => (
                <article key={item.id || index}>
                  <span>{item.category || "General"}</span>
                  <strong>{item.title || item.id || `Guide ${index + 1}`}</strong>
                  <p>{item.route || item.answer || "No preview text available."}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
