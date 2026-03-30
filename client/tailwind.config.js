/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            pre: { padding: 0, margin: 0, backgroundColor: 'transparent' },
            code: { backgroundColor: 'transparent' },
          },
        },
      },
    },
  },
  plugins: [],
};
