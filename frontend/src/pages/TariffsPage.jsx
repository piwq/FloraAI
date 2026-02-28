import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Header } from '@/components/app/Header';
import { useQuery } from '@tanstack/react-query';
import { getUserProfile } from '@/services/apiClient';
import { Link } from 'react-router-dom';

const TariffCard = ({ title, price, description, features, buttonText, isFeatured, buttonLink, disabled }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    className={`bg-surface-2 p-8 rounded-2xl border ${isFeatured ? 'border-accent-ai' : 'border-border-color'} flex flex-col`}
  >
    {isFeatured && (
      <div className="bg-accent-ai text-white text-xs font-bold px-3 py-1 rounded-full self-start mb-4">
        Premium
      </div>
    )}
    <h2 className="font-headings text-3xl font-bold mb-2">{title}</h2>
    <p className="text-text-secondary mb-6">{description}</p>
    <div className="mb-8">
      <span className="text-5xl font-bold">{price}</span>
      { price !== '0₽' && <span className="text-text-secondary"> / мес</span> }
    </div>
    <ul className="space-y-4 text-text-primary mb-10 flex-grow">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start">
          <Check className="w-5 h-5 text-accent-ai mr-3 mt-1 flex-shrink-0" />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
    <Link to={buttonLink} className={disabled ? 'pointer-events-none' : ''}>
      <button
        disabled={disabled}
        className={`w-full py-3 font-bold rounded-lg transition-colors ${isFeatured ? 'bg-accent-ai text-white hover:opacity-90' : 'bg-surface-1 text-text-primary hover:bg-accent-ai'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {buttonText}
      </button>
    </Link>
  </motion.div>
);

const TariffsPage = () => {
  const { data: userData } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => getUserProfile().then(res => res.data)
  });

  const isAlreadyPremium = userData?.subscriptionStatus === 'PREMIUM';

  return (
    <div className="h-screen w-screen flex flex-col font-body bg-background text-text-primary">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto py-12 px-4 sm:px-8">
          <div className="text-center mb-12">
            <h1 className="font-headings text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Выберите свой план</h1>
            <p className="text-text-secondary text-base sm:text-lg max-w-2xl mx-auto">
              Получите доступ к неограниченным возможностям анализа растений с подпиской Premium.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <TariffCard
              title="Бесплатный"
              price="0₽"
              description="Начните свой путь в умное растениеводство."
              features={['3 анализа при регистрации', '1 бесплатный анализ каждые 3 дня', 'История анализов']}
              buttonText={isAlreadyPremium ? "Стандартный план" : "Ваш текущий план"}
              buttonLink="#"
              disabled={!isAlreadyPremium}
            />
            <TariffCard
              title="Premium"
              price="299₽"
              description="Для глубокого контроля за культурами."
              features={['20 анализов ежедневно', 'Расширенный анализ метрик роста', 'Детальные советы от ИИ-агронома', 'Отсутствие ограничений']}
              buttonText={isAlreadyPremium ? "Вы уже Premium" : "Перейти на Premium"}
              isFeatured={true}
              buttonLink={isAlreadyPremium ? "#" : "/payment"}
              disabled={isAlreadyPremium}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default TariffsPage;