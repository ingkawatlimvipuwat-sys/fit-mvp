import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // IBM Plex Sans Thai is loaded in app/layout.tsx and exposed as --font-plex.
        sans: ["var(--font-plex)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Design tokens, spec docs/superpowers/specs/2026-11-16-ui-redesign-design.md section 3.
        page: "#F5F6F7",
        surface: "#FFFFFF",
        line: "#E3E6EA",
        control: "#C9CED6",
        field: "#8A919C",
        ink: "#14171F",
        muted: "#4A5261",
        accent: { DEFAULT: "#0B5C63", dark: "#083F44", tint: "#E4F0F1" },
        verdict: {
          "tight-bg": "#F9DDD0", "tight-fg": "#8A2F0A",
          "snug-bg": "#FCEBC5", "snug-fg": "#6B4200",
          "good-bg": "#DCEEF0", "good-fg": "#083F44",
          "loose-bg": "#E6E9ED", "loose-fg": "#2B313C",
          "unknown-fg": "#4A5261",
        },
      },
    },
  },
  plugins: [],
};
export default config;
