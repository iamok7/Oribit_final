import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import './CalendarView.css';

const formatDateLocal = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ACCENT_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#0ea5e9','#14b8a6'];

/* ─── Scheduled Sidebar ──────────────────────────────────────────────────── */
const ScheduledPanel = ({ tasks, selectedDate }) => {
    const base = selectedDate || new Date();
    const baseStr = formatDateLocal(base);

    const upcoming = tasks
        .filter(t => {
            if (!t.start_time) return false;
            return formatDateLocal(new Date(t.start_time)) >= baseStr;
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 10);

    const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const getDuration = (startIso, endIso) => {
        const diffMs = new Date(endIso) - new Date(startIso);
        const mins = Math.round(diffMs / 60000);
        if (mins <= 0) return '—';
        if (mins < 60) return `${mins} min`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h ${m}m` : `${h} hr${h > 1 ? 's' : ''}`;
    };

    const grouped = {};
    upcoming.forEach((t, i) => {
        const d = new Date(t.start_time);
        const key = `${String(d.getHours()).padStart(2,'0')}:00`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ ...t, _ci: i });
    });

    const scheduledLabel = base.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="sp-panel">
            <div className="sp-head">
                <div className="sp-head-left">
                    <div className="sp-head-title">Scheduled</div>
                    <div className="sp-head-date">{scheduledLabel}</div>
                </div>
                <div className="sp-head-actions">
                    <div className="sp-cal-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                            <path d="M5 1.5V4M11 1.5V4M2 7H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                    </div>
                </div>
            </div>

            <div className="sp-body">
                {Object.keys(grouped).length === 0 ? (
                    <div className="sp-empty">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="sp-empty-icon">
                            <circle cx="24" cy="24" r="20" stroke="#bfdbfe" strokeWidth="2.5"/>
                            <path d="M24 14V24L30 30" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div className="sp-empty-text">No upcoming tasks</div>
                        <div className="sp-empty-sub">Click a day to add one</div>
                    </div>
                ) : (
                    Object.entries(grouped).map(([hour, hourTasks]) => (
                        <div key={hour} className="sp-hour-group">
                            <div className="sp-hour-label">{hour}</div>
                            {hourTasks.map((task, index) => {
                                const ac = ACCENT_COLORS[task._ci % ACCENT_COLORS.length];
                                const startD = new Date(task.start_time);
                                const endD = task.deadline ? new Date(task.deadline) : new Date(startD.getTime() + 3_600_000);
                                
                                return (
                                    <div 
                                        key={task.id} 
                                        className="sp-card" 
                                        style={{ borderLeft: `4px solid ${ac}` }} 
                                    >
                                        <div className="sp-card-title">{task.title}</div>
                                        
                                        {task.description && (
                                            <div className="sp-card-desc" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {task.description.length > 55 ? task.description.substring(0, 55) + '…' : task.description}
                                            </div>
                                        )}
                                        
                                        <div className="sp-card-time-row">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                                                    <circle cx="6" cy="6" r="4.5" stroke={ac} strokeWidth="1.5"/>
                                                    <path d="M6 3.5V6L7.5 7.5" stroke={ac} strokeWidth="1.5" strokeLinecap="round"/>
                                                </svg>
                                                <span>{fmtTime(startD)} – {fmtTime(endD)}</span>
                                            </div>
                                            {task.status && (
                                                <span style={{ 
                                                    background: `${ac}15`, color: ac, 
                                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' 
                                                }}>
                                                    {task.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

/* ─── Main CalendarView ──────────────────────────────────────────────────── */
const CalendarView = () => {
    const user = JSON.parse(localStorage.getItem('user'));

    const [tasks, setTasks] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState({ title: '', description: '', start_time: '', is_daily_task: true });

    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [viewTask, setViewTask] = useState(null);

    const fetchTasks = async () => {
        try {
            const res = await axios.get(`/api/tasks?user_id=${user.id}&role=${user.role}`);
            setTasks(res.data);
        } catch (err) { console.error('Calendar fetch failed:', err); }
    };

    useEffect(() => { fetchTasks(); }, []);

    /* Navigation */
    const handlePrevMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() - 1);
        setCurrentDate(d);
    };
    const handleNextMonth = () => {
        const d = new Date(currentDate);
        d.setMonth(d.getMonth() + 1);
        setCurrentDate(d);
    };

    /* Build 6-row month grid (42 cells) */
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calCells = [];
    for (let i = firstDow - 1; i >= 0; i--) {
        calCells.push({ date: new Date(year, month, -i), current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        calCells.push({ date: new Date(year, month, d), current: true });
    }
    const tail = 42 - calCells.length;
    for (let d = 1; d <= tail; d++) {
        calCells.push({ date: new Date(year, month + 1, d), current: false });
    }

    /* Tasks map by date */
    const personalTasks = tasks.filter(t => t.assigned_to && t.assigned_to.id === user.id);
    const byDate = {};
    personalTasks.forEach(task => {
        const addToDate = (key) => {
            if (!byDate[key]) byDate[key] = [];
            if (!byDate[key].find(x => x.id === task.id)) byDate[key].push(task);
        };
        if (task.start_time) addToDate(formatDateLocal(new Date(task.start_time)));
        if (task.deadline)   addToDate(formatDateLocal(new Date(task.deadline)));
    });

    const todayStr = formatDateLocal(new Date());

    const handleDayClick = (cell, e) => {
        if (e.target.closest && e.target.closest('.day-pill')) return;
        setSelectedDate(cell.date);
        const d = new Date(cell.date);
        d.setHours(9, 0, 0, 0);
        const tz = d.getTimezoneOffset() * 60000;
        const iso = new Date(d - tz).toISOString().slice(0, 16);
        setModalData({ title: '', description: '', start_time: iso, is_daily_task: true });
        setIsModalOpen(true);
    };

    const handlePillClick = (task, e) => {
        e.stopPropagation();
        setViewTask(task);
        setIsViewModalOpen(true);
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            const start = new Date(modalData.start_time);
            const tz = start.getTimezoneOffset() * 60000;
            const deadline = new Date(start.getTime() + 86_400_000);
            const deadlineIso = new Date(deadline - tz).toISOString().slice(0, 16);
            await axios.post('/api/tasks', {
                title: modalData.title,
                description: modalData.description,
                start_time: modalData.start_time || null,
                deadline: deadlineIso,
                is_daily_task: true,
                assigned_to: user.id,
                created_by: user.id,
            });
            setIsModalOpen(false);
            fetchTasks();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create task');
        }
    };

    const fmtModalDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };

    return (
        <Layout role={user.role}>
            <div className="cal-page">
                {/* Ambient orbs */}
                <div className="cal-orb cal-orb-1" />
                <div className="cal-orb cal-orb-2" />
                <div className="cal-orb cal-orb-3" />

                {/* ── Main calendar panel ── */}
                <div className="cal-main">
                    {/* Header */}
                    <div className="cal-header">
                        <div className="cal-month-label">
                            <span className="cal-month-name">{MONTHS[month]}</span>
                            <span className="cal-year-num">{year}</span>
                        </div>
                        <div className="cal-nav-group">
                            <button className="cal-nav-btn" onClick={handlePrevMonth} aria-label="Previous month">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                            <button className="cal-nav-btn" onClick={handleNextMonth} aria-label="Next month">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M7 4L12 9L7 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Day-of-week row */}
                    <div className="cal-dow-row">
                        {DAYS_SHORT.map(d => (
                            <div key={d} className="cal-dow-cell">{d}</div>
                        ))}
                    </div>

                    {/* Month grid */}
                    <div className="cal-grid">
                        {calCells.map((cell, i) => {
                            const ds = formatDateLocal(cell.date);
                            const isToday    = ds === todayStr;
                            const isSel      = ds === formatDateLocal(selectedDate);
                            const dayTasks   = byDate[ds] || [];

                            return (
                                <div
                                    key={i}
                                    className={`cal-cell${!cell.current ? ' other-month' : ''}${isToday ? ' is-today' : ''}${isSel ? ' is-selected' : ''}`}
                                    onClick={(e) => handleDayClick(cell, e)}
                                >
                                    <div className="cal-cell-num">{cell.date.getDate()}</div>
                                    <div className="cal-cell-tasks">
                                        {dayTasks.slice(0, 3).map((t, ti) => {
                                            const ac = ACCENT_COLORS[t.id % ACCENT_COLORS.length];
                                            return (
                                                <div
                                                    key={`${t.id}-${ti}`}
                                                    className="day-pill"
                                                    onClick={(e) => handlePillClick(t, e)}
                                                    title={t.title}
                                                    style={{ '--pill-ac': ac }}
                                                >
                                                    <span className="pill-dot" style={{ background: ac }} />
                                                    <span className="pill-label">
                                                        {t.title.length > 13 ? t.title.substring(0, 13) + '…' : t.title}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {dayTasks.length > 3 && (
                                            <div className="pill-more">+{dayTasks.length - 3} more</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Scheduled sidebar ── */}
                <ScheduledPanel tasks={personalTasks} selectedDate={selectedDate} />
            </div>

            {/* ══ Create Task Modal ══ */}
            {isModalOpen && (
                <div className="cal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="cal-modal" onClick={e => e.stopPropagation()}>
                        <div className="cal-modal-head">
                            <div className="cal-modal-head-left">
                                <div className="cal-modal-icon">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <rect x="3" y="4" width="14" height="13" rx="3" stroke="#2563eb" strokeWidth="1.8"/>
                                        <path d="M7 2.5V5M13 2.5V5M3 8.5H17" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
                                        <path d="M7 12.5H13M7 15.5H10" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"/>
                                    </svg>
                                </div>
                                <div>
                                    <div className="cal-modal-title">New Task</div>
                                    <div className="cal-modal-sub">{fmtModalDate(modalData.start_time)}</div>
                                </div>
                            </div>
                            <button className="cal-modal-close" onClick={() => setIsModalOpen(false)}>
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path d="M3 3L12 12M12 3L3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateTask} className="cal-modal-body">
                            <div className="cal-field">
                                <label className="cal-label">Task Title *</label>
                                <input
                                    required autoFocus
                                    className="cal-input"
                                    type="text"
                                    placeholder="Enter task name…"
                                    value={modalData.title}
                                    onChange={e => setModalData({ ...modalData, title: e.target.value })}
                                />
                            </div>

                            <div className="cal-field">
                                <label className="cal-label">Note / Description</label>
                                <textarea
                                    className="cal-input cal-textarea"
                                    rows="3"
                                    placeholder="Add a description…"
                                    value={modalData.description}
                                    onChange={e => setModalData({ ...modalData, description: e.target.value })}
                                />
                            </div>

                            <div className="cal-field">
                                <label className="cal-label">Start Time</label>
                                <input
                                    className="cal-input"
                                    type="datetime-local"
                                    value={modalData.start_time}
                                    onChange={e => setModalData({ ...modalData, start_time: e.target.value })}
                                />
                            </div>

                            <div className="cal-check-row">
                                <input
                                    type="checkbox"
                                    id="modal_daily"
                                    className="cal-checkbox"
                                    checked={modalData.is_daily_task}
                                    onChange={e => setModalData({ ...modalData, is_daily_task: e.target.checked })}
                                />
                                <label htmlFor="modal_daily" className="cal-check-label">Daily Task (1-day duration)</label>
                            </div>

                            <button type="submit" className="cal-save-btn">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Save Task
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ══ View Task Modal ══ */}
            {isViewModalOpen && viewTask && (
                <div className="cal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="cal-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                        <div className="cal-modal-head">
                            <div className="cal-modal-head-left">
                                <div className="cal-modal-icon" style={{
                                    background: `${ACCENT_COLORS[viewTask.id % ACCENT_COLORS.length]}18`,
                                    border: `1.5px solid ${ACCENT_COLORS[viewTask.id % ACCENT_COLORS.length]}30`
                                }}>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                        <circle cx="10" cy="10" r="7.5" stroke={ACCENT_COLORS[viewTask.id % ACCENT_COLORS.length]} strokeWidth="1.8"/>
                                        <path d="M10 6.5V10L12.5 12.5" stroke={ACCENT_COLORS[viewTask.id % ACCENT_COLORS.length]} strokeWidth="1.8" strokeLinecap="round"/>
                                    </svg>
                                </div>
                                <div>
                                    <div className="cal-modal-title">{viewTask.title}</div>
                                    <div className="cal-modal-sub" style={{ color: ACCENT_COLORS[viewTask.id % ACCENT_COLORS.length] }}>
                                        {viewTask.status}
                                    </div>
                                </div>
                            </div>
                            <button className="cal-modal-close" onClick={() => setIsViewModalOpen(false)}>
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <path d="M3 3L12 12M12 3L3 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>

                        <div className="cal-modal-body">
                            {viewTask.type === 'deadline' && (
                                <div className="cal-warn-box">⚠️ This is a deadline reminder</div>
                            )}
                            {viewTask.description && (
                                <div className="cal-desc-box">{viewTask.description}</div>
                            )}
                            <div className="cal-detail-list">
                                {viewTask.start_time && (
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-key">Start</span>
                                        <span className="cal-detail-val">{new Date(viewTask.start_time).toLocaleString()}</span>
                                    </div>
                                )}
                                {viewTask.deadline && (
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-key">Deadline</span>
                                        <span className="cal-detail-val">{new Date(viewTask.deadline).toLocaleString()}</span>
                                    </div>
                                )}
                                {viewTask.creator?.username && (
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-key">Created by</span>
                                        <span className="cal-detail-val">{viewTask.creator.username}</span>
                                    </div>
                                )}
                                {viewTask.project && (
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-key">Project</span>
                                        <span className="cal-detail-val">{viewTask.project.name || 'N/A'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default CalendarView;
