import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  Save,
  Sparkles,
  Users,
} from "lucide-react";
import "./TimetableManager.css";
import { matchesAcademicYearScope, normalizeAcademicYear } from "../schoolYearUtils";

const DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIOD_CHOICES = [4, 5, 6, 7, 8];
const DEFAULT_SETTINGS = {
  activeDays: DAY_OPTIONS.slice(0, 5),
  periodsPerDay: 8,
  breakAfterPeriod: 4,
  startTime: "08:30",
  periodDuration: 45,
};
const DEFAULT_SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Computer Science",
  "Hindi",
  "Malayalam",
];
const FLEX_SUBJECTS = ["Library", "Sports", "Art", "Reading", "Club Activity"];

const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

const mergeSettings = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  activeDays:
    Array.isArray(settings?.activeDays) && settings.activeDays.length
      ? settings.activeDays.filter((day) => DAY_OPTIONS.includes(day))
      : DEFAULT_SETTINGS.activeDays,
});

const buildTimeLabel = (startTime, periodDuration, index) => {
  const [hourText, minuteText] = String(startTime || DEFAULT_SETTINGS.startTime).split(":");
  const hour = Number(hourText || 8);
  const minute = Number(minuteText || 30);
  const startMinutes = hour * 60 + minute + index * Number(periodDuration || DEFAULT_SETTINGS.periodDuration);
  const endMinutes = startMinutes + Number(periodDuration || DEFAULT_SETTINGS.periodDuration);
  const formatTime = (totalMinutes) => {
    const localHour = Math.floor(totalMinutes / 60);
    const localMinute = totalMinutes % 60;
    const suffix = localHour >= 12 ? "PM" : "AM";
    const displayHour = ((localHour + 11) % 12) + 1;
    return `${displayHour}:${String(localMinute).padStart(2, "0")} ${suffix}`;
  };
  return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
};

const buildEmptyTable = (settings) => {
  const merged = mergeSettings(settings);
  const table = {};
  merged.activeDays.forEach((day) => {
    table[day] = {};
    for (let period = 1; period <= merged.periodsPerDay; period += 1) {
      table[day][period] = {
        subject: "",
        teacher: "",
        teacherId: "",
        type: "teaching",
      };
    }
  });
  return table;
};

const sortClasses = (list = []) =>
  [...list].sort((left, right) => {
    const leftGrade = Number(String(left.className || "").match(/^\d+/)?.[0] || 0);
    const rightGrade = Number(String(right.className || "").match(/^\d+/)?.[0] || 0);
    if (leftGrade !== rightGrade) return leftGrade - rightGrade;
    return normalize(left.className).localeCompare(normalize(right.className), undefined, { numeric: true });
  });

const buildSubjectCatalog = (classData = {}, teachers = []) => {
  const teacherDirectory = new Map(
    teachers.map((teacher) => [
      normalize(teacher.id),
      {
        id: normalize(teacher.id),
        name: normalize(teacher.name) || normalize(teacher.email) || "Teacher",
        email: normalizeLower(teacher.email),
      },
    ])
  );

  const catalogMap = new Map();
  const team = Array.isArray(classData.team) ? classData.team : [];

  team.forEach((entry) => {
    const teacherId = normalize(entry.userId);
    const teacherMeta = teacherDirectory.get(teacherId) || {
      id: teacherId,
      name: normalize(entry.name) || normalize(entry.email) || "Teacher",
      email: normalizeLower(entry.email),
    };

    (entry.subjects || []).forEach((subject) => {
      const cleanSubject = normalize(subject);
      if (!cleanSubject) return;
      const key = normalizeLower(cleanSubject);
      if (!catalogMap.has(key)) {
        catalogMap.set(key, {
          subject: cleanSubject,
          teacherId: teacherMeta.id,
          teacherName: teacherMeta.name,
          teacherEmail: teacherMeta.email,
        });
      }
    });
  });

  if (!catalogMap.size) {
    DEFAULT_SUBJECTS.forEach((subject, index) => {
      const fallbackTeacher = teachers[index % Math.max(teachers.length, 1)];
      catalogMap.set(normalizeLower(subject), {
        subject,
        teacherId: normalize(fallbackTeacher?.id),
        teacherName: normalize(fallbackTeacher?.name) || "Unassigned",
        teacherEmail: normalizeLower(fallbackTeacher?.email),
      });
    });
  }

  return Array.from(catalogMap.values()).sort((left, right) =>
    left.subject.localeCompare(right.subject, undefined, { sensitivity: "base" })
  );
};

const getSubjectPriority = (subject) => {
  const key = normalizeLower(subject);
  if (/math|mathematics|science|physics|chemistry|biology/.test(key)) return 1.45;
  if (/english|hindi|malayalam|language/.test(key)) return 1.2;
  if (/social|history|geography|civics|economics/.test(key)) return 1.08;
  if (/computer|coding|robotics/.test(key)) return 1.12;
  if (/art|sports|club|library|reading/.test(key)) return 0.8;
  return 1;
};

const buildWeeklyTargets = (catalog, settings) => {
  const totalSlots = Math.max(0, settings.activeDays.length * settings.periodsPerDay);
  if (!catalog.length || !totalSlots) return {};

  const weighted = catalog.map((item) => ({
    ...item,
    weight: getSubjectPriority(item.subject),
  }));
  const weightTotal = weighted.reduce((sum, item) => sum + item.weight, 0) || weighted.length;
  const targets = {};
  const remainders = [];
  let assigned = 0;

  weighted.forEach((item) => {
    const exact = (item.weight / weightTotal) * totalSlots;
    const base = Math.max(1, Math.floor(exact));
    targets[item.subject] = base;
    assigned += base;
    remainders.push({ subject: item.subject, remainder: exact - base, weight: item.weight });
  });

  if (assigned > totalSlots) {
    const descending = [...weighted].sort((left, right) => getSubjectPriority(right.subject) - getSubjectPriority(left.subject));
    let toTrim = assigned - totalSlots;
    while (toTrim > 0) {
      const candidate = descending.find((item) => targets[item.subject] > 1);
      if (!candidate) break;
      targets[candidate.subject] -= 1;
      toTrim -= 1;
    }
  } else if (assigned < totalSlots) {
    remainders
      .sort((left, right) => (right.remainder === left.remainder ? right.weight - left.weight : right.remainder - left.remainder))
      .forEach((entry) => {
        if (assigned >= totalSlots) return;
        targets[entry.subject] += 1;
        assigned += 1;
      });
  }

  return targets;
};

const buildTeacherBusyMap = (docs, currentDocId) => {
  const busy = new Map();
  docs
    .filter((entry) => entry.id !== currentDocId)
    .forEach((entry) => {
      const table = entry.table || {};
      Object.entries(table).forEach(([day, periods]) => {
        Object.entries(periods || {}).forEach(([period, cell]) => {
          const teacherKey = normalizeLower(cell?.teacherId || cell?.teacher);
          if (!teacherKey) return;
          const slotKey = `${day}_${period}`;
          if (!busy.has(slotKey)) busy.set(slotKey, new Set());
          busy.get(slotKey).add(teacherKey);
        });
      });
    });
  return busy;
};

const scoreCandidate = ({
  subject,
  remainingTargets,
  slotKey,
  busyMap,
  previousCell,
  dailyLoad,
  previousDaySubject,
  teacherKey,
}) => {
  let score = (remainingTargets[subject.subject] || 0) * 10;
  if (!subject.teacherName || subject.teacherName === "Unassigned") score -= 4;
  if (busyMap.get(slotKey)?.has(teacherKey)) score -= 6;
  if (previousCell?.subject === subject.subject) score -= 4;
  if (previousDaySubject === subject.subject) score -= 2;
  score -= (dailyLoad.get(subject.subject) || 0) * 1.8;
  score += getSubjectPriority(subject.subject) * 2;
  return score;
};

const generateSmartTimetable = ({ catalog, settings, currentDocId, schoolTimetables }) => {
  const merged = mergeSettings(settings);
  const busyMap = buildTeacherBusyMap(schoolTimetables, currentDocId);
  const table = buildEmptyTable(merged);
  const weeklyTargets = buildWeeklyTargets(catalog, merged);
  const remainingTargets = { ...weeklyTargets };
  const conflicts = [];

  merged.activeDays.forEach((day, dayIndex) => {
    const dailyLoad = new Map();
    for (let period = 1; period <= merged.periodsPerDay; period += 1) {
      const previousCell = table[day]?.[period - 1] || null;
      const previousDay = merged.activeDays[dayIndex - 1];
      const previousDaySubject = previousDay ? table?.[previousDay]?.[period]?.subject : "";
      const slotKey = `${day}_${period}`;

      const ranked = catalog
        .filter((item) => (remainingTargets[item.subject] || 0) > 0)
        .map((item) => {
          const teacherKey = normalizeLower(item.teacherId || item.teacherName);
          return {
            ...item,
            score: scoreCandidate({
              subject: item,
              remainingTargets,
              slotKey,
              busyMap,
              previousCell,
              dailyLoad,
              previousDaySubject,
              teacherKey,
            }),
          };
        })
        .sort((left, right) => right.score - left.score);

      const selected = ranked[0];
      if (selected) {
        const teacherKey = normalizeLower(selected.teacherId || selected.teacherName);
        const teacherBusy = busyMap.get(slotKey)?.has(teacherKey);
        if (teacherBusy) {
          conflicts.push(`${selected.teacherName || "Teacher"} is already assigned elsewhere on ${day} period ${period}.`);
        }
        table[day][period] = {
          subject: selected.subject,
          teacher: selected.teacherName,
          teacherId: selected.teacherId,
          type: "teaching",
        };
        remainingTargets[selected.subject] = Math.max(0, (remainingTargets[selected.subject] || 0) - 1);
        dailyLoad.set(selected.subject, (dailyLoad.get(selected.subject) || 0) + 1);
      } else {
        const fallback = FLEX_SUBJECTS[(period + dayIndex) % FLEX_SUBJECTS.length];
        table[day][period] = {
          subject: fallback,
          teacher: "",
          teacherId: "",
          type: "activity",
        };
      }
    }
  });

  return {
    table,
    weeklyTargets,
    conflicts,
  };
};

const getTeacherOptionsForSubject = (subject, catalog, teachers) => {
  const subjectKey = normalizeLower(subject);
  const matched = catalog.filter((item) => normalizeLower(item.subject) === subjectKey);
  if (matched.length) {
    return matched.map((item) => ({
      value: item.teacherName,
      label: item.teacherName,
      teacherId: item.teacherId,
    }));
  }
  return teachers.map((teacher) => ({
    value: normalize(teacher.name),
    label: normalize(teacher.name),
    teacherId: normalize(teacher.id),
  }));
};

const buildTimetableStats = (table, settings, catalog, schoolTimetables, currentDocId) => {
  const busyMap = buildTeacherBusyMap(schoolTimetables, currentDocId);
  let filled = 0;
  let unresolved = 0;
  let teacherConflicts = 0;
  const uniqueTeachers = new Set();

  settings.activeDays.forEach((day) => {
    for (let period = 1; period <= settings.periodsPerDay; period += 1) {
      const cell = table?.[day]?.[period];
      if (!cell?.subject) {
        unresolved += 1;
        continue;
      }
      filled += 1;
      if (!cell.teacher && cell.type === "teaching") unresolved += 1;
      if (cell.teacherId || cell.teacher) uniqueTeachers.add(normalizeLower(cell.teacherId || cell.teacher));
      const slotKey = `${day}_${period}`;
      if (busyMap.get(slotKey)?.has(normalizeLower(cell.teacherId || cell.teacher))) {
        teacherConflicts += 1;
      }
    }
  });

  const total = settings.activeDays.length * settings.periodsPerDay;
  return {
    filled,
    total,
    coverage: total ? Math.round((filled / total) * 100) : 0,
    unresolved,
    teacherConflicts,
    teacherCount: uniqueTeachers.size,
    subjectCount: catalog.length,
  };
};

const collectScheduleWarnings = (table, settings, schoolTimetables, currentDocId) => {
  const busyMap = buildTeacherBusyMap(schoolTimetables, currentDocId);
  const warnings = [];

  settings.activeDays.forEach((day) => {
    let previousSubject = "";
    let streak = 0;

    for (let period = 1; period <= settings.periodsPerDay; period += 1) {
      const cell = table?.[day]?.[period];
      const subject = normalize(cell?.subject);
      if (!subject) {
        warnings.push(`Missing subject on ${day} period ${period}.`);
        continue;
      }

      if (subject === previousSubject) {
        streak += 1;
        if (streak >= 3) {
          warnings.push(`${subject} repeats too many times in a row on ${day}.`);
        }
      } else {
        previousSubject = subject;
        streak = 1;
      }

      const teacherKey = normalizeLower(cell?.teacherId || cell?.teacher);
      if (teacherKey && busyMap.get(`${day}_${period}`)?.has(teacherKey)) {
        warnings.push(`${cell.teacher || "Teacher"} has a timing clash on ${day} period ${period}.`);
      }

      if (cell?.type === "teaching" && !normalize(cell?.teacher)) {
        warnings.push(`Assign a teacher for ${subject} on ${day} period ${period}.`);
      }
    }
  });

  return Array.from(new Set(warnings)).slice(0, 8);
};

export default function TimetableManager({ schoolId, school, academicYear = "" }) {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schoolTimetables, setSchoolTimetables] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [timetable, setTimetable] = useState(buildEmptyTable(DEFAULT_SETTINGS));
  const [weeklyTargets, setWeeklyTargets] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const normalizedYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  useEffect(() => {
    if (!schoolId) return undefined;

    const classesQuery = query(collection(db, "classes"), where("schoolId", "==", schoolId));
    const teachersQuery = query(collection(db, "users"), where("schoolId", "==", schoolId));
    const timetablesQuery = query(collection(db, "timetables"), where("schoolId", "==", schoolId));

    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      const nextClasses = sortClasses(
        snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
      );
      setClasses(nextClasses);
      setSelectedClassId((current) => current || nextClasses[0]?.id || "");
    });

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      const nextTeachers = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((teacher) => ["teacher", "class_teacher", ""].includes(normalizeLower(teacher.role)))
        .filter((teacher) => matchesAcademicYearScope(teacher, normalizedYear));
      setTeachers(nextTeachers);
    });

    const unsubscribeTimetables = onSnapshot(timetablesQuery, (snapshot) => {
      setSchoolTimetables(
        snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
      );
    });

    return () => {
      unsubscribeClasses();
      unsubscribeTeachers();
      unsubscribeTimetables();
    };
  }, [normalizedYear, schoolId]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (!selectedClass?.id) {
      setSelectedClassData(null);
      return undefined;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, "classes", selectedClass.id), (snapshot) => {
      setSelectedClassData(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedClass?.id]);

  const currentDocId = useMemo(
    () => (selectedClass?.className ? `${normalizeLower(schoolId)}_${normalizedYear || "general"}_${selectedClass.className}` : ""),
    [normalizedYear, schoolId, selectedClass?.className]
  );

  const currentTimetableDoc = useMemo(
    () => schoolTimetables.find((entry) => entry.id === currentDocId) || null,
    [currentDocId, schoolTimetables]
  );

  const subjectCatalog = useMemo(
    () => buildSubjectCatalog(selectedClassData || {}, teachers),
    [selectedClassData, teachers]
  );

  useEffect(() => {
    if (!selectedClass) return;
    const nextSettings = mergeSettings(currentTimetableDoc?.settings || selectedClassData?.timetableSettings);
    setSettings(nextSettings);

    if (currentTimetableDoc?.table) {
      setTimetable({ ...buildEmptyTable(nextSettings), ...currentTimetableDoc.table });
      setWeeklyTargets(currentTimetableDoc?.weeklyTargets || buildWeeklyTargets(subjectCatalog, nextSettings));
      setHasUnsavedChanges(false);
      setStatus("");
      return;
    }

    const generated = generateSmartTimetable({
      catalog: subjectCatalog,
      settings: nextSettings,
      currentDocId,
      schoolTimetables,
    });
    setTimetable(generated.table);
    setWeeklyTargets(generated.weeklyTargets);
    setHasUnsavedChanges(false);
    setStatus(generated.conflicts.length ? "Draft generated with warnings to review." : "Smart timetable draft generated.");
  }, [selectedClass, selectedClassData, currentTimetableDoc, currentDocId, schoolTimetables, subjectCatalog]);

  const stats = useMemo(
    () => buildTimetableStats(timetable, settings, subjectCatalog, schoolTimetables, currentDocId),
    [currentDocId, schoolTimetables, settings, subjectCatalog, timetable]
  );

  const scheduleWarnings = useMemo(
    () => collectScheduleWarnings(timetable, settings, schoolTimetables, currentDocId),
    [currentDocId, schoolTimetables, settings, timetable]
  );

  const handleRegenerate = () => {
    const generated = generateSmartTimetable({
      catalog: subjectCatalog,
      settings,
      currentDocId,
      schoolTimetables,
    });
    setTimetable(generated.table);
    setWeeklyTargets(generated.weeklyTargets);
    setHasUnsavedChanges(true);
    setStatus(generated.conflicts.length ? "Timetable regenerated. Review the highlighted warnings before saving." : "Timetable regenerated successfully.");
  };

  const clearGrid = () => {
    setTimetable(buildEmptyTable(settings));
    setWeeklyTargets({});
    setHasUnsavedChanges(true);
    setStatus("Grid cleared. You can regenerate or fill the slots manually.");
    setConfirmClearOpen(false);
  };

  const updateCell = (day, period, field, value) => {
    setTimetable((previous) => {
      const currentCell = previous?.[day]?.[period] || {};
      let nextCell = { ...currentCell, [field]: value };

      if (field === "subject") {
        const preferred = subjectCatalog.find((item) => normalizeLower(item.subject) === normalizeLower(value));
        nextCell = {
          ...nextCell,
          subject: value,
          teacher: preferred?.teacherName || currentCell.teacher || "",
          teacherId: preferred?.teacherId || currentCell.teacherId || "",
          type: FLEX_SUBJECTS.includes(value) ? "activity" : "teaching",
        };
      }

      if (field === "teacher") {
        const teacherOption = getTeacherOptionsForSubject(currentCell.subject, subjectCatalog, teachers).find(
          (option) => option.value === value
        );
        nextCell = {
          ...nextCell,
          teacher: value,
          teacherId: teacherOption?.teacherId || "",
        };
      }

      return {
        ...previous,
        [day]: {
          ...previous[day],
          [period]: nextCell,
        },
      };
    });
    setHasUnsavedChanges(true);
  };

  const toggleDay = (day) => {
    setSettings((previous) => {
      const exists = previous.activeDays.includes(day);
      const activeDays = exists
        ? previous.activeDays.filter((entry) => entry !== day)
        : [...previous.activeDays, day].sort(
            (left, right) => DAY_OPTIONS.indexOf(left) - DAY_OPTIONS.indexOf(right)
          );
      const next = mergeSettings({
        ...previous,
        activeDays: activeDays.length ? activeDays : [day],
      });
      setTimetable((current) => ({ ...buildEmptyTable(next), ...current }));
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const updateSettings = (field, value) => {
    setSettings((previous) => {
      const next = mergeSettings({ ...previous, [field]: value });
      setTimetable((current) => ({ ...buildEmptyTable(next), ...current }));
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const saveTimetable = async () => {
    if (!selectedClass?.className || !currentDocId) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, "timetables", currentDocId),
        {
          schoolId,
          schoolName: normalize(school?.schoolName),
          classId: selectedClass.id,
          className: selectedClass.className,
          grade: selectedClass.grade || Number(String(selectedClass.className || "").match(/^\d+/)?.[0] || 0),
          division: selectedClass.division || String(selectedClass.className || "").replace(/^\d+/, ""),
          academicYear: normalizedYear,
          table: timetable,
          settings,
          weeklyTargets,
          warnings: scheduleWarnings,
          updatedAt: serverTimestamp(),
          createdAt: currentTimetableDoc?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );
      setHasUnsavedChanges(false);
      setStatus("Timetable saved successfully.");
    } catch (error) {
      console.error("Failed to save timetable:", error);
      setStatus("Unable to save timetable right now. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  const classTeamCount = Array.isArray(selectedClassData?.team) ? selectedClassData.team.length : 0;

  return (
    <div className="timetable-shell">
      <section className="timetable-hero">
        <div>
          <div className="tt-kicker">School Timetable Studio</div>
          <h2>
            <CalendarDays size={22} />
            Build a balanced weekly timetable
          </h2>
          <p>
            Generate a practical class schedule from your assigned teachers and subjects, then fine tune any slot before publishing.
          </p>
        </div>

        <div className="tt-hero-stats">
          <div className="tt-pill-card">
            <span>Classes</span>
            <strong>{classes.length}</strong>
          </div>
          <div className="tt-pill-card">
            <span>Teachers</span>
            <strong>{teachers.length}</strong>
          </div>
          <div className="tt-pill-card">
            <span>Coverage</span>
            <strong>{stats.coverage}%</strong>
          </div>
        </div>
      </section>

      <section className="timetable-toolbar">
        <div className="tt-toolbar-left">
          <label className="tt-field">
            <span>Class</span>
            <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
              <option value="">Select class</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.className}
                </option>
              ))}
            </select>
          </label>

          <label className="tt-field tt-field-small">
            <span>Periods / day</span>
            <select
              value={settings.periodsPerDay}
              onChange={(event) => updateSettings("periodsPerDay", Number(event.target.value))}
            >
              {PERIOD_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>

          <label className="tt-field tt-field-small">
            <span>Break after</span>
            <select
              value={settings.breakAfterPeriod}
              onChange={(event) => updateSettings("breakAfterPeriod", Number(event.target.value))}
            >
              {Array.from({ length: settings.periodsPerDay }, (_, index) => index + 1).map((choice) => (
                <option key={choice} value={choice}>
                  Period {choice}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="tt-toolbar-right">
          <button type="button" className="tt-secondary-btn" onClick={handleRegenerate} disabled={!selectedClass}>
            <Sparkles size={16} />
            Auto-generate
          </button>
          <button
            type="button"
            className="tt-secondary-btn"
            onClick={() => setConfirmClearOpen(true)}
            disabled={!selectedClass}
          >
            <RefreshCcw size={16} />
            Clear grid
          </button>
          <button type="button" className="tt-primary-btn" onClick={saveTimetable} disabled={!selectedClass || saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Save timetable
          </button>
        </div>
      </section>

      {status ? <div className={`tt-status ${scheduleWarnings.length ? "warning" : "success"}`}>{status}</div> : null}

      {!selectedClass ? (
        <div className="tt-empty-state">Create or select a class to start building its weekly timetable.</div>
      ) : loading ? (
        <div className="tt-empty-state">
          <Loader2 className="spin" size={18} />
          Loading class setup...
        </div>
      ) : (
        <>
          <section className="tt-top-grid">
            <article className="tt-card tt-profile-card">
              <div className="tt-card-head">
                <h3>Class profile</h3>
                {hasUnsavedChanges ? <span className="tt-draft-chip">Unsaved edits</span> : <span className="tt-live-chip">Saved</span>}
              </div>

              <div className="tt-profile-main">
                <div className="tt-profile-mark">{selectedClass.className}</div>
                <div>
                  <strong>{selectedClassData?.classTeacherName || "No class teacher assigned"}</strong>
                  <p>
                    Grade {selectedClassData?.grade || "-"} | Division {selectedClassData?.division || "-"}
                  </p>
                </div>
              </div>

              <div className="tt-mini-stats">
                <div>
                  <span>Team setup</span>
                  <strong>{classTeamCount}</strong>
                </div>
                <div>
                  <span>Subjects</span>
                  <strong>{subjectCatalog.length}</strong>
                </div>
                <div>
                  <span>Warnings</span>
                  <strong>{scheduleWarnings.length}</strong>
                </div>
              </div>

              <div className="tt-day-pills">
                {DAY_OPTIONS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`tt-day-pill ${settings.activeDays.includes(day) ? "active" : ""}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </article>

            <article className="tt-card tt-summary-card">
              <div className="tt-card-head">
                <h3>Generation summary</h3>
                <span>Balanced by subject load</span>
              </div>
              <div className="tt-summary-grid">
                <div className="tt-summary-tile">
                  <CheckCircle2 size={18} />
                  <div>
                    <span>Filled slots</span>
                    <strong>
                      {stats.filled}/{stats.total}
                    </strong>
                  </div>
                </div>
                <div className="tt-summary-tile">
                  <Users size={18} />
                  <div>
                    <span>Teachers used</span>
                    <strong>{stats.teacherCount}</strong>
                  </div>
                </div>
                <div className="tt-summary-tile">
                  <Clock3 size={18} />
                  <div>
                    <span>Break after</span>
                    <strong>P{settings.breakAfterPeriod}</strong>
                  </div>
                </div>
                <div className="tt-summary-tile">
                  <AlertTriangle size={18} />
                  <div>
                    <span>Teacher clashes</span>
                    <strong>{stats.teacherConflicts}</strong>
                  </div>
                </div>
              </div>

              <div className="tt-targets">
                {Object.entries(weeklyTargets)
                  .sort((left, right) => right[1] - left[1])
                  .map(([subject, count]) => (
                    <div className="tt-target-pill" key={subject}>
                      <span>{subject}</span>
                      <strong>{count}/week</strong>
                    </div>
                  ))}
              </div>
            </article>

            <article className="tt-card tt-warnings-card">
              <div className="tt-card-head">
                <h3>Review queue</h3>
                <span>Check before publishing</span>
              </div>
              {scheduleWarnings.length ? (
                <ul className="tt-warning-list">
                  {scheduleWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <div className="tt-clear-state">
                  <CheckCircle2 size={18} />
                  <span>No major schedule issues detected.</span>
                </div>
              )}
            </article>
          </section>

          <section className="tt-card tt-grid-card">
            <div className="tt-card-head">
              <div>
                <h3>Weekly grid</h3>
                <span>Manual edits stay allowed after auto-generation.</span>
              </div>
              <div className="tt-grid-meta">
                <span>Start {settings.startTime}</span>
                <span>{settings.periodDuration} min periods</span>
              </div>
            </div>

            <div className="tt-grid-scroll">
              <table className="tt-grid-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    {Array.from({ length: settings.periodsPerDay }, (_, index) => index + 1).map((period) => (
                      <th key={period}>
                        <div className="tt-period-head">
                          <strong>P{period}</strong>
                          <span>{buildTimeLabel(settings.startTime, settings.periodDuration, period - 1)}</span>
                          {settings.breakAfterPeriod === period ? <em>Break next</em> : null}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settings.activeDays.map((day) => (
                    <tr key={day}>
                      <td className="tt-day-cell">{day}</td>
                      {Array.from({ length: settings.periodsPerDay }, (_, index) => index + 1).map((period) => {
                        const cell = timetable?.[day]?.[period] || {};
                        const teacherOptions = getTeacherOptionsForSubject(cell.subject, subjectCatalog, teachers);
                        return (
                          <td key={`${day}-${period}`} className="tt-slot-cell">
                            <select
                              className="tt-select"
                              value={cell.subject || ""}
                              onChange={(event) => updateCell(day, period, "subject", event.target.value)}
                            >
                              <option value="">Select subject</option>
                              {subjectCatalog.map((item) => (
                                <option key={item.subject} value={item.subject}>
                                  {item.subject}
                                </option>
                              ))}
                              {FLEX_SUBJECTS.map((subject) => (
                                <option key={subject} value={subject}>
                                  {subject}
                                </option>
                              ))}
                            </select>
                            <select
                              className="tt-select tt-select-muted"
                              value={cell.teacher || ""}
                              onChange={(event) => updateCell(day, period, "teacher", event.target.value)}
                            >
                              <option value="">Select teacher</option>
                              {teacherOptions.map((option) => (
                                <option key={`${option.label}-${option.teacherId}`} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {confirmClearOpen ? (
        <div className="tt-modal-overlay" onClick={() => setConfirmClearOpen(false)}>
          <div className="tt-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Clear this timetable grid?</h4>
            <p>
              All unsaved slots for {selectedClass?.className || "the selected class"} will be removed from the current editor.
            </p>
            <div className="tt-modal-note">Saved timetable data in Firestore will remain unchanged until you save again.</div>
            <div className="tt-modal-actions">
              <button type="button" className="tt-secondary-btn" onClick={() => setConfirmClearOpen(false)}>
                Cancel
              </button>
              <button type="button" className="tt-primary-btn" onClick={clearGrid}>
                Clear Grid
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
