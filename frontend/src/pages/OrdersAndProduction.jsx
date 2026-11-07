import React, { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import Orders from './Orders';

export default function OrdersAndProduction() {
  const { language } = useContext(LanguageContext);
  
  const labels = {
    ar: {
      orders: 'الطلبات والإنتاج',
      ordersSub: 'إدارة طلبات العملاء - الإنتاج يتم تلقائياً',
    },
    en: {
      orders: 'Orders & Production',
      ordersSub: 'Manage customer orders - Production is automatic',
    }
  };
  const currentLabels = labels[language];

  return (
    <div
      className="space-y-6 relative min-h-screen p-4 sm:p-6 lg:p-8"
      style={{
        backgroundImage: 'linear-gradient(145deg, rgba(var(--brand-red-rgb), 0.18), var(--brand-charcoal) 55%, var(--brand-charcoal))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="mb-6 animate-fadeIn">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold drop-shadow-lg">
            {currentLabels.orders}
          </h1>
          <p className="text-gray-300 mt-2 text-sm sm:text-base drop-shadow">
            {currentLabels.ordersSub}
          </p>
        </div>

        {/* Orders Section */}
        <Orders />
      </div>
    </div>
  );
}
