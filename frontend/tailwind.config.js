const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'accent-ai': 'var(--color-accent-ai)',
        'surface-1': 'var(--color-surface-1)',
        'surface-2': 'var(--color-surface-2)',
        'border-color': 'var(--color-border)',
      },
      fontFamily: {
        headings: ['Raleway', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-user': 'var(--gradient-user-message)',
      },
      keyframes: {
        typing: {
          "0%": {
            width: "0%",
            visibility: "hidden"
          },
          "100%": {
            width: "100%"
          }
        },
        blink: {
          "50%": {
            borderColor: "transparent"
          },
          "100%": {
            borderColor: "white"
          }
          
        },
       aurora: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '25%': { transform: 'translate(40px, -20px) scale(1.1)' },
          '50%': { transform: 'translate(0px, 30px) scale(1)' },
          '75%': { transform: 'translate(-40px, -20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        }, 
        'fade-in-down': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-10px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          },
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
        '.animation-delay-[-6s]': {
          'animation-delay': '-6s',
        },
        '.animation-delay-[-3s]': {
          'animation-delay': '-3s',
        },
      })
    })

  ],
}