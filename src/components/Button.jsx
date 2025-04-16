import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  type = 'button', 
  disabled = false, 
  isLoading = false, 
  icon: Icon, 
  className = '' 
}) {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150";
  
  const variantStyles = {
    primary: `border-transparent text-white ${disabled || isLoading ? 'bg-primary-400' : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'}`,
    secondary: `border-gray-300 text-gray-700 bg-white ${disabled || isLoading ? 'opacity-50' : 'hover:bg-gray-50 focus:ring-primary-500'}`,
    danger: `border-transparent text-white ${disabled || isLoading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'}`,
    text: `border-transparent text-primary-600 ${disabled || isLoading ? 'text-primary-300' : 'hover:text-primary-800 hover:bg-primary-50 focus:ring-primary-500'} shadow-none`
  };

  const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${isLoading ? 'cursor-wait' : ''} ${disabled ? 'cursor-not-allowed opacity-70' : ''} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={combinedClassName}
    >
      {isLoading && (
        <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
      )}
      {!isLoading && Icon && (
        <Icon className="h-4 w-4 mr-2" />
      )}
      {children}
    </button>
  );
}

export default Button; 