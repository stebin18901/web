// =======================================
// 🔹 DUMMY DATA for DEN CRM School System
// =======================================

// 1️⃣ TEACHERS
export const teachers = [
  {
    id: "T001",
    name: "Anita Nair",
    subject: "Mathematics",
    phone: "+91 9876543210",
    email: "anita.nair@greensprings.edu",
    classes: ["6A", "7A"],
    experience: "8 years",
    rating: 4.8,
  },
  {
    id: "T002",
    name: "Ramesh Iyer",
    subject: "Science",
    phone: "+91 9812233445",
    email: "ramesh.iyer@greensprings.edu",
    classes: ["6A", "8B"],
    experience: "10 years",
    rating: 4.6,
  },
  {
    id: "T003",
    name: "Mary Joseph",
    subject: "English",
    phone: "+91 9988776655",
    email: "mary.joseph@greensprings.edu",
    classes: ["7A", "8B"],
    experience: "6 years",
    rating: 4.7,
  },
];

// 2️⃣ STUDENTS
export const students = [
  {
    id: "S001",
    name: "Aarav Menon",
    class: "6A",
    roll: 1,
    parent: "Rajesh Menon",
    contact: "+91 9876012345",
    attendance: 95,
    performance: 88,
    feesDue: false,
  },
  {
    id: "S002",
    name: "Diya Nair",
    class: "6A",
    roll: 2,
    parent: "Anil Nair",
    contact: "+91 9823456789",
    attendance: 97,
    performance: 92,
    feesDue: true,
  },
  {
    id: "S003",
    name: "Aditya Krishnan",
    class: "7A",
    roll: 1,
    parent: "Sujith Krishnan",
    contact: "+91 9812345670",
    attendance: 90,
    performance: 85,
    feesDue: false,
  },
  {
    id: "S004",
    name: "Meera Suresh",
    class: "8B",
    roll: 3,
    parent: "Suresh Kumar",
    contact: "+91 9898989898",
    attendance: 93,
    performance: 89,
    feesDue: true,
  },
];

// 3️⃣ CLASSES
export const classes = [
  {
    id: "C6A",
    className: "6A",
    teacher: "Anita Nair",
    strength: 28,
    schedule: {
      Monday: ["Maths", "Science", "English"],
      Tuesday: ["Science", "Maths", "Computer"],
      Wednesday: ["English", "Social", "Maths"],
      Thursday: ["Science", "English", "Arts"],
      Friday: ["Maths", "Social", "Sports"],
    },
  },
  {
    id: "C7A",
    className: "7A",
    teacher: "Mary Joseph",
    strength: 26,
    schedule: {
      Monday: ["English", "Maths", "Science"],
      Tuesday: ["Maths", "Computer", "Social"],
      Wednesday: ["Science", "English", "Sports"],
      Thursday: ["Maths", "Science", "Arts"],
      Friday: ["English", "Maths", "Social"],
    },
  },
];

// 4️⃣ FEES
export const fees = [
  {
    studentId: "S001",
    name: "Aarav Menon",
    class: "6A",
    total: 25000,
    paid: 25000,
    status: "Paid",
    dueDate: "2025-02-10",
  },
  {
    studentId: "S002",
    name: "Diya Nair",
    class: "6A",
    total: 25000,
    paid: 15000,
    status: "Pending",
    dueDate: "2025-02-10",
  },
  {
    studentId: "S004",
    name: "Meera Suresh",
    class: "8B",
    total: 28000,
    paid: 18000,
    status: "Pending",
    dueDate: "2025-02-10",
  },
];

// 5️⃣ LEADS (Admissions)
export const leads = [
  {
    id: "L001",
    name: "Rahul Pillai",
    gradeSeeking: "6th",
    parent: "Manoj Pillai",
    contact: "+91 9845012300",
    source: "Website",
    status: "Follow-up",
    note: "Interested after seeing science quiz results",
  },
  {
    id: "L002",
    name: "Anaya Joseph",
    gradeSeeking: "7th",
    parent: "Joseph Thomas",
    contact: "+91 9856078945",
    source: "Parent Referral",
    status: "Converted",
    note: "Enrolled after campus visit",
  },
  {
    id: "L003",
    name: "Kiran Mathew",
    gradeSeeking: "8th",
    parent: "Mathew Kurian",
    contact: "+91 9776678901",
    source: "Social Media",
    status: "New Lead",
    note: "Requested brochure via WhatsApp",
  },
];

// 6️⃣ COMMUNICATION
export const communications = [
  {
    id: "MSG001",
    from: "Principal",
    to: "All Parents",
    subject: "Annual Day Celebration",
    message:
      "We are excited to announce the Annual Day Celebration on Dec 20th. Students will perform class-wise events. Kindly encourage them to participate.",
    date: "2025-11-05",
    type: "Announcement",
  },
  {
    id: "MSG002",
    from: "Class Teacher 6A",
    to: "Parents of 6A",
    subject: "Math Quiz Results",
    message:
      "Math quiz results have been uploaded to the dashboard. Please check your child’s progress and encourage regular practice.",
    date: "2025-11-08",
    type: "Academic",
  },
  {
    id: "MSG003",
    from: "Admin",
    to: "Parents",
    subject: "Fee Payment Reminder",
    message:
      "Kindly clear pending term fees by Nov 15 to avoid late charges. Contact accounts if you’ve already paid.",
    date: "2025-11-10",
    type: "Finance",
  },
];

// 7️⃣ REPORTS (Analytics Dashboard Data)
export const reports = {
  overallAttendance: 94,
  averagePerformance: 86,
  feeCollectionRate: 91,
  upcomingEvents: ["Science Fair - Nov 20", "Sports Day - Dec 10"],
  topPerformers: [
    { name: "Diya Nair", class: "6A", score: 92 },
    { name: "Aarav Menon", class: "6A", score: 88 },
    { name: "Meera Suresh", class: "8B", score: 89 },
  ],
  parentSatisfaction: 4.7,
};

// 8️⃣ CALENDAR EVENTS
export const calendarEvents = [
  {
    id: "E001",
    title: "Monthly Parent Meeting",
    date: "2025-11-15",
    description: "Discussion on academic progress and upcoming exams.",
  },
  {
    id: "E002",
    title: "Science Fair",
    date: "2025-11-20",
    description: "Students showcase models and experiments.",
  },
  {
    id: "E003",
    title: "Christmas Celebration",
    date: "2025-12-22",
    description: "Fun events, music, and games for all grades.",
  },
];

// 9️⃣ SETTINGS
export const settings = {
  schoolName: "GreenSprings International School",
  address: "Kochi, Kerala",
  email: "info@greensprings.edu",
  phone: "+91 9845123456",
  theme: "Light",
  currentTerm: "Term 2 - 2025",
  roles: ["Admin", "Teacher", "Accountant", "Parent"],
};
