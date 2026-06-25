const BOSS_BATTLE_LINES: Record<string, Partial<Record<'start' | 'win' | 'lose', string>>> = {
  boss_honoka: {
    start: '大家，一起全力上吧！',
    win: '赢啦！继续向梦想前进！',
    lose: '嘿嘿……下次一定会赢回来！',
  },
  boss_chika: {
    start: '奇迹，可不会自己出现哦！',
    win: '看来，这次幸运站在我这边呢！',
    lose: '原来……今天的奇迹属于你。',
  },
  boss_dia: {
    start: '请让我看看，你是否有站在这里的资格。',
    win: '还需要继续努力，不可懈怠。',
    lose: '看来……是我判断失误了。',
  },
  boss_hanabi: {
    start: '站位准备好了，接下来就是我的舞台。',
    win: '节奏没有乱，这就是胜利的理由。',
    lose: '这一次……你的节拍更漂亮。',
  },
  boss_kasumi: {
    start: '准备好被霞霞子迷住了吗？',
    win: '哼哼，霞霞子果然最可爱！',
    lose: '欸——怎么会这样啦！',
  },
  boss_izumi: {
    start: '目标确认，开始压制。',
    win: '核心已经被我掌握了。',
    lose: '判断失误……我会重新计算。',
  },
  boss_chisato: {
    start: '跟不上节奏的话，可是会被甩开的。',
    win: '看来，你还得再练练呢。',
    lose: '看来……这次是你更快一步。',
  },
  boss_umi: {
    start: '请正面突破我的防线。',
    win: '攻势虽强，但还不够严整。',
    lose: '漂亮的突破，我心服口服。',
  },
  boss_maki: {
    start: '别让我失望，认真一点吧。',
    win: '这种程度，可赢不了我。',
    lose: '可恶....我才不服气呢。',
  },
};


export function getBossBattleLine(templateId: string, timing: 'start' | 'win' | 'lose') {
  return BOSS_BATTLE_LINES[templateId]?.[timing] ?? null;
}
