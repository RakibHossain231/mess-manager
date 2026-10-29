"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export default function ThemeToggle({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Night Mode"}
      className={`inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
      title={isDark ? "Switch to Day Mode (Light)" : "Switch to Night Mode (Dark)"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600 transition-transform duration-300 hover:-rotate-12 dark:text-slate-300" />
      )}
      {showLabel ? (
        <span className="text-sm font-medium">
          {isDark ? "Day Mode" : "Night Mode"}
        </span>
      ) : null}
    </button>
  );
}
