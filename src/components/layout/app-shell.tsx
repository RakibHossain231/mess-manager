import type { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import Footer from "@/components/layout/footer";

export default function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          <Footer />
        </div>
      </div>
    </div>
  );
}