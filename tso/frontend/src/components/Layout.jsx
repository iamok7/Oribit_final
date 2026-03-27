import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

// Liquid Theme Standardized Icons (strokeWidth="2.2" for bolder presence)
const DashboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>
);

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const TasksIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);

const LogoutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
);

const KanbanIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
);

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
);

const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

const PlannerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);

const ExpenseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);

const Layout = ({ children, role }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user')) || { username: 'Guest', role: 'guest' };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    const isActive = (path) => location.pathname === path;

    // Define navigation items based on role
    const getNavItems = () => {
        const common = [
            { name: 'Task Board', path: '/tasks', icon: <KanbanIcon /> },
            { name: 'Calendar', path: '/calendar', icon: <CalendarIcon /> },
        ];

        if (role === 'finance') {
            return [
                { name: 'Dashboard', path: '/finance', icon: <DashboardIcon /> },
                { name: 'Raised Expenses', path: '/finance/raised', icon: <ExpenseIcon /> },
                { name: 'Approved Expenses', path: '/finance/approved', icon: <TasksIcon /> },
                { name: 'Rejected Expenses', path: '/finance/rejected', icon: <MenuIcon /> },
                { name: 'Total Spendings', path: '/finance/spendings', icon: <ExpenseIcon /> },
            ];
        } else if (role === 'manager') {
            return [
                { name: 'Dashboard', path: '/manager', icon: <DashboardIcon /> },
                ...common,
                { name: 'Employees', path: '/manager/users', icon: <UsersIcon /> },
                { name: 'Departments', path: '/manager/departments', icon: <TasksIcon /> }, 
                { name: 'Daily Planner', path: '/daily-planner', icon: <PlannerIcon /> },
                { name: 'Expenses', path: '/expenses', icon: <ExpenseIcon /> },
                { name: 'Scrapped Elements', path: '/manager/scrapped', icon: <KanbanIcon /> },
            ];
        } else if (role === 'supervisor') {
            return [
                { name: 'Dashboard', path: '/supervisor', icon: <DashboardIcon /> },
                ...common,
                { name: 'My Team', path: '/supervisor/team', icon: <UsersIcon /> },
                { name: 'Daily Planner', path: '/daily-planner', icon: <PlannerIcon /> },
                { name: 'Expenses', path: '/expenses', icon: <ExpenseIcon /> },
            ];
        } else {
            return [
                { name: 'Dashboard', path: '/employee', icon: <DashboardIcon /> },
                ...common,
                { name: 'Expenses', path: '/expenses', icon: <ExpenseIcon /> },
            ];
        }
    };

    const navItems = getNavItems();

    return (
        <div className="dashboard-container">
            {/* Mobile Toggle */}
            <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <MenuIcon />
            </button>

            {/* Sidebar Overlay */}
            <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <span>TaskOrbit</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <div className="nav-section-title">Main Menu</div>
                        {navItems.map((item, index) => (
                            <a
                                key={index}
                                href="#"
                                onClick={(e) => { e.preventDefault(); navigate(item.path); setSidebarOpen(false); }}
                                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                {item.name}
                            </a>
                        ))}
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile">
                        <div className="user-avatar">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{user.username}</div>
                            <div className="user-role">{role}</div>
                        </div>
                    </div>
                    <button className="btn-logout" onClick={handleLogout}>
                        <LogoutIcon /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default Layout;