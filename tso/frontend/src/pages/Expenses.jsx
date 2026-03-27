import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import './Expenses.css';

const BLUE_PALETTE = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#bfdbfe'];

const GlassTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            {label && <div className="ct-label">{label}</div>}
            {payload.map((p, i) => (
                <div key={i} className="ct-row" style={{ color: p.color || '#2563eb' }}>
                    <span>{p.name}:</span>
                    <strong>{typeof p.value === 'number' && p.name?.toLowerCase().includes('amount') ? `$${p.value.toFixed(2)}` : p.value}</strong>
                </div>
            ))}
        </div>
    );
};

const Expenses = () => {
    const user = JSON.parse(localStorage.getItem('user'));

    const [expenses, setExpenses] = useState([]);
    const [allMyExpenses, setAllMyExpenses] = useState([]);
    const [activeTab, setActiveTab] = useState('my_expenses');

    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Travel');
    const [description, setDescription] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchExpenses();
    }, [activeTab]);

    const fetchExpenses = async () => {
        try {
            const res = await axios.get(`/api/expenses?user_id=${user.id}&role=${user.role}`);
            const data = res.data;

            // Always keep all my expenses for chart data
            setAllMyExpenses(data.filter(e => e.creator === user.username));

            if (activeTab === 'my_expenses') {
                setExpenses(data.filter(e => e.creator === user.username));
            } else if (activeTab === 'approvals') {
                setExpenses(data.filter(e =>
                    e.creator !== user.username &&
                    !e.is_rejected &&
                    e.status !== 'Approved' &&
                    (user.role === 'manager' ? e.approval_level === 1 : e.approval_level === 0)
                ));
            } else if (activeTab === 'approved') {
                setExpenses(data.filter(e =>
                    e.creator !== user.username &&
                    !e.is_rejected &&
                    (user.role === 'manager' ? e.status === 'Approved' : e.approval_level >= 1)
                ));
            } else if (activeTab === 'rejected') {
                setExpenses(data.filter(e =>
                    e.creator !== user.username && e.is_rejected
                ));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRaiseExpense = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            await axios.post('/api/expenses', {
                title, amount, category, description, created_by_id: user.id
            });
            setMessage('success');
            setTitle(''); setAmount(''); setDescription('');
            fetchExpenses();
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Failed to raise expense.');
        }
    };

    const handleApprove = async (id) => {
        try {
            await axios.put(`/api/expenses/${id}/approve`, { user_id: user.id });
            fetchExpenses();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (id) => {
        const reason = prompt("Reason for rejection:");
        if (reason === null) return;
        try {
            await axios.put(`/api/expenses/${id}/reject`, { user_id: user.id, reason });
            fetchExpenses();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reject');
        }
    };

    const getStatusStyle = (expense) => {
        if (expense.is_rejected) return 'status-rejected';
        if (expense.status === 'Approved') return 'status-approved';
        if (expense.approval_level === 1) return 'status-pending-l2';
        return 'status-pending-l1';
    };

    // --- Chart Data ---
    const chartData = useMemo(() => {
        const src = activeTab === 'my_expenses' ? allMyExpenses : expenses;

        // Category breakdown (pie)
        const catMap = {};
        src.forEach(e => {
            catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount);
        });
        const categoryData = Object.entries(catMap).map(([name, value]) => ({ name, value: +value.toFixed(2) }));

        // Status distribution (radial)
        const approved = src.filter(e => e.status === 'Approved').length;
        const rejected = src.filter(e => e.is_rejected).length;
        const pending = src.length - approved - rejected;
        const statusData = [
            { name: 'Approved', value: approved, fill: '#10b981' },
            { name: 'Pending', value: pending, fill: '#3b82f6' },
            { name: 'Rejected', value: rejected, fill: '#ef4444' },
        ].filter(d => d.value > 0);

        // Monthly trend (bar + area)
        const monthMap = {};
        src.forEach(e => {
            const d = new Date(e.created_at);
            const key = `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
            if (!monthMap[key]) monthMap[key] = { month: key, total: 0, count: 0 };
            monthMap[key].total += Number(e.amount);
            monthMap[key].count += 1;
        });
        const monthlyData = Object.values(monthMap).slice(-6);

        // Top categories bar
        const topCategories = [...categoryData].sort((a, b) => b.value - a.value).slice(0, 5);

        return { categoryData, statusData, monthlyData, topCategories, total: src.reduce((s, e) => s + Number(e.amount), 0) };
    }, [allMyExpenses, expenses, activeTab]);

    const hasData = chartData.categoryData.length > 0;

    return (
        <Layout role={user.role}>
            <div className="expenses-root">
                
                {/* ── Ambient Orbs ── */}
                <div className="expenses-orb expenses-orb-1"></div>
                <div className="expenses-orb expenses-orb-2"></div>

                <div className="expenses-header">
                    <div>
                        <h1 className="ex-title">Expense Management</h1>
                        <p className="ex-subtitle">Track, raise, and approve organizational spending</p>
                    </div>
                    <div className="tabs">
                        <button className={`tab-btn ${activeTab === 'my_expenses' ? 'active' : ''}`} onClick={() => setActiveTab('my_expenses')}>My Expenses</button>
                        {(user.role === 'supervisor' || user.role === 'manager' || user.role === 'finance') && (
                            <>
                                <button className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>Pending Approvals</button>
                                <button className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`} onClick={() => setActiveTab('approved')}>Approved</button>
                                <button className={`tab-btn ${activeTab === 'rejected' ? 'active' : ''}`} onClick={() => setActiveTab('rejected')}>Rejected</button>
                            </>
                        )}
                    </div>
                </div>

                {/* Analytics Section */}
                {hasData && (
                    <div className="analytics-section">
                        {/* KPI Strip */}
                        <div className="kpi-strip">
                            <div className="bento-card kpi-card">
                                <div className="kpi-label">Total Spent</div>
                                <div className="kpi-value">${chartData.total.toFixed(2)}</div>
                            </div>
                            <div className="bento-card kpi-card">
                                <div className="kpi-label">Transactions</div>
                                <div className="kpi-value">{(activeTab === 'my_expenses' ? allMyExpenses : expenses).length}</div>
                            </div>
                            <div className="bento-card kpi-card">
                                <div className="kpi-label">Categories</div>
                                <div className="kpi-value">{chartData.categoryData.length}</div>
                            </div>
                            <div className="bento-card kpi-card">
                                <div className="kpi-label">Avg per Expense</div>
                                <div className="kpi-value">
                                    ${((activeTab === 'my_expenses' ? allMyExpenses : expenses).length
                                        ? chartData.total / (activeTab === 'my_expenses' ? allMyExpenses : expenses).length
                                        : 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="charts-grid">
                            {/* Monthly Trend Area */}
                            <div className="bento-card chart-card chart-card--wide">
                                <div className="chart-title">Monthly Spend Trend</div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={chartData.monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} allowDecimals={false} />
                                        <Tooltip content={<GlassTooltip />} cursor={{ stroke: 'rgba(15,23,42,0.1)', strokeWidth: 2 }} />
                                        <Area type="monotone" dataKey="total" name="Amount" stroke="#2563eb" strokeWidth={3} fill="url(#blueGrad)" dot={{ fill: '#2563eb', strokeWidth: 0, r: 5 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Category Pie */}
                            <div className="bento-card chart-card">
                                <div className="chart-title">Spend by Category</div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={chartData.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                                            {chartData.categoryData.map((_, i) => (
                                                <Cell key={i} fill={BLUE_PALETTE[i % BLUE_PALETTE.length]} style={{ filter: `drop-shadow(0px 4px 6px ${BLUE_PALETTE[i % BLUE_PALETTE.length]}50)` }}/>
                                            ))}
                                        </Pie>
                                        <Tooltip content={<GlassTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top Categories Bar */}
                            <div className="bento-card chart-card chart-card--wide">
                                <div className="chart-title">Top Categories by Amount</div>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={chartData.topCategories} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barSize={20}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.1)" horizontal={false} />
                                        <XAxis type="number" tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                                        <YAxis type="category" dataKey="name" tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={120} />
                                        <Tooltip content={<GlassTooltip />} cursor={{ fill: 'rgba(15,23,42,0.05)' }} />
                                        <Bar dataKey="value" name="Amount" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Status Radial */}
                            {chartData.statusData.length > 0 && (
                                <div className="bento-card chart-card">
                                    <div className="chart-title">Status Breakdown</div>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90} data={chartData.statusData} startAngle={90} endAngle={-270} barSize={14}>
                                            <RadialBar dataKey="value" cornerRadius={8} />
                                            <Tooltip content={<GlassTooltip />} />
                                            <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }} />
                                        </RadialBarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Content */}
                {activeTab === 'my_expenses' && (
                    <div className="expenses-layout">
                        <div className="bento-card raise-expense-card">
                            <h3>🚀 Raise New Expense</h3>
                            {message === 'success' && (
                                <div className="ex-alert success">Expense raised successfully! ✅</div>
                            )}
                            {message && message !== 'success' && (
                                <div className="ex-alert error">{message}</div>
                            )}
                            <form className="ex-form" onSubmit={handleRaiseExpense}>
                                <div className="ex-field">
                                    <label>Title</label>
                                    <input type="text" className="ex-input" placeholder="E.g. Client Dinner" value={title} onChange={e => setTitle(e.target.value)} required />
                                </div>
                                <div className="ex-field">
                                    <label>Amount ($)</label>
                                    <input type="number" className="ex-input" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                                </div>
                                <div className="ex-field">
                                    <label>Category</label>
                                    <select className="ex-input" value={category} onChange={e => setCategory(e.target.value)}>
                                        <option value="Travel">Travel</option>
                                        <option value="Office Supplies">Office Supplies</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="ex-field" style={{ gridColumn: 'span 2' }}>
                                    <label>Description <span className="opt">(optional)</span></label>
                                    <textarea className="ex-input" rows="2" placeholder="Provide details..." value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <button type="submit" className="ex-submit-btn">Submit Expense</button>
                                </div>
                            </form>
                        </div>

                        <div className="bento-card expense-history-card">
                            <h3>My History</h3>
                            <div className="expense-list">
                                {expenses.length === 0 ? <div className="empty-state">No expenses found.</div> : expenses.map(e => (
                                    <div key={e.id} className="expense-row">
                                        <div className="ex-info">
                                            <div className="ex-name">{e.title}</div>
                                            <div className="ex-meta">
                                                <span className="ex-category-pill">{e.category}</span>
                                                <span>📅 {new Date(e.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="ex-meta-right">
                                            <div className="ex-amount">${e.amount.toFixed(2)}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                                <span className={`ex-status-pill ${getStatusStyle(e)}`}>
                                                    {e.is_rejected ? 'Rejected' : e.status === 'Approved' ? 'Fully Approved' : e.approval_level === 1 ? 'L1 Approved' : 'Pending L1'}
                                                </span>
                                                <span className={`ex-payment-pill ${e.payment_status === 'Paid' ? 'paid' : e.payment_status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                                    Payment: {e.payment_status === 'Unpaid' ? 'Pending' : e.payment_status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {['approvals', 'approved', 'rejected'].includes(activeTab) && (
                    <div className="bento-card approvals-card">
                        <h3>
                            {activeTab === 'approvals' && 'Pending Team Expenses'}
                            {activeTab === 'approved' && 'Approved Team Expenses'}
                            {activeTab === 'rejected' && 'Rejected Team Expenses'}
                        </h3>
                        <div className="expense-list">
                            {expenses.length === 0 ? <div className="empty-state">No expenses found.</div> : expenses.map(e => (
                                <div key={e.id} className="expense-row approval-row">
                                    <div className="ex-details-flex">
                                        <div className="ex-requestor">
                                            <div className="ex-avatar">{e.creator.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <div className="ex-creator-name">{e.creator}</div>
                                                <div className="ex-creator-dept">{e.department}</div>
                                            </div>
                                        </div>
                                        <div className="ex-info">
                                            <div className="ex-name">{e.title}</div>
                                            <div className="ex-meta">
                                                <span className="ex-category-pill">{e.category}</span>
                                            </div>
                                            <div className="ex-desc">{e.description}</div>
                                        </div>
                                    </div>
                                    <div className="ex-actions-col">
                                        <div className="ex-amount">${e.amount.toFixed(2)}</div>
                                        {activeTab === 'approvals' ? (
                                            <div className="ex-action-buttons">
                                                <button className="btn-approve" onClick={() => handleApprove(e.id)}>
                                                    {user.role === 'manager' ? 'Approve (L2)' : 'Approve (L1)'}
                                                </button>
                                                <button className="btn-reject" onClick={() => handleReject(e.id)}>Reject</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                                <span className={`ex-status-pill ${getStatusStyle(e)}`}>
                                                    {e.is_rejected ? 'Rejected' : e.status === 'Approved' ? 'Fully Approved' : e.approval_level === 1 ? 'L1 Approved' : 'Pending L1'}
                                                </span>
                                                <span className={`ex-payment-pill ${e.payment_status === 'Paid' ? 'paid' : e.payment_status === 'Rejected' ? 'rejected' : 'pending'}`}>
                                                    Payment: {e.payment_status === 'Unpaid' ? 'Pending' : e.payment_status}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Expenses;