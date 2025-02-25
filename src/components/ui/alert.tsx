import React from 'react';

interface AlertProps {
  variant?: 'default' | 'destructive';
  className?: string;
  children: React.ReactNode;
}

export function Alert({ variant = 'default', className = '', children }: AlertProps) {
  const variantClasses = {
    default: 'bg-gray-50 border-l-4 border-blue-400 text-blue-700 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-200',
    destructive: 'bg-red-50 border-l-4 border-red-400 text-red-700 dark:bg-red-900/20 dark:border-red-600 dark:text-red-200',
  };

  return (
    <div className={`p-4 ${variantClasses[variant]} ${className}`} role="alert">
      {children}
    </div>
  );
}

interface AlertTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertTitle({ className = '', children }: AlertTitleProps) {
  return (
    <h5 className={`font-medium text-sm ${className}`}>
      {children}
    </h5>
  );
}

interface AlertDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export function AlertDescription({ className = '', children }: AlertDescriptionProps) {
  return (
    <div className={`text-sm mt-1 ${className}`}>
      {children}
    </div>
  );
} 