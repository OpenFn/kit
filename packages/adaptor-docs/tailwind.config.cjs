// This is duplicated and lightly edited from Lightning
module.exports = {
  prefix: 'ad--',
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // indigo
        'primary-900': '#312e81',
        'primary-800': '#3730a3',
        'primary-700': '#4338ca',
        'primary-600': '#4f46e5',
        'primary-500': '#6366f1',
        'primary-300': '#a5b4fc',
        'primary-200': '#c7d2fe',
        'primary-50': '#eef2ff',
        // gray
        'secondary-900': '#111827',
        'secondary-800': '#1f2937',
        'secondary-700': '#374151',
        'secondary-500': '#6b7280',
        'secondary-400': '#9ca3af',
        'secondary-300': '#d1d5db',
        'secondary-200': '#e5e7eb',
        'secondary-100': '#f3f4f6',
        'secondary-50': '#f9fafb',
        // danger
        'danger-500': '#ef4444',
        'danger-700': '#b91c1c',
      },
    },
  },                            
  plugins: [],
};
