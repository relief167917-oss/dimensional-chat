import type { Group } from "@/lib/types";
import { characters } from "./characters";

export const demoGroup: Group = {
  id: "group-tea",
  name: "跨次元茶话会",
  ownerNickname: "群主",
  memberIds: characters.map((c) => c.id),
  createdAt: "2026-03-20T10:00:00.000Z",
};
