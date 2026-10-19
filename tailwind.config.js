/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        strong: "rgb(var(--strong) / <alpha-value>)",
        "strong-fg": "rgb(var(--strong-fg) / <alpha-value>)",
      },
      borderRadius: {
        squircle: "1.75rem",
        pill: "999px",
      },
      keyframes: {
        orbit: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "orbit-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(30,123,255,0.45)" },
          "70%": { boxShadow: "0 0 0 12px rgba(30,123,255,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(30,123,255,0)" },
        },
        "story-pop": {
          from: { opacity: "0", transform: "scale(0.94)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "story-progress": {
          from: { width: "0%" },
          to: { width: "100%" },
        },
      },
      animation: {
        "orbit-slow": "orbit 48s linear infinite",
        "orbit-slower": "orbit-reverse 64s linear infinite",
        "fade-up": "fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.35s ease-out both",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        "story-pop": "story-pop 0.25s ease-out both",
        "story-progress": "story-progress 5s linear forwards",
      },
    },
  },
  plugins: [],
};
