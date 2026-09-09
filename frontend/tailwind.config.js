/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        purpleLight: {
          50: '#faf5ff',
          400: '#a78bfa',
          600: '#7c3aed',
          700: '#9333ea',
        },
        quantum: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        navy: {
          800: "#1e293b",
          850: "#111827",
          900: "#0f172a",
          950: "#090d16",
        },
        neon: {
          cyan: "#00f0ff",
          purple: "#9d4edd",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        }
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.2), 0 0 10px rgba(0, 240, 255, 0.1)" },
          "100%": { boxShadow: "0 0 15px rgba(0, 240, 255, 0.6), 0 0 25px rgba(0, 240, 255, 0.3)" },
        }
      }
    },
  },
  plugins: [],
}
