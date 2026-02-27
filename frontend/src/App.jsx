import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatedBackgroundCanvas } from './components/AnimatedBackgroundCanvas';
import { Toaster } from 'react-hot-toast';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { useAuth } from './context/AuthContext';
import { AppPage } from './pages/AppPage';
import ProfilePage from './pages/ProfilePage';
import AboutPage from './pages/AboutPage';
import TariffsPage from './pages/TariffsPage';
import { TelegramConnectPage } from './pages/TelegramConnectPage';
import PaymentPage from './pages/PaymentPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage'; 
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';


function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="text-center p-8 text-4xl font-headings">Загрузка...</div>;
  }

  return (
    <>
      <AnimatedBackgroundCanvas />
      <Toaster position="bottom-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={!isAuthenticated ? <LandingPage /> : <Navigate to="/app" />} />
          <Route path="/auth" element={!isAuthenticated ? <AuthPage /> : <Navigate to="/app" />} />
          <Route path="/app" element={isAuthenticated ? <AppPage /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/auth" />} />
          <Route path="/tariffs" element={isAuthenticated ? <TariffsPage /> : <Navigate to="/auth" />} />
          <Route path="/payment" element={isAuthenticated ? <PaymentPage /> : <Navigate to="/auth" />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/telegram-connect" element={<TelegramConnectPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;