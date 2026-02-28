import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const CTASection = () => {
  return (
    <section id="cta" className="py-20 px-4">
      <div className="container mx-auto max-w-3xl text-center">
        <motion.h2 
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-headings text-4xl md:text-5xl font-bold text-text-primary mb-6"
        >
          Готовы улучшить здоровье ваших растений?
        </motion.h2>
        <motion.p
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-lg text-text-secondary mb-10"
        >
          Присоединяйтесь к садоводам и фермерам, которые уже используют FloraAI для ухода за культурами.
        </motion.p>
        <Link to="/auth">
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: 0.4, type: "spring", stiffness: 120 }}
            className="bg-accent-ai text-white font-bold py-3 px-8 rounded-lg text-lg hover:scale-105 transition-transform"
          >
              Начать бесплатно
          </motion.button>
        </Link>
      </div>
    </section>
  );
};