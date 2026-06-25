import type { CharacterTemplate } from './game';

export type QuestionEventKind = 'reward' | 'risk' | 'special';
export type QuestionOptionTarget = 'ally';

export interface QuestionEventOption {
  id: string;
  label: string;
  description: string;
  target?: QuestionOptionTarget;
  cost?: number;
}

export interface QuestionEvent {
  id: string;
  title: string;
  kind: QuestionEventKind;
  summary: string;
  weight: number;
  options: QuestionEventOption[];
}

export const QUESTION_EVENTS: QuestionEvent[] = [
  {
    id: 'encounter_enemy',
    title: '遭遇小怪',
    kind: 'risk',
    summary: '转角处出现了临时挑战者。',
    weight: 8,
    options: [{ id: 'fight', label: '迎战小怪', description: '立刻进入一场普通战斗。' }],
  },
  {
    id: 'encounter_elite',
    title: '遭遇精英',
    kind: 'risk',
    summary: '强敌正在附近等待舞台对决。',
    weight: 5,
    options: [{ id: 'fight', label: '挑战精英', description: '立刻进入一场精英战斗。' }],
  },
  {
    id: 'lucky_fans',
    title: '幸运粉丝',
    kind: 'reward',
    summary: '热情粉丝送来应援物资。',
    weight: 16,
    options: [{ id: 'claim', label: '收下应援', description: '获得40金币。' }],
  },
  {
    id: 'free_show',
    title: '免费演出',
    kind: 'reward',
    summary: '临时舞台让队伍恢复了元气。',
    weight: 14,
    options: [{ id: 'claim', label: '登台演出', description: '全队回复15HP。' }],
  },
  {
    id: 'training',
    title: '特训',
    kind: 'reward',
    summary: '短时间集中训练，随机一名成员获得成长。',
    weight: 12,
    options: [{ id: 'claim', label: '开始特训', description: '随机角色升级1级。' }],
  },
  {
    id: 'extreme_training',
    title: '极限训练',
    kind: 'risk',
    summary: '高强度练习会消耗体力，但能换来长期战力。',
    weight: 9,
    options: [{ id: 'train', label: '接受训练', description: '全队失去10HP；全队攻击+1，持续到游戏结束。' }],
  },
  {
    id: 'idol_stream',
    title: '偶像直播',
    kind: 'risk',
    summary: '直播大获成功，同时也让下一场对手更有干劲。',
    weight: 9,
    options: [{ id: 'stream', label: '开启直播', description: '获得100金币；下一场敌人攻击+2。' }],
  },
  {
    id: 'school_festival',
    title: '学园祭',
    kind: 'risk',
    summary: '舞台机会有限，指定一名偶像成为焦点。',
    weight: 10,
    options: [{ id: 'spotlight', label: '指定偶像', description: '指定一名偶像攻击+1。', target: 'ally' }],
  },
  {
    id: 'fortune_teller',
    title: '神秘占卜师',
    kind: 'special',
    summary: '占卜师愿意用仪式强化一名成员的生命力。',
    weight: 7,
    options: [{ id: 'fortune', label: '花20金币占卜', description: '指定一位偶像生命值上限+5。', target: 'ally', cost: 20 }],
  },
  {
    id: 'student_council',
    title: '学生会检查',
    kind: 'special',
    summary: '学生会正在巡查临时演出许可。',
    weight: 7,
    options: [
      { id: 'follow_rules', label: '遵守规定', description: '失去20金币。' },
      { id: 'sneak_away', label: '偷偷溜走', description: '50%随机一名偶像攻击+2；50%无事发生。' },
    ],
  },
  {
    id: 'mystery_gacha',
    title: '神秘抽卡机',
    kind: 'special',
    summary: '老旧抽卡机闪着不稳定的光。',
    weight: 2,
    options: [{ id: 'pull', label: '花110金币抽卡', description: '随机获得白、紫或橙色角色。', cost: 110 }],
  },
];

export function getQuestionEvent(id: string | null) {
  return QUESTION_EVENTS.find((event) => event.id === id) ?? QUESTION_EVENTS[0];
}

export function getGachaRarityLabel(template: CharacterTemplate) {
  if (template.rarity === 'legendary') {
    return '橙';
  }
  if (template.rarity === 'star') {
    return '紫';
  }
  return '白';
}
