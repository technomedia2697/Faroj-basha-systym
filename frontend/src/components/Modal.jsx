import React, { useState, useEffect } from 'react';

export default function Modal({ isOpen, onClose, title, size = 'max-w-md', children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className={`w-full ${size} max-h-[96vh] overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-2xl`}>
        {/* Header */}
        <div className="flex justify-between items-center gap-3 p-4 sm:p-6 border-b border-gray-700">
          <h2 className="text-lg sm:text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(96vh-72px)] overflow-y-auto p-3 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
