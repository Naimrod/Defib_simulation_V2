"use client";

import { useEffect, useState, useCallback } from "react";

export type Theme = "dark" | "light";

export function getSystemTimeTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const hours = new Date().getHours();
  // Daytime: 07:00 -> 18:59 (7 AM to 7 PM) = Light Theme
  // Nighttime: 19:00 -> 06:59 (7 PM to 7 AM) = Dark Theme
  return hours >= 7 && hours < 19 ? "light" : "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [isTimeLocked, setIsTimeLocked] = useState<boolean>(true);

  const applyTheme = useCallback((targetTheme: Theme) => {
    setThemeState(targetTheme);
    document.documentElement.setAttribute("data-theme", targetTheme);
    if (targetTheme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, []);

  useEffect(() => {
    const savedLock = localStorage.getItem("app-theme-time-lock");
    const autoLock = savedLock === null ? true : savedLock === "true";
    setIsTimeLocked(autoLock);

    if (autoLock) {
      applyTheme(getSystemTimeTheme());
    } else {
      const savedTheme = localStorage.getItem("app-theme") as Theme | null;
      applyTheme(savedTheme || "dark");
    }

    // Check system time every 60 seconds to auto-switch at 7 AM / 7 PM
    const interval = setInterval(() => {
      const lockState = localStorage.getItem("app-theme-time-lock");
      const isLocked = lockState === null ? true : lockState === "true";
      if (isLocked) {
        applyTheme(getSystemTimeTheme());
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [applyTheme]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setIsTimeLocked(false);
    localStorage.setItem("app-theme-time-lock", "false");
    applyTheme(next);
    localStorage.setItem("app-theme", next);
  };

  const lockToSystemTime = () => {
    setIsTimeLocked(true);
    localStorage.setItem("app-theme-time-lock", "true");
    applyTheme(getSystemTimeTheme());
  };

  return { theme, isTimeLocked, toggleTheme, lockToSystemTime, applyTheme };
}
