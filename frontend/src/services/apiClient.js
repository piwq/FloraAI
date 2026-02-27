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
  console.log("Отправляем на сервер:", userData);

  return apiClient.post('/auth/register', {
    username: userData.username || userData.name,
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

export const getUserProfile = () => apiClient.get('/auth/me');
export const updateUserProfile = (profileData) => apiClient.put('/auth/me', profileData);
export const changePassword = (passwordData) => apiClient.post('/auth/change-password', passwordData);

// --- ЧАТ И ФОТО ---
export const getChatSessions = () => apiClient.get('/chat');
export const getChatSessionDetails = (sessionId) => sessionId ? apiClient.get(`/chat/${sessionId}`) : Promise.resolve(null);
export const deleteChatSession = (sessionId) => apiClient.delete(`/chat/${sessionId}`);
export const mockSubscribeToPremium = () => apiClient.post('/payment/mock-subscribe');

export const uploadPlantPhoto = (file) => {
  const formData = new FormData();
  formData.append('original_image', file);
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