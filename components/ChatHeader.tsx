"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { CharacterCard } from "@/lib/types";

type ChatHeaderProps = {
  groupName: string;
  members: CharacterCard[];
  onSelectCharacter: (character: CharacterCard) => void;
  onClearChat?: () => void;
};

export function ChatHeader({
  groupName,
  members,
  onSelectCharacter,
  onClearChat,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !overflowOpen) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (overflowRef.current && !overflowRef.current.contains(target)) {
        setOverflowOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, overflowOpen]);

  const shown = members.slice(0, 5);
  const rest = members.slice(5);

  return (
    <header className="shrink-0 border-b border-neutral-200/80 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-[600px] items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {groupName}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex -space-x-2">
              {shown.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectCharacter(m)}
                  className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`查看 ${m.name}`}
                  title={m.name}
                >
                  <Avatar
                    src={m.avatar}
                    size="sm"
                    title={m.name}
                    className="ring-2 ring-white transition hover:brightness-95 dark:ring-neutral-950"
                  />
                </button>
              ))}
              {rest.length > 0 ? (
                <div className="relative" ref={overflowRef}>
                  <button
                    type="button"
                    aria-label={`其余 ${rest.length} 位成员`}
                    aria-expanded={overflowOpen}
                    onClick={() => setOverflowOpen((v) => !v)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-medium text-neutral-600 ring-2 ring-white hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:ring-neutral-950 dark:hover:bg-neutral-600"
                  >
                    +{rest.length}
                  </button>
                  {overflowOpen ? (
                    <div className="absolute left-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      {rest.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                          onClick={() => {
                            setOverflowOpen(false);
                            onSelectCharacter(m);
                          }}
                        >
                          <Avatar src={m.avatar} size="sm" title={m.name} />
                          <span className="truncate text-neutral-800 dark:text-neutral-100">
                            {m.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
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
              {onClearChat ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  onClick={() => {
                    setMenuOpen(false);
                    onClearChat();
                  }}
                >
                  清空聊天
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
