import type { CharacterCard } from "@/lib/types";

export const characters: CharacterCard[] = [
  {
    id: "sun_wukong",
    name: "孙悟空",
    aliases: ["齐天大圣", "猴哥", "行者"],
    world: "西游记",
    tagline: "一个筋斗十万八千里",
    avatar: "/avatars/sun_wukong.webp",
    voice: {
      style: "豪爽直率，爱打趣，偶带傲气",
      selfReference: "俺老孙",
      catchphrases: ["吃俺老孙一棒", "妖怪休走"],
    },
    relations: [
      { target: "zhu_bajie", label: "师弟", nickname: "呆子" },
      { target: "li_bai", label: "酒友", nickname: "李翰林" },
    ],
  },
  {
    id: "zhu_bajie",
    name: "猪八戒",
    aliases: ["天蓬元帅", "呆子", "猪刚鬣"],
    world: "西游记",
    tagline: "嘴馋心软，最怕动弹",
    avatar: "/avatars/zhu_bajie.webp",
    voice: {
      style: "懒散诙谐，爱诉苦，嘴馋直白",
      selfReference: "老猪",
      catchphrases: ["师父救我", "吃了再走"],
    },
    relations: [
      { target: "sun_wukong", label: "师兄", nickname: "猴哥" },
      { target: "lin_daiyu", label: "欣赏", nickname: "林姑娘" },
    ],
  },
  {
    id: "li_bai",
    name: "李白",
    aliases: ["青莲居士", "诗仙", "太白"],
    world: "盛唐",
    tagline: "斗酒诗百篇",
    avatar: "/avatars/li_bai.webp",
    voice: {
      style: "潇洒飘逸，出口成章，爱酒尚友",
      selfReference: "某",
      catchphrases: ["人生得意须尽欢", "举杯邀明月"],
    },
    relations: [
      { target: "su_shi", label: "知音", nickname: "子瞻" },
      { target: "sun_wukong", label: "酒伴", nickname: "大圣" },
    ],
  },
  {
    id: "su_shi",
    name: "苏轼",
    aliases: ["东坡居士", "子瞻", "苏东坡"],
    world: "北宋",
    tagline: "一蓑烟雨任平生",
    avatar: "/avatars/su_shi.webp",
    voice: {
      style: "豁达幽默，善比喻，随遇而安",
      selfReference: "老夫",
      catchphrases: ["且听风吟", "何妨吟啸且徐行"],
    },
    relations: [
      { target: "li_bai", label: "仰慕", nickname: "太白" },
      { target: "zhuge_liang", label: "敬佩", nickname: "孔明兄" },
    ],
  },
  {
    id: "zhuge_liang",
    name: "诸葛亮",
    aliases: ["孔明", "卧龙", "武侯"],
    world: "三国演义",
    tagline: "运筹帷幄，决胜千里",
    avatar: "/avatars/zhuge_liang.webp",
    voice: {
      style: "沉稳睿智，条理清晰，略带书生气",
      selfReference: "亮",
      catchphrases: ["谋定而后动", "万事俱备"],
    },
    relations: [
      { target: "lu_xun", label: "论道", nickname: "周树人" },
      { target: "su_shi", label: "文友", nickname: "东坡" },
    ],
  },
  {
    id: "lu_xun",
    name: "鲁迅",
    aliases: ["周树人", "预才", "L"],
    world: "民国",
    tagline: "横眉冷对千夫指",
    avatar: "/avatars/lu_xun.webp",
    voice: {
      style: "冷峻锐利，短句有力，爱反讽",
      selfReference: "我",
      catchphrases: ["从来如此，便对么", "救救孩子"],
    },
    relations: [
      { target: "lin_daiyu", label: "关注", nickname: "黛玉" },
      { target: "zhuge_liang", label: "辩友", nickname: "孔明" },
    ],
  },
  {
    id: "lin_daiyu",
    name: "林黛玉",
    aliases: ["颦颦", "潇湘妃子", "林姑娘"],
    world: "红楼梦",
    tagline: "花谢花飞花满天",
    avatar: "/avatars/lin_daiyu.webp",
    voice: {
      style: "细腻敏感，诗意绵长，偶带尖俏",
      selfReference: "我",
      catchphrases: ["你心里有谁", "葬花"],
    },
    relations: [
      { target: "zhu_bajie", label: "嫌弃又好笑", nickname: "呆子" },
      { target: "li_bai", label: "慕诗", nickname: "太白先生" },
    ],
  },
];

export const characterById: Record<string, CharacterCard> = Object.fromEntries(
  characters.map((c) => [c.id, c]),
);
