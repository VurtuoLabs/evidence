/**
 * Evidence visual identity - deliberately off the SLDS blue so the record
 * reads as a formal ledger, not a dashboard. Autonomy is the product's
 * signature metric, so violet leads.
 *
 * Colors resolve through CSS custom properties (defined in
 * src/design-system/globals.css) so the same tokens drive light and dark.
 * Raw brand hexes for reference:
 *   primary  #6D28D9   primary-dark #4C1D95   accent #A855F7   autonomy #7C3AED
 *   success  #2E844A   warning #B45309        error  #B91C1C
 *   page     #F5F3F8   surface #FFFFFF        border #E7E2EE   text #1C1626
 */
var config = {
    darkMode: "class",
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        container: {
            center: true,
            padding: "1.25rem",
            screens: { "2xl": "1440px" },
        },
        extend: {
            colors: {
                border: "hsl(var(--border) / <alpha-value>)",
                "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
                input: "hsl(var(--input) / <alpha-value>)",
                ring: "hsl(var(--ring) / <alpha-value>)",
                background: "hsl(var(--background) / <alpha-value>)",
                foreground: "hsl(var(--foreground) / <alpha-value>)",
                primary: {
                    DEFAULT: "hsl(var(--primary) / <alpha-value>)",
                    dark: "hsl(var(--primary-dark) / <alpha-value>)",
                    foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
                    foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent) / <alpha-value>)",
                    foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
                },
                autonomy: "hsl(var(--autonomy) / <alpha-value>)",
                muted: {
                    DEFAULT: "hsl(var(--muted) / <alpha-value>)",
                    foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
                },
                card: {
                    DEFAULT: "hsl(var(--card) / <alpha-value>)",
                    foreground: "hsl(var(--card-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover) / <alpha-value>)",
                    foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
                },
                success: {
                    DEFAULT: "hsl(var(--success) / <alpha-value>)",
                    foreground: "hsl(var(--success-foreground) / <alpha-value>)",
                },
                warning: {
                    DEFAULT: "hsl(var(--warning) / <alpha-value>)",
                    foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
                    foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
                },
                /* Provenance badges - the product's core distinction. */
                observed: "hsl(var(--observed) / <alpha-value>)",
                declared: "hsl(var(--declared) / <alpha-value>)",
            },
            /* Inter everywhere. `display`, `serif`, and `mono` are kept as aliases so
               existing font-display / font-mono classes still resolve - pointing them
               at a serif or monospace stack would reintroduce the mixed typography. */
            fontFamily: {
                sans: ["Inter", "-apple-system", "system-ui", "Arial", "sans-serif"],
                display: ["Inter", "-apple-system", "system-ui", "Arial", "sans-serif"],
                serif: ["Inter", "-apple-system", "system-ui", "Arial", "sans-serif"],
                mono: ["Inter", "-apple-system", "system-ui", "Arial", "sans-serif"],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 1px)",
                sm: "calc(var(--radius) - 2px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [],
};
export default config;
