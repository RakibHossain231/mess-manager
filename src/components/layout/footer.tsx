export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 transition-colors dark:border-slate-800 dark:bg-slate-950">
      <div className="px-4 py-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          © 2026 Rakib Hossain. All rights reserved.{" "}
          <span className="mx-1">⚡</span>
          <span>
            powered by{" "}
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              Rakib
            </span>
          </span>
        </p>
      </div>
    </footer>
  );
}
