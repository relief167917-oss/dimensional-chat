"use client";

import { useEffect } from "react";
import type { CharacterCard } from "@/lib/types";

type CharacterSheetProps = {
  character: CharacterCard | null;
  onClose: () => void;
};

export function CharacterSheet({ character, onClose }: CharacterSheetProps) {
  useEffect(() => {
    if (!character) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [character, onClose]);

  if (!character) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="关闭角色卡片"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-sheet-title"
        className="relative z-10 w-full max-w-[600px] animate-sheet-up rounded-t-2xl border border-neutral-200 bg-white px-5 pb-8 pt-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 sm:mx-4 sm:rounded-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 sm:hidden" />
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export avatar */}
          <img
            src={character.avatar}
            alt={character.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="character-sheet-title"
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-50"
            >
              {character.name}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              {character.world}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-200">
              {character.tagline}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {character.aliases.length > 0 ? (
          <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
            又名 {character.aliases.join(" · ")}
          </p>
        ) : null}

        <div className="mt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            口头禅
          </h3>
          <ul className="mt-2 space-y-2">
            {character.voice.catchphrases.map((phrase) => (
              <li
                key={phrase}
                className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                「{phrase}」
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-xs leading-5 text-neutral-400 dark:text-neutral-500">
          说话风格：{character.voice.style} · 自称「{character.voice.selfReference}」
        </p>
      </div>
    </div>
  );
}
