import AsyncStorage from '@react-native-async-storage/async-storage';

// PROD backend
const BASE_URL = 'https://taskorbit.nexvitech.in';

const getHeaders = async () => {
  const token = await AsyncStorage.getItem('tso_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getCurrentUser = async () => {
  const storedUser = await AsyncStorage.getItem('tso_user');
  return storedUser ? JSON.parse(storedUser) : null;
};

const handleResponse = async (response) => {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
  return data;
};

const request = async (method, path, body = null, timeoutMs = 10000) => {
  const headers = await getHeaders();
  const config = {
    method,
    headers,
    credentials: 'include',
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...config, signal: controller.signal });
    return handleResponse(response);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — check server connection');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

// Auth
export const loginAPI = async (username, password) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    return handleResponse(response);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Server unreachable — check backend is running');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export const logoutAPI = async () => {
  return request('POST', '/auth/logout');
};

export const signupAPI = async (data) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    return handleResponse(response);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Server unreachable — check backend is running');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export const deleteAccountAPI = async (userId, confirmation) => {
  return request('DELETE', '/auth/delete_account', { user_id: userId, confirmation });
};

export const validateCompanyCodeAPI = async (code) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${BASE_URL}/auth/validate_company_code?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    return handleResponse(response);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Server unreachable');
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export const createUserAPI = async (data) => {
  return request('POST', '/auth/create_user', data);
};

// Users
export const getUsers = async (role = null, extraParams = {}) => {
  const user = await getCurrentUser();
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (user?.company_id) params.set('company_id', user.company_id);
  Object.entries(extraParams).forEach(([k, v]) => { if (v !== null && v !== undefined) params.set(k, v); });
  const query = params.toString() ? `?${params.toString()}` : '';
  return request('GET', `/api/users${query}`);
};

// Departments
export const getDepartments = async () => {
  const user = await getCurrentUser();
  const query = user?.company_id ? `?company_id=${user.company_id}` : '';
  return request('GET', `/api/departments${query}`);
};

export const createDepartment = async (name) => {
  const user = await getCurrentUser();
  return request('POST', '/api/departments', { name, company_id: user?.company_id || null });
};

export const updateDepartment = async (id, data) => {
  return request('PUT', `/api/departments/${id}`, data);
};

export const deleteDepartment = async (id) => {
  return request('DELETE', `/api/departments/${id}`);
};

// Projects
export const getUserProjects = async () => {
  const user = await getCurrentUser();
  return request('GET', `/api/projects?user_id=${user?.id}&role=${user?.role}`);
};

export const getProjects = async (deptId) => {
  return request('GET', `/api/departments/${deptId}/projects`);
};

export const createProject = async (deptId, name) => {
  return request('POST', `/api/departments/${deptId}/projects`, { name });
};

export const assignDepartmentMembers = async (deptId, data) => {
  return request('PUT', `/api/departments/${deptId}/assign`, data);
};

export const removeDepartmentMember = async (deptId, userId) => {
  return request('DELETE', `/api/departments/${deptId}/members/${userId}`);
};

export const assignProjectMembers = async (projId, data) => {
  return request('PUT', `/api/projects/${projId}/assign`, data);
};

export const removeProjectMember = async (projId, userId) => {
  return request('DELETE', `/api/projects/${projId}/members/${userId}`);
};

// Tasks
export const getTasks = async (params = {}) => {
  const user = await getCurrentUser();
  const merged = { user_id: user?.id, role: user?.role, ...params };
  const queryString = Object.entries(merged)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const query = queryString ? `?${queryString}` : '';
  return request('GET', `/api/tasks${query}`);
};

export const createTask = async (data) => {
  const user = await getCurrentUser();
  return request('POST', '/api/tasks', { created_by: user?.id, ...data });
};

export const getTaskDetails = async (taskId) => {
  return request('GET', `/api/tasks/${taskId}/details`);
};

export const addComment = async (taskId, content, imageAttachment = null) => {
  const user = await getCurrentUser();
  return request('POST', `/api/tasks/${taskId}/comments`, {
    content,
    image_attachment: imageAttachment,
    user_id: user?.id,
  });
};

export const createSubtask = async (taskId, title) => {
  return request('POST', `/api/tasks/${taskId}/subtasks`, { title });
};

export const updateSubtask = async (subtaskId, data) => {
  return request('PUT', `/api/subtasks/${subtaskId}`, data);
};

export const updateTask = async (id, data) => {
  const user = await getCurrentUser();
  return request('PUT', `/api/tasks/${id}`, { user_id: user?.id, ...data });
};

export const deleteTask = async (id) => {
  return request('DELETE', `/api/tasks/${id}`);
};

// Expenses
export const getExpenses = async () => {
  const user = await getCurrentUser();
  return request('GET', `/api/expenses?user_id=${user?.id}&role=${user?.role}`);
};

export const createExpense = async (data) => {
  return request('POST', '/api/expenses', data);
};

export const approveExpense = async (id) => {
  const user = await getCurrentUser();
  return request('PUT', `/api/expenses/${id}/approve`, { user_id: user?.id });
};

export const rejectExpense = async (id, reason) => {
  const user = await getCurrentUser();
  return request('PUT', `/api/expenses/${id}/reject`, { user_id: user?.id, reason });
};

export const updateFinanceStatus = async (id, status, reason = '') => {
  const user = await getCurrentUser();
  return request('PUT', `/api/expenses/${id}/finance_status`, { user_id: user?.id, status, reason });
};

// Dashboard
export const getDashboardStats = async () => {
  const user = await getCurrentUser();
  if (user?.role === 'manager' && user?.user_type !== 'individual') {
    const query = user?.company_id ? `?company_id=${user.company_id}` : '';
    const data = await request('GET', `/api/stats/manager-dashboard${query}`);
    return {
      today_tasks: data.total_tasks || 0,
      in_progress: data.task_inprogress || 0,
      on_hold: data.task_todo || 0,
      past_due: 0,
      ...data,
    };
  }
  // For individual users and other roles, compute stats from their tasks only
  const tasks = await getTasks();
  const today = new Date().toDateString();
  return {
    today_tasks: tasks.filter(t => t.deadline && new Date(t.deadline).toDateString() === today).length,
    in_progress: tasks.filter(t => t.status === 'In Progress').length,
    on_hold: tasks.filter(t => t.status === 'On Hold').length,
    past_due: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed').length,
  };
};

// Calendar
export const getCalendarEvents = async (month, year) => {
  return request('GET', `/api/calendar/events?month=${month}&year=${year}`);
};

// ── Performance Stats ─────────────────────────────────────────────────────────
export const getManagerDashboard = async () => {
  const user = await getCurrentUser();
  const query = user?.company_id ? `?company_id=${user.company_id}` : '';
  return request('GET', `/api/stats/manager-dashboard${query}`);
};

export const getTeamStats = async (deptId) => {
  return request('GET', `/api/stats/team?dept_id=${deptId}`);
};

// ── Heartbeat ─────────────────────────────────────────────────────────────────
export const pingServer = async () => {
  const user = await getCurrentUser();
  if (!user?.id) return;
  return request('POST', '/api/ping', { user_id: user.id }).catch(() => {});
};

// ── Messaging — Direct Messages ───────────────────────────────────────────────
export const getConversations = async () => {
  const user = await getCurrentUser();
  return request('GET', `/api/conversations?user_id=${user?.id}`);
};

export const getOrCreateConversation = async (otherUserId) => {
  const user = await getCurrentUser();
  return request('POST', '/api/conversations', { user_id: user?.id, other_user_id: otherUserId });
};

export const getDMMessages = async (convId, sinceId = 0) => {
  const user = await getCurrentUser();
  return request('GET', `/api/conversations/${convId}/messages?user_id=${user?.id}&since_id=${sinceId}`);
};

export const sendDMMessage = async (convId, content, imageAttachment = null, messageType = 'text') => {
  const user = await getCurrentUser();
  return request('POST', `/api/conversations/${convId}/messages`, {
    sender_id: user?.id, content, image_attachment: imageAttachment, message_type: messageType,
  });
};

export const sendTypingDM = async (convId) => {
  const user = await getCurrentUser();
  return request('POST', `/api/conversations/${convId}/typing`, { user_id: user?.id }).catch(() => {});
};

export const getTypingDM = async (convId) => {
  const user = await getCurrentUser();
  return request('GET', `/api/conversations/${convId}/typing?user_id=${user?.id}`);
};

// ── Messaging — Groups ────────────────────────────────────────────────────────
export const getGroups = async () => {
  const user = await getCurrentUser();
  return request('GET', `/api/groups?user_id=${user?.id}`);
};

export const createGroup = async (name, memberIds) => {
  const user = await getCurrentUser();
  return request('POST', '/api/groups', { name, created_by: user?.id, member_ids: memberIds });
};

export const getGroupMessages = async (groupId, sinceId = 0) => {
  const user = await getCurrentUser();
  return request('GET', `/api/groups/${groupId}/messages?user_id=${user?.id}&since_id=${sinceId}`);
};

export const sendGroupMessage = async (groupId, content, imageAttachment = null, messageType = 'text') => {
  const user = await getCurrentUser();
  return request('POST', `/api/groups/${groupId}/messages`, {
    sender_id: user?.id, content, image_attachment: imageAttachment, message_type: messageType,
  });
};

export const sendTypingGroup = async (groupId) => {
  const user = await getCurrentUser();
  return request('POST', `/api/groups/${groupId}/typing`, { user_id: user?.id }).catch(() => {});
};

export const getTypingGroup = async (groupId) => {
  const user = await getCurrentUser();
  return request('GET', `/api/groups/${groupId}/typing?user_id=${user?.id}`);
};

export const getOnlineStatus = async (userIds) => {
  if (!userIds?.length) return {};
  return request('GET', `/api/users/online?user_ids=${userIds.join(',')}`);
};

export const getGroupInfo = async (groupId) => {
  return request('GET', `/api/groups/${groupId}/info`);
};

export const addGroupMember = async (groupId, memberUserId) => {
  const user = await getCurrentUser();
  return request('POST', `/api/groups/${groupId}/members`, {
    user_id: user?.id,
    member_user_id: memberUserId,
  });
};

export const removeGroupMember = async (groupId, memberUserId) => {
  const user = await getCurrentUser();
  return request('DELETE', `/api/groups/${groupId}/members/${memberUserId}?user_id=${user?.id}`);
};

export const getUserProfile = async (userId) => {
  return request('GET', `/api/users/${userId}`);
};

// ── Requirements ──────────────────────────────────────────────────────────────
export const getRequirements = async (params = {}) => {
  const user = await getCurrentUser();
  const merged = { user_id: user?.id, role: user?.role, ...params };
  const qs = Object.entries(merged)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return request('GET', `/api/requirements?${qs}`);
};

export const postRequirement = async (data) => {
  const user = await getCurrentUser();
  return request('POST', '/api/requirements', { posted_by_id: user?.id, ...data });
};

export const updateRequirementStatus = async (id, status) => {
  return request('PUT', `/api/requirements/${id}/status`, { status });
};

export const getRequirement = async (reqId) => {
  return request('GET', `/api/requirements/${reqId}`);
};

export const getRequirementComments = (reqId) =>
  request('GET', `/api/requirements/${reqId}/comments`);

export const postRequirementComment = async (reqId, content) => {
  const user = await getCurrentUser();
  return request('POST', `/api/requirements/${reqId}/comments`, { author_id: user?.id, content });
};

// ── Notifications ──────────────────────────────────────────────────────────────
export const getNotifications = async () => {
  const user = await getCurrentUser();
  return request('GET', `/api/notifications?user_id=${user?.id}`);
};

export const markNotificationRead = async (id) => {
  return request('PUT', `/api/notifications/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  const user = await getCurrentUser();
  return request('PUT', `/api/notifications/read-all`, { user_id: user?.id });
};

export default {
  loginAPI,
  logoutAPI,
  createUserAPI,
  getUsers,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getProjects,
  createProject,
  assignDepartmentMembers,
  removeDepartmentMember,
  assignProjectMembers,
  removeProjectMember,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  updateFinanceStatus,
  getDashboardStats,
  getCalendarEvents,
  getManagerDashboard,
  getTeamStats,
  pingServer,
  getConversations,
  getOrCreateConversation,
  getDMMessages,
  sendDMMessage,
  sendTypingDM,
  getTypingDM,
  getGroups,
  createGroup,
  getGroupMessages,
  sendGroupMessage,
  sendTypingGroup,
  getTypingGroup,
  getOnlineStatus,
  getGroupInfo,
  addGroupMember,
  removeGroupMember,
  getRequirements,
  getRequirement,
  postRequirement,
  updateRequirementStatus,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
