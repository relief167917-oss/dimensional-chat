import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-[600px] px-5 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          返回群聊
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">
          关于跨次元茶话会
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-300">
          「跨次元茶话会」是一个网页群聊产品：你作为群主，与一群由 AI
          扮演的历史、文学角色一起聊天。首批角色包括孙悟空、猪八戒、李白、苏轼、诸葛亮、鲁迅、林黛玉——大家围坐一桌，接梗、抬杠、偶尔认真。
        </p>
        <p className="mt-4 text-[15px] leading-7 text-neutral-600 dark:text-neutral-300">
          当前版本已接入本地导演轮次（
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            POST /api/round
          </code>
          ）。请用
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            pnpm dev
          </code>
          运行，并在根目录
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            .env.local
          </code>
          配置
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
            ZHIPU_API_KEY
          </code>
          。消息保存在浏览器 localStorage。
        </p>

        <div className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <p className="text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            AI 虚构演绎，与真实人物无关
          </p>
        </div>
      </div>
    </main>
  );
}
