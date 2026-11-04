/** 角色声音设定：说话风格、自称与口头禅 */
export type CharacterVoice = {
  style: string;
  selfReference: string;
  catchphrases: string[];
};

/** 角色与其他角色的关系 */
export type CharacterRelation = {
  target: string;
  label: string;
  nickname: string;
};

/** 角色名片：展示用的角色基础信息 */
export type CharacterCard = {
  id: string;
  name: string;
  aliases: string[];
  world: string;
  tagline: string;
  avatar: string;
  voice: CharacterVoice;
  relations: CharacterRelation[];
};

/** 群聊：群主与成员列表 */
export type Group = {
  id: string;
  name: string;
  ownerNickname: string;
  memberIds: string[];
  createdAt: string;
};

/** 消息发送方类型 */
export type SenderType = "owner" | "character" | "system";

/** 群聊消息 */
export type Message = {
  id: string;
  groupId: string;
  senderType: SenderType;
  senderId: string;
  text: string;
  replyTo: string | null;
  createdAt: string;
  deliverAt: string;
};

/** 导演单轮发言计划 */
export type DirectorTurn = {
  speaker: string;
  replyTo: string | "turn:0" | null;
  intent: string;
  tone: string;
  length: "short" | "medium";
};

/** 导演整轮计划：可跳过，最多 2 个发言回合 */
export type DirectorPlan = {
  skip: boolean;
  skipReason?: string;
  topicKeywords: string[];
  turns: DirectorTurn[];
};
