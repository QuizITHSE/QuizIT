import React from 'react';

const LoadingCircle: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <span
    className={`inline-block animate-spin rounded-full border-2 border-solid border-white border-t-black ${className}`}
    style={{ width: size, height: size, borderTopColor: '#000' }}
    role="status"
    aria-label="Загрузка..."
  />
);

export default LoadingCircle;
