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
  (error) => Promise.reject(error)
);

// Авторизация и профиль
export const registerUser = (userData) => apiClient.post('/auth/register', userData);
export const loginUser = (credentials) => apiClient.post('/auth/login', { username: credentials.email, password: credentials.password });
export const getUserProfile = () => apiClient.get('/auth/me');
export const updateUserProfile = (profileData) => apiClient.patch('/auth/me', profileData);
export const changePassword = (passwordData) => apiClient.post('/auth/change-password', passwordData);

// Чат и фото (FloraAI)
export const getChatSessions = () => apiClient.get('/chat/');
export const getChatSessionDetails = (sessionId) => sessionId ? apiClient.get(`/chat/${sessionId}/`) : Promise.resolve(null);
export const deleteChatSession = (sessionId) => apiClient.delete(`/chat/${sessionId}/`);

export const uploadPlantPhoto = (file) => {
  const formData = new FormData();
  formData.append('original_image', file);
  return apiClient.post('/analyses/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const sendFloraChatMessage = (text, metrics, sessionId = null) => {
  return apiClient.post('/chat/', {
    message: text,
    metrics: metrics || {},
    session_id: sessionId
  });
};

// Интеграции и оплата
export const linkTelegram = (data) => apiClient.post('/auth/telegram/link/', data);
export const mockSubscribeToPremium = () => apiClient.post('/payment/mock-subscribe');

export default apiClient;