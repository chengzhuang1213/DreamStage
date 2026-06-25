import {
  BATTLE_ENEMY_TEMPLATES,
  ELITE_TEMPLATES,
  createElite,
  createEnemiesForBattle,
  createEnemy,
  getBattleEnemiesForTier,
  getElitesForTier,
  type BattleType,
  type BossTier,
  type EliteTemplate,
  type EnemyTemplate,
} from '../game';
import type { SeedRng } from '../rng';
import { rngPick } from '../rng';
import type { RunState } from './types';

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function randomItem<T>(items: T[], rng: SeedRng): T | null {
  return rngPick(rng, items);
}

function chooseUnseenEnemyTemplate(tier: BossTier, seenIds: string[], rng: SeedRng): EnemyTemplate {
  const seen = new Set(seenIds);
  const tierCandidates = getBattleEnemiesForTier(tier).filter((enemy) => !seen.has(enemy.id));
  const globalCandidates = BATTLE_ENEMY_TEMPLATES.filter((enemy) => !seen.has(enemy.id));
  const candidates = tierCandidates.length > 0 ? tierCandidates : globalCandidates;
  return randomItem(candidates, rng) ?? getBattleEnemiesForTier(tier)[0] ?? BATTLE_ENEMY_TEMPLATES[0];
}

function chooseUnseenEliteTemplate(tier: BossTier, seenIds: string[], rng: SeedRng): EliteTemplate {
  const seen = new Set(seenIds);
  const tierCandidates = getElitesForTier(tier).filter((elite) => !seen.has(elite.id));
  const globalCandidates = ELITE_TEMPLATES.filter((elite) => !seen.has(elite.id));
  const candidates = tierCandidates.length > 0 ? tierCandidates : globalCandidates;
  return randomItem(candidates, rng) ?? getElitesForTier(tier)[0] ?? ELITE_TEMPLATES[0];
}

export function createUniqueEnemiesForBattle(previous: RunState, battleType: BattleType, rng: SeedRng) {
  if (battleType === 'battle') {
    const template = chooseUnseenEnemyTemplate(previous.boss.bossTier, previous.seenEnemyTemplateIds, rng);
    return {
      enemies: [createEnemy(template, battleType, 0)],
      seenEnemyTemplateIds: unique([...previous.seenEnemyTemplateIds, template.id]),
      seenEliteTemplateIds: previous.seenEliteTemplateIds,
    };
  }

  if (battleType === 'elite') {
    const template = chooseUnseenEliteTemplate(previous.boss.bossTier, previous.seenEliteTemplateIds, rng);
    return {
      enemies: [createElite(template)],
      seenEnemyTemplateIds: previous.seenEnemyTemplateIds,
      seenEliteTemplateIds: unique([...previous.seenEliteTemplateIds, template.id]),
    };
  }

  return {
    enemies: createEnemiesForBattle(battleType, rng, previous.boss),
    seenEnemyTemplateIds: previous.seenEnemyTemplateIds,
    seenEliteTemplateIds: previous.seenEliteTemplateIds,
  };
}

