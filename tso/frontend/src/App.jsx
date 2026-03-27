import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import { ManagerDashboard, SupervisorDashboard, EmployeeDashboard } from './pages/Dashboards';
import Users from './pages/Users';
import Departments from './pages/Departments';
import Tasks from './pages/Tasks';
import ScrappedElements from './pages/ScrappedElements';
import CalendarView from './pages/CalendarView';
import DailyPlanner from './pages/DailyPlanner';
import Expenses from './pages/Expenses';
import FinanceDashboard from './pages/FinanceDashboard';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/manager" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/manager/users" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="/manager/departments" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <Departments />
          </ProtectedRoute>
        } />
        <Route path="/manager/scrapped" element={
          <ProtectedRoute allowedRoles={['manager']}>
            <ScrappedElements />
          </ProtectedRoute>
        } />
        <Route path="/supervisor" element={
          <ProtectedRoute allowedRoles={['supervisor']}>
            <SupervisorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/daily-planner" element={
          <ProtectedRoute allowedRoles={['manager', 'supervisor', 'employee']}>
            {/* Note: 'employee' included because Team Leads need access. DailyPlanner has its own internal check to only show team members they lead. */}
            <DailyPlanner />
          </ProtectedRoute>
        } />
        <Route path="/employee" element={
          <ProtectedRoute allowedRoles={['employee']}>
            <EmployeeDashboard />
          </ProtectedRoute>
        } />
        <Route path="/finance/*" element={
          <ProtectedRoute allowedRoles={['finance']}>
            <FinanceDashboard />
          </ProtectedRoute>
        } />
        <Route path="/expenses" element={
          <ProtectedRoute allowedRoles={['manager', 'supervisor', 'employee']}>
            <Expenses />
          </ProtectedRoute>
        } />
        {/* Tasks are specific to a user but the board is shared functionally */}
        <Route path="/tasks" element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <CalendarView />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
