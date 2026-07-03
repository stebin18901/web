import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { DEFAULT_SCHOOL_CLASS_OPTIONS, getDefaultSchoolPlan, getUniqueClasses, normalizeClassName } from "../config/defaultSchool";
import "./Dashboard.css";

const normalizeClassToken = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const normalizeSubjectToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
const extractClassGradeToken = (value) => {
  const token = normalizeClassToken(value);
  const match = token.match(/\d+/);
  return match ? match[0] : "";
};
const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object") {
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (value._seconds) return Number(value._seconds) * 1000;
  }
  return null;
};
const makeConceptKey = (subject, chapter, concept) =>
  `${String(subject || "general").trim().toLowerCase()}__${String(chapter || "chapter").trim().toLowerCase()}__${String(concept || "concept").trim().toLowerCase()}`;
const makeProgressDocId = (studentId, conceptKey) =>
  `${String(studentId || "unknown")}__${conceptKey.replace(/[^a-z0-9_]+/gi, "_")}`;
const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};
const formatDateLabel = (value) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return parsed.toLocaleString();
};
const getDeviceLabel = () => {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "Android device";
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone / iPad";
  if (/windows/i.test(ua)) return "Windows device";
  if (/macintosh|mac os x/i.test(ua)) return "Mac device";
  if (/linux/i.test(ua)) return "Linux device";
  return "Browser device";
};
const PROFILE_CARD_IMAGE = `${process.env.PUBLIC_URL || ""}/images/propic.png`;
const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.png`;
const getHolderTierByScore = (scoreValue) => {
  const score = Number(scoreValue || 0);

  if (score >= 95) {
    return { key: "black", label: "Black Card Holder", accent: "Elite performance band" };
  }
  if (score >= 85) {
    return { key: "platinum", label: "Platinum Card Holder", accent: "Exceptional consistency" };
  }
  if (score >= 70) {
    return { key: "gold", label: "Gold Card Holder", accent: "Strong scoring momentum" };
  }
  if (score >= 55) {
    return { key: "silver", label: "Silver Card Holder", accent: "Steady progress track" };
  }
  return { key: "blue", label: "Blue Card Holder", accent: "Learning curve active" };
};
const buildSessionFromEnrollment = (studentId, enrollment, fallbackSession) => {
  const selectedClasses = getUniqueClasses(
    enrollment?.selectedClasses || [enrollment?.className]
  );

  return {
    ...(fallbackSession || {}),
    id: studentId,
    name: enrollment?.name || enrollment?.fullName || fallbackSession?.name || "Student",
    className: selectedClasses[0] || enrollment?.className || fallbackSession?.className || "Default",
    defaultClassName: enrollment?.className || fallbackSession?.defaultClassName || "",
    selectedClasses,
    classProfiles: enrollment?.classProfiles || fallbackSession?.classProfiles || {},
    section: enrollment?.section || fallbackSession?.section || "",
    rollNumber:
      enrollment?.rollNumber || fallbackSession?.rollNumber || "",
    phone: enrollment?.phone || fallbackSession?.phone || "",
    schoolName:
      enrollment?.schoolName || fallbackSession?.schoolName || "Default School",
    schoolId: enrollment?.schoolId || fallbackSession?.schoolId || "",
    accessMode: enrollment?.accessMode || fallbackSession?.accessMode || "default-school",
    isPaid:
      enrollment?.isPaid === true || fallbackSession?.isPaid === true,
    paymentStatus:
      enrollment?.paymentStatus || fallbackSession?.paymentStatus || "",
    registrationStatus:
      enrollment?.registrationStatus || fallbackSession?.registrationStatus || "",
    planId: enrollment?.planId || fallbackSession?.planId || "",
    planName: enrollment?.planName || fallbackSession?.planName || "",
    planMaxClasses:
      enrollment?.planMaxClasses ||
      fallbackSession?.planMaxClasses ||
      selectedClasses.length ||
      1,
    razorpaySubscriptionId:
      enrollment?.razorpaySubscriptionId ||
      fallbackSession?.razorpaySubscriptionId ||
      "",
    expiryDate: enrollment?.expiryDate || fallbackSession?.expiryDate || "",
    startDate: enrollment?.startDate || fallbackSession?.startDate || "",
    loggedInAt: new Date().toISOString(),
    deviceLabel: getDeviceLabel(),
  };
};
const makeSubjectLogo = (subjectName = "") => {
  const key = String(subjectName || "").trim().toLowerCase();
  if (key.includes("math")) return { icon: "fx", className: "logo-math" };
  if (key.includes("science")) return { icon: "flask", className: "logo-science" };
  if (key.includes("english")) return { icon: "eng", className: "logo-english" };
  if (key.includes("physics")) return { icon: "phy", className: "logo-physics" };
  if (key.includes("chem")) return { icon: "chem", className: "logo-chemistry" };
  if (key.includes("bio")) return { icon: "bio", className: "logo-biology" };
  if (key.includes("history")) return { icon: "his", className: "logo-history" };
  if (key.includes("geo")) return { icon: "geo", className: "logo-geography" };
  if (key.includes("computer") || key.includes("coding")) return { icon: "code", className: "logo-coding" };
  return { icon: "sub", className: "logo-default" };
};


const dashboardNavItems = [
  { key: "home", label: "Home", hint: "Overview", description: "Current dashboard view" },
  { key: "subjects", label: "Learn", hint: "Coming soon", description: "Guided learning journeys are being prepared" },
  { key: "concepts", label: "Concepts", hint: "Coming soon", description: "Concept maps on the way" },
  { key: "practice", label: "Practice", hint: "Browse chapters", description: "Browse subjects, chapters, notes, and tests" },
  { key: "mock-tests", label: "Mock Tests", hint: "Coming soon", description: "Full test simulations soon" },
  { key: "leaderboard", label: "Leaderboard", hint: "Class ranking", description: "Competitive ranking view" },
  { key: "progress", label: "My Progress", hint: "Track growth", description: "Detailed learning analytics" },
  { key: "notes", label: "Notes", hint: "Coming soon", description: "Saved revision notes soon" },
  { key: "goals", label: "Weekly Goals", hint: "Coming soon", description: "Goal planner coming soon" },
  { key: "profile", label: "Profile", hint: "Coming soon", description: "Profile tools coming soon" },
];
const lockedNavKeys = new Set(["subjects", "concepts", "mock-tests", "notes", "goals"]);

const dashboardBackdropUrl = `${process.env.PUBLIC_URL}/images/dashboard.png`;
const practiceBackdropUrl = `${process.env.PUBLIC_URL}/images/week.png`;

const Dashboard = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [activeSubject, setActiveSubject] = useState("");
  const [quizOrderMap, setQuizOrderMap] = useState({});
  const [learningProgress, setLearningProgress] = useState({});
  const [allLearningProgress, setAllLearningProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [session, setSession] = useState(() => safeJsonParse(localStorage.getItem("schoolStudentSession")));
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loadingLinkedAccounts, setLoadingLinkedAccounts] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassStudentName, setNewClassStudentName] = useState("");
  const [classError, setClassError] = useState("");
  const [navNotice, setNavNotice] = useState("");
  const subjectScrollRef = useRef(null);
  const navigate = useNavigate();

  const selectedClasses = useMemo(() => getUniqueClasses(session?.selectedClasses || [session?.className]), [session]);
  const activePlan = useMemo(() => getDefaultSchoolPlan(session?.planId), [session?.planId]);
  const canManageDefaultClasses =
    session?.accessMode === "default-school" &&
    ["multi", "mega"].includes(activePlan.id) &&
    selectedClasses.length > 0;
  const canAddDefaultClass =
    session?.accessMode === "default-school" &&
    ["multi", "mega"].includes(activePlan.id) &&
    selectedClasses.length < activePlan.maxClasses;

  const persistSession = (nextSession) => {
    localStorage.setItem("schoolStudentSession", JSON.stringify(nextSession));
    setSession(nextSession);
  };

  const loadLinkedAccounts = async () => {
    if (!session?.phone || !session?.schoolId) {
      setLinkedAccounts([]);
      return;
    }

    setLoadingLinkedAccounts(true);
    try {
      const phoneQuery = query(
        collection(db, "defaultSchoolEnrollments"),
        where("phone", "==", session.phone)
      );
      const snap = await getDocs(phoneQuery);
      const items = snap.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .filter(
          (entry) =>
            String(entry.schoolId || "").trim().toLowerCase() ===
              String(session.schoolId || "").trim().toLowerCase() &&
            ["default-school", "school-plan"].includes(
              String(entry.accessMode || "default-school").toLowerCase()
            )
        )
        .sort((a, b) => {
          const classCompare = String(a.className || "").localeCompare(
            String(b.className || ""),
            undefined,
            { numeric: true }
          );
          if (classCompare !== 0) return classCompare;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      setLinkedAccounts(items);
    } finally {
      setLoadingLinkedAccounts(false);
    }
  };

  const switchAccount = async (accountId) => {
    if (!accountId || accountId === session?.id) {
      setShowAccountModal(false);
      return;
    }

    const enrollmentSnap = await getDoc(doc(db, "defaultSchoolEnrollments", accountId));
    if (!enrollmentSnap.exists()) return;

    const nextSession = buildSessionFromEnrollment(
      accountId,
      enrollmentSnap.data(),
      session
    );
    persistSession(nextSession);
    setActiveSubject("");
    setShowAccountModal(false);
  };

  const switchClass = (className) => {
    if (!session) return;
    const profile = session.classProfiles?.[className] || {};
    persistSession({
      ...session,
      className,
      name: profile.name || session.name,
    });
    setActiveSubject("");
  };

  const addDefaultClass = async (event) => {
    event.preventDefault();
    if (!session || !canAddDefaultClass) return;

    const cleanClassName = normalizeClassName(newClassName);
    const cleanStudentName = newClassStudentName.trim() || session.name || "Student";
    if (!cleanClassName) {
      setClassError("Choose a class.");
      return;
    }
    if (selectedClasses.some((item) => item.toLowerCase() === cleanClassName.toLowerCase())) {
      setClassError("This class is already selected.");
      return;
    }
    if (selectedClasses.length >= activePlan.maxClasses) {
      setClassError(`Your plan allows ${activePlan.maxClasses} classes.`);
      return;
    }

    const nextClasses = getUniqueClasses([...selectedClasses, cleanClassName]);
    const nextProfiles = {
      ...(session.classProfiles || {}),
      [cleanClassName]: { name: cleanStudentName, className: cleanClassName },
    };
    const nextSession = {
      ...session,
      selectedClasses: nextClasses,
      classProfiles: nextProfiles,
      className: cleanClassName,
      name: cleanStudentName,
    };

    await setDoc(
      doc(db, "defaultSchoolEnrollments", session.id),
      {
        selectedClasses: nextClasses,
        classProfiles: nextProfiles,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    persistSession(nextSession);
    setShowClassModal(false);
    setNewClassName("");
    setNewClassStudentName("");
    setClassError("");
    setActiveSubject("");
  };

  useEffect(() => {
    if (!session) {
      navigate("/login");
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const classRaw = String(session.className || "").trim();
        const classNormalized = normalizeClassToken(classRaw);
        const classGrade = classRaw.match(/^\d+/)?.[0] || "";

        const allQuizSnap = await getDocs(collection(db, "quizzes"));
        const allQuizDocs = allQuizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const matchesClass = (quiz) => {
          const candidates = [
            quiz.class,
            quiz.className,
            quiz.grade,
            quiz.metadata?.class,
            quiz.metadata?.grade,
            quiz.quizData?.class,
            quiz.quizData?.grade,
          ]
            .filter((v) => v !== undefined && v !== null)
            .map((v) => normalizeClassToken(v));

          if (!candidates.length && session.accessMode === "default-school") return true;
          if (candidates.includes(classNormalized)) return true;
          if (!classGrade) return false;
          return candidates.some((c) => c === classGrade || c.startsWith(classGrade));
        };

        const normalizedQuizzes = allQuizDocs.filter(matchesClass).map((q) => ({
          ...q,
          subject: q.subject || q.metadata?.subject || q.quizData?.subject || "General",
          chapter: q.chapter || q.metadata?.chapter || q.quizData?.chapter || q.title || "Untitled Chapter",
          title: q.title || q.metadata?.chapter || q.quizData?.quizTitle || q.chapter || "Class Quiz",
          mainConcept: q.metadata?.concept || "",
          questionConcepts: Array.isArray(q.questions) ? q.questions.map((item) => item?.concept).filter(Boolean) : [],
          uploadedAtMs:
            toMillis(q.createdAt) ??
            toMillis(q.uploadedAt) ??
            toMillis(q.timestamp) ??
            toMillis(q.metadata?.createdAt) ??
            toMillis(q.quizData?.createdAt),
        }));

        setQuizzes(normalizedQuizzes);

        const studentReportQuery = query(collection(db, "reports"), where("studentId", "==", session.id));
        const studentReportsSnap = await getDocs(studentReportQuery);
        setReports(studentReportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const schoolReportQuery = query(collection(db, "reports"), where("schoolId", "==", session.schoolId));
        const schoolReportsSnap = await getDocs(schoolReportQuery);
        setAllReports(schoolReportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const studentProgressQuery = query(collection(db, "learningProgress"), where("studentId", "==", session.id));
        const studentProgressSnap = await getDocs(studentProgressQuery);
        const progressMap = {};
        studentProgressSnap.docs.forEach((d) => {
          const item = { id: d.id, ...d.data() };
          if (item?.conceptKey) progressMap[item.conceptKey] = item;
        });
        setLearningProgress(progressMap);

        const schoolProgressQuery = query(collection(db, "learningProgress"), where("schoolId", "==", session.schoolId));
        const schoolProgressSnap = await getDocs(schoolProgressQuery);
        setAllLearningProgress(schoolProgressSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const orderSnap = await getDocs(collection(db, "quizSortOrders"));
        const orderMap = {};
        orderSnap.docs.forEach((d) => {
          const item = d.data() || {};
          const idParts = String(d.id || "").split("__");
          const idClassToken = normalizeClassToken(idParts[0] || "");
          const idSubjectToken = normalizeSubjectToken(idParts.slice(1).join("__") || "");
          const subjectToken = normalizeSubjectToken(item.subject || idSubjectToken || "");
          const classToken = normalizeClassToken(item.className || idClassToken || "");
          if (!subjectToken || !classToken) return;
          const key = `${classToken}__${subjectToken}`;
          orderMap[key] = Array.isArray(item.quizOrder) ? item.quizOrder : [];
        });
        setQuizOrderMap(orderMap);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [navigate, session]);

  useEffect(() => {
    if (!showAccountModal) return;
    loadLinkedAccounts();
  }, [showAccountModal, session?.phone, session?.schoolId]);

  const subjects = useMemo(() => {
    const map = {};
    quizzes.forEach((quiz) => {
      const raw = String(quiz.subject || "General").trim();
      const key = raw.toLowerCase();
      if (!map[key]) {
        map[key] = { key, name: raw, total: 0, lastTopic: quiz.chapter || quiz.title || "Practice" };
      }
      map[key].total += 1;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [quizzes]);

  const subjectPalette = useMemo(() => ["blue", "green", "orange", "red", "violet", "teal"], []);

  const filteredQuizzes = useMemo(() => {
    if (!activeSubject) return quizzes;
    return quizzes.filter((q) => String(q.subject || "General").trim().toLowerCase() === activeSubject);
  }, [quizzes, activeSubject]);

  const selectedSubjectMeta = useMemo(
    () => subjects.find((subject) => subject.key === activeSubject) || null,
    [subjects, activeSubject]
  );

  const getQuizOrderIndex = (quiz) => {
    const subjectToken = normalizeSubjectToken(quiz?.subject || "General");
    const sessionClassRaw = String(session?.className || "").trim();
    const sessionClassGrade = sessionClassRaw.match(/^\d+/)?.[0] || "";
    const classCandidates = [
      sessionClassRaw,
      sessionClassGrade,
      quiz?.class,
      quiz?.className,
      quiz?.grade,
      quiz?.metadata?.class,
      quiz?.metadata?.grade,
      quiz?.quizData?.class,
      quiz?.quizData?.grade,
    ]
      .filter((v) => v !== undefined && v !== null && String(v).trim())
      .map((v) => normalizeClassToken(v));

    for (const classToken of classCandidates) {
      const key = `${classToken}__${subjectToken}`;
      const order = quizOrderMap[key];
      if (!Array.isArray(order)) continue;
      const idx = order.indexOf(quiz?.id);
      if (idx >= 0) return idx;
    }

    // Fallback: match by subject + numeric class grade if exact class token differs
    const candidateGrades = new Set(
      classCandidates
        .map((token) => extractClassGradeToken(token))
        .filter(Boolean)
    );
    if (candidateGrades.size > 0) {
      const keys = Object.keys(quizOrderMap).filter((k) => k.endsWith(`__${subjectToken}`));
      for (const key of keys) {
        const [orderClassToken] = key.split("__");
        const orderClassGrade = extractClassGradeToken(orderClassToken);
        if (!orderClassGrade || !candidateGrades.has(orderClassGrade)) continue;
        const order = quizOrderMap[key];
        if (!Array.isArray(order)) continue;
        const idx = order.indexOf(quiz?.id);
        if (idx >= 0) return idx;
      }
    }

    const uploadedAtMs = Number(quiz?.uploadedAtMs);
    if (Number.isFinite(uploadedAtMs) && uploadedAtMs > 0) return 1_000_000_000_000 + uploadedAtMs;

    return 90_000_000_000_000;
  };

  const chapters = useMemo(() => {
    const chapterMap = new Map();

    const sortedFilteredQuizzes = filteredQuizzes
      .slice()
      .sort((a, b) => getQuizOrderIndex(a) - getQuizOrderIndex(b) || String(a.chapter || "").localeCompare(String(b.chapter || "")));

    sortedFilteredQuizzes.forEach((quiz) => {
      const chapterName = String(quiz.chapter || "Untitled Chapter").trim();
      const subjectName = String(quiz.subject || "General").trim();
      const chapterKey = `${subjectName.toLowerCase()}__${chapterName.toLowerCase()}`;
      if (!chapterMap.has(chapterKey)) {
        chapterMap.set(chapterKey, {
          chapterKey,
          chapterName,
          subject: subjectName,
          quizIds: [],
          subtopics: new Map(),
          chapterOrderIndex: getQuizOrderIndex(quiz),
        });
      }

      const entry = chapterMap.get(chapterKey);
      entry.quizIds.push(quiz.id);
      entry.chapterOrderIndex = Math.min(entry.chapterOrderIndex, getQuizOrderIndex(quiz));

      const concepts = [];
      if (quiz.mainConcept) {
        concepts.push(String(quiz.mainConcept));
      } else if (Array.isArray(quiz.questionConcepts) && quiz.questionConcepts.length) {
        concepts.push(...quiz.questionConcepts.map((c) => String(c)));
      }

      if (!concepts.length) {
        concepts.push(String(quiz.title || chapterName));
      }

      concepts
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((conceptName) => {
          const key = conceptName.toLowerCase();
          if (!entry.subtopics.has(key)) {
            entry.subtopics.set(key, {
              name: conceptName,
              quizId: quiz.id,
              totalSets: 0,
              noteHtml: quiz.noteHtml || "",
              subject: quiz.subject || "General",
              chapterName,
            });
          }
          const current = entry.subtopics.get(key);
          current.totalSets += 1;
          if (!current.quizId) current.quizId = quiz.id;
          if (!current.noteHtml && quiz.noteHtml) current.noteHtml = quiz.noteHtml;
          entry.subtopics.set(key, current);
        });
    });

    return Array.from(chapterMap.values()).map((item) => ({
      ...item,
      quizIds: item.quizIds.slice().sort((idA, idB) => {
        const qA = sortedFilteredQuizzes.find((q) => q.id === idA);
        const qB = sortedFilteredQuizzes.find((q) => q.id === idB);
        return getQuizOrderIndex(qA) - getQuizOrderIndex(qB);
      }),
      subtopics: Array.from(item.subtopics.values()).sort((a, b) => {
        const qA = sortedFilteredQuizzes.find((q) => q.id === a.quizId);
        const qB = sortedFilteredQuizzes.find((q) => q.id === b.quizId);
        return getQuizOrderIndex(qA) - getQuizOrderIndex(qB) || a.name.localeCompare(b.name);
      }),
    }))
    .sort((a, b) => a.chapterOrderIndex - b.chapterOrderIndex || a.chapterName.localeCompare(b.chapterName));
  }, [filteredQuizzes, quizOrderMap, session?.className]);

  const nextQuiz = filteredQuizzes[0] || quizzes[0] || null;
  const reportMatchesQuiz = (report, quizId) => {
    if (!report || !quizId) return false;
    if (report.quizId === quizId) return true;
    if (Array.isArray(report.chapterQuizIds) && report.chapterQuizIds.includes(quizId)) return true;
    return false;
  };

  const reportByQuiz = useMemo(() => {
    const map = {};
    reports.forEach((r) => {
      const candidateIds = new Set();
      if (r?.quizId) candidateIds.add(r.quizId);
      if (Array.isArray(r?.chapterQuizIds)) r.chapterQuizIds.forEach((id) => candidateIds.add(id));
      candidateIds.forEach((id) => {
        if (!id) return;
        if (!map[id]) {
          map[id] = r;
          return;
        }
        if (Number(r.percentage || 0) > Number(map[id].percentage || 0)) {
          map[id] = r;
        }
      });
    });
    return map;
  }, [reports]);

  const upsertProgress = async (topic, patch = {}) => {
    if (!session || !topic) return;
    const conceptKey = makeConceptKey(topic.subject, topic.chapterName, topic.name);
    const existing = learningProgress[conceptKey] || {};
    const payload = {
      studentId: session.id,
      studentName: session.name || "Student",
      schoolId: session.schoolId,
      className: session.className || "",
      subject: topic.subject || "General",
      chapter: topic.chapterName || "",
      concept: topic.name || "",
      conceptKey,
      noteCompleted: !!existing.noteCompleted,
      attemptCompleted: !!existing.attemptCompleted,
      updatedAt: new Date().toISOString(),
      ...patch,
    };
    const docId = makeProgressDocId(session.id, conceptKey);
    await setDoc(doc(db, "learningProgress", docId), payload, { merge: true });
    setLearningProgress((prev) => ({ ...prev, [conceptKey]: { ...existing, ...payload } }));
  };

  useEffect(() => {
    if (!session || !chapters.length) return;
    const autoMarkProgress = async () => {
      const jobs = [];
      chapters.forEach((chapter) => {
        chapter.subtopics.forEach((topic) => {
          const conceptKey = makeConceptKey(topic.subject, topic.chapterName, topic.name);
          const hasAttemptTick = !!learningProgress[conceptKey]?.attemptCompleted;
          const report = reportByQuiz[topic.quizId];
          if (!hasAttemptTick && report) {
            jobs.push(upsertProgress(topic, { attemptCompleted: true }));
          }
        });
      });
      if (jobs.length) await Promise.all(jobs);
    };
    autoMarkProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, session?.id, reports.length]);

  const nextChapter = useMemo(() => {
    if (!nextQuiz) return null;
    return chapters.find((ch) => ch.quizIds.includes(nextQuiz.id)) || null;
  }, [chapters, nextQuiz]);

  const leaderboard = useMemo(() => {
    const sessionClassRaw = String(session?.className || "").trim();
    const sessionClassToken = normalizeClassToken(sessionClassRaw);
    const sessionClassGrade = sessionClassRaw.match(/^\d+/)?.[0] || "";
    const classReports = allReports.filter((r) => {
      const reportClassRaw = String(r?.className || "").trim();
      const reportClassToken = normalizeClassToken(reportClassRaw);
      const reportClassGrade = reportClassRaw.match(/^\d+/)?.[0] || "";
      if (reportClassToken && sessionClassToken && reportClassToken === sessionClassToken) return true;
      if (sessionClassGrade && reportClassGrade && sessionClassGrade === reportClassGrade) return true;
      return false;
    });
    const stats = {};

    classReports.forEach((r) => {
      const id = r.studentId || r.userId;
      if (!id) return;
      if (!stats[id]) stats[id] = { name: r.studentName || "Student", totalPercent: 0, quizzes: 0, points: 0 };
      stats[id].totalPercent += Number(r.percentage || 0);
      stats[id].quizzes += 1;
      stats[id].points += Number(r.score || 0);
    });

    return Object.entries(stats)
      .map(([id, data]) => ({
        id,
        name: data.name,
        avg: Math.round(data.totalPercent / Math.max(data.quizzes, 1)),
        points: data.points,
      }))
      .sort((a, b) => b.points - a.points || b.avg - a.avg);
  }, [allReports, session?.className]);

  const studentStats = useMemo(() => {
    const totalQuizzes = reports.length;
    const avgAccuracy = totalQuizzes
      ? Math.round(reports.reduce((sum, r) => sum + Number(r.percentage || 0), 0) / totalQuizzes)
      : 0;
    const totalPoints = reports.reduce((sum, r) => sum + Number(r.score || 0), 0);
    const rankIndex = leaderboard.findIndex((item) => item.id === session?.id);
    const rank = rankIndex >= 0 ? rankIndex + 1 : Math.max(1, leaderboard.length + 1);
    return { totalQuizzes, avgAccuracy, totalPoints, rank };
  }, [reports, leaderboard, learningProgress, session?.id]);

  const overallProgress = useMemo(() => {
    if (!chapters.length) return 0;
    const attempted = reports.length;
    const total = quizzes.length || 1;
    return Math.min(100, Math.round((attempted / total) * 100));
  }, [chapters.length, reports.length, quizzes.length]);

  const recentReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)),
    [reports]
  );

  const progressCards = useMemo(
    () => [
      { label: "Overall Completion", value: `${overallProgress}%`, tone: "green" },
      { label: "Average Accuracy", value: `${studentStats.avgAccuracy}%`, tone: "blue" },
      { label: "Total Points", value: studentStats.totalPoints, tone: "gold" },
      { label: "Class Rank", value: `#${studentStats.rank}`, tone: "violet" },
    ],
    [overallProgress, studentStats]
  );
  const progressHolderTier = useMemo(
    () => getHolderTierByScore(studentStats.avgAccuracy),
    [studentStats.avgAccuracy]
  );

  const placeholderView = useMemo(() => {
    const activeItem = dashboardNavItems.find((item) => item.key === activeNav);
    return {
      title: activeItem?.label || "Coming Soon",
      hint: activeItem?.hint || "Coming soon",
      description: activeItem?.description || "This area is being prepared.",
    };
  }, [activeNav]);

  useEffect(() => {
    const container = subjectScrollRef.current;
    if (!container) return;

    const updateScrollState = () => {
      const maxScroll = container.scrollWidth - container.clientWidth;
      setCanScrollLeft(container.scrollLeft > 5);
      setCanScrollRight(container.scrollLeft < maxScroll - 5);
    };

    updateScrollState();
    container.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      container.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [subjects.length]);

  useEffect(() => {
    if (!subjects.length) {
      if (activeSubject) setActiveSubject("");
      return;
    }

    if (!subjects.some((subject) => subject.key === activeSubject)) {
      setActiveSubject(subjects[0].key);
    }
  }, [subjects, activeSubject]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncSidebarState = () => {
      if (window.innerWidth > 1280) {
        setIsSidebarOpen(false);
      }
    };

    syncSidebarState();
    window.addEventListener("resize", syncSidebarState);
    return () => window.removeEventListener("resize", syncSidebarState);
  }, []);

  const scrollSubjects = (direction) => {
    const container = subjectScrollRef.current;
    if (!container) return;
    const scrollAmount = Math.max(260, Math.round(container.clientWidth * 0.72));
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleNavSelect = (itemKey) => {
    if (lockedNavKeys.has(itemKey)) {
      setNavNotice("Stay tuned, coming soon.");
      setIsSidebarOpen(false);
      return;
    }

    setNavNotice("");
    setActiveNav(itemKey);
    setIsSidebarOpen(false);
  };

  if (!session) return null;

  return (
    <div
      className="student-dashboard-v2"
      style={{
        "--dashboard-bg": `url(${dashboardBackdropUrl})`,
        "--practice-hero-bg": `url(${practiceBackdropUrl})`,
      }}
    >
      <div className="dashboard-scene-backdrop" />
      <div className="dashboard-scene-glow dashboard-glow-a" />
      <div className="dashboard-scene-glow dashboard-glow-b" />
      <div className={`dashboard-shell ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="dashboard-sidebar-toggle"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          aria-expanded={isSidebarOpen}
          aria-controls="dashboard-sidebar-nav"
        >
          <span />
          <span />
          <span />
        </button>
        {isSidebarOpen && <button type="button" className="dashboard-sidebar-scrim" onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation" />}
        <aside className="dashboard-sidebar" id="dashboard-sidebar-nav">
          <div className="dashboard-sidebar-inner">
            <button
              type="button"
              className="brand-wrap brand-button dashboard-brand"
              onClick={() => setShowAccountModal(true)}
            >
              <div className="brand-badge brand-badge-logo">
                <img src={HEPSY_LOGO} alt="Hepsy logo" />
              </div>
              <div>
                <p className="dash-kicker">HEPSY</p>
                <h1>HEPSY</h1>
                <p className="dash-sub">LEARN SMARTER</p>
              </div>
            </button>

            <nav className="dashboard-nav" aria-label="Dashboard navigation">
              {dashboardNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`dashboard-nav-item ${activeNav === item.key ? "active" : "inactive"} ${lockedNavKeys.has(item.key) ? "locked" : ""}`}
                  title={item.description}
                  aria-disabled={lockedNavKeys.has(item.key)}
                  onClick={() => handleNavSelect(item.key)}
                >
                  <span className="dashboard-nav-label">
                    {item.label}
                    {lockedNavKeys.has(item.key) && <span className="dashboard-nav-lock" aria-hidden="true">🔒</span>}
                  </span>
                  {activeNav !== item.key && <small>{item.hint}</small>}
                </button>
              ))}
            </nav>

            <div className="dashboard-side-footer">
              <button
                type="button"
                className="dashboard-side-account brand-wrap brand-button"
                onClick={() => setShowAccountModal(true)}
              >
                <div className="brand-badge brand-badge-logo">
                  <img src={HEPSY_LOGO} alt="Hepsy logo" />
                </div>
                <div>
                  <p className="dash-kicker">{session?.name || "Student"}</p>
                  <strong>{session?.schoolName || "Hepsy Student"}</strong>
                  <span className="dashboard-side-programme">
                    {session?.className ? `Class ${session.className}` : "Student account"}
                  </span>
                </div>
              </button>

              <div className="dashboard-side-actions">
                {canManageDefaultClasses && (
                  <div className="default-class-switcher dashboard-side-class-switcher" aria-label="Selected classes">
                    {selectedClasses.map((className) => (
                      <button
                        type="button"
                        key={className}
                        className={String(session.className) === String(className) ? "active" : ""}
                        onClick={() => switchClass(className)}
                        title={`Class ${className}`}
                      >
                        {className}
                      </button>
                    ))}
                  </div>
                )}
                <div className="dashboard-side-action-row">
                  {canAddDefaultClass && (
                    <button
                      type="button"
                      className="dash-add-class"
                      onClick={() => {
                        setShowClassModal(true);
                        setNewClassStudentName(session.name || "");
                      }}
                      aria-label="Add class"
                    >
                      +
                    </button>
                  )}
                  <button
                    className="dash-logout dashboard-side-logout"
                    onClick={() => {
                      localStorage.removeItem("schoolStudentSession");
                      navigate("/");
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>

            </div>
          </div>
        </aside>
        <section className="dashboard-stage">
      {showAccountModal && (
        <div className="class-modal-backdrop" onClick={() => setShowAccountModal(false)}>
          <div className="class-modal account-modal" onClick={(event) => event.stopPropagation()}>
            <div className="class-modal-head">
              <h2>Account Info</h2>
              <button type="button" onClick={() => setShowAccountModal(false)}>x</button>
            </div>
            <div className="account-grid">
              <div className="account-row">
                <span>Student</span>
                <strong>{session.name || "Student"}</strong>
              </div>
              <div className="account-row">
                <span>Plan</span>
                <strong>{session.planName || session.planId || "Not available"}</strong>
              </div>
              <div className="account-row">
                <span>Subscription valid till</span>
                <strong>{formatDateLabel(session.expiryDate)}</strong>
              </div>
              <div className="account-row">
                <span>Device logged in</span>
                <strong>{session.deviceLabel || getDeviceLabel()}</strong>
              </div>
              <div className="account-row">
                <span>Logged in at</span>
                <strong>{formatDateLabel(session.loggedInAt)}</strong>
              </div>
              <div className="account-row">
                <span>School</span>
                <strong>{session.schoolName || session.schoolId || "Not available"}</strong>
              </div>
            </div>
            {session?.phone && (
              <div className="account-switch-section">
                <div className="account-switch-head">
                  <h3>Switch Child Account</h3>
                  <span>{linkedAccounts.length ? `${linkedAccounts.length} linked` : "No linked accounts"}</span>
                </div>
                {loadingLinkedAccounts ? (
                  <p className="account-switch-empty">Loading linked accounts...</p>
                ) : linkedAccounts.length <= 1 ? (
                  <p className="account-switch-empty">
                    No other linked child accounts found for this phone number.
                  </p>
                ) : (
                  <div className="account-switch-list">
                    {linkedAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        className={`account-switch-card ${
                          account.id === session.id ? "active" : ""
                        }`}
                        onClick={() => switchAccount(account.id)}
                      >
                        <strong>{account.name || "Student"}</strong>
                        <span>
                          Class {account.className || "-"}
                          {account.rollNumber ? ` • Roll ${account.rollNumber}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showClassModal && (
        <div className="class-modal-backdrop">
          <form className="class-modal" onSubmit={addDefaultClass}>
            <div className="class-modal-head">
              <h2>Add Class</h2>
              <button type="button" onClick={() => setShowClassModal(false)}>x</button>
            </div>
            {classError && <div className="login-error">{classError}</div>}
            <input
              className="login-input"
              type="text"
              value={newClassStudentName}
              onChange={(event) => setNewClassStudentName(event.target.value)}
              placeholder="Student name"
            />
            <select
              className="login-input"
              value={newClassName}
              onChange={(event) => setNewClassName(event.target.value)}
              required
            >
              <option value="">Choose class</option>
              {DEFAULT_SCHOOL_CLASS_OPTIONS.filter(
                (className) => !selectedClasses.some((item) => item.toLowerCase() === className.toLowerCase())
              ).map((className) => (
                <option key={className} value={className}>
                  Class {className}
                </option>
              ))}
            </select>
            <button className="start-quiz-btn" type="submit">Save Class</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="dash-loading dashboard-glass-card">Loading your learning dashboard...</div>
      ) : (
        <>
          {navNotice && <div className="dashboard-nav-notice">{navNotice}</div>}
          {activeNav === "home" && (
            <>
              <div className="dashboard-hero-banner dashboard-glass-card">
                <div className="dashboard-hero-overlay" />
                <div className="dashboard-hero-copy">
                  <p className="dashboard-screen-brand">MINT DO &amp; LEARN</p>
                  <h2 className="dashboard-screen-word">LEARN</h2>
                  <h3 className="dashboard-screen-title">Learn by doing. Master for life.</h3>
                  <p className="dashboard-screen-copy">
                    Concept to confidence, one problem at a time. Use the nav to jump into subjects,
                    progress, and leaderboard views without crowding the home screen.
                  </p>
                  <div className="dashboard-hero-tags">
                    <span>Concept First</span>
                    <span>Practice Smart</span>
                    <span>Track Progress</span>
                  </div>
                  {nextQuiz && (
                    <button
                      className="start-quiz-btn dashboard-hero-cta"
                      onClick={() =>
                        navigate(`/quiz/${nextQuiz.id}`, {
                          state: {
                            mode: "chapter",
                            chapterName: nextChapter?.chapterName || nextQuiz.chapter || nextQuiz.title || "Chapter Quiz",
                            quizIds: nextChapter?.quizIds || [nextQuiz.id],
                          },
                        })
                      }
                    >
                      Start Learning
                    </button>
                  )}
                </div>
                <div className="dashboard-level-pill">
                  <span>Level {Math.max(1, Math.ceil((studentStats.totalQuizzes || 1) / 2))}</span>
                  <strong>{studentStats.totalPoints} XP</strong>
                </div>
              </div>
              <div className="dashboard-home-section-label">
                <span>Quick Access</span>
                <p>Jump into the sections that matter most from the left navigation.</p>
              </div>
              <div className="dashboard-home-links">
                <button type="button" className="dashboard-link-card" onClick={() => setActiveNav("practice")}>
                  <span className="dashboard-link-eyebrow">Practice</span>
                  <strong>{subjects.length || 0} learning tracks</strong>
                  <p>Explore chapters, notes, and test access in one focused workspace.</p>
                </button>
                <button type="button" className="dashboard-link-card" onClick={() => setActiveNav("progress")}>
                  <span className="dashboard-link-eyebrow">My Progress</span>
                  <strong>{overallProgress}% overall completion</strong>
                  <p>Review performance, streak quality, and recent attempts in one place.</p>
                </button>
                <button type="button" className="dashboard-link-card" onClick={() => setActiveNav("leaderboard")}>
                  <span className="dashboard-link-eyebrow">Leaderboard</span>
                  <strong>Current rank #{studentStats.rank}</strong>
                  <p>See where you stand in class and what score you need to climb.</p>
                </button>
              </div>
            </>
          )}

          <div className={`dash-grid dashboard-view-grid ${activeNav === "practice" ? "practice-layout" : ""}`}>
            <main className="hero-panel">
              {activeNav === "practice" && (
                <>
                  <section className="dashboard-view-hero dashboard-glass-card practice-hero-card">
                    <span className="dashboard-view-kicker">Practice Workspace</span>
                    <h2>Practice. Improve. Master. <span>One Chapter At A Time.</span></h2>
                    <p>Move through subjects, inspect chapter progress, open notes, and launch tests from one focused practice workspace.</p>
                  </section>
                  <section className="subjects-panel subjects-browser-panel">
                    <div className="row-head row-head-stack">
                      <div>
                        <div className="panel-title">Choose Subject</div>
                        <p className="panel-support-copy">Pick one subject and the chapter list will update instantly.</p>
                      </div>
                      <div className="subject-browser-count">{subjects.length} total</div>
                    </div>
                    <div className="subjects-slider-shell">
                      {canScrollLeft && (
                        <button
                          type="button"
                          className="subjects-slider-arrow subjects-slider-arrow-left"
                          onClick={() => scrollSubjects("left")}
                          aria-label="Scroll subjects left"
                        >
                          ‹
                        </button>
                      )}
                      <div ref={subjectScrollRef} className="subjects-grid-layout subjects-slider-track">
                      {subjects.map((subject, idx) => {
                        const isActive = activeSubject === subject.key;
                        return (
                          <button
                            key={subject.key}
                            className={`subject-card subject-card-grid tone-${subjectPalette[idx % subjectPalette.length]} ${isActive ? "active" : ""}`}
                            onClick={() => setActiveSubject(subject.key)}
                            aria-pressed={isActive}
                            title={`Filter by ${subject.name}`}
                          >
                            
                            <div className="subject-text">
                              <div className="subject-card-topline">
                                <div className="subject-name">{subject.name}</div>
                                <span className={`subject-select-pill ${isActive ? "active" : ""}`}>
                                  {isActive ? "Selected" : "Open"}
                                </span>
                              </div>
                              <div className="subject-meta-row">
                                <div className="subject-meta">{subject.total} Quiz Sets</div>
                                <div className="subject-last-topic">{subject.lastTopic || "Practice"}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      </div>
                      {canScrollRight && (
                        <button
                          type="button"
                          className="subjects-slider-arrow subjects-slider-arrow-right"
                          onClick={() => scrollSubjects("right")}
                          aria-label="Scroll subjects right"
                        >
                          ›
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="quiz-list-panel chapter-workspace-panel">
                    <div className="row-head row-head-stack">
                      <div>
                        <div className="panel-title">
                          {selectedSubjectMeta ? `${selectedSubjectMeta.name} Chapters` : "Chapters"}
                        </div>
                        <p className="panel-support-copy">
                          {selectedSubjectMeta
                            ? `${selectedSubjectMeta.total} quiz sets available for this subject.`
                            : "Choose a subject to explore chapters."}
                        </p>
                      </div>
                      <button className="chapter-filter">
                        {activeSubject ? "Active Subject" : "Select Subject"}
                      </button>
                    </div>
                    {!activeSubject ? (
                      <div className="empty-note">Select a subject to view chapters.</div>
                    ) : chapters.length === 0 ? (
                      <div className="empty-note">No chapters found for selected subject.</div>
                    ) : (
                      <div className="chapter-list-v2">
                        {chapters.map((chapter, chapterIndex) => {
                          const attempted = reports.filter((r) =>
                            chapter.quizIds.some((qid) => reportMatchesQuiz(r, qid))
                          ).length;
                          const chapterProgress = Math.min(100, Math.round((attempted / Math.max(1, chapter.quizIds.length)) * 100));
                          const firstTopicWithNote = chapter.subtopics.find((t) => String(t.noteHtml || "").trim()) || null;
                          const chapterTopics = chapter.subtopics.map((t) => {
                            const k = makeConceptKey(t.subject, t.chapterName, t.name);
                            const p = learningProgress[k] || {};
                            const done = !!p.noteCompleted;
                            return { key: k, name: t.name, done, noteHtml: t.noteHtml || "", chapter: t.chapterName, subject: t.subject };
                          });
                          const chapterNoteDone = chapterTopics.length > 0 && chapterTopics.every((t) => t.done);
                          const hasChapterNote = !!firstTopicWithNote;

                          return (
                            <article key={chapter.chapterKey || `${chapter.subject}__${chapter.chapterName}`} className="chapter-card chapter-card-elevated">
                              <div className="chapter-head chapter-head-flat">
                                <div className="chapter-title-wrap">
                                  <h3>{chapterIndex + 1}. {chapter.chapterName}</h3>
                                  <div className="chapter-meta-badges">
                                    <span>{chapter.subject}</span>
                                    <span>{chapter.quizIds.length} Quiz Sets</span>
                                  </div>
                                </div>
                                <div className="progress-col">
                                  <span>Progress</span>
                                  <div className="mini-track"><div style={{ width: `${chapterProgress}%` }} /></div>
                                </div>
                                <div className="attempt-col">
                                  <span>Attempted</span>
                                  <strong>{attempted} / {chapter.quizIds.length}</strong>
                                </div>
                                <div className="subtopic-actions">
                                  {hasChapterNote && (
                                    <button
                                      className={chapterNoteDone ? "tick-btn" : ""}
                                      onClick={async () => {
                                        navigate("/notes-view", {
                                          state: {
                                            noteHtml: firstTopicWithNote?.noteHtml || "",
                                            title: firstTopicWithNote?.name || chapter.chapterName,
                                            chapter: chapter.chapterName,
                                            subject: chapter.subject,
                                            topics: chapterTopics,
                                            activeTopicKey: chapterTopics.find((t) => String(t.noteHtml || "").trim())?.key || chapterTopics[0]?.key || "",
                                            quizIds: chapter.quizIds,
                                          },
                                        });
                                      }}
                                    >
                                      {chapterNoteDone ? "Done Note" : "Open Note"}
                                    </button>
                                  )}
                                  <button
                                    className={attempted > 0 ? "tick-btn attempt-main-btn" : "attempt-main-btn"}
                                    onClick={() =>
                                      navigate(`/quiz/${chapter.quizIds[0]}`, {
                                        state: {
                                          mode: "chapter",
                                          chapterName: chapter.chapterName,
                                          quizIds: chapter.quizIds,
                                        },
                                      })
                                    }
                                  >
                                    {attempted > 0 ? "Retake Test" : "Start Test"}
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}

              {activeNav === "progress" && (
                <>
                  <section className="dashboard-view-hero dashboard-glass-card">
                    <span className="dashboard-view-kicker">My Progress</span>
                    <h2>Readable progress tracking with the numbers that actually matter.</h2>
                    <p>Review completion, class rank, recent attempts, and score quality in one cleaner view.</p>
                  </section>
                  <div className="progress-metric-grid">
                    {progressCards.map((card) => (
                      <section key={card.label} className={`progress-metric-card tone-${card.tone}`}>
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                      </section>
                    ))}
                  </div>
                  <section className="leader-card recent-score-panel">
                    <div className="row-head row-head-stack">
                      <div>
                        <div className="panel-title">Recent Scores</div>
                        <p className="panel-support-copy">Latest submitted quizzes, sorted from newest to oldest.</p>
                      </div>
                    </div>
                    {recentReports.length === 0 ? (
                      <div className="empty-note">No attempts yet.</div>
                    ) : (
                      <ol className="score-timeline">
                        {recentReports.slice(0, 8).map((report, index) => (
                          <li key={report.id} className="score-timeline-item">
                            <span className="score-order">{String(index + 1).padStart(2, "0")}</span>
                            <div className="score-body">
                              <strong>{report.quizTitle || report.quizId}</strong>
                              <small>{formatDateLabel(report.submittedAt)}</small>
                            </div>
                            <strong className="score-value">{report.percentage}%</strong>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </>
              )}

              {activeNav === "leaderboard" && (
                <>
                  <section className="dashboard-view-hero dashboard-glass-card">
                    <span className="dashboard-view-kicker">Leaderboard</span>
                    <h2>See your class standing clearly, with stronger visual hierarchy.</h2>
                    <p>The ranking board is separated from home so students can focus on competition and movement.</p>
                  </section>
                  {leaderboard.length === 0 ? (
                    <section className="leaderboard-card leaderboard-empty-card">
                      <div className="empty-note">Leaderboard will appear after submissions.</div>
                    </section>
                  ) : (
                    <>
                      <div className="leaderboard-podium">
                        {leaderboard.slice(0, 3).map((entry, idx) => {
                          const holderTier = getHolderTierByScore(entry.avg);
                          return (
                          <article
                            key={entry.id}
                            className={`leader-podium-card podium-${idx + 1} holder-tone-${holderTier.key}`}
                          >
                            <div className="leader-podium-copy">
                              <span className="leader-podium-rank">#{idx + 1}</span>
                              <strong>{entry.name}</strong>
                              <p>{entry.points} pts</p>
                              <small>{entry.avg}% avg accuracy</small>
                            </div>
                            <div className="leader-podium-art" aria-hidden="true">
                              <img
                                className="leader-podium-avatar"
                                src={PROFILE_CARD_IMAGE}
                                alt=""
                              />
                            </div>
                          </article>
                        )})}
                      </div>
                      <section className="leaderboard-card leaderboard-full-card">
                        <div className="row-head row-head-stack">
                          <div>
                            <div className="panel-title">Full Class Ranking</div>
                            <p className="panel-support-copy">Sorted by total points, then average score.</p>
                          </div>
                        </div>
                        <div className="leaderboard-table">
                          {leaderboard.map((entry, idx) => (
                            <div
                              key={entry.id}
                              className={`leaderboard-table-row ${entry.id === session?.id ? "current-student" : ""}`}
                            >
                              <span className="leaderboard-table-rank">#{idx + 1}</span>
                              <strong>{entry.name}</strong>
                              <span>{entry.avg}% Avg</span>
                              <span>{entry.points} pts</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  )}
                </>
              )}

              {activeNav === "profile" && (
                <>
                  <section className="dashboard-view-hero dashboard-glass-card">
                    <span className="dashboard-view-kicker">Profile</span>
                    <h2>Your student details, plan access, and account status in one place.</h2>
                    <p>Review your active plan, expiry date, linked school details, and current registration status without leaving the dashboard.</p>
                  </section>
                  <section className="leader-card profile-details-panel">
                    <div className="row-head row-head-stack">
                      <div>
                        <div className="panel-title">Student Details</div>
                        <p className="panel-support-copy">Basic account and subscription details pulled from your active session.</p>
                      </div>
                    </div>
                    <div className="profile-details-grid">
                      <article className="profile-detail-card">
                        <span>Student Name</span>
                        <strong>{session.name || "Student"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>School</span>
                        <strong>{session.schoolName || session.schoolId || "Not available"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Current Class</span>
                        <strong>{session.className || "Not available"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Selected Classes</span>
                        <strong>{selectedClasses.length ? selectedClasses.join(", ") : "Not available"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Current Plan</span>
                        <strong>{session.planName || activePlan.name || session.planId || "Default"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Plan Access</span>
                        <strong>{session.accessMode || "default-school"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Payment Status</span>
                        <strong>{session.paymentStatus || "Not available"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Registration Status</span>
                        <strong>{session.registrationStatus || "Not available"}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Expiry Date</span>
                        <strong>{formatDateLabel(session.expiryDate)}</strong>
                      </article>
                      <article className="profile-detail-card">
                        <span>Logged In Device</span>
                        <strong>{session.deviceLabel || getDeviceLabel()}</strong>
                      </article>
                    </div>
                  </section>
                </>
              )}

              {!["home", "practice", "progress", "leaderboard", "profile"].includes(activeNav) && (
                <section className="dashboard-view-hero dashboard-glass-card dashboard-placeholder-card">
                  <span className="dashboard-view-kicker">{placeholderView.hint}</span>
                  <h2>{placeholderView.title}</h2>
                  <p>{placeholderView.description}</p>
                </section>
              )}
            </main>

            {activeNav !== "practice" && (
            <aside className="right-panel">
              {activeNav === "home" && (
                <section className="stats-card">
                  <div className="panel-title">Snapshot</div>
                  <div className="stats-grid">
                    <div>
                      <p className="stat-num">{studentStats.totalPoints}</p>
                      <p className="stat-label">Total Points</p>
                    </div>
                    <div>
                      <p className="stat-num">{studentStats.avgAccuracy}%</p>
                      <p className="stat-label">Accuracy</p>
                    </div>
                    <div>
                      <p className="stat-num">{studentStats.totalQuizzes}</p>
                      <p className="stat-label">Quizzes Attempted</p>
                    </div>
                  </div>
                </section>
              )}

              {activeNav === "progress" && (
                <section className={`stats-card progress-summary-panel holder-card holder-card-${progressHolderTier.key}`}>
                  <div className="holder-card-shell">
                    <div className="holder-card-score-block">
                      <span className="holder-card-overall">{studentStats.avgAccuracy}</span>
                      <span className="holder-card-overall-label">OVR</span>
                      <span className="holder-card-tier">{progressHolderTier.label}</span>
                    </div>

                    <div className="holder-card-art">
                      <div className="holder-card-glow"></div>
                      <img
                        className="holder-card-avatar"
                        src={PROFILE_CARD_IMAGE}
                        alt={session?.name ? `${session.name} profile` : "Student profile"}
                      />
                    </div>

                    <div className="holder-card-nameplate">
                      <span className="holder-card-kicker">Profile Summary</span>
                      <strong>{session?.name || "Student"}</strong>
                      <p>{progressHolderTier.accent}</p>
                    </div>

                    <div className="holder-card-stats-grid">
                      <div>
                        <span>COM</span>
                        <strong>{overallProgress}</strong>
                      </div>
                      <div>
                        <span>PTS</span>
                        <strong>{studentStats.totalPoints}</strong>
                      </div>
                      <div>
                        <span>RNK</span>
                        <strong>{studentStats.rank}</strong>
                      </div>
                      <div>
                        <span>ATM</span>
                        <strong>{studentStats.totalQuizzes}</strong>
                      </div>
                      <div>
                        <span>PLN</span>
                        <strong>{session.planName || activePlan.name || "Base"}</strong>
                      </div>
                      <div>
                        <span>EXP</span>
                        <strong>{session.expiryDate ? formatDateLabel(session.expiryDate).split(",")[0] : "NA"}</strong>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeNav === "leaderboard" && (
                <section className="stats-card">
                  <div className="panel-title">Your Standing</div>
                  <div className="progress-summary-list">
                    <div className="progress-summary-item">
                      <span>Current Rank</span>
                      <strong>#{studentStats.rank}</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Total Points</span>
                      <strong>{studentStats.totalPoints}</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Average Accuracy</span>
                      <strong>{studentStats.avgAccuracy}%</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Class Entries</span>
                      <strong>{leaderboard.length}</strong>
                    </div>
                  </div>
                </section>
              )}

              {activeNav === "profile" && (
                <section className="stats-card profile-summary-panel">
                  <div className="panel-title">Profile Summary</div>
                  <div className="progress-summary-list">
                    <div className="progress-summary-item">
                      <span>Plan</span>
                      <strong>{session.planName || activePlan.name || "Default"}</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Expiry</span>
                      <strong>{formatDateLabel(session.expiryDate)}</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Payment</span>
                      <strong>{session.paymentStatus || "Not available"}</strong>
                    </div>
                    <div className="progress-summary-item">
                      <span>Registration</span>
                      <strong>{session.registrationStatus || "Not available"}</strong>
                    </div>
                  </div>
                </section>
              )}

              {!["home", "practice", "progress", "leaderboard", "profile"].includes(activeNav) && (
                <section className="stats-card">
                  <div className="panel-title">Status</div>
                  <div className="empty-note">This section is being prepared.</div>
                </section>
              )}
            </aside>
            )}
          </div>
        </>
      )}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;

