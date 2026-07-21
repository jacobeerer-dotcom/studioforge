import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          void: "#080811",
          panel: "#10111f",
          panel2: "#151729",
          line: "#282b44",
          purple: "#8b5cf6",
          violet: "#a78bfa",
          cyan: "#35d0ff",
          green: "#3ddc97",
          amber: "#f6c453",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.18), 0 24px 80px rgba(6,8,24,0.55)",
        "inner-line": "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-line": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "fade-up": "fade-up 360ms ease-out both",
        "pulse-line": "pulse-line 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
