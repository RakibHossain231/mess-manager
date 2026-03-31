"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
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
];

export default function Sidebar({
  mobile = false,
  onClose,
}: {
  mobile?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose?.();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white",
        mobile ? "w-full" : "sticky top-0 hidden lg:flex"
      )}
    >
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white">
              M
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mess Manager</h2>
              <p className="text-sm text-slate-500">Smart monthly accounting</p>
            </div>
          </div>

          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sidebar"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={mobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacer to keep account section in the marked middle area */}
      <div className="flex-1" />

      {/* Account Section */}
      {/* <div className="px-4 pb-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-3">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Account
          </p> */}

          <div className="mt-2 space-y-1">
            <Link
              href="/profile"
              onClick={mobile ? onClose : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
                pathname === "/profile"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <UserCircle2 className="h-5 w-5" />
              <span>My Profile</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        {/* </div>
      </div> */}

      {/* Footer */}
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Current Month</p>

          <p className="mt-1 text-sm text-slate-600">
            <b>{monthYear}</b>
          </p>

          <p className="mt-3 text-xs text-slate-500">
            Track meals, bazar, and monthly reports from one place.
          </p>
        </div>
      </div>
    </aside>
  );
}