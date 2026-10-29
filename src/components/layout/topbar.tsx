"use client";

import { Bell, Menu, Search } from "lucide-react";
import ThemeToggle from "@/components/theme/theme-toggle";

export default function Topbar({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur transition-colors dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              Mess Dashboard
            </h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Manage meals, costs, and monthly settlements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/60 md:flex">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Theme Toggle (Day/Night) */}
          <ThemeToggle />

          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 md:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
