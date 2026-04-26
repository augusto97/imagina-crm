import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
    prefix: 'imcrm-',
    // NOTA: NO usar `important: '#imcrm-root'` — Radix Dialog/Popover/
    // Sheet renderizan su contenido vía Portal como hijo directo de
    // <body>, fuera de #imcrm-root. Si el selector important está
    // activo, las clases `imcrm-fixed`/`imcrm-z-50`/etc. NO aplican al
    // contenido portaleado y los dialogs caen en flujo normal al final
    // de la página. El prefix `imcrm-` ya da el aislamiento contra
    // estilos de wp-admin.
    darkMode: ['class', '[data-imcrm-theme="dark"]'],
    content: ['./app/**/*.{ts,tsx}', './src/**/*.php'],
    corePlugins: {
        preflight: false,
    },
    theme: {
        container: {
            center: true,
            padding: '1rem',
        },
        extend: {
            colors: {
                border: 'hsl(var(--imcrm-border))',
                input: 'hsl(var(--imcrm-input))',
                ring: 'hsl(var(--imcrm-ring))',
                background: 'hsl(var(--imcrm-background))',
                foreground: 'hsl(var(--imcrm-foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--imcrm-primary))',
                    foreground: 'hsl(var(--imcrm-primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--imcrm-secondary))',
                    foreground: 'hsl(var(--imcrm-secondary-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--imcrm-muted))',
                    foreground: 'hsl(var(--imcrm-muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--imcrm-accent))',
                    foreground: 'hsl(var(--imcrm-accent-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--imcrm-destructive))',
                    foreground: 'hsl(var(--imcrm-destructive-foreground))',
                },
                success: {
                    DEFAULT: 'hsl(var(--imcrm-success))',
                    foreground: 'hsl(var(--imcrm-success-foreground))',
                },
                warning: {
                    DEFAULT: 'hsl(var(--imcrm-warning))',
                    foreground: 'hsl(var(--imcrm-warning-foreground))',
                },
                info: {
                    DEFAULT: 'hsl(var(--imcrm-info))',
                    foreground: 'hsl(var(--imcrm-info-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--imcrm-card))',
                    foreground: 'hsl(var(--imcrm-card-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--imcrm-popover))',
                    foreground: 'hsl(var(--imcrm-popover-foreground))',
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--imcrm-sidebar))',
                    foreground: 'hsl(var(--imcrm-sidebar-foreground))',
                    border: 'hsl(var(--imcrm-sidebar-border))',
                    accent: 'hsl(var(--imcrm-sidebar-accent))',
                    'accent-foreground': 'hsl(var(--imcrm-sidebar-accent-foreground))',
                },
            },
            borderRadius: {
                sm: '4px',
                md: '6px',
                lg: '8px',
                xl: '12px',
            },
            fontFamily: {
                sans: [
                    'Inter',
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'Segoe UI',
                    'Roboto',
                    'Helvetica Neue',
                    'Arial',
                    'sans-serif',
                ],
                mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
            },
            letterSpacing: {
                tight: '-0.01em',
            },
            boxShadow: {
                'imcrm-sm': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
                'imcrm-md': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
                'imcrm-lg': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
            },
            keyframes: {
                'imcrm-fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'imcrm-slide-in-right': {
                    from: { transform: 'translateX(100%)' },
                    to: { transform: 'translateX(0)' },
                },
            },
            animation: {
                'imcrm-fade-in': 'imcrm-fade-in 150ms ease-out',
                'imcrm-slide-in-right': 'imcrm-slide-in-right 200ms ease-out',
            },
        },
    },
    plugins: [animate],
};

export default config;
