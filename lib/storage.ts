import type { Message } from "@/lib/types";

export function messagesStorageKey(groupId: string): string {
  return `dc:messages:${groupId}`;
}

export function loadMessages(groupId: string): Message[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(messagesStorageKey(groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as Message[];
  } catch {
    return null;
  }
}

export function saveMessages(groupId: string, messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      messagesStorageKey(groupId),
      JSON.stringify(messages),
    );
  } catch {
    // quota / private mode — ignore
  }
}

export function clearMessages(groupId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(messagesStorageKey(groupId));
  } catch {
    // ignore
  }
}
