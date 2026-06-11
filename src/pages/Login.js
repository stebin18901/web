import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase/firebaseConfig";
import { db } from "../firebase/firebaseConfig";
import {
  buildAvailableClasses,
  DEFAULT_SCHOOL_SETTINGS_COLLECTION,
  DEFAULT_SCHOOL_SETTINGS_DOC,
  getUniqueClasses,
  normalizePhone,
  normalizeClassName,
  normalizeSchoolId,
} from "../config/defaultSchool";
import "./Login.css";

const buildDefaultSchoolSession = (id, enrollment, schoolContext) => {
  const selectedClasses = getUniqueClasses(enrollment.selectedClasses || [enrollment.className]);
  return {
    id,
    name: enrollment.name || enrollment.phone || "Student",
    className: selectedClasses[0] || enrollment.className || "Default",
    defaultClassName: enrollment.className || selectedClasses[0] || "",
    selectedClasses,
    classProfiles: enrollment.classProfiles || {},
    section: "",
    rollNumber: "",
    phone: enrollment.phone || "",
    schoolName: enrollment.schoolName || schoolContext.schoolName,
    schoolId: enrollment.schoolId || schoolContext.schoolId,
    accessMode: "default-school",
    planId: enrollment.planId || "",
    planName: enrollment.planName || "",
    planMaxClasses: enrollment.planMaxClasses || selectedClasses.length || 1,
  };
};

const Login = () => {
  const [schoolContext, setSchoolContext] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedClassName, setSelectedClassName] = useState("");
  const [selectedRollNumber, setSelectedRollNumber] = useState("");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [defaultAuthMode, setDefaultAuthMode] = useState("login");
  const [defaultName, setDefaultName] = useState("");
  const [defaultClassName, setDefaultClassName] = useState("");
  const [availableDefaultClasses, setAvailableDefaultClasses] = useState([]);
  const [loadingDefaultClasses, setLoadingDefaultClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [features, setFeatures] = useState([]);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [error, setError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [lastOtpRequestTime, setLastOtpRequestTime] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const OTP_COOLDOWN_MS = 60000; // 60 seconds cooldown between OTP requests

  useEffect(() => {
    const studentSession = localStorage.getItem("schoolStudentSession");
    if ((studentSession || (user && !otpSent)) && (location.pathname === "/login" || location.pathname === "/")) {
      navigate("/dashboard", { replace: true });
    }
  }, [location.pathname, navigate, otpSent, user]);

  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  const clearRecaptchaVerifier = () => {
    if (window.defaultSchoolRecaptchaVerifier) {
      try {
        window.defaultSchoolRecaptchaVerifier.clear();
      } catch (e) {
        console.error("Error clearing reCAPTCHA verifier:", e);
      }
      window.defaultSchoolRecaptchaVerifier = null;
    }

    // Explicitly reset the inner node structure to fully purge hidden iframe residue left by Firebase
    const container = document.getElementById("default-school-recaptcha");
    if (container) {
      container.innerHTML = '<div id="default-school-recaptcha-inner"></div>';
    }
  };

  const resetOtp = () => {
    clearRecaptchaVerifier();
    setOtpSent(false);
    setOtpCode("");
    setConfirmationResult(null);
    setOtpNotice("");
  };

  const sendOtp = async (cleanPhone) => {
    try {
      const now = Date.now();
      const timeSinceLastRequest = now - lastOtpRequestTime;
      if (lastOtpRequestTime > 0 && timeSinceLastRequest < OTP_COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((OTP_COOLDOWN_MS - timeSinceLastRequest) / 1000);
        setError(`Please wait ${secondsRemaining} seconds before requesting another OTP.`);
        return false;
      }

      // Clear memory references and reset the raw HTML element inner node
      clearRecaptchaVerifier();

      const verifierContainer = document.getElementById("default-school-recaptcha-inner");
      if (!verifierContainer) {
        setError("reCAPTCHA target container not found. Please refresh the page.");
        return false;
      }

      // Bind directly onto the dynamically refreshed nested container targeting identifier
      window.defaultSchoolRecaptchaVerifier = new RecaptchaVerifier(
        auth,
        "default-school-recaptcha-inner",
        {
          size: "invisible",
        }
      );

      const confirmation = await signInWithPhoneNumber(
        auth,
        `+91${cleanPhone}`,
        window.defaultSchoolRecaptchaVerifier
      );
      
      setLastOtpRequestTime(Date.now());
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setOtpNotice("OTP sent to this phone number.");
      setError("");
      return true;
    } catch (err) {
      console.error("Error sending OTP:", err);
      clearRecaptchaVerifier();
      
      let errorMessage = "Failed to send OTP. Please try again.";
      if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many OTP requests. Please wait a few minutes before trying again.";
      } else if (err.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format.";
      } else if (err.code === "auth/operation-not-allowed") {
        errorMessage = "Phone authentication is not enabled. Please contact support.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      return false;
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResult) {
      setError("Please send OTP first.");
      return false;
    }
    if (otpCode.trim().length < 4) {
      setError("Enter the OTP.");
      return false;
    }
    await confirmationResult.confirm(otpCode.trim());
    return true;
  };

  useEffect(() => {
    const loadSchoolContext = async () => {
      const raw = localStorage.getItem("studentSchoolAccess");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.schoolId) {
            setSchoolContext({
              schoolId: normalizeSchoolId(parsed.schoolId),
              schoolName: parsed.schoolName || parsed.schoolId,
              accessMode: "school-auth",
            });
            return;
          }
        } catch {
          localStorage.removeItem("studentSchoolAccess");
        }
      }

      try {
        const defaultRef = doc(db, DEFAULT_SCHOOL_SETTINGS_COLLECTION, DEFAULT_SCHOOL_SETTINGS_DOC);
        const defaultSnap = await getDoc(defaultRef);
        if (!defaultSnap.exists()) return;

        const defaultData = defaultSnap.data();
        const defaultSchoolId = normalizeSchoolId(defaultData.schoolId);
        if (!defaultSchoolId || defaultData.enabled === false) return;

        const schoolSnap = await getDoc(doc(db, "schools", defaultSchoolId));
        const schoolData = schoolSnap.exists() ? schoolSnap.data() : {};
        setSchoolContext({
          schoolId: defaultSchoolId,
          schoolName: schoolData.schoolName || defaultData.schoolName || defaultSchoolId,
          accessMode: "default-school",
        });
      } catch (err) {
        setError("Unable to load default school.");
      }
    };

    loadSchoolContext();
  }, []);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const snap = await getDocs(collection(db, "features"));
        const featureData = snap.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
          .filter((feature) => feature.image);

        setFeatures(featureData);
      } catch (err) {
        setFeatures([]);
      }
    };

    fetchFeatures();
  }, []);

  useEffect(() => {
    if (features.length <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % features.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [features.length]);

  useEffect(() => {
    const fetchStudents = async () => {
      if (!schoolContext?.schoolId || schoolContext.accessMode === "default-school") {
        setStudents([]);
        return;
      }

      setLoadingStudents(true);
      setError("");

      try {
        const q = query(collection(db, "studentAccounts"), where("schoolId", "==", schoolContext.schoolId));
        const snap = await getDocs(q);
        const data = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setStudents(data);
      } catch (err) {
        setError("Unable to load students for this school.");
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [schoolContext]);

  useEffect(() => {
    const fetchAvailableDefaultClasses = async () => {
      if (schoolContext?.accessMode !== "default-school") {
        setAvailableDefaultClasses([]);
        return;
      }

      setLoadingDefaultClasses(true);
      try {
        const [chapterSnap, quizSnap] = await Promise.all([
          getDocs(collection(db, "chapters")),
          getDocs(collection(db, "quizzes")),
        ]);
        const chapterRows = chapterSnap.docs.map((docSnap) => docSnap.data());
        const quizRows = quizSnap.docs.map((docSnap) => docSnap.data());
        const classes = buildAvailableClasses([...chapterRows, ...quizRows], [defaultClassName]);
        setAvailableDefaultClasses(classes);
        if (classes.length && defaultAuthMode === "register" && !classes.includes(defaultClassName)) {
          setDefaultClassName(classes[0]);
        }
      } catch (err) {
        setAvailableDefaultClasses(defaultClassName ? [defaultClassName] : []);
      } finally {
        setLoadingDefaultClasses(false);
      }
    };

    fetchAvailableDefaultClasses();
  }, [defaultAuthMode, defaultClassName, schoolContext]);

  const classOptions = useMemo(() => {
    const classSet = new Set(
      students
        .map((s) => String(s.className || s.class || "").trim())
        .filter(Boolean)
    );

    return [...classSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  useEffect(() => {
    if (!classOptions.length) {
      setSelectedClassName("");
      return;
    }

    if (!classOptions.includes(selectedClassName)) {
      setSelectedClassName(classOptions[0]);
    }
  }, [classOptions, selectedClassName]);

  const rollOptions = useMemo(() => {
    return students
      .filter((s) => String(s.className || s.class || "").trim() === selectedClassName)
      .map((s) => String(s.rollNumber || s.roll || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, selectedClassName]);

  useEffect(() => {
    if (!rollOptions.length) {
      setSelectedRollNumber("");
      return;
    }

    if (!rollOptions.includes(selectedRollNumber)) {
      setSelectedRollNumber(rollOptions[0]);
    }
  }, [rollOptions, selectedRollNumber]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!schoolContext?.schoolId) {
        setError("No school is available for student access.");
        return;
      }

      if (schoolContext.accessMode === "default-school") {
        const cleanPhone = normalizePhone(phone);
        if (cleanPhone.length !== 10) {
          setError("Enter a valid 10 digit phone number.");
          return;
        }

        const enrollmentId = `${schoolContext.schoolId}_${cleanPhone}`;
        const enrollmentRef = doc(db, "defaultSchoolEnrollments", enrollmentId);
        const enrollmentSnap = await getDoc(enrollmentRef);
        const existingEnrollment = enrollmentSnap.exists() ? enrollmentSnap.data() : null;

        if (defaultAuthMode === "login") {
          if (!existingEnrollment) {
            setError("No registration found for this phone number. Please register first.");
            return;
          }

          if (!otpSent) {
            const otpNoticeMsg = existingEnrollment.isPaid
              ? "OTP sent to this phone number."
              : "Registration found. Enter OTP to continue to payment.";
            setOtpNotice(otpNoticeMsg);
            const success = await sendOtp(cleanPhone);
            if (!success) {
              setIsSubmitting(false);
              return;
            }
            setIsSubmitting(false);
            return;
          }

          const otpVerified = await verifyOtp();
          if (!otpVerified) return;

          if (!existingEnrollment.isPaid || !existingEnrollment.planId) {
            navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
            return;
          }

          localStorage.setItem(
            "schoolStudentSession",
            JSON.stringify(buildDefaultSchoolSession(enrollmentId, existingEnrollment, schoolContext))
          );
          navigate("/dashboard");
          return;
        }

        const cleanName = defaultName.trim();
        const cleanClassName = normalizeClassName(defaultClassName);
        if (!cleanName) {
          setError("Enter student name.");
          return;
        }
        if (!cleanClassName) {
          setError("Enter class.");
          return;
        }

        if (!otpSent) {
          const success = await sendOtp(cleanPhone);
          if (!success) {
            setIsSubmitting(false);
            return;
          }
          setIsSubmitting(false);
          return;
        }
        const otpVerified = await verifyOtp();
        if (!otpVerified) return;

        const enrollmentPayload = {
          phone: cleanPhone,
          name: cleanName,
          schoolId: schoolContext.schoolId,
          schoolName: schoolContext.schoolName,
          className: cleanClassName,
          accessMode: "default-school",
          selectedClasses: getUniqueClasses([cleanClassName]),
          updatedAt: new Date().toISOString(),
        };

        if (!existingEnrollment) {
          await setDoc(enrollmentRef, {
            ...enrollmentPayload,
            isPaid: false,
            createdAt: new Date().toISOString(),
          });
        } else if (existingEnrollment.isPaid) {
          if (!existingEnrollment.planId) {
            await setDoc(enrollmentRef, enrollmentPayload, { merge: true });
            navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
            return;
          }

          localStorage.setItem(
            "schoolStudentSession",
            JSON.stringify(buildDefaultSchoolSession(enrollmentId, existingEnrollment, schoolContext))
          );
          navigate("/dashboard");
          return;
        } else {
          await setDoc(enrollmentRef, enrollmentPayload, { merge: true });
        }

        navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
        return;
      }

      if (!selectedClassName || !selectedRollNumber) {
        setError("Please choose class and roll number.");
        return;
      }

      const student = students.find(
        (s) =>
          String(s.className || s.class || "").trim() === selectedClassName &&
          String(s.rollNumber || s.roll || "").trim() === selectedRollNumber
      );

      if (!student) {
        setError("Student not found.");
        return;
      }

      const studentPin = String(student.pin || student.password || "").trim();
      if (!studentPin || studentPin !== pin.trim()) {
        setError("Invalid PIN.");
        return;
      }

      const session = {
        id: student.id,
        name: student.fullName || student.name || `Roll ${selectedRollNumber}`,
        className: selectedClassName,
        section: student.section || "",
        rollNumber: selectedRollNumber,
        schoolName: schoolContext.schoolName,
        schoolId: schoolContext.schoolId,
      };

      localStorage.setItem("schoolStudentSession", JSON.stringify(session));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to complete login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeFeature = features[activeFeatureIndex];

  return (
    <div className="login-container">
      <section className="login-feature-slider" aria-label="Featured programs">
        {features.length > 0 ? (
          <>
            {features.map((feature, index) => (
              <article
                className={`login-feature-slide ${index === activeFeatureIndex ? "active" : ""}`}
                key={feature.id}
                aria-hidden={index !== activeFeatureIndex}
              >
                <img src={feature.image} alt={feature.title || "Featured program"} />
              </article>
            ))}
            <div
              className="login-feature-overlay"
              style={{ "--feature-accent": activeFeature?.color || "#2563eb" }}
            >
              <span>Featured</span>
              <h2>{activeFeature?.title}</h2>
              <p>{activeFeature?.description}</p>
            </div>
            {features.length > 1 && (
              <div className="login-feature-dots" aria-hidden="true">
                {features.map((feature, index) => (
                  <span className={index === activeFeatureIndex ? "active" : ""} key={feature.id} />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="login-feature-fallback" />
        )}
      </section>
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">Student Login</h1>
        {error && <div className="login-error">{error}</div>}
        {otpNotice && !error && <div className="login-otp-notice">{otpNotice}</div>}

        {!schoolContext ? (
          <div className="school-lock-card">
            <p className="school-lock-title">Student Access Not Enabled</p>
            <p className="school-lock-subtitle">
              Admin can select a default school from <strong>/admin189201</strong> - Schools.
            </p>
          </div>
        ) : schoolContext.accessMode === "default-school" ? (
          <>
            <div className="school-context-row">
              <p className="school-context-text">
                Default School: <strong>{schoolContext.schoolName}</strong>
              </p>
            </div>
            <p className="default-school-note">
              Register once with name, default class, and phone. Choose a plan after registration.
            </p>
            <div className="default-auth-tabs">
              <button
                type="button"
                className={defaultAuthMode === "login" ? "active" : ""}
                onClick={() => {
                  setDefaultAuthMode("login");
                  resetOtp();
                  setError("");
                }}
              >
                Login
              </button>
              <button
                type="button"
                className={defaultAuthMode === "register" ? "active" : ""}
                onClick={() => {
                  setDefaultAuthMode("register");
                  resetOtp();
                  setError("");
                }}
              >
                Register
              </button>
            </div>
            {defaultAuthMode === "register" && (
              <>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Student name"
                  value={defaultName}
                  onChange={(e) => setDefaultName(e.target.value)}
                  required
                />
                <select
                  className="login-input"
                  value={defaultClassName}
                  onChange={(e) => setDefaultClassName(e.target.value)}
                  disabled={loadingDefaultClasses || availableDefaultClasses.length === 0}
                  required
                >
                  {loadingDefaultClasses ? (
                    <option>Loading classes...</option>
                  ) : availableDefaultClasses.length ? (
                    availableDefaultClasses.map((className) => (
                      <option key={className} value={className}>
                        Class {className}
                      </option>
                    ))
                  ) : (
                    <option value="">No classes available</option>
                  )}
                </select>
              </>
            )}
            <input
              type="tel"
              className="login-input"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                resetOtp();
              }}
              required
            />
            {otpSent && (
              <input
                type="text"
                className="login-input"
                placeholder="OTP"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
              />
            )}
            <button className="login-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? defaultAuthMode === "register"
                  ? otpSent
                    ? "Verifying..."
                    : "Sending OTP..."
                  : otpSent
                  ? "Verifying..."
                  : "Sending OTP..."
                : defaultAuthMode === "register"
                ? otpSent
                  ? "Verify & Continue"
                  : "Send OTP"
                : otpSent
                ? "Verify & Login"
                : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <div className="school-context-row">
              <p className="school-context-text">
                School: <strong>{schoolContext.schoolName}</strong>
              </p>
            </div>

            <select
              className="login-input"
              value={selectedClassName}
              onChange={(e) => setSelectedClassName(e.target.value)}
              disabled={loadingStudents || classOptions.length === 0}
              required
            >
              {loadingStudents ? (
                <option>Loading classes...</option>
              ) : classOptions.length === 0 ? (
                <option>No classes found</option>
              ) : (
                classOptions.map((cls) => (
                  <option key={cls} value={cls}>
                    Class {cls}
                  </option>
                ))
              )}
            </select>

            <select
              className="login-input"
              value={selectedRollNumber}
              onChange={(e) => setSelectedRollNumber(e.target.value)}
              disabled={loadingStudents || rollOptions.length === 0}
              required
            >
              {loadingStudents ? (
                <option>Loading rolls...</option>
              ) : rollOptions.length === 0 ? (
                <option>No roll numbers found</option>
              ) : (
                rollOptions.map((roll) => (
                  <option key={roll} value={roll}>
                    Roll {roll}
                  </option>
                ))
              )}
            </select>

            <input
              type="password"
              className="login-input"
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />

            <button className="login-button" type="submit" disabled={isSubmitting || rollOptions.length === 0}>
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </>
        )}
      </form>

      {/* Structured nested configuration target to protect from overlapping instances */}
      <div id="default-school-recaptcha">
        <div id="default-school-recaptcha-inner"></div>
      </div>
    </div>
  );
};

export default Login;