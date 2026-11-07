/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#171313',
        accent: '#B51224',
        dark: '#171313',
        light: '#F5EFE2',
        brand: {
          red: '#B51224',
          charcoal: '#171313',
          cream: '#F5EFE2',
          orange: '#F28C18',
          purple: '#7B19B5',
          'deep-purple': '#4B087A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
