import React from 'react';
import { Link } from 'react-router-dom';


import AuthForm from '../components/auth/AuthForm';

export const AuthPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Link to="/" className="font-headings text-3xl font-bold tracking-wider text-text-primary hover:text-accent-ai transition-colors">
          Морфеус
        </Link>
      </div>
      <AuthForm />
    </div>
  );
};