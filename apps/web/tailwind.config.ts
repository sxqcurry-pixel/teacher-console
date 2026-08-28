import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import plugin from 'tailwindcss/plugin';

/**
 * Tailwind config — "橙光暗金" deep premium theme.
 * Brand tokens mirrored from ../../colors_and_type.css into CSS variables.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/shared/src/**/*.ts',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.25rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      fontFamily: {
        sans: [
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Noto Sans SC',
          'system-ui',
          'sans-serif',
        ],
        mono: ['SF Mono', 'Fira Code', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        // Note: font tabular is added via custom plugin (see plugins). Not a fontSize.
      },
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          50: 'hsl(var(--spark-orange-50))',
          100: 'hsl(var(--spark-orange-100))',
          200: 'hsl(var(--spark-orange-200))',
          300: 'hsl(var(--spark-orange-300))',
          400: 'hsl(var(--spark-orange-400))',
          500: 'hsl(var(--spark-orange-500))',
          600: 'hsl(var(--spark-orange-600))',
          700: 'hsl(var(--spark-orange-700))',
          800: 'hsl(var(--spark-orange-800))',
          900: 'hsl(var(--spark-orange-900))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-fg))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-fg))' },
        error: { DEFAULT: 'hsl(var(--error))', foreground: 'hsl(var(--error-fg))' },
        info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-fg))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      boxShadow: {
        glow: '0 0 24px hsl(var(--primary) / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.04)',
        'glow-lg': '0 0 48px hsl(var(--primary) / 0.18), inset 0 1px 0 hsl(0 0% 100% / 0.06)',
        card: '0 1px 0 hsl(0 0% 100% / 0.04) inset, 0 10px 30px -12px hsl(0 0% 0% / 0.6)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(1200px 480px at 0% -10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(800px 320px at 100% 0%, hsl(45 90% 55% / 0.12), transparent 60%)',
        'grid-dark':
          'linear-gradient(hsl(0 0% 100% / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2.2s linear infinite',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [
    animate,
    // Custom utilities kept in-sync with design tokens from globals.css / colors_and_type.css
    plugin(({ addUtilities, addComponents, theme }) => {
      addUtilities({
        '.tabular': { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum" 1' },
        '.spark-title-gradient': {
          backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          animation: 'shimmer 3.2s linear infinite',
        },
        '.spark-eyebrow': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '9999px',
          border: '1px solid hsl(var(--primary) / 0.25)',
          backgroundColor: 'hsl(var(--primary) / 0.08)',
          color: 'hsl(var(--primary))',
          fontSize: '10px',
          letterSpacing: '0.14em',
          fontWeight: '600',
          textTransform: 'uppercase',
        },
        '.spark-h3': {
          fontSize: '1.05rem',
          fontWeight: '700',
          letterSpacing: '-0.01em',
        },
        '.text-gradient-brand': {
          backgroundImage: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        },
        '.spark-card-hover': {
          transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
        },
        '.spark-card-hover:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'hsl(var(--primary) / 0.4)',
          boxShadow: '0 20px 40px -20px hsl(var(--primary) / 0.35)',
        },
        '.drop-shadow-glow': {
          filter: 'drop-shadow(0 10px 24px hsl(var(--primary) / 0.25))',
        },
      });
      // Reusable badge `gold` variant mirrored in badge component via cva
      addComponents({});
    }),
  ],
};

export default config;
