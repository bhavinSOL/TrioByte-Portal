import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "accent";

const STORAGE_KEY = "triobyte-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "theme-accent");
  if (theme === "dark") root.classList.add("dark");
  if (theme === "accent") root.classList.add("theme-accent");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "light";
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  };

  return { theme, setTheme };
}

export type { Theme };
