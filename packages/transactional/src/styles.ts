// Shared styles for all email templates

// Color palette (aligned with packages/ui/src/styles/globals.css light theme)
export const colors = {
  // Core brand tokens
  primary: "#fb8c01",
  secondary: "#4655b1",

  // Status tokens
  success: "#28a745", // unchanged
  error: "#d65f44",
  warning: "#ffc107", // unchanged
  info: "#17a2b8", // unchanged

  // Text tokens
  text: {
    primary: "#1d1b26",
    secondary: "#7a7ea8",
    muted: "#7a7ea8",
    light: "#7a7ea8",
    white: "#ffffff",
  },

  // Background tokens
  background: {
    main: "#faf9fc",
    white: "#ffffff",
    gray: "#f7f6fa",
    light: "#f3f2fa",
    info: "#f0f8ff",
    warning: "#f0f7ff",
    success: "#f0fff4",
    error: "#fff0f0",
  },

  // Border tokens
  border: {
    default: "#ececf5",
    light: "#ececf5",
  },
};

// Typography
const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

export const typography = {
  fontFamily,
  h1: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "24px",
    fontWeight: "bold",
    margin: "30px 0",
    padding: "0",
    textAlign: "center" as const,
  },
  h2: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "20px",
    fontWeight: "bold",
    margin: "20px 0",
    padding: "0",
    textAlign: "center" as const,
  },
  heroText: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "18px",
    lineHeight: "1.4",
    margin: "0 0 20px",
    textAlign: "center" as const,
  },
  body: {
    color: colors.text.secondary,
    fontFamily,
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 20px",
    textAlign: "center" as const,
    maxWidth: "450px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  small: {
    color: colors.text.muted,
    fontFamily,
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0",
    textAlign: "center" as const,
  },
  footer: {
    color: colors.text.light,
    fontFamily,
    fontSize: "12px",
    lineHeight: "16px",
    margin: "0",
    textAlign: "center" as const,
  },
};

// Layout
export const layout = {
  main: {
    backgroundColor: colors.background.main,
    padding: "10px 0",
    maxWidth: "672px",
  },
  container: {
    backgroundColor: colors.background.white,
    border: `1px solid ${colors.border.default}`,
    borderRadius: "5px",
    margin: "0 auto",
    padding: "20px 40px",
    width: "580px",
    maxWidth: "580px",
  },
  section: {
    margin: "30px 0",
  },
  logoContainer: {
    margin: "32px 0",
    textAlign: "center" as const,
  },
  logo: {
    margin: "0 auto",
  },
};

// Components
export const components = {
  button: {
    primary: {
      backgroundColor: colors.primary,
      borderRadius: "4px",
      color: colors.text.white,
      fontFamily,
      fontSize: "16px",
      fontWeight: "600",
      textDecoration: "none",
      textAlign: "center" as const,
      display: "inline-block",
      padding: "12px 24px",
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderRadius: "4px",
      color: colors.text.white,
      fontFamily,
      fontSize: "16px",
      fontWeight: "600",
      textDecoration: "none",
      textAlign: "center" as const,
      display: "inline-block",
      padding: "12px 24px",
    },
    ghost: {
      backgroundColor: "transparent",
      border: `2px solid ${colors.primary}`,
      borderRadius: "4px",
      color: colors.primary,
      fontFamily,
      fontSize: "16px",
      fontWeight: "600",
      textDecoration: "none",
      textAlign: "center" as const,
      display: "inline-block",
      padding: "10px 22px",
    },
  },
  box: {
    default: {
      background: colors.background.gray,
      border: `1px solid ${colors.border.default}`,
      borderRadius: "4px",
      margin: "30px auto",
      padding: "24px",
      maxWidth: "480px",
    },
    info: {
      background: colors.background.info,
      border: `1px solid ${colors.border.light}`,
      borderRadius: "4px",
      margin: "30px auto",
      padding: "20px",
      maxWidth: "450px",
    },
    highlight: {
      background: colors.background.light,
      borderRadius: "4px",
      margin: "30px auto",
      padding: "20px",
      textAlign: "center" as const,
      maxWidth: "450px",
    },
    gradient: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      borderRadius: "12px",
      margin: "30px auto",
      padding: "30px",
      maxWidth: "400px",
      textAlign: "center" as const,
    },
  },
  divider: {
    default: {
      border: "none",
      borderTop: `1px solid ${colors.border.default}`,
      margin: "42px 0 26px",
    },
    compact: {
      border: "none",
      borderTop: `1px solid ${colors.border.default}`,
      margin: "16px 0",
    },
    light: {
      border: "none",
      borderTop: "1px solid rgba(255, 255, 255, 0.3)",
      margin: "24px 0",
    },
  },
  link: {
    color: colors.primary,
    textDecoration: "underline",
  },
  icon: {
    large: {
      fontSize: "48px",
      margin: "0 0 10px",
      textAlign: "center" as const,
    },
    medium: {
      fontSize: "32px",
      margin: "0 0 10px",
      textAlign: "center" as const,
    },
    small: {
      fontSize: "24px",
      margin: "0 0 10px",
      textAlign: "center" as const,
    },
  },
};

// Spacing
export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
};

// Data display
export const dataDisplay = {
  row: {
    marginBottom: "12px",
  },
  label: {
    color: colors.text.muted,
    fontFamily,
    fontSize: "14px",
    fontWeight: "normal",
    textAlign: "left" as const,
    width: "50%",
  },
  value: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "14px",
    fontWeight: "500",
    textAlign: "right" as const,
    width: "50%",
  },
  totalLabel: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "16px",
    fontWeight: "bold",
    textAlign: "left" as const,
    width: "50%",
  },
  totalValue: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "16px",
    fontWeight: "bold",
    textAlign: "right" as const,
    width: "50%",
  },
};

// Table styles
export const table = {
  container: {
    background: colors.background.gray,
    borderRadius: "8px",
    padding: "16px",
    border: `1px solid ${colors.border.default}`,
  },
  header: {
    borderBottom: `2px solid ${colors.border.default}`,
    paddingBottom: "12px",
    marginBottom: "12px",
  },
  headerCell: {
    color: colors.text.muted,
    fontFamily,
    fontSize: "12px",
    fontWeight: "600",
  },
  row: {
    paddingTop: "8px",
    paddingBottom: "8px",
  },
  cell: {
    color: colors.text.primary,
    fontFamily,
    fontSize: "14px",
  },
};

// Utilities
export const utils = {
  center: {
    textAlign: "center" as const,
    margin: "0 auto",
  },
  btnContainer: {
    margin: "30px auto",
    textAlign: "center" as const,
  },
};

// Default placeholder image for examples
export const PLACEHOLDER_IMAGE =
  "https://ord.satflow.com/content/6984b0505cd1be7b958f2e4c862bd60bdf3885ab79e68a1591bcc68e940f9f46i0";

// Returns a CSS string with email-safe variables and utility classes.
// This is injected into <Head> as a <style> tag for all emails.
export const getEmailCss = () => {
  // Map token colors to CSS custom properties. Default/root acts as a dark-safe baseline,
  // with light/dark overrides via prefers-color-scheme for clients that support it.
  return `
    :root {
      --background: ${colors.background.main};
      --foreground: ${colors.text.primary};
      --card: ${colors.background.white};
      --card-foreground: ${colors.text.primary};
      --popover: ${colors.background.white};
      --popover-foreground: ${colors.text.primary};
      --primary: ${colors.primary};
      --primary-foreground: ${colors.text.white};
      --secondary: ${colors.secondary};
      --secondary-foreground: ${colors.text.white};
      --muted: ${colors.background.gray};
      --muted-foreground: ${colors.text.muted};
      --accent: ${colors.background.light};
      --accent-foreground: ${colors.text.primary};
      --destructive: ${colors.error};
      --destructive-foreground: ${colors.text.white};
      --border: ${colors.border.default};
      --ring: ${colors.primary};
    }

    @media (prefers-color-scheme: light) {
      :root {
        --background: ${colors.background.main};
        --foreground: ${colors.text.primary};
        --card: ${colors.background.white};
        --card-foreground: ${colors.text.primary};
        --popover: ${colors.background.white};
        --popover-foreground: ${colors.text.primary};
        --primary: ${colors.primary};
        --primary-foreground: ${colors.text.white};
        --secondary: ${colors.secondary};
        --secondary-foreground: ${colors.text.white};
        --muted: ${colors.background.gray};
        --muted-foreground: ${colors.text.muted};
        --accent: ${colors.background.light};
        --accent-foreground: ${colors.text.primary};
        --destructive: ${colors.error};
        --destructive-foreground: ${colors.text.white};
        --border: ${colors.border.default};
        --ring: ${colors.primary};
      }
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --background: #111827;
        --foreground: #F3F4F6;
        --card: #192339;
        --card-foreground: #F3F4F6;
        --popover: #1E2537;
        --popover-foreground: #F3F4F6;
        --primary: linear-gradient(90deg, #60A5FA 0%, #A78BFA 100%);
        --primary-foreground: #60A5FA;
        --secondary: #1E293B;
        --secondary-foreground: #F3F4F6;
        --muted: #27324a;
        --muted-foreground: #A1A1AA;
        --accent: #334155;
        --accent-foreground: #F3F4F6;
        --destructive: #F87171;
        --destructive-foreground: #F3F4F6;
        --border: #334155;
        --ring: #60A5FA;
      }
      body { background-color: var(--background) !important; color: var(--foreground) !important; }
    }

    /* Utility classes commonly useful in emails */
    .gradient-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.10);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .gradient-title {
      background: var(--primary);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      font-weight: 700;
    }
    .muted-foreground { color: var(--muted-foreground) !important; }
    .foreground { color: var(--foreground) !important; }
    a { color: ${colors.primary}; text-decoration: underline; }
  `;
};
