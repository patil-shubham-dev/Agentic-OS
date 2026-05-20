// Product branding configuration
// Single source of truth for AgentOS Studio branding

export const productName = "AGENTOS STUDIO";
export const productShortName = "AgentOS";
export const productTagline = "AI Operating System for Developers";

export const branding = {
  name: productName,
  shortName: productShortName,
  tagline: productTagline,
  website: "https://agentos.ai",
  socialImage: "/og-image.png",
};

export const colors = {
  // Primary brand colors - amber/gold theme
  primary: {
    main: "#f59e0b",      // Amber 500
    light: "#fbbf24",     // Amber 400
    dark: "#d97706",      // Amber 600
    foreground: "#ffffff",
  },
  // Secondary colors
  secondary: {
    main: "#ea580c",      // Orange 600
    light: "#f97316",     // Orange 500
    dark: "#c2410c",     // Orange 700
  },
  // Background colors
  background: {
    main: "#fffbeb",     // Amber 50
    muted: "#fef3c7",     // Amber 100
    border: "#fde68a",    // Amber 200
  },
  // Text colors
  text: {
    primary: "#92400e",   // Amber 800
    secondary: "#b45309", // Amber 700
    muted: "#d97706",     // Amber 600
  },
  // Status colors
  status: {
    ready: "#10b981",    // Emerald 500
    setup: "#f59e0b",    // Amber 500
  },
};

export const appConfig = {
  // Window configuration
  window: {
    minWidth: 900,
    minHeight: 600,
    defaultWidth: 1200,
    defaultHeight: 800,
    title: productName,
  },
  // Icon paths - will be updated with actual icon
  icons: {
    favicon: "/favicon.ico",
    icon16: "/favicon-16x16.png",
    icon32: "/favicon-32x32.png",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    appleTouch: "/apple-touch-icon.png",
  },
  // Desktop icons - will be generated from master logo
  desktopIcons: {
    windows: "/icon.ico",
    macos: "/icon.icns",
    linux: "/icon.png",
  },
};