"use client";

import { Bell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";

export default function Topbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
            Mess Dashboard
          </h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Manage meals, costs, and monthly settlements
          </p>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Notification */}
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700">
            <Bell className="h-5 w-5" />
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 hover:bg-slate-100"
            >
              <div className="h-8 w-8 rounded-full bg-teal-700 text-white flex items-center justify-center text-sm font-bold">
                U
              </div>
              <span className="text-sm font-medium text-slate-700">
                Profile
              </span>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-slate-200 bg-white shadow-lg">
                <Link
                  href="/profile"
                  className="block px-4 py-2 text-sm hover:bg-slate-100"
                >
                  My Profile
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-100"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}