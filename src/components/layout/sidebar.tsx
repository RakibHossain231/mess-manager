"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Receipt,
  UserCircle2,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme/theme-toggle";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Members",
    href: "/members",
    icon: Users,
  },
  {
    label: "Meals",
    href: "/meals",
    icon: UtensilsCrossed,
  },
  {
    label: "Expenses",
    href: "/expenses",
    icon: Receipt,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    label: "Closed Month Settlement",
    href: "/closed-month-settlement",
    icon: CircleDollarSign,
  },
];

export default function Sidebar({
  mobile = false,
  onClose,
}: {
  mobile?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const [userName, setUserName] = useState("User");

  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    try {
      const cached = localStorage.getItem("mm_cached_username");
      if (cached) setUserName(cached);
    } catch {
      // Ignore localStorage errors
    }

    const supabase = createClient();

    async function getUser() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) return;

      const metadata = data.user.user_metadata ?? {};

      const resolvedName =
        metadata.name ||
        metadata.full_name ||
        metadata.display_name ||
        data.user.email?.split("@")[0] ||
        "User";

      const finalName = String(resolvedName);
      setUserName(finalName);
      try {
        localStorage.setItem("mm_cached_username", finalName);
      } catch {
        // Ignore localStorage errors
      }
    }

    getUser();
  }, []);

  async function handleLogout() {
    try {
      localStorage.removeItem("mm_cached_username");
    } catch {
      // Ignore localStorage errors
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose?.();
    window.location.href = "/login";
  }

  return (
    <aside
      className={cn(
        "flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900",
        mobile ? "w-full" : "sticky top-0 hidden lg:flex"
      )}
    >
      <div className="border-b border-slate-200 px-6 py-6 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/profile"
            prefetch={true}
            onClick={mobile ? onClose : undefined}
            className="flex min-w-0 items-center gap-3 rounded-2xl transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 dark:text-white">
                {userName}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Smart monthly accounting</p>
            </div>
          </Link>

          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <nav className="space-y-2 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              onClick={mobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="mt-4 px-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account
            </p>
            <ThemeToggle className="!p-1.5 !rounded-xl" />
          </div>

          <div className="mt-2 space-y-1">
            <Link
              href="/profile"
              prefetch={true}
              onClick={mobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                pathname === "/profile"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <UserCircle2 className="h-5 w-5" />
              <span>My Profile</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Current Month</p>

          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            <b>{monthYear}</b>
          </p>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Track meals, bazar, reports, and closed month settlements from one
            place.
          </p>
        </div>
      </div>
    </aside>
  );
}
