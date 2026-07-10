import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { collection, setDoc, doc, getDocs, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import {
  DEFAULT_SCHOOL_SETTINGS_COLLECTION,
  DEFAULT_SCHOOL_SETTINGS_DOC,
  normalizeSchoolId,
} from "../../config/defaultSchool";
import "./Schools.css";

const Schools = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("manage");
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState([]);
  const [schoolStats, setSchoolStats] = useState({});
  const [editSchoolId, setEditSchoolId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [password, setPassword] = useState("");
  const [isPaidSchool, setIsPaidSchool] = useState(false);
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

    const [studentAccountsSnap, enrollmentsSnap, authLinksSnap] = await Promise.all([
      getDocs(collection(db, "studentAccounts")),
      getDocs(collection(db, "defaultSchoolEnrollments")),
      getDocs(collection(db, "schoolAuthLinks")),
    ]);

    const statsMap = {};
    const ensureSchoolStats = (rawSchoolId) => {
      const normalizedId = normalizeSchoolId(rawSchoolId);
      if (!normalizedId) return null;
      if (!statsMap[normalizedId]) {
        statsMap[normalizedId] = {
          totalRegistrations: 0,
          totalPlanEnrollments: 0,
          activePaidStudents: 0,
          generatedAuthLinks: 0,
          latestRegistrationAt: "",
        };
      }
      return statsMap[normalizedId];
    };

    studentAccountsSnap.forEach((entry) => {
      const data = entry.data();
      const bucket = ensureSchoolStats(data.schoolId || data.schoolIdRaw);
      if (!bucket) return;

      bucket.totalRegistrations += 1;

      const paymentStatus = String(data.paymentStatus || "").toLowerCase();
      const registrationStatus = String(data.registrationStatus || "").toLowerCase();
      if (
        data.isPaid === true ||
        paymentStatus === "paid" ||
        registrationStatus === "active"
      ) {
        bucket.activePaidStudents += 1;
      }

      const createdAt = data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || "";
      if (createdAt && (!bucket.latestRegistrationAt || createdAt > bucket.latestRegistrationAt)) {
        bucket.latestRegistrationAt = createdAt;
      }
    });

    enrollmentsSnap.forEach((entry) => {
      const data = entry.data();
      const bucket = ensureSchoolStats(data.schoolId);
      if (!bucket) return;
      bucket.totalPlanEnrollments += 1;

      const updatedAt = data.updatedAt || data.createdAt || "";
      if (updatedAt && (!bucket.latestRegistrationAt || updatedAt > bucket.latestRegistrationAt)) {
        bucket.latestRegistrationAt = updatedAt;
      }
    });

    authLinksSnap.forEach((entry) => {
      const data = entry.data();
      const bucket = ensureSchoolStats(data.schoolId);
      if (!bucket) return;
      bucket.generatedAuthLinks += 1;
    });

    setSchoolStats(statsMap);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSchoolId) {
        await updateDoc(doc(db, "schools", editSchoolId), {
          schoolName,
          schoolId,
          password,
          isPaidSchool,
        });
        alert("School updated successfully!");
        setEditSchoolId(null);
      } else {
        await setDoc(doc(db, "schools", schoolId), {
          schoolName,
          schoolId,
          password,
          isPaidSchool,
        });
        alert("School added successfully!");
      }
      setSchoolName("");
      setSchoolId("");
      setPassword("");
      setIsPaidSchool(false);
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
    setIsPaidSchool(Boolean(school.isPaidSchool));
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
    alert(`${school.schoolName} is now the default school for individual student access. It remains manageable under this school while school-linked student login stays separate.`);
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

  const openSchoolDetails = (school) => {
    const targetId = normalizeSchoolId(school.schoolId || school.id);
    if (!targetId) return;
    navigate(`/admin189201/schools/${encodeURIComponent(targetId)}`);
  };

  const getGeneralFormLink = (school) => {
    const targetId = normalizeSchoolId(school.schoolId || school.id);
    if (!targetId || typeof window === "undefined") return "";
    return `${window.location.origin}/school-form/${encodeURIComponent(targetId)}/student`;
  };

  const overviewStats = schools.reduce(
    (acc, school) => {
      const normalizedId = normalizeSchoolId(school.schoolId);
      const details = schoolStats[normalizedId] || {
        totalRegistrations: 0,
        totalPlanEnrollments: 0,
        activePaidStudents: 0,
        generatedAuthLinks: 0,
      };

      acc.totalSchools += 1;
      acc.totalRegistrations += details.totalRegistrations;
      acc.totalPlanEnrollments += details.totalPlanEnrollments;
      acc.totalPaidStudents += details.activePaidStudents;
      return acc;
    },
    {
      totalSchools: 0,
      totalRegistrations: 0,
      totalPlanEnrollments: 0,
      totalPaidStudents: 0,
    }
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

      <section className="schools-overview-grid">
        <article className="schools-overview-card focus">
          <span>Directory</span>
          <strong>{overviewStats.totalSchools}</strong>
          <p>Total schools currently available in the admin workspace.</p>
        </article>
        <article className="schools-overview-card">
          <span>Registrations</span>
          <strong>{overviewStats.totalRegistrations}</strong>
          <p>Student registration records connected to school workflows.</p>
        </article>
        <article className="schools-overview-card">
          <span>Paid Students</span>
          <strong>{overviewStats.totalPaidStudents}</strong>
          <p>Students with active or paid access across all schools.</p>
        </article>
      </section>

      <div className="schools-inner-tabs">
        <button
          type="button"
          className={activeTab === "manage" ? "active" : ""}
          onClick={() => setActiveTab("manage")}
        >
          Current
        </button>
        <button
          type="button"
          className={activeTab === "details" ? "active" : ""}
          onClick={() => setActiveTab("details")}
        >
          Complete Details
        </button>
      </div>

      {activeTab === "manage" ? (
        <>
          <section className="schools-manage-grid">
            <div className="schools-form-card">
              <div className="schools-section-head">
                <div>
                  <h2>{editSchoolId ? "Update School" : "Create New School"}</h2>
                  <p>Keep school records clean and ready for student access, forms, and subscriptions.</p>
                </div>
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
                <label className="school-paid-toggle" htmlFor="school-paid-toggle">
                  <span>School Access</span>
                  <button
                    id="school-paid-toggle"
                    type="button"
                    className={`school-paid-switch ${isPaidSchool ? "is-paid" : "is-unpaid"}`}
                    onClick={() => setIsPaidSchool((prev) => !prev)}
                    aria-pressed={isPaidSchool}
                  >
                    <span className="school-paid-switch-track" />
                    <span className="school-paid-switch-thumb" />
                    <strong>{isPaidSchool ? "Paid" : "Unpaid"}</strong>
                  </button>
                </label>
                <button type="submit">{editSchoolId ? "Update School" : "Add School"}</button>
              </form>
            </div>

            <div className="schools-utility-card">
              <div className="schools-section-head">
                <div>
                  <h2>Quick Filters</h2>
                  <p>Search by school name or ID and jump faster through the directory.</p>
                </div>
              </div>

              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by name or ID"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

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
            </div>
          </section>

          <div className="schools-list">
            <div className="schools-list-head">
              <div>
                <h2>List of Schools</h2>
                <p>Open a school to see detailed registrations, teachers, classes, links, and subscription data.</p>
              </div>
              <div className="schools-list-count">{filteredSchools.length} visible</div>
            </div>
            {filteredSchools.length > 0 ? (
              <ul>
                {filteredSchools.map((school) => (
                  <li key={school.id}>
                    <div className="school-item-main">
                      <button
                        type="button"
                        className="school-item-link"
                        onClick={() => openSchoolDetails(school)}
                      >
                        <div className="school-item-title-row">
                          <strong>{school.schoolName}</strong>
                          {defaultSchoolId === normalizeSchoolId(school.schoolId) && (
                            <span className="default-school-badge">Default</span>
                          )}
                          <span className={`school-payment-badge ${school.isPaidSchool ? "is-paid" : "is-unpaid"}`}>
                            {school.isPaidSchool ? "Paid" : "Unpaid"}
                          </span>
                        </div>
                        <span className="school-item-id">ID: {school.schoolId}</span>
                      </button>
                      <div className="school-item-mini-stats">
                        <span>Registrations: {schoolStats[normalizeSchoolId(school.schoolId)]?.totalRegistrations || 0}</span>
                        <span>Plans: {schoolStats[normalizeSchoolId(school.schoolId)]?.totalPlanEnrollments || 0}</span>
                        <span>Paid: {schoolStats[normalizeSchoolId(school.schoolId)]?.activePaidStudents || 0}</span>
                      </div>
                    </div>
                    <div className="school-link-box">
                      <label>General Form Link</label>
                      <input value={getGeneralFormLink(school)} readOnly onClick={(e) => e.currentTarget.select()} />
                    </div>
                    <div className="actions">
                      <button type="button" className="btn-default" onClick={() => handleSetDefaultSchool(school)}>
                        {defaultSchoolId === normalizeSchoolId(school.schoolId) ? "Default School" : "Set Default"}
                      </button>
                      <button type="button" className="btn-auth" onClick={() => handleStudentAuth(school)}>
                        {normalizeSchoolId(activeStudentSchoolId) === normalizeSchoolId(school.schoolId) ? "Unauthenticate" : "Auth"}
                      </button>
                      <button type="button" className="btn-link" onClick={() => handleGenerateAuthLink(school)}>Generate Link</button>
                      <button type="button" className="btn-edit" onClick={() => handleEdit(school)}>Edit</button>
                      <button type="button" className="btn-delete" onClick={() => handleDelete(school.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No schools found.</p>
            )}
          </div>
        </>
      ) : (
        <div className="schools-details-view">
          <div className="schools-stats-grid">
            <article className="schools-stat-card">
              <span>Total Schools</span>
              <strong>{overviewStats.totalSchools}</strong>
            </article>
            <article className="schools-stat-card">
              <span>Total Registrations</span>
              <strong>{overviewStats.totalRegistrations}</strong>
            </article>
            <article className="schools-stat-card">
              <span>Plan Enrollments</span>
              <strong>{overviewStats.totalPlanEnrollments}</strong>
            </article>
            <article className="schools-stat-card">
              <span>Paid / Active Students</span>
              <strong>{overviewStats.totalPaidStudents}</strong>
            </article>
          </div>

          <div className="schools-details-card">
            <div className="schools-details-head">
              <div>
                <h2>School-wise Complete Details</h2>
                <p>Quick summary of registrations, paid students, plans, and generated links.</p>
              </div>
            </div>

            <div className="schools-details-table-wrap">
              <table className="schools-details-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>School ID</th>
                    <th>Status</th>
                    <th>General Form Link</th>
                    <th>Total Registration</th>
                    <th>Plan Enrollment</th>
                    <th>Paid Students</th>
                    <th>Auth Links</th>
                    <th>Latest Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.length > 0 ? (
                    filteredSchools.map((school) => {
                      const details =
                        schoolStats[normalizeSchoolId(school.schoolId)] || {};
                      return (
                        <tr key={school.id} className="schools-details-row" onClick={() => openSchoolDetails(school)}>
                          <td>{school.schoolName}</td>
                          <td>{school.schoolId}</td>
                          <td>
                            <span className={`school-payment-badge ${school.isPaidSchool ? "is-paid" : "is-unpaid"}`}>
                              {school.isPaidSchool ? "Paid" : "Unpaid"}
                            </span>
                          </td>
                          <td className="schools-link-cell">
                            <a
                              href={getGeneralFormLink(school)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              Open Form
                            </a>
                          </td>
                          <td>{details.totalRegistrations || 0}</td>
                          <td>{details.totalPlanEnrollments || 0}</td>
                          <td>{details.activePaidStudents || 0}</td>
                          <td>{details.generatedAuthLinks || 0}</td>
                          <td>
                            {details.latestRegistrationAt
                              ? new Date(details.latestRegistrationAt).toLocaleString()
                              : "No activity"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9">No schools found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schools;
