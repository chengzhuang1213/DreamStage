import type { GroupId, IdolRarity, RoleId, BossTier, EliteTier, EnemyPoolId, UpgradeLevel, SecondaryBondId, PassiveId, SkillId, Ability, CharacterTemplate, Character, NodeType, BattleType, MapNode, RuntimeFlags, RuntimeState, BattlePhase, CharacterBattleStats, BattleStats, BattleState, BondGroup, ActiveBond, BossTemplate, EliteTemplate, EnemyTemplate, SecondaryBond, ActiveSecondaryBond } from './game/types';
import { BOND_GROUPS, SECONDARY_BONDS } from './game/data/bonds';
import { BOSS_TEMPLATES } from './game/data/bosses';
import { CHARACTER_POOL } from './game/data/characters';
import { BATTLE_ENEMY_TEMPLATES, STRONG_ENEMY_TEMPLATES, WEAK_ENEMY_TEMPLATES } from './game/data/enemies';
import { ELITE_TEMPLATES } from './game/data/elites';
import { GROUP_LABELS, NODE_LABELS, RARITY_LABELS, ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS, REWARD_GOLD } from './game/data/labels';
import { hasSecondaryBond } from './game/bonds';

export type { GroupId, IdolRarity, RoleId, BossTier, EliteTier, EnemyPoolId, UpgradeLevel, SecondaryBondId, PassiveId, SkillId, Ability, CharacterTemplate, Character, NodeType, BattleType, MapNode, RuntimeFlags, RuntimeState, BattlePhase, CharacterBattleStats, BattleStats, BattleState, BondGroup, ActiveBond, BossTemplate, EliteTemplate, EnemyTemplate, SecondaryBond, ActiveSecondaryBond } from './game/types';
export { BOND_GROUPS, SECONDARY_BONDS } from './game/data/bonds';
export { BOSS_TEMPLATES } from './game/data/bosses';
export { CHARACTER_POOL } from './game/data/characters';
export { BATTLE_ENEMY_TEMPLATES, STRONG_ENEMY_TEMPLATES, WEAK_ENEMY_TEMPLATES } from './game/data/enemies';
export { ELITE_TEMPLATES } from './game/data/elites';
export { GROUP_LABELS, NODE_LABELS, RARITY_LABELS, ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS, REWARD_GOLD } from './game/data/labels';
export { getActiveBonds, getActiveSecondaryBonds, hasBond, hasSecondaryBond } from './game/bonds';
export { copyCharacter, getBattleSlots, resolveBattleGroup, resolveBattleSegment } from './game/battle';

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

const STRONG_ENEMY_IDS = new Set(STRONG_ENEMY_TEMPLATES.map((enemy) => enemy.id));

export function getRewardGold(type: BattleType, enemies: Character[] = []): number {
  if (type !== 'battle') {
    return REWARD_GOLD[type];
  }

  return enemies.some((enemy) => STRONG_ENEMY_IDS.has(enemy.templateId)) ? 12 : REWARD_GOLD.battle;
}

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
    battleMaxHpBonus: 0,
    bossTier: template.bossTier,
    eliteTier: template.eliteTier,
    enemyTier: template.enemyTier,
    feature: template.feature,
    mechanic: template.mechanic,
    upgradeLevel: 1,
    ...overrides,
  };
}

export function createAlly(template: CharacterTemplate): Character {
  return createCharacter(template, template.id);
}

export function createEnemy(template: EnemyTemplate, type: BattleType, index: number): Character {
  return createCharacter(template, `enemy-${template.id}-${type}-${index}-${Math.random().toString(36).slice(2, 7)}`, {
    name: `对手 ${template.name}`,
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

export function applyPostNodePassives(teamInput: Character[]): Character[] {
  let team = teamInput;

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
