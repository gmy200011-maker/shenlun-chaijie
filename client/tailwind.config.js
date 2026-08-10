/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f3ee",
          100: "#e5e0d4",
          200: "#cac1ac",
          300: "#a89e83",
          400: "#7f7560",
          500: "#5e5644",
          600: "#474037",
          700: "#38332c",
          800: "#26221d",
          900: "#17140f",
          950: "#0c0a07",
        },
        ink: {
          50: "#f8f6f1",
          100: "#eeebe3",
          200: "#d8d2c5",
          300: "#b8b0a0",
          400: "#8e8775",
          500: "#6e6757",
          600: "#544e42",
          700: "#3f3a32",
          800: "#2a2620",
          900: "#1a1814",
          950: "#0e0d0a",
        },
        seal: {
          50: "#fdf5f3",
          100: "#fbe8e4",
          200: "#f6ccc4",
          300: "#eea69a",
          400: "#e27a68",
          500: "#d05a47",
          600: "#bb4434",
          700: "#9c3729",
          800: "#7e3127",
          900: "#682d24",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        kai: ['"Kaiti SC"', '"STKaiti"', "KaiTi", "serif"],
      },
    },
  },
  plugins: [],
};
