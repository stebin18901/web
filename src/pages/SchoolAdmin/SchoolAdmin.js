// src/pages/SchoolAdmin/SchoolAdmin.js
import React, { Suspense, lazy, useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

const SchoolLogin = lazy(() => import("./SchoolLogin"));
const MainPage = lazy(() => import("./MainPage"));

const SESSION_STORAGE_KEY = "schoolData";
const SESSION_TIMESTAMP_KEY = "schoolAdminSessionAt";
const SESSION_DOC_ID_KEY = "schoolAdminSessionDocId";
const SESSION_AUTH_MODE_KEY = "schoolAdminAuthMode";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;
const normalizeSchoolId = (value) => String(value || "").trim().toLowerCase();

const AdminBootLoader = () => (
  <div
    style={{
      minHeight: "40vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      color: "#475569",
      fontSize: "0.95rem",
      fontWeight: 600,
    }}
  >
    Loading...
  </div>
);

const clearSchoolAdminSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_TIMESTAMP_KEY);
  localStorage.removeItem(SESSION_DOC_ID_KEY);
  localStorage.removeItem(SESSION_AUTH_MODE_KEY);
};

const resolveSchoolSession = async (savedSchool) => {
  const exactDocId = String(savedSchool?.schoolDocId || savedSchool?.id || "").trim();
  if (exactDocId) {
    const exactSnap = await getDoc(doc(db, "schools", exactDocId));
    if (exactSnap.exists()) {
      return {
        id: exactSnap.id,
        schoolDocId: exactSnap.id,
        ...exactSnap.data(),
      };
    }
  }

  const schoolId = String(savedSchool?.schoolId || savedSchool?.id || "").trim();
  const normalizedId = normalizeSchoolId(schoolId);
  if (!normalizedId) return null;

  const directCandidates = Array.from(new Set([schoolId, normalizedId].filter(Boolean)));
  for (const candidate of directCandidates) {
    const snap = await getDoc(doc(db, "schools", candidate));
    if (snap.exists()) {
      return { id: snap.id, schoolDocId: snap.id, ...snap.data() };
    }
  }

  const bySchoolId = await getDocs(
    query(collection(db, "schools"), where("schoolId", "==", normalizedId), limit(1))
  );
  if (!bySchoolId.empty) {
    const match = bySchoolId.docs[0];
    return { id: match.id, schoolDocId: match.id, ...match.data() };
  }

  return null;
};

const SchoolAdmin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [schoolData, setSchoolData] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const savedData = localStorage.getItem(SESSION_STORAGE_KEY);
        const savedTimestamp = Number(localStorage.getItem(SESSION_TIMESTAMP_KEY) || 0);
        if (!savedData || !savedTimestamp) return;

        const isExpired = Date.now() - savedTimestamp > SESSION_MAX_AGE_MS;
        if (isExpired) {
          clearSchoolAdminSession();
          return;
        }

        const parsed = JSON.parse(savedData);
        const resolvedSchool = await resolveSchoolSession(parsed);
        if (!resolvedSchool || cancelled) {
          clearSchoolAdminSession();
          return;
        }

        setSchoolData(resolvedSchool);
        setAuthenticated(true);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(resolvedSchool));
        localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
        localStorage.setItem(
          SESSION_DOC_ID_KEY,
          String(resolvedSchool.schoolDocId || resolvedSchool.id || resolvedSchool.schoolId || "").trim()
        );
      } catch (error) {
        console.error("Failed to restore school-admin session", error);
        clearSchoolAdminSession();
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoginSuccess = (data) => {
    setSchoolData(data);
    setAuthenticated(true);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(
      SESSION_DOC_ID_KEY,
      String(data?.schoolDocId || data?.id || data?.schoolId || "").trim()
    );
    localStorage.setItem(
      SESSION_AUTH_MODE_KEY,
      String(data?.authMode || "local").trim().toLowerCase()
    );
  };

  const handleLogout = () => {
    clearSchoolAdminSession();
    setAuthenticated(false);
    setSchoolData(null);
  };

  if (bootLoading) {
    return <AdminBootLoader />;
  }

  if (!authenticated) {
    return (
      <Suspense fallback={<AdminBootLoader />}>
        <SchoolLogin onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AdminBootLoader />}>
      <Routes>
        <Route path="/*" element={<MainPage school={schoolData} onLogout={handleLogout} />} />
      </Routes>
    </Suspense>
  );
};

export default SchoolAdmin;
