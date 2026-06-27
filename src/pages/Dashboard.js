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
const SubjectIcon = ({ type }) => {
  const map = {
    fx: "π",
    flask: "⚗️",
    eng: "✍️",
    phy: "⚛️",
    chem: "🧪",
    bio: "🧬",
    his: "📜",
    geo: "🌍",
    code: "</>",
    sub: "📚",
  };
  return (
    <span className="subject-logo-glyph" aria-hidden="true">
      {map[type] || "📚"}
    </span>
  );
};

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
  const [session, setSession] = useState(() => safeJsonParse(localStorage.getItem("schoolStudentSession")));
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loadingLinkedAccounts, setLoadingLinkedAccounts] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassStudentName, setNewClassStudentName] = useState("");
  const [classError, setClassError] = useState("");
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

  if (!session) return null;

  return (
    <div className="student-dashboard-v2">
      <header className="dash-topbar">
        <button
          type="button"
          className="brand-wrap brand-button"
          onClick={() => setShowAccountModal(true)}
        >
          <div className="brand-badge">QM</div>
          <div>
            <p className="dash-kicker">MINT</p>
            <h1>MINT (Foundation Programme)</h1>
            <p className="dash-sub">Class {session.className || "N/A"} | {session.schoolName || session.schoolId}</p>
          </div>
        </button>
        <div className="top-actions">
          {canManageDefaultClasses && (
            <div className="default-class-switcher" aria-label="Selected classes">
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
          <button className="dash-logout" onClick={() => { localStorage.removeItem("schoolStudentSession"); navigate("/"); }}>
            Logout
          </button>
        </div>
      </header>

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
        <div className="dash-loading">Loading your learning dashboard...</div>
      ) : (
        <div className="dash-grid">
          <main className="hero-panel">
            <div className="hero-illustration">
              <div className="bubble bubble-a" />
              <div className="bubble bubble-b" />
              <div className="hero-content">
                <p className="continue-label">Continue where you left</p>
                <h2>{nextQuiz ? nextQuiz.chapter || nextQuiz.title || "Ready to Practice" : "No Quiz Yet"}</h2>
                <p>
                  {nextQuiz
                    ? `${nextQuiz.subject || "General"} | ${filteredQuizzes.length} Quiz Sets`
                    : "Ask your teacher/admin to publish quizzes for your class."}
                </p>
                <div className="hero-progress-row">
                  <span>Your Progress</span>
                  <strong>{overallProgress}%</strong>
                </div>
                <div className="hero-progress-track"><div style={{ width: `${overallProgress}%` }} /></div>
                {nextQuiz && (
                  <button
                    className="start-quiz-btn"
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
                    Resume Quiz
                  </button>
                )}
              </div>
              <div className="hero-stack">{"\u{1F4DA}"}</div>
            </div>

            <section className="subjects-panel">
              <div className="row-head">
                <div className="panel-title">Subjects</div>
              </div>
              <div className="subjects-actions">
                <button
                  className="subject-move-btn"
                  onClick={() => subjectScrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                  aria-label="Move subjects left"
                >
                  ← Scroll Left
                </button>
                <button
                  className="subject-move-btn"
                  onClick={() => subjectScrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                  aria-label="Move subjects right"
                >
                  Scroll Right →
                </button>
              </div>
              <div className="subjects-scroll-wrapper">
                <button
                  className={`subjects-nav-btn left-btn ${!canScrollLeft ? "hidden" : ""}`}
                  onClick={() => subjectScrollRef.current?.scrollBy({ left: -320, behavior: "smooth" })}
                  aria-label="Scroll subjects left"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M15 5L8 12L15 19" />
                  </svg>
                </button>
                <div className="subjects-row" ref={subjectScrollRef}>
                  {subjects.map((subject, idx) => {
                    const logo = makeSubjectLogo(subject.name);
                    return (
                      <button
                        key={subject.key}
                        className={`subject-card tone-${subjectPalette[idx % subjectPalette.length]} ${activeSubject === subject.key ? "active" : ""}`}
                        onClick={() => setActiveSubject((prev) => (prev === subject.key ? "" : subject.key))}
                        aria-pressed={activeSubject === subject.key}
                        title={`Filter by ${subject.name}`}
                      >
                        <div className={`subject-logo ${logo.className}`}>
                          <SubjectIcon type={logo.icon} />
                        </div>
                        <div className="subject-text">
                          <div className="subject-name">{subject.name}</div>
                          <div className="subject-meta">{subject.total} Quizzes</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  className={`subjects-nav-btn right-btn ${!canScrollRight ? "hidden" : ""}`}
                  onClick={() => subjectScrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
                  aria-label="Scroll subjects right"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M9 5L16 12L9 19" />
                  </svg>
                </button>
                <div className="fade-left" />
                <div className="fade-right" />
              </div>
            </section>

            <section className="quiz-list-panel">
              <div className="row-head">
                <div className="panel-title">Chapters</div>
                <button className="chapter-filter">{activeSubject ? "Filtered" : "Select Subject"}</button>
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
                      <article key={chapter.chapterKey || `${chapter.subject}__${chapter.chapterName}`} className="chapter-card">
                        <div className="chapter-head chapter-head-flat">
                          <div className="chapter-title-wrap">
                            <h3>{chapterIndex + 1}. {chapter.chapterName}</h3>
                            <p>{chapter.subject} | {chapter.quizIds.length} Quiz Sets</p>
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
                                {chapterNoteDone ? "✓ Note" : "Note"}
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
                              {attempted > 0 ? "✓ Test" : "Test"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>

          <aside className="right-panel">
            <section className="stats-card">
              <div className="panel-title">Your Progress</div>
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

            <section className="leaderboard-card">
              <div className="row-head">
                <div className="panel-title">Class Leaderboard</div>
                <button className="link-btn" onClick={() => navigate("/leaderboard")}>View All</button>
              </div>
              {leaderboard.length === 0 ? (
                <div className="empty-note">Leaderboard will appear after submissions.</div>
              ) : (
                <ol>
                  {leaderboard.slice(0, 5).map((entry, idx) => (
                    <li key={entry.id}>
                      <span>#{idx + 1} {entry.name}</span>
                      <strong>{entry.points} pts</strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="leader-card">
              <div className="row-head">
                <div className="panel-title">Recent Scores</div>
                <button className="link-btn">View All</button>
              </div>
              {reports.length === 0 ? (
                <div className="empty-note">No attempts yet.</div>
              ) : (
                <ol>
                  {reports
                    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
                    .slice(0, 5)
                    .map((report) => (
                    <li key={report.id}>
                      <span>{report.quizTitle || report.quizId}</span>
                      <strong>{report.percentage}%</strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
