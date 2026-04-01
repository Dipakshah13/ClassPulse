/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#a3a6ff",
        "secondary": "#62fae3",
        "tertiary": "#c180ff",
        "background": "#060e20",
        "surface": "#060e20",
        "on-surface": "#dee5ff",
        "on-surface-variant": "#a3aac4",
        "outline": "#6d758c",
        "error": "#ff6e84",
        "surface-container-low": "#091328",
        "surface-container": "#0f1930",
        "surface-container-high": "#141f38",
        "surface-container-highest": "#192540",
        "outline-variant": "rgba(163, 166, 255, 0.1)",
        "on-background": "#dee5ff",
        "on-primary": "#060e20",
        "on-secondary": "#060e20",
        "on-tertiary": "#060e20",
        "surface-bright": "#1f2b49",
      },
      fontFamily: {
        "headline": ["Plus Jakarta Sans", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"]
      },
      borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
    },
  },
  plugins: [],
}
