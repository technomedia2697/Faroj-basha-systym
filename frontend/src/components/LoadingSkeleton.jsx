import React from 'react';

export default function LoadingSkeleton({ count = 5 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-700 rounded-lg h-16 animate-pulse"
          style={{
            background: 'linear-gradient(90deg, #374151 25%, #4B5563 50%, #374151 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
          }}
        />
      ))}
    </div>
  );
}
