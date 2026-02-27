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
          <h1 className="font-headings text-4xl md:text-5xl font-bold mb-6">О проекте "Морфеус"</h1>
          <div className="space-y-6 text-text-secondary text-lg leading-relaxed mb-16">
            <p>
              "Морфеус" — это ваш личный проводник в мир подсознания, использующий мощь передовых нейронных сетей для глубокого и персонализированного анализа сновидений.
            </p>
            <p>
              Мы верим, что сны — это ключ к пониманию себя. Наша миссия — предоставить вам инструмент, который поможет расшифровать сложные сообщения, которые ваш мозг посылает вам каждую ночь.
            </p>
            <p>
              В отличие от традиционных сонников с их устаревшими и обобщенными трактовками, наш ИИ-анализатор учитывает ваш уникальный жизненный контекст, чтобы предоставить инсайты, которые действительно имеют значение для вас.
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