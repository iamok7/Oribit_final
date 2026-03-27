import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    RadialBarChart, RadialBar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import './ManagerDashboard.css';

const API = 'http://127.0.0.1:5000/api';

const PALETTE = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#bfdbfe'];

/* ── Animated counter hook ── */
const useCounter = (target, duration = 1400) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!target) { setCount(0); return; }
        const start = performance.now();
        const animate = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [target, duration]);
    return count;
};

/* ── Custom Liquid Glass Tooltip ── */
const GlassTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            {label && <div className="ct-label">{label}</div>}
            {payload.map((entry, i) => (
                <div key={i} className="ct-row" style={{ color: entry.color || '#2563eb' }}>
                    <span>{entry.name}:</span>
                    <strong>{entry.value}</strong>
                </div>
            ))}
        </div>
    );
};

/* ── Status Badge ── */
const StatusBadge = ({ status }) => {
    const cfg = {
        'Completed':  { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' },
        'In Progress':{ bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
        'To Do':      { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
    };
    const c = cfg[status] || cfg['To Do'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: c.bg, color: c.color, border: `1px solid ${c.border}`,
            padding: '4px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800,
            whiteSpace: 'nowrap',
        }}>
            {status}
        </span>
    );
};

/* ── KPI Card ── */
const KPICard = ({ title, value, icon, index }) => {
    const animated = useCounter(typeof value === 'number' ? value : 0, 1200 + index * 100);
    return (
        <div className="bento-card kpi-card" style={{ animationDelay: `${index * 0.08}s` }}>
            <div className="kpi-icon">{icon}</div>
            <div className="kpi-number">
                {typeof value === 'number' ? animated.toLocaleString() : value}
            </div>
            <div className="kpi-title">{title}</div>
        </div>
    );
};

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 18) return 'Afternoon';
    return 'Evening';
}

/* ══════════════════════════════════════════════
   MANAGER DASHBOARD CONTENT
══════════════════════════════════════════════ */
const ManagerDashboardContent = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        axios.get(`${API}/stats/manager-dashboard`)
            .then(r => { setData(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <div className="loading-spinner" />
                <p style={{ color: '#1e3a8a', fontSize: '1.2rem', fontWeight: 700 }}>Loading dashboard…</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626', fontWeight: 800, fontSize: '1.2rem' }}>
                Failed to load dashboard data. Is the backend running?
            </div>
        );
    }

    /* derived values */
    const taskDonutData = [
        { name: 'Completed',  value: data.task_completed,  color: '#10b981' },
        { name: 'In Progress',value: data.task_inprogress, color: '#f59e0b' },
        { name: 'To Do',      value: data.task_todo,       color: '#3b82f6' },
    ].filter(d => d.value > 0);

    const completionRate = data.total_tasks > 0
        ? Math.round(data.task_completed / data.total_tasks * 100) : 0;

    const maxCompleted = Math.max(...(data.performance.map(p => p.completed) || [0]), 1);
    const maxExpense = Math.max(...(data.expense_categories.map(e => e.amount) || [0]), 1);

    const radialRoles = data.roles.map((r, i) => ({
        name: r.role.charAt(0).toUpperCase() + r.role.slice(1),
        count: r.count,
        fill: PALETTE[i % PALETTE.length],
    }));

    return (
        <div className="manager-dash-root">
            {/* ── Ambient Orbs ── */}
            <div className="dash-orb dash-orb-1"></div>
            <div className="dash-orb dash-orb-2"></div>

            {/* ── HERO HEADER ── */}
            <div className="hero-header">
                <div className="hero-content">
                    <div>
                        <div className="hero-greeting">
                            Good {getGreeting()}, {user?.username || 'Manager'} 👋
                        </div>
                        <p className="hero-sub">
                            Here's your organization overview — real-time system data
                        </p>
                    </div>
                    <div className="hero-date-block">
                        <div className="hero-date">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="live-badge"><span className="live-dot" />LIVE DATA</div>
                    </div>
                </div>
            </div>

            {/* ── KPI TILES ── */}
            <div className="kpi-grid">
                <KPICard index={0} title="Total Employees" value={data.total_users}       icon="👥" />
                <KPICard index={1} title="Total Tasks"     value={data.total_tasks}       icon="📋" />
                <KPICard index={2} title="Completed"       value={data.task_completed}    icon="✅" />
                <KPICard index={3} title="In Progress"     value={data.task_inprogress}   icon="⚡" />
                <KPICard index={4} title="Departments"     value={data.total_departments} icon="🏢" />
                <KPICard index={5} title="Projects"        value={data.total_projects}    icon="📁" />
            </div>

            {/* ── CHARTS BENTO GRID ── */}
            <div className="charts-bento">

                {/* ── Employee Performance (Horizontal Stacked Bar) ── */}
                <div className="bento-card chart-emp" style={{ animationDelay: '0.1s' }}>
                    <div className="card-header">
                        <h3 className="card-title">👤 Employee Performance</h3>
                    </div>
                    {data.performance.length === 0 ? (
                        <div className="empty-state">No employee task data yet</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={Math.max(240, data.performance.length * 38)}>
                                <BarChart
                                    data={data.performance}
                                    layout="vertical"
                                    margin={{ left: 10, right: 40, top: 0, bottom: 0 }}
                                    barSize={20}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        dataKey="username" type="category"
                                        tick={{ fontSize: 13, fontWeight: 800, fill: '#020617' }}
                                        width={88} axisLine={false} tickLine={false}
                                    />
                                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(15,23,42,0.05)' }} />
                                    <Bar dataKey="completed"  name="Completed"   stackId="s" fill="#10b981" />
                                    <Bar dataKey="in_progress"name="In Progress" stackId="s" fill="#f59e0b" />
                                    <Bar dataKey="todo"       name="To Do"       stackId="s" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="chart-legend">
                                <span className="legend-dot" style={{background: '#10b981'}}/>Completed
                                <span className="legend-dot" style={{background: '#f59e0b'}}/>In Progress
                                <span className="legend-dot" style={{background: '#3b82f6'}}/>To Do
                            </div>
                        </>
                    )}
                </div>

                {/* ── Task Status Donut ── */}
                <div className="bento-card chart-donut" style={{ animationDelay: '0.15s' }}>
                    <div className="card-header">
                        <h3 className="card-title">📊 Task Status</h3>
                    </div>
                    {taskDonutData.length === 0 ? (
                        <div className="empty-state">No tasks yet</div>
                    ) : (
                        <>
                            <div className="donut-container">
                                <ResponsiveContainer width="100%" height={210}>
                                    <PieChart>
                                        <Pie
                                            data={taskDonutData}
                                            cx="50%" cy="50%"
                                            innerRadius={60} outerRadius={85}
                                            paddingAngle={4} dataKey="value"
                                            strokeWidth={0}
                                        >
                                            {taskDonutData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0px 4px 6px ${entry.color}50)` }} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<GlassTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="donut-center">
                                    <div className="donut-total">{data.total_tasks}</div>
                                    <div className="donut-label">Total</div>
                                </div>
                            </div>
                            <div className="donut-legend">
                                {taskDonutData.map((d, i) => (
                                    <div key={i} className="donut-legend-item">
                                        <span className="legend-dot" style={{ background: d.color }} />
                                        <span style={{ color: '#1e293b', flex: 1, fontWeight: 700 }}>{d.name}</span>
                                        <span style={{ fontWeight: 900, color: d.color, fontSize: '1.1rem' }}>{d.value}</span>
                                    </div>
                                ))}
                            </div>
                            {/* completion rate ring indicator */}
                            <div className="completion-rate-box">
                                <div className="cr-number">{completionRate}%</div>
                                <div>
                                    <div className="cr-title">Completion Rate</div>
                                    <div className="cr-sub">{data.task_completed} of {data.total_tasks} done</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Department Analysis (Stacked Bar) ── */}
                <div className="bento-card chart-dept" style={{ animationDelay: '0.2s' }}>
                    <div className="card-header">
                        <h3 className="card-title">🏢 Department Analysis</h3>
                    </div>
                    {data.departments.length === 0 ? (
                        <div className="empty-state">No departments found</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data.departments} margin={{ left: -20, right: 20, top: 5, bottom: 0 }} barSize={24}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(15,23,42,0.05)' }} />
                                    <Bar dataKey="completed"  name="Completed"   stackId="t" fill="#10b981" />
                                    <Bar dataKey="in_progress"name="In Progress" stackId="t" fill="#f59e0b" />
                                    <Bar dataKey="todo"       name="To Do"       stackId="t" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="dept-cards">
                                {data.departments.map((d, i) => (
                                    <div key={i} className="dept-mini">
                                        <div className="dept-mini-name">{d.name}</div>
                                        <div className="dept-mini-stats">
                                            <span>👥 {d.employees}</span>
                                            <span>📁 {d.projects}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Live Activity Feed ── */}
                <div className="bento-card chart-activity" style={{ animationDelay: '0.25s' }}>
                    <div className="card-header">
                        <h3 className="card-title">⚡ Live Activity</h3>
                    </div>
                    {data.activity.length === 0 ? (
                        <div className="empty-state">No recent activity</div>
                    ) : (
                        <div className="activity-list">
                            {data.activity.map((a, i) => (
                                <div key={i} className="activity-item" style={{ animationDelay: `${i * 0.06}s` }}>
                                    <div className="activity-avatar"
                                        style={{ background: `linear-gradient(135deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 2) % PALETTE.length]})` }}
                                    >
                                        {(a.username[0] || '?').toUpperCase()}
                                    </div>
                                    <div className="activity-info">
                                        <div className="activity-title" title={a.title}>{a.title}</div>
                                        <div className="activity-user">@{a.username}</div>
                                    </div>
                                    <StatusBadge status={a.status} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 7-Day Task Trend (Area Chart) ── */}
                <div className="bento-card chart-trend" style={{ animationDelay: '0.3s' }}>
                    <div className="card-header">
                        <h3 className="card-title">📈 7-Day Task Trend</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={data.trend} margin={{ left: -20, right: 20, top: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" vertical={false} />
                            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<GlassTooltip />} />
                            <Area type="monotone" dataKey="created" name="Created" stroke="#3b82f6" strokeWidth={3} fill="url(#gCreated)" dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }} />
                            <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={3} fill="url(#gCompleted)" dot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="chart-legend" style={{marginTop: '1rem'}}>
                        <span className="legend-dot" style={{background: '#3b82f6'}}/>Created
                        <span className="legend-dot" style={{background: '#10b981', marginLeft: 16}}/>Completed
                    </div>
                </div>

                {/* ── Role Distribution (Radial Bar) ── */}
                <div className="bento-card chart-roles" style={{ animationDelay: '0.35s' }}>
                    <div className="card-header">
                        <h3 className="card-title">👑 Role Distribution</h3>
                    </div>
                    {radialRoles.length === 0 ? (
                        <div className="empty-state">No users</div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="100%" data={radialRoles} startAngle={90} endAngle={-270} barSize={16}>
                                    <RadialBar dataKey="count" cornerRadius={8} />
                                    <Tooltip content={<GlassTooltip />} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="roles-legend">
                                {radialRoles.map((r, i) => (
                                    <div key={i} className="role-item">
                                        <span className="legend-dot" style={{ background: r.fill }} />
                                        <span className="role-name">{r.name}</span>
                                        <span className="role-count">{r.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Top Performers Leaderboard ── */}
                <div className="bento-card chart-leaderboard" style={{ animationDelay: '0.4s' }}>
                    <div className="card-header">
                        <h3 className="card-title">🏆 Top Performers</h3>
                    </div>
                    {data.performance.length === 0 ? (
                        <div className="empty-state">No data yet</div>
                    ) : (
                        <div className="leaderboard">
                            {data.performance.slice(0, 7).map((emp, i) => (
                                <div key={i} className="leaderboard-row" style={{ animationDelay: `${0.4 + i * 0.05}s` }}>
                                    <div className="rank-badge">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </div>
                                    <div className="lb-avatar" style={{ background: `linear-gradient(135deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 2) % PALETTE.length]})` }}>
                                        {emp.username[0].toUpperCase()}
                                    </div>
                                    <div className="lb-name">{emp.username}</div>
                                    <div className="lb-bar-wrap">
                                        <div className="lb-bar"
                                            style={{
                                                width: `${maxCompleted > 0 ? (emp.completed / maxCompleted) * 100 : 0}%`,
                                                background: PALETTE[i % PALETTE.length],
                                            }}
                                        />
                                    </div>
                                    <div className="lb-score">{emp.completed}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Expense Overview ── */}
                <div className="bento-card chart-expense" style={{ animationDelay: '0.45s' }}>
                    <div className="card-header">
                        <h3 className="card-title">💰 Expense Overview</h3>
                    </div>
                    <div className="expense-stats">
                        <div className="expense-hero">
                            <div className="expense-amount">
                                ₹{data.total_expense_paid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="expense-label">Total Paid</div>
                        </div>
                        <div className="expense-pending">
                            <div className="pending-number">{data.pending_expenses}</div>
                            <div className="pending-label">Pending Approvals</div>
                        </div>
                    </div>

                    {data.expense_categories.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                By Category
                            </div>
                            <div className="cat-bars">
                                {data.expense_categories.slice(0, 5).map((c, i) => (
                                    <div key={i} className="cat-bar-row">
                                        <div className="cat-bar-name" title={c.category}>{c.category}</div>
                                        <div className="cat-bar-track">
                                            <div className="cat-bar-fill"
                                                style={{ width: `${(c.amount / maxExpense) * 100}%`, background: PALETTE[i % PALETTE.length] }}
                                            />
                                        </div>
                                        <div className="cat-bar-val">
                                            ₹{c.amount >= 1000 ? `${(c.amount / 1000).toFixed(1)}k` : c.amount.toFixed(0)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>{/* end charts-bento */}
        </div>
    );
};

/* ══════════════════════════════════════════════
   SUPERVISOR & EMPLOYEE DASHBOARDS (simple)
══════════════════════════════════════════════ */
const DashboardContent = ({ role }) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return (
        <div className="manager-dash-root">
            <div className="hero-header">
                <div className="hero-content">
                    <div>
                        <div className="hero-greeting">Welcome back, {user?.username}!</div>
                        <p className="hero-sub">{role.charAt(0).toUpperCase() + role.slice(1)} Dashboard Overview</p>
                    </div>
                </div>
            </div>
            <div className="bento-card" style={{ marginTop: '1.5rem' }}>
                <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                    {[
                        { label: 'Go to Task Board', href: '/tasks', color: '#2563eb' },
                        { label: 'View Calendar',    href: '/calendar', color: '#10b981' },
                        { label: 'My Expenses',      href: '/expenses', color: '#f59e0b' },
                    ].map((item, i) => (
                        <a key={i} href={item.href}
                            style={{
                                display: 'block', padding: '1.5rem', background: '#f8fafc',
                                border: `2px solid #e2e8f0`, borderRadius: 16,
                                textDecoration: 'none', color: item.color,
                                fontWeight: 800, fontSize: '1.1rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = item.color; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                        >
                            {item.label} →
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ── Exports ── */
export const ManagerDashboard = () => (
    <Layout role="manager">
        <ManagerDashboardContent />
    </Layout>
);

export const SupervisorDashboard = () => (
    <Layout role="supervisor">
        <DashboardContent role="supervisor" />
    </Layout>
);

export const EmployeeDashboard = () => (
    <Layout role="employee">
        <DashboardContent role="employee" />
    </Layout>
);