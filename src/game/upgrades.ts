import type { Character, CharacterTemplate } from './types';

export function maxUpgradeLevel(rarity: Character['rarity'] | CharacterTemplate['rarity']) {
  if (rarity === 'normal') {
    return 3;
  }
  if (rarity === 'star') {
    return 4;
  }
  if (rarity === 'legendary') {
    return 5;
  }
  return 1;
}

export function upgradeCharacterOneLevel(member: Character): Character {
  const currentLevel = member.upgradeLevel ?? 1;
  const nextLevel = Math.min(maxUpgradeLevel(member.rarity), currentLevel + 1) as Character['upgradeLevel'];
  const renHpBonus = member.templateId === 'ren' && currentLevel === 1 && nextLevel >= 2 ? 20 : 0;
  const renAttackBonus = member.templateId === 'ren' && currentLevel === 2 && nextLevel >= 3 ? 5 : 0;

  return {
    ...member,
    upgradeLevel: nextLevel,
    maxHp: member.maxHp + renHpBonus,
    hp: member.hp + renHpBonus,
    attack: member.attack + renAttackBonus,
  };
}

