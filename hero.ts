import { heroui } from "@heroui/theme";

export default heroui({
  themes: {
    dark: {
      colors: {
        background: "#0b0d12",
        primary: { DEFAULT: "#6366f1", foreground: "#ffffff" },
        success: { DEFAULT: "#22c55e", foreground: "#04170a" },
        danger: { DEFAULT: "#f43f5e", foreground: "#ffffff" },
      },
    },
    light: {
      colors: {
        primary: { DEFAULT: "#4f46e5", foreground: "#ffffff" },
      },
    },
  },
});
