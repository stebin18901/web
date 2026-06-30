import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from "firebase/auth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase/firebaseConfig";
import { db } from "../firebase/firebaseConfig";
import {
  buildAvailableClasses,
  CREATE_PAYMENT_LINK_URL,
  DEFAULT_SCHOOL_SETTINGS_COLLECTION,
  DEFAULT_SCHOOL_SETTINGS_DOC,
  MAX_PARENT_ACCOUNTS_PER_PHONE,
  getDefaultSchoolPlan,
  getUniqueClasses,
  normalizePhone,
  normalizeClassName,
  normalizeSchoolId,
} from "../config/defaultSchool";
import { fetchDemoContent } from "../utils/demoContent";
import "./Login.css";

const PHONE_PLACEHOLDER = "Phone Number (10 digits, e.g. 9876543210)";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildDefaultSchoolSession = (id, enrollment, schoolContext) => {
  const selectedClasses = getUniqueClasses(
    enrollment.selectedClasses || [enrollment.className]
  );
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
    planMaxClasses:
      enrollment.planMaxClasses || selectedClasses.length || 1,
    razorpaySubscriptionId: enrollment.razorpaySubscriptionId || "",
    expiryDate: enrollment.expiryDate || "",
    startDate: enrollment.startDate || "",
    loggedInAt: new Date().toISOString(),
    deviceLabel: getDeviceLabel(),
  };
};

/**
 * Checks whether this enrollment has a valid, active paid subscription.
 *
 * Rules:
 *   1. enrollment.isPaid must be true
 *   2. enrollment.planId must be set
 *   3. If a razorpaySubscriptionId exists, verify the subscription doc in
 *      Firestore is still marked subscriptionActive: true  (avoids trusting
 *      a stale isPaid flag after a cancellation/expiry).
 *
 * Returns: "active" | "unpaid" | "expired"
 */
const isRazorpayPendingStatus = (status) =>
  ["created", "authenticated", "pending"].includes(
    String(status || "").toLowerCase()
  );

const isRazorpayExpiredStatus = (status) =>
  ["cancelled", "paused", "completed", "expired"].includes(
    String(status || "").toLowerCase()
  );

const checkSubscriptionStatus = async (enrollment, enrollmentId) => {
  if (!enrollment.planId) return "unpaid";

  const subId = enrollment.razorpaySubscriptionId;
  if (!subId) {
    return enrollment.isPaid ? "active" : "unpaid";
  }

  try {
    const subSnap = await getDoc(doc(db, "subscriptions", subId));
    if (!subSnap.exists()) {
      return enrollment.isPaid ? "active" : "pending";
    }

    const subData = subSnap.data();
    if (subData.subscriptionActive === true) {
      if (subData.expiryDate) {
        const expiry = new Date(subData.expiryDate);
        if (expiry < new Date()) return "expired";
      }
      return "active";
    }

    const status = String(subData.status || subData.razorpayStatus || "").toLowerCase();
    if (isRazorpayPendingStatus(status)) return "pending";
    if (isRazorpayExpiredStatus(status)) return "expired";

    if (subData.expiryDate) {
      const expiry = new Date(subData.expiryDate);
      if (expiry < new Date()) return "expired";
    }

    return enrollment.isPaid ? "active" : "pending";
  } catch {
    return enrollment.isPaid ? "active" : "pending";
  }
};

const isSchoolStudentPaid = (student) => {
  const paymentStatus = String(student?.paymentStatus || "").toLowerCase();
  const registrationStatus = String(student?.registrationStatus || "").toLowerCase();
  return (
    student?.isPaid === true ||
    paymentStatus === "paid" ||
    registrationStatus === "active"
  );
};

const resolvePaymentUrl = (paymentData) =>
  String(
    paymentData?.payment_url ||
      paymentData?.short_url ||
      paymentData?.url ||
      paymentData?.link ||
      paymentData?.paymentLink ||
      ""
  ).trim();

const sortLinkedAccounts = (accounts) =>
  [...accounts].sort((a, b) => {
    const classCompare = String(a.className || "").localeCompare(
      String(b.className || ""),
      undefined,
      { numeric: true }
    );
    if (classCompare !== 0) return classCompare;

    const rollCompare = String(a.rollNumber || "").localeCompare(
      String(b.rollNumber || ""),
      undefined,
      { numeric: true }
    );
    if (rollCompare !== 0) return rollCompare;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });

const buildDefaultEnrollmentId = (schoolId, phone, studentName, className) => {
  const slug = `${studentName}-${className}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "student";

  return `${schoolId}_${phone}_${slug}_${Date.now().toString(36)}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const [defaultPhoneVerified, setDefaultPhoneVerified] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [selectedLinkedAccountId, setSelectedLinkedAccountId] = useState("");
  const [demoTitle, setDemoTitle] = useState("Demo");
  const [hasDemoContent, setHasDemoContent] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const OTP_COOLDOWN_MS = 60000;

  // -------------------------------------------------------------------------
  // On mount: redirect if a valid paid session already exists in localStorage
  // -------------------------------------------------------------------------
  useEffect(() => {
    const checkExistingSession = async () => {
      const raw = localStorage.getItem("schoolStudentSession");
      if (!raw) return;

      try {
        const session = JSON.parse(raw);
        if (!session?.id) {
          localStorage.removeItem("schoolStudentSession");
          return;
        }

        // Non-default-school sessions (PIN-based) go straight to dashboard
        if (session.accessMode !== "default-school") {
          navigate("/dashboard", { replace: true });
          return;
        }

        // Default-school sessions must have a planId
        if (!session.planId) {
          // No plan — send to plan selection
          navigate(`/plan-selection?enrollmentId=${encodeURIComponent(session.id)}`, {
            replace: true,
          });
          return;
        }

        // Verify subscription is still active
        const enrollmentSnap = await getDoc(
          doc(db, "defaultSchoolEnrollments", session.id)
        );
        if (!enrollmentSnap.exists()) {
          localStorage.removeItem("schoolStudentSession");
          return;
        }

        const enrollment = enrollmentSnap.data();
        const status = await checkSubscriptionStatus(enrollment, session.id);

        if (status === "active") {
          navigate("/dashboard", { replace: true });
        } else if (status === "pending") {
          navigate(
            `/plan-selection?enrollmentId=${encodeURIComponent(session.id)}`,
            { replace: true }
          );
        } else {
          localStorage.removeItem("schoolStudentSession");
          setError(
            status === "expired"
              ? "Your subscription has expired. Please renew to continue."
              : "Please complete payment to access the dashboard."
          );
        }
      } catch {
        localStorage.removeItem("schoolStudentSession");
      }
    };

    if (location.pathname === "/login" || location.pathname === "/") {
      checkExistingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // -------------------------------------------------------------------------
  // reCAPTCHA cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => clearRecaptchaVerifier();
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
    setDefaultPhoneVerified(false);
    setLinkedAccounts([]);
    setSelectedLinkedAccountId("");
    setLastOtpRequestTime(0);
  };

  const resendOtp = async () => {
    const cleanPhone = normalizePhone(phone);
    if (cleanPhone.length !== 10) {
      setError("Invalid phone number format. Use 10 digits, for example 9876543210.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      setOtpCode("");
      setConfirmationResult(null);
      setOtpNotice("");
      setDefaultPhoneVerified(false);
      setLinkedAccounts([]);
      setSelectedLinkedAccountId("");
      setLastOtpRequestTime(0);
      await sendOtp(cleanPhone);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLinkedAccountsForPhone = async (cleanPhone) => {
    const phoneQuery = query(
      collection(db, "defaultSchoolEnrollments"),
      where("phone", "==", cleanPhone)
    );
    const snap = await getDocs(phoneQuery);
    const seen = new Set();

    return sortLinkedAccounts(
      snap.docs
        .map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
        .filter((entry) => {
          const schoolId = normalizeSchoolId(entry.schoolId);
          const accessMode = String(entry.accessMode || "default-school").toLowerCase();
          return (
            schoolId === schoolContext?.schoolId &&
            (accessMode === "default-school" || accessMode === "school-plan")
          );
        })
        .filter((entry) => {
          if (seen.has(entry.id)) return false;
          seen.add(entry.id);
          return true;
        })
    );
  };

  const continueWithLinkedAccount = async (enrollmentId, enrollmentData, context) => {
    const status = await checkSubscriptionStatus(enrollmentData, enrollmentId);

    if (status === "active") {
      localStorage.setItem(
        "schoolStudentSession",
        JSON.stringify(
          buildDefaultSchoolSession(enrollmentId, enrollmentData, context)
        )
      );
      navigate("/dashboard");
      return;
    }

    if (status === "pending") {
      navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
      return;
    }

    if (status === "expired") {
      setError("Your subscription has expired. Please renew your plan to continue.");
      navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
      return;
    }

    navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
  };

  // -------------------------------------------------------------------------
  // OTP send / verify
  // -------------------------------------------------------------------------
  const sendOtp = async (cleanPhone) => {
    try {
      const now = Date.now();
      const elapsed = now - lastOtpRequestTime;
      if (lastOtpRequestTime > 0 && elapsed < OTP_COOLDOWN_MS) {
        const secs = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        setError(`Please wait ${secs} seconds before requesting another OTP.`);
        return false;
      }

      clearRecaptchaVerifier();
      await signOut(auth).catch(() => {});

      const verifierContainer = document.getElementById(
        "default-school-recaptcha-inner"
      );
      if (!verifierContainer) {
        setError("reCAPTCHA container not found. Please refresh the page.");
        return false;
      }

      auth.languageCode = "en";
      window.defaultSchoolRecaptchaVerifier = new RecaptchaVerifier(
        auth,
        "default-school-recaptcha-inner",
        {
          size: "invisible",
          callback: () => {
            setError("");
          },
          "expired-callback": () => {
            setError("reCAPTCHA expired. Please try sending OTP again.");
            clearRecaptchaVerifier();
          },
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

      let msg = "Failed to send OTP. Please try again.";
      if (err.code === "auth/too-many-requests")
        msg = "Too many OTP requests. Please wait a few minutes before trying again.";
      else if (err.code === "auth/invalid-phone-number")
        msg = "Invalid phone number format. Use 10 digits, for example 9876543210.";
      else if (err.code === "auth/operation-not-allowed")
        msg = "Phone authentication is not enabled. Please contact support.";
      else if (err.message) msg = err.message;

      setError(msg);
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
    try {
      await confirmationResult.confirm(otpCode.trim());
      return true;
    } catch (err) {
      setError("Invalid OTP. Please try again.");
      return false;
    }
  };

  // -------------------------------------------------------------------------
  // Load school context
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadSchoolContext = async () => {
      const raw = localStorage.getItem("studentSchoolAccess");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.schoolId) {
            setSchoolContext({
              schoolId: normalizeSchoolId(parsed.schoolId),
              schoolDocId: parsed.schoolDocId || parsed.schoolId,
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
        const defaultRef = doc(
          db,
          DEFAULT_SCHOOL_SETTINGS_COLLECTION,
          DEFAULT_SCHOOL_SETTINGS_DOC
        );
        const defaultSnap = await getDoc(defaultRef);
        if (!defaultSnap.exists()) return;

        const defaultData = defaultSnap.data();
        const defaultSchoolId = normalizeSchoolId(defaultData.schoolId);
        if (!defaultSchoolId || defaultData.enabled === false) return;

        const schoolSnap = await getDoc(doc(db, "schools", defaultSchoolId));
        const schoolData = schoolSnap.exists() ? schoolSnap.data() : {};
        setSchoolContext({
          schoolId: defaultSchoolId,
          schoolName:
            schoolData.schoolName || defaultData.schoolName || defaultSchoolId,
          accessMode: "default-school",
        });
      } catch {
        setError("Unable to load default school.");
      }
    };

    loadSchoolContext();
  }, []);

  // -------------------------------------------------------------------------
  // Features carousel
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const snap = await getDocs(collection(db, "features"));
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((f) => f.image);
        setFeatures(data);
      } catch {
        setFeatures([]);
      }
    };
    fetchFeatures();
  }, []);

  useEffect(() => {
    const loadDemoContent = async () => {
      try {
        const data = await fetchDemoContent();
        setDemoTitle(data.title || "Demo");
        setHasDemoContent(Boolean(String(data.html || "").trim()));
      } catch {
        setHasDemoContent(false);
      }
    };

    loadDemoContent();
  }, []);

  useEffect(() => {
    if (features.length <= 1) return undefined;
    const timer = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [features.length]);

  // -------------------------------------------------------------------------
  // School-auth: load students
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchStudents = async () => {
      if (
        !schoolContext?.schoolId ||
        schoolContext.accessMode === "default-school"
      ) {
        setStudents([]);
        return;
      }
      setLoadingStudents(true);
      setError("");
      try {
        const q = query(
          collection(db, "studentAccounts"),
          where("schoolId", "==", schoolContext.schoolId)
        );
        const snap = await getDocs(q);
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setError("Unable to load students for this school.");
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [schoolContext]);

  // -------------------------------------------------------------------------
  // Default-school: available classes
  // -------------------------------------------------------------------------
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
        const rows = [
          ...chapterSnap.docs.map((d) => d.data()),
          ...quizSnap.docs.map((d) => d.data()),
        ];
        const classes = buildAvailableClasses(rows, [defaultClassName]);
        setAvailableDefaultClasses(classes);
        if (
          defaultClassName &&
          !classes.includes(defaultClassName)
        ) {
          setDefaultClassName("");
        }
      } catch {
        setAvailableDefaultClasses(defaultClassName ? [defaultClassName] : []);
      } finally {
        setLoadingDefaultClasses(false);
      }
    };
    fetchAvailableDefaultClasses();
  }, [defaultAuthMode, defaultClassName, schoolContext]);

  // -------------------------------------------------------------------------
  // Derived options for school-auth selects
  // -------------------------------------------------------------------------
  const classOptions = useMemo(() => {
    const set = new Set(
      students
        .map((s) => String(s.className || s.class || "").trim())
        .filter(Boolean)
    );
    return [...set].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [students]);

  useEffect(() => {
    if (!classOptions.length) {
      setSelectedClassName("");
      return;
    }
    if (selectedClassName && !classOptions.includes(selectedClassName)) {
      setSelectedClassName("");
    }
  }, [classOptions, selectedClassName]);

  const rollOptions = useMemo(() => {
    return students
      .filter(
        (s) =>
          String(s.className || s.class || "").trim() === selectedClassName
      )
      .map((s) => String(s.rollNumber || s.roll || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, selectedClassName]);

  useEffect(() => {
    if (!rollOptions.length) {
      setSelectedRollNumber("");
      return;
    }
    if (selectedRollNumber && !rollOptions.includes(selectedRollNumber)) {
      setSelectedRollNumber("");
    }
  }, [rollOptions, selectedRollNumber]);

  // -------------------------------------------------------------------------
  // Form submit
  // -------------------------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!schoolContext?.schoolId) {
        setError("No school is available for student access.");
        return;
      }

      // Default-school flow (OTP-based)
        if (schoolContext.accessMode === "default-school") {
          const cleanPhone = normalizePhone(phone);
          if (cleanPhone.length !== 10) {
          setError("Invalid phone number format. Use 10 digits, for example 9876543210.");
            return;
          }

        if (defaultAuthMode === "login") {
          if (!otpSent) {
            const existingAccounts = await getLinkedAccountsForPhone(cleanPhone);
            if (!existingAccounts.length) {
              setError(
                "No child accounts were found for this phone number. Please register first."
              );
              return;
            }

            setLinkedAccounts(existingAccounts);
            setOtpNotice(
              existingAccounts.length > 1
                ? `We found ${existingAccounts.length} child accounts on this phone number. Enter OTP to choose one.`
                : "OTP sent to this phone number."
            );
            const success = await sendOtp(cleanPhone);
            if (!success) {
              setIsSubmitting(false);
              return;
            }
            setIsSubmitting(false);
            return;
          }

          if (!defaultPhoneVerified) {
            const otpVerified = await verifyOtp();
            if (!otpVerified) return;

            setDefaultPhoneVerified(true);

            const existingAccounts = await getLinkedAccountsForPhone(cleanPhone);
            if (!existingAccounts.length) {
              setError(
                "No child accounts were found for this phone number. Please register first."
              );
              return;
            }

            setLinkedAccounts(existingAccounts);

            if (existingAccounts.length === 1) {
              const [singleAccount] = existingAccounts;
              setSelectedLinkedAccountId(singleAccount.id);
              await continueWithLinkedAccount(
                singleAccount.id,
                singleAccount,
                schoolContext
              );
              return;
            }

            const nextSelectedId =
              selectedLinkedAccountId &&
              existingAccounts.some((entry) => entry.id === selectedLinkedAccountId)
                ? selectedLinkedAccountId
                : existingAccounts[0].id;

            setSelectedLinkedAccountId(nextSelectedId);
            setOtpNotice(
              `Phone verified. Choose which child account to continue with. ${existingAccounts.length}/${MAX_PARENT_ACCOUNTS_PER_PHONE} account slots are in use.`
            );
            setIsSubmitting(false);
            return;
          }

          if (!selectedLinkedAccountId) {
            setError("Choose a child account to continue.");
            return;
          }

          const selectedEnrollment =
            linkedAccounts.find((entry) => entry.id === selectedLinkedAccountId) ||
            (await getLinkedAccountsForPhone(cleanPhone)).find(
              (entry) => entry.id === selectedLinkedAccountId
            );

          if (!selectedEnrollment) {
            setError("That child account could not be found. Please verify again.");
            resetOtp();
            return;
          }

          await continueWithLinkedAccount(
            selectedEnrollment.id,
            selectedEnrollment,
            schoolContext
          );
          return;
        }

        const cleanName = defaultName.trim();
        const cleanClassName = normalizeClassName(defaultClassName);
        if (!cleanName) {
          setError("Enter student name.");
          return;
        }
        if (!cleanClassName) {
          setError("Select a class.");
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

        if (!defaultPhoneVerified) {
          const otpVerified = await verifyOtp();
          if (!otpVerified) return;
          setDefaultPhoneVerified(true);
        }

        const existingAccounts = await getLinkedAccountsForPhone(cleanPhone);
        setLinkedAccounts(existingAccounts);

        const matchingAccount = existingAccounts.find(
          (entry) =>
            String(entry.name || "").trim().toLowerCase() === cleanName.toLowerCase() &&
            normalizeClassName(entry.className) === cleanClassName
        );

        if (
          !matchingAccount &&
          existingAccounts.length >= MAX_PARENT_ACCOUNTS_PER_PHONE
        ) {
          setError(
            `A single parent phone number can be linked to a maximum of ${MAX_PARENT_ACCOUNTS_PER_PHONE} child accounts.`
          );
          return;
        }

        const enrollmentId =
          matchingAccount?.id ||
          buildDefaultEnrollmentId(
            schoolContext.schoolId,
            cleanPhone,
            cleanName,
            cleanClassName
          );
        const enrollmentRef = doc(db, "defaultSchoolEnrollments", enrollmentId);
        const existingEnrollment = matchingAccount || null;

        const enrollmentPayload = {
          phone: cleanPhone,
          parentPhone: cleanPhone,
          parentAccountKey: `${schoolContext.schoolId}_${cleanPhone}`,
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
          navigate(
            `/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`
          );
          return;
        }

        const status = await checkSubscriptionStatus(existingEnrollment, enrollmentId);

        if (status === "active") {
          await setDoc(enrollmentRef, enrollmentPayload, { merge: true });
          localStorage.setItem(
            "schoolStudentSession",
            JSON.stringify(
              buildDefaultSchoolSession(
                enrollmentId,
                { ...existingEnrollment, ...enrollmentPayload },
                schoolContext
              )
            )
          );
          navigate("/dashboard");
          return;
        }

        await setDoc(enrollmentRef, enrollmentPayload, { merge: true });

        if (status === "pending") {
          setError(
            "You have a pending payment. Please complete checkout to activate your access."
          );
          navigate(
            `/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`
          );
          return;
        }

        if (status === "expired") {
          setError(
            "Your subscription has expired. Please renew your plan to continue."
          );
        }

        navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`);
        return;
      }

      // School-auth flow (PIN-based)
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

      const getOrCreateSchoolStudentPaymentUrl = async () => {
        let schoolSnap = schoolContext.schoolDocId
          ? await getDoc(doc(db, "schools", schoolContext.schoolDocId))
          : null;
        if (!schoolSnap || !schoolSnap.exists()) {
          schoolSnap = await getDoc(doc(db, "schools", schoolContext.schoolId));
        }
        const schoolData = schoolSnap.exists() ? schoolSnap.data() : {};
        const planId =
          student.selectedPlanId || student.planId || schoolData.selectedPlanId || "quarterly";
        const plan = getDefaultSchoolPlan(planId);
        const planAmount = Number(
          student.planAmount || schoolData.planAmount || plan.amount || 0
        );
        const schoolPlanId = schoolData.selectedPlanId || planId;
        const schoolPlan = getDefaultSchoolPlan(schoolPlanId);
        const schoolPlanAmount = Number(schoolData.planAmount || schoolPlan.amount || 0);
        const savedPlanMatches =
          student.paymentUrl &&
          (student.selectedPlanId || student.planId) === schoolPlanId &&
          Number(student.planAmount || 0) === schoolPlanAmount;

        if (savedPlanMatches) return student.paymentUrl;

        const paymentPlanId = schoolPlanId;
        const paymentPlanName = schoolData.selectedPlanName || schoolPlan.name;
        const paymentPlanAmount = schoolPlanAmount || planAmount;

        if (!paymentPlanAmount) {
          throw new Error(
            "Payment plan is not configured for this school. Please contact the school admin."
          );
        }

        const enrollmentId = student.id;
        const callbackUrl = `${window.location.origin}/payment-success?defaultStudentId=${encodeURIComponent(enrollmentId)}`;
        const response = await fetch(CREATE_PAYMENT_LINK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: enrollmentId,
            studentId: enrollmentId,
            studentAccountId: enrollmentId,
            name: student.fullName || student.name || `Roll ${selectedRollNumber}`,
            phone: student.phone || "",
            purpose: "defaultSchool",
            amount: paymentPlanAmount,
            schoolId: schoolContext.schoolId,
            schoolName: schoolContext.schoolName,
            className: selectedClassName,
            rollNumber: selectedRollNumber,
            planId: paymentPlanId,
            planName: paymentPlanName,
            callbackUrl,
          }),
        });

        const paymentData = await response.json();
        if (!response.ok) {
          throw new Error(paymentData.error || "Failed to create payment link.");
        }

        const paymentUrl = resolvePaymentUrl(paymentData);
        if (!paymentUrl) {
          throw new Error("Payment link was not returned. Please contact support.");
        }

        const paymentPayload = {
          selectedPlanId: paymentPlanId,
          selectedPlanName: paymentPlanName,
          planId: paymentPlanId,
          planName: paymentPlanName,
          planAmount: paymentPlanAmount,
          paymentStatus: "pending",
          registrationStatus: "pending_payment",
          paymentLinkId: paymentData.paymentLinkId || "",
          paymentUrl,
          updatedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, "studentAccounts", enrollmentId), paymentPayload, { merge: true });
        await setDoc(
          doc(db, "defaultSchoolEnrollments", enrollmentId),
          {
            phone: student.phone || "",
            parentPhone: student.phone || "",
            parentAccountKey: student.phone
              ? `${schoolContext.schoolId}_${normalizePhone(student.phone)}`
              : "",
            name: student.fullName || student.name || `Roll ${selectedRollNumber}`,
            schoolId: schoolContext.schoolId,
            schoolName: schoolContext.schoolName,
            className: selectedClassName,
            rollNumber: selectedRollNumber,
            accessMode: "school-plan",
            selectedClasses: [selectedClassName],
            isPaid: false,
            pin: studentPin,
            ...paymentPayload,
          },
          { merge: true }
        );

        return paymentUrl;
      };

      if (!isSchoolStudentPaid(student)) {
        const paymentUrl = await getOrCreateSchoolStudentPaymentUrl();
        setError("Payment is required before opening the dashboard. Redirecting to payment...");
        window.location.assign(paymentUrl);
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
        accessMode: "school-auth",
        isPaid: true,
        paymentStatus: student.paymentStatus || "paid",
        registrationStatus: student.registrationStatus || "active",
        planId: student.selectedPlanId || student.planId || "",
        planName: student.selectedPlanName || student.planName || "",
      };

      localStorage.setItem("schoolStudentSession", JSON.stringify(session));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to complete login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
                  <span
                    className={index === activeFeatureIndex ? "active" : ""}
                    key={feature.id}
                  />
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
        <p className="login-subtitle">
          Access quizzes, notes, and subscriptions for your school account.
        </p>
        <div className="login-public-actions">
          <Link to="/pricing" className="login-link-button primary">
            View Pricing Plans
          </Link>
          <Link to="/contact" className="login-link-button">
            Contact Support
          </Link>
        </div>
        {hasDemoContent && (
          <div className="login-demo-link-wrap">
            <Link to="/demo-view" className="login-demo-link">
              View {demoTitle}
            </Link>
          </div>
        )}
        <div className="login-trust-links">
          <Link to="/terms-and-conditions">Terms</Link>
          <Link to="/privacy-policy">Privacy</Link>
          <Link to="/refund-policy">Refund Policy</Link>
        </div>

        {error && <div className="login-error">{error}</div>}
        {otpNotice && !error && (
          <div className="login-otp-notice">{otpNotice}</div>
        )}

        {!schoolContext ? (
          <div className="school-lock-card">
            <p className="school-lock-title">Student Access Not Enabled</p>
            <p className="school-lock-subtitle">
              Admin can select a default school from{" "}
              <strong>/admin189201</strong> - Schools.
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
              One parent phone number can manage up to{" "}
              <strong>{MAX_PARENT_ACCOUNTS_PER_PHONE}</strong> child accounts.
              Register each child once, then choose a plan for that child.
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
                  disabled={
                    loadingDefaultClasses ||
                    availableDefaultClasses.length === 0
                  }
                  required
                >
                  {loadingDefaultClasses ? (
                    <option value="">Loading classes...</option>
                  ) : availableDefaultClasses.length ? (
                    <>
                      <option value="">Select your class</option>
                      {availableDefaultClasses.map((cn) => (
                        <option key={cn} value={cn}>
                          Class {cn}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="">No classes available</option>
                  )}
                </select>
              </>
            )}

            <input
              type="tel"
              className="login-input"
              placeholder={PHONE_PLACEHOLDER}
              value={phone}
              onChange={(e) => {
                setPhone(normalizePhone(e.target.value));
                resetOtp();
              }}
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              required
            />

            {otpSent && (
              <>
                <input
                  type="text"
                  className="login-input"
                  placeholder="Enter OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="forgot-password-button"
                  onClick={resendOtp}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending..." : "Resend OTP"}
                </button>
              </>
            )}

            {defaultAuthMode === "login" &&
              defaultPhoneVerified &&
              linkedAccounts.length > 1 && (
                <div className="linked-accounts-panel">
                  <p className="linked-accounts-title">Choose Child Account</p>
                  <div className="linked-accounts-list">
                    {linkedAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        className={`linked-account-card ${
                          selectedLinkedAccountId === account.id ? "active" : ""
                        }`}
                        onClick={() => {
                          setSelectedLinkedAccountId(account.id);
                          setError("");
                        }}
                      >
                        <strong>{account.name || "Student"}</strong>
                        <span>
                          Class {account.className || "-"}
                          {account.rollNumber ? ` • Roll ${account.rollNumber}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <button
              className="login-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? otpSent
                  ? "Verifying..."
                  : "Sending OTP..."
                : defaultAuthMode === "login" &&
                  defaultPhoneVerified &&
                  linkedAccounts.length > 1
                ? "Continue With Selected Child"
                : otpSent
                ? defaultAuthMode === "register"
                  ? "Verify & Continue"
                  : "Verify & Login"
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
                <option value="">Loading classes...</option>
              ) : classOptions.length === 0 ? (
                <option value="">No classes found</option>
              ) : (
                <>
                  <option value="">Select your class</option>
                  {classOptions.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </>
              )}
            </select>

            <select
              className="login-input"
              value={selectedRollNumber}
              onChange={(e) => setSelectedRollNumber(e.target.value)}
              disabled={loadingStudents || !selectedClassName || rollOptions.length === 0}
              required
            >
              {loadingStudents ? (
                <option value="">Loading roll numbers...</option>
              ) : !selectedClassName ? (
                <option value="">Select class first</option>
              ) : rollOptions.length === 0 ? (
                <option value="">No roll numbers found</option>
              ) : (
                <>
                  <option value="">Select roll number</option>
                  {rollOptions.map((roll) => (
                    <option key={roll} value={roll}>
                      Roll {roll}
                    </option>
                  ))}
                </>
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

            <button
              className="login-button"
              type="submit"
              disabled={
                isSubmitting ||
                !selectedClassName ||
                !selectedRollNumber ||
                rollOptions.length === 0
              }
            >
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </>
        )}
      </form>

      {/* Nested container to protect from overlapping reCAPTCHA instances */}
      <div id="default-school-recaptcha">
        <div id="default-school-recaptcha-inner"></div>
      </div>
    </div>
  );
};

export default Login;
