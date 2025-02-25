import React from 'react';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Separator({ orientation = 'horizontal', className = '' }: SeparatorProps) {
  return (
    <div
      className={`
        ${orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px'} 
        bg-gray-200 dark:bg-gray-700 
        ${className}
      `}
      role="separator"
    />
  );
} 