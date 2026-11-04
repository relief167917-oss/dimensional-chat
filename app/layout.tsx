import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "跨次元茶话会",
  description: "与历史与文学角色的群聊茶话会",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
