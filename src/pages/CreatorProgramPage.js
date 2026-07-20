import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, Layers3, LayoutGrid, LogOut, Monitor, Plus, Rocket, Save, Smartphone, Sparkles, Target } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import "./CreatorProgramPage.css";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

const EXAM_OPTIONS = [
  { id: "gate-ece", label: "GATE ECE", subjects: ["Network Theory", "Digital Electronics", "Signals & Systems", "Control Systems"] },
  { id: "rbi-grade-b", label: "RBI Grade B", subjects: ["Macroeconomics", "Finance", "Management", "Current Affairs"] },
  { id: "school-k12", label: "School K-12 Boards", subjects: ["Mathematics", "Physics", "Chemistry", "Biology"] },
];

const TOPIC_SUGGESTIONS = {
  "Network Theory": ["Network Topology", "KCL and KVL", "Thevenin and Norton", "Transient Analysis"],
  "Digital Electronics": ["Boolean Algebra", "Combinational Circuits", "Sequential Circuits", "Number Systems"],
  "Signals & Systems": ["LTI Systems", "Fourier Transform", "Laplace Transform", "Sampling Theorem"],
  "Control Systems": ["Block Diagrams", "Time Response", "Root Locus", "Frequency Response"],
  Macroeconomics: ["Inflation", "Fiscal Policy", "Monetary Policy", "National Income"],
  Finance: ["Financial Markets", "Risk and Return", "Time Value of Money", "Banking System"],
  Management: ["Leadership Styles", "Decision Making", "Motivation Theory", "Team Dynamics"],
  "Current Affairs": ["Policy Updates", "Economic Reports", "International Affairs", "Banking Regulation"],
  Mathematics: ["Quadratic Equations", "Coordinate Geometry", "Trigonometric Identities", "Probability"],
  Physics: ["Motion", "Current Electricity", "Wave Optics", "Semiconductors"],
  Chemistry: ["Atomic Structure", "Chemical Bonding", "Organic Reactions", "Electrochemistry"],
  Biology: ["Cell Structure", "Genetics", "Human Physiology", "Ecology"],
};

const BLOCK_LIBRARY = [
  { type: "concept", label: "Concept Node", note: "Rich notes, formulas, cheat sheets, and key takeaways." },
  { type: "question", label: "Question Node", note: "MCQ, NAT, and MSQ with hints and explanations." },
  { type: "sandbox", label: "Sandbox Session", note: "Simulations, drag-drop, matching pairs, or coding practice." },
  { type: "milestone", label: "Milestone Assessor", note: "Checkpoint gate using accuracy and speed thresholds." },
];

const WORKSPACE_TABS = [
  { id: "studio", label: "Studio" },
  { id: "content", label: "Created Content" },
  { id: "preview", label: "Preview" },
];

const getDraftKey = (uid) => `hepsy_creator_workspace_v3_${uid}`;
const getLibraryKey = (uid) => `hepsy_creator_library_v1_${uid}`;

const createNode = (type, order) => {
  const base = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    order,
    title: "",
    goal: "",
  };

  if (type === "concept") {
    return { ...base, title: `Concept ${order}`, content: "", cheatSheet: "", keyTakeaways: "" };
  }

  if (type === "question") {
    return {
      ...base,
      title: `Question ${order}`,
      questionType: "MCQ",
      prompt: "",
      options: ["", "", "", ""],
      answer: "",
      hint: "",
      explanation: "",
    };
  }

  if (type === "sandbox") {
    return {
      ...base,
      title: `Sandbox ${order}`,
      sandboxType: "simulation",
      setup: "",
      instructions: "",
      scoringLogic: "",
    };
  }

  return {
    ...base,
    title: `Milestone ${order}`,
    passAccuracy: "70",
    passSpeed: "12",
    unlockCopy: "",
    reviewNotes: "",
  };
};

const DEFAULT_DRAFT = {
  metadata: {
    focusExam: "School K-12 Boards",
    coreSubject: "Mathematics",
    chapter: "",
    journeyTitle: "",
  },
  nodes: [createNode("concept", 1)],
  publicationStatus: "draft",
  updatedAt: "",
};

const normalizeDraft = (draft) => {
  if (!draft || typeof draft !== "object") return DEFAULT_DRAFT;
  const metadata = {
    focusExam: draft.metadata?.focusExam || DEFAULT_DRAFT.metadata.focusExam,
    coreSubject: draft.metadata?.coreSubject || DEFAULT_DRAFT.metadata.coreSubject,
    chapter: draft.metadata?.chapter || "",
    journeyTitle: draft.metadata?.journeyTitle || "",
  };
  const nodes = Array.isArray(draft.nodes) && draft.nodes.length
    ? draft.nodes.map((node, index) => ({ ...createNode(node.type || "concept", index + 1), ...node, order: index + 1 }))
    : DEFAULT_DRAFT.nodes;

  return {
    metadata,
    nodes,
    publicationStatus: draft.publicationStatus || "draft",
    updatedAt: draft.updatedAt || "",
  };
};

const getNodeLabel = (type) => {
  if (type === "concept") return "Concept";
  if (type === "question") return "Question";
  if (type === "sandbox") return "Sandbox";
  return "Milestone";
};

const buildPreviewText = (node) => {
  if (node.type === "concept") return node.content || "Concept notes will appear here.";
  if (node.type === "question") return node.prompt || "Question prompt will appear here.";
  if (node.type === "sandbox") return node.instructions || "Interactive session instructions will appear here.";
  return node.unlockCopy || `Unlock next phase at ${node.passAccuracy}% accuracy and ${node.passSpeed} minutes.`;
};

export default function CreatorProgramPage() {
  const { user, logout } = useAuth();
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState("studio");
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [library, setLibrary] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(DEFAULT_DRAFT.nodes[0].id);
  const [saveState, setSaveState] = useState("saved");

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!active || !snap.exists()) return;
        setCreatorProfile(snap.data());
      } catch {
        if (active) setCreatorProfile(null);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    try {
      const savedDraft = window.localStorage.getItem(getDraftKey(user.uid));
      const savedLibrary = window.localStorage.getItem(getLibraryKey(user.uid));
      const nextDraft = savedDraft ? normalizeDraft(JSON.parse(savedDraft)) : DEFAULT_DRAFT;
      setDraft(nextDraft);
      setSelectedNodeId(nextDraft.nodes[0]?.id || "");
      setLibrary(savedLibrary ? JSON.parse(savedLibrary) : []);
    } catch {
      setDraft(DEFAULT_DRAFT);
      setLibrary([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        getDraftKey(user.uid),
        JSON.stringify({
          ...draft,
          updatedAt: new Date().toISOString(),
        })
      );
      setSaveState("saved");
    }, 450);

    return () => window.clearTimeout(timer);
  }, [draft, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    window.localStorage.setItem(getLibraryKey(user.uid), JSON.stringify(library));
  }, [library, user?.uid]);

  const activeExam = useMemo(
    () => EXAM_OPTIONS.find((entry) => entry.label === draft.metadata.focusExam) || EXAM_OPTIONS[0],
    [draft.metadata.focusExam]
  );

  const chapterSuggestions = useMemo(
    () => TOPIC_SUGGESTIONS[draft.metadata.coreSubject] || [],
    [draft.metadata.coreSubject]
  );

  const selectedNode = useMemo(
    () => draft.nodes.find((node) => node.id === selectedNodeId) || draft.nodes[0] || null,
    [draft.nodes, selectedNodeId]
  );

  const validationIssues = useMemo(() => {
    const issues = [];
    if (!draft.metadata.focusExam) issues.push("Choose a focus exam.");
    if (!draft.metadata.coreSubject) issues.push("Choose a core subject.");
    if (!draft.metadata.chapter.trim()) issues.push("Target chapter/topic is missing.");
    if (!draft.metadata.journeyTitle.trim()) issues.push("Journey title is missing.");

    draft.nodes.forEach((node, index) => {
      const step = `${getNodeLabel(node.type)} ${index + 1}`;
      if (!node.title?.trim()) issues.push(`${step} needs a title.`);
      if (node.type === "concept" && !node.content?.trim()) issues.push(`${step} has no core concept content.`);
      if (node.type === "question") {
        if (!node.prompt?.trim()) issues.push(`${step} prompt is missing.`);
        if (!node.answer?.trim()) issues.push(`${step} answer key is missing.`);
        if (!node.explanation?.trim()) issues.push(`${step} is missing answer explanation.`);
      }
      if (node.type === "sandbox" && !node.instructions?.trim()) issues.push(`${step} instructions are missing.`);
      if (node.type === "milestone" && !node.unlockCopy?.trim()) issues.push(`${step} unlock criteria is missing.`);
    });

    return issues;
  }, [draft]);

  const updateMetadata = (field, value) => {
    setDraft((current) => {
      const next = {
        ...current,
        metadata: { ...current.metadata, [field]: value },
      };

      if (field === "focusExam") {
        const exam = EXAM_OPTIONS.find((entry) => entry.label === value) || EXAM_OPTIONS[0];
        if (!exam.subjects.includes(next.metadata.coreSubject)) {
          next.metadata.coreSubject = exam.subjects[0];
        }
      }

      return next;
    });
  };

  const updateSelectedNode = (field, value) => {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === selectedNodeId ? { ...node, [field]: value } : node)),
    }));
  };

  const updateQuestionOption = (index, value) => {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== selectedNodeId || node.type !== "question") return node;
        const nextOptions = [...node.options];
        nextOptions[index] = value;
        return { ...node, options: nextOptions };
      }),
    }));
  };

  const addNode = (type) => {
    const newNode = createNode(type, draft.nodes.length + 1);
    setDraft((current) => ({ ...current, nodes: [...current.nodes, newNode] }));
    setSelectedNodeId(newNode.id);
    setWorkspaceTab("studio");
  };

  const removeNode = (nodeId) => {
    setDraft((current) => {
      if (current.nodes.length === 1) return current;
      const nextNodes = current.nodes.filter((node) => node.id !== nodeId).map((node, index) => ({ ...node, order: index + 1 }));
      return { ...current, nodes: nextNodes };
    });

    if (selectedNodeId === nodeId) {
      const fallback = draft.nodes.find((node) => node.id !== nodeId);
      if (fallback) setSelectedNodeId(fallback.id);
    }
  };

  const resetDraft = () => {
    const fresh = DEFAULT_DRAFT;
    setDraft(fresh);
    setSelectedNodeId(fresh.nodes[0].id);
    setWorkspaceTab("studio");
  };

  const publishJourney = () => {
    const publishedAt = new Date().toISOString();
    const entry = {
      id: selectedNodeId ? `${selectedNodeId}_${Date.now()}` : `journey_${Date.now()}`,
      title: draft.metadata.journeyTitle || "Untitled Journey",
      exam: draft.metadata.focusExam,
      subject: draft.metadata.coreSubject,
      chapter: draft.metadata.chapter,
      status: validationIssues.length === 0 ? "published" : "review",
      blocks: draft.nodes.length,
      updatedAt: publishedAt,
    };

    setLibrary((current) => [entry, ...current]);
    setDraft((current) => ({
      ...current,
      publicationStatus: validationIssues.length === 0 ? "published" : "review",
      updatedAt: publishedAt,
    }));
    setWorkspaceTab("content");
  };

  const stats = useMemo(
    () => [
      { value: draft.nodes.length, label: "Journey blocks" },
      { value: validationIssues.length, label: "Open validations" },
      { value: library.length, label: "Created entries" },
    ],
    [draft.nodes.length, library.length, validationIssues.length]
  );

  return (
    <div className="creator-workspace-shell">
      <header className="creator-workspace-nav">
        <Link className="creator-page-brand" to="/">
          <img src={HEPSY_LOGO} alt="Hepsy logo" />
          <span>
            <strong>HEPSY</strong>
            <small>Creator Workspace</small>
          </span>
        </Link>

        <div className="creator-workspace-controls">
          <div className={`creator-save-pill ${saveState}`}>
            <Save size={14} />
            {saveState === "saving" ? "Auto-saving..." : "Draft saved"}
          </div>
          <button type="button" className="creator-control-pill" onClick={() => setWorkspaceTab("preview")}>
            <Eye size={15} />
            Preview
          </button>
          <button type="button" className="creator-page-nav-link creator-logout-btn" onClick={logout}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      <main className="creator-workspace-main">
        <section className="creator-hero-bar">
          <div className="creator-hero-copy">
            <span className="creator-kicker">Creator App</span>
            <h1>Target the right exam, subject, and chapter before building the journey.</h1>
            <p>
              Creator access is role-based and separate from the normal student flow. Use the studio to build, the content tab to track published work, and preview to test the student experience.
            </p>
          </div>

          <div className="creator-right-summary">
            <div className="creator-profile-card">
              <span>Logged in creator</span>
              <strong>{creatorProfile?.name || user?.email || "Creator"}</strong>
              <p>{creatorProfile?.creatorProfile?.focusArea || "General academic creator"}</p>
            </div>
            <div className="creator-live-stats">
              {stats.map((item) => (
                <article key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="creator-tab-strip">
          {WORKSPACE_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`creator-tab-btn ${workspaceTab === tab.id ? "active" : ""}`}
              onClick={() => setWorkspaceTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {workspaceTab === "studio" ? (
          <section className="creator-step-card">
            <div className="creator-step-head">
              <div>
                <span className="creator-step-index">Step 1</span>
                <h2>Metadata & Targeting Setup</h2>
              </div>
              <div className="creator-step-status">
                <Target size={15} />
                Focus exam, subject, and chapter first.
              </div>
            </div>

            <div className="creator-metadata-grid">
              <label className="creator-field">
                <span>Journey Title</span>
                <input type="text" value={draft.metadata.journeyTitle} onChange={(event) => updateMetadata("journeyTitle", event.target.value)} placeholder="Semiconductor devices mastery path" />
              </label>
              <label className="creator-field">
                <span>Focus Exam</span>
                <select value={draft.metadata.focusExam} onChange={(event) => updateMetadata("focusExam", event.target.value)}>
                  {EXAM_OPTIONS.map((exam) => (
                    <option key={exam.id} value={exam.label}>{exam.label}</option>
                  ))}
                </select>
              </label>
              <div className="creator-field creator-field-subjects">
                <span>Core Subject</span>
                <div className="creator-pill-row">
                  {activeExam.subjects.map((subject) => (
                    <button
                      type="button"
                      key={subject}
                      className={`creator-select-pill ${draft.metadata.coreSubject === subject ? "active" : ""}`}
                      onClick={() => updateMetadata("coreSubject", subject)}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
              </div>
              <label className="creator-field">
                <span>Target Chapter / Topic</span>
                <input
                  type="text"
                  list="creator-topic-suggestions"
                  value={draft.metadata.chapter}
                  onChange={(event) => updateMetadata("chapter", event.target.value)}
                  placeholder="Start typing a chapter or topic"
                />
                <datalist id="creator-topic-suggestions">
                  {chapterSuggestions.map((topic) => (
                    <option key={topic} value={topic} />
                  ))}
                </datalist>
              </label>
            </div>

            <div className="creator-step-head creator-step-head-secondary">
              <div>
                <span className="creator-step-index">Step 2</span>
                <h2>Journey Builder Canvas</h2>
              </div>
              <div className="creator-step-status">
                <Layers3 size={15} />
                Add nodes and keep the builder compact.
              </div>
            </div>

            <div className="creator-canvas-layout">
              <aside className="creator-sidebar-panel">
                <div className="creator-panel-head">
                  <h3>Block Library</h3>
                  <span>{draft.nodes.length} active</span>
                </div>
                <div className="creator-library-list">
                  {BLOCK_LIBRARY.map((block) => (
                    <button type="button" key={block.type} className="creator-library-card" onClick={() => addNode(block.type)}>
                      <div>
                        <strong>{block.label}</strong>
                        <p>{block.note}</p>
                      </div>
                      <Plus size={16} />
                    </button>
                  ))}
                </div>
              </aside>

              <section className="creator-editor-surface">
                <div className="creator-panel-head">
                  <div>
                    <h3>{selectedNode ? `${getNodeLabel(selectedNode.type)} Editor` : "Studio"}</h3>
                    <span>Compact editing for the selected node.</span>
                  </div>
                  <button type="button" className="creator-danger-text" onClick={() => selectedNode && removeNode(selectedNode.id)} disabled={draft.nodes.length === 1}>
                    Remove Block
                  </button>
                </div>

                <div className="creator-node-strip">
                  {draft.nodes.map((node) => (
                    <button
                      type="button"
                      key={node.id}
                      className={`creator-node-card ${selectedNode?.id === node.id ? "active" : ""}`}
                      onClick={() => setSelectedNodeId(node.id)}
                    >
                      <div>
                        <small>{getNodeLabel(node.type)}</small>
                        <strong>{node.title || `${getNodeLabel(node.type)} ${node.order}`}</strong>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedNode ? (
                  <div className="creator-editor-grid">
                    <label className="creator-field">
                      <span>Block Title</span>
                      <input type="text" value={selectedNode.title} onChange={(event) => updateSelectedNode("title", event.target.value)} />
                    </label>
                    <label className="creator-field">
                      <span>Outcome Goal</span>
                      <input type="text" value={selectedNode.goal || ""} onChange={(event) => updateSelectedNode("goal", event.target.value)} placeholder="Learner outcome for this block" />
                    </label>

                    {selectedNode.type === "concept" ? (
                      <>
                        <label className="creator-field creator-field-full">
                          <span>Core Concept</span>
                          <textarea rows={7} value={selectedNode.content} onChange={(event) => updateSelectedNode("content", event.target.value)} placeholder="Markdown-style concept notes, formulas, or explanations." />
                        </label>
                        <label className="creator-field">
                          <span>Cheat Sheet</span>
                          <textarea rows={4} value={selectedNode.cheatSheet || ""} onChange={(event) => updateSelectedNode("cheatSheet", event.target.value)} />
                        </label>
                        <label className="creator-field">
                          <span>Key Takeaways</span>
                          <textarea rows={4} value={selectedNode.keyTakeaways || ""} onChange={(event) => updateSelectedNode("keyTakeaways", event.target.value)} />
                        </label>
                      </>
                    ) : null}

                    {selectedNode.type === "question" ? (
                      <>
                        <label className="creator-field">
                          <span>Question Type</span>
                          <select value={selectedNode.questionType} onChange={(event) => updateSelectedNode("questionType", event.target.value)}>
                            <option value="MCQ">MCQ</option>
                            <option value="NAT">NAT</option>
                            <option value="MSQ">MSQ</option>
                          </select>
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Question Prompt</span>
                          <textarea rows={5} value={selectedNode.prompt} onChange={(event) => updateSelectedNode("prompt", event.target.value)} />
                        </label>
                        {selectedNode.questionType !== "NAT" ? (
                          <div className="creator-field creator-field-full">
                            <span>Options</span>
                            <div className="creator-option-grid">
                              {selectedNode.options.map((option, index) => (
                                <input key={`${selectedNode.id}_${index}`} type="text" value={option} onChange={(event) => updateQuestionOption(index, event.target.value)} placeholder={`Option ${index + 1}`} />
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <label className="creator-field">
                          <span>Answer Key</span>
                          <input type="text" value={selectedNode.answer} onChange={(event) => updateSelectedNode("answer", event.target.value)} />
                        </label>
                        <label className="creator-field">
                          <span>Hint Trail</span>
                          <textarea rows={4} value={selectedNode.hint} onChange={(event) => updateSelectedNode("hint", event.target.value)} />
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Explanation</span>
                          <textarea rows={4} value={selectedNode.explanation} onChange={(event) => updateSelectedNode("explanation", event.target.value)} />
                        </label>
                      </>
                    ) : null}

                    {selectedNode.type === "sandbox" ? (
                      <>
                        <label className="creator-field">
                          <span>Sandbox Type</span>
                          <select value={selectedNode.sandboxType} onChange={(event) => updateSelectedNode("sandboxType", event.target.value)}>
                            <option value="simulation">Simulation</option>
                            <option value="matching">Matching Pairs</option>
                            <option value="drag-drop">Drag & Drop</option>
                            <option value="live-coding">Live Coding / Math</option>
                          </select>
                        </label>
                        <label className="creator-field">
                          <span>Setup Parameters</span>
                          <textarea rows={4} value={selectedNode.setup || ""} onChange={(event) => updateSelectedNode("setup", event.target.value)} />
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Instructions</span>
                          <textarea rows={4} value={selectedNode.instructions || ""} onChange={(event) => updateSelectedNode("instructions", event.target.value)} />
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Scoring Logic</span>
                          <textarea rows={4} value={selectedNode.scoringLogic || ""} onChange={(event) => updateSelectedNode("scoringLogic", event.target.value)} />
                        </label>
                      </>
                    ) : null}

                    {selectedNode.type === "milestone" ? (
                      <>
                        <label className="creator-field">
                          <span>Pass Accuracy %</span>
                          <input type="number" value={selectedNode.passAccuracy || ""} onChange={(event) => updateSelectedNode("passAccuracy", event.target.value)} />
                        </label>
                        <label className="creator-field">
                          <span>Speed Target (minutes)</span>
                          <input type="number" value={selectedNode.passSpeed || ""} onChange={(event) => updateSelectedNode("passSpeed", event.target.value)} />
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Unlock Criteria</span>
                          <textarea rows={4} value={selectedNode.unlockCopy || ""} onChange={(event) => updateSelectedNode("unlockCopy", event.target.value)} />
                        </label>
                        <label className="creator-field creator-field-full">
                          <span>Review Notes</span>
                          <textarea rows={4} value={selectedNode.reviewNotes || ""} onChange={(event) => updateSelectedNode("reviewNotes", event.target.value)} />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <aside className="creator-sidebar-panel">
                <div className="creator-panel-head">
                  <h3>Validation Feed</h3>
                  <span>{validationIssues.length} checks</span>
                </div>
                <div className="creator-validation-list">
                  {validationIssues.length === 0 ? (
                    <div className="creator-validation-card success">
                      <CheckCircle2 size={16} />
                      <span>All required pieces are ready for publish review.</span>
                    </div>
                  ) : (
                    validationIssues.map((issue) => (
                      <div className="creator-validation-card" key={issue}>
                        <Target size={16} />
                        <span>{issue}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="creator-action-stack">
                  <button type="button" className="creator-primary-btn" onClick={publishJourney}>
                    <Rocket size={16} />
                    {validationIssues.length === 0 ? "Publish Journey" : "Move To Review"}
                  </button>
                  <button type="button" className="creator-secondary-btn" onClick={resetDraft}>
                    <Sparkles size={16} />
                    New Draft
                  </button>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {workspaceTab === "content" ? (
          <section className="creator-step-card creator-content-board">
            <div className="creator-step-head">
              <div>
                <span className="creator-step-index">Created Content</span>
                <h2>Track posts, drafts, and published journeys</h2>
              </div>
              <div className="creator-step-status">
                <LayoutGrid size={15} />
                Compact overview of creator output.
              </div>
            </div>

            {library.length === 0 ? (
              <div className="creator-empty-card">
                <strong>No creator entries yet.</strong>
                <p>Publish or review one journey from the studio and it will appear here.</p>
              </div>
            ) : (
              <div className="creator-content-grid">
                {library.map((entry) => (
                  <article className="creator-content-card" key={entry.id}>
                    <div className="creator-content-top">
                      <span className={`creator-status-badge ${entry.status}`}>{entry.status}</span>
                      <small>{new Date(entry.updatedAt).toLocaleDateString("en-IN")}</small>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>{entry.exam} • {entry.subject}</p>
                    <div className="creator-content-meta">
                      <span>{entry.chapter}</span>
                      <span>{entry.blocks} blocks</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {workspaceTab === "preview" ? (
          <section className="creator-step-card">
            <div className="creator-step-head">
              <div>
                <span className="creator-step-index">Preview</span>
                <h2>Test the learner experience before publishing</h2>
              </div>
              <div className="creator-preview-switches">
                <button
                  type="button"
                  className={`creator-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                  onClick={() => setPreviewDevice("desktop")}
                >
                  <Monitor size={15} />
                  Desktop
                </button>
                <button
                  type="button"
                  className={`creator-device-btn ${previewDevice === "mobile" ? "active" : ""}`}
                  onClick={() => setPreviewDevice("mobile")}
                >
                  <Smartphone size={15} />
                  Mobile
                </button>
              </div>
            </div>

            <div className={`creator-preview-shell ${previewDevice}`}>
              <div className="creator-preview-header">
                <span>{draft.metadata.focusExam}</span>
                <strong>{draft.metadata.journeyTitle || "Untitled learning journey"}</strong>
                <p>{draft.metadata.coreSubject} • {draft.metadata.chapter || "Chapter pending"}</p>
              </div>
              <div className="creator-preview-list">
                {draft.nodes.map((node) => (
                  <article className="creator-preview-card" key={node.id}>
                    <div className="creator-preview-meta">
                      <span>{getNodeLabel(node.type)}</span>
                      <strong>{node.title}</strong>
                    </div>
                    <p>{buildPreviewText(node)}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
