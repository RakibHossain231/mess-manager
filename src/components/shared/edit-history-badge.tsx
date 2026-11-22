"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { History, X } from "lucide-react";

export type ActivityLogEntry = {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export type BasicMember = {
  id: string;
  user_id?: string | null;
  full_name: string;
  role: string;
};

export default function EditHistoryBadge({
  logs = [],
  members = [],
  align = "left",
}: {
  logs?: ActivityLogEntry[];
  members?: BasicMember[];
  align?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 24);

    let left = rect.left;
    if (align === "right") {
      left = rect.right - popoverWidth;
    }

    // Clamp horizontally to stay within viewport
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    // Determine vertical placement: popover height ~ 260px
    const popoverHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      // Place ABOVE button
      setPosition({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width: popoverWidth,
        placement: "top",
      });
    } else {
      // Place BELOW button
      setPosition({
        top: rect.bottom + 6,
        left,
        width: popoverWidth,
        placement: "bottom",
      });
    }
  };

  // Recalculate on open, resize, or scroll
  useEffect(() => {
    if (!isOpen) return;

    calculatePosition();

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, align]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!logs || logs.length === 0) {
    return null;
  }

  // Sort newest first
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          calculatePosition();
          setIsOpen((prev) => !prev);
        }}
        title="View edit history"
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60 transition shadow-xs cursor-pointer border border-amber-200/80 dark:border-amber-800/80"
      >
        <History className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        <span>Edited</span>
      </button>

      {isOpen &&
        position &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: position.top !== undefined ? `${position.top}px` : undefined,
              bottom:
                position.bottom !== undefined
                  ? `${position.bottom}px`
                  : undefined,
              left: `${position.left}px`,
              width: `${position.width}px`,
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  Edit History ({sortedLogs.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 max-h-64 space-y-3 overflow-y-auto pr-1 text-xs custom-scrollbar">
              {sortedLogs.map((log) => {
                const actor = members.find(
                  (m) =>
                    (log.actor_user_id && m.user_id === log.actor_user_id) ||
                    (log.actor_user_id && m.id === log.actor_user_id)
                );

                const actorName = actor?.full_name || "Admin/Manager";
                const actorRole = actor?.role || "";

                const dateStr = new Date(log.created_at).toLocaleString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }
                );

                const oldData = log.old_data ?? {};
                const newData = log.new_data ?? {};

                const amountChanged =
                  oldData.amount !== undefined &&
                  newData.amount !== undefined &&
                  Number(oldData.amount) !== Number(newData.amount);

                const dateChanged =
                  oldData.date !== undefined &&
                  newData.date !== undefined &&
                  oldData.date !== newData.date;

                const noteChanged =
                  oldData.note !== undefined &&
                  newData.note !== undefined &&
                  String(oldData.note ?? "").trim() !==
                    String(newData.note ?? "").trim();

                const ownMealChanged =
                  oldData.own_meal !== undefined &&
                  newData.own_meal !== undefined &&
                  Number(oldData.own_meal) !== Number(newData.own_meal);

                const guestMealChanged =
                  oldData.guest_meal !== undefined &&
                  newData.guest_meal !== undefined &&
                  Number(oldData.guest_meal) !== Number(newData.guest_meal);

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {actorName}{" "}
                        {actorRole ? (
                          <span className="font-normal text-slate-500 capitalize">
                            ({actorRole})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1.5 text-[11px] leading-snug">
                      {amountChanged && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">Amount:</span>
                          <span className="line-through text-red-500">
                            ৳ {Number(oldData.amount)}
                          </span>
                          <span>➔</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            ৳ {Number(newData.amount)}
                          </span>
                        </div>
                      )}

                      {dateChanged && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">Date:</span>
                          <span className="line-through text-slate-400">
                            {String(oldData.date)}
                          </span>
                          <span>➔</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {String(newData.date)}
                          </span>
                        </div>
                      )}

                      {noteChanged && (
                        <div className="space-y-1">
                          <span className="text-slate-500 font-medium block">
                            Note:
                          </span>
                          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-2 dark:border-slate-700/60 dark:bg-slate-900/80 space-y-1.5">
                            <div>
                              <span className="text-[10px] font-semibold text-red-500 block">
                                Old:
                              </span>
                              <span className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-slate-400 line-through custom-scrollbar">
                                &quot;{String(oldData.note || "none")}&quot;
                              </span>
                            </div>
                            <div className="border-t border-slate-100 pt-1.5 dark:border-slate-800">
                              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 block">
                                New:
                              </span>
                              <span className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-medium text-slate-700 dark:text-slate-200 custom-scrollbar">
                                &quot;{String(newData.note || "none")}&quot;
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {(ownMealChanged || guestMealChanged) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500">Meals:</span>
                          <span className="line-through text-red-500">
                            {Number(oldData.own_meal || 0)} own
                            {Number(oldData.guest_meal || 0) > 0
                              ? ` + ${oldData.guest_meal} guest`
                              : ""}
                          </span>
                          <span>➔</span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {Number(newData.own_meal || 0)} own
                            {Number(newData.guest_meal || 0) > 0
                              ? ` + ${newData.guest_meal} guest`
                              : ""}
                          </span>
                        </div>
                      )}

                      {!amountChanged &&
                        !dateChanged &&
                        !noteChanged &&
                        !ownMealChanged &&
                        !guestMealChanged && (
                          <div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                            <p className="font-medium">No values were changed</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              (Saved without modifying amount, date, or note)
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
