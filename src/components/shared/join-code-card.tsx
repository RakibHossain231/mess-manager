"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export default function JoinCodeInline({
  code,
}: {
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  return (
    <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
      <span className="text-xs font-medium text-slate-500">
        Joining Code
      </span>

      <span className="rounded-lg bg-teal-50 px-3 py-1 text-sm font-bold tracking-widest text-teal-700">
        {code}
      </span>

      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <Copy size={14} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}