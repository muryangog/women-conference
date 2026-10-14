import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rose: { DEFAULT: "#B8205A", deep: "#8E1747" },
        bordeaux: { DEFAULT: "#5A0C2B", soft: "#7A1C42" },
        creme: { DEFAULT: "#F8EBCB", soft: "#FCF6E6" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
