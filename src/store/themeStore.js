"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { THEME_CONFIG } from "@/shared/constants/config";

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: THEME_CONFIG.defaultTheme,
      accent: "emerald",

      setTheme: (theme) => {
        set({ theme: "dark" });
        applyTheme("dark");
      },

      setAccent: (accent) => {
        set({ accent });
        applyAccent(accent);
      },

      toggleTheme: () => {
        set({ theme: "dark" });
        applyTheme("dark");
      },

      initTheme: () => {
        const { accent } = get();
        set({ theme: "dark" });
        applyTheme("dark");
        applyAccent(accent);
      },

    }),
    {
      name: THEME_CONFIG.storageKey,
    }
  )
);

const ACCENT_COLORS = {
  emerald: { primary: "#34d399", hover: "#10b981", soft: "rgba(52,211,153,.22)" },
  blue: { primary: "#60a5fa", hover: "#3b82f6", soft: "rgba(96,165,250,.22)" },
  violet: { primary: "#a78bfa", hover: "#8b5cf6", soft: "rgba(167,139,250,.22)" },
  rose: { primary: "#fb7185", hover: "#f43f5e", soft: "rgba(251,113,133,.22)" },
  amber: { primary: "#fbbf24", hover: "#f59e0b", soft: "rgba(251,191,36,.22)" },
};

function applyAccent(accent) {
  if (typeof window === "undefined") return;
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.emerald;
  const root = document.documentElement;
  root.style.setProperty("--color-primary", colors.primary);
  root.style.setProperty("--color-primary-hover", colors.hover);
  root.style.setProperty("--shadow-focus", `0 0 0 3px ${colors.soft}`);
}

// Apply theme to document
function applyTheme(theme) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  const effectiveTheme = theme === "system" ? systemTheme : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export default useThemeStore;

