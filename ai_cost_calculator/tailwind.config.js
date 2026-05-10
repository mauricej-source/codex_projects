/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: "#090a08",
        panel: "#f4ead8",
        steel: "#21323a",
        cyanline: "#f0d693",
        limecheck: "#617584",
        brass: "#d8c8a8",
      },
      boxShadow: {
        glow: "0 1px 0 rgba(255,255,255,0.25) inset, 0 18px 46px rgba(0,0,0,0.28)",
      },
    },
  },
  plugins: [],
};
