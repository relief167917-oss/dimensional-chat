import { NextResponse } from "next/server";
import { LLMError } from "../../../server/llm";
import { runRound } from "../../../server/round";
import type { Message } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoundBody = {
  group?: {
    id?: unknown;
    name?: unknown;
    ownerNickname?: unknown;
    memberIds?: unknown;
  };
  history?: unknown;
  ownerMessage?: unknown;
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.groupId === "string" &&
    (m.senderType === "owner" ||
      m.senderType === "character" ||
      m.senderType === "system") &&
    typeof m.senderId === "string" &&
    typeof m.text === "string" &&
    (m.replyTo === null || typeof m.replyTo === "string") &&
    typeof m.createdAt === "string" &&
    typeof m.deliverAt === "string"
  );
}

function friendlyUnknown(): string {
  return "茶话会暂时冷场了，稍后再试";
}

export async function POST(request: Request) {
  // ZHIPU_API_KEY is read only inside server LLM providers — never echo it.

  let body: RoundBody;
  try {
    body = (await request.json()) as RoundBody;
  } catch {
    return NextResponse.json(
      { error: { code: "CLIENT_ERROR", message: "请求格式无效。" } },
      { status: 400 },
    );
  }

  const group = body.group;
  if (
    !group ||
    typeof group.id !== "string" ||
    typeof group.name !== "string" ||
    typeof group.ownerNickname !== "string" ||
    !Array.isArray(group.memberIds) ||
    !group.memberIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: { code: "CLIENT_ERROR", message: "群信息不完整。" } },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.history) || !body.history.every(isMessage)) {
    return NextResponse.json(
      { error: { code: "CLIENT_ERROR", message: "历史消息格式无效。" } },
      { status: 400 },
    );
  }

  if (!isMessage(body.ownerMessage) || body.ownerMessage.senderType !== "owner") {
    return NextResponse.json(
      { error: { code: "CLIENT_ERROR", message: "群主消息无效。" } },
      { status: 400 },
    );
  }

  try {
    const result = await runRound({
      group: {
        id: group.id,
        name: group.name,
        ownerNickname: group.ownerNickname,
        memberIds: group.memberIds as string[],
      },
      history: body.history,
      ownerMessage: body.ownerMessage,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      const status = error.code === "RATE_LIMIT" ? 429 : 502;
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status },
      );
    }
    console.error("[api/round] unexpected", error);
    return NextResponse.json(
      { error: { code: "UNKNOWN", message: friendlyUnknown() } },
      { status: 502 },
    );
  }
}
