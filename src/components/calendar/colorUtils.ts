/**
 * Color utility functions for calendar components
 * Platform: Used for background/fill color
 * Format: Used for border color
 */

// Platform color mapping function (for background/fill color) 
export const getPlatformColors = (platform?: string) => {
  if (!platform) return { 
    bg: 'bg-gray-100', 
    darkBg: 'dark:bg-gray-700',
    opacity: 'bg-gray-100/30',
    darkOpacity: 'dark:bg-gray-700/30',
    hex: '#d1d5db',
    darkHex: '#374151'
  };
  
  switch (platform.toLowerCase()) {
    case 'x':
      return { 
        bg: 'bg-black/10', 
        darkBg: 'dark:bg-black/40',
        opacity: 'bg-black/20',
        darkOpacity: 'dark:bg-black/30',
        hex: '#000000',
        darkHex: '#000000'
      };
    case 'instagram':
      return { 
        bg: 'bg-pink-100', 
        darkBg: 'dark:bg-pink-900/30',
        opacity: 'bg-pink-500/20',
        darkOpacity: 'dark:bg-pink-500/20',
        hex: '#fbcfe8',
        darkHex: '#831843'
      };
    case 'facebook':
      return { 
        bg: 'bg-blue-100', 
        darkBg: 'dark:bg-blue-900/30',
        opacity: 'bg-blue-500/20',
        darkOpacity: 'dark:bg-blue-500/20',
        hex: '#dbeafe',
        darkHex: '#1e3a8a'
      };
    case 'linkedin':
      return { 
        bg: 'bg-sky-100', 
        darkBg: 'dark:bg-sky-900/30',
        opacity: 'bg-sky-500/20',
        darkOpacity: 'dark:bg-sky-500/20',
        hex: '#e0f2fe',
        darkHex: '#0c4a6e'
      };
    case 'youtube':
      return { 
        bg: 'bg-red-100', 
        darkBg: 'dark:bg-red-900/30',
        opacity: 'bg-red-500/20',
        darkOpacity: 'dark:bg-red-500/20',
        hex: '#fee2e2',
        darkHex: '#7f1d1d'
      };
    case 'tiktok':
      return { 
        bg: 'bg-slate-100', 
        darkBg: 'dark:bg-slate-800/50',
        opacity: 'bg-slate-800/20',
        darkOpacity: 'dark:bg-slate-800/30',
        hex: '#f1f5f9',
        darkHex: '#1e293b'
      };
    case 'threads':
      return { 
        bg: 'bg-purple-100', 
        darkBg: 'dark:bg-purple-900/30',
        opacity: 'bg-purple-500/20',
        darkOpacity: 'dark:bg-purple-500/20',
        hex: '#f3e8ff',
        darkHex: '#581c87'
      };
    case 'vimeo':
      return { 
        bg: 'bg-cyan-100', 
        darkBg: 'dark:bg-cyan-900/30',
        opacity: 'bg-cyan-500/20',
        darkOpacity: 'dark:bg-cyan-500/20',
        hex: '#cffafe',
        darkHex: '#164e63'
      };
    case 'pinterest':
      return { 
        bg: 'bg-red-100', 
        darkBg: 'dark:bg-red-900/30',
        opacity: 'bg-red-600/20',
        darkOpacity: 'dark:bg-red-600/20',
        hex: '#fee2e2',
        darkHex: '#7f1d1d'
      };
    case 'medium':
      return { 
        bg: 'bg-green-100', 
        darkBg: 'dark:bg-green-900/30',
        opacity: 'bg-green-600/20',
        darkOpacity: 'dark:bg-green-600/20',
        hex: '#dcfce7',
        darkHex: '#14532d'
      };
    case 'website':
    default:
      return { 
        bg: 'bg-gray-100', 
        darkBg: 'dark:bg-gray-700',
        opacity: 'bg-gray-500/20',
        darkOpacity: 'dark:bg-gray-500/20',
        hex: '#f3f4f6',
        darkHex: '#374151'
      };
  }
};

// Format color mapping function (for border color)
export const getFormatColors = (format?: string) => {
  if (!format) return { 
    border: 'border-gray-300', 
    darkBorder: 'dark:border-gray-600',
    hex: '#d1d5db',
    darkHex: '#4b5563'
  };
  
  switch (format.toLowerCase()) {
    case 'article':
      return { 
        border: 'border-blue-400', 
        darkBorder: 'dark:border-blue-500',
        hex: '#60a5fa',
        darkHex: '#3b82f6'
      };
    case 'social':
      return { 
        border: 'border-pink-400', 
        darkBorder: 'dark:border-pink-500',
        hex: '#f472b6',
        darkHex: '#ec4899'
      };
    case 'video':
      return { 
        border: 'border-red-400', 
        darkBorder: 'dark:border-red-500',
        hex: '#f87171',
        darkHex: '#ef4444'
      };
    case 'podcast':
      return { 
        border: 'border-purple-400', 
        darkBorder: 'dark:border-purple-500',
        hex: '#c084fc',
        darkHex: '#a855f7'
      };
    case 'infographic':
      return { 
        border: 'border-green-400', 
        darkBorder: 'dark:border-green-500',
        hex: '#4ade80',
        darkHex: '#22c55e'
      };
    case 'gallery':
      return { 
        border: 'border-amber-400', 
        darkBorder: 'dark:border-amber-500',
        hex: '#fbbf24',
        darkHex: '#f59e0b'
      };
    case 'pdf':
      return { 
        border: 'border-orange-400', 
        darkBorder: 'dark:border-orange-500',
        hex: '#fb923c',
        darkHex: '#f97316'
      };
    default:
      return { 
        border: 'border-gray-300', 
        darkBorder: 'dark:border-gray-600',
        hex: '#d1d5db',
        darkHex: '#4b5563'
      };
  }
}; 