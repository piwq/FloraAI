import React from 'react';
import { Header } from '../components/landing/Header';
import { HeroSection } from '../components/landing/HeroSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { PossibilitiesSection } from '../components/landing/PossibilitiesSection';
import { CTASection } from '../components/landing/CTASection';
import { Footer } from '../components/landing/Footer';

export const LandingPage = () => {
  return (
    <div className="relative font-body overflow-y-auto h-screen snap-y snap-mandatory">
      <Header />
      <main>
        <div className="snap-start">
          <HeroSection />
        </div>
        <div className="snap-start">
          <FeaturesSection />
        </div>
        <div className="snap-start">
          <PossibilitiesSection />
        </div>
        <div className="snap-start">
          <CTASection />
        </div>
      </main>
      <Footer />
    </div>
  );
};