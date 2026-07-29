/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Layered surfaces: 950 is the page, each step up is one elevation.
        ink: {
          950: "#070a10",
          900: "#0b0f17",
          800: "#111725",
          700: "#1a2233",
          600: "#273148",
          500: "#33405c",
        },
        accent: {
          DEFAULT: "#38bdf8",
          soft: "#7dd3fc",
          deep: "#0284c7",
        },
      },
      boxShadow: {
        panel: "0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px -12px rgb(0 0 0 / 0.6)",
        pop: "0 12px 40px -12px rgb(0 0 0 / 0.8)",
        glow: "0 0 0 1px rgb(56 189 248 / 0.4), 0 0 24px -4px rgb(56 189 248 / 0.5)",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(14px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        popIn: {
          "0%": { transform: "scale(0.8)" },
          "60%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        ring: {
          "0%": { transform: "scale(0.85)", opacity: "0.65" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        indeterminate: {
          "0%": { transform: "translateX(-100%) scaleX(0.4)" },
          "50%": { transform: "translateX(20%) scaleX(0.7)" },
          "100%": { transform: "translateX(100%) scaleX(0.4)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.22s ease-out both",
        "slide-in": "slideIn 0.24s ease-out both",
        "pop-in": "popIn 0.3s ease-out",
        shimmer: "shimmer 1.6s infinite",
        ring: "ring 1.8s ease-out infinite",
        indeterminate: "indeterminate 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
