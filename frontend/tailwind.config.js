import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background, #0f172a)',
        'text-primary': 'var(--color-text-primary, #f8fafc)',
        'text-secondary': 'var(--color-text-secondary, #94a3b8)',
        'accent-ai': '#16a34a',
        'surface-1': 'var(--color-surface-1, #1e293b)',
        'surface-2': 'var(--color-surface-2, #0f172a)',
        'border-color': 'var(--color-border, #334155)',
      },
      fontFamily: {
        headings: ['Raleway', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-user': 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
      },
      keyframes: {
        typing: {
          "0%": { width: "0%", visibility: "hidden" },
          "100%": { width: "100%" }
        },
        blink: {
          "50%": { borderColor: "transparent" },
          "100%": { borderColor: "white" }
        },
       aurora: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '25%': { transform: 'translate(40px, -20px) scale(1.1)' },
          '50%': { transform: 'translate(0px, 30px) scale(1)' },
          '75%': { transform: 'translate(-40px, -20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },

      animation: {
        'spin-slow': 'spin-slow 8s linear infinite',
        aurora: 'aurora 20s ease-in-out infinite',
        typing: "typing 2s steps(20) infinite alternate, blink .7s infinite"
      }
    },
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({
        '.animation-delay-[-6s]': { 'animation-delay': '-6s' },
        '.animation-delay-[-3s]': { 'animation-delay': '-3s' },
      })
    })
  ],
}