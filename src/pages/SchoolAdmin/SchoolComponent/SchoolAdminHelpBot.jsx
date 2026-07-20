import React from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  Bot,
  ChevronRight,
  Compass,
  HelpCircle,
  Loader2,
  MessageCircleQuestion,
  PanelsTopLeft,
  Sparkles,
  X,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./SchoolAdminHelpBot.css";

const normalize = (value) => String(value || "").trim();
const FALLBACK_GUIDE_PATH = "/data/school-admin-chat-guide.json";

const formatGuideItem = (entry) => {
  const data = entry.data() || {};
  return {
    id: entry.id,
    title: normalize(data.title),
    category: normalize(data.category || "General"),
    prompts: Array.isArray(data.prompts) ? data.prompts.map((item) => normalize(item)).filter(Boolean) : [],
    answer: normalize(data.answer),
    steps: Array.isArray(data.steps) ? data.steps.map((item) => normalize(item)).filter(Boolean) : [],
    note: normalize(data.note),
    route: normalize(data.route),
    audience: normalize(data.audience || "school_admin"),
    order: Number(data.order || 9999),
    active: data.active !== false,
  };
};

const formatGuideDocument = (data = {}, fallbackId = "") => ({
  id: normalize(data.id || fallbackId),
  title: normalize(data.title),
  category: normalize(data.category || "General"),
  prompts: Array.isArray(data.prompts) ? data.prompts.map((item) => normalize(item)).filter(Boolean) : [],
  answer: normalize(data.answer),
  steps: Array.isArray(data.steps) ? data.steps.map((item) => normalize(item)).filter(Boolean) : [],
  note: normalize(data.note),
  route: normalize(data.route),
  audience: normalize(data.audience || "school_admin"),
  order: Number(data.order || 9999),
  active: data.active !== false,
});

export default function SchoolAdminHelpBot({ schoolId = "", academicYear = "" }) {
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);
  const [showPanel, setShowPanel] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [guides, setGuides] = React.useState([]);
  const [error, setError] = React.useState("");
  const [selectedId, setSelectedId] = React.useState("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let timeoutId;
    if (open) {
      setShowPanel(true);
      setIsClosing(false);
    } else if (showPanel) {
      setIsClosing(true);
      timeoutId = window.setTimeout(() => {
        setShowPanel(false);
        setIsClosing(false);
      }, 240);
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [open, showPanel]);

  const currentSection = React.useMemo(() => {
    const pathname = location.pathname || "";
    if (pathname.includes("/students")) return "Students";
    if (pathname.includes("/attendance")) return "Attendance";
    if (pathname.includes("/academics")) return "Academics";
    if (pathname.includes("/fees")) return "Fees";
    if (pathname.includes("/announcements")) return "Announcements";
    if (pathname.includes("/settings")) return "Settings";
    return "Dashboard";
  }, [location.pathname]);

  React.useEffect(() => {
    if (!open) return;
    const loadGuide = async () => {
      setLoading(true);
      setError("");
      try {
        const snap = await getDocs(collection(db, "schoolAdminChatGuide"));
        let items = snap.docs
          .map(formatGuideItem)
          .filter((item) => item.active && item.audience !== "admin_only")
          .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));

        if (!items.length) {
          const response = await fetch(FALLBACK_GUIDE_PATH);
          const payload = await response.json();
          items = (Array.isArray(payload?.documents) ? payload.documents : [])
            .map((item, index) => formatGuideDocument(item, `fallback_${index + 1}`))
            .filter((item) => item.active && item.audience !== "admin_only")
            .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
        }

        setGuides(items);
        setSelectedId((current) => current || items[0]?.id || "");
      } catch (loadError) {
        console.error("Unable to load school admin help guide", loadError);
        try {
          const response = await fetch(FALLBACK_GUIDE_PATH);
          const payload = await response.json();
          const items = (Array.isArray(payload?.documents) ? payload.documents : [])
            .map((item, index) => formatGuideDocument(item, `fallback_${index + 1}`))
            .filter((item) => item.active && item.audience !== "admin_only")
            .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
          setGuides(items);
          setSelectedId((current) => current || items[0]?.id || "");
          setError("");
        } catch (fallbackError) {
          console.error("Unable to load fallback school admin help guide", fallbackError);
          setError("Unable to load help guide right now.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, [open]);

  const contextualGuides = React.useMemo(() => {
    const sectionKey = currentSection.toLowerCase();
    const bySection = guides.filter((item) => {
      const category = normalize(item.category).toLowerCase();
      const route = normalize(item.route).toLowerCase();
      return (
        category === sectionKey ||
        route.includes(`/school-admin/${sectionKey}`) ||
        (sectionKey === "dashboard" && ["dashboard", "workflow", "general"].includes(category))
      );
    });
    if (bySection.length) return bySection;
    return guides.filter((item) => ["Workflow", "General", "Dashboard", "Academic Year"].includes(item.category));
  }, [currentSection, guides]);

  const groupedGuides = React.useMemo(() => {
    const orderedItems = [
      ...contextualGuides,
      ...guides.filter(
        (item) =>
          !contextualGuides.some((current) => current.id === item.id) &&
          ["Workflow", "General", "Academic Year", "Dashboard"].includes(item.category)
      ),
    ];
    return orderedItems.reduce((accumulator, item) => {
      const key = item.category || "General";
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(item);
      return accumulator;
    }, {});
  }, [contextualGuides, guides]);

  const selectedGuide =
    contextualGuides.find((item) => item.id === selectedId) ||
    guides.find((item) => item.id === selectedId) ||
    contextualGuides[0] ||
    guides[0] ||
    null;

  React.useEffect(() => {
    if (contextualGuides[0] && !contextualGuides.some((item) => item.id === selectedId)) {
      setSelectedId(contextualGuides[0].id);
    }
  }, [contextualGuides, selectedId]);

  const topQuestions = React.useMemo(() => contextualGuides.slice(0, 6), [contextualGuides]);
  const relatedQuestions = React.useMemo(
    () => contextualGuides.filter((item) => item.id !== selectedGuide?.id).slice(0, 6),
    [contextualGuides, selectedGuide]
  );

  const handleToggle = () => {
    setOpen((current) => !current);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const helpBotUi = (
    <div className={`school-help-bot ${open ? "open" : ""} ${isClosing ? "closing" : ""}`}>
      {showPanel ? (
        <div className={`school-help-panel ${open && !isClosing ? "enter" : ""} ${isClosing ? "exit" : ""}`}>
          <div className="school-help-head">
            <div className="school-help-brand">
              <div className="school-help-brand-icon">
                <Bot size={16} />
              </div>
              <div>
                <strong>School Admin Help</strong>
                <span>{normalize(schoolId) || "School"} {academicYear ? `| Year ${academicYear}` : ""}</span>
              </div>
            </div>
            <div className="school-help-section-chip">
              <PanelsTopLeft size={14} />
              {currentSection}
            </div>
            <button type="button" className="school-help-close" onClick={handleClose} aria-label="Close help">
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <div className="school-help-state">
              <Loader2 size={16} className="spin" />
              Loading guide...
            </div>
          ) : error ? (
            <div className="school-help-state">{error}</div>
          ) : (
            <div className="school-help-body">
              <div className="school-help-list">
                <div className="school-help-list-head">
                  <div>
                    <p>Best help for this page</p>
                    <h4>{currentSection} questions</h4>
                  </div>
                  <span>{topQuestions.length}</span>
                </div>

                <div className="school-help-question-stack">
                  {topQuestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`school-help-item priority ${selectedGuide?.id === item.id ? "active" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <div>
                        <small>Question {index + 1}</small>
                        <span>{item.title}</span>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>

                {Object.entries(groupedGuides).map(([category, items]) => (
                  <div key={category} className="school-help-group">
                    <p>{category}</p>
                    {items.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`school-help-item ${selectedGuide?.id === item.id ? "active" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <span>{item.title}</span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="school-help-content">
                {selectedGuide ? (
                  <>
                    <div className="school-help-content-head">
                      <div className="school-help-content-badges">
                        <span>{selectedGuide.category}</span>
                        {selectedGuide.route ? <span className="route">{selectedGuide.route}</span> : null}
                      </div>
                      <h4>{selectedGuide.title}</h4>
                    </div>
                    <p className="school-help-answer">{selectedGuide.answer}</p>

                    {selectedGuide.steps.length ? (
                      <div className="school-help-steps">
                        <strong>Steps</strong>
                        <ol>
                          {selectedGuide.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {selectedGuide.note ? (
                      <div className="school-help-note">
                        <HelpCircle size={14} />
                        <span>{selectedGuide.note}</span>
                      </div>
                    ) : null}

                    {selectedGuide.prompts.length || relatedQuestions.length ? (
                      <div className="school-help-prompts">
                        <strong>Next helpful questions</strong>
                        <div className="school-help-prompt-list">
                          {selectedGuide.prompts.slice(0, 4).map((prompt) => {
                            const matchedGuide = contextualGuides.find(
                              (item) =>
                                item.id !== selectedGuide.id &&
                                [item.title, ...(item.prompts || [])].some(
                                  (value) => value.toLowerCase() === prompt.toLowerCase()
                                )
                            );
                            return (
                              <button
                                key={prompt}
                                type="button"
                                onClick={() => matchedGuide && setSelectedId(matchedGuide.id)}
                              >
                                <Sparkles size={13} />
                                {prompt}
                              </button>
                            );
                          })}
                          {relatedQuestions.slice(0, 4).map((item) => (
                            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}>
                              <Compass size={13} />
                              {item.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="school-help-state">No help cards are available for this section yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="school-help-trigger"
        onClick={handleToggle}
        aria-label={open ? "Close school admin help" : "Open school admin help"}
      >
        <span className="school-help-trigger-icon">
          <MessageCircleQuestion size={18} />
        </span>
        <span className="school-help-trigger-copy">
          <strong>Help</strong>
          <small>{currentSection}</small>
        </span>
      </button>
    </div>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(helpBotUi, document.body);
}
