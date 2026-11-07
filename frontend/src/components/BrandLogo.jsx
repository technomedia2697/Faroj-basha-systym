import React from 'react';

const logos = {
  ar: '/5994297452451795077.jpg',
  en: '/5994297452451795077.jpg',
};

export default function BrandLogo({ language = 'ar', className = '' }) {
  const isArabic = language === 'ar';

  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-2xl border-2 border-brand-orange bg-gradient-to-br from-brand-charcoal via-brand-red to-brand-deep-purple p-2 shadow-xl shadow-brand-red/30 ${className}`}>
      <img
        src={logos[isArabic ? 'ar' : 'en']}
        alt={isArabic ? 'فروج باشا' : 'Faroj Basha'}
        className="max-w-none h-[160%] w-auto object-contain mix-blend-screen drop-shadow-[0_0_8px_rgba(245,239,226,0.55)]"
      />
    </div>
  );
}
