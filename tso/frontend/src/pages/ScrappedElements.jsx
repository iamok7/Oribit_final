import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ScrappedElements = () => {
    const [scrapped, setScrapped] = useState({ departments: [], projects: [], tasks: [] });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('departments');
    const [status, setStatus] = useState({ type: '', message: '' });

    const fetchScrapped = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/scrapped');
            setScrapped(res.data);
        } catch (error) {
            console.error("Error fetching scrapped elements", error);
            setStatus({ type: 'error', message: 'Failed to load scrapped items.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScrapped();
    }, []);

    const handleRecover = async (type, id) => {
        try {
            await axios.put(`/api/recover/${type}/${id}`);
            setStatus({ type: 'success', message: `${type.slice(0, -1)} recovered successfully.` });
            fetchScrapped();
        } catch (error) {
            console.error(`Error recovering ${type}`, error);
            setStatus({ type: 'error', message: `Failed to recover ${type.slice(0, -1)}.` });
        }
    };

    const styles = {
        container: { maxWidth: '1000px', margin: '0 auto' },
        tabs: { display: 'flex', gap: '1rem', borderBottom: '1px solid #ccc', marginBottom: '1.5rem', marginTop: '1rem' },
        tab: (isActive) => ({
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            borderBottom: isActive ? '3px solid #1a1a1a' : '3px solid transparent',
            fontWeight: isActive ? 'bold' : 'normal',
            color: isActive ? '#1a1a1a' : '#666'
        }),
        card: { background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        btnRecover: { background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
        alert: (type) => ({
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            backgroundColor: type === 'error' ? '#fee2e2' : '#dcfce7',
            color: type === 'error' ? '#991b1b' : '#166534',
        })
    };

    return (
        <div style={styles.container}>
            <h1>Scrapped Elements</h1>
            <p>Here you can view and recover deleted departments, projects, and tasks. Deleted departments cascade deletions to their projects. Recovering a project will also recover its parent department if it was deleted.</p>

            {status.message && (
                <div style={styles.alert(status.type)}>
                    {status.message}
                </div>
            )}

            <div style={styles.tabs}>
                <div style={styles.tab(activeTab === 'departments')} onClick={() => setActiveTab('departments')}>
                    Departments ({scrapped.departments.length})
                </div>
                <div style={styles.tab(activeTab === 'projects')} onClick={() => setActiveTab('projects')}>
                    Projects ({scrapped.projects.length})
                </div>
                <div style={styles.tab(activeTab === 'tasks')} onClick={() => setActiveTab('tasks')}>
                    Tasks ({scrapped.tasks.length})
                </div>
            </div>

            {loading ? (
                <p>Loading scrapped elements...</p>
            ) : (
                <div>
                    {activeTab === 'departments' && (
                        scrapped.departments.length === 0 ? <p>No scrapped departments.</p> :
                            scrapped.departments.map(dept => (
                                <div key={dept.id} style={styles.card}>
                                    <div>
                                        <h3>{dept.name}</h3>
                                        <p style={{ color: '#666', fontSize: '0.9rem' }}>ID: {dept.id}</p>
                                    </div>
                                    <button style={styles.btnRecover} onClick={() => handleRecover('departments', dept.id)}>Recover Department</button>
                                </div>
                            ))
                    )}

                    {activeTab === 'projects' && (
                        scrapped.projects.length === 0 ? <p>No scrapped projects.</p> :
                            scrapped.projects.map(proj => (
                                <div key={proj.id} style={styles.card}>
                                    <div>
                                        <h3>{proj.name}</h3>
                                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Project ID: {proj.id} | Department ID: {proj.department_id}</p>
                                    </div>
                                    <button style={styles.btnRecover} onClick={() => handleRecover('projects', proj.id)}>Recover Project</button>
                                </div>
                            ))
                    )}

                    {activeTab === 'tasks' && (
                        scrapped.tasks.length === 0 ? <p>No scrapped tasks.</p> :
                            scrapped.tasks.map(task => (
                                <div key={task.id} style={styles.card}>
                                    <div>
                                        <h3>{task.title}</h3>
                                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Task ID: {task.id} | Project ID: {task.project_id || 'Standalone'}</p>
                                    </div>
                                    <button style={styles.btnRecover} onClick={() => handleRecover('tasks', task.id)}>Recover Task</button>
                                </div>
                            ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ScrappedElements;
