import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import './Tasks.css';

const COLUMNS = ['To Do', 'In Progress', 'Completed'];

/* ─── Horizontal Timeline ─────────────────────────────────────────────────── */
const HorizontalTimeline = ({ tasks }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Range: 3 weeks before → 4 weeks after today  (49 days)
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 21);
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + 28);
    const totalMs = rangeEnd - rangeStart;

    const getPos = (date) => {
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return Math.max(1, Math.min(99, ((d - rangeStart) / totalMs) * 100));
    };

    // Weekly markers
    const weekMarkers = [];
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 7)) {
        weekMarkers.push(new Date(d));
    }

    const todayPos = getPos(today);
    const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    // Milestones: tasks with deadlines inside the range
    const nodeColors = ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#ef4444'];
    const milestones = tasks
        .filter(t => t.deadline)
        .map(t => ({ task: t, date: new Date(t.deadline) }))
        .filter(m => m.date >= rangeStart && m.date <= rangeEnd)
        .sort((a, b) => a.date - b.date)
        .slice(0, 6);

    // Nearest future task → floating card
    const futureTask = tasks
        .filter(t => t.deadline && new Date(t.deadline) > today && new Date(t.deadline) <= rangeEnd)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    const floatingPos = futureTask
        ? Math.min(82, Math.max(12, getPos(new Date(futureTask.deadline))))
        : null;

    return (
        <div className="tl-section">
            <div className="tl-section-title">Sprint Timeline</div>
            <div className="tl-wrapper">

                {/* ── Axis ── */}
                <div className="tl-axis" />

                {/* ── Day-of-week initials (between each pair of week markers) ── */}
                {weekMarkers.slice(0, -1).map((wm, wi) => {
                    const next = weekMarkers[wi + 1];
                    if (!next) return null;
                    const sp = getPos(wm);
                    const ep = getPos(next);
                    return (
                        <div key={wi} className="tl-dow-group"
                            style={{ left: `${sp}%`, width: `${ep - sp}%` }}>
                            {DOW.map((d, di) => <span key={di} className="tl-dow">{d}</span>)}
                        </div>
                    );
                })}

                {/* ── Today pill ── */}
                <div className="tl-today-pin" style={{ left: `${todayPos}%` }}>
                    <div className="tl-today-pill">Today, {fmtDate(today)}</div>
                    <div className="tl-today-needle" />
                </div>

                {/* ── Milestone nodes ── */}
                {milestones.map((m, i) => (
                    <div key={m.task.id} className="tl-node"
                        style={{
                            left: `${getPos(m.date)}%`,
                            background: nodeColors[i % nodeColors.length],
                            boxShadow: `0 0 0 3px ${nodeColors[i % nodeColors.length]}40`,
                        }}>
                        {m.date.getDate()}
                    </div>
                ))}

                {/* ── Floating active task card ── */}
                {futureTask && floatingPos !== null && (
                    <div className="tl-float-wrap" style={{ left: `${floatingPos}%` }}>
                        <div className="tl-float-card">
                            <div className="tl-fc-title">
                                {futureTask.title.length > 24
                                    ? futureTask.title.substring(0, 24) + '…'
                                    : futureTask.title}
                            </div>
                            <div className="tl-fc-sub">end on {fmtDate(new Date(futureTask.deadline))}</div>
                            <div className="tl-fc-prog-text">60% completed</div>
                            <div className="tl-fc-bar">
                                <div className="tl-fc-bar-fill" style={{ width: '60%' }} />
                            </div>
                            <div className="tl-fc-icons">
                                {/* check */}
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                    <circle cx="7" cy="7" r="5.5" stroke="#10b981" strokeWidth="1.5" />
                                    <path d="M4.5 7L6 8.5L9.5 5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {/* double up arrows */}
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 11V3M4.5 5.5L7 3L9.5 5.5M4.5 8L7 5.5L9.5 8" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {/* chevron right */}
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                    <path d="M5 3.5L9 7L5 10.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="tl-float-stem" />
                    </div>
                )}

                {/* ── Date labels below axis ── */}
                {weekMarkers.map((wm, i) => (
                    <div key={i} className="tl-date-label" style={{ left: `${getPos(wm)}%` }}>
                        {fmtDate(wm)}
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── Task Stats Bar ───────────────────────────────────────────────────────── */
const TaskStatsBar = ({ tasksByColumn }) => {
    const cols = [
        { key: 'Backlog',      label: 'Overdue',      color: '#ef4444', light: '#fef2f2', border: '#fecaca' },
        { key: 'To Do',        label: 'To Do',        color: '#2563eb', light: '#eff6ff', border: '#bfdbfe' },
        { key: 'In Progress',  label: 'In Progress',  color: '#0ea5e9', light: '#f0f9ff', border: '#bae6fd' },
        { key: 'Completed',    label: 'Completed',    color: '#10b981', light: '#f0fdf4', border: '#bbf7d0' },
    ];
    const total    = cols.reduce((s, c) => s + (tasksByColumn[c.key]?.length || 0), 0);
    const done     = tasksByColumn['Completed']?.length || 0;
    const pct      = total > 0 ? Math.round((done / total) * 100) : 0;
    const R        = 22;
    const circ     = 2 * Math.PI * R;

    return (
        <div className="tsb-wrap">
            {/* ── Summary ring ── */}
            <div className="tsb-ring-card">
                <div className="tsb-ring-svg-wrap">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r={R} fill="none" stroke="#dbeafe" strokeWidth="7" />
                        <circle cx="40" cy="40" r={R} fill="none"
                            stroke="url(#ringGrad)" strokeWidth="7"
                            strokeDasharray={circ}
                            strokeDashoffset={circ * (1 - pct / 100)}
                            strokeLinecap="round"
                            transform="rotate(-90 40 40)"
                            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                        <defs>
                            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#2563eb" />
                                <stop offset="100%" stopColor="#38bdf8" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="tsb-ring-inner">
                        <span className="tsb-ring-pct">{pct}%</span>
                        <span className="tsb-ring-sub">done</span>
                    </div>
                </div>
                <div className="tsb-ring-info">
                    <div className="tsb-total-num">{total}</div>
                    <div className="tsb-total-label">Total Tasks</div>
                    <div className="tsb-total-sub">{done} completed · {total - done} remaining</div>
                </div>
            </div>

            {/* ── 4 stat cards ── */}
            {cols.map((c, i) => {
                const count = tasksByColumn[c.key]?.length || 0;
                const barPct = total > 0 ? (count / total) * 100 : 0;
                return (
                    <div key={c.key} className="tsb-stat-card" style={{ '--sc': c.color, '--sc-light': c.light, '--sc-border': c.border, animationDelay: `${i * 60}ms` }}>
                        <div className="tsb-sc-header">
                            <span className="tsb-sc-dot" style={{ background: c.color }} />
                            <span className="tsb-sc-label">{c.label}</span>
                        </div>
                        <div className="tsb-sc-count">{count}</div>
                        <div className="tsb-sc-bar-track">
                            <div className="tsb-sc-bar-fill" style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${c.color}cc, ${c.color})` }} />
                        </div>
                        <div className="tsb-sc-pct-row">
                            <span className="tsb-sc-pct">{Math.round(barPct)}%</span>
                            <span className="tsb-sc-of">of total</span>
                        </div>
                    </div>
                );
            })}

            {/* ── Distribution strip ── */}
            <div className="tsb-dist-card">
                <div className="tsb-dist-title">Distribution</div>
                <div className="tsb-dist-bar">
                    {cols.map(c => {
                        const count = tasksByColumn[c.key]?.length || 0;
                        const w = total > 0 ? (count / total) * 100 : 0;
                        return w > 0 ? (
                            <div key={c.key} className="tsb-dist-seg" title={`${c.label}: ${count}`}
                                style={{ width: `${w}%`, background: c.color }} />
                        ) : null;
                    })}
                </div>
                <div className="tsb-dist-legend">
                    {cols.map(c => (
                        <div key={c.key} className="tsb-dist-leg">
                            <span className="tsb-dist-dot" style={{ background: c.color }} />
                            <span className="tsb-dist-leg-label">{c.label}</span>
                            <span className="tsb-dist-leg-count">{tasksByColumn[c.key]?.length || 0}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Tasks = () => {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user && user.id === undefined) {
        return (
            <Layout role={user.role}>
                <div style={{ padding: '3rem', textAlign: 'center', background: '#fee2e2', color: '#991b1b', borderRadius: '16px', margin: '2rem', border: '1.5px solid #fecaca' }}>
                    <h2 style={{ color: '#dc2626', fontWeight: 800 }}>Session Update Required</h2>
                    <p>Please click the <strong>Logout</strong> button in the sidebar and log back in.</p>
                </div>
            </Layout>
        );
    }

    const [tasks, setTasks] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [activeProjectId, setActiveProjectId] = useState('');
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const [subtasks, setSubtasks] = useState([]);
    const [issues, setIssues] = useState([]);
    const [comments, setComments] = useState([]);

    // UI-only modal state
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [deadlineTimeEnabled, setDeadlineTimeEnabled] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const imageInputRef = useRef(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'To Do',
        deadline: '',
        start_time: '',
        is_daily_task: false,
        assigned_to: '',
        project_id: '',
        tags: [],
        co_assignees: [],
        image_attachment: null,
    });

    const [message, setMessage] = useState('');

    // ── Image helpers ─────────────────────────────────────────────
    const compressImage = (file) => new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const img = new Image();
        img.onload = () => {
            const MAX = 640;
            let w = img.width, h = img.height;
            if (w > h && w > MAX) { h = (h * MAX) / w; w = MAX; }
            else if (h > MAX) { w = (w * MAX) / h; h = MAX; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = URL.createObjectURL(file);
    });

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const compressed = await compressImage(file);
        setFormData(prev => ({ ...prev, image_attachment: compressed }));
        e.target.value = '';
    };

    // ── Tag helpers ───────────────────────────────────────────────
    const handleTagKeyDown = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
            e.preventDefault();
            const t = tagInput.trim().toLowerCase();
            if (!formData.tags.includes(t)) setFormData(prev => ({ ...prev, tags: [...prev.tags, t] }));
            setTagInput('');
        }
        if (e.key === 'Backspace' && !tagInput && formData.tags.length > 0)
            setFormData(prev => ({ ...prev, tags: prev.tags.slice(0, -1) }));
    };
    const removeTag = (t) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(x => x !== t) }));

    // ── Co-assignee helpers ────────────────────────────────────────
    const addCoAssignee = (userId) => {
        const id = parseInt(userId);
        if (!id || formData.co_assignees.includes(id)) return;
        setFormData(prev => ({ ...prev, co_assignees: [...prev.co_assignees, id] }));
    };
    const removeCoAssignee = (id) => setFormData(prev => ({ ...prev, co_assignees: prev.co_assignees.filter(x => x !== id) }));

    useEffect(() => { fetchData(); }, [activeProjectId]);
    useEffect(() => { fetchDropdownData(); }, []);

    const fetchData = async () => {
        try {
            let url = `/api/tasks?user_id=${user.id}&role=${user.role}`;
            if (activeProjectId) url += `&project_id=${activeProjectId}`;
            const res = await axios.get(url);
            setTasks(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchDropdownData = async () => {
        try {
            if (user.role === 'manager') {
                const res = await axios.get('/api/users');
                setAssignableUsers(res.data);
            } else if (user.role === 'supervisor') {
                const res = await axios.get('/api/users?role=employee');
                setAssignableUsers(res.data.filter(u => u.department_id === user.department_id));
            } else {
                setAssignableUsers([user]);
            }
            const res = await axios.get(`/api/projects?user_id=${user.id}&role=${user.role}`);
            setProjects(res.data);
        } catch (err) { console.error("Dropdown data fetch error", err); }
    };

    const fetchTaskDetails = async (taskId) => {
        try {
            const res = await axios.get(`/api/tasks/${taskId}/details`);
            setSubtasks(res.data.subtasks);
            setIssues(res.data.issues);
            setComments(res.data.comments);
        } catch (err) { console.error("Failed to fetch task details", err); }
    };

    const handleOpenModal = (task = null, defaultStatus = 'To Do') => {
        setActiveTab('Overview');
        setMessage('');
        setTagInput('');
        if (task) {
            setCurrentTask(task);
            const hasDeadlineTime = task.deadline && task.deadline.includes('T') && !task.deadline.endsWith('T00:00');
            setDeadlineTimeEnabled(hasDeadlineTime);
            setScheduleOpen(!!task.start_time);
            setFormData({
                title: task.title,
                description: task.description || '',
                status: task.status,
                deadline: task.deadline ? task.deadline.substring(0, 16) : '',
                start_time: task.start_time ? task.start_time.substring(0, 16) : '',
                is_daily_task: task.is_daily_task || false,
                assigned_to: task.assigned_to ? task.assigned_to.id : '',
                project_id: task.project_id || '',
                tags: task.tags || [],
                co_assignees: task.co_assignees ? task.co_assignees.map(u => u.id) : [],
                image_attachment: task.image_attachment || null,
            });
            fetchTaskDetails(task.id);
        } else {
            setCurrentTask(null);
            setScheduleOpen(false);
            setDeadlineTimeEnabled(false);
            setFormData({
                title: '', description: '', status: defaultStatus,
                deadline: '', start_time: '', is_daily_task: false,
                assigned_to: '', project_id: '',
                tags: [], co_assignees: [], image_attachment: null,
            });
            setSubtasks([]); setIssues([]); setComments([]);
        }
        setIsModalOpen(true);
    };

    const handleAddSubtask = async (title) => {
        if (!title.trim() || !currentTask) return;
        try {
            const res = await axios.post(`/api/tasks/${currentTask.id}/subtasks`, { title });
            setSubtasks([...subtasks, { id: res.data.id, title, is_completed: false }]);
        } catch (err) { console.error(err); }
    };

    const handleToggleSubtask = async (subtaskId, isCompleted) => {
        try {
            await axios.put(`/api/subtasks/${subtaskId}`, { is_completed: isCompleted });
            setSubtasks(subtasks.map(st => st.id === subtaskId ? { ...st, is_completed: isCompleted } : st));
        } catch (err) { console.error(err); }
    };

    const handleCreateIssue = async (title, description, deadline) => {
        if (!title.trim() || !currentTask) return;
        try {
            await axios.post(`/api/tasks/${currentTask.id}/issues`, {
                title, description, deadline, created_by: user.id
            });
            fetchTaskDetails(currentTask.id);
        } catch (err) { console.error(err); }
    };

    const handleResolveIssue = async (issueId) => {
        try {
            await axios.put(`/api/issues/${issueId}`, { is_resolved: true });
            setIssues(issues.map(iss => iss.id === issueId ? { ...iss, is_resolved: true } : iss));
        } catch (err) { console.error(err); }
    };

    const handleSendMessage = async (content) => {
        if (!content.trim() || !currentTask) return;
        try {
            const res = await axios.post(`/api/tasks/${currentTask.id}/comments`, {
                content, user_id: user.id
            });
            setComments([...comments, {
                id: res.data.id, content,
                user: { id: user.id, username: user.username, role: user.role },
                created_at: new Date().toISOString()
            }]);
        } catch (err) { console.error(err); }
    };

    const handleDeleteTask = async () => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        try {
            await axios.delete(`/api/tasks/${currentTask.id}`);
            setIsModalOpen(false);
            fetchData();
        } catch (err) { setMessage('Failed to delete task.'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        try {
            const payload = {
                ...formData,
                user_id: user.id,
                tags: formData.tags,
                co_assignees: formData.co_assignees,
                image_attachment: formData.image_attachment || null,
            };
            if (!payload.assigned_to) payload.assigned_to = null;
            else payload.assigned_to = parseInt(payload.assigned_to, 10);
            if (!payload.project_id) payload.project_id = null;
            else payload.project_id = parseInt(payload.project_id, 10);
            // If deadline time not enabled, strip time part
            if (payload.deadline && !deadlineTimeEnabled) {
                payload.deadline = payload.deadline.substring(0, 10) + 'T23:59';
            }
            if (!payload.deadline) payload.deadline = null;
            if (!payload.start_time) {
                payload.start_time = currentTask ? null : new Date().toISOString().substring(0, 16);
            }
            if (currentTask) {
                await axios.put(`/api/tasks/${currentTask.id}`, payload);
            } else {
                payload.created_by = user.id;
                await axios.post('/api/tasks', payload);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setMessage(err.response?.data?.message || 'Action failed');
        }
    };

    const handleQuickStatusChange = async (taskId, newStatus, e) => {
        e.stopPropagation();
        try {
            await axios.put(`/api/tasks/${taskId}`, { status: newStatus, user_id: user.id });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update status');
        }
    };

    const now = new Date();
    const isOverdue = (task) => {
        if (!task.deadline || task.status === 'Completed') return false;
        return new Date(task.deadline) < now;
    };

    const tasksByColumn = {
        'To Do': tasks.filter(t => t.status === 'To Do' && !isOverdue(t)),
        'In Progress': tasks.filter(t => t.status === 'In Progress' && !isOverdue(t)),
        'Completed': tasks.filter(t => t.status === 'Completed'),
        'Backlog': tasks.filter(t => isOverdue(t)),
    };

    const DISPLAY_COLUMNS = ['Backlog', 'To Do', 'In Progress', 'Completed'];

    const getStatusTag = (col) => {
        const map = { 'To Do': 'tag-todo', 'In Progress': 'tag-progress', 'Completed': 'tag-done', 'Backlog': 'tag-backlog' };
        return map[col] || 'tag-todo';
    };

    const getProgressInfo = (col) => {
        if (col === 'Completed') return { text: 'Completed', percent: 100, color: 'var(--col-done)' };
        if (col === 'In Progress') return { text: 'In progress', percent: 50, color: 'var(--col-prog)' };
        if (col === 'Backlog') return { text: 'Overdue', percent: 0, color: 'var(--col-backlog)' };
        return { text: 'Not started yet', percent: 0, color: 'var(--col-todo)' };
    };

    const getTaskCatTag = (task) => {
        if (task.project_id) {
            const proj = projects.find(p => p.id === task.project_id);
            return { label: proj ? proj.name.toUpperCase().substring(0, 14) : 'PROJECT', cls: 'cat-project' };
        }
        if (task.is_daily_task) return { label: 'DAILY TASK', cls: 'cat-daily' };
        return { label: 'GENERAL', cls: 'cat-general' };
    };

    return (
        <Layout role={user.role}>
            <div className="tasks-container">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Task Boards</h1>
                        <p className="page-breadcrumb">Manage and track your team's tasks</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <select
                            className="header-select"
                            value={activeProjectId}
                            onChange={(e) => setActiveProjectId(e.target.value)}
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="header-btn" onClick={() => handleOpenModal()}>
                            + New Task
                        </button>
                    </div>
                </div>

                {/* ============ HORIZONTAL TIMELINE ============ */}
                <HorizontalTimeline tasks={tasks} />

                {/* ============ TASK STATS BAR ============ */}
                <TaskStatsBar tasksByColumn={tasksByColumn} />

                {/* ============ KANBAN BOARD ============ */}
                <div className="kanban-board">
                    {DISPLAY_COLUMNS.map(col => (
                        <div
                            className="kanban-column"
                            key={col}
                            onDragOver={(e) => { if (col !== 'Backlog') { e.preventDefault(); e.currentTarget.classList.add('drag-over'); } }}
                            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('drag-over');
                                if (col === 'Backlog') return;
                                const taskId = e.dataTransfer.getData('taskId');
                                if (taskId) handleQuickStatusChange(Number(taskId), col, { stopPropagation: () => {} });
                            }}
                        >
                            {/* Column Header */}
                            <div className="kanban-column-header">
                                <div className="header-left">
                                    <span className={`header-dot dot-${col.replace(' ', '-')}`}></span>
                                    <span className="header-title">{col} <span className="header-count-inline">({tasksByColumn[col].length})</span></span>
                                </div>
                                <div className="header-actions">
                                    <span className="icon-dots">···</span>
                                </div>
                            </div>

                            {/* Top Add Task Button */}
                            {col !== 'Backlog' && (
                                <button className="column-add-btn-top" onClick={() => handleOpenModal(null, col)}>
                                    Add Task +
                                </button>
                            )}

                            {/* Task Cards */}
                            {tasksByColumn[col].map(task => {
                                const cat = getTaskCatTag(task);
                                const prog = getProgressInfo(col);
                                return (
                                    <div
                                        key={task.id}
                                        className={`task-card status-${col.replace(' ', '-')}`}
                                        draggable={true}
                                        onDragStart={(e) => { e.dataTransfer.setData('taskId', task.id.toString()); e.currentTarget.style.opacity = '0.5'; }}
                                        onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                                        onClick={() => handleOpenModal(task)}
                                    >
                                        {/* Header: pill tag + menu */}
                                        <div className="card-head">
                                            <span className={`card-pill ${cat.cls}`}>{cat.label}</span>
                                            <button className="card-menu-dots" onClick={e => e.stopPropagation()}>
                                                <svg width="3" height="13" viewBox="0 0 3 13" fill="none">
                                                    <circle cx="1.5" cy="1.5" r="1.5" fill="#cbd5e1" />
                                                    <circle cx="1.5" cy="6.5" r="1.5" fill="#cbd5e1" />
                                                    <circle cx="1.5" cy="11.5" r="1.5" fill="#cbd5e1" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Title */}
                                        <h4 className="card-title">{task.title}</h4>

                                        {/* User tags */}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="card-user-tags">
                                                {task.tags.slice(0, 3).map((t, i) => (
                                                    <span key={i} className="card-user-tag">{t}</span>
                                                ))}
                                                {task.tags.length > 3 && <span className="card-tag-more">+{task.tags.length - 3}</span>}
                                            </div>
                                        )}

                                        {/* Progress */}
                                        <div className="card-progress-section">
                                            <span className="card-progress-label">{prog.text}</span>
                                            <div className="card-progress-track">
                                                <div className="card-progress-fill" style={{ width: `${prog.percent}%`, background: prog.color }} />
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="card-footer-new">
                                            <div className="card-footer-icons">
                                                {/* Blue circular check */}
                                                <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                                                    <circle cx="8.5" cy="8.5" r="7.5"
                                                        fill={col === 'Completed' ? '#10b981' : 'transparent'}
                                                        stroke={col === 'Completed' ? '#10b981' : '#93c5fd'}
                                                        strokeWidth="1.5" />
                                                    <path d="M5.5 8.5L7.2 10.2L11.5 6"
                                                        stroke={col === 'Completed' ? 'white' : '#93c5fd'}
                                                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                        opacity={col === 'Completed' ? 1 : 0.55} />
                                                </svg>
                                                {/* Red double-up arrows */}
                                                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                                                    <path d="M7 10V3M4.5 5.5L7 3L9.5 5.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M4.5 8.5L7 6L9.5 8.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                                                </svg>
                                            </div>
                                            {/* Overlapping avatar stack */}
                                            <div className="card-avatars-v2">
                                                {task.assigned_to ? (
                                                    <div className="avatar-v2" title={task.assigned_to.username}>
                                                        {task.assigned_to.username.charAt(0).toUpperCase()}
                                                    </div>
                                                ) : (
                                                    <div className="avatar-v2 avatar-unassigned" title="Unassigned">?</div>
                                                )}
                                                {(task.co_assignees || []).slice(0, 2).map(u => (
                                                    <div key={u.id} className="avatar-v2" title={u.username}>
                                                        {u.username.charAt(0).toUpperCase()}
                                                    </div>
                                                ))}
                                                {(task.co_assignees || []).length > 2 && (
                                                    <div className="avatar-count-v2">+{(task.co_assignees || []).length - 1}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {tasksByColumn[col].length === 0 && (
                                <div className="empty-column">No tasks here</div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ============ MODAL ============ */}
                {isModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <div className="modal-glass" onClick={e => e.stopPropagation()}>

                            {/* ── Glass Header ── */}
                            <div className="mgl-header">
                                <div className="mgl-header-left">
                                    <span className="mgl-badge">{currentTask ? '✏️ Edit Task' : '✨ New Task'}</span>
                                    <h2 className="mgl-title">
                                        {currentTask
                                            ? (currentTask.title.length > 42 ? currentTask.title.substring(0,42)+'…' : currentTask.title)
                                            : 'Create a New Task'}
                                    </h2>
                                </div>
                                <div className="mgl-header-right">
                                    {currentTask && (
                                        <span className={`mgl-status-tag mst-${currentTask.status.replace(/ /g,'-')}`}>{currentTask.status}</span>
                                    )}
                                    <button className="mgl-close" onClick={() => setIsModalOpen(false)}>
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* ── Tabs (edit mode) ── */}
                            {currentTask && (
                                <div className="mgl-tabs">
                                    {['Overview', 'Subtasks', 'Issues', 'Chat'].map(tab => (
                                        <button key={tab} className={`mgl-tab ${activeTab === tab ? 'active' : ''}`}
                                            onClick={e => { e.preventDefault(); setActiveTab(tab); }}>
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {message && <div className="mgl-error">{message}</div>}

                            <div className="mgl-body">
                                {/* ===== OVERVIEW TAB ===== */}
                                {activeTab === 'Overview' && (
                                    <form onSubmit={handleSubmit} className="mgl-form">
                                        {/* Hidden file input */}
                                        <input type="file" accept="image/*" ref={imageInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />

                                        {/* ── Title ── */}
                                        <div className="mgf-group">
                                            <label className="mgf-label">Task Title <span className="mgf-req">*</span></label>
                                            <input required className="mgf-input" type="text"
                                                placeholder="Enter a clear, descriptive title…"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                        </div>

                                        {/* ── Description + Image ── */}
                                        <div className="mgf-group">
                                            <div className="mgf-label-row">
                                                <label className="mgf-label">Description</label>
                                                <button type="button" className="mgf-img-btn" onClick={() => imageInputRef.current?.click()}>
                                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="2.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor"/><path d="M1 10L4.5 7.5L7 9.5L10 6.5L13 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                    Attach Image
                                                </button>
                                            </div>
                                            <textarea className="mgf-input mgf-textarea"
                                                placeholder="Describe the task, goals, and any relevant context…"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                            {formData.image_attachment && (
                                                <div className="mgf-img-preview">
                                                    <img src={formData.image_attachment} alt="Attachment" />
                                                    <button type="button" className="mgf-img-remove" onClick={() => setFormData(p => ({ ...p, image_attachment: null }))}>×</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Assignment panel ── */}
                                        <div className="mgf-panel">
                                            <div className="mgf-panel-hd">
                                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1.5 12.5c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                                Assignment
                                            </div>
                                            <div className="mgf-grid2">
                                                <div className="mgf-group mb0">
                                                    <label className="mgf-label-sm">Status</label>
                                                    <select className="mgf-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                                        {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                                {projects.length > 0 && (
                                                    <div className="mgf-group mb0">
                                                        <label className="mgf-label-sm">Project</label>
                                                        <select className="mgf-input" value={formData.project_id}
                                                            onChange={async e => {
                                                                const pid = e.target.value;
                                                                setFormData({ ...formData, project_id: pid });
                                                                if (pid) {
                                                                    try { const r = await axios.get(`/api/projects/${pid}/members`); setAssignableUsers(r.data); }
                                                                    catch (err) { console.error(err); }
                                                                } else fetchDropdownData();
                                                            }}>
                                                            <option value="">— No Project —</option>
                                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mgf-group mt-sm mb0">
                                                <label className="mgf-label-sm">Primary Assignee</label>
                                                <select className="mgf-input" value={formData.assigned_to} onChange={e => setFormData({ ...formData, assigned_to: e.target.value })}>
                                                    <option value="">— Unassigned —</option>
                                                    {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                                </select>
                                            </div>
                                            <div className="mgf-group mt-sm mb0">
                                                <label className="mgf-label-sm">Add Collaborators</label>
                                                <select className="mgf-input" value="" onChange={e => { addCoAssignee(e.target.value); e.target.value = ''; }}>
                                                    <option value="">Add collaborator…</option>
                                                    {assignableUsers.filter(u => !formData.co_assignees.includes(u.id) && String(u.id) !== String(formData.assigned_to))
                                                        .map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                                </select>
                                                {formData.co_assignees.length > 0 && (
                                                    <div className="mgf-assignee-chips">
                                                        {formData.co_assignees.map(uid => {
                                                            const u = assignableUsers.find(x => x.id === uid);
                                                            return u ? (
                                                                <div key={uid} className="mgf-a-chip">
                                                                    <div className="mgf-a-av">{u.username.charAt(0).toUpperCase()}</div>
                                                                    <span>{u.username}</span>
                                                                    <button type="button" className="mgf-a-rm" onClick={() => removeCoAssignee(uid)}>×</button>
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Deadline panel ── */}
                                        <div className="mgf-panel">
                                            <div className="mgf-panel-hd">
                                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><rect x="1" y="1.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4.5 1v2M9.5 1v2M1 5.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                                Deadline
                                            </div>
                                            <div className="mgf-grid2">
                                                <div className="mgf-group mb0">
                                                    <label className="mgf-label-sm">Date <span className="mgf-req">*</span></label>
                                                    <input className="mgf-input" type="date"
                                                        value={formData.deadline ? formData.deadline.substring(0, 10) : ''}
                                                        onChange={e => {
                                                            const d = e.target.value;
                                                            const t = deadlineTimeEnabled && formData.deadline ? formData.deadline.substring(11, 16) : '23:59';
                                                            setFormData({ ...formData, deadline: d ? `${d}T${t}` : '' });
                                                        }} />
                                                </div>
                                                <div className="mgf-group mb0">
                                                    <div className="mgf-label-row">
                                                        <label className="mgf-label-sm">Time</label>
                                                        <button type="button" className={`mgf-toggle ${deadlineTimeEnabled ? 'on' : ''}`}
                                                            onClick={() => setDeadlineTimeEnabled(v => !v)}>
                                                            {deadlineTimeEnabled ? 'On' : 'Optional'}
                                                        </button>
                                                    </div>
                                                    <input className={`mgf-input ${!deadlineTimeEnabled ? 'mgf-disabled' : ''}`} type="time"
                                                        disabled={!deadlineTimeEnabled}
                                                        value={deadlineTimeEnabled && formData.deadline ? formData.deadline.substring(11, 16) : ''}
                                                        onChange={e => {
                                                            const t = e.target.value;
                                                            const d = formData.deadline ? formData.deadline.substring(0, 10) : new Date().toISOString().substring(0, 10);
                                                            if (d) setFormData({ ...formData, deadline: `${d}T${t}` });
                                                        }} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Schedule panel (collapsible) ── */}
                                        <div className="mgf-panel mgf-panel-collapse">
                                            <div className="mgf-collapse-hd" onClick={() => setScheduleOpen(v => !v)}>
                                                <div className="mgf-panel-hd mb0">
                                                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                                    Start Schedule
                                                    <span className="mgf-opt-badge">Optional</span>
                                                </div>
                                                <svg className={`mgf-chev ${scheduleOpen ? 'open' : ''}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
                                                    <path d="M3 5l3.5 3.5L10 5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                            {scheduleOpen && (
                                                <div className="mgf-grid2 mt-sm">
                                                    <div className="mgf-group mb0">
                                                        <label className="mgf-label-sm">Start Date</label>
                                                        <input className="mgf-input" type="date"
                                                            value={formData.start_time ? formData.start_time.substring(0, 10) : ''}
                                                            onChange={e => { const d = e.target.value; setFormData({ ...formData, start_time: d ? `${d}T09:00` : '' }); }} />
                                                    </div>
                                                    <div className="mgf-group mb0">
                                                        <label className="mgf-label-sm">Start Time</label>
                                                        <input className="mgf-input" type="time"
                                                            value={formData.start_time ? formData.start_time.substring(11, 16) : ''}
                                                            onChange={e => {
                                                                const t = e.target.value;
                                                                const d = formData.start_time ? formData.start_time.substring(0, 10) : new Date().toISOString().substring(0, 10);
                                                                setFormData({ ...formData, start_time: t ? `${d}T${t}` : '' });
                                                            }} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Tags panel ── */}
                                        <div className="mgf-panel">
                                            <div className="mgf-panel-hd">
                                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5h5.5L13 7l-5.5 5.5-5.5-5.5V1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="5" cy="5" r="1" fill="currentColor"/></svg>
                                                Tags
                                            </div>
                                            <div className="mgf-tag-box" onClick={() => document.getElementById('mgfTagInput').focus()}>
                                                {formData.tags.map(t => (
                                                    <span key={t} className="mgf-tag-chip">
                                                        {t}
                                                        <button type="button" className="mgf-tag-rm" onClick={() => removeTag(t)}>×</button>
                                                    </span>
                                                ))}
                                                <input id="mgfTagInput" className="mgf-tag-input"
                                                    placeholder={formData.tags.length === 0 ? 'Type and press Enter to add tags…' : 'Add more…'}
                                                    value={tagInput}
                                                    onChange={e => setTagInput(e.target.value)}
                                                    onKeyDown={handleTagKeyDown} />
                                            </div>
                                        </div>

                                        {/* ── Daily task + Meta ── */}
                                        <div className="mgf-daily-row">
                                            <label className="mgf-daily-label">
                                                <input type="checkbox" id="is_daily_task"
                                                    checked={formData.is_daily_task}
                                                    onChange={e => setFormData({ ...formData, is_daily_task: e.target.checked })} />
                                                <span className="mgf-daily-icon">📅</span>
                                                <span>Daily Task</span>
                                                <span className="mgf-daily-hint">Repeats every day</span>
                                            </label>
                                        </div>

                                        {currentTask && (
                                            <div className="mgf-meta">
                                                <span>Created by <strong>{currentTask.created_by?.username}</strong></span>
                                                <span>{new Date(currentTask.created_on).toLocaleDateString()}</span>
                                            </div>
                                        )}

                                        {/* ── Footer ── */}
                                        <div className="mgf-footer">
                                            {user.role === 'manager' && currentTask && (
                                                <button type="button" onClick={handleDeleteTask} className="mgf-btn-danger">Delete Task</button>
                                            )}
                                            <div className="mgf-footer-right">
                                                <button type="button" onClick={() => setIsModalOpen(false)} className="mgf-btn-sec">Cancel</button>
                                                <button type="submit" className="mgf-btn-pri">
                                                    {currentTask ? 'Save Changes' : '✨ Create Task'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                )}

                                {/* ===== SUBTASKS TAB ===== */}
                                {activeTab === 'Subtasks' && (
                                    <div style={{ padding: '0.5rem 0' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                            <input
                                                type="text" id="newSubtaskInput" className="form-control"
                                                placeholder="Add a new checklist item..."
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(e.target.value); e.target.value = ''; } }}
                                            />
                                            <button className="btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => {
                                                const input = document.getElementById('newSubtaskInput');
                                                handleAddSubtask(input.value); input.value = '';
                                            }}>Add</button>
                                        </div>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {subtasks.length === 0 ? (
                                                <li style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>No subtasks yet.</li>
                                            ) : subtasks.map(st => (
                                                <li key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.8rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid rgba(99,102,241,0.1)' }}>
                                                    <input type="checkbox" checked={st.is_completed} onChange={(e) => handleToggleSubtask(st.id, e.target.checked)} style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer', accentColor: '#6366f1' }} />
                                                    <span style={{ textDecoration: st.is_completed ? 'line-through' : 'none', color: st.is_completed ? '#94a3b8' : '#0f172a', flex: 1, fontSize: '0.92rem', fontWeight: 600 }}>{st.title}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Done</button>
                                        </div>
                                    </div>
                                )}

                                {/* ===== ISSUES TAB ===== */}
                                {activeTab === 'Issues' && (
                                    <div style={{ padding: '0.5rem 0' }}>
                                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '14px', marginBottom: '1.5rem', border: '1.5px solid rgba(99,102,241,0.1)' }}>
                                            <h4 style={{ marginTop: 0, marginBottom: '0.7rem', fontSize: '0.88rem', color: '#4f46e5', fontWeight: 800, letterSpacing: '0.01em' }}>Raise New Issue</h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                <input type="text" id="issueTitle" className="form-control" placeholder="Issue Title *" />
                                                <textarea id="issueDesc" className="form-control" placeholder="Describe the issue..." rows="2" style={{ minHeight: '60px' }}></textarea>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>Target Resolution</label>
                                                        <input type="datetime-local" id="issueDeadline" className="form-control" />
                                                    </div>
                                                    <button className="btn-danger" style={{ whiteSpace: 'nowrap' }} onClick={(e) => {
                                                        e.preventDefault();
                                                        const title = document.getElementById('issueTitle').value;
                                                        const desc = document.getElementById('issueDesc').value;
                                                        const dl = document.getElementById('issueDeadline').value;
                                                        if (title.trim()) {
                                                            handleCreateIssue(title, desc, dl);
                                                            document.getElementById('issueTitle').value = '';
                                                            document.getElementById('issueDesc').value = '';
                                                            document.getElementById('issueDeadline').value = '';
                                                        } else { alert("Issue title is required"); }
                                                    }}>Raise Issue</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {issues.length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>No issues raised yet.</div>
                                            ) : issues.map(iss => (
                                                <div key={iss.id} style={{ border: `1.5px solid ${iss.is_resolved ? '#bbf7d0' : '#fecaca'}`, borderRadius: '14px', padding: '0.95rem 1.1rem', background: iss.is_resolved ? '#f0fdf4' : '#fef2f2' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                                                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.07em', background: iss.is_resolved ? '#dcfce7' : '#fee2e2', color: iss.is_resolved ? '#15803d' : '#991b1b', border: `1.5px solid ${iss.is_resolved ? '#bbf7d0' : '#fecaca'}` }}>
                                                                {iss.is_resolved ? 'RESOLVED' : 'OPEN'}
                                                            </span>
                                                            <strong style={{ fontSize: '0.96rem', color: '#0f172a', fontWeight: 800 }}>{iss.title}</strong>
                                                        </div>
                                                        {!iss.is_resolved && (
                                                            <button onClick={(e) => { e.preventDefault(); handleResolveIssue(iss.id); }} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.38rem 0.85rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, fontFamily: 'Outfit,sans-serif' }}>
                                                                Resolve
                                                            </button>
                                                        )}
                                                    </div>
                                                    {iss.description && <p style={{ margin: '0.4rem 0', color: '#475569', fontSize: '0.86rem', whiteSpace: 'pre-line' }}>{iss.description}</p>}
                                                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.6rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                                        <span>By: <strong style={{ color: '#475569' }}>{iss.created_by?.username}</strong></span>
                                                        <span>{new Date(iss.created_at).toLocaleDateString()}</span>
                                                        {iss.deadline && <span style={{ color: iss.is_resolved ? '#94a3b8' : '#dc2626', fontWeight: 700 }}>Due: {new Date(iss.deadline).toLocaleDateString()}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Done</button>
                                        </div>
                                    </div>
                                )}

                                {/* ===== CHAT TAB ===== */}
                                {activeTab === 'Chat' && (
                                    <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', height: '400px' }}>
                                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc', borderRadius: '14px', border: '1.5px solid rgba(99,102,241,0.1)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            {comments.length === 0 ? (
                                                <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', margin: 'auto' }}>No comments yet. Start the conversation!</div>
                                            ) : comments.map(comment => {
                                                const isMine = comment.user?.id === user.id;
                                                return (
                                                    <div key={comment.id} style={{
                                                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                                                        maxWidth: '78%',
                                                        background: isMine ? 'linear-gradient(135deg, #4f46e5, #818cf8)' : '#ffffff',
                                                        color: isMine ? 'white' : '#0f172a',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: isMine ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                                                        boxShadow: isMine ? '0 4px 16px rgba(99,102,241,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                                                        border: isMine ? 'none' : '1.5px solid rgba(0,0,0,0.06)'
                                                    }}>
                                                        {!isMine && (
                                                            <div style={{ fontSize: '0.73rem', fontWeight: 800, color: '#6366f1', marginBottom: '0.22rem' }}>
                                                                {comment.user?.username} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({comment.user?.role})</span>
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', fontWeight: 500 }}>{comment.content}</div>
                                                        <div style={{ fontSize: '0.65rem', color: isMine ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: '0.28rem', textAlign: 'right' }}>
                                                            {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <textarea
                                                id="chatInput" className="form-control"
                                                placeholder="Type a message..." rows="2"
                                                style={{ resize: 'none', minHeight: 'auto' }}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('sendChatBtn').click(); } }}
                                            ></textarea>
                                            <button id="sendChatBtn" className="btn-primary" style={{ padding: '0 1.2rem', whiteSpace: 'nowrap' }} onClick={(e) => {
                                                e.preventDefault();
                                                const input = document.getElementById('chatInput');
                                                handleSendMessage(input.value); input.value = '';
                                            }}>Send</button>
                                        </div>
                                    </div>
                                )}
                            </div>{/* mgl-body */}
                        </div>{/* modal-glass */}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Tasks;
