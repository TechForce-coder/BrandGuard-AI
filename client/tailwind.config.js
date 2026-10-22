/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: { colors: { brand: { 50:'#effaf3', 100:'#d8f4e2', 600:'#128447', 700:'#086b35', 900:'#104d2c' } } } },
  plugins: []
};