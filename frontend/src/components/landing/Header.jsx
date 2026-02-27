import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const Header = () => {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 left-0 w-full z-50 py-4 px-8 flex justify-between items-center
                 bg-background/80 backdrop-blur-md border-b border-border-color"
    >
      <Link to="/" className="font-headings text-3xl font-bold tracking-wider text-text-primary">
        Морфеус
      </Link>
      <nav className="hidden md:flex items-center space-x-8">
        <a href="#features" className="text-text-secondary hover:text-text-primary transition-colors">Как это работает</a>
        <a href="#possibilities" className="text-text-secondary hover:text-text-primary transition-colors">Возможности</a>
      </nav>
      <Link to="/auth">
        <button className="bg-accent-ai text-white font-bold py-2 px-6 rounded-lg hover:opacity-90 transition-opacity">
          Войти
        </button>
      </Link>
    </motion.header>
  );
};