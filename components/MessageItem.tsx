import { Avatar } from "@/components/Avatar";
import type { CharacterCard, Message } from "@/lib/types";

type MessageItemProps = {
  message: Message;
  replyPreview: string | null;
  character: CharacterCard | null;
  ownerNickname: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function MessageItem({
  message,
  replyPreview,
  character,
  ownerNickname,
}: MessageItemProps) {
  if (message.senderType === "system") {
    return (
      <div className="px-4 py-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
        {message.text}
      </div>
    );
  }

  const isOwner = message.senderType === "owner";
  const name = isOwner ? ownerNickname : (character?.name ?? "未知");
  const avatar = isOwner ? "👑" : (character?.avatar ?? "❔");

  return (
    <article
      className={`flex gap-3 px-4 py-3 ${isOwner ? "flex-row-reverse" : ""}`}
    >
      <Avatar emoji={avatar} size="md" title={name} />
      <div className={`min-w-0 max-w-[78%] flex-1 ${isOwner ? "items-end" : ""}`}>
        <div
          className={`mb-1 flex items-baseline gap-2 ${isOwner ? "flex-row-reverse" : ""}`}
        >
          <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
            {name}
          </span>
          <time
            dateTime={message.createdAt}
            className="text-[11px] text-neutral-400 dark:text-neutral-500"
          >
            {formatTime(message.createdAt)}
          </time>
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
            isOwner
              ? "ml-auto bg-accent text-white"
              : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          }`}
        >
          {replyPreview ? (
            <div
              className={`mb-2 border-l-2 pl-2 text-[12px] leading-snug ${
                isOwner
                  ? "border-white/40 text-white/80"
                  : "border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
              }`}
            >
              {replyPreview}
            </div>
          ) : null}
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      </div>
    </article>
  );
}
