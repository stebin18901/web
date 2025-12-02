import React from "react";
import {
  reports,
  calendarEvents,
  fees,
  students,
} from "../data/dummyData";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Wallet,
  GraduationCap,
  CalendarDays,
  Bell,
  Trophy,
  TrendingUp,
  BarChart3,
} from "lucide-react";

export default function Dashboard() {
  const totalStudents = students.length;
  const paidFees = fees.filter((f) => f.status === "Paid").length;
  const pendingFees = fees.filter((f) => f.status === "Pending").length;

  const chartData = [
    { name: "Attendance", value: reports.overallAttendance },
    { name: "Performance", value: reports.averagePerformance },
    { name: "Fee Collection", value: reports.feeCollectionRate },
  ];

  return (
    <div className="crm-dashboard">
      <style>{dashboardStyles}</style>

      {/* --- TOP SUMMARY CARDS --- */}
      <div className="crm-grid crm-top">
        <Card
          title="Total Students"
          icon={<Users size={22} />}
          value={totalStudents}
          color="#6366F1"
          gradient="linear-gradient(135deg, #6366F1, #8B5CF6)"
          subtitle="Active & enrolled students"
        />
        <Card
          title="Fee Collection"
          icon={<Wallet size={22} />}
          value={`${reports.feeCollectionRate}%`}
          color="#10B981"
          gradient="linear-gradient(135deg, #10B981, #059669)"
          subtitle={`Paid: ${paidFees} | Pending: ${pendingFees}`}
        />
        <Card
          title="Academic Performance"
          icon={<GraduationCap size={22} />}
          value={`${reports.averagePerformance}%`}
          color="#8B5CF6"
          gradient="linear-gradient(135deg, #8B5CF6, #6366F1)"
          subtitle="Overall school average"
        />
        <Card
          title="Attendance Rate"
          icon={<BarChart3 size={22} />}
          value={`${reports.overallAttendance}%`}
          color="#3B82F6"
          gradient="linear-gradient(135deg, #3B82F6, #2563EB)"
          subtitle="Monthly average attendance"
        />
      </div>

      {/* --- CHART SECTION --- */}
      <div className="crm-panel chart">
        <h3>📊 Performance Overview</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366F1" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* --- EVENTS & ALERTS --- */}
      <div className="crm-grid">
        {/* Events */}
        <div className="crm-panel">
          <h3><CalendarDays size={18} /> Upcoming Events</h3>
          <div className="crm-list">
            {calendarEvents.map((e) => (
              <div key={e.id} className="crm-item event">
                <div className="event-date">
                  <strong>{e.date.split("-")[2]}</strong>
                  <span>{e.date.split("-")[1]}</span>
                </div>
                <div className="event-details">
                  <p className="title">{e.title}</p>
                  <p className="desc">{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="crm-panel">
          <h3><Bell size={18} /> Fee Alerts & Reminders</h3>
          {fees.filter((f) => f.status === "Pending").length > 0 ? (
            <div className="crm-list">
              {fees
                .filter((f) => f.status === "Pending")
                .map((f) => (
                  <div key={f.studentId} className="crm-item alert">
                    <div>
                      <p className="title">{f.name}</p>
                      <p className="desc">₹{f.total - f.paid} Due — {f.dueDate}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="empty">✅ All fees are updated.</p>
          )}
        </div>
      </div>

      {/* --- TOP PERFORMERS --- */}
      <div className="crm-panel performers">
        <h3><Trophy size={18} /> Top Performers</h3>
        <div className="performers-grid">
          {reports.topPerformers.map((s, i) => (
            <div key={i} className="performer">
              <div className="rank">{i + 1}</div>
              <h4>{s.name}</h4>
              <p>{s.class}</p>
              <span>{s.score}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* --- TEACHER INSIGHT SECTION --- */}
      <div className="crm-panel">
        <h3>👩‍🏫 Teacher Activity Highlights</h3>
        <p className="desc">
          Recent engagement insights help schools identify active teachers and improve productivity.
        </p>
        <ul className="teacher-list">
          <li><strong>Mrs. Meera</strong> - Conducted 12 classes this week</li>
          <li><strong>Mr. Rajesh</strong> - Highest student engagement (92%)</li>
          <li><strong>Mrs. Nisha</strong> - 100% syllabus coverage in Grade 7</li>
        </ul>
      </div>

      {/* Footer */}
      <footer>© {new Date().getFullYear()} DEN CRM — Empowering Smarter Schools 🚀</footer>
    </div>
  );
}

/* --- Sub Component --- */
const Card = ({ title, icon, value, color, gradient, subtitle }) => (
  <div className="crm-card" style={{ "--gradient": gradient }}>
    <div className="crm-card-icon">{icon}</div>
    <div className="crm-card-info">
      <h4>{title}</h4>
      <p style={{ color }}>{value}</p>
      <small>{subtitle}</small>
    </div>
  </div>
);

const dashboardStyles = `
.crm-dashboard {
  font-family: 'Inter', 'Poppins', sans-serif;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 10px 4px 40px;
}

/* GRID & LAYOUT */
.crm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 22px;
}
.crm-top {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

/* CARDS */
.crm-card {
  background: white;
  display: flex;
  align-items: center;
  gap: 16px;
  border-radius: 16px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05);
  padding: 20px 18px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.crm-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.16);
}
.crm-card-icon {
  background: var(--gradient);
  color: white;
  border-radius: 12px;
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.crm-card-info h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
}
.crm-card-info p {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 4px 0;
}
.crm-card-info small {
  color: #6b7280;
}

/* PANELS */
.crm-panel {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.04);
  padding: 24px 26px;
}
.crm-panel h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
  color: #0f172a;
  font-weight: 600;
  margin-bottom: 16px;
}
.crm-panel .desc {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 10px;
}

/* EVENTS */
.crm-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.crm-item {
  border-radius: 14px;
  background: #f9fafb;
  border: 1px solid rgba(0,0,0,0.03);
  padding: 12px 16px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  transition: transform 0.25s ease, background 0.25s ease;
}
.crm-item:hover {
  transform: translateX(4px);
  background: #f1f5f9;
}
.event-date {
  background: #6366F1;
  color: white;
  border-radius: 10px;
  text-align: center;
  width: 48px;
  padding: 4px 0;
}
.event-date strong {
  display: block;
  font-size: 1.1rem;
}
.event-date span {
  font-size: 0.7rem;
  text-transform: uppercase;
}
.event-details .title {
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}
.event-details .desc {
  font-size: 0.8rem;
  color: #64748b;
}

/* ALERTS */
.crm-item.alert {
  background: #fff1f2;
  border-left: 5px solid #ef4444;
}
.crm-item.alert .title {
  color: #b91c1c;
  font-weight: 600;
}
.crm-item.alert .desc {
  color: #4b5563;
  font-size: 0.85rem;
}
.empty {
  font-size: 0.9rem;
  color: #64748b;
}

/* TOP PERFORMERS */
.performers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.performer {
  background: linear-gradient(180deg, #f9fafb, #ffffff);
  border-radius: 14px;
  padding: 18px;
  text-align: center;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 4px 10px rgba(0,0,0,0.04);
  transition: transform 0.3s ease;
}
.performer:hover {
  transform: translateY(-3px);
}
.performer .rank {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 6px;
  font-weight: 600;
}
.performer span {
  display: block;
  font-weight: 700;
  color: #16a34a;
  font-size: 1rem;
}

/* TEACHER INSIGHT */
.teacher-list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
}
.teacher-list li {
  padding: 8px 0;
  font-size: 0.9rem;
  color: #374151;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.teacher-list li strong {
  color: #1d4ed8;
}

/* FOOTER */
footer {
  text-align: center;
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 40px;
}
`;

