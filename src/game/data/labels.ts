import type { BattleType, GroupId, IdolRarity, NodeType, RoleId } from '../types';

export const GROUP_LABELS: Record<GroupId, string> = {
  cute: '可爱甜心',
  silver: '古灵精怪',
  president: '风纪委员',
  mystery: '命运之子',
};


export const RARITY_LABELS: Record<IdolRarity, string> = {
  legendary: '传奇偶像',
  star: '明星偶像',
  normal: '普通偶像',
  enemy: '小怪',
  elite: '精英',
  boss: 'Boss',
};

export const ROLE_LABELS: Record<RoleId, string> = {
  tank: '坦克',
  fighter: '战士',
  assassin: '刺客',
  support: '辅助',
};

export const ROLE_DAMAGE_MULTIPLIERS: Record<RoleId, number> = {
  tank: 1,
  fighter: 0.9,
  assassin: 0.7,
  support: 1.2,
};

export const NODE_LABELS: Record<NodeType, string> = {
  battle: '战斗',
  elite: '精英战',
  shop: '商店',
  rest: '休息处',
  boss: 'Boss',
};

export const REWARD_GOLD: Record<BattleType, number> = {
  battle: 8,
  elite: 35,
  boss: 60,
};
