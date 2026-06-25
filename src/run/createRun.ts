import {
  buildMap,
  createDraftCandidates,
  getRandomBossForTier,
} from '../game';
import { createRandomSeed, createSeedRng } from '../rng';
import type { RunState } from './types';

export function getInitialSeed() {
  if (typeof window === 'undefined') {
    return createRandomSeed();
  }
  return new URLSearchParams(window.location.search).get('seed')?.trim() || createRandomSeed();
}

export function createRun(seed = getInitialSeed()): RunState {
  const rng = createSeedRng(seed);
  const boss = getRandomBossForTier(1, rng);

  return {
    screen: 'start',
    candidates: createDraftCandidates(rng),
    draftSelection: [],
    team: [],
    gold: 80,
    map: buildMap(rng),
    currentNodeId: null,
    battle: null,
    boss,
    result: null,
    runStats: {},
    statsOpen: false,
    battleStatsOpen: false,
    eventLog: [],
    shopOffers: [],
    restHealUsed: false,
    restReviveUsed: false,
    pendingEnhance: null,
    enhanceReady: false,
    pendingBossVictory: false,
    bossRetrySnapshot: null,
    mapPulseNodeId: null,
    questionEventId: null,
    nextEnemyAttackBonus: 0,
    seenEnemyTemplateIds: [],
    seenEliteTemplateIds: [],
    runSeed: seed,
    rngState: rng.state,
  };
}

