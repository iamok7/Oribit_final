import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import './FinanceDashboard.css';

const FinanceDashboard = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const location = useLocation();
    const navigate = useNavigate();

    // Determine active tab from URL: /finance/raised, /finance/approved, etc.
    const pathSegments = location.pathname.split('/');
    const currentTab = pathSegments[pathSegments.length - 1]; // e.g., 'raised'

    // Validate tab, default to 'raised' if just '/finance'
    const activeTab = ['raised', 'approved', 'rejected', 'spendings'].includes(currentTab)
        ? currentTab : 'raised';

    const [expenses, setExpenses] = useState([]);
    const [expandedExpenseId, setExpandedExpenseId] = useState(null);

    useEffect(() => {
        if (currentTab === 'finance') {
            navigate('/finance/raised', { replace: true });
        } else {
            fetchExpenses();
        }
    }, [activeTab, currentTab, navigate]);

    const fetchExpenses = async () => {
        try {
            const res = await axios.get(`/api/expenses?user_id=${user.id}&role=${user.role}`);

            // Finance role gets all expenses with level >= 1
            // We filter them based on the active tab
            const data = res.data;

            if (activeTab === 'raised') {
                // Show all non-rejected, unpaid expenses (even L0/L1) to Finance
                setExpenses(data.filter(e => !e.is_rejected && e.payment_status === 'Unpaid'));
            } else if (activeTab === 'approved') {
                // History of processed (Paid) expenses
                setExpenses(data.filter(e => !e.is_rejected && e.payment_status === 'Paid'));
            } else if (activeTab === 'rejected') {
                setExpenses(data.filter(e => e.is_rejected || e.payment_status === 'Rejected'));
            } else if (activeTab === 'spendings') {
                // Spendings calculation should only include Paid expenses
                setExpenses(data.filter(e => e.payment_status === 'Paid'));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleFinanceAction = async (id, status, reason = '') => {
        try {
            await axios.put(`/api/expenses/${id}/finance_status`, {
                user_id: user.id,
                status,
                reason
            });
            fetchExpenses();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    // Calculate spendings
    const calculateSpendings = () => {
        const total = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Group by category
        const byCategory = expenses.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {});

        // Group by department
        const byDept = expenses.reduce((acc, e) => {
            acc[e.department] = (acc[e.department] || 0) + e.amount;
            return acc;
        }, {});

        return { total, byCategory, byDept };
    };

    const renderExpenseCard = (e) => (
        <div
            key={e.id}
            className={`expense-item ${expandedExpenseId === e.id ? 'expanded' : ''}`}
            onClick={() => setExpandedExpenseId(expandedExpenseId === e.id ? null : e.id)}
            style={{ cursor: 'pointer' }}
        >
            <div className="expense-details">
                <div className="expense-requestor">
                    <div className="avatar">{e.creator.charAt(0).toUpperCase()}</div>
                    <div>
                        <strong>{e.creator}</strong>
                        <div className="expense-dept">{e.department}</div>
                    </div>
                </div>
                <div className="expense-info">
                    <h4>{e.title}</h4>
                    <span className="expense-category">{e.category}</span>
                    <p className="expense-desc">{e.description}</p>
                </div>
            </div>

            <div className="expense-meta-finance">
                <div className="expense-amount-large">${e.amount.toFixed(2)}</div>

                <div className="badges-container" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <div className={`approval-badge ${e.is_rejected ? 'rejected-badge' : ''}`}>
                        {e.payment_status === 'Rejected' ? 'Finance Rejected' :
                            e.is_rejected
                                ? (e.approval_level === 0 ? 'L1 (Supervisor) Rejected' : 'L2 (Manager) Rejected')
                                : (e.approval_level === 2 ? 'L2 (Manager) Approved' :
                                    e.approval_level === 1 ? 'L1 (Supervisor) Approved' : 'Pending L1 (Supervisor)')}
                    </div>

                    <div className={`payment-badge ${e.payment_status === 'Paid' ? 'paid-badge' : e.payment_status === 'Unpaid' ? 'unpaid-badge' : 'rejected-badge'}`} style={{
                        background: e.payment_status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : e.payment_status === 'Rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: e.payment_status === 'Paid' ? '#10b981' : e.payment_status === 'Rejected' ? '#ef4444' : '#f59e0b',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        border: `1px solid ${e.payment_status === 'Paid' ? 'rgba(16, 185, 129, 0.2)' : e.payment_status === 'Rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                    }}>
                        Payment: {e.payment_status === 'Unpaid' ? 'Unpaid / Pending' : e.payment_status}
                    </div>
                </div>

                <div className="date-badge">{new Date(e.created_at).toLocaleDateString()}</div>
                {e.is_rejected && <div className="reject-reason">Reason: {e.rejection_reason}</div>}
            </div>

            {expandedExpenseId === e.id && e.payment_status === 'Unpaid' && !e.is_rejected && (
                <div className="expense-expanded-actions" style={{ width: '100%', marginTop: '1.5rem', borderTop: '1px solid #333', paddingTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {e.approval_level === 2 ? (
                        <>
                            <button
                                className="btn-approve"
                                onClick={(ev) => { ev.stopPropagation(); handleFinanceAction(e.id, 'Paid'); }}
                                style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Mark Paid
                            </button>
                            <button
                                className="btn-reject"
                                onClick={(ev) => {
                                    ev.stopPropagation();
                                    const reason = prompt("Reason for rejection:");
                                    if (reason !== null) handleFinanceAction(e.id, 'Rejected', reason);
                                }}
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Mark Rejected
                            </button>
                        </>
                    ) : (
                        <span style={{ color: '#f59e0b', fontStyle: 'italic', fontWeight: 'bold' }}>⏳ Manager Approval Pending</span>
                    )}
                </div>
            )}
        </div>
    );

    const spendings = activeTab === 'spendings' ? calculateSpendings() : null;

    return (
        <Layout role={user.role}>
            <div className="finance-container">
                <div className="finance-header">
                    <h2>⚖️ Finance Operations</h2>
                    <p className="subtitle">
                        {activeTab === 'raised' && "Expenses awaiting finance review."}
                        {activeTab === 'approved' && "All historical approved expenses."}
                        {activeTab === 'rejected' && "Expenses that were rejected."}
                        {activeTab === 'spendings' && "Financial overview of company spendings."}
                    </p>
                </div>

                {activeTab !== 'spendings' ? (
                    <div className="expense-list">
                        {expenses.length === 0 ? (
                            <div className="empty-state">No expenses found for this category.</div>
                        ) : (
                            expenses.map(renderExpenseCard)
                        )}
                    </div>
                ) : (
                    <div className="spendings-dashboard">
                        <div className="spendings-hero">
                            <h3>Total Company Spendings</h3>
                            <div className="hero-amount">${spendings.total.toFixed(2)}</div>
                        </div>

                        <div className="spendings-breakdown">
                            <div className="breakdown-card">
                                <h3>By Category</h3>
                                <ul>
                                    {Object.entries(spendings.byCategory).map(([cat, amt]) => (
                                        <li key={cat}>
                                            <span>{cat}</span>
                                            <strong>${amt.toFixed(2)}</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="breakdown-card">
                                <h3>By Department</h3>
                                <ul>
                                    {Object.entries(spendings.byDept).map(([dept, amt]) => (
                                        <li key={dept}>
                                            <span>{dept}</span>
                                            <strong>${amt.toFixed(2)}</strong>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default FinanceDashboard;
