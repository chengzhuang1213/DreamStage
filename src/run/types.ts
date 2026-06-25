import type {
  BattleState,
  BattleStats,
  BossTemplate,
  Character,
  CharacterTemplate,
  MapNode,
} from '../game';

export type Screen =
  | 'start'
  | 'draft'
  | 'team'
  | 'map'
  | 'battle'
  | 'result'
  | 'shop'
  | 'rest'
  | 'question'
  | 'blessing'
  | 'win'
  | 'loss';

export interface ResultState {
  title: string;
  body: string;
  rewardGold: number;
}

export interface RunState {
  screen: Screen;
  candidates: CharacterTemplate[];
  draftSelection: string[];
  team: Character[];
  gold: number;
  map: MapNode[];
  currentNodeId: string | null;
  battle: BattleState | null;
  boss: BossTemplate;
  result: ResultState | null;
  runStats: BattleStats;
  statsOpen: boolean;
  battleStatsOpen: boolean;
  eventLog: string[];
  shopOffers: CharacterTemplate[];
  restHealUsed: boolean;
  restReviveUsed: boolean;
  pendingEnhance: { source: 'elite' | 'boss'; cost: number; free: boolean } | null;
  enhanceReady: boolean;
  pendingBossVictory: boolean;
  bossRetrySnapshot: { team: Character[]; battle: BattleState } | null;
  mapPulseNodeId: string | null;
  questionEventId: string | null;
  nextEnemyAttackBonus: number;
  seenEnemyTemplateIds: string[];
  seenEliteTemplateIds: string[];
  runSeed: string;
  rngState: number;
}

export type HealType = 'small' | 'large';
