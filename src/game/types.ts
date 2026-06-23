export type GroupId = 'cute' | 'silver' | 'president' | 'mystery';
export type IdolRarity = 'legendary' | 'star' | 'normal' | 'enemy' | 'elite' | 'boss';
export type BossTier = 1 | 2 | 3;
export type EliteTier = BossTier;
export type EnemyPoolId = 'weak' | 'strong';
export type UpgradeLevel = 1 | 2 | 3;

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
  | 'ren_extra_hp'
  | 'nozomi_turn_shield'
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
  | 'boss_kasumi_stage_growth'
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
  | 'yoshiko_poison'
  | 'nozomi_fortune'
  | 'kanata_execute'
  | 'enemy_basic'
  | 'boss_honoka_rush'
  | 'boss_chika_together'
  | 'boss_dia_authority'
  | 'boss_kasumi_cutest'
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
  vulnerableMultiplier: number;
  battleAttackBonus: number;
  battleSpeedBonus: number;
  shieldGainReduced: boolean;
  bossTier?: BossTier;
  eliteTier?: EliteTier;
  enemyTier?: EnemyPoolId;
  feature?: string;
  mechanic?: string;
  upgradeLevel: UpgradeLevel;
  battleMaxHpBonus: number;
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
  greyFirstDamageBoostUsed?: boolean;
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
  kasumiStageStacks?: number;
  nextAttackMultiplier?: number;
  bossFatalGuardUsed?: boolean;
  ayumuHealBonus?: number;
}

export type RuntimeState = Record<string, RuntimeFlags>;

export type BattlePhase = 'select' | 'relay' | 'won' | 'lost';

export interface CharacterBattleStats {
  characterId: string;
  name: string;
  damageDealt: number;
  damageTaken: number;
  shieldBlocked: number;
  criticalHits: number;
}

export type BattleStats = Record<string, CharacterBattleStats>;

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
  stats: BattleStats;
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
