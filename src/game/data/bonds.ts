import type { BondGroup, SecondaryBond } from '../types';

export const BOND_GROUPS: BondGroup[] = [
  {
    id: 'cute',
    name: '可爱甜心',
    theme: '攻击 / 暴击',
    memberIds: ['ayumu', 'rina', 'nico'],
    level2Name: '萌力扩散',
    level2Description: '全队攻击+2。',
    level3Name: '世界第一偶像',
    level3Description: '全队暴击率+15%。',
  },
  {
    id: 'silver',
    name: '古灵精怪',
    theme: '灰毛 / 首次伤害 / 爆发',
    memberIds: ['keke', 'kotori', 'you'],
    level2Name: '灰毛共振',
    level2Description: '灰毛成员首次造成伤害时，伤害提高25%。',
    level3Name: '灵感全开',
    level3Description: '灰毛成员首次造成伤害时，伤害提高50%。',
  },
  {
    id: 'president',
    name: '风纪委员',
    theme: '护盾 / 免疫 / 防御',
    memberIds: ['eli', 'mari', 'ren'],
    level2Name: '纪律委员会',
    level2Description: '风纪委员受到伤害-3。',
    level3Name: '领袖风范',
    level3Description: '风纪委员开场获得20%最大生命护盾。',
  },
  {
    id: 'mystery',
    name: '命运之子',
    theme: '生命 / 梦境 / 共鸣',
    memberIds: ['kanata', 'yoshiko', 'nozomi'],
    level2Name: '梦境共鸣',
    level2Description: '全队生命值上限+10。',
    level3Name: '命运共鸣',
    level3Description: '全队生命值上限+20。',
  },
];

export const SECONDARY_BONDS: SecondaryBond[] = [
  {
    id: 'little_devil',
    name: '小恶魔',
    memberIds: ['nico', 'yoshiko'],
    description: '暴击时附加5层毒。',
  },
  {
    id: 'nozoeli',
    name: '绘希',
    memberIds: ['eli', 'nozomi'],
    description: '开场获得15%最大生命值护盾。',
  },
  {
    id: 'angel',
    name: '天使',
    memberIds: ['ayumu', 'kotori'],
    description: '战斗结束恢复15%生命。',
  },
  {
    id: 'dreamer',
    name: '梦想家',
    memberIds: ['keke', 'kanata'],
    description: '每经过一个节点，可可与彼方均获得+1攻击、+1速度和+5最大生命。',
  },
  {
    id: 'lucky_star',
    name: '幸运星',
    memberIds: ['mari', 'nozomi'],
    description: '战斗胜利后额外获得随机奖励。',
  },
  {
    id: 'campus_leader',
    name: '校园领袖',
    memberIds: ['ren', 'ayumu'],
    description: '首次攻击造成1.5倍伤害。',
  },
  {
    id: 'full_speed',
    name: '全速模式',
    memberIds: ['you', 'rina'],
    description: '全队速度+5。',
  },
  {
    id: 'energetic_idol',
    name: '元气偶像',
    memberIds: ['you', 'nico'],
    description: '首回合暴击率+50%。',
  },
];
