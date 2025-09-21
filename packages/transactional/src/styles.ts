// Shared styles for all email templates

// Color palette
export const colors = {
  primary: "#007bff", // Satflow blue
  secondary: "#667eea", // Purple accent
  success: "#28a745", // Green for positive actions
  error: "#dc3545", // Red for errors/warnings
  warning: "#ffc107", // Yellow for alerts
  info: "#17a2b8", // Light blue for info
  text: {
    primary: "#333",
    secondary: "#555",
    muted: "#666",
    light: "#8898aa",
    white: "#ffffff",
  },
  background: {
    main: "#f6f9fc",
    white: "#ffffff",
    gray: "#f8f9fa",
    light: "#f4f7fa",
    info: "#f0f8ff",
    warning: "#f0f7ff",
    success: "#f0fff4",
    error: "#fff0f0",
  },
  border: {
    default: "#e6ebf1",
    light: "#cce5ff",
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
  },
  container: {
    backgroundColor: colors.background.white,
    border: `1px solid ${colors.border.default}`,
    borderRadius: "5px",
    margin: "0 auto",
    padding: "20px 40px",
    width: "580px",
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
