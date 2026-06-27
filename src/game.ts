import type { GroupId, IdolRarity, RoleId, BossTier, EliteTier, EnemyPoolId, UpgradeLevel, SecondaryBondId, PassiveId, SkillId, Ability, CharacterTemplate, Character, NodeType, BattleType, MapNode, RuntimeFlags, RuntimeState, BattlePhase, CharacterBattleStats, BattleStats, BattleUnitSnapshot, BattleEventKind, BattleEvent, BattleState, BondGroup, ActiveBond, BossTemplate, EliteTemplate, EnemyTemplate, SecondaryBond, ActiveSecondaryBond } from './game/types';
import { BOND_GROUPS, SECONDARY_BONDS } from './game/data/bonds';
import { BOSS_TEMPLATES } from './game/data/bosses';
import { CHARACTER_POOL } from './game/data/characters';
import { BATTLE_ENEMY_TEMPLATES, STRONG_ENEMY_TEMPLATES, WEAK_ENEMY_TEMPLATES } from './game/data/enemies';
import { ELITE_TEMPLATES } from './game/data/elites';
import { GROUP_LABELS, NODE_LABELS, RARITY_LABELS, ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS, REWARD_GOLD } from './game/data/labels';
import { hasSecondaryBond } from './game/bonds';
import type { SeedRng } from './rng';
import { rngInt, rngPick, rngSample, rngShuffle } from './rng';

export type { GroupId, IdolRarity, RoleId, BossTier, EliteTier, EnemyPoolId, UpgradeLevel, SecondaryBondId, PassiveId, SkillId, Ability, CharacterTemplate, Character, NodeType, BattleType, MapNode, RuntimeFlags, RuntimeState, BattlePhase, CharacterBattleStats, BattleStats, BattleUnitSnapshot, BattleEventKind, BattleEvent, BattleState, BondGroup, ActiveBond, BossTemplate, EliteTemplate, EnemyTemplate, SecondaryBond, ActiveSecondaryBond } from './game/types';
export { BOND_GROUPS, SECONDARY_BONDS } from './game/data/bonds';
export { BOSS_TEMPLATES } from './game/data/bosses';
export { CHARACTER_POOL } from './game/data/characters';
export { BATTLE_ENEMY_TEMPLATES, STRONG_ENEMY_TEMPLATES, WEAK_ENEMY_TEMPLATES } from './game/data/enemies';
export { ELITE_TEMPLATES } from './game/data/elites';
export { GROUP_LABELS, NODE_LABELS, RARITY_LABELS, ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS, REWARD_GOLD } from './game/data/labels';
export { getActiveBonds, getActiveSecondaryBonds, hasBond, hasSecondaryBond } from './game/bonds';
export { copyCharacter } from './game/battleState';
export { getBattleSlots, resolveBattleGroup, resolveBattleSegment, withBattleRandom } from './game/battle';

export function getBossesForTier(tier: BossTier): BossTemplate[] {
  return BOSS_TEMPLATES.filter((boss) => boss.bossTier === tier);
}

export function getRandomBossForTier(tier: BossTier, rng: SeedRng): BossTemplate {
  const candidates = getBossesForTier(tier);
  return rngPick(rng, candidates) ?? BOSS_TEMPLATES[0];
}

export function getElitesForTier(tier: EliteTier): EliteTemplate[] {
  return ELITE_TEMPLATES.filter((elite) => elite.eliteTier === tier);
}

export function getRandomEliteForTier(tier: EliteTier, rng: SeedRng): EliteTemplate {
  const candidates = getElitesForTier(tier);
  return rngPick(rng, candidates) ?? ELITE_TEMPLATES[0];
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

export function getRandomBattleEnemyForTier(tier: BossTier, rng: SeedRng): EnemyTemplate {
  const candidates = getBattleEnemiesForTier(tier);
  return rngPick(rng, candidates) ?? WEAK_ENEMY_TEMPLATES[0];
}

const STRONG_ENEMY_IDS = new Set(STRONG_ENEMY_TEMPLATES.map((enemy) => enemy.id));

export function getRewardGold(type: BattleType, enemies: Character[] = []): number {
  if (type !== 'battle') {
    return REWARD_GOLD[type];
  }

  return enemies.some((enemy) => STRONG_ENEMY_IDS.has(enemy.templateId)) ? 12 : REWARD_GOLD.battle;
}

export function shuffle<T>(items: T[], rng: SeedRng): T[] {
  return rngShuffle(rng, items);
}

export function sample<T>(items: T[], count: number, rng: SeedRng): T[] {
  return rngSample(rng, items, count);
}

type RecruitableRarity = Extract<IdolRarity, 'normal' | 'star' | 'legendary'>;

const RECRUITABLE_RARITIES: RecruitableRarity[] = ['normal', 'star', 'legendary'];

const SHOP_RARITY_WEIGHTS: Record<BossTier, Record<RecruitableRarity, number>> = {
  1: { normal: 70, star: 30, legendary: 0 },
  2: { normal: 45, star: 45, legendary: 10 },
  3: { normal: 20, star: 60, legendary: 20 },
};

function sampleByRarity(
  rarity: RecruitableRarity,
  selectedIds: Set<string>,
  rng: SeedRng,
  pool: CharacterTemplate[] = CHARACTER_POOL,
): CharacterTemplate | null {
  const candidates = pool.filter((character) => character.rarity === rarity && !selectedIds.has(character.id));
  return sample(candidates, 1, rng)[0] ?? null;
}

function weightedRandomRarity(
  weights: Record<RecruitableRarity, number>,
  selectedIds: Set<string>,
  pool: CharacterTemplate[],
  rng: SeedRng,
): RecruitableRarity | null {
  const availableWeights = RECRUITABLE_RARITIES
    .map((rarity) => {
      const hasAvailable = pool.some((character) => character.rarity === rarity && !selectedIds.has(character.id));
      return { rarity, weight: hasAvailable ? weights[rarity] : 0 };
    })
    .filter(({ weight }) => weight > 0);

  const totalWeight = availableWeights.reduce((total, entry) => total + entry.weight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  let roll = rng.next() * totalWeight;
  for (const entry of availableWeights) {
    roll -= entry.weight;
    if (roll < 0) {
      return entry.rarity;
    }
  }

  return availableWeights[availableWeights.length - 1]?.rarity ?? null;
}

function fillDraftCandidates(
  required: CharacterTemplate[],
  fillPool: CharacterTemplate[],
  rng: SeedRng,
  count = 3,
): CharacterTemplate[] {
  const selectedIds = new Set(required.map((character) => character.id));
  const fillers = sample(
    fillPool.filter((character) => !selectedIds.has(character.id)),
    Math.max(0, count - required.length),
    rng,
  );

  return shuffle([...required, ...fillers], rng);
}

export function createDraftCandidates(rng: SeedRng): CharacterTemplate[] {
  const legendary = CHARACTER_POOL.filter((character) => character.rarity === 'legendary');
  const nonLegendary = CHARACTER_POOL.filter((character) => character.rarity !== 'legendary');
  const roll = rng.next();

  if (roll < 0.01) {
    return fillDraftCandidates(sample(legendary, 3, rng), nonLegendary, rng);
  }

  if (roll < 0.06) {
    return fillDraftCandidates(sample(legendary, 2, rng), nonLegendary, rng);
  }

  if (roll < 0.16) {
    return fillDraftCandidates(sample(legendary, 1, rng), nonLegendary, rng);
  }

  return fillDraftCandidates([], nonLegendary, rng);
}

export function createShopOffers(tier: BossTier, ownedIds: Set<string>, rng: SeedRng, count = 3): CharacterTemplate[] {
  const availableOffers = CHARACTER_POOL.filter((character) => !ownedIds.has(character.id));
  const weights = SHOP_RARITY_WEIGHTS[tier];
  const selectedIds = new Set<string>();
  const offers: CharacterTemplate[] = [];

  while (offers.length < count && selectedIds.size < availableOffers.length) {
    const rarity = weightedRandomRarity(weights, selectedIds, availableOffers, rng);
    const offer = rarity ? sampleByRarity(rarity, selectedIds, rng, availableOffers) : null;
    const fallback = offer ?? sample(availableOffers.filter((character) => !selectedIds.has(character.id)), 1, rng)[0];

    if (!fallback) {
      break;
    }

    selectedIds.add(fallback.id);
    offers.push(fallback);
  }

  return offers;
}

function createCharacter(template: CharacterTemplate, id: string, overrides: Partial<Character> = {}): Character {
  const speed = template.speed;

  return {
    id,
    templateId: template.id,
    name: template.name,
    group: template.group,
    rarity: template.rarity,
    role: template.role,
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
    vulnerableMultiplier: 2,
    statusImmune: false,
    battleAttackBonus: 0,
    battleSpeedBonus: 0,
    shieldGainReduced: false,
    healingReduced: false,
    battleMaxHpBonus: 0,
    bossTier: template.bossTier,
    eliteTier: template.eliteTier,
    enemyTier: template.enemyTier,
    feature: template.feature,
    mechanic: template.mechanic,
    upgradeLevel: 1,
    dreamerNodeCount: 0,
    ...overrides,
  };
}

export function createAlly(template: CharacterTemplate): Character {
  return createCharacter(template, template.id);
}

export function createEnemy(template: EnemyTemplate, type: BattleType, index: number): Character {
  return createCharacter(template, `enemy-${template.id}-${type}-${index}`, {
    name: `对手 ${template.name}`,
    price: 0,
  });
}

export function createElite(template: EliteTemplate): Character {
  return createCharacter(template, `elite-${template.id}`, {
    name: `精英 ${template.name}`,
    price: 0,
  });
}

export function createBoss(template: BossTemplate): Character {
  return createCharacter(template, `boss-${template.id}`, {
    name: `Boss ${template.name}`,
    price: 0,
  });
}

export function createEnemiesForBattle(type: BattleType, rng: SeedRng, boss?: BossTemplate): Character[] {
  if (type === 'boss') {
    return [createBoss(boss ?? getRandomBossForTier(1, rng))];
  }

  if (type === 'elite') {
    return [createElite(getRandomEliteForTier(boss?.bossTier ?? 1, rng))];
  }

  return [getRandomBattleEnemyForTier(boss?.bossTier ?? 1, rng)].map((template, index) =>
    createEnemy(template, type, index),
  );
}

export function buildMap(rng: SeedRng): MapNode[] {
  const rowSizes = [
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 2, 3),
    rngInt(rng, 1, 2),
    1,
  ];
  const restRow = rowSizes.length - 2;
  const bossRow = rowSizes.length - 1;

  const rows: MapNode[][] = rowSizes.map((size, row) =>
    Array.from({ length: size }, (_, col) => ({
      id: `node-${row}-${col}`,
      row,
      col,
      type: row === bossRow ? 'boss' : row === restRow ? 'rest' : 'battle',
      nextIds: [],
      completed: false,
      available: row === 0,
    })),
  );

  const allNodes = rows.flat();
  const fillableNodes = allNodes.filter((node) => node.row >= 1 && node.row < restRow);
  const eliteNodes = allNodes.filter((node) => node.row >= 4 && node.row < restRow);
  const usedNodeIds = new Set<string>();

  function placeType(type: NodeType, candidates: MapNode[]) {
    const available = candidates.filter((node) => !usedNodeIds.has(node.id));
    const target = rngPick(rng, available);
    if (!target) {
      return;
    }
    target.type = type;
    usedNodeIds.add(target.id);
  }

  placeType('question', fillableNodes);
  placeType('question', fillableNodes);
  placeType('question', fillableNodes);
  placeType('shop', fillableNodes);
  placeType('shop', fillableNodes);
  placeType('elite', eliteNodes);
  placeType('elite', eliteNodes);
  placeType('elite', eliteNodes);

  fillableNodes.forEach((node) => {
    if (usedNodeIds.has(node.id)) {
      return;
    }
    const allowedTypes: NodeType[] = node.row >= 4
      ? ['battle', 'battle', 'battle', 'question', 'shop', 'elite']
      : ['battle', 'battle', 'battle', 'question', 'shop'];
    node.type = rngPick(rng, allowedTypes) ?? 'battle';
  });

  function getLaneTargets(fromNode: MapNode, nextRow: MapNode[]) {
    if (nextRow.length === 1) {
      return nextRow;
    }

    const currentRowSize = rows[fromNode.row].length;
    const projectedCol = currentRowSize === 1
      ? Math.floor(nextRow.length / 2)
      : Math.round((fromNode.col / (currentRowSize - 1)) * (nextRow.length - 1));

    return nextRow.filter((toNode) => Math.abs(toNode.col - projectedCol) <= 1);
  }

  for (let row = 0; row < rows.length - 1; row += 1) {
    const currentRow = rows[row];
    const nextRow = rows[row + 1];
    const inboundIds = new Set<string>();

    currentRow.forEach((fromNode) => {
      const laneTargets = getLaneTargets(fromNode, nextRow);
      const nextIds = new Set((laneTargets.length > 0 ? laneTargets : [nextRow[0]]).map((target) => target.id));

      fromNode.nextIds = Array.from(nextIds);
      fromNode.nextIds.forEach((nextId) => inboundIds.add(nextId));
    });

    nextRow.forEach((toNode) => {
      if (inboundIds.has(toNode.id)) {
        return;
      }

      const fromNode = rngPick(
        rng,
        currentRow.filter((candidate) =>
          getLaneTargets(candidate, nextRow).some((target) => target.id === toNode.id),
        ),
      );

      if (!fromNode) {
        return;
      }

      fromNode.nextIds = Array.from(new Set([...fromNode.nextIds, toNode.id]));
      inboundIds.add(toNode.id);
    });
  }

  return allNodes;
}

export function completeMapNode(nodes: MapNode[], nodeId: string): MapNode[] {
  const completedNode = nodes.find((node) => node.id === nodeId);
  if (!completedNode) {
    return nodes;
  }

  const nextAvailableIds = new Set(completedNode.nextIds);

  return nodes.map((node) => ({
    ...node,
    completed: node.completed || node.id === nodeId,
    available: nextAvailableIds.has(node.id),
  }));
}

export function applyPostNodePassives(teamInput: Character[]): Character[] {
  let team = teamInput;

  if (hasSecondaryBond(team, 'dreamer')) {
    const nextDreamerNodeCount = Math.max(
      0,
      ...team
        .filter((member) => member.templateId === 'keke' || member.templateId === 'kanata')
        .map((member) => member.dreamerNodeCount ?? 0),
    ) + 1;
    const shouldTriggerDreamer = nextDreamerNodeCount % 2 === 0;
    team = team.map((member) => {
      if (member.templateId !== 'keke' && member.templateId !== 'kanata') {
        return member;
      }

      return {
        ...member,
        dreamerNodeCount: nextDreamerNodeCount,
        attack: member.attack + (shouldTriggerDreamer ? 1 : 0),
        maxHp: member.maxHp + (shouldTriggerDreamer ? 5 : 0),
        hp: member.injured ? member.hp : member.hp + (shouldTriggerDreamer ? 5 : 0),
      };
    });
  }

  return team;
}

export function isBattleNode(type: NodeType): type is BattleType {
  return type === 'battle' || type === 'elite' || type === 'boss';
}
