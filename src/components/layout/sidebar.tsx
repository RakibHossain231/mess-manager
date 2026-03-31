"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  Receipt,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function Sidebar() {
  const pathname = usePathname();

  // ✅ Dynamic current month
  const currentDate = new Date();
  const monthYear = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white">
            M
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Mess Manager
            </h2>
            <p className="text-sm text-slate-500">
              Smart monthly accounting
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
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

      {/* Footer */}
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Current Month
          </p>

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