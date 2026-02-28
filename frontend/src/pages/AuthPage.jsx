import React from 'react';
import { Link } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';

export const AuthPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Link to="/" className="font-headings text-3xl font-bold tracking-wider text-accent-ai hover:opacity-80 transition-opacity flex items-center gap-2">
          <span>🌿</span> FloraAI
        </Link>
      </div>
      <AuthForm />
    </div>
  );
};