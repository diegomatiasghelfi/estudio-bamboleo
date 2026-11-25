/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: { DEFAULT: '#FAF8F3', 100: '#F5F1E8', 200: '#EDE6D6' },
        gold: { DEFAULT: '#F3E59A', dark: '#E6D36A' },
        cocoa: { DEFAULT: '#2C2623', 600: '#4A413C', 400: '#7A6F68' },
        brick: '#8B2320',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { soft: '0 2px 12px rgba(44,38,35,0.06)' },
    },
  },
  plugins: [],
}
