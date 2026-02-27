import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        const decodedToken = jwtDecode(token);
        if (decodedToken.exp * 1000 > Date.now()) {
          setUser({ id: decodedToken.userId, email: decodedToken.email });
        } else {
          localStorage.removeItem('authToken');
        }
      }
    } catch (error) {
      console.error("Failed to decode token", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (token) => {
    localStorage.setItem('authToken', token);
    const decodedToken = jwtDecode(token);
    setUser({ id: decodedToken.userId, email: decodedToken.email });
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};