/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(87, 46, 255)',
          light: 'rgb(108, 75, 255)',
          dark: 'rgb(76, 40, 224)',
        },
        accent: {
          blue: 'rgb(108, 195, 244)',
          purple: 'rgb(178, 109, 205)',
          pink: 'rgb(250, 21, 166)',
        },
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(to right, rgb(87, 46, 255) 0%, rgb(54, 76, 160) 50%, rgb(87, 46, 255) 100%)',
        'accent-gradient': 'linear-gradient(to right, rgb(108, 195, 244) 0%, rgb(128, 171, 233) 17%, rgb(178, 109, 205) 53%, rgb(250, 21, 166) 100%)',
      },
    },
  },
  plugins: [],
}
