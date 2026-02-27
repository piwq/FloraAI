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
  return apiClient.post('/auth/register', {
    username: userData.username,
    email: userData.email,
    password: userData.password
  });
};

export const loginUser = (credentials) => {
  return apiClient.post('/auth/login', {
    username: credentials.email,
    password: credentials.password
  });
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

export const uploadPlantPhoto = (file) => {
  const formData = new FormData();
  formData.append('original_image', file);
  formData.append('telegram_id', `web_${Date.now()}`); // Генерируем временный ID для веба

  return apiClient.post('/analyses/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const sendFloraChatMessage = (text, metrics) => {
  return apiClient.post('/chat/', {
    message: text,
    metrics: metrics || {}
  });
};

export default apiClient;