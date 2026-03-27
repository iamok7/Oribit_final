import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    RadialBarChart, RadialBar, Legend,
    AreaChart, Area // Added for the new trend chart
} from 'recharts';
import Layout from '../components/Layout';
import './Users.css';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const ROLE_COLORS = {
    manager:    '#7c3aed',
    supervisor: '#d97706',
    employee:   '#2563eb',
    finance:    '#059669',
};
const STATUS_COLORS = {
    'To Do':       '#3b82f6',
    'In Progress': '#f59e0b',
    'Completed':   '#10b981',
    'Backlog':     '#ef4444'
};

const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const statusIcon = (s) => {
    if (s === 'Completed')   return '✓';
    if (s === 'In Progress') return '⟳';
    return '○';
};

const statusVerb = (s) => {
    if (s === 'Completed')   return 'completed';
    if (s === 'In Progress') return 'started working on';
    return 'queued';
};

/* Mock data for the new trend chart - replace with API data when available */
const mockTrendData = [
    { name: 'Mon', tasks: 12 },
    { name: 'Tue', tasks: 19 },
    { name: 'Wed', tasks: 15 },
    { name: 'Thu', tasks: 22 },
    { name: 'Fri', tasks: 28 },
    { name: 'Sat', tasks: 14 },
    { name: 'Sun', tasks: 10 },
];

/* ─── Custom Tooltip ──────────────────────────────────────────────────────── */
const GlassTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="uchart-tooltip">
            {label && <div className="uchart-tooltip-label">{label}</div>}
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color || p.fill || '#1e3a8a', display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.2rem' }}>
                    <span>{p.name}:</span> <strong>{p.value}</strong>
                </div>
            ))}
        </div>
    );
};

/* ─── Mini inline avatar ──────────────────────────────────────────────────── */
const Avatar = ({ name, role }) => {
    const initials = name?.slice(0, 2).toUpperCase() || '?';
    const color = ROLE_COLORS[role] || '#64748b';
    return (
        <div className="emp-avatar" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `2px solid #fff`, color: color }}>
            {initials}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const Users = () => {
    const [users, setUsers]             = useState([]);
    const [departments, setDepartments] = useState([]);
    const [isFetching, setIsFetching]   = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activity, setActivity]       = useState([]);
    const [stats, setStats]             = useState(null);
    const [activeFilter, setActiveFilter] = useState('All');

    // Row expansion
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [userDetails, setUserDetails]       = useState({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Form
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole]         = useState('employee');
    const [status, setStatus]     = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);

    /* ── fetch ── */
    const fetchAll = async () => {
        setIsFetching(true);
        try {
            const [uRes, dRes, aRes, sRes] = await Promise.all([
                axios.get('/api/users'),
                axios.get('/api/departments'),
                axios.get('/api/activity?limit=18'),
                axios.get('/api/stats/employees'),
            ]);
            setUsers(uRes.data);
            setDepartments(dRes.data);
            setActivity(aRes.data);
            setStats(sRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    /* ── row expand ── */
    const handleRowClick = async (userId) => {
        if (expandedUserId === userId) { setExpandedUserId(null); return; }
        setExpandedUserId(userId);
        if (!userDetails[userId]) {
            setIsLoadingDetails(true);
            try {
                const res = await axios.get(`/api/users/${userId}`);
                setUserDetails(prev => ({ ...prev, [userId]: res.data }));
            } catch (e) { console.error(e); }
            finally { setIsLoadingDetails(false); }
        }
    };

    const handleDeactivate = async (userId) => {
        if (!window.confirm('Deactivate this member?')) return;
        try {
            await axios.delete(`/api/users/${userId}`);
            setExpandedUserId(null);
            fetchAll();
        } catch { alert('Failed to deactivate user.'); }
    };

    const handleAllocateDept = async (userId, deptId) => {
        try {
            await axios.put(`/api/users/${userId}/department`, { department_id: deptId || null });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, department_id: deptId || null } : u));
        } catch { alert('Failed to update department.'); }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });
        setIsLoading(true);
        try {
            const res = await axios.post('/auth/create_user', { username, password, role });
            setStatus({ type: 'success', message: res.data.message });
            setUsername(''); setPassword(''); setRole('employee');
            fetchAll();
            setTimeout(() => { setIsModalOpen(false); setStatus({ type: '', message: '' }); }, 1000);
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to create user.' });
        } finally { setIsLoading(false); }
    };

    const getDeptName = (deptId) => {
        const d = departments.find(d => d.id === deptId);
        return d ? d.name : 'Unassigned';
    };

    /* ── filtered users ── */
    const filteredUsers = activeFilter === 'All'
        ? users
        : users.filter(u => u.role === activeFilter.toLowerCase());

    const roleFilters = ['All', 'Manager', 'Supervisor', 'Employee', 'Finance'];

    /* ── stat tiles ── */
    const inProgressCount = stats?.task_status?.find(t => t.status === 'In Progress')?.count ?? 0;
    const completedCount  = stats?.task_status?.find(t => t.status === 'Completed')?.count ?? 0;
    const todoCount       = stats?.task_status?.find(t => t.status === 'To Do')?.count ?? 0;

    return (
        <Layout role="manager">
            <div className="users-page">
                {/* Orbs */}
                <div className="users-orb users-orb--1" />
                <div className="users-orb users-orb--2" />
                <div className="users-orb users-orb--3" />

                {/* Header */}
                <div className="users-header">
                    <div className="users-header-info">
                        <h1 className="users-title">Employee Directory</h1>
                        <p className="users-subtitle">Workforce overview, analytics &amp; team management</p>
                    </div>
                    <button className="users-btn-add" onClick={() => setIsModalOpen(true)}>
                        + Add Member
                    </button>
                </div>

                {/* ═══ BENTO GRID ═══ */}
                <div className="bento-grid">

                    {/* 1 — Total Employees */}
                    <div className="bento-card bento-card--count">
                        <div className="bento-inner">
                            <div className="bento-label">Total Employees</div>
                            <div className="bento-bignum">{stats?.total ?? '—'}</div>
                            <div className="bento-sublabel">Active members on platform</div>
                            <div className="bento-sparkrow">
                                {(stats?.role_distribution ?? []).map(r => (
                                    <div key={r.role} className="bento-spark-pill"
                                        style={{ color: ROLE_COLORS[r.role] }}>
                                        {r.count} {r.role}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2 — Task Stats row */}
                    <div className="bento-card bento-card--stat bento-card--todo">
                        <div className="bento-inner">
                            <div className="bento-stat-icon">○</div>
                            <div className="bento-stat-num">{todoCount}</div>
                            <div className="bento-label">To Do</div>
                        </div>
                    </div>

                    <div className="bento-card bento-card--stat bento-card--inprog">
                        <div className="bento-inner">
                            <div className="bento-stat-icon bento-spin">⟳</div>
                            <div className="bento-stat-num">{inProgressCount}</div>
                            <div className="bento-label">In Progress</div>
                        </div>
                    </div>

                    <div className="bento-card bento-card--stat bento-card--done">
                        <div className="bento-inner">
                            <div className="bento-stat-icon">✓</div>
                            <div className="bento-stat-num">{completedCount}</div>
                            <div className="bento-label">Completed</div>
                        </div>
                    </div>

                    {/* 3 — Activity Feed */}
                    <div className="bento-card bento-card--activity">
                        <div className="bento-inner bento-inner--scroll">
                            <div className="bento-section-title">
                                <span className="bento-pulse-dot" /> Live Activity Feed
                            </div>
                            <div className="activity-feed">
                                {activity.length === 0 && (
                                    <div className="activity-empty">No recent activity</div>
                                )}
                                {activity.map((item, i) => (
                                    <div key={i} className={`activity-item activity-item--${item.status.replace(' ', '').toLowerCase()}`}>
                                        <div className="activity-icon" style={{ color: STATUS_COLORS[item.status] || '#64748b' }}>
                                            {statusIcon(item.status)}
                                        </div>
                                        <div className="activity-body">
                                            <span className="activity-user">{item.username}</span>
                                            <span className="activity-verb"> {statusVerb(item.status)} </span>
                                            <span className="activity-task">"{item.task_title}"</span>
                                        </div>
                                        <div className="activity-time">{timeAgo(item.timestamp)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 4 — Trend Area Chart (NEW) */}
                    <div className="bento-card bento-card--chart bento-card--chart-trend">
                        <div className="bento-inner">
                            <div className="bento-section-title">Task Completion Trend (Last 7 Days)</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.4)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#1e40af', fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#1e40af', fontWeight: 600 }} />
                                    <Tooltip content={<GlassTooltip />} />
                                    <Area type="monotone" dataKey="tasks" name="Tasks Completed" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorTasks)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 5 — Role Distribution Donut */}
                    <div className="bento-card bento-card--chart bento-card--chart-role">
                        <div className="bento-inner">
                            <div className="bento-section-title">Role Distribution</div>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie
                                        data={stats?.role_distribution ?? []}
                                        dataKey="count" nameKey="role"
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4}
                                        stroke="none"
                                    >
                                        {(stats?.role_distribution ?? []).map((entry, i) => (
                                            <Cell key={i} fill={ROLE_COLORS[entry.role] || '#94a3b8'} style={{ filter: `drop-shadow(0px 4px 6px ${ROLE_COLORS[entry.role]}40)` }} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<GlassTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="chart-legend" style={{ justifyContent: 'center' }}>
                                {(stats?.role_distribution ?? []).map(r => (
                                    <div key={r.role} className="legend-item">
                                        <span className="legend-dot" style={{ background: ROLE_COLORS[r.role] }} />
                                        <span className="legend-label">{r.role}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 6 — Department Bar Chart */}
                    <div className="bento-card bento-card--chart bento-card--chart-wide">
                        <div className="bento-inner">
                            <div className="bento-section-title">Department Headcount</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={stats?.dept_distribution ?? []} barSize={32} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.4)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#1e40af', fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#1e40af', fontWeight: 600 }} />
                                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.4)' }} />
                                    <Bar dataKey="count" name="Employees" radius={[8, 8, 8, 8]}>
                                        {(stats?.dept_distribution ?? []).map((_, i) => (
                                            <Cell key={i} fill={`hsl(${210 + i * 20}, 80%, 60%)`} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 7 — Task Status Radial */}
                    <div className="bento-card bento-card--chart bento-card--chart-radial">
                        <div className="bento-inner">
                            <div className="bento-section-title">Platform Status</div>
                            <ResponsiveContainer width="100%" height={180}>
                                <RadialBarChart
                                    cx="50%" cy="50%" innerRadius={30} outerRadius={90} barSize={12}
                                    data={(stats?.task_status ?? []).map(t => ({
                                        name: t.status, value: t.count, fill: STATUS_COLORS[t.status] || '#94a3b8',
                                    }))}
                                >
                                    <RadialBar background={{ fill: 'rgba(255,255,255,0.4)' }} dataKey="value" cornerRadius={10} />
                                    <Tooltip content={<GlassTooltip />} />
                                    <Legend iconSize={12} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#1e3a8a' }} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
                {/* ═══ END BENTO GRID ═══ */}

                {/* Directory Header */}
                <div className="dir-header">
                    <div>
                        <h2 className="dir-title">Team Roster</h2>
                        <p className="dir-sub">Manage roles, departments, and monitor load</p>
                    </div>
                    <div className="dir-filters">
                        {roleFilters.map(f => (
                            <button key={f}
                                className={`dir-filter-btn ${activeFilter === f ? 'dir-filter-btn--active' : ''}`}
                                onClick={() => setActiveFilter(f)}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Employee Directory Table */}
                <div className="users-glass-card">
                    {isFetching ? (
                        <div className="users-loading">Loading directory...</div>
                    ) : (
                        <table className="users-table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Role</th>
                                    <th>Department</th>
                                    <th>Status</th>
                                    <th>Active Tasks</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <React.Fragment key={user.id}>
                                        <tr
                                            className={`users-table-row ${expandedUserId === user.id ? 'users-table-row--expanded' : ''}`}
                                            onClick={() => handleRowClick(user.id)}
                                        >
                                            <td>
                                                <div className="emp-cell">
                                                    <Avatar name={user.username} role={user.role} />
                                                    <div>
                                                        <div className="emp-name">{user.username}</div>
                                                        <div className="emp-id">UID #{user.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`users-role-badge users-role-badge--${user.role}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="users-cell-dept-name">
                                                {getDeptName(user.department_id)}
                                            </td>
                                            <td>
                                                <span className="emp-status-dot emp-status-dot--active" />
                                                <span className="emp-status-text">Active</span>
                                            </td>
                                            <td className="emp-task-count">
                                                {userDetails[user.id]
                                                    ? userDetails[user.id].allocated_tasks_count
                                                    : '—'}
                                            </td>
                                            <td>
                                                <span className={`users-chevron ${expandedUserId === user.id ? 'users-chevron--open' : ''}`}>▼</span>
                                            </td>
                                        </tr>

                                        {expandedUserId === user.id && (
                                            <tr>
                                                <td colSpan="6" className="users-expand-cell">
                                                    <div className="users-expand-panel">
                                                        {isLoadingDetails && !userDetails[user.id] ? (
                                                            <div className="users-details-loading">Fetching data...</div>
                                                        ) : userDetails[user.id] ? (
                                                            <>
                                                                <div className="users-stats-group">
                                                                    <div>
                                                                        <p className="users-stat-label">Allocated Projects</p>
                                                                        <h2 className="users-stat-value">{userDetails[user.id].allocated_projects_count}</h2>
                                                                    </div>
                                                                    <div>
                                                                        <p className="users-stat-label">Assigned Tasks</p>
                                                                        <h2 className="users-stat-value users-stat-value--secondary">{userDetails[user.id].allocated_tasks_count}</h2>
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                                    {(user.role === 'employee' || user.role === 'supervisor') && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                            <label className="users-stat-label">Assign Department</label>
                                                                            <select className="users-select"
                                                                                style={{ minWidth: '220px', padding: '0.75rem 1rem' }}
                                                                                value={user.department_id || ''}
                                                                                onChange={(e) => handleAllocateDept(user.id, e.target.value ? parseInt(e.target.value) : null)}
                                                                            >
                                                                                <option value="">-- Unassigned --</option>
                                                                                {departments.map(d => (
                                                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                    <button className="users-btn-deactivate"
                                                                        onClick={() => handleDeactivate(user.id)}>
                                                                        Deactivate User
                                                                    </button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="users-details-error">Failed to load details.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan="6" className="users-empty">No users found for this filter.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Create User Modal */}
                {isModalOpen && (
                    <div className="users-modal-overlay">
                        <div className="users-modal">
                            <div className="users-modal-header">
                                <h3 className="users-modal-title">New Member</h3>
                                <button className="users-modal-close" onClick={() => setIsModalOpen(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                            {status.message && (
                                <div className={`users-status ${status.type === 'success' ? 'users-status--success' : 'users-status--error'}`}>
                                    {status.message}
                                </div>
                            )}
                            <form onSubmit={handleCreateUser}>
                                <div className="users-form-group">
                                    <label className="users-label">Username</label>
                                    <input type="text" className="users-input" value={username}
                                        onChange={e => setUsername(e.target.value)} required placeholder="e.g. jdoe_dev" />
                                </div>
                                <div className="users-form-group">
                                    <label className="users-label">Temporary Password</label>
                                    <input type="password" className="users-input" value={password}
                                        onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                                </div>
                                <div className="users-form-group">
                                    <label className="users-label">Assign Role</label>
                                    <select className="users-select" value={role} onChange={e => setRole(e.target.value)}>
                                        <option value="employee">Employee</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="manager">Manager</option>
                                        <option value="finance">Finance</option>
                                    </select>
                                </div>
                                <button type="submit" className="users-btn-submit" disabled={isLoading}>
                                    {isLoading ? 'Provisioning...' : 'Create Account'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Users;