export type GroupId = 'cute' | 'silver' | 'president' | 'mystery';
export type IdolRarity = 'legendary' | 'star' | 'normal' | 'enemy' | 'elite' | 'boss';
export type BossTier = 1 | 2 | 3;
export type EliteTier = BossTier;
export type EnemyPoolId = 'weak' | 'strong';

export type SecondaryBondId =
  | 'little_devil'
  | 'nozoeli'
  | 'angel'
  | 'dreamer'
  | 'lucky_star'
  | 'campus_leader'
  | 'full_speed'
  | 'energetic_idol';

export type PassiveId =
  | 'ayumu_low_hp'
  | 'nico_skill_growth'
  | 'kotori_shield_breaker'
  | 'keke_inspiration'
  | 'eli_training'
  | 'mari_shiny'
  | 'yoshiko_power'
  | 'kanata_nap'
  | 'elite_kanan_training'
  | 'elite_riko_inspiration'
  | 'elite_umi_low_hp'
  | 'elite_kaho_never_give_up'
  | 'elite_emma_warm_power'
  | 'elite_kanon_center_stage'
  | 'elite_setsuna_focus'
  | 'elite_shioriko_execution'
  | 'elite_natsumi_traffic'
  | 'enemy_hanayo_start_hp'
  | 'enemy_hanamaru_low_hp'
  | 'enemy_ruby_first_strike'
  | 'enemy_karin_drain'
  | 'enemy_kasumi_speed_damage'
  | 'enemy_shizuku_first_guard'
  | 'enemy_margarete_pierce'
  | 'enemy_kozue_start_heal'
  | 'enemy_tsuzuri_growth'
  | 'enemy_rurino_first'
  | 'enemy_ceras_reduction'
  | 'boss_honoka_growth'
  | 'boss_chika_regen'
  | 'boss_dia_reduction'
  | 'boss_kasumi_first_strike'
  | 'boss_chisato_double'
  | 'boss_maki_growth';

export type SkillId =
  | 'ayumu_musou'
  | 'rina_double'
  | 'nico_triple'
  | 'kotori_crit'
  | 'keke_charge'
  | 'you_vulnerable'
  | 'eli_discipline'
  | 'mari_shield'
  | 'ren_analysis'
  | 'yoshiko_poison'
  | 'nozomi_fortune'
  | 'kanata_execute'
  | 'enemy_basic'
  | 'boss_honoka_rush'
  | 'boss_chika_together'
  | 'boss_dia_authority'
  | 'boss_kasumi_punch'
  | 'boss_chisato_training'
  | 'boss_maki_passion';

export interface Ability<TId extends string> {
  id: TId;
  name: string;
  description: string;
}

export interface CharacterTemplate {
  id: string;
  name: string;
  group: GroupId;
  rarity: IdolRarity;
  maxHp: number;
  attack: number;
  speed: number;
  passive: Ability<PassiveId> | null;
  skill: Ability<SkillId>;
  price: number;
  color: string;
  accent: string;
  avatar: string;
  bossTier?: BossTier;
  eliteTier?: EliteTier;
  enemyTier?: EnemyPoolId;
  feature?: string;
  mechanic?: string;
}

export interface Character {
  id: string;
  templateId: string;
  name: string;
  group: GroupId;
  rarity: IdolRarity;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  passive: Ability<PassiveId> | null;
  skill: Ability<SkillId>;
  injured: boolean;
  price: number;
  color: string;
  accent: string;
  avatar: string;
  shield: number;
  poison: number;
  vulnerable: number;
  statusImmune: boolean;
  battleAttackBonus: number;
  battleSpeedBonus: number;
  shieldGainReduced: boolean;
  bossTier?: BossTier;
  eliteTier?: EliteTier;
  enemyTier?: EnemyPoolId;
  feature?: string;
  mechanic?: string;
}

export type NodeType = 'battle' | 'elite' | 'shop' | 'rest' | 'boss';
export type BattleType = 'battle' | 'elite' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  completed: boolean;
  available: boolean;
}

export interface RuntimeFlags {
  prepared?: boolean;
  firstAttackUsed?: boolean;
  firstDamageDoubleUsed?: boolean;
  firstLeaderDoubleUsed?: boolean;
  firstCritBoostUsed?: boolean;
  kekeCharged?: boolean;
  kekeChargeCooldown?: number;
  skillCooldown?: number;
  ayumuMusouActive?: boolean;
  bossFirstAttackUsed?: boolean;
  encoreUsed?: boolean;
  firstDamageNegated?: boolean;
  turnsTaken?: number;
  focus?: number;
  forceCritical?: boolean;
  firstAttackBoostUsed?: boolean;
  firstDamageHalved?: boolean;
}

export type RuntimeState = Record<string, RuntimeFlags>;

export type BattlePhase = 'select' | 'relay' | 'won' | 'lost';

export interface BattleState {
  nodeId: string;
  type: BattleType;
  enemies: Character[];
  activeEnemyIndex: number;
  selectedIds: string[];
  slots: number;
  phase: BattlePhase;
  rewardGold: number;
  log: string[];
  runtime: RuntimeState;
}

export interface BondGroup {
  id: GroupId;
  name: string;
  theme: string;
  memberIds: string[];
  level2Name: string;
  level2Description: string;
  level3Name: string;
  level3Description: string;
}

export interface ActiveBond {
  group: BondGroup;
  count: number;
  level: 0 | 2 | 3;
}

export interface BossTemplate extends CharacterTemplate {
  bossTier: BossTier;
  feature: string;
}

export interface EliteTemplate extends CharacterTemplate {
  eliteTier: EliteTier;
  feature: string;
}

export interface EnemyTemplate extends CharacterTemplate {
  rarity: 'enemy';
  enemyTier: EnemyPoolId;
}

export interface SecondaryBond {
  id: SecondaryBondId;
  name: string;
  memberIds: string[];
  description: string;
}

export interface ActiveSecondaryBond {
  bond: SecondaryBond;
  count: number;
  active: boolean;
}

export const GROUP_LABELS: Record<GroupId, string> = {
  cute: '可爱组',
  silver: '灰发组',
  president: '会长组',
  mystery: '神秘组',
};


export const RARITY_LABELS: Record<IdolRarity, string> = {
  legendary: '传奇偶像',
  star: '明星偶像',
  normal: '普通偶像',
  enemy: '小怪',
  elite: '精英',
  boss: 'Boss',
};

const ENEMY_BASIC_SKILL: Ability<SkillId> = {
  id: 'enemy_basic',
  name: '普通攻击',
  description: '无主动技能，只依靠被动机制和基础攻击。',
};

export const BOND_GROUPS: BondGroup[] = [
  {
    id: 'cute',
    name: '可爱组',
    theme: '暴击 / 连击 / 吸血',
    memberIds: ['ayumu', 'rina', 'nico'],
    level2Name: '萌力扩散',
    level2Description: '暴击率+15%。',
    level3Name: '世界第一偶像',
    level3Description: '暴击时吸血50%。',
  },
  {
    id: 'silver',
    name: '灰发组',
    theme: '速度 / 偷袭 / 易损',
    memberIds: ['kotori', 'keke', 'you'],
    level2Name: '行动派',
    level2Description: '速度+3。',
    level3Name: '青春冲刺',
    level3Description: '首回合伤害翻倍。',
  },
  {
    id: 'president',
    name: '会长组',
    theme: '护盾 / 免疫 / 防御',
    memberIds: ['eli', 'mari', 'ren'],
    level2Name: '纪律委员会',
    level2Description: '受到伤害-2。',
    level3Name: '领袖风范',
    level3Description: '开场获得20%最大生命护盾。',
  },
  {
    id: 'mystery',
    name: '神秘组',
    theme: '毒 / 随机 / 斩杀',
    memberIds: ['yoshiko', 'nozomi', 'kanata'],
    level2Name: '神秘共鸣',
    level2Description: '毒伤害+100%。',
    level3Name: '命运终结',
    level3Description: '斩杀线提升至50%。',
  },
];

export const SECONDARY_BONDS: SecondaryBond[] = [
  {
    id: 'little_devil',
    name: '小恶魔组',
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
    name: '天使组',
    memberIds: ['ayumu', 'kotori'],
    description: '战斗结束恢复15%生命。',
  },
  {
    id: 'dreamer',
    name: '梦想家组',
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
    description: '速度+3。',
  },
  {
    id: 'energetic_idol',
    name: '元气偶像',
    memberIds: ['you', 'nico'],
    description: '首回合暴击率+50%。',
  },
];

export const CHARACTER_POOL: CharacterTemplate[] = [
  {
    id: 'ayumu',
    name: '步梦',
    group: 'cute',
    rarity: 'star',
    maxHp: 88,
    attack: 12,
    speed: 7,
    price: 65,
    color: '#ef6f82',
    accent: '#ffe5eb',
    avatar: '/cards/heroes/102Uehara-Ayumu-TgB2p1.png',
    passive: {
      id: 'ayumu_low_hp',
      name: '温柔鼓励',
      description: '生命值低于50%时，攻击力+20%。',
    },
    skill: {
      id: 'ayumu_musou',
      name: '无双',
      description: '每场战斗只能发动一次，之后每回合攻击力+3。',
    },
  },
  {
    id: 'rina',
    name: '璃奈',
    group: 'cute',
    rarity: 'normal',
    maxHp: 72,
    attack: 10,
    speed: 12,
    price: 65,
    color: '#8aa1b7',
    accent: '#ecf2ff',
    avatar: '/cards/heroes/97Tennoji-Rina-tZo8rZ.png',
    passive: null,
    skill: {
      id: 'rina_double',
      name: '双重表达',
      description: '30%概率再次攻击。',
    },
  },
  {
    id: 'nico',
    name: '妮可',
    group: 'cute',
    rarity: 'legendary',
    maxHp: 72,
    attack: 11,
    speed: 11,
    price: 70,
    color: '#d4579d',
    accent: '#ffe5f6',
    avatar: '/cards/heroes/18Yazawa-Nico-agidhY.png',
    passive: {
      id: 'nico_skill_growth',
      name: '世界第一偶像',
      description: '每使用一次技能，本场战斗攻击力+3，可持续叠加。',
    },
    skill: {
      id: 'nico_triple',
      name: '世界第一可爱',
      description: '冷却1回合。失去10%当前生命值，连续攻击3次。',
    },
  },
  {
    id: 'kotori',
    name: '南小鸟',
    group: 'silver',
    rarity: 'star',
    maxHp: 78,
    attack: 10,
    speed: 9,
    price: 60,
    color: '#60c4a6',
    accent: '#fff3a3',
    avatar: '/cards/heroes/9Minami-Kotori-06DzDA.png',
    passive: {
      id: 'kotori_shield_breaker',
      name: '白翼破盾',
      description: '攻击击碎目标全部护盾，并使其后续获得的护盾量减半。',
    },
    skill: {
      id: 'kotori_crit',
      name: '纯白一击',
      description: '暴击率30%，暴击造成2倍伤害。',
    },
  },
  {
    id: 'keke',
    name: '唐可可',
    group: 'silver',
    rarity: 'legendary',
    maxHp: 70,
    attack: 12,
    speed: 12,
    price: 70,
    color: '#b8a48c',
    accent: '#fff0c2',
    avatar: '/cards/heroes/119Tang-Keke-DsQVZW.png',
    passive: {
      id: 'keke_inspiration',
      name: '灵感爆发',
      description: '攻击伤害在0.90到1.15倍之间波动，并恢复实际伤害30%的生命。',
    },
    skill: {
      id: 'keke_charge',
      name: '蓄力演出',
      description: '冷却1回合。跳过本回合行动，下次攻击造成1.30倍伤害。',
    },
  },
  {
    id: 'you',
    name: '渡边曜',
    group: 'silver',
    rarity: 'normal',
    maxHp: 86,
    attack: 13,
    speed: 11,
    price: 75,
    color: '#4e9ad6',
    accent: '#e1f3ff',
    avatar: '/cards/heroes/17Watanabe-You-ohUDHk.png',
    passive: null,
    skill: {
      id: 'you_vulnerable',
      name: '破绽打击',
      description: '首次攻击施加易损，下一次伤害翻倍。',
    },
  },
  {
    id: 'eli',
    name: '绘里',
    group: 'president',
    rarity: 'star',
    maxHp: 88,
    attack: 14,
    speed: 8,
    price: 75,
    color: '#2ca6c7',
    accent: '#d8f6ff',
    avatar: '/cards/heroes/1Ayase-Eli-MqG2az.png',
    passive: {
      id: 'eli_training',
      name: '严格训练',
      description: '每受到一次攻击，本场战斗攻击力+1。',
    },
    skill: {
      id: 'eli_discipline',
      name: '纪律执行',
      description: '受到伤害减少3。',
    },
  },
  {
    id: 'mari',
    name: '鞠莉',
    group: 'president',
    rarity: 'legendary',
    maxHp: 92,
    attack: 12,
    speed: 7,
    price: 70,
    color: '#b965d8',
    accent: '#f3e2ff',
    avatar: '/cards/heroes/11Ohara-Mari-npxzmE.png',
    passive: {
      id: 'mari_shiny',
      name: 'Shiny！',
      description: '拥有护盾时，造成的伤害提升50%。',
    },
    skill: {
      id: 'mari_shield',
      name: '理事长赞助',
      description: '冷却1回合。获得10点护盾。',
    },
  },
  {
    id: 'ren',
    name: '叶月恋',
    group: 'president',
    rarity: 'normal',
    maxHp: 84,
    attack: 11,
    speed: 9,
    price: 70,
    color: '#234b83',
    accent: '#dbe8ff',
    avatar: '/cards/heroes/122Hazuki-Ren-vhPCUT.png',
    passive: null,
    skill: {
      id: 'ren_analysis',
      name: '冷静分析',
      description: '免疫首次异常状态。',
    },
  },
  {
    id: 'yoshiko',
    name: '善子',
    group: 'mystery',
    rarity: 'star',
    maxHp: 76,
    attack: 13,
    speed: 10,
    price: 75,
    color: '#35364a',
    accent: '#ff5b6e',
    avatar: '/cards/heroes/16Tsushima-Yoshiko-VytOHY.png',
    passive: {
      id: 'yoshiko_power',
      name: '堕天使力量',
      description: '敌方每拥有1层毒，自身攻击力+1。',
    },
    skill: {
      id: 'yoshiko_poison',
      name: '堕天诅咒',
      description: '冷却1回合。攻击附加3层毒。',
    },
  },
  {
    id: 'nozomi',
    name: '希',
    group: 'mystery',
    rarity: 'normal',
    maxHp: 86,
    attack: 11,
    speed: 8,
    price: 70,
    color: '#7d5ab6',
    accent: '#efe2ff',
    avatar: '/cards/heroes/15Toujou-Nozomi-ToXNZh.png',
    passive: null,
    skill: {
      id: 'nozomi_fortune',
      name: '神秘占卜',
      description: '开场随机获得攻击、速度或护盾强化。',
    },
  },
  {
    id: 'kanata',
    name: '彼方',
    group: 'mystery',
    rarity: 'legendary',
    maxHp: 90,
    attack: 10,
    speed: 6,
    price: 70,
    color: '#9d75b8',
    accent: '#fff0f7',
    avatar: '/cards/heroes/50Konoe-Kanata-xB16n7.png',
    passive: {
      id: 'kanata_nap',
      name: '午睡时间',
      description: '每经过一个节点，恢复15点生命。',
    },
    skill: {
      id: 'kanata_execute',
      name: '梦境终结',
      description: '冷却1回合。敌方生命低于30%时立即斩杀。',
    },
  },
];


export const WEAK_ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'enemy_rin',
    name: '星空凛',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 8,
    attack: 5,
    speed: 8,
    price: 0,
    color: '#f4cf4a',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/2Hoshizora-Rin-sgemWZ.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_ai',
    name: '宫下爱',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 10,
    attack: 4,
    speed: 8,
    price: 0,
    color: '#f28a43',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/62Miyashita-Ai-3rwYaJ.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_mia',
    name: '米娅泰勒',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 8,
    attack: 7,
    speed: 5,
    price: 0,
    color: '#c9cdd4',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/123Mia-Taylor-88B8V6.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_lanzhu',
    name: '钟岚珠',
    group: 'president',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 12,
    attack: 6,
    speed: 7,
    price: 0,
    color: '#d56ac7',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/124Lanzhu-ttDPY2.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_sumire',
    name: '平安名堇',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 14,
    attack: 5,
    speed: 5,
    price: 0,
    color: '#b7de65',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/121Heanna-Sumire-pZiy0V.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_kinako',
    name: '樱小路希奈子',
    group: 'silver',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 18,
    attack: 3,
    speed: 3,
    price: 0,
    color: '#e9d686',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/172Sakurakoji-Kinako-dQVwkG.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_shiki',
    name: '若菜四季',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 10,
    attack: 7,
    speed: 4,
    price: 0,
    color: '#7fa9d8',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/174Wakana-Shiki-fxvbKO.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_mei',
    name: '米女芽衣',
    group: 'president',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 12,
    attack: 6,
    speed: 5,
    price: 0,
    color: '#d14848',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/173Yoneme-Mei-tsct9m.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_polka',
    name: '高桥波尔卡',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 15,
    attack: 5,
    speed: 4,
    price: 0,
    color: '#f0a44c',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/267Polka-Takahashi-of8qct.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_miracle_kana',
    name: 'Mira-Cra Park Kana',
    group: 'silver',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 14,
    attack: 5,
    speed: 6,
    price: 0,
    color: '#76c6d8',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/271Miracle-Kanazawa-NFxAZ7.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_noriko',
    name: 'Noriko Chofu',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'weak',
    maxHp: 16,
    attack: 4,
    speed: 5,
    price: 0,
    color: '#b9a8da',
    accent: '#6fbf5f',
    avatar: '/cards/enemies/272Noriko-Chofu-W2l36B.png',
    passive: null,
    skill: ENEMY_BASIC_SKILL,
  },
];

export const STRONG_ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: 'enemy_hanayo',
    name: '小泉花阳',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 25,
    attack: 5,
    speed: 4,
    price: 0,
    color: '#9bcf73',
    accent: '#b05bd7',
    avatar: '/cards/enemies/3Koizumi-Hanayo-kdVFUI.png',
    passive: {
      id: 'enemy_hanayo_start_hp',
      name: '米饭能量',
      description: '开场生命+5。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_hanamaru',
    name: '国木田花丸',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 22,
    attack: 6,
    speed: 5,
    price: 0,
    color: '#e2c84a',
    accent: '#b05bd7',
    avatar: '/cards/enemies/5Kunikida-Hanamaru-nqbGF1.png',
    passive: {
      id: 'enemy_hanamaru_low_hp',
      name: '坚持读完',
      description: '生命低于50%时，攻击+2。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_ruby',
    name: '黑泽露比',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 18,
    attack: 7,
    speed: 7,
    price: 0,
    color: '#ee83b5',
    accent: '#b05bd7',
    avatar: '/cards/enemies/7Kurosawa-Ruby-UbPDc8.png',
    passive: {
      id: 'enemy_ruby_first_strike',
      name: '勇气一击',
      description: '首次攻击伤害+50%。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_karin',
    name: '朝香果林',
    group: 'president',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 20,
    attack: 9,
    speed: 6,
    price: 0,
    color: '#496fc9',
    accent: '#b05bd7',
    avatar: '/cards/enemies/24Asaka-Karin-fd7iBo.png',
    passive: {
      id: 'enemy_karin_drain',
      name: '成熟余裕',
      description: '攻击造成伤害后，恢复2生命。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_kasumi',
    name: '中须霞',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 18,
    attack: 8,
    speed: 8,
    price: 0,
    color: '#d8c68e',
    accent: '#b05bd7',
    avatar: '/cards/enemies/67Nakasu-Kasumi-M5ZCuB.png',
    passive: {
      id: 'enemy_kasumi_speed_damage',
      name: '霞霞节奏',
      description: '速度高于目标时，伤害+30%。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_shizuku',
    name: '樱坂雫',
    group: 'silver',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 20,
    attack: 8,
    speed: 6,
    price: 0,
    color: '#80a8d8',
    accent: '#b05bd7',
    avatar: '/cards/enemies/70Osaka-Shizuku-4TmRNm.png',
    passive: {
      id: 'enemy_shizuku_first_guard',
      name: '入戏防守',
      description: '首次受到伤害减半。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_margarete',
    name: '薇恩·玛格丽特',
    group: 'president',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 20,
    attack: 10,
    speed: 5,
    price: 0,
    color: '#d9d4bd',
    accent: '#b05bd7',
    avatar: '/cards/enemies/178Margarete-Wien-9s7aq5.png',
    passive: {
      id: 'enemy_margarete_pierce',
      name: '独唱穿透',
      description: '攻击无视2点减伤。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_kozue',
    name: '乙宗梢',
    group: 'president',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 24,
    attack: 6,
    speed: 5,
    price: 0,
    color: '#76bd9a',
    accent: '#b05bd7',
    avatar: '/cards/enemies/205Kozue-Otomune-aCtlXr.png',
    passive: {
      id: 'enemy_kozue_start_heal',
      name: '温雅整理',
      description: '开场恢复5生命。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_tsuzuri',
    name: '夕雾缀理',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 22,
    attack: 7,
    speed: 4,
    price: 0,
    color: '#6aa6c9',
    accent: '#b05bd7',
    avatar: '/cards/enemies/206Tsuzuri-Yugiri-jGUNrA.png',
    passive: {
      id: 'enemy_tsuzuri_growth',
      name: '缓慢升温',
      description: '每回合攻击+1。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_rurino',
    name: '大泽琉璃乃',
    group: 'cute',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 18,
    attack: 8,
    speed: 8,
    price: 0,
    color: '#f1b44e',
    accent: '#b05bd7',
    avatar: '/cards/enemies/207Rurino-Osawa-dh0WWJ.png',
    passive: {
      id: 'enemy_rurino_first',
      name: '抢先起跑',
      description: '永远先手。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'enemy_ceras',
    name: '塞拉斯',
    group: 'mystery',
    rarity: 'enemy',
    enemyTier: 'strong',
    maxHp: 25,
    attack: 7,
    speed: 5,
    price: 0,
    color: '#d7d0c2',
    accent: '#b05bd7',
    avatar: '/cards/enemies/230Ceras-Yanagida-Lilienfeld-f2hQLe.png',
    passive: {
      id: 'enemy_ceras_reduction',
      name: '稳固姿态',
      description: '受到伤害-1。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
];

export const BATTLE_ENEMY_TEMPLATES: EnemyTemplate[] = [
  ...WEAK_ENEMY_TEMPLATES,
  ...STRONG_ENEMY_TEMPLATES,
];

export const BOSS_TEMPLATES: BossTemplate[] = [
  {
    id: 'boss_honoka',
    name: '穗乃果',
    group: 'cute',
    rarity: 'boss',
    bossTier: 1,
    maxHp: 120,
    attack: 12,
    speed: 6,
    price: 0,
    color: '#e98532',
    accent: '#202020',
    avatar: '/cards/enemies/4Kousaka-Honoka-m1dEvp.png',
    feature: '成长型 Boss，越拖越危险。',
    passive: {
      id: 'boss_honoka_growth',
      name: '永不放弃',
      description: '每回合攻击力+2。',
    },
    skill: {
      id: 'boss_honoka_rush',
      name: '元气冲刺',
      description: '冷却1回合。本次攻击造成1.5倍伤害。',
    },
  },
  {
    id: 'boss_chika',
    name: '千歌',
    group: 'cute',
    rarity: 'boss',
    bossTier: 1,
    maxHp: 140,
    attack: 10,
    speed: 5,
    price: 0,
    color: '#ef866d',
    accent: '#202020',
    avatar: '/cards/enemies/14Takami-Chika-RUJSlZ.png',
    feature: '续航型 Boss，擅长持续恢复。',
    passive: {
      id: 'boss_chika_regen',
      name: '闪闪发光',
      description: '每回合恢复8点生命。',
    },
    skill: {
      id: 'boss_chika_together',
      name: '大家一起！',
      description: '冷却1回合。恢复15点生命。',
    },
  },
  {
    id: 'boss_dia',
    name: '黑泽黛雅',
    group: 'president',
    rarity: 'boss',
    bossTier: 2,
    maxHp: 220,
    attack: 15,
    speed: 6,
    price: 0,
    color: '#b63b43',
    accent: '#202020',
    avatar: '/cards/enemies/6Kurosawa-Dia-gjXWOR.png',
    feature: '防御型 Boss，护盾与减伤让她非常难磨死。',
    passive: {
      id: 'boss_dia_reduction',
      name: '不准胡闹',
      description: '受到伤害减少3。',
    },
    skill: {
      id: 'boss_dia_authority',
      name: '学生会权威',
      description: '冷却1回合。获得25点护盾。',
    },
  },
  {
    id: 'boss_kasumi',
    name: '中须霞',
    group: 'cute',
    rarity: 'boss',
    bossTier: 2,
    maxHp: 180,
    attack: 18,
    speed: 9,
    price: 0,
    color: '#d8c68e',
    accent: '#202020',
    avatar: '/cards/enemies/67Nakasu-Kasumi-M5ZCuB.png',
    feature: '爆发型 Boss，首次攻击有极高秒人风险。',
    passive: {
      id: 'boss_kasumi_first_strike',
      name: '霞霞最可爱',
      description: '首次攻击造成双倍伤害。',
    },
    skill: {
      id: 'boss_kasumi_punch',
      name: '霞霞拳',
      description: '冷却1回合。暴击率50%，暴击造成2倍伤害。',
    },
  },
  {
    id: 'boss_chisato',
    name: '岚千砂都',
    group: 'silver',
    rarity: 'boss',
    bossTier: 3,
    maxHp: 320,
    attack: 20,
    speed: 12,
    price: 0,
    color: '#e7e8ed',
    accent: '#202020',
    avatar: '/cards/enemies/120Arashi-Chisato-NGhy5X.png',
    feature: '双重攻击 Boss，克制毒流与慢速成长流。',
    passive: {
      id: 'boss_chisato_double',
      name: '鬼之特训',
      description: '每回合攻击两次。',
    },
    skill: {
      id: 'boss_chisato_training',
      name: '全力训练',
      description: '冷却1回合。本场战斗速度永久+2。',
    },
  },
  {
    id: 'boss_maki',
    name: '西木野真姬',
    group: 'mystery',
    rarity: 'boss',
    bossTier: 3,
    maxHp: 300,
    attack: 22,
    speed: 8,
    price: 0,
    color: '#bf5363',
    accent: '#202020',
    avatar: '/cards/enemies/10Nishikino-Maki-UFQB4E.png',
    feature: '伪二阶段 Boss，生命过半后触发 Encore。',
    mechanic: 'Encore：生命首次低于50%时，立即恢复80点生命，仅触发一次。',
    passive: {
      id: 'boss_maki_growth',
      name: '天才作曲家',
      description: '每回合攻击力+2。',
    },
    skill: {
      id: 'boss_maki_passion',
      name: '激情演奏',
      description: '冷却1回合。本次攻击造成1.5倍伤害。',
    },
  },
];


export const ELITE_TEMPLATES: EliteTemplate[] = [
  {
    id: 'elite_kanan',
    name: '松浦果南',
    group: 'silver',
    rarity: 'elite',
    eliteTier: 1,
    maxHp: 50,
    attack: 8,
    speed: 7,
    price: 0,
    color: '#48b99a',
    accent: '#b05bd7',
    avatar: '/cards/enemies/8Matsuura-Kanan-qlLtYT.png',
    feature: '成长型速度怪。',
    passive: {
      id: 'elite_kanan_training',
      name: '海边训练',
      description: '每回合速度+1。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_riko',
    name: '樱内梨子',
    group: 'mystery',
    rarity: 'elite',
    eliteTier: 1,
    maxHp: 45,
    attack: 7,
    speed: 5,
    price: 0,
    color: '#e38aaa',
    accent: '#a64a2c',
    avatar: '/cards/enemies/12Sakurauchi-Riko-xHBC2K.png',
    feature: '防止秒杀。',
    passive: {
      id: 'elite_riko_inspiration',
      name: '灵感创作',
      description: '受到的第一次伤害无效。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_umi',
    name: '园田海未',
    group: 'president',
    rarity: 'elite',
    eliteTier: 1,
    maxHp: 40,
    attack: 10,
    speed: 6,
    price: 0,
    color: '#4676b9',
    accent: '#a64a2c',
    avatar: '/cards/enemies/13Sonoda-Umi-RVB62t.png',
    feature: '残血狂暴。',
    passive: {
      id: 'elite_umi_low_hp',
      name: '严格训练',
      description: '生命低于50%时，攻击力翻倍。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_kaho',
    name: '日野下花帆',
    group: 'cute',
    rarity: 'elite',
    eliteTier: 2,
    maxHp: 55,
    attack: 10,
    speed: 7,
    price: 0,
    color: '#f3a13b',
    accent: '#a64a2c',
    avatar: '/cards/enemies/203Kaho-Hinoshita-obf8Nh.png',
    feature: '续航怪。',
    passive: {
      id: 'elite_kaho_never_give_up',
      name: '不会放弃',
      description: '每3回合恢复20生命。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_emma',
    name: '艾玛',
    group: 'president',
    rarity: 'elite',
    eliteTier: 2,
    maxHp: 55,
    attack: 11,
    speed: 6,
    price: 0,
    color: '#88bd63',
    accent: '#a64a2c',
    avatar: '/cards/enemies/28Emma-Verde-cn5mja.png',
    feature: '越打越强。',
    passive: {
      id: 'elite_emma_warm_power',
      name: '温柔力量',
      description: '每受到一次攻击，攻击力+1。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_kanon',
    name: '涩谷香音',
    group: 'silver',
    rarity: 'elite',
    eliteTier: 2,
    maxHp: 50,
    attack: 9,
    speed: 8,
    price: 0,
    color: '#d3a15d',
    accent: '#a64a2c',
    avatar: '/cards/enemies/118Shibuya-Kanon-v7t9EL.png',
    feature: '减速控制。',
    passive: {
      id: 'elite_kanon_center_stage',
      name: '舞台中心',
      description: '每次攻击降低目标1点速度。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_setsuna',
    name: '优木雪菜',
    group: 'cute',
    rarity: 'elite',
    eliteTier: 3,
    maxHp: 65,
    attack: 12,
    speed: 7,
    price: 0,
    color: '#e4473f',
    accent: '#a64a2c',
    avatar: '/cards/enemies/110Yuki-Setsuna-44Ojdt.png',
    feature: '必须持续输出。',
    passive: {
      id: 'elite_setsuna_focus',
      name: 'Burning Heart',
      description: '每回合获得1层专注；每层专注伤害+10%，受到伤害后清空。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_shioriko',
    name: '三船栞子',
    group: 'president',
    rarity: 'elite',
    eliteTier: 3,
    maxHp: 60,
    attack: 11,
    speed: 8,
    price: 0,
    color: '#56a48a',
    accent: '#a64a2c',
    avatar: '/cards/enemies/113Mifune-Shioriko-o5YINu.png',
    feature: '前半场硬得离谱。',
    passive: {
      id: 'elite_shioriko_execution',
      name: '学生会执行力',
      description: '生命值高于50%时，受到伤害减半。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
  {
    id: 'elite_natsumi',
    name: '鬼冢夏美',
    group: 'mystery',
    rarity: 'elite',
    eliteTier: 3,
    maxHp: 60,
    attack: 13,
    speed: 9,
    price: 0,
    color: '#eb7e39',
    accent: '#a64a2c',
    avatar: '/cards/enemies/175Onitsuka-Natsumi-pUUL81.png',
    feature: '定时炸弹。',
    passive: {
      id: 'elite_natsumi_traffic',
      name: '流量密码',
      description: '每经过2回合，下一次攻击必定暴击。',
    },
    skill: ENEMY_BASIC_SKILL,
  },
];

export function getBossesForTier(tier: BossTier): BossTemplate[] {
  return BOSS_TEMPLATES.filter((boss) => boss.bossTier === tier);
}

export function getRandomBossForTier(tier: BossTier): BossTemplate {
  const candidates = getBossesForTier(tier);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? BOSS_TEMPLATES[0];
}

export function getElitesForTier(tier: EliteTier): EliteTemplate[] {
  return ELITE_TEMPLATES.filter((elite) => elite.eliteTier === tier);
}

export function getRandomEliteForTier(tier: EliteTier): EliteTemplate {
  const candidates = getElitesForTier(tier);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? ELITE_TEMPLATES[0];
}

export function getBattleEnemiesForTier(tier: BossTier): EnemyTemplate[] {
  if (tier === 1) {
    return WEAK_ENEMY_TEMPLATES;
  }

  if (tier === 2) {
    return [...WEAK_ENEMY_TEMPLATES, ...STRONG_ENEMY_TEMPLATES];
  }

  return STRONG_ENEMY_TEMPLATES;
}

export function getRandomBattleEnemyForTier(tier: BossTier): EnemyTemplate {
  const candidates = getBattleEnemiesForTier(tier);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? WEAK_ENEMY_TEMPLATES[0];
}

export const NODE_LABELS: Record<NodeType, string> = {
  battle: '战斗',
  elite: '精英战',
  shop: '商店',
  rest: '休息处',
  boss: 'Boss',
};

export const REWARD_GOLD: Record<BattleType, number> = {
  battle: 30,
  elite: 55,
  boss: 120,
};

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function sample<T>(items: T[], count: number): T[] {
  return shuffle(items).slice(0, count);
}

function fillDraftCandidates(
  required: CharacterTemplate[],
  fillPool: CharacterTemplate[],
  count = 4,
): CharacterTemplate[] {
  const selectedIds = new Set(required.map((character) => character.id));
  const fillers = sample(
    fillPool.filter((character) => !selectedIds.has(character.id)),
    Math.max(0, count - required.length),
  );

  return shuffle([...required, ...fillers]);
}

export function createDraftCandidates(): CharacterTemplate[] {
  const legendary = CHARACTER_POOL.filter((character) => character.rarity === 'legendary');
  const star = CHARACTER_POOL.filter((character) => character.rarity === 'star');
  const nonLegendary = CHARACTER_POOL.filter((character) => character.rarity !== 'legendary');
  const nonLegendaryWithStar = [...star, ...CHARACTER_POOL.filter((character) => character.rarity === 'normal')];
  const roll = Math.random();

  if (roll < 0.7) {
    return fillDraftCandidates(sample(star, 1), nonLegendaryWithStar);
  }

  if (roll < 0.9) {
    return fillDraftCandidates(sample(legendary, 1), nonLegendary);
  }

  return fillDraftCandidates(sample(legendary, 2), CHARACTER_POOL);
}

export function getActiveBonds(characters: Array<Character | CharacterTemplate>): ActiveBond[] {
  const ownedIds = new Set(
    characters.map((character) => ('templateId' in character ? character.templateId : character.id)),
  );

  return BOND_GROUPS.map((group) => {
    const count = group.memberIds.filter((id) => ownedIds.has(id)).length;
    return {
      group,
      count,
      level: count >= 3 ? 3 : count >= 2 ? 2 : 0,
    };
  });
}

export function hasBond(characters: Character[], groupId: GroupId, level: 2 | 3): boolean {
  const bond = getActiveBonds(characters).find((activeBond) => activeBond.group.id === groupId);
  return Boolean(bond && bond.level >= level);
}

export function getActiveSecondaryBonds(
  characters: Array<Character | CharacterTemplate>,
): ActiveSecondaryBond[] {
  const ownedIds = new Set(
    characters.map((character) => ('templateId' in character ? character.templateId : character.id)),
  );

  return SECONDARY_BONDS.map((bond) => {
    const count = bond.memberIds.filter((id) => ownedIds.has(id)).length;
    return {
      bond,
      count,
      active: count === bond.memberIds.length,
    };
  });
}

export function hasSecondaryBond(characters: Character[], bondId: SecondaryBondId): boolean {
  return getActiveSecondaryBonds(characters).some(
    (activeBond) => activeBond.bond.id === bondId && activeBond.active,
  );
}

function createCharacter(template: CharacterTemplate, id: string, overrides: Partial<Character> = {}): Character {
  const speed = template.speed;

  return {
    id,
    templateId: template.id,
    name: template.name,
    group: template.group,
    rarity: template.rarity,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attack: template.attack,
    speed,
    passive: template.passive,
    skill: template.skill,
    injured: false,
    price: template.price,
    color: template.color,
    accent: template.accent,
    avatar: template.avatar,
    shield: 0,
    poison: 0,
    vulnerable: 0,
    statusImmune: false,
    battleAttackBonus: 0,
    battleSpeedBonus: 0,
    shieldGainReduced: false,
    bossTier: template.bossTier,
    eliteTier: template.eliteTier,
    enemyTier: template.enemyTier,
    feature: template.feature,
    mechanic: template.mechanic,
    ...overrides,
  };
}

export function createAlly(template: CharacterTemplate): Character {
  return createCharacter(template, template.id);
}

export function createEnemy(template: EnemyTemplate, type: BattleType, index: number): Character {
  return createCharacter(template, `enemy-${template.id}-${type}-${index}-${Math.random().toString(36).slice(2, 7)}`, {
    name: `敌方${template.name}`,
    price: 0,
  });
}

export function createElite(template: EliteTemplate = getRandomEliteForTier(1)): Character {
  return createCharacter(template, `elite-${template.id}-${Math.random().toString(36).slice(2, 7)}`, {
    name: `精英 ${template.name}`,
    price: 0,
  });
}

export function createBoss(template: BossTemplate = getRandomBossForTier(1)): Character {
  return createCharacter(template, `boss-${template.id}-${Math.random().toString(36).slice(2, 7)}`, {
    name: `Boss ${template.name}`,
    price: 0,
  });
}

export function createEnemiesForBattle(type: BattleType, boss?: BossTemplate): Character[] {
  if (type === 'boss') {
    return [createBoss(boss)];
  }

  if (type === 'elite') {
    return [createElite(getRandomEliteForTier(boss?.bossTier ?? 1))];
  }

  return [getRandomBattleEnemyForTier(boss?.bossTier ?? 1)].map((template, index) =>
    createEnemy(template, type, index),
  );
}

export function buildMap(): MapNode[] {
  const rowSizes = [3, 3, 3, 3, 2, 1];
  const nodeTypes = shuffle<NodeType>([
    'battle',
    'battle',
    'shop',
    'battle',
    'elite',
    'battle',
    'battle',
    'shop',
    'elite',
    'battle',
    'battle',
    'elite',
  ]);

  const nodes: MapNode[] = [];
  let typeIndex = 0;
  rowSizes.forEach((size, row) => {
    for (let col = 0; col < size; col += 1) {
      const isBossRow = row === rowSizes.length - 1;
      const isPreBossRow = row === rowSizes.length - 2;
      nodes.push({
        id: `node-${row}-${col}`,
        row,
        col,
        type: isBossRow ? 'boss' : isPreBossRow ? 'rest' : nodeTypes[typeIndex++],
        completed: false,
        available: row === 0,
      });
    }
  });

  return nodes;
}

export function getBattleSlots(type: BattleType, aliveCount: number): number {
  const desiredSlots: Record<BattleType, number> = {
    battle: 1,
    elite: 2,
    boss: 3,
  };

  return Math.max(1, Math.min(desiredSlots[type], aliveCount));
}

export function completeMapNode(nodes: MapNode[], nodeId: string): MapNode[] {
  const completedNode = nodes.find((node) => node.id === nodeId);
  if (!completedNode) {
    return nodes;
  }

  const nextRow = completedNode.row + 1;
  const nextRowNodes = nodes.filter((node) => node.row === nextRow);
  const nextAvailableIds = new Set(
    nextRowNodes
      .filter((node) => Math.abs(node.col - completedNode.col) <= 1)
      .map((node) => node.id),
  );

  if (nextRowNodes.length > 0 && nextAvailableIds.size === 0) {
    nextRowNodes.forEach((node) => nextAvailableIds.add(node.id));
  }

  return nodes.map((node) => ({
    ...node,
    completed: node.completed || node.id === nodeId,
    available: nextAvailableIds.has(node.id),
  }));
}

export function copyCharacter(character: Character): Character {
  return {
    ...character,
    passive: character.passive ? { ...character.passive } : null,
    skill: { ...character.skill },
  };
}

function clearBattleOnlyState(character: Character): Character {
  return {
    ...character,
    shield: 0,
    poison: 0,
    vulnerable: 0,
    statusImmune: false,
    battleAttackBonus: 0,
    battleSpeedBonus: 0,
    shieldGainReduced: false,
  };
}

function copyRuntime(runtime: RuntimeState): RuntimeState {
  return Object.fromEntries(
    Object.entries(runtime).map(([id, flags]) => [id, { ...flags }]),
  ) as RuntimeState;
}

function getFlags(runtime: RuntimeState, id: string): RuntimeFlags {
  runtime[id] ??= {};
  return runtime[id];
}

function effectiveAttack(character: Character): number {
  return Math.max(1, character.attack + character.battleAttackBonus);
}

function effectiveSpeed(character: Character): number {
  return Math.max(1, character.speed + character.battleSpeedBonus);
}

function heal(character: Character, amount: number): number {
  const before = character.hp;
  character.hp = Math.min(character.maxHp, character.hp + amount);
  return character.hp - before;
}

function addShield(character: Character, amount: number, log: string[], reason: string) {
  if (amount <= 0) {
    return;
  }

  const finalAmount = character.shieldGainReduced ? Math.ceil(amount * 0.5) : amount;
  character.shield += finalAmount;
  log.push(
    `${character.name}${reason}，获得${finalAmount}护盾${character.shieldGainReduced ? "（护盾削弱，获得量减半）" : ""}。`,
  );
}

function applyStatus(
  target: Character,
  statusName: string,
  apply: () => void,
  log: string[],
) {
  if (target.statusImmune) {
    target.statusImmune = false;
    log.push(`${target.name}发动「${target.skill.name}」，免疫了${statusName}。`);
    return;
  }

  apply();
}

function applyShieldReduction(target: Character, log: string[]) {
  if (target.shieldGainReduced) {
    return;
  }

  applyStatus(target, '护盾削弱', () => {
    target.shieldGainReduced = true;
    log.push(`${target.name}受到护盾削弱，后续获得的护盾量减半。`);
  }, log);
}

function applyPoison(target: Character, layers: number, log: string[]) {
  applyStatus(target, '毒', () => {
    target.poison += layers;
    log.push(`${target.name}获得${layers}层毒。`);
  }, log);
}

function applyVulnerable(target: Character, log: string[]) {
  applyStatus(target, '易损', () => {
    target.vulnerable = Math.max(target.vulnerable, 1);
    log.push(`${target.name}陷入易损，下一次受到伤害翻倍。`);
  }, log);
}

function prepareCombatant(
  actor: Character,
  _opponent: Character,
  isAlly: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
) {
  const flags = getFlags(runtime, actor.id);
  if (flags.prepared) {
    return;
  }

  flags.prepared = true;
  actor.shield = Math.max(0, actor.shield);
  actor.poison = Math.max(0, actor.poison);
  actor.vulnerable = Math.max(0, actor.vulnerable);
  actor.battleAttackBonus = 0;
  actor.battleSpeedBonus = 0;

  if (actor.passive?.id === 'enemy_hanayo_start_hp') {
    actor.maxHp += 5;
    actor.hp += 5;
    log.push(`${actor.name}发动「${actor.passive.name}」，开场生命+5。`);
  }

  if (actor.passive?.id === 'enemy_kozue_start_heal') {
    const restored = heal(actor, 5);
    if (restored > 0) {
      log.push(`${actor.name}发动「${actor.passive.name}」，恢复${restored}HP。`);
    }
  }

  if (isAlly && hasBond(team, 'silver', 2)) {
    actor.battleSpeedBonus += 3;
    log.push(`${actor.name}受到「行动派」鼓舞，速度+3。`);
  }

  if (isAlly && hasSecondaryBond(team, 'full_speed')) {
    actor.battleSpeedBonus += 3;
    log.push(`${actor.name}触发「全速模式」，速度+3。`);
  }

  if (isAlly && hasBond(team, 'president', 3)) {
    addShield(actor, Math.ceil(actor.maxHp * 0.2), log, '触发「领袖风范」');
  }

  if (isAlly && hasSecondaryBond(team, 'nozoeli')) {
    addShield(actor, Math.ceil(actor.maxHp * 0.15), log, '触发「绘希」');
  }

  if (actor.skill.id === 'ren_analysis') {
    actor.statusImmune = true;
    log.push(`${actor.name}发动「${actor.skill.name}」，准备免疫首次异常状态。`);
  }

  if (actor.skill.id === 'nozomi_fortune') {
    const roll = Math.floor(Math.random() * 3);
    if (roll === 0) {
      actor.battleAttackBonus += 3;
      log.push(`${actor.name}发动「${actor.skill.name}」，攻击+3。`);
    } else if (roll === 1) {
      actor.battleSpeedBonus += 3;
      log.push(`${actor.name}发动「${actor.skill.name}」，速度+3。`);
    } else {
      addShield(actor, 3, log, `发动「${actor.skill.name}」`);
    }
  }
}

function tryBossEncore(character: Character, runtime: RuntimeState, log: string[]): boolean {
  const flags = getFlags(runtime, character.id);
  if (
    character.passive?.id !== 'boss_maki_growth' ||
    flags.encoreUsed ||
    character.hp / character.maxHp >= 0.5
  ) {
    return false;
  }

  flags.encoreUsed = true;
  const restored = heal(character, 80);
  log.push(`${character.name}触发「Encore」，立即恢复${restored}HP。`);
  return restored > 0;
}

function processPoison(
  actor: Character,
  isAllyTarget: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
): boolean {
  if (actor.poison <= 0 || actor.hp <= 0) {
    return actor.hp <= 0;
  }

  const multiplier = !isAllyTarget && hasBond(team, 'mystery', 2) ? 2 : 1;
  const damage = actor.poison * multiplier;
  actor.hp = Math.max(0, actor.hp - damage);
  log.push(`${actor.name}受到${damage}点毒伤害。`);
  actor.poison = Math.max(0, actor.poison - 1);
  tryBossEncore(actor, runtime, log);

  return actor.hp <= 0;
}

function tryExecute(
  attacker: Character,
  defender: Character,
  isAlly: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
): boolean {
  const flags = getFlags(runtime, attacker.id);
  if (attacker.skill.id !== 'kanata_execute' || defender.hp <= 0 || (flags.skillCooldown ?? 0) > 0) {
    return false;
  }

  const threshold = isAlly && hasBond(team, 'mystery', 3) ? 0.5 : 0.3;
  if (defender.hp / defender.maxHp <= threshold) {
    defender.hp = 0;
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，直接斩杀${defender.name}。`);
    tryBossEncore(defender, runtime, log);
    return true;
  }

  return false;
}

function getDamageReduction(defender: Character, isAllyTarget: boolean, team: Character[]): number {
  let reduction = 0;
  if (defender.skill.id === 'eli_discipline') {
    reduction += 3;
  }

  if (defender.passive?.id === 'boss_dia_reduction') {
    reduction += 3;
  }

  if (defender.passive?.id === 'enemy_ceras_reduction') {
    reduction += 1;
  }

  if (isAllyTarget && hasBond(team, 'president', 2)) {
    reduction += 2;
  }

  return reduction;
}

function applyDamageToShieldAndHp(defender: Character, damage: number) {
  const shieldDamage = Math.min(defender.shield, damage);
  defender.shield -= shieldDamage;
  defender.hp = Math.max(0, defender.hp - (damage - shieldDamage));
}

function calculateDamage(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  isAllyDefender: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
): { damage: number; critical: boolean } {
  const flags = getFlags(runtime, attacker.id);
  let damage = effectiveAttack(attacker);
  let criticalChance = 0;
  const kotoriCritSkillActive = attacker.skill.id === 'kotori_crit';
  const bossPowerSkillActive =
    (attacker.skill.id === 'boss_honoka_rush' || attacker.skill.id === 'boss_maki_passion') &&
    (flags.skillCooldown ?? 0) <= 0;
  const kasumiSkillActive =
    attacker.skill.id === 'boss_kasumi_punch' && (flags.skillCooldown ?? 0) <= 0;

  if (attacker.passive?.id === 'ayumu_low_hp' && attacker.hp / attacker.maxHp < 0.5) {
    damage *= 1.2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本次攻击力+20%。`);
  }

  if (attacker.passive?.id === 'mari_shiny' && attacker.shield > 0) {
    damage *= 1.5;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本次伤害提升50%。`);
  }

  if (attacker.passive?.id === 'yoshiko_power' && defender.poison > 0) {
    damage += defender.poison;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，根据毒层攻击力+${defender.poison}。`);
  }

  if (attacker.passive?.id === 'elite_umi_low_hp' && attacker.hp / attacker.maxHp < 0.5) {
    damage *= 2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，攻击力翻倍。`);
  }

  if (attacker.passive?.id === 'enemy_hanamaru_low_hp' && attacker.hp / attacker.maxHp < 0.5) {
    damage += 2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，攻击+2。`);
  }

  if (attacker.passive?.id === 'enemy_kasumi_speed_damage' && effectiveSpeed(attacker) > effectiveSpeed(defender)) {
    damage *= 1.3;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，伤害+30%。`);
  }

  if (attacker.passive?.id === 'enemy_ruby_first_strike' && !flags.firstAttackBoostUsed) {
    flags.firstAttackBoostUsed = true;
    damage *= 1.5;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，首次攻击伤害+50%。`);
  }

  if (attacker.passive?.id === 'elite_setsuna_focus') {
    const focus = flags.focus ?? 0;
    if (focus > 0) {
      damage *= 1 + focus * 0.1;
      log.push(`${attacker.name}拥有${focus}层专注，本次伤害+${focus * 10}%。`);
    }
  }

  if (bossPowerSkillActive) {
    damage *= 1.5;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，本次攻击造成1.5倍伤害。`);
  }

  if (attacker.passive?.id === 'keke_inspiration') {
    const multiplier = 0.9 + Math.random() * 0.25;
    damage *= multiplier;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，伤害倍率${multiplier.toFixed(2)}。`);
  }

  if (attacker.skill.id === 'keke_charge' && flags.kekeCharged) {
    flags.kekeCharged = false;
    flags.kekeChargeCooldown = 1;
    damage *= 1.3;
    log.push(`${attacker.name}消耗「${attacker.skill.name}」，本次攻击1.30倍伤害。`);
  }

  if (kotoriCritSkillActive) {
    criticalChance += 0.3;
  }

  if (kasumiSkillActive) {
    criticalChance += 0.5;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，本次攻击暴击率+50%。`);
  }

  if (flags.forceCritical) {
    criticalChance = 1;
    flags.forceCritical = false;
    log.push(`${attacker.name}发动「${attacker.passive?.name ?? '必定暴击'}」，本次攻击必定暴击。`);
  }

  if (isAllyAttacker && hasBond(team, 'cute', 2)) {
    criticalChance += 0.15;
  }

  if (isAllyAttacker && hasSecondaryBond(team, 'energetic_idol') && !flags.firstCritBoostUsed) {
    flags.firstCritBoostUsed = true;
    criticalChance += 0.5;
    log.push(`${attacker.name}触发「元气偶像」，首回合暴击率+50%。`);
  }

  const critical = Math.random() < Math.min(1, criticalChance);
  if (critical) {
    damage *= 2;
    log.push(`${attacker.name}打出暴击。`);
  }

  if (bossPowerSkillActive || kasumiSkillActive) {
    flags.skillCooldown = 1;
  }

  if (attacker.passive?.id === 'boss_kasumi_first_strike' && !flags.bossFirstAttackUsed) {
    flags.bossFirstAttackUsed = true;
    damage *= 2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，首次攻击伤害翻倍。`);
  }

  if (isAllyAttacker && hasSecondaryBond(team, 'campus_leader') && !flags.firstLeaderDoubleUsed) {
    flags.firstLeaderDoubleUsed = true;
    damage *= 1.5;
    log.push(`${attacker.name}触发「校园领袖」，首次攻击造成1.5倍伤害。`);
  }

  if (isAllyAttacker && hasBond(team, 'silver', 3) && !flags.firstDamageDoubleUsed) {
    flags.firstDamageDoubleUsed = true;
    damage *= 2;
    log.push(`${attacker.name}触发「青春冲刺」，首回合伤害翻倍。`);
  }

  if (defender.vulnerable > 0) {
    defender.vulnerable -= 1;
    damage *= 2;
    log.push(`${defender.name}的易损触发，本次伤害翻倍。`);
  }

  let reduction = getDamageReduction(defender, isAllyDefender, team);
  if (attacker.passive?.id === 'enemy_margarete_pierce' && reduction > 0) {
    const ignored = Math.min(2, reduction);
    reduction -= ignored;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，无视${ignored}点减伤。`);
  }

  if (reduction > 0) {
    damage = Math.max(1, damage - reduction);
    log.push(`${defender.name}减免${reduction}点伤害。`);
  }

  if (defender.passive?.id === 'elite_shioriko_execution' && defender.hp / defender.maxHp > 0.5) {
    damage *= 0.5;
    log.push(`${defender.name}发动「${defender.passive.name}」，受到伤害减半。`);
  }

  return { damage: Math.max(1, Math.round(damage)), critical };
}

function resolveAttack(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  isAllyDefender: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
) {
  if (tryExecute(attacker, defender, isAllyAttacker, team, runtime, log)) {
    return;
  }

  const flags = getFlags(runtime, attacker.id);

  if (attacker.passive?.id === 'kotori_shield_breaker') {
    if (defender.shield > 0) {
      log.push(`${attacker.name}发动「${attacker.passive.name}」，击碎${defender.name}的${defender.shield}点护盾。`);
      defender.shield = 0;
    }
    applyShieldReduction(defender, log);
  }

  let { damage, critical } = calculateDamage(
    attacker,
    defender,
    isAllyAttacker,
    isAllyDefender,
    team,
    runtime,
    log,
  );

  const defenderFlags = getFlags(runtime, defender.id);
  if (defender.passive?.id === 'elite_riko_inspiration' && !defenderFlags.firstDamageNegated) {
    defenderFlags.firstDamageNegated = true;
    damage = 0;
    log.push(`${defender.name}发动「${defender.passive.name}」，受到的第一次伤害无效。`);
  }

  if (damage > 0 && defender.passive?.id === 'enemy_shizuku_first_guard' && !defenderFlags.firstDamageHalved) {
    defenderFlags.firstDamageHalved = true;
    damage = Math.max(1, Math.ceil(damage * 0.5));
    log.push(`${defender.name}发动「${defender.passive.name}」，首次受到伤害减半。`);
  }

  const defenderDurabilityBefore = defender.hp + defender.shield;
  applyDamageToShieldAndHp(defender, damage);
  const actualDamage = Math.min(damage, defenderDurabilityBefore);
  log.push(`${attacker.name}攻击${defender.name}，造成${damage}伤害，${defender.name}剩余${defender.hp}HP。`);

  if (attacker.passive?.id === 'keke_inspiration') {
    const restored = heal(attacker, Math.floor(actualDamage * 0.3));
    if (restored > 0) {
      log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
    }
  }

  if (actualDamage > 0 && attacker.passive?.id === 'enemy_karin_drain') {
    const restored = heal(attacker, 2);
    if (restored > 0) {
      log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
    }
  }
  tryBossEncore(defender, runtime, log);

  if (actualDamage > 0 && defender.passive?.id === 'elite_setsuna_focus' && (defenderFlags.focus ?? 0) > 0) {
    defenderFlags.focus = 0;
    log.push(`${defender.name}受到伤害，「${defender.passive.name}」专注清空。`);
  }

  if (defender.hp > 0 && defender.passive?.id === 'eli_training') {
    defender.battleAttackBonus += 1;
    log.push(`${defender.name}发动「${defender.passive.name}」，本场攻击力+1。`);
  }

  if (defender.hp > 0 && defender.passive?.id === 'elite_emma_warm_power') {
    defender.battleAttackBonus += 1;
    log.push(`${defender.name}发动「${defender.passive.name}」，本场攻击力+1。`);
  }

  if (critical && actualDamage > 0 && isAllyAttacker && hasBond(team, 'cute', 3)) {
    const restored = heal(attacker, Math.floor(actualDamage * 0.5));
    if (restored > 0) {
      log.push(`${attacker.name}触发「世界第一偶像」，吸血恢复${restored}HP。`);
    }
  }

  if (critical && actualDamage > 0 && isAllyAttacker && hasSecondaryBond(team, 'little_devil') && defender.hp > 0) {
    log.push(`${attacker.name}触发「小恶魔组」，暴击附加5层毒。`);
    applyPoison(defender, 5, log);
  }

  if (attacker.passive?.id === 'elite_kanon_center_stage' && defender.hp > 0) {
    applyStatus(defender, '减速', () => {
      defender.battleSpeedBonus -= 1;
      log.push(`${attacker.name}发动「${attacker.passive?.name}」，${defender.name}速度-1。`);
    }, log);
  }

  if (attacker.skill.id === 'you_vulnerable' && !flags.firstAttackUsed && defender.hp > 0) {
    flags.firstAttackUsed = true;
    log.push(`${attacker.name}发动「${attacker.skill.name}」。`);
    applyVulnerable(defender, log);
  }

  if (
    attacker.skill.id === 'yoshiko_poison' &&
    (flags.skillCooldown ?? 0) <= 0 &&
    defender.hp > 0
  ) {
    log.push(`${attacker.name}发动「${attacker.skill.name}」。`);
    applyPoison(defender, 3, log);
    flags.skillCooldown = 1;
  }

  tryExecute(attacker, defender, isAllyAttacker, team, runtime, log);
}

function takeTurn(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
) {
  if (processPoison(attacker, isAllyAttacker, team, runtime, log)) {
    return;
  }

  const flags = getFlags(runtime, attacker.id);
  const chargeCooldown = flags.kekeChargeCooldown ?? 0;
  const skillCooldown = flags.skillCooldown ?? 0;

  if (attacker.passive?.id === 'elite_kanan_training') {
    attacker.battleSpeedBonus += 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场速度+1。`);
  }

  if (attacker.passive?.id === 'elite_kaho_never_give_up') {
    flags.turnsTaken = (flags.turnsTaken ?? 0) + 1;
    if (flags.turnsTaken % 3 === 0) {
      const restored = heal(attacker, 20);
      log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
    }
  }

  if (attacker.passive?.id === 'elite_setsuna_focus') {
    flags.focus = (flags.focus ?? 0) + 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，获得1层专注。`);
  }

  if (attacker.passive?.id === 'elite_natsumi_traffic') {
    flags.turnsTaken = (flags.turnsTaken ?? 0) + 1;
    if (flags.turnsTaken % 2 === 0) {
      flags.forceCritical = true;
      log.push(`${attacker.name}发动「${attacker.passive.name}」，下一次攻击必定暴击。`);
    }
  }

  if (attacker.passive?.id === 'enemy_tsuzuri_growth') {
    attacker.battleAttackBonus += 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+1。`);
  }

  if (attacker.skill.id === 'ayumu_musou') {
    if (!flags.ayumuMusouActive) {
      flags.ayumuMusouActive = true;
      log.push(`${attacker.name}发动「${attacker.skill.name}」，之后每回合攻击力+3。`);
    } else {
      attacker.battleAttackBonus += 3;
      log.push(`${attacker.name}受到「${attacker.skill.name}」强化，本场攻击力+3。`);
    }
  }

  if (attacker.passive?.id === 'boss_honoka_growth' || attacker.passive?.id === 'boss_maki_growth') {
    attacker.battleAttackBonus += 2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+2。`);
  }

  if (attacker.passive?.id === 'boss_chika_regen') {
    const restored = heal(attacker, 8);
    log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
  }

  if (attacker.skill.id === 'boss_chisato_training' && skillCooldown <= 0) {
    attacker.battleSpeedBonus += 2;
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，本场速度永久+2。`);
  }

  if (
    (attacker.skill.id === 'boss_chika_together' || attacker.skill.id === 'boss_dia_authority') &&
    skillCooldown <= 0
  ) {
    if (attacker.skill.id === 'boss_chika_together') {
      const restored = heal(attacker, 15);
      log.push(`${attacker.name}发动「${attacker.skill.name}」，恢复${restored}HP。`);
    } else {
      addShield(attacker, 25, log, `发动「${attacker.skill.name}」`);
    }
    flags.skillCooldown = 1;
    return;
  }

  if (attacker.skill.id === 'mari_shield' && skillCooldown <= 0) {
    addShield(attacker, 10, log, `发动「${attacker.skill.name}」`);
    flags.skillCooldown = 1;
    return;
  }

  if (attacker.skill.id === 'nico_triple' && skillCooldown <= 0) {
    const hpLoss = Math.min(
      Math.max(0, attacker.hp - 1),
      Math.max(1, Math.ceil(attacker.hp * 0.1)),
    );
    attacker.hp -= hpLoss;
    if (attacker.passive?.id === 'nico_skill_growth') {
      attacker.battleAttackBonus += 3;
      log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+3。`);
    }
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，失去${hpLoss}HP并连续攻击3次。`);
    for (let hit = 0; hit < 3 && defender.hp > 0; hit += 1) {
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log);
    }
    return;
  }

  if (attacker.skill.id === 'keke_charge' && !flags.kekeCharged && chargeCooldown <= 0) {
    flags.kekeCharged = true;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，跳过本回合并进入蓄力。`);
    return;
  }

  resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log);

  if (attacker.skill.id === 'keke_charge' && chargeCooldown > 0) {
    flags.kekeChargeCooldown = Math.max(0, chargeCooldown - 1);
  }

  if (skillCooldown > 0) {
    flags.skillCooldown = Math.max(0, skillCooldown - 1);
  }

  if (
    attacker.hp > 0 &&
    defender.hp > 0 &&
    attacker.passive?.id === 'boss_chisato_double'
  ) {
    log.push(`${attacker.name}发动「${attacker.passive.name}」，追加第二次攻击。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log);
  }

  if (
    attacker.hp > 0 &&
    defender.hp > 0 &&
    attacker.skill.id === 'rina_double' &&
    Math.random() < 0.3
  ) {
    log.push(`${attacker.name}发动「${attacker.skill.name}」，追加一次攻击。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log);
  }
}

function hasPriorityTurn(character: Character): boolean {
  return character.passive?.id === 'enemy_rurino_first';
}

function runGroupBattle(
  allies: Character[],
  enemy: Character,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
) {
  allies.forEach((ally) => prepareCombatant(ally, enemy, true, team, runtime, log));
  prepareCombatant(enemy, allies[0], false, team, runtime, log);

  log.push(`开始团队战斗：${allies.map((ally) => ally.name).join("、")} VS ${enemy.name}。`);
  let rounds = 0;

  while (allies.some((ally) => ally.hp > 0) && enemy.hp > 0 && rounds < 80) {
    rounds += 1;
    const turnOrder = [
      ...allies
        .filter((ally) => ally.hp > 0)
        .map((ally) => ({ character: ally, isAlly: true })),
      { character: enemy, isAlly: false },
    ].sort((left, right) => {
      const priorityDifference = Number(hasPriorityTurn(right.character)) - Number(hasPriorityTurn(left.character));
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const speedDifference = effectiveSpeed(right.character) - effectiveSpeed(left.character);
      if (speedDifference !== 0) {
        return speedDifference;
      }
      return left.isAlly === right.isAlly ? 0 : left.isAlly ? -1 : 1;
    });

    for (const actor of turnOrder) {
      if (enemy.hp <= 0 || !allies.some((ally) => ally.hp > 0)) {
        break;
      }

      if (actor.isAlly) {
        if (actor.character.hp > 0) {
          takeTurn(actor.character, enemy, true, team, runtime, log);
        }
        continue;
      }

      if (enemy.hp <= 0) {
        break;
      }
      const livingAllies = allies.filter((ally) => ally.hp > 0);
      const target = livingAllies[Math.floor(Math.random() * livingAllies.length)];
      if (target) {
        takeTurn(enemy, target, false, team, runtime, log);
      }
    }
  }

  if (rounds >= 80) {
    log.push('战斗回合过长，系统强制结束本段团队战斗。');
  }
}

function applyVictoryPassives(
  winner: Character,
  battle: BattleState,
  team: Character[],
  log: string[],
): number {
  let rewardGold = battle.rewardGold;

  const teamWinner = team.find((member) => member.id === winner.id);
  if (teamWinner) {
    Object.assign(teamWinner, winner);
  }

  return rewardGold;
}

function applySecondaryVictoryEffects(team: Character[], log: string[]): number {
  let rewardGold = 0;
  const aliveTeam = team.filter((member) => !member.injured && member.hp > 0);

  if (hasSecondaryBond(team, 'angel')) {
    aliveTeam.forEach((member) => {
      const restored = heal(member, Math.ceil(member.maxHp * 0.15));
      if (restored > 0) {
        log.push(`${member.name}触发「天使组」，战后恢复${restored}HP。`);
      }
    });
  }

  if (hasSecondaryBond(team, 'lucky_star')) {
    const roll = Math.floor(Math.random() * 3);
    const target = aliveTeam[Math.floor(Math.random() * aliveTeam.length)];
    if (roll === 0) {
      rewardGold += 25;
      log.push('触发「幸运星」，额外获得25金币。');
    } else if (roll === 1 && target) {
      const restored = heal(target, 30);
      log.push(`触发「幸运星」，${target.name}恢复${restored}HP。`);
    } else if (target) {
      if (Math.random() < 0.5) {
        target.attack += 1;
        log.push(`触发「幸运星」，${target.name}攻击永久+1。`);
      } else {
        target.speed += 1;
        log.push(`触发「幸运星」，${target.name}速度永久+1。`);
      }
    }
  }

  return rewardGold;
}

export function resolveBattleGroup(
  teamInput: Character[],
  battleInput: BattleState,
  allyIds: string[],
): { team: Character[]; battle: BattleState } {
  const team = teamInput.map(copyCharacter);
  const enemies = battleInput.enemies.map(copyCharacter);
  const runtime = copyRuntime(battleInput.runtime);
  const log = [...battleInput.log];
  const uniqueIds = [...new Set(allyIds)];
  const allies = uniqueIds
    .map((allyId) => team.find((member) => member.id === allyId))
    .filter((member): member is Character => Boolean(member && !member.injured && member.hp > 0));

  if (allies.length !== battleInput.slots) {
    log.push(`需要选择${battleInput.slots}名可出战角色。`);
    return {
      team,
      battle: {
        ...battleInput,
        enemies,
        log,
        runtime,
      },
    };
  }

  log.push(`${allies.map((ally) => ally.name).join("、")}同时上场。`);
  let activeEnemyIndex = battleInput.activeEnemyIndex;
  let winningAlly: Character | null = null;

  while (allies.some((ally) => ally.hp > 0) && activeEnemyIndex < enemies.length) {
    const enemy = enemies[activeEnemyIndex];
    runGroupBattle(allies, enemy, team, runtime, log);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.injured = true;
      winningAlly = allies.find((ally) => ally.hp > 0) ?? allies[0];
      log.push(`${enemy.name}被击败。`);
      activeEnemyIndex += 1;
    } else {
      break;
    }
  }

  allies.forEach((ally) => {
    if (ally.hp <= 0) {
      ally.hp = 0;
      ally.injured = true;
      log.push(`${ally.name}进入重伤状态。`);
    }
  });

  const aliveCount = team.filter((member) => !member.injured && member.hp > 0).length;
  const phase: BattlePhase =
    activeEnemyIndex >= enemies.length ? 'won' : aliveCount > 0 ? 'relay' : 'lost';
  const nextSlots = phase === 'relay' ? getBattleSlots(battleInput.type, aliveCount) : battleInput.slots;
  let rewardGold = battleInput.rewardGold;

  if (phase === 'won') {
    if (winningAlly) {
      rewardGold = applyVictoryPassives(winningAlly, { ...battleInput, rewardGold }, team, log);
    }
    rewardGold += applySecondaryVictoryEffects(team, log);
    log.push(`战斗胜利，获得${rewardGold}金币。`);
  }

  if (phase === 'relay') {
    log.push(`本组角色已无法继续战斗，请选择${nextSlots}名伙伴接力。`);
  }

  if (phase === 'lost') {
    log.push('所有伙伴都进入重伤状态，挑战失败。');
  }

  const resolvedTeam = phase === 'won' || phase === 'lost' ? team.map(clearBattleOnlyState) : team;
  return {
    team: resolvedTeam,
    battle: {
      ...battleInput,
      enemies,
      activeEnemyIndex,
      phase,
      slots: nextSlots,
      selectedIds: phase === 'relay' ? [] : battleInput.selectedIds,
      rewardGold,
      log,
      runtime,
    },
  };
}

export function resolveBattleSegment(
  teamInput: Character[],
  battleInput: BattleState,
  allyId: string,
): { team: Character[]; battle: BattleState } {
  return resolveBattleGroup(teamInput, { ...battleInput, slots: 1 }, [allyId]);
}

export function applyPostNodePassives(teamInput: Character[]): Character[] {
  let team = teamInput.map((member) => {
    if (member.passive?.id !== 'kanata_nap' || member.injured || member.hp <= 0) {
      return member;
    }

    const hp = Math.min(member.maxHp, member.hp + 15);
    return { ...member, hp };
  });

  if (hasSecondaryBond(team, 'dreamer')) {
    team = team.map((member) => {
      if (member.templateId !== 'keke' && member.templateId !== 'kanata') {
        return member;
      }

      return {
        ...member,
        attack: member.attack + 1,
        speed: member.speed + 1,
        maxHp: member.maxHp + 5,
        hp: member.injured ? member.hp : member.hp + 5,
      };
    });
  }

  return team;
}

export function isBattleNode(type: NodeType): type is BattleType {
  return type === 'battle' || type === 'elite' || type === 'boss';
}
