import type { BattleStats, Character, CharacterBattleStats, RuntimeFlags, RuntimeState } from './types';

export function copyCharacter(character: Character): Character {
  return {
    ...character,
    passive: character.passive ? { ...character.passive } : null,
    skill: { ...character.skill },
  };
}

export function clearBattleOnlyState(character: Character): Character {
  const restoredMaxHp = Math.max(1, character.maxHp - character.battleMaxHpBonus);
  return {
    ...character,
    hp: Math.min(character.hp, restoredMaxHp),
    maxHp: restoredMaxHp,
    shield: 0,
    poison: 0,
    vulnerable: 0,
    vulnerableMultiplier: 2,
    statusImmune: false,
    battleAttackBonus: 0,
    battleSpeedBonus: 0,
    shieldGainReduced: false,
    healingReduced: false,
    shieldGainMultiplier: undefined,
    healingMultiplier: undefined,
    battleMaxHpBonus: 0,
    battleSkin: undefined,
  };
}

export function copyRuntime(runtime: RuntimeState): RuntimeState {
  return Object.fromEntries(
    Object.entries(runtime).map(([id, flags]) => [id, { ...flags }]),
  ) as RuntimeState;
}

export function getFlags(runtime: RuntimeState, id: string): RuntimeFlags {
  runtime[id] ??= {};
  return runtime[id];
}

export function getBattleStat(stats: BattleStats, character: Character): CharacterBattleStats {
  stats[character.id] ??= {
    characterId: character.id,
    name: character.name,
    damageDealt: 0,
    damageTaken: 0,
    shieldBlocked: 0,
    criticalHits: 0,
  };

  return stats[character.id];
}

