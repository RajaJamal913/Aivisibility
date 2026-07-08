/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#F7F8FA', dark: '#0B0E14' },
        surface: { DEFAULT: '#FFFFFF', dark: '#141821' },
        border: { DEFAULT: '#E4E7EC', dark: '#232833' },
        ink: { DEFAULT: '#12151C', dark: '#E8EAF0' },
        muted: { DEFAULT: '#5B6472', dark: '#8A93A6' },
        signal: {
          50: '#F2F0FE', 100: '#E4E0FD', 400: '#9C8CF9',
          500: '#7C5CFC', 600: '#6640E8', 700: '#5330BE',
        },
        // Cyan is the second half of the "radar sweep" gradient -- it's what
        // a signal looks like on a scope, not a decorative accent color.
        sweep: {
          400: '#5EEAD4', 500: '#22D3EE', 600: '#0EA5C4',
        },
        opportunity: {
          50: '#FFF4E9', 100: '#FEE4C8', 400: '#F5AE6A',
          500: '#F2994A', 600: '#D97F2F',
        },
        positive: {
          50: '#E9FBF7', 100: '#C8F3E9', 400: '#3FC2AC',
          500: '#16A394', 600: '#0E8578',
        },
        danger: { 50: '#FDECEC', 500: '#E5484D', 600: '#C93338' },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(18,21,28,0.04), 0 1px 8px -2px rgba(18,21,28,0.06)',
        'card-dark': '0 1px 2px 0 rgba(0,0,0,0.2), 0 1px 8px -2px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 10px -2px rgba(18,21,28,0.08), 0 12px 24px -8px rgba(124,92,252,0.14)',
        'card-hover-dark': '0 4px 10px -2px rgba(0,0,0,0.3), 0 12px 28px -8px rgba(34,211,238,0.10)',
        glow: '0 0 0 1px rgba(124,92,252,0.4), 0 4px 16px -2px rgba(124,92,252,0.35)',
      },
      backgroundImage: {
        sweep: 'linear-gradient(115deg, #7C5CFC 0%, #22D3EE 100%)',
        'sweep-soft': 'linear-gradient(115deg, rgba(124,92,252,0.12) 0%, rgba(34,211,238,0.12) 100%)',
      },
      keyframes: {
        radar: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        radar: 'radar 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
