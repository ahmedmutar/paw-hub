/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FFF8F0',
          100: '#FFE5D6',
          200: '#FFBFA0',
          300: '#FF9A6C',
          400: '#FF8A52',
          500: '#FF7A3D',
          600: '#E5692E',
          700: '#CC5520',
          800: '#A84418',
          900: '#8A3010',
          950: '#5C1E08',
        },
        warm: {
          50:  '#FFF8F0',
          100: '#FFF2E4',
          200: '#F0DFD0',
          300: '#E8CFC0',
        },
        teal: {
          50:  '#D6F4F3',
          100: '#A8E9E8',
          200: '#7ADEDD',
          300: '#4CD3D2',
          400: '#3DBFB8',
          500: '#33AAA3',
          600: '#29958E',
          700: '#1F7F79',
          800: '#156A64',
          900: '#0B554F',
        },
      },
      fontFamily: {
        sans:    ['Quicksand', 'system-ui', 'sans-serif'],
        display: ['Nunito',    'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        '4xl': '1.75rem',
      },
      boxShadow: {
        card:      '0 2px 8px rgba(45,27,14,.07)',
        'card-md': '0 4px 20px rgba(45,27,14,.09)',
        'card-lg': '0 8px 40px rgba(45,27,14,.13)',
        orange:    '0 4px 14px rgba(255,122,61,.35)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
