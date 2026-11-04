// 仅由 CLI 测试显式 --import，正常 pnpm round 不加载此文件。
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  const system = body.messages[0].content;
  let content;
  if (system.startsWith('你是「跨次元茶话会」的导演')) {
    content = JSON.stringify({
      skip: false,
      topic_keywords: ['减肥', '拖延'],
      turns: [
        { speaker: 'sun_wukong', reply_to: 'user_1', intent: '用取经经验调侃群主把行动拖到明天', tone: '调侃', length: 'short' },
        { speaker: 'zhu_bajie', reply_to: 'turn:0', intent: '接猴哥的话，自告奋勇监督却惦记省下的饭', tone: '捧场', length: 'short' },
      ],
    });
  } else {
    content = JSON.stringify({ text: system.startsWith('你就是孙悟空')
      ? '呆子减肥也挑明天。群主，你俩拜的是同一座懒山？'
      : '猴哥莫急！群主少吃的那份，俺老猪替他受累。' });
  }
  return Response.json({
    choices: [{ message: { content } }],
    // 固定测试数据，不代表真实模型用量。
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
  });
};
