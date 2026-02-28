import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Header } from '@/components/app/Header';

const AboutPage = () => {
  return (
    <div className="h-screen w-screen flex flex-col font-body bg-background text-text-primary">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto py-12 px-8"
        >
          <h1 className="font-headings text-4xl md:text-5xl font-bold mb-6">О проекте FloraAI</h1>
          <div className="space-y-6 text-text-secondary text-lg leading-relaxed mb-16">
            <p>
              FloraAI — это ваш цифровой агроном, использующий мощь передового компьютерного зрения и нейронных сетей для точного анализа растений.
            </p>
            <p>
              Мы верим, что технологии могут сделать уход за растениями эффективнее. Наша миссия — предоставить каждому садоводу и фермеру инструмент для объективной оценки состояния культур.
            </p>
            <p>
              В отличие от общих советов в интернете, наш ИИ-анализатор измеряет конкретные физические метрики (площадь листьев, длину корня) прямо по фотографии и предоставляет рекомендации, учитывая текущее состояние именно вашего растения.
            </p>
          </div>

          <div className="mt-12">
            <h2 className="font-headings text-3xl font-bold mb-6">Юридическая информация</h2>
            <div className="bg-surface-2 rounded-lg p-6 border border-border-color space-y-4 text-lg">
                <p>
                    Для ознакомления с условиями использования сервиса и политикой обработки данных, пожалуйста, перейдите на соответствующие страницы:
                </p>
                <ul className="list-disc list-inside pl-4 space-y-2">
                    <li>
                        <Link to="/terms" className="text-accent-ai hover:underline">
                            Пользовательское соглашение
                        </Link>
                    </li>
                    <li>
                        <Link to="/privacy" className="text-accent-ai hover:underline">
                            Политика обработки персональных данных
                        </Link>
                    </li>
                </ul>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default AboutPage;