import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import './Departments.css';

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState({});

    // UI State
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Row expansion state
    const [expandedDeptId, setExpandedDeptId] = useState(null);
    const [activeTab, setActiveTab] = useState('projects');

    // Modals & Form State
    const [isCreateDeptModalOpen, setIsCreateDeptModalOpen] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');

    const [isCreateProjModalOpen, setIsCreateProjModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [activeManageProjectId, setActiveManageProjectId] = useState(null);

    const [projAssignmentData, setProjAssignmentData] = useState({ lead_id: '', member_ids: [] });
    const [assignmentData, setAssignmentData] = useState({ supervisor_id: '', employee_ids: [] });

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, []);

    const fetchData = async () => {
        setIsFetching(true);
        try {
            const deptsRes = await axios.get('/api/departments');
            setDepartments(deptsRes.data);

            const projectsMap = {};
            for (let dept of deptsRes.data) {
                try {
                    const projRes = await axios.get(`/api/departments/${dept.id}/projects`);
                    projectsMap[dept.id] = projRes.data;
                } catch (err) {
                    console.error("Error fetching projects for dept", dept.id);
                }
            }
            setProjects(projectsMap);

            const supsRes = await axios.get('/api/users?role=supervisor&unassigned_only=true');
            setSupervisors(supsRes.data);

            const empsRes = await axios.get('/api/users?role=employee&unassigned_only=true');
            setEmployees(empsRes.data);
        } catch (error) {
            console.error("Error fetching data", error);
            setStatus({ type: 'error', message: 'Failed to load department data.' });
        } finally {
            setIsFetching(false);
        }
    };

    const handleRowClick = (dept) => {
        if (expandedDeptId === dept.id) {
            setExpandedDeptId(null);
            return;
        }
        setExpandedDeptId(dept.id);
        setActiveTab('projects');
        setAssignmentData({
            supervisor_id: dept.supervisor?.id || '',
            employee_ids: dept.employees.map(e => String(e.id)),
            _showAddPanel: false,
            _newSupervisorId: '',
            _newEmployeeIds: []
        });
        setStatus({ type: '', message: '' });
    };

    // --- Department Methods ---
    const handleCreateDepartment = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });
        setIsLoading(true);

        try {
            await axios.post('/api/departments', { name: newDeptName });
            setStatus({ type: 'success', message: 'Department created successfully' });
            setNewDeptName('');
            fetchData();
            setTimeout(() => {
                setIsCreateDeptModalOpen(false);
                setStatus({ type: '', message: '' });
            }, 1000);
        } catch (error) {
            setStatus({ type: 'error', message: error.response?.data?.message || 'Failed to create.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDepartment = async (deptId) => {
        if (!window.confirm("Are you sure you want to delete this department? All its projects and tasks will also be removed.")) return;
        try {
            await axios.delete(`/api/departments/${deptId}`);
            setExpandedDeptId(null);
            fetchData();
        } catch (error) {
            alert('Failed to delete department.');
        }
    };

    const handleAssignFormChange = (e) => {
        const { name, value, type, selectedOptions } = e.target;
        if (type === 'select-multiple') {
            const values = Array.from(selectedOptions, option => option.value);
            setAssignmentData(prev => ({ ...prev, [name]: values }));
        } else {
            setAssignmentData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAssignMembers = async (deptId) => {
        try {
            const dept = departments.find(d => d.id === deptId);
            const currentSupId = dept?.supervisor?.id || null;
            const newSupId = assignmentData._newSupervisorId;
            const finalSupId = newSupId !== '' ? newSupId : currentSupId;

            const existingEmpIds = dept ? dept.employees.map(e => String(e.id)) : [];
            const combinedEmpIds = [...new Set([...existingEmpIds, ...(assignmentData._newEmployeeIds || [])])];

            await axios.put(`/api/departments/${deptId}/assign`, {
                supervisor_id: finalSupId,
                employee_ids: combinedEmpIds
            });
            fetchData();
            setAssignmentData(prev => ({ ...prev, _showAddPanel: false, _newSupervisorId: '', _newEmployeeIds: [] }));
            alert("Department assignments updated.");
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to assign members.');
        }
    };

    const handleRemoveDeptMember = async (deptId, userId) => {
        if (!window.confirm("Remove this member from the department?")) return;
        try {
            await axios.delete(`/api/departments/${deptId}/members/${userId}`);
            fetchData();
        } catch (error) {
            alert('Failed to remove member.');
        }
    };

    // --- Project Methods ---
    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newProjectName || !expandedDeptId) return;
        setIsLoading(true);
        setStatus({ type: '', message: '' });
        try {
            await axios.post(`/api/departments/${expandedDeptId}/projects`, { name: newProjectName });
            setStatus({ type: 'success', message: 'Project created successfully' });
            setNewProjectName('');
            fetchData();
            setTimeout(() => {
                setIsCreateProjModalOpen(false);
                setStatus({ type: '', message: '' });
            }, 1000);
        } catch (error) {
            setStatus({ type: 'error', message: error.response?.data?.message || 'Failed to create.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteProject = async (projId) => {
        if (!window.confirm("Are you sure you want to delete this project? All associated tasks will be removed.")) return;
        try {
            await axios.delete(`/api/projects/${projId}`);
            setActiveManageProjectId(null);
            fetchData();
        } catch (error) {
            alert('Failed to delete project.');
        }
    };

    const handleProjAssignChange = (e) => {
        const { name, value, type, selectedOptions } = e.target;
        if (type === 'select-multiple') {
            const values = Array.from(selectedOptions, option => option.value);
            setProjAssignmentData(prev => ({ ...prev, [name]: values }));
        } else {
            setProjAssignmentData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAssignProjectMembers = async (projId) => {
        try {
            // Combine existing member IDs with newly selected ones
            const proj = projects[expandedDeptId]?.find(p => p.id === projId);
            const existingMemberIds = proj ? proj.members.map(m => String(m.id)) : [];
            const combinedMemberIds = [...new Set([...existingMemberIds, ...(projAssignmentData._newMemberIds || [])])];

            // If user explicitly interacted with the dropdown, it will be in projAssignmentData, otherwise maintain existing
            let finalLeadId;
            if (projAssignmentData.lead_id !== undefined && projAssignmentData.lead_id !== (proj?.lead?.id || '')) {
                finalLeadId = projAssignmentData.lead_id; // They changed it (could be '' for No Lead)
            } else {
                finalLeadId = proj?.lead?.id || null; // Unchanged
            }

            await axios.put(`/api/projects/${projId}/assign`, {
                lead_id: finalLeadId === '' ? null : finalLeadId,
                member_ids: combinedMemberIds
            });
            setActiveManageProjectId(null);
            setProjAssignmentData({ lead_id: '', member_ids: [], _newMemberIds: [] });
            fetchData();
            alert("Project team updated.");
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to assign project team.');
        }
    };

    const handleRemoveProjMember = async (projId, userId) => {
        if (!window.confirm("Remove this member from the project?")) return;
        try {
            await axios.delete(`/api/projects/${projId}/members/${userId}`);
            fetchData();
        } catch (error) {
            alert('Failed to remove member.');
        }
    };

    return (
        <Layout role="manager">
            <div className="depts-page">
                {/* Floating gradient orbs */}
                <div className="depts-orb depts-orb--1"></div>
                <div className="depts-orb depts-orb--2"></div>
                <div className="depts-orb depts-orb--3"></div>

                {/* Page header */}
                <div className="depts-header">
                    <div>
                        <h1 className="depts-title">Departments</h1>
                        <p className="depts-subtitle">Manage organizational structure and project allocation</p>
                    </div>
                    <button className="depts-btn-add" onClick={() => setIsCreateDeptModalOpen(true)}>
                        + Add Department
                    </button>
                </div>

                {/* Main table glass card */}
                <div className="depts-glass-card">
                    {isFetching ? (
                        <div className="depts-loading">Loading groups...</div>
                    ) : (
                        <table className="depts-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Department Name</th>
                                    <th>Supervisor</th>
                                    <th>Projects</th>
                                    <th>Staff</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.map(dept => (
                                    <React.Fragment key={dept.id}>
                                        <tr
                                            className={`depts-table-row ${expandedDeptId === dept.id ? 'depts-table-row--expanded' : ''}`}
                                            onClick={() => handleRowClick(dept)}
                                        >
                                            <td className="depts-cell-id">#{dept.id}</td>
                                            <td className="depts-cell-name">{dept.name}</td>
                                            <td>
                                                {dept.supervisor ? (
                                                    <span className="depts-badge depts-badge--blue">
                                                        👑 {dept.supervisor.username}
                                                    </span>
                                                ) : (
                                                    <span className="depts-badge depts-badge--gray">Unassigned</span>
                                                )}
                                            </td>
                                            <td>{projects[dept.id]?.length || 0} active</td>
                                            <td>{dept.employees.length} members</td>
                                            <td className="depts-cell-expand">
                                                <span className={`depts-chevron ${expandedDeptId === dept.id ? 'depts-chevron--open' : ''}`}>
                                                    ▼
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Expanded Details Row */}
                                        {expandedDeptId === dept.id && (
                                            <tr>
                                                <td colSpan="6" className="depts-expand-cell">
                                                    <div className="depts-expand-panel">

                                                        <div className="depts-panel-header">
                                                            <div className="depts-tabs">
                                                                <button className={`depts-tab ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
                                                                    Active Projects
                                                                </button>
                                                                <button className={`depts-tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                                                                    Team & Settings
                                                                </button>
                                                            </div>
                                                            {activeTab === 'projects' && (
                                                                <button className="depts-btn-add" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsCreateProjModalOpen(true)}>
                                                                    + New Project
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="depts-tab-content">
                                                            {/* PROJECTS TAB */}
                                                            {activeTab === 'projects' && (
                                                                <div className="depts-projects-grid">
                                                                    {(!projects[dept.id] || projects[dept.id].length === 0) ? (
                                                                        <div className="depts-empty">No active projects found. Create one.</div>
                                                                    ) : (
                                                                        projects[dept.id].map(proj => (
                                                                            <div key={proj.id} className="depts-project-card" onClick={() => {
                                                                                setActiveManageProjectId(proj.id);
                                                                                setProjAssignmentData({
                                                                                    lead_id: proj.lead?.id || '',
                                                                                    member_ids: proj.members.map(m => String(m.id)),
                                                                                    _newMemberIds: []
                                                                                });
                                                                            }}>
                                                                                <h4 className="depts-project-title">{proj.name}</h4>
                                                                                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                                                                                    Lead: {proj.lead ? proj.lead.username : 'Unassigned'}
                                                                                </p>
                                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                                    {proj.members.slice(0, 3).map(m => (
                                                                                        <div key={m.id} className="depts-avatar" style={{ width: '30px', height: '30px', fontSize: '0.8rem' }} title={m.username}>
                                                                                            {m.username.charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                    ))}
                                                                                    {proj.members.length > 3 && (
                                                                                        <div className="depts-avatar manager" style={{ width: '30px', height: '30px', fontSize: '0.8rem' }}>
                                                                                            +{proj.members.length - 3}
                                                                                        </div>
                                                                                    )}
                                                                                    {proj.members.length === 0 && <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No members</span>}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* SETTINGS TAB */}
                                                            {activeTab === 'settings' && (
                                                                <div className="depts-form-row">
                                                                    {/* Left Col: Roster */}
                                                                    <div>
                                                                        <h4 className="depts-panel-title" style={{ marginBottom: '1rem', fontSize: '1rem' }}>Current Roster</h4>
                                                                        <div className="depts-roster-list" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                                                            {dept.supervisor && (
                                                                                <div className="depts-roster-item" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                                                                    <div className="depts-roster-info">
                                                                                        <div className="depts-avatar manager">{dept.supervisor.username.charAt(0).toUpperCase()}</div>
                                                                                        <div>
                                                                                            <p className="depts-roster-name">{dept.supervisor.username}</p>
                                                                                            <p className="depts-roster-role">Supervisor</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <button className="depts-remove-btn" onClick={() => handleRemoveDeptMember(dept.id, dept.supervisor.id)}>&times;</button>
                                                                                </div>
                                                                            )}
                                                                            {dept.employees.map(e => (
                                                                                <div key={e.id} className="depts-roster-item" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                                                                                    <div className="depts-roster-info">
                                                                                        <div className="depts-avatar">{e.username.charAt(0).toUpperCase()}</div>
                                                                                        <div>
                                                                                            <p className="depts-roster-name">{e.username}</p>
                                                                                            <p className="depts-roster-role">Employee</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <button className="depts-remove-btn" onClick={() => handleRemoveDeptMember(dept.id, e.id)}>&times;</button>
                                                                                </div>
                                                                            ))}
                                                                            {(!dept.supervisor && dept.employees.length === 0) && (
                                                                                <div className="depts-empty" style={{ padding: '2rem' }}>No active personnel in this department.</div>
                                                                            )}
                                                                        </div>

                                                                        <div style={{ marginTop: '1rem' }}>
                                                                            <button
                                                                                className="depts-add-member-btn"
                                                                                onClick={() => setAssignmentData(prev => ({ ...prev, _showAddPanel: !prev._showAddPanel }))}
                                                                            >
                                                                                {assignmentData._showAddPanel ? '✕ Close Checklists' : '+ Add Members'}
                                                                            </button>
                                                                        </div>

                                                                        {assignmentData._showAddPanel && (
                                                                            <div className="depts-add-members-panel">
                                                                                <p className="depts-add-members-title">Select unassigned personnel to add to the department:</p>
                                                                                <div className="depts-add-members-list">
                                                                                    {supervisors.map(person => {
                                                                                        const val = String(person.id);
                                                                                        const isSelected = assignmentData._newSupervisorId === val;
                                                                                        return (
                                                                                            <label key={`sup-${person.id}`} className={`depts-checklist-item ${isSelected ? 'selected' : ''}`}>
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    className="depts-checkbox"
                                                                                                    checked={isSelected}
                                                                                                    onChange={() => {
                                                                                                        setAssignmentData(prev => ({
                                                                                                            ...prev,
                                                                                                            _newSupervisorId: isSelected ? '' : val
                                                                                                        }));
                                                                                                    }}
                                                                                                />
                                                                                                <div className="depts-avatar manager" style={{ width: '32px', height: '32px', fontSize: '0.85rem', flexShrink: 0 }}>
                                                                                                    {person.username.charAt(0).toUpperCase()}
                                                                                                </div>
                                                                                                <div style={{ flex: 1 }}>
                                                                                                    <span className="depts-checklist-name">{person.username}</span>
                                                                                                    <span className="depts-checklist-role">Supervisor</span>
                                                                                                </div>
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                    {employees.map(person => {
                                                                                        const val = String(person.id);
                                                                                        const isSelected = (assignmentData._newEmployeeIds || []).includes(val);
                                                                                        return (
                                                                                            <label key={`emp-${person.id}`} className={`depts-checklist-item ${isSelected ? 'selected' : ''}`}>
                                                                                                <input
                                                                                                    type="checkbox"
                                                                                                    className="depts-checkbox"
                                                                                                    checked={isSelected}
                                                                                                    onChange={() => {
                                                                                                        setAssignmentData(prev => ({
                                                                                                            ...prev,
                                                                                                            _newEmployeeIds: isSelected
                                                                                                                ? (prev._newEmployeeIds || []).filter(id => id !== val)
                                                                                                                : [...(prev._newEmployeeIds || []), val]
                                                                                                        }));
                                                                                                    }}
                                                                                                />
                                                                                                <div className="depts-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem', flexShrink: 0 }}>
                                                                                                    {person.username.charAt(0).toUpperCase()}
                                                                                                </div>
                                                                                                <div style={{ flex: 1 }}>
                                                                                                    <span className="depts-checklist-name">{person.username}</span>
                                                                                                    <span className="depts-checklist-role">Employee</span>
                                                                                                </div>
                                                                                            </label>
                                                                                        );
                                                                                    })}
                                                                                    {(supervisors.length === 0 && employees.length === 0) && (
                                                                                        <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>Nobody is available to be added.</div>
                                                                                    )}
                                                                                </div>
                                                                                {((assignmentData._newEmployeeIds || []).length > 0 || assignmentData._newSupervisorId !== '') && (
                                                                                    <button
                                                                                        className="depts-btn-submit"
                                                                                        style={{ marginTop: '1rem' }}
                                                                                        onClick={() => handleAssignMembers(dept.id)}
                                                                                    >
                                                                                        Update Department Roster
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Right Col: Forms */}
                                                                    <div>
                                                                        <h4 className="depts-panel-title" style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#dc2626' }}>Danger Zone</h4>
                                                                        <button className="depts-btn-danger large" onClick={() => handleDeleteDepartment(dept.id)}>
                                                                            Permanently Delete Department
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                                {departments.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="depts-empty">No departments created yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* MODALS */}
                {/* Create Department Modal */}
                {isCreateDeptModalOpen && (
                    <div className="depts-modal-overlay">
                        <div className="depts-modal">
                            <div className="depts-modal-header">
                                <h3 className="depts-modal-title">New Department</h3>
                                <button className="depts-modal-close" onClick={() => setIsCreateDeptModalOpen(false)}>&times;</button>
                            </div>

                            {status.message && (
                                <div className={`depts-status ${status.type === 'success' ? 'depts-status--success' : 'depts-status--error'}`}>
                                    {status.message}
                                </div>
                            )}

                            <form onSubmit={handleCreateDepartment}>
                                <div className="depts-form-group">
                                    <label className="depts-label">Department Name</label>
                                    <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} required placeholder="e.g. Engineering" className="depts-input" />
                                </div>
                                <button type="submit" disabled={isLoading} className="depts-btn-submit">
                                    {isLoading ? 'Processing...' : 'Build Department'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Create Project Modal */}
                {isCreateProjModalOpen && expandedDeptId && (
                    <div className="depts-modal-overlay">
                        <div className="depts-modal">
                            <div className="depts-modal-header">
                                <h3 className="depts-modal-title">New Project</h3>
                                <button className="depts-modal-close" onClick={() => setIsCreateProjModalOpen(false)}>&times;</button>
                            </div>

                            {status.message && (
                                <div className={`depts-status ${status.type === 'success' ? 'depts-status--success' : 'depts-status--error'}`}>
                                    {status.message}
                                </div>
                            )}

                            <form onSubmit={handleCreateProject}>
                                <div className="depts-form-group">
                                    <label className="depts-label">Project Name</label>
                                    <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} required placeholder="e.g. Server Migration" className="depts-input" />
                                </div>
                                <button type="submit" disabled={isLoading} className="depts-btn-submit">
                                    {isLoading ? 'Processing...' : 'Create Project'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Manage Project Modal */}
                {activeManageProjectId && expandedDeptId && (() => {
                    const proj = projects[expandedDeptId]?.find(p => p.id === activeManageProjectId);
                    const currentDept = departments.find(d => d.id === expandedDeptId);
                    if (!proj || !currentDept) return null;

                    // All dept members available to add
                    const allDeptMembers = [
                        ...(currentDept.supervisor ? [{ ...currentDept.supervisor, roleLabel: 'Supervisor' }] : []),
                        ...currentDept.employees.map(e => ({ ...e, roleLabel: 'Employee' }))
                    ];

                    return (
                        <div className="depts-modal-overlay">
                            <div className="depts-modal large" style={{ maxWidth: '520px' }}>
                                <div className="depts-modal-header">
                                    <div>
                                        <h3 className="depts-modal-title">{proj.name}</h3>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Project Management</p>
                                    </div>
                                    <button className="depts-modal-close" onClick={() => { setActiveManageProjectId(null); setProjAssignmentData({ lead_id: '', member_ids: [] }); }}>&times;</button>
                                </div>

                                {/* Project Lead Selector - only project members can be lead */}
                                <div className="depts-form-group">
                                    <label className="depts-label">Project Lead</label>
                                    <select name="lead_id" value={projAssignmentData.lead_id} onChange={handleProjAssignChange} className="depts-select">
                                        <option value="">-- No Lead --</option>
                                        {proj.members.map(m => (
                                            <option key={`lead-${m.id}`} value={m.id}>{m.username}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Current Roster */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <label className="depts-label" style={{ margin: 0 }}>Team Members ({proj.members.length})</label>
                                        <button
                                            className="depts-add-member-btn"
                                            onClick={() => setProjAssignmentData(prev => ({ ...prev, _showAddPanel: !prev._showAddPanel }))}
                                        >
                                            {projAssignmentData._showAddPanel ? '✕ Close' : '+ Add Members'}
                                        </button>
                                    </div>

                                    {/* Current Members */}
                                    <div className="depts-roster-list">
                                        {proj.members.map(m => (
                                            <div key={m.id} className="depts-roster-item" style={{ background: proj.lead?.id === m.id ? '#f8fafc' : '#ffffff', border: '1px solid #e2e8f0' }}>
                                                <div className="depts-roster-info">
                                                    <div className={`depts-avatar ${proj.lead?.id === m.id ? 'manager' : ''}`}>{m.username.charAt(0).toUpperCase()}</div>
                                                    <div>
                                                        <p className="depts-roster-name">{m.username}</p>
                                                        <p className="depts-roster-role">{proj.lead?.id === m.id ? 'Project Lead' : 'Member'}</p>
                                                    </div>
                                                </div>
                                                <button className="depts-remove-btn" onClick={() => handleRemoveProjMember(proj.id, m.id)}>&times;</button>
                                            </div>
                                        ))}
                                        {(!proj.lead && proj.members.length === 0) && (
                                            <div className="depts-empty" style={{ padding: '1.5rem', fontSize: '0.9rem' }}>No team members yet. Click "+ Add Members" to get started.</div>
                                        )}
                                    </div>
                                    {((projAssignmentData._newMemberIds || []).length > 0 || String(projAssignmentData.lead_id) !== String(proj.lead?.id || '')) && (
                                        <button
                                            className="depts-btn-submit"
                                            style={{ marginTop: '1rem' }}
                                            onClick={() => handleAssignProjectMembers(proj.id)}
                                        >
                                            Update Project Team
                                        </button>
                                    )}

                                    {/* Expandable Add Members Panel */}
                                    {projAssignmentData._showAddPanel && (
                                        <div className="depts-add-members-panel">
                                            <p className="depts-add-members-hint">Select members from this department to add to the project:</p>
                                            <div className="depts-checklist">
                                                {allDeptMembers.length === 0 && (
                                                    <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>No department members available.</div>
                                                )}
                                                {allDeptMembers.map(person => {
                                                    const val = String(person.id);
                                                    const isNewlySelected = (projAssignmentData._newMemberIds || []).includes(val);
                                                    const alreadyInProject = (proj.lead?.id === person.id) || proj.members.some(m => m.id === person.id);
                                                    return (
                                                        <label
                                                            key={person.id}
                                                            className={`depts-checklist-item ${isNewlySelected ? 'selected' : ''} ${alreadyInProject ? 'already-added' : ''}`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="depts-checkbox"
                                                                checked={isNewlySelected || alreadyInProject}
                                                                disabled={alreadyInProject}
                                                                onChange={() => {
                                                                    if (alreadyInProject) return;
                                                                    setProjAssignmentData(prev => ({
                                                                        ...prev,
                                                                        _newMemberIds: isNewlySelected
                                                                            ? (prev._newMemberIds || []).filter(id => id !== val)
                                                                            : [...(prev._newMemberIds || []), val]
                                                                    }));
                                                                }}
                                                            />
                                                            <div className="depts-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem', flexShrink: 0 }}>
                                                                {person.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <span className="depts-checklist-name">{person.username}</span>
                                                                <span className="depts-checklist-role">{person.roleLabel}</span>
                                                            </div>
                                                            {alreadyInProject && <span className="depts-already-tag">In Project</span>}
                                                        </label>
                                                    );
                                                })}
                                            </div>

                                        </div>
                                    )}
                                </div>

                                <hr style={{ margin: '2rem 0', borderColor: 'rgba(0,0,0,0.05)' }} />

                                <h4 className="depts-panel-title" style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#dc2626' }}>Danger Zone</h4>
                                <button className="depts-btn-danger large" onClick={() => handleDeleteProject(proj.id)}>
                                    Permanently Delete Project
                                </button>
                            </div>
                        </div>
                    );
                })()}

            </div>
        </Layout>
    );
};

export default Departments;
