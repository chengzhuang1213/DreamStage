import type { BattlePhase, BattleState, BattleStats, Character, CharacterBattleStats, RuntimeFlags, RuntimeState, BattleType, UpgradeLevel } from './types';
import { hasBond, hasSecondaryBond } from './bonds';
import { ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS } from './data/labels';

export function getBattleSlots(type: BattleType, aliveCount: number): number {
  const desiredSlots: Record<BattleType, number> = {
    battle: 1,
    elite: 2,
    boss: 3,
  };

  return Math.max(1, Math.min(desiredSlots[type], aliveCount));
}

export function copyCharacter(character: Character): Character {
  return {
    ...character,
    passive: character.passive ? { ...character.passive } : null,
    skill: { ...character.skill },
  };
}

function clearBattleOnlyState(character: Character): Character {
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
    battleMaxHpBonus: 0,
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

function getBattleStat(stats: BattleStats, character: Character): CharacterBattleStats {
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

function upgradeLevel(character: Character): UpgradeLevel {
  return character.upgradeLevel ?? 1;
}

function effectiveAttack(character: Character): number {
  const nicoUpgradeBonus = character.templateId === 'nico' && upgradeLevel(character) >= 3 ? 1 : 0;
  return Math.max(1, character.attack + character.battleAttackBonus + nicoUpgradeBonus);
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

function applyVulnerable(target: Character, log: string[], multiplier = 2) {
  applyStatus(target, '易损', () => {
    target.vulnerable = Math.max(target.vulnerable, 1);
    target.vulnerableMultiplier = Math.max(target.vulnerableMultiplier || 2, multiplier);
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

  if (isAlly && hasSecondaryBond(team, 'full_speed')) {
    actor.battleSpeedBonus += 5;
    log.push(`${actor.name}触发「全速模式」，速度+5。`);
  }

  if (isAlly && hasBond(team, 'cute', 2)) {
    actor.battleAttackBonus += 2;
    log.push(`${actor.name}触发「萌力扩散」，攻击+2。`);
  }

  if (isAlly && actor.group === 'president' && hasBond(team, 'president', 3)) {
    addShield(actor, Math.ceil(actor.maxHp * 0.2), log, '触发「领袖风范」');
  }

  if (isAlly && hasSecondaryBond(team, 'nozoeli')) {
    addShield(actor, Math.ceil(actor.maxHp * 0.15), log, '触发「绘希」');
  }

  if (isAlly) {
    const mysteryHpBonus = hasBond(team, 'mystery', 3) ? 20 : hasBond(team, 'mystery', 2) ? 10 : 0;
    if (mysteryHpBonus > 0 && actor.battleMaxHpBonus === 0) {
      actor.maxHp += mysteryHpBonus;
      actor.hp += mysteryHpBonus;
      actor.battleMaxHpBonus = mysteryHpBonus;
      log.push(`${actor.name}触发「命运之子」，生命值上限+${mysteryHpBonus}。`);
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

  const damage = actor.poison;
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
  stats?: BattleStats,
): boolean {
  const flags = getFlags(runtime, attacker.id);
  if (attacker.skill.id !== 'kanata_execute' || upgradeLevel(attacker) < 3 || defender.hp <= 0 || (flags.skillCooldown ?? 0) > 0) {
    return false;
  }

  const threshold = upgradeLevel(attacker) >= 5 ? 0.3 : 0.2;
  if (defender.hp / defender.maxHp <= threshold) {
    const remainingHp = defender.hp;
    defender.hp = 0;
    if (isAlly && stats && remainingHp > 0) {
      getBattleStat(stats, attacker).damageDealt += remainingHp;
    }
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，直接斩杀${defender.name}。`);
    tryBossEncore(defender, runtime, log);
    return true;
  }

  return false;
}

function getDamageReduction(defender: Character, isAllyTarget: boolean, team: Character[]): number {
  let reduction = 0;

  if (defender.passive?.id === 'boss_dia_reduction') {
    reduction += 3;
  }

  if (defender.passive?.id === 'enemy_ceras_reduction') {
    reduction += 1;
  }

  if (isAllyTarget && defender.group === 'president' && hasBond(team, 'president', 2)) {
    reduction += 3;
  }

  return reduction;
}

function applyRoleDamageMultiplier(damage: number, defender: Character, isAllyDefender: boolean, log: string[]): number {
  if (!isAllyDefender || !defender.role) {
    return damage;
  }

  const multiplier = ROLE_DAMAGE_MULTIPLIERS[defender.role];
  if (multiplier === 1) {
    return damage;
  }

  const adjustedDamage = Math.max(1, Math.round(damage * multiplier));
  log.push(`${defender.name}作为${ROLE_LABELS[defender.role]}，承受伤害${Math.round(multiplier * 100)}%，本次伤害调整为${adjustedDamage}。`);
  return adjustedDamage;
}

function applyDamageToShieldAndHp(defender: Character, damage: number) {
  const shieldDamage = Math.min(defender.shield, damage);
  defender.shield -= shieldDamage;
  defender.hp = Math.max(0, defender.hp - (damage - shieldDamage));
}

function addFightingSpirit(character: Character, runtime: RuntimeState, log: string[], amount = 1) {
  if (character.templateId !== 'mari') {
    return;
  }

  const flags = getFlags(runtime, character.id);
  const limit = upgradeLevel(character) >= 5 ? 7 : 5;
  const before = flags.fightingSpirit ?? 0;
  flags.fightingSpirit = Math.min(limit, before + amount);
  if (flags.fightingSpirit > before) {
    log.push(`${character.name}获得${flags.fightingSpirit - before}层战意（${flags.fightingSpirit}/${limit}）。`);
  }
}

function getDreamDamageBonus(attacker: Character, defender: Character, runtime: RuntimeState): number {
  if (attacker.templateId !== 'kanata') {
    return 0;
  }

  const dreamStacks = Math.min(2, getFlags(runtime, defender.id).dreamStacks ?? 0);
  const perStack = upgradeLevel(attacker) >= 4 ? 0.08 : upgradeLevel(attacker) >= 2 ? 0.05 : 0.03;
  return dreamStacks * perStack;
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
    attacker.skill.id === 'boss_kasumi_cutest' && (flags.skillCooldown ?? 0) <= 0;

  if (attacker.passive?.id === 'ayumu_low_hp' && attacker.hp / attacker.maxHp < 0.5) {
    damage *= 1.2;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本次攻击力+20%。`);
  }

  if (attacker.passive?.id === 'mari_shiny' && attacker.shield > 0 && flags.mariSkillActive) {
    const flags = getFlags(runtime, attacker.id);
    const spirit = flags.fightingSpirit ?? 0;
    const skillBonus = upgradeLevel(attacker) >= 4 ? spirit * 0.03 : 0;
    const multiplier = 1.5 + skillBonus;
    damage *= multiplier;
    criticalChance = 1;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，拥有护盾时必定暴击，技能伤害提高${Math.round((multiplier - 1) * 100)}%。`);
  }

  if (attacker.passive?.id === 'yoshiko_power' && defender.poison > 0 && upgradeLevel(attacker) >= 3) {
    damage += 3;
    log.push(`${attacker.name}发动《${attacker.passive.name}》，目标中毒时额外+3伤害。`);
  }

  if (attacker.passive?.id === 'elite_umi_low_hp' && attacker.hp / attacker.maxHp < 0.6) {
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


  if (attacker.skill.id === 'keke_charge' && flags.kekeCharged) {
    flags.kekeCharged = false;
    flags.kekeChargeCooldown = 1;
    damage *= 2;
    log.push(`${attacker.name}消耗《${attacker.skill.name}》，本次攻击造成2倍伤害。`);
  }

  if (attacker.skill.id === 'keke_charge' && flags.transformed && upgradeLevel(attacker) >= 2) {
    const multiplier = upgradeLevel(attacker) >= 5
      ? (Math.random() < 0.1 ? 5 : 3.3)
      : upgradeLevel(attacker) >= 4
        ? (Math.random() < 0.1 ? 4 : 2.5)
        : (Math.random() < 0.1 ? 3 : 1.75);
    damage *= multiplier;
    log.push(`${attacker.name}发动《可可重击》，本次攻击造成${multiplier}倍伤害。`);
  }

  if (flags.nextAttackMultiplier) {
    const multiplier = flags.nextAttackMultiplier;
    flags.nextAttackMultiplier = undefined;
    damage *= multiplier;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，本次攻击造成${multiplier}倍伤害。`);
  }

  if (kotoriCritSkillActive) {
    criticalChance += upgradeLevel(attacker) >= 2 ? 0.5 : 0.3;
  }

  if (kasumiSkillActive) {
    damage *= 1.5;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，本次攻击伤害+50%。`);
  }

  if (flags.forceCritical) {
    criticalChance = 1;
    flags.forceCritical = false;
    log.push(`${attacker.name}发动「${attacker.passive?.name ?? '必定暴击'}」，本次攻击必定暴击。`);
  }

  if (isAllyAttacker && hasBond(team, 'cute', 3)) {
    criticalChance += 0.15;
  }

  if (isAllyAttacker && hasSecondaryBond(team, 'energetic_idol') && !flags.firstCritBoostUsed) {
    flags.firstCritBoostUsed = true;
    criticalChance += 0.5;
    log.push(`${attacker.name}触发「元气偶像」，首回合暴击率+50%。`);
  }

  if (attacker.passive?.id === 'elite_natsumi_traffic') {
    criticalChance = 1;
  }

  const critical = Math.random() < Math.min(1, criticalChance);
  if (critical) {
    const criticalMultiplier = attacker.passive?.id === 'elite_natsumi_traffic' ? 2.5 : 2;
    damage *= criticalMultiplier;
    log.push(`${attacker.name}打出暴击。`);
  }

  if (bossPowerSkillActive || kasumiSkillActive) {
    flags.skillCooldown = 1;
  }

  if (isAllyAttacker && hasSecondaryBond(team, 'campus_leader') && !flags.firstLeaderDoubleUsed) {
    flags.firstLeaderDoubleUsed = true;
    damage *= 1.5;
    log.push(`${attacker.name}触发「校园领袖」，首次攻击造成1.5倍伤害。`);
  }

  if (
    isAllyAttacker &&
    (attacker.templateId === 'keke' || attacker.templateId === 'kotori' || attacker.templateId === 'you') &&
    hasBond(team, 'silver', 2) &&
    !flags.greyFirstDamageBoostUsed
  ) {
    flags.greyFirstDamageBoostUsed = true;
    const multiplier = hasBond(team, 'silver', 3) ? 1.5 : 1.25;
    damage *= multiplier;
    log.push(`${attacker.name}触发「古灵精怪」，首次造成伤害提高${Math.round((multiplier - 1) * 100)}%。`);
  }

  if (defender.vulnerable > 0) {
    defender.vulnerable -= 1;
    damage *= defender.vulnerableMultiplier || 2;
    defender.vulnerableMultiplier = 2;
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

  const dreamBonus = getDreamDamageBonus(attacker, defender, runtime);
  if (dreamBonus > 0) {
    damage *= 1 + dreamBonus;
    log.push(`${attacker.name}利用梦境侵蚀，本次伤害提高${Math.round(dreamBonus * 100)}%。`);
  }

  damage = applyRoleDamageMultiplier(damage, defender, isAllyDefender, log);

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
  stats: BattleStats,
) {
  if (attacker.skill.id !== 'kanata_execute' && tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats)) {
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
  if (defender.passive?.id === 'elite_riko_inspiration' && (defenderFlags.damageNegatedCount ?? 0) < 2) {
    defenderFlags.damageNegatedCount = (defenderFlags.damageNegatedCount ?? 0) + 1;
    damage = 0;
    log.push(`${defender.name}发动「${defender.passive.name}」，受到的第${defenderFlags.damageNegatedCount}次伤害无效。`);
  }

  if (damage > 0 && defender.passive?.id === 'enemy_shizuku_first_guard' && !defenderFlags.firstDamageHalved) {
    defenderFlags.firstDamageHalved = true;
    damage = Math.max(1, Math.ceil(damage * 0.5));
    log.push(`${defender.name}发动「${defender.passive.name}」，首次受到伤害减半。`);
  }

  if (
    damage > 0 &&
    isAllyDefender &&
    defender.templateId === 'kanata' &&
    upgradeLevel(defender) >= 2 &&
    attacker.bossTier &&
    !defenderFlags.bossFatalGuardUsed
  ) {
    const hpDamage = Math.max(0, damage - defender.shield);
    if (hpDamage >= defender.hp) {
      defenderFlags.bossFatalGuardUsed = true;
      defenderFlags.nextAttackMultiplier = 3;
      damage = Math.max(0, defender.shield + defender.hp - 1);
      log.push(`${defender.name}触发Lv2强化，Boss战首次致命伤保留1HP，下次攻击造成3倍伤害。`);
    }
  }

  const defenderShieldBefore = defender.shield;
  const defenderDurabilityBefore = defender.hp + defender.shield;
  applyDamageToShieldAndHp(defender, damage);
  const actualDamage = Math.min(damage, defenderDurabilityBefore);
  log.push(`${attacker.name}攻击${defender.name}，造成${damage}伤害，${defender.name}剩余${defender.hp}HP。`);

  const kotoriTrueDamage =
    actualDamage > 0 && attacker.skill.id === 'kotori_crit' && upgradeLevel(attacker) >= 3 && defender.hp > 0
      ? Math.min(10, defender.hp)
      : 0;
  if (kotoriTrueDamage > 0) {
    defender.hp = Math.max(0, defender.hp - kotoriTrueDamage);
    log.push(`${attacker.name}触发Lv3强化，技能伤害结算后额外造成${kotoriTrueDamage}点真实伤害，${defender.name}剩余${defender.hp}HP。`);
    tryBossEncore(defender, runtime, log);
  }
  let kanataDreamDamage = 0;
  if (actualDamage > 0 && attacker.skill.id === 'kanata_execute' && defender.hp > 0) {
    const dreamRate = Math.random() < (upgradeLevel(attacker) >= 5 ? 0.5 : 0.2) ? 0.2 : 0.1;
    kanataDreamDamage = Math.max(1, Math.floor(defender.hp * dreamRate));
    defender.hp = Math.max(0, defender.hp - kanataDreamDamage);
    log.push(`${attacker.name}发动《${attacker.skill.name}》，追加目标当前生命${Math.round(dreamRate * 100)}%的伤害，造成${kanataDreamDamage}点，${defender.name}剩余${defender.hp}HP。`);
    tryBossEncore(defender, runtime, log);
    tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats);
  }
  const totalActualDamage = actualDamage + kotoriTrueDamage + kanataDreamDamage;
  const shieldBlocked = Math.min(defenderShieldBefore, actualDamage);
  if (totalActualDamage > 0 && isAllyAttacker) {
    const attackerStats = getBattleStat(stats, attacker);
    attackerStats.damageDealt += totalActualDamage;
    if (critical) {
      attackerStats.criticalHits += 1;
    }
  }
  if (totalActualDamage > 0 && isAllyDefender) {
    const defenderStats = getBattleStat(stats, defender);
    defenderStats.damageTaken += actualDamage - shieldBlocked + kotoriTrueDamage;
    defenderStats.shieldBlocked += shieldBlocked;
  }

  if (actualDamage > 0 && attacker.skill.id === 'yoshiko_poison' && defender.hp > 0) {
    log.push(`${attacker.name}触发Lv1强化，攻击附加1层毒。`);
    applyPoison(defender, 1, log);
  }

  if (attacker.passive?.id === 'keke_inspiration') {
    const restored = heal(attacker, Math.floor(totalActualDamage * 0.15));
    if (restored > 0) {
      log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
    }
  }

  if (actualDamage > 0) {
    addFightingSpirit(attacker, runtime, log);
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

  if (
    defender.hp > 0 &&
    defender.passive?.id === 'elite_kanon_center_stage' &&
    !defenderFlags.encoreUsed &&
    defender.hp / defender.maxHp < 0.2
  ) {
    defenderFlags.encoreUsed = true;
    const restored = heal(defender, 30);
    log.push(`${defender.name}发动「${defender.passive.name}」，生命首次低于20%，恢复${restored}HP。`);
  }

  if (defender.hp > 0 && defender.passive?.id === 'eli_training') {
    defender.battleAttackBonus += 1;
    log.push(`${defender.name}发动「${defender.passive.name}」，本场攻击力+1。`);
  }

  if (defender.hp > 0 && defender.passive?.id === 'elite_emma_warm_power') {
    defender.battleAttackBonus += 2;
    log.push(`${defender.name}发动「${defender.passive.name}」，本场攻击力+2。`);
  }

  if (critical && actualDamage > 0 && isAllyAttacker && hasSecondaryBond(team, 'little_devil') && defender.hp > 0) {
    log.push(`${attacker.name}触发「小恶魔」，暴击附加5层毒。`);
    applyPoison(defender, 5, log);
  }

  if (attacker.skill.id === 'you_vulnerable' && !flags.firstAttackUsed && defender.hp > 0) {
    flags.firstAttackUsed = true;
    log.push(`${attacker.name}发动「${attacker.skill.name}」。`);
    applyVulnerable(defender, log, upgradeLevel(attacker) >= 2 ? 2.5 : 2);
  }

  if (
    attacker.skill.id === 'yoshiko_poison' &&
    (flags.skillCooldown ?? 0) <= 0 &&
    defender.hp > 0
  ) {
    log.push(`${attacker.name}发动「${attacker.skill.name}」。`);
    applyPoison(defender, upgradeLevel(attacker) >= 2 ? 4 : 3, log);
    flags.skillCooldown = 1;
  }

  tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats);
}

function takeTurn(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
  stats: BattleStats,
) {
  if (processPoison(attacker, isAllyAttacker, team, runtime, log)) {
    return;
  }

  const flags = getFlags(runtime, attacker.id);
  const chargeCooldown = flags.kekeChargeCooldown ?? 0;
  const skillCooldown = flags.skillCooldown ?? 0;

  if (attacker.passive?.id === 'nozomi_turn_shield') {
    addShield(attacker, 3, log, `发动「${attacker.passive.name}」`);
  }

  if (attacker.passive?.id === 'mari_shiny') {
    const spiritFlags = getFlags(runtime, attacker.id);
    if (upgradeLevel(attacker) >= 2 && !spiritFlags.spiritOpeningGranted) {
      spiritFlags.spiritOpeningGranted = true;
      addFightingSpirit(attacker, runtime, log, 2);
    }
    const spirit = spiritFlags.fightingSpirit ?? 0;
    if (spirit > 0) {
      const shieldPerStack = upgradeLevel(attacker) >= 3 ? 1 : 0.5;
      const shieldAmount = Math.floor(spirit * shieldPerStack);
      const attackBonus = Math.floor(spirit * 0.5);
      if (shieldAmount > 0) {
        addShield(attacker, shieldAmount, log, `发动「${attacker.passive.name}」`);
      }
      if (attackBonus > 0) {
        attacker.battleAttackBonus += attackBonus;
        log.push(`${attacker.name}发动「${attacker.passive.name}」，战意提供本场攻击力+${attackBonus}。`);
      }
    }
  }

  if (attacker.passive?.id === 'kanata_nap') {
    const defenderFlags = getFlags(runtime, defender.id);
    defenderFlags.dreamStacks = Math.min(2, (defenderFlags.dreamStacks ?? 0) + 1);
    log.push(`${attacker.name}发动「${attacker.passive.name}」，${defender.name}获得1层梦境（${defenderFlags.dreamStacks}/2）。`);
  }

  if (attacker.passive?.id === 'elite_kanan_training') {
    attacker.battleSpeedBonus += 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场速度+1。`);
  }

  if (attacker.passive?.id === 'elite_kaho_never_give_up') {
    flags.turnsTaken = (flags.turnsTaken ?? 0) + 1;
    if (flags.turnsTaken % 2 === 0) {
      const restored = heal(attacker, 15);
      log.push(`${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`);
    }
  }

  if (attacker.passive?.id === 'elite_setsuna_focus') {
    flags.focus = (flags.focus ?? 0) + 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，获得1层专注。`);
  }

  if (attacker.passive?.id === 'enemy_tsuzuri_growth') {
    attacker.battleAttackBonus += 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+1。`);
  }

  if (attacker.skill.id === 'ayumu_musou' && skillCooldown <= 0) {
    const baseHeal = upgradeLevel(attacker) === 1 ? 5 : upgradeLevel(attacker) === 2 ? 10 : 15;
    const bonus = flags.ayumuHealBonus ?? 0;
    const amount = baseHeal + bonus;
    let totalRestored = 0;
    team.filter((member) => !member.injured && member.hp > 0).forEach((member) => {
      totalRestored += heal(member, amount);
      if (upgradeLevel(attacker) >= 3 && member.poison > 0) {
        member.poison = 0;
      }
    });
    if (totalRestored > 0) {
      flags.ayumuHealBonus = bonus + 3;
    }
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，全体友方恢复${amount}HP${upgradeLevel(attacker) >= 3 ? '并解除所有毒层' : ''}。`);
    return;
  }

  if (attacker.passive?.id === 'boss_honoka_growth' || attacker.passive?.id === 'boss_maki_growth') {
    const attackBonus = attacker.passive.id === 'boss_honoka_growth' ? 1 : 2;
    attacker.battleAttackBonus += attackBonus;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+${attackBonus}。`);
  }

  if (attacker.passive?.id === 'boss_chika_regen') {
    const restored = heal(attacker, 5);
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
      const restored = heal(attacker, 10);
      log.push(`${attacker.name}发动「${attacker.skill.name}」，恢复${restored}HP。`);
    } else {
      addShield(attacker, 25, log, `发动「${attacker.skill.name}」`);
    }
    flags.skillCooldown = 1;
    return;
  }

  if (attacker.skill.id === 'nozomi_fortune' && skillCooldown <= 0) {
    const shieldTarget = team
      .filter((member) => member.id !== attacker.id && !member.injured && member.hp > 0)
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
    if (shieldTarget) {
      const shieldAmount = upgradeLevel(attacker) >= 2 ? 8 : 5;
      addShield(shieldTarget, shieldAmount, log, `发动「${attacker.skill.name}」`);
      flags.skillCooldown = 1;
      return;
    }
  }

  if (attacker.skill.id === 'eli_discipline' && skillCooldown <= 0) {
    const attackBonus = upgradeLevel(attacker) === 1 ? 2 : upgradeLevel(attacker) === 2 ? 3 : 4;
    team.filter((member) => !member.injured && member.hp > 0).forEach((member) => {
      member.battleAttackBonus += attackBonus;
      if (upgradeLevel(attacker) >= 3) {
        member.battleSpeedBonus += 2;
      }
    });
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，全体友方攻击力+${attackBonus}${upgradeLevel(attacker) >= 3 ? '，速度+2' : ''}。`);
    return;
  }

  if (attacker.skill.id === 'mari_shield') {
    addFightingSpirit(attacker, runtime, log);
    if (upgradeLevel(attacker) >= 5 && (flags.fightingSpirit ?? 0) >= 7 && defender.hp > 0) {
      const remainingHp = defender.hp;
      defender.hp = 0;
      if (isAllyAttacker && remainingHp > 0) {
        getBattleStat(stats, attacker).damageDealt += remainingHp;
      }
      log.push(`${attacker.name}战意达到7层，发动《${attacker.skill.name}》直接斩杀${defender.name}。`);
      tryBossEncore(defender, runtime, log);
      return;
    }

    flags.mariSkillActive = true;
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);
    flags.mariSkillActive = false;
    return;
  }

  if (attacker.skill.id === 'nico_triple' && (skillCooldown <= 0 || upgradeLevel(attacker) >= 4)) {
    if (upgradeLevel(attacker) >= 4 && attacker.hp / attacker.maxHp <= 0.2) {
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);
      return;
    }

    const hpLoss = upgradeLevel(attacker) >= 3
      ? 0
      : Math.min(
          Math.max(0, attacker.hp - 1),
          Math.max(1, Math.ceil(attacker.hp * 0.1)),
        );
    attacker.hp -= hpLoss;
    if (attacker.passive?.id === 'nico_skill_growth') {
      const attackBonus = upgradeLevel(attacker) >= 2 ? 4 : 3;
      attacker.attack += attackBonus;
      log.push(`${attacker.name}发动《${attacker.passive.name}》，攻击力永久+${attackBonus}。`);
    }
    const hits = upgradeLevel(attacker) >= 5 ? 4 : upgradeLevel(attacker) >= 3 ? 3 : 2;
    if (upgradeLevel(attacker) < 4) {
      flags.skillCooldown = 1;
    }
    log.push(`${attacker.name}发动《${attacker.skill.name}》${hpLoss > 0 ? `，失去${hpLoss}HP` : ''}，连续攻击${hits}次。`);
    for (let hit = 0; hit < hits && defender.hp > 0; hit += 1) {
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);
    }
    return;
  }

  if (attacker.skill.id === 'keke_charge' && !flags.transformed && !flags.skillUsedOnce) {
    flags.transformed = true;
    flags.skillUsedOnce = true;
    const attackBonus = upgradeLevel(attacker) >= 5 ? 5 : upgradeLevel(attacker) >= 3 ? 3 : 1;
    attacker.attack += attackBonus;
    attacker.speed += 1;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，变身完成，攻击力+${attackBonus}，速度+1。`);
    return;
  }

  resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);

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
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);
  }

  if (
    attacker.hp > 0 &&
    defender.hp > 0 &&
    attacker.skill.id === 'rina_double' &&
    Math.random() < (upgradeLevel(attacker) >= 2 ? 0.5 : 0.3)
  ) {
    if (upgradeLevel(attacker) >= 2) {
      addShield(attacker, 10, log, '触发Lv2强化');
    }
    log.push(`${attacker.name}发动「${attacker.skill.name}」，追加一次攻击。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats);
  }
  if (attacker.hp > 0 && attacker.passive?.id === 'boss_kasumi_stage_growth') {
    const stacks = Math.min(5, flags.kasumiStageStacks ?? 0);
    if (stacks < 5) {
      flags.kasumiStageStacks = stacks + 1;
      attacker.battleAttackBonus += 1;
      log.push(`${attacker.name}发动《${attacker.passive.name}》，攻击力+1（${flags.kasumiStageStacks}/5）。`);
    }
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
  stats: BattleStats,
) {
  allies.forEach((ally) => prepareCombatant(ally, enemy, true, team, runtime, log));
  prepareCombatant(enemy, allies[0], false, team, runtime, log);

  log.push(`开始团队战斗：${allies.map((ally) => ally.name).join("、")} VS ${enemy.name}。`);
  let rounds = 0;

  while (allies.some((ally) => ally.hp > 0) && enemy.hp > 0 && rounds < 80) {
    rounds += 1;
    log.push(`第${rounds}回合。`);
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
          takeTurn(actor.character, enemy, true, team, runtime, log, stats);
        }
        continue;
      }

      if (enemy.hp <= 0) {
        break;
      }
      const livingAllies = allies.filter((ally) => ally.hp > 0);
      const firstTarget = livingAllies[Math.floor(Math.random() * livingAllies.length)];
      if (firstTarget) {
        takeTurn(enemy, firstTarget, false, team, runtime, log, stats);
      }

      for (const extraTarget of livingAllies) {
        if (enemy.hp <= 0 || extraTarget.hp <= 0 || extraTarget.id === firstTarget?.id) {
          continue;
        }
        resolveAttack(enemy, extraTarget, false, true, team, runtime, log, stats);
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
        log.push(`${member.name}触发「天使」，战后恢复${restored}HP。`);
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
  const stats: BattleStats = Object.fromEntries(
    Object.entries(battleInput.stats ?? {}).map(([id, value]) => [id, { ...value }]),
  );
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
        stats,
      },
    };
  }

  log.push(`${allies.map((ally) => ally.name).join("、")}同时上场。`);
  let activeEnemyIndex = battleInput.activeEnemyIndex;
  let winningAlly: Character | null = null;

  while (allies.some((ally) => ally.hp > 0) && activeEnemyIndex < enemies.length) {
    const enemy = enemies[activeEnemyIndex];
    allies.forEach((ally) => getBattleStat(stats, ally));
    runGroupBattle(allies, enemy, team, runtime, log, stats);

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
      runtime,      stats,

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
