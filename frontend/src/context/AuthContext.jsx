import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { ApiError } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate active session on mount
  const checkSession = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login handler
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.success && response.data?.user) {
      setUser(response.data.user);
    }
    return response;
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      console.warn('Logout API notification failed, clearing local state', err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    isOperator: user?.role === 'SAFETY_OPERATOR',
    isLoading,
    login,
    logout,
    checkSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

