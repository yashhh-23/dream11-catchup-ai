import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        display: ["'Barlow Condensed'", "'Rajdhani'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      colors: {
        brand: {
          bg: "#0E1116",
          surface: "#161B22",
          surfaceHover: "#1C2128",
          border: "#262C36",
          muted: "#8B949E",
          red: "#E11D48",
          redHover: "#BE123C",
        },
      },
      borderRadius: {
        container: "12px",
        chip: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
