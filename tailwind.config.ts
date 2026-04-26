import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ["var(--font-body)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"]
      },
      colors: {
        cream: "#ECECEA",
        sand: "#F5F5F2",
        walnut: "#30241F",
        ember: "#82432F",
        wood: "#4D3327"
      },
      boxShadow: {
        card: "0 14px 34px rgba(31, 31, 29, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
