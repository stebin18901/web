import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./StudentNotePage.css";

const makeProgressDocId = (studentId, conceptKey) =>
  `${String(studentId || "unknown")}__${String(conceptKey || "").replace(/[^a-z0-9_]+/gi, "_")}`;

const StudentNotePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const noteHtml = location.state?.noteHtml || "";
  const title = location.state?.title || "Notes";
  const chapter = location.state?.chapter || "";
  const subject = location.state?.subject || "";
  const topics = useMemo(
    () => (Array.isArray(location.state?.topics) ? location.state.topics : []),
    [location.state?.topics]
  );
  const quizIds = Array.isArray(location.state?.quizIds) ? location.state.quizIds : [];
  const initialActiveTopicKey = String(location.state?.activeTopicKey || "").toLowerCase();
  const [activeTopicKey, setActiveTopicKey] = useState(initialActiveTopicKey);
  const [saving, setSaving] = useState(false);
  const activeTopic = useMemo(
    () => topics.find((t) => String(t.key || "").toLowerCase() === String(activeTopicKey || "").toLowerCase()) || null,
    [topics, activeTopicKey]
  );
  const activeIndex = useMemo(
    () => topics.findIndex((t) => String(t.key || "").toLowerCase() === String(activeTopicKey || "").toLowerCase()),
    [topics, activeTopicKey]
  );
  const hasTopics = topics.length > 0;
  const isLastTopic = hasTopics && activeIndex >= topics.length - 1;

  const markTopicCompleted = async (topic) => {
    if (!topic?.key) return;
    const rawSession = localStorage.getItem("schoolStudentSession");
    const session = rawSession ? JSON.parse(rawSession) : null;
    if (!session?.id) return;

    const payload = {
      studentId: session.id,
      studentName: session.name || "Student",
      schoolId: session.schoolId,
      className: session.className || "",
      subject: topic.subject || subject || "General",
      chapter: topic.chapter || chapter || "",
      concept: topic.name || title || "",
      conceptKey: topic.key,
      noteCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    const docId = makeProgressDocId(session.id, topic.key);
    await setDoc(doc(db, "learningProgress", docId), payload, { merge: true });
  };

  const handleNextSection = async () => {
    if (!hasTopics || activeIndex < 0 || activeIndex >= topics.length - 1 || saving) return;
    setSaving(true);
    try {
      await markTopicCompleted(topics[activeIndex]);
      setActiveTopicKey(String(topics[activeIndex + 1]?.key || "").toLowerCase());
    } finally {
      setSaving(false);
    }
  };

  const handleTestNow = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (hasTopics && activeIndex >= 0) {
        await markTopicCompleted(topics[activeIndex]);
      }
      if (quizIds.length > 0) {
        navigate(`/quiz/${quizIds[0]}`, {
          state: {
            mode: "chapter",
            chapterName: chapter || "Chapter Quiz",
            quizIds,
          },
        });
        return;
      }
      navigate("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  const srcDoc = useMemo(() => {
    const resolvedNoteHtml = activeTopic?.noteHtml || noteHtml;
    if (!resolvedNoteHtml) return "";
    const trimmed = String(resolvedNoteHtml).trim();
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(trimmed, "text/html");
      const head = parsed.head?.innerHTML || "";
      const noteCard = parsed.querySelector(".content-area .note-card") || parsed.querySelector(".note-card");
      const content = noteCard ? noteCard.outerHTML : (parsed.body?.innerHTML || trimmed);
      const scripts = Array.from(parsed.querySelectorAll("script"))
        .map((s) => s.outerHTML)
        .join("\n");

      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  ${head}
  <style>
    body { margin: 0; padding: 0; background: transparent; }
    .note-card { margin: 0 !important; }
    .footer-controls { display: none !important; }
  </style>
</head>
<body>
  ${content}
  ${scripts}
  <script>
    (function () {
      function applyLatex(root) {
        if (!window.renderMathInElement || !root) return;
        try {
          window.renderMathInElement(root, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "\\\\[", right: "\\\\]", display: true },
              { left: "\\(", right: "\\)", display: false },
              { left: "$", right: "$", display: false }
            ],
            throwOnError: false
          });
        } catch (e) {}
      }

      function boot() {
        // One pass + one delayed pass for late script inserts.
        // Avoid MutationObserver loops (major source of UI hangs on large notes).
        applyLatex(document.body);
        setTimeout(function () {
          applyLatex(document.body);
        }, 180);
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          if (window.requestIdleCallback) {
            requestIdleCallback(boot, { timeout: 300 });
          } else {
            setTimeout(boot, 60);
          }
        });
      } else {
        if (window.requestIdleCallback) {
          requestIdleCallback(boot, { timeout: 300 });
        } else {
          setTimeout(boot, 60);
        }
      }
    })();
  </script>
</body>
</html>`;
    } catch (e) {
      return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body>${trimmed}</body></html>`;
    }
  }, [noteHtml, activeTopic?.noteHtml]);

  return (
    <div className="student-note-page">
      <nav className="notes-navbar">
        <div className="notes-nav-left">
          <button className="notes-back-btn" onClick={() => navigate("/dashboard")}>Back</button>
          <div className="notes-brand">
            <div className="notes-brand-icon">M</div>
            MINT
          </div>
        </div>
        <div className="notes-nav-center">
          <h1>{chapter || "Chapter Notes"}</h1>
          <p>{subject || "Subject"} | {title}</p>
        </div>
      </nav>

      <div className="notes-workspace">
        <aside className="notes-sidebar">
          <h3>Topics in this Chapter</h3>
          <ul>
            {topics.length === 0 ? (
              <li className="notes-topic-item active">{title}</li>
            ) : (
              topics.map((item, idx) => (
                <li
                  key={`${item.key}-${idx}`}
                  className={`notes-topic-item ${item.key === activeTopicKey ? "active" : ""} ${item.done ? "done" : ""}`}
                  onClick={() => setActiveTopicKey(String(item.key || "").toLowerCase())}
                >
                  <span>{item.done ? "✓ " : ""}{idx + 1}. {item.name}</span>
                </li>
              ))
            )}
          </ul>
        </aside>

        <main className="notes-main">
          {!srcDoc ? (
            <div className="note-empty">No notes available for this concept.</div>
          ) : (
            <>
              <iframe
                title="Concept Notes"
                className="note-frame"
                srcDoc={srcDoc}
                loading="lazy"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
              />
              {hasTopics && (
                <div className="notes-footer-actions">
                  {!isLastTopic ? (
                    <button className="notes-next-btn" onClick={handleNextSection} disabled={saving}>
                      {saving ? "Saving..." : "Next Section"}
                    </button>
                  ) : (
                    <button className="notes-test-btn" onClick={handleTestNow} disabled={saving}>
                      {saving ? "Saving..." : "Test Now"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StudentNotePage;
