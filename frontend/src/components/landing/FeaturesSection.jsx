import React from 'react';
import { motion } from 'framer-motion';

const FeatureCard = ({ icon, title, description, delay }) => (
  <motion.div
    initial={{ y: 50, opacity: 0 }}
    whileInView={{ y: 0, opacity: 1 }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className="bg-surface-1 p-8 rounded-2xl border border-border-color backdrop-blur-sm text-center"
  >
    <div className="text-accent-ai text-5xl mb-4">{icon}</div>
    <h3 className="font-headings text-2xl font-semibold mb-2">{title}</h3>
    <p className="text-text-secondary">{description}</p>
  </motion.div>
);

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-headings text-4xl md:text-5xl font-bold text-center mb-12 text-text-primary">
          Как это работает
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon="📸"
            title="Сделайте фото"
            description="Загрузите фотографию вашего растения или ростка прямо с поля или подоконника."
            delay={0.1}
          />
          <FeatureCard
            icon="🧠"
            title="ИИ анализирует"
            description="Наш алгоритм распознает культуру, измеряет площадь листьев и длину корня."
            delay={0.3}
          />
          <FeatureCard
            icon="👨‍🌾"
            title="Получите советы"
            description="Получите точный отчет о состоянии растения и задайте вопросы цифровому агроному."
            delay={0.5}
          />
        </div>
      </div>
    </section>
  );
};