import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Sprout, Send, ArrowRight } from 'lucide-react';

const PossibilityCard = ({ icon, title, description, delay, link }) => {
  const cardContent = (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={`bg-surface-1 p-8 rounded-2xl border border-border-color backdrop-blur-sm h-full flex flex-col
                  ${link ? 'group hover:border-accent-ai transition-colors cursor-pointer' : ''}`}
    >
      <div className="text-accent-ai mb-4">{icon}</div>
      <h3 className="font-headings text-2xl font-semibold mb-2">{title}</h3>
      <p className="text-text-secondary flex-grow">{description}</p>
      {link && (
        <div className="mt-4 flex items-center text-accent-ai font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Перейти <ArrowRight size={20} className="ml-2" />
        </div>
      )}
    </motion.div>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block h-full">
      {cardContent}
    </a>
  ) : (
    cardContent
  );
};

export const PossibilitiesSection = () => {
  return (
    <section id="possibilities" className="py-20 px-4">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-headings text-4xl md:text-5xl font-bold text-center mb-12 text-text-primary">
          Откройте новые возможности
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <PossibilityCard
            icon={<BrainCircuit size={40} />}
            title="Точный ИИ-анализ"
            description="Нейросеть вычисляет метрики роста и помогает обнаружить проблемы с развитием культуры на ранних этапах."
            delay={0.1}
          />
          <PossibilityCard
            icon={<Sprout size={40} />}
            title="История наблюдений"
            description="Сохраняйте все анализы в одном месте. Отслеживайте динамику роста и развитие ваших растений во времени."
            delay={0.3}
          />
          <PossibilityCard
            icon={<Send size={40} />}
            title="Интеграция с Telegram"
            description="Анализируйте растения прямо с телефона. Ваш личный ИИ-агроном всегда под рукой, где бы вы ни были."
            delay={0.5}
            link="https://t.me/FloraAIBot"
          />
        </div>
      </div>
    </section>
  );
};