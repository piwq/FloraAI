import React from 'react';
import { Header } from '../components/landing/Header';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { PossibilitiesSection } from '../components/landing/PossibilitiesSection';
import { CTASection } from '../components/landing/CTASection';
import { Footer } from '../components/landing/Footer';
import { AnimatedBackgroundCanvas } from '../components/AnimatedBackgroundCanvas';

export const LandingPage = () => {
  return (
    <div className="font-body bg-background text-text-primary min-h-screen flex flex-col relative overflow-x-hidden">
      <AnimatedBackgroundCanvas />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <HeroSection />
          <FeaturesSection />
          <PossibilitiesSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;