import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { normalizeSchoolId } from "../../config/defaultSchool";
import "./AdminSchoolDetails.css";

const formatDateTime = (value) => {
  if (!value) return "N/A";

  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "N/A";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function AdminSchoolDetails() {
  const { schoolId } = useParams();
  const normalizedSchoolId = useMemo(() => normalizeSchoolId(schoolId), [schoolId]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [school, setSchool] = useState(null);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subscriptionSettings, setSubscriptionSettings] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!normalizedSchoolId) {
        setError("School ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        let schoolSnap = await getDoc(doc(db, "schools", normalizedSchoolId));
        let schoolData = null;

        if (schoolSnap.exists()) {
          schoolData = { id: schoolSnap.id, ...schoolSnap.data() };
        } else {
          const schoolsSnap = await getDocs(collection(db, "schools"));
          const matchedSchool = schoolsSnap.docs.find((entry) => {
            const data = entry.data();
            return normalizeSchoolId(data.schoolId || entry.id) === normalizedSchoolId;
          });

          if (matchedSchool) {
            schoolData = { id: matchedSchool.id, ...matchedSchool.data() };
          }
        }

        const [
          studentSnap,
          enrollmentSnap,
          teacherSnap,
          classSnap,
          subscriptionSnap,
          authLinksSnap,
        ] = await Promise.all([
          getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId))),
          getDocs(query(collection(db, "defaultSchoolEnrollments"), where("schoolId", "==", normalizedSchoolId))),
          getDocs(query(collection(db, "users"), where("schoolId", "==", normalizedSchoolId))),
          getDocs(query(collection(db, "classes"), where("schoolId", "==", normalizedSchoolId))),
          getDoc(doc(db, "subscriptionSettings", normalizedSchoolId)),
          getDocs(query(collection(db, "schoolAuthLinks"), where("schoolId", "==", normalizedSchoolId))),
        ]);

        const resolvedSchool = schoolData || {
          id: normalizedSchoolId,
          schoolId: normalizedSchoolId,
          schoolName: "School",
        };

        setSchool({
          ...resolvedSchool,
          authLinkCount: authLinksSnap.size,
        });

        setStudents(
          studentSnap.docs
            .map((entry) => ({
              id: entry.id,
              ...entry.data(),
            }))
            .sort((a, b) => {
              const classCompare = String(a.className || "").localeCompare(String(b.className || ""), undefined, {
                numeric: true,
              });
              if (classCompare !== 0) return classCompare;
              return String(a.rollNumber || "").localeCompare(String(b.rollNumber || ""), undefined, {
                numeric: true,
              });
            })
        );

        setEnrollments(
          enrollmentSnap.docs.map((entry) => ({
            id: entry.id,
            ...entry.data(),
          }))
        );

        setTeachers(
          teacherSnap.docs
            .map((entry) => ({
              id: entry.id,
              ...entry.data(),
            }))
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        );

        setClasses(
          classSnap.docs
            .map((entry) => ({
              id: entry.id,
              ...entry.data(),
            }))
            .sort((a, b) => String(a.className || "").localeCompare(String(b.className || ""), undefined, {
              numeric: true,
            }))
        );

        setSubscriptionSettings(subscriptionSnap.exists() ? subscriptionSnap.data() : null);
      } catch (err) {
        setError(err.message || "Unable to load school details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [normalizedSchoolId]);

  const filteredStudents = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return students;

    return students.filter((student) => {
      return [
        student.fullName,
        student.className,
        student.rollNumber,
        student.phone,
        student.parentPhone,
        student.schoolName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(keyword));
    });
  }, [search, students]);

  const paidStudents = useMemo(
    () =>
      students.filter((student) => {
        const paymentStatus = String(student.paymentStatus || "").toLowerCase();
        const registrationStatus = String(student.registrationStatus || "").toLowerCase();
        return student.isPaid === true || paymentStatus === "paid" || registrationStatus === "active";
      }).length,
    [students]
  );

  return (
    <div className="admin-school-details-page">
      <div className="admin-school-details-shell">
        <div className="admin-school-details-topbar">
          <div>
            <p className="admin-school-details-kicker">Admin / School Details</p>
            <h1>{school?.schoolName || normalizedSchoolId || "School Details"}</h1>
            <p className="admin-school-details-subtitle">
              Full management view with school settings, student list, teachers, classes, and plan records.
            </p>
          </div>
          <Link to="/admin189201" className="admin-school-details-back">
            Back to Admin
          </Link>
        </div>

        {loading ? (
          <div className="admin-school-details-card">Loading school details...</div>
        ) : error ? (
          <div className="admin-school-details-card admin-school-details-error">{error}</div>
        ) : (
          <>
            <section className="admin-school-stats-grid">
              <article className="admin-school-stat-card">
                <span>Total Students</span>
                <strong>{students.length}</strong>
              </article>
              <article className="admin-school-stat-card">
                <span>Paid Students</span>
                <strong>{paidStudents}</strong>
              </article>
              <article className="admin-school-stat-card">
                <span>Plan Enrollments</span>
                <strong>{enrollments.length}</strong>
              </article>
              <article className="admin-school-stat-card">
                <span>Teachers</span>
                <strong>{teachers.length}</strong>
              </article>
              <article className="admin-school-stat-card">
                <span>Classes</span>
                <strong>{classes.length}</strong>
              </article>
              <article className="admin-school-stat-card">
                <span>Auth Links</span>
                <strong>{school?.authLinkCount || 0}</strong>
              </article>
            </section>

            <section className="admin-school-details-grid">
              <div className="admin-school-details-card">
                <h2>School Profile</h2>
                <div className="admin-school-meta-grid">
                  <div>
                    <span>School Name</span>
                    <strong>{formatValue(school?.schoolName)}</strong>
                  </div>
                  <div>
                    <span>School ID</span>
                    <strong>{formatValue(school?.schoolId || school?.id)}</strong>
                  </div>
                  <div>
                    <span>Password</span>
                    <strong>{formatValue(school?.password)}</strong>
                  </div>
                  <div>
                    <span>Selected Plan</span>
                    <strong>{formatValue(school?.selectedPlanName || school?.selectedPlanId)}</strong>
                  </div>
                  <div>
                    <span>Plan Amount</span>
                    <strong>{formatValue(school?.planAmount)}</strong>
                  </div>
                  <div>
                    <span>Auth Links Generated</span>
                    <strong>{formatValue(school?.authLinkCount)}</strong>
                  </div>
                  <div>
                    <span>General Form Link</span>
                    <strong>
                      {typeof window !== "undefined"
                        ? `${window.location.origin}/school-form/${encodeURIComponent(
                            school?.schoolId || school?.id || normalizedSchoolId
                          )}/student`
                        : "N/A"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="admin-school-details-card">
                <h2>Subscription Settings</h2>
                {subscriptionSettings ? (
                  <div className="admin-school-meta-grid">
                    {Object.entries(subscriptionSettings).map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>{formatValue(value)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="admin-school-empty">No subscription settings document found for this school.</p>
                )}
              </div>
            </section>

            <section className="admin-school-details-card">
              <div className="admin-school-section-head">
                <div>
                  <h2>Student Details</h2>
                  <p>Includes name, class, roll number, phone, parent phone, PIN, and payment status.</p>
                </div>
                <input
                  className="admin-school-search"
                  type="text"
                  placeholder="Search students by name, class, roll, phone..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="admin-school-table-wrap">
                <table className="admin-school-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Roll No</th>
                      <th>Phone</th>
                      <th>Parent Phone</th>
                      <th>PIN</th>
                      <th>Payment Status</th>
                      <th>Registration Status</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td>{formatValue(student.fullName || student.name)}</td>
                          <td>{formatValue(student.className)}</td>
                          <td>{formatValue(student.rollNumber)}</td>
                          <td>{formatValue(student.phone)}</td>
                          <td>{formatValue(student.parentPhone)}</td>
                          <td>{formatValue(student.pin)}</td>
                          <td>{formatValue(student.paymentStatus)}</td>
                          <td>{formatValue(student.registrationStatus)}</td>
                          <td>{formatDateTime(student.createdAt)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9">No students found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-school-details-grid">
              <div className="admin-school-details-card">
                <h2>Teacher Details</h2>
                {teachers.length > 0 ? (
                  <div className="admin-school-table-wrap">
                    <table className="admin-school-table compact">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Subject</th>
                          <th>Assigned Class</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.map((teacher) => (
                          <tr key={teacher.id}>
                            <td>{formatValue(teacher.name)}</td>
                            <td>{formatValue(teacher.email)}</td>
                            <td>{formatValue(teacher.phone)}</td>
                            <td>{formatValue(teacher.subject)}</td>
                            <td>{formatValue(teacher.assignedClass)}</td>
                            <td>{formatValue(teacher.role)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-school-empty">No teacher records found.</p>
                )}
              </div>

              <div className="admin-school-details-card">
                <h2>Class Details</h2>
                {classes.length > 0 ? (
                  <div className="admin-school-table-wrap">
                    <table className="admin-school-table compact">
                      <thead>
                        <tr>
                          <th>Class Name</th>
                          <th>Division</th>
                          <th>Grade</th>
                          <th>Team Count</th>
                          <th>Created At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((classRow) => (
                          <tr key={classRow.id}>
                            <td>{formatValue(classRow.className)}</td>
                            <td>{formatValue(classRow.division)}</td>
                            <td>{formatValue(classRow.grade)}</td>
                            <td>{Array.isArray(classRow.team) ? classRow.team.length : 0}</td>
                            <td>{formatDateTime(classRow.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-school-empty">No class records found.</p>
                )}
              </div>
            </section>

            <section className="admin-school-details-card">
              <h2>Plan Enrollment Details</h2>
              {enrollments.length > 0 ? (
                <div className="admin-school-table-wrap">
                  <table className="admin-school-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Roll No</th>
                        <th>Phone</th>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Updated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enrollment) => (
                        <tr key={enrollment.id}>
                          <td>{formatValue(enrollment.name)}</td>
                          <td>{formatValue(enrollment.className)}</td>
                          <td>{formatValue(enrollment.rollNumber)}</td>
                          <td>{formatValue(enrollment.phone)}</td>
                          <td>{formatValue(enrollment.planName || enrollment.selectedPlanName || enrollment.planId)}</td>
                          <td>{formatValue(enrollment.planAmount)}</td>
                          <td>{formatValue(enrollment.paymentStatus || enrollment.registrationStatus)}</td>
                          <td>{formatDateTime(enrollment.updatedAt || enrollment.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-school-empty">No plan enrollment records found.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
