import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, setDoc, doc, getDocs, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import {
  DEFAULT_SCHOOL_SETTINGS_COLLECTION,
  DEFAULT_SCHOOL_SETTINGS_DOC,
  normalizeSchoolId,
} from "../../config/defaultSchool";
import "./Schools.css";

const Schools = () => {
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState([]);
  const [editSchoolId, setEditSchoolId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [password, setPassword] = useState("");
  const [activeStudentSchoolId, setActiveStudentSchoolId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedLogoutLink, setGeneratedLogoutLink] = useState("");
  const [generatedLinkFor, setGeneratedLinkFor] = useState("");
  const [generatedLinkExpiry, setGeneratedLinkExpiry] = useState("");
  const [defaultSchoolId, setDefaultSchoolId] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("studentSchoolAccess");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.schoolId) setActiveStudentSchoolId(parsed.schoolId);
    } catch {
      localStorage.removeItem("studentSchoolAccess");
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const querySnapshot = await getDocs(collection(db, "schools"));
    const schoolsList = [];
    querySnapshot.forEach((entry) => {
      schoolsList.push({ id: entry.id, ...entry.data() });
    });
    setSchools(schoolsList);

    const defaultSnap = await getDoc(doc(db, DEFAULT_SCHOOL_SETTINGS_COLLECTION, DEFAULT_SCHOOL_SETTINGS_DOC));
    if (defaultSnap.exists()) {
      setDefaultSchoolId(normalizeSchoolId(defaultSnap.data().schoolId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSchoolId) {
        await updateDoc(doc(db, "schools", editSchoolId), {
          schoolName,
          schoolId,
          password,
        });
        alert("School updated successfully!");
        setEditSchoolId(null);
      } else {
        await setDoc(doc(db, "schools", schoolId), {
          schoolName,
          schoolId,
          password,
        });
        alert("School added successfully!");
      }
      setSchoolName("");
      setSchoolId("");
      setPassword("");
      fetchSchools();
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "schools", id));
      alert("School deleted successfully!");
      fetchSchools();
    } catch (error) {
      alert("Error deleting school: " + error.message);
    }
  };

  const handleEdit = (school) => {
    setSchoolName(school.schoolName);
    setSchoolId(school.schoolId);
    setEditSchoolId(school.id);
    setPassword(school.password || "");
  };

  const handleStudentAuth = (school) => {
    const normalizedId = normalizeSchoolId(school.schoolId);
    if (normalizeSchoolId(activeStudentSchoolId) === normalizedId) {
      localStorage.removeItem("studentSchoolAccess");
      localStorage.removeItem("schoolStudentSession");
      setActiveStudentSchoolId("");
      alert(`${school.schoolName} student access is now unauthenticated.`);
      return;
    }

    const payload = {
      schoolId: normalizedId,
      schoolName: school.schoolName,
      authenticatedAt: new Date().toISOString(),
      source: "admin189201",
    };
    localStorage.setItem("studentSchoolAccess", JSON.stringify(payload));
    setActiveStudentSchoolId(normalizedId);
    alert(`${school.schoolName} selected for student login. Students can now login at /login using class, section, roll no, and pin.`);
  };

  const handleSetDefaultSchool = async (school) => {
    const normalizedId = normalizeSchoolId(school.schoolId);
    await setDoc(
      doc(db, DEFAULT_SCHOOL_SETTINGS_COLLECTION, DEFAULT_SCHOOL_SETTINGS_DOC),
      {
        schoolId: normalizedId,
        schoolName: school.schoolName || normalizedId,
        enabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "admin189201",
      },
      { merge: true }
    );
    setDefaultSchoolId(normalizedId);
    alert(`${school.schoolName} is now the default school for unauthenticated student access.`);
  };

  const generateToken = () => {
    const bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const handleGenerateAuthLink = async (school) => {
    try {
      const normalizedSchoolId = normalizeSchoolId(school.schoolId || school.id);
      if (!normalizedSchoolId) {
        alert("Cannot generate auth link because this school does not have a valid School ID.");
        return;
      }

      const token = generateToken();
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
      const linkPayload = {
        token,
        schoolDocId: school.id || normalizedSchoolId,
        schoolId: normalizedSchoolId,
        schoolName: school.schoolName || normalizedSchoolId,
        expiresAt,
        createdAt: new Date().toISOString(),
        used: false,
        createdBy: "admin189201",
      };

      const logoutToken = generateToken();
      const logoutPayload = {
        token: logoutToken,
        schoolDocId: linkPayload.schoolDocId,
        schoolId: linkPayload.schoolId,
        schoolName: linkPayload.schoolName,
        expiresAt,
        createdAt: new Date().toISOString(),
        used: false,
        createdBy: "admin189201",
      };

      await setDoc(doc(db, "schoolAuthLinks", token), linkPayload);
      await setDoc(doc(db, "schoolLogoutLinks", logoutToken), logoutPayload);

      const authUrl = `${window.location.origin}/sa/${token}`;
      const logoutUrl = `${window.location.origin}/sl/${logoutToken}`;
      setGeneratedLink(authUrl);
      setGeneratedLogoutLink(logoutUrl);
      setGeneratedLinkFor(linkPayload.schoolName);
      setGeneratedLinkExpiry(new Date(expiresAt).toLocaleString());

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(`Auth: ${authUrl}\nLogout: ${logoutUrl}`);
      }

      alert(`Short auth and logout links generated for ${linkPayload.schoolName}. They are valid for 2 hours.`);
    } catch (error) {
      alert("Failed to generate auth link: " + error.message);
    }
  };

  const filteredSchools = schools.filter(
    (school) =>
      school.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.schoolId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="schools-container">
      <div className="schools-header">
        <div>
          <p className="schools-kicker">Admin Directory</p>
          <h1>Manage Schools</h1>
          <p className="schools-subtitle">Create schools, switch the active student login school, and generate quick access links.</p>
        </div>
        <div className="schools-summary-chip">{filteredSchools.length} schools</div>
      </div>

      <form onSubmit={handleSubmit} className="school-form">
        <input
          type="text"
          placeholder="School Name"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="School ID"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{editSchoolId ? "Update School" : "Add School"}</button>
      </form>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="schools-list">
        <h2>List of Schools</h2>
        {generatedLink && (
          <div className="auth-link-card">
            <p><strong>Latest Short Links:</strong> {generatedLinkFor}</p>
            <p><small>Valid till: {generatedLinkExpiry}</small></p>
            <label>Auth</label>
            <input value={generatedLink} readOnly />
            <label>Logout</label>
            <input value={generatedLogoutLink} readOnly />
          </div>
        )}
        {filteredSchools.length > 0 ? (
          <ul>
            {filteredSchools.map((school) => (
              <li key={school.id}>
                <div className="school-item-main">
                  <div className="school-item-title-row">
                    <strong>{school.schoolName}</strong>
                    {defaultSchoolId === normalizeSchoolId(school.schoolId) && (
                      <span className="default-school-badge">Default</span>
                    )}
                  </div>
                  <span className="school-item-id">ID: {school.schoolId}</span>
                </div>
                <div className="actions">
                  <button className="btn-default" onClick={() => handleSetDefaultSchool(school)}>
                    {defaultSchoolId === normalizeSchoolId(school.schoolId) ? "Default School" : "Set Default"}
                  </button>
                  <button className="btn-auth" onClick={() => handleStudentAuth(school)}>
                    {normalizeSchoolId(activeStudentSchoolId) === normalizeSchoolId(school.schoolId) ? "Unauthenticate" : "Auth"}
                  </button>
                  <button className="btn-link" onClick={() => handleGenerateAuthLink(school)}>Generate Link</button>
                  <button className="btn-edit" onClick={() => handleEdit(school)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(school.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No schools found.</p>
        )}
      </div>
    </div>
  );
};

export default Schools;
