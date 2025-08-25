/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          pink: '#ff00ea',
          blue: '#00e5ff',
          green: '#00ffa3',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(0,229,255,0.5), 0 0 40px rgba(0,229,255,0.25)',
      },
      animation: {
        spinSlow: 'spin 6s linear infinite',
        float: 'float 6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 0 rgba(0,229,255,0.0))' },
          '50%': { filter: 'drop-shadow(0 0 20px rgba(0,229,255,0.6))' },
        },
      },
    },
  },
  plugins: [],
}
