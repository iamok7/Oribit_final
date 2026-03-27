import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import './DailyPlanner.css';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const todayMidnight = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};
const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* ─── Stat Card ────────────────────────────────────────────────────────────── */
const StatCard = ({ icon, label, value, sub, accent }) => (
    <div className="dp-card dp-card--stat" style={{ '--dp-accent': accent }}>
        <div className="dp-stat-icon">{icon}</div>
        <div className="dp-stat-value" style={{ color: accent }}>{value}</div>
        <div className="dp-stat-label">{label}</div>
        {sub && <div className="dp-stat-sub">{sub}</div>}
    </div>
);

/* ─── Custom Tooltip ───────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="dp-chart-tooltip">
            <div className="dp-ct-label">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="dp-ct-row" style={{ color: p.color || p.fill }}>
                    <span>{p.name}:</span><strong>{p.value}</strong>
                </div>
            ))}
        </div>
    );
};

/* ─── Main Component ───────────────────────────────────────────────────────── */
const DailyPlanner = () => {
    const user = JSON.parse(localStorage.getItem('user'));

    const [teamMembers, setTeamMembers] = useState([]);
    const [dailyTasks, setDailyTasks] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchTeamMembers();
        fetchDailyTasks();
    }, []);

    const fetchTeamMembers = async () => {
        try {
            let fetchedUsers = [];
            if (user.role === 'manager') {
                const res = await axios.get('/api/users');
                fetchedUsers = res.data;
            } else if (user.role === 'supervisor') {
                const res = await axios.get('/api/users?role=employee');
                fetchedUsers = res.data.filter(u => u.department_id === user.department_id);
            } else {
                const res = await axios.get(`/api/projects?user_id=${user.id}&role=${user.role}`);
                const myProjects = res.data.filter(p => p.lead_id === user.id);
                let projectMembers = [];
                for (let proj of myProjects) {
                    const mRes = await axios.get(`/api/projects/${proj.id}/members`);
                    projectMembers = [...projectMembers, ...mRes.data];
                }
                const uniqueIds = new Set();
                fetchedUsers = projectMembers.filter(u => {
                    if (uniqueIds.has(u.id)) return false;
                    uniqueIds.add(u.id);
                    return true;
                });
            }
            setTeamMembers(fetchedUsers.filter(u => u.id !== user.id));
        } catch (err) {
            console.error('Failed to fetch team members', err);
        }
    };

    const fetchDailyTasks = async () => {
        try {
            const res = await axios.get(`/api/tasks?user_id=${user.id}&role=${user.role}`);
            setDailyTasks(res.data.filter(t => t.is_daily_task));
        } catch (err) {
            console.error('Failed to fetch daily tasks', err);
        }
    };

    /* ── Derived data ── */
    const todayDate = todayMidnight();

    const completedToday = dailyTasks.filter(
        t => t.status === 'Completed' && t.deadline && isSameDay(new Date(t.deadline), todayDate)
    );
    const pastCompleted = dailyTasks
        .filter(t => t.status === 'Completed')
        .sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
    const upcomingTasks = dailyTasks
        .filter(t => t.status !== 'Completed')
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const totalDaily    = dailyTasks.length;
    const totalCompleted = pastCompleted.length;
    const completionRate = totalDaily > 0 ? Math.round((totalCompleted / totalDaily) * 100) : 0;

    /* ── 7-day trend ── */
    const trendData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - (6 - i));
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        const done  = dailyTasks.filter(t => t.status === 'Completed' && t.deadline && isSameDay(new Date(t.deadline), d)).length;
        const total = dailyTasks.filter(t => t.deadline && isSameDay(new Date(t.deadline), d)).length;
        return { day: label, Completed: done, Pending: Math.max(0, total - done) };
    });

    /* ── Pie data ── */
    const pieData = [
        { name: 'Completed',   value: dailyTasks.filter(t => t.status === 'Completed').length },
        { name: 'In Progress', value: dailyTasks.filter(t => t.status === 'In Progress').length },
        { name: 'To Do',       value: dailyTasks.filter(t => t.status === 'To Do').length },
    ];
    const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6'];

    /* ── Assign form submit ── */
    const handleAssignTask = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!selectedUser || !taskTitle || !taskTime) {
            setMessage('error:Please fill in all required fields.');
            return;
        }
        try {
            const now = new Date();
            const [hours, minutes] = taskTime.split(':');
            now.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
            const tzOffset = now.getTimezoneOffset() * 60000;
            const localISOTime     = new Date(now - tzOffset).toISOString().slice(0, 16);
            const deadline         = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const localDeadlineTime = new Date(deadline - tzOffset).toISOString().slice(0, 16);

            await axios.post('/api/tasks', {
                title: taskTitle,
                description: taskDescription,
                start_time: localISOTime,
                deadline: localDeadlineTime,
                is_daily_task: true,
                assigned_to: selectedUser,
                created_by: user.id,
            });

            setMessage('success');
            setTaskTitle(''); setTaskDescription(''); setTaskTime(''); setSelectedUser('');
            await fetchDailyTasks();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage('error:' + (err.response?.data?.message || 'Failed to assign task.'));
        }
    };

    const isSuccess = message === 'success';
    const isError   = message.startsWith('error:');
    const errorText = isError ? message.slice(6) : '';

    return (
        <Layout role={user.role}>
            <div className="dp-root">

                {/* ── Page Header ── */}
                <div className="dp-page-header">
                    <div>
                        <h1 className="dp-title">Daily Planner</h1>
                        <p className="dp-subtitle">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="dp-badge">
                        <span className="dp-dot" />
                        Live Dashboard
                    </div>
                </div>

                {/* ── Bento Grid ── */}
                <div className="dp-bento-grid">

                    {/* ── 1. ASSIGN FORM ── */}
                    <div className="dp-card dp-card--form">
                        <div className="dp-card-header" style={{ marginBottom: '2rem' }}>
                            <span className="dp-card-title" style={{ fontSize: '1.6rem' }}>🚀 Dispatch Task</span>
                        </div>

                        {isSuccess && (
                            <div className="dp-alert dp-alert--success">Task assigned successfully!</div>
                        )}
                        {isError && (
                            <div className="dp-alert dp-alert--error">{errorText}</div>
                        )}

                        <form className="dp-form" onSubmit={handleAssignTask}>
                            <div className="dp-field">
                                <label>Assign To</label>
                                <select className="dp-input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} required>
                                    <option value="" disabled>Select Team Member</option>
                                    {teamMembers.map(m => (
                                        <option key={m.id} value={m.id}>{m.username} ({m.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="dp-field">
                                <label>Task Title</label>
                                <input className="dp-input" type="text" placeholder="E.g. Finalize Q3 Report"
                                    value={taskTitle} onChange={e => setTaskTitle(e.target.value)} required />
                            </div>

                            <div className="dp-field">
                                <label>Description <span className="dp-opt">(optional)</span></label>
                                <textarea className="dp-input" rows="1" placeholder="Any specific details..."
                                    value={taskDescription} onChange={e => setTaskDescription(e.target.value)} />
                            </div>

                            <div className="dp-field">
                                <label>Start Time</label>
                                <input className="dp-input" type="time" value={taskTime}
                                    onChange={e => setTaskTime(e.target.value)} required />
                            </div>

                            <button type="submit" className="dp-submit-btn">Dispatch Daily Task</button>
                        </form>
                    </div>

                    {/* ── 2. Stat Cards ── */}
                    <StatCard icon="📋" label="Total Daily Tasks"  value={totalDaily}           accent="#1e3a8a" />
                    <StatCard icon="✅" label="Completed Today"     value={completedToday.length} accent="#065f46" />
                    <StatCard icon="⏳" label="Pending"             value={upcomingTasks.length}  accent="#b45309" />
                    <StatCard icon="📈" label="Completion Rate"
                        value={`${completionRate}%`}
                        sub={`${totalCompleted} of ${totalDaily} tasks done`}
                        accent="#1e3a8a" />

                    {/* ── 3. Trend Area Chart ── */}
                    <div className="dp-card dp-card--chart-wide">
                        <div className="dp-card-header">
                            <span className="dp-card-title">7-Day Completion Trend</span>
                            <span className="dp-card-tag">Daily Tasks</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="dpGradCompleted" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="dpGradPending" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={4} fill="url(#dpGradCompleted)" dot={{ fill: '#10b981', r: 5, strokeWidth: 0 }} />
                                <Area type="monotone" dataKey="Pending"   stroke="#3b82f6" strokeWidth={4} fill="url(#dpGradPending)"   dot={{ fill: '#3b82f6', r: 5, strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="dp-chart-legend">
                            <span className="dp-legend-dot" style={{ background: '#10b981' }} />Completed
                            <span className="dp-legend-dot" style={{ background: '#3b82f6', marginLeft: 16 }} />Pending
                        </div>
                    </div>

                    {/* ── 4. Pie Chart ── */}
                    <div className="dp-card dp-card--chart-pie">
                        <div className="dp-card-header">
                            <span className="dp-card-title">Status Breakdown</span>
                        </div>
                        <ResponsiveContainer width="100%" height={170}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}
                                            style={{ filter: `drop-shadow(0px 4px 6px ${PIE_COLORS[i % PIE_COLORS.length]}50)` }} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="dp-pie-legend">
                            {pieData.map((d, i) => (
                                <div key={i} className="dp-pie-legend-row">
                                    <span className="dp-legend-dot" style={{ background: PIE_COLORS[i] }} />
                                    <span className="dp-pie-legend-name">{d.name}</span>
                                    <span className="dp-pie-legend-val">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── 5. Bar Chart ── */}
                    <div className="dp-card dp-card--chart-bar">
                        <div className="dp-card-header">
                            <span className="dp-card-title">Daily Volume</span>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={18}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 13, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,23,42,0.05)' }} />
                                <Bar dataKey="Completed" fill="#10b981" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Pending"   fill="#3b82f6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── 6. Upcoming Tasks ── */}
                    <div className="dp-card dp-card--upcoming">
                        <div className="dp-card-header">
                            <span className="dp-card-title">⏳ Upcoming Tasks</span>
                            <span className="dp-card-badge dp-card-badge--blue">{upcomingTasks.length}</span>
                        </div>
                        <div className="dp-task-scroll">
                            {upcomingTasks.length === 0 ? (
                                <div className="dp-empty-state">No pending daily tasks</div>
                            ) : upcomingTasks.map(t => (
                                <div key={t.id} className="dp-task-row">
                                    <div className="dp-task-dot" style={{ background: t.status === 'In Progress' ? '#f59e0b' : '#3b82f6' }} />
                                    <div className="dp-task-info">
                                        <div className="dp-task-name">{t.title}</div>
                                        <div className="dp-task-meta">
                                            {t.assigned_to?.username && <span>👤 {t.assigned_to.username}</span>}
                                            <span>🕐 {fmtTime(t.start_time)}</span>
                                        </div>
                                    </div>
                                    <span className={`dp-status-pill ${t.status === 'In Progress' ? 'dp-status-pill--inprogress' : 'dp-status-pill--todo'}`}>
                                        {t.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── 7. Past Completed ── */}
                    <div className="dp-card dp-card--completed">
                        <div className="dp-card-header">
                            <span className="dp-card-title">✅ Completed Tasks</span>
                            <span className="dp-card-badge dp-card-badge--green">{pastCompleted.length}</span>
                        </div>
                        <div className="dp-task-scroll">
                            {pastCompleted.length === 0 ? (
                                <div className="dp-empty-state">No completed daily tasks yet</div>
                            ) : pastCompleted.map(t => (
                                <div key={t.id} className="dp-task-row">
                                    <div className="dp-task-dot" style={{ background: '#10b981' }} />
                                    <div className="dp-task-info">
                                        <div className="dp-task-name dp-task-name--done">{t.title}</div>
                                        <div className="dp-task-meta">
                                            {t.assigned_to?.username && <span>👤 {t.assigned_to.username}</span>}
                                            <span>📅 {fmtDate(t.deadline)}</span>
                                        </div>
                                    </div>
                                    <span className="dp-status-pill dp-status-pill--complete">Done</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </Layout>
    );
};

export default DailyPlanner;
