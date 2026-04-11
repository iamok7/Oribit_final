import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginAPI, signupAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('tso_user');
      const storedToken = await AsyncStorage.getItem('tso_token');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      if (storedToken) {
        setToken(storedToken);
      }
    } catch (error) {
      console.error('Failed to load stored user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setIsLoading(true);
      const response = await loginAPI(username, password);
      if (response && (response.id || response.user)) {
        const userData = response.user || {
          id: response.id,
          username: response.username,
          email: response.email,
          first_name: response.first_name,
          last_name: response.last_name,
          role: response.role,
          user_type: response.user_type || 'company_member',
          company_id: response.company_id || null,
          company_name: response.company_name || null,
          department_id: response.department_id,
        };
        const userToken = response.token || response.session_token || username;
        setUser(userData);
        setToken(userToken);
        await AsyncStorage.setItem('tso_user', JSON.stringify(userData));
        await AsyncStorage.setItem('tso_token', userToken);
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (signupData) => {
    try {
      setIsLoading(true);
      const response = await signupAPI(signupData);
      if (response && response.user) {
        const userData = {
          ...response.user,
          user_type: response.user.user_type || 'individual',
        };
        const userToken = userData.username;
        setUser(userData);
        setToken(userToken);
        await AsyncStorage.setItem('tso_user', JSON.stringify(userData));
        await AsyncStorage.setItem('tso_token', userToken);
        return { success: true, user: userData };
      } else {
        return { success: false, error: response?.message || 'Signup failed' };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message || 'Signup failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('tso_user');
      await AsyncStorage.removeItem('tso_token');
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const isIndividual = () => user?.user_type === 'individual';
  const isCompanyMember = () => !isIndividual();
  const isManager = () => hasRole('manager');
  const isSupervisor = () => hasRole('supervisor');
  const isEmployee = () => hasRole('employee');
  const isFinance = () => hasRole('finance');
  const canApproveExpenses = () => !isIndividual() && hasRole(['manager', 'supervisor', 'finance']);
  const canManageUsers = () => !isIndividual() && hasRole('manager');
  const canManageDepartments = () => !isIndividual() && hasRole(['manager', 'supervisor']);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        signup,
        logout,
        hasRole,
        isIndividual,
        isCompanyMember,
        isManager,
        isSupervisor,
        isEmployee,
        isFinance,
        canApproveExpenses,
        canManageUsers,
        canManageDepartments,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
