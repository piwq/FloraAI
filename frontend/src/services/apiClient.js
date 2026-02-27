import axios from 'axios';

const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const registerUser = (userData) => {
  const data = Object.fromEntries(
    Object.entries(userData).filter(([_, v]) => v != null && v !== '')
  );
  return apiClient.post('/auth/register', data);
};

export const loginUser = (credentials) => {
  return apiClient.post('/auth/login', credentials);
};

export const getUserProfile = () => {
  return apiClient.get('/auth/me');
};

export const updateUserProfile = (profileData) => {
  return apiClient.put('/auth/me', profileData);
};

export const changePassword = (passwordData) => {
  return apiClient.post('/auth/change-password', passwordData);
};


export const getChatSessions = () => {
  return apiClient.get('/chat');
};

export const getChatSessionDetails = (sessionId) => {
  if (!sessionId) return Promise.resolve(null);
  return apiClient.get(`/chat/${sessionId}`);
};

export const deleteChatSession = (sessionId) => {
  return apiClient.delete(`/chat/${sessionId}`);
};

export const mockSubscribeToPremium = () => {
  return apiClient.post('/payment/mock-subscribe');
};

export default apiClient;