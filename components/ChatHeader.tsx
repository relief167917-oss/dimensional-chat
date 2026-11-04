"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { CharacterCard } from "@/lib/types";

type ChatHeaderProps = {
  groupName: string;
  members: CharacterCard[];
};

export function ChatHeader({ groupName, members }: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const shown = members.slice(0, 5);
  const extra = Math.max(0, members.length - shown.length);

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-[600px] items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {groupName}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex -space-x-2">
              {shown.map((m) => (
                <Avatar
                  key={m.id}
                  emoji={m.avatar}
                  size="sm"
                  title={m.name}
                  className="ring-2 ring-white dark:ring-neutral-950"
                />
              ))}
              {extra > 0 ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-600 ring-2 ring-white dark:bg-neutral-700 dark:text-neutral-200 dark:ring-neutral-950">
                  +{extra}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {members.length} 位成员
            </span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-label="更多"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <circle cx="5" cy="12" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="19" cy="12" r="1.75" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              <Link
                href="/about"
                className="block px-3 py-2.5 text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                onClick={() => setMenuOpen(false)}
              >
                关于
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
