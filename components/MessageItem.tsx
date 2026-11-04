import { Avatar } from "@/components/Avatar";
import { splitMentions } from "@/lib/mentions";
import type { CharacterCard, Message } from "@/lib/types";

type MessageItemProps = {
  message: Message;
  replyPreview: string | null;
  character: CharacterCard | null;
  ownerNickname: string;
  characters: CharacterCard[];
  showUnreadSeparator?: boolean;
  onAvatarClick?: (character: CharacterCard) => void;
  onRetry?: () => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function MentionText({
  text,
  characters,
  isOwner,
}: {
  text: string;
  characters: CharacterCard[];
  isOwner: boolean;
}) {
  const parts = splitMentions(text, characters);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <span
            key={`${part.value}-${i}`}
            className={
              isOwner
                ? "font-medium text-white underline decoration-white/50 underline-offset-2"
                : "font-medium text-accent"
            }
          >
            {part.value}
          </span>
        ) : (
          <span key={`t-${i}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}

export function MessageItem({
  message,
  replyPreview,
  character,
  ownerNickname,
  characters,
  showUnreadSeparator = false,
  onAvatarClick,
  onRetry,
}: MessageItemProps) {
  if (message.senderType === "system") {
    return (
      <>
        {showUnreadSeparator ? <UnreadSeparator /> : null}
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 text-center text-xs text-neutral-400 dark:text-neutral-500">
          <span>{message.text}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              重试
            </button>
          ) : null}
        </div>
      </>
    );
  }

  const isOwner = message.senderType === "owner";
  const name = isOwner ? ownerNickname : (character?.name ?? "未知");
  const avatarSrc = isOwner ? "👑" : (character?.avatar ?? "❔");

  return (
    <>
      {showUnreadSeparator ? <UnreadSeparator /> : null}
      <article
        className={`flex gap-3 px-4 py-3 ${isOwner ? "flex-row-reverse" : ""}`}
      >
        {character && onAvatarClick ? (
          <button
            type="button"
            onClick={() => onAvatarClick(character)}
            className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={`查看 ${name}`}
          >
            <Avatar src={avatarSrc} size="md" title={name} />
          </button>
        ) : (
          <Avatar src={avatarSrc} size="md" title={name} />
        )}
        <div
          className={`min-w-0 max-w-[78%] flex-1 ${isOwner ? "items-end" : ""}`}
        >
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
            <MentionText
              text={message.text}
              characters={characters}
              isOwner={isOwner}
            />
          </div>
        </div>
      </article>
    </>
  );
}

function UnreadSeparator() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      role="separator"
      aria-label="以下为新消息"
    >
      <div className="h-px flex-1 bg-accent/40" />
      <span className="shrink-0 text-[11px] font-medium tracking-wide text-accent">
        以下为新消息
      </span>
      <div className="h-px flex-1 bg-accent/40" />
    </div>
  );
}
