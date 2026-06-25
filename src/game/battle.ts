import type { BattleEvent, BattlePhase, BattleState, BattleStats, Character, RuntimeFlags, RuntimeState, BattleType, UpgradeLevel } from './types';
import { hasBond, hasSecondaryBond } from './bonds';
import { HERO_BATTLE_TRANSFORM_ILLUSTRATIONS } from '../battleAssets';
import { ROLE_DAMAGE_MULTIPLIERS, ROLE_LABELS } from './data/labels';
import { getBossBattleLine } from './battleNarration';
import { clearBattleOnlyState, copyCharacter, copyRuntime, getBattleStat, getFlags } from './battleState';
import {
  type BattleEventEmitter,
  createBattleEventEmitter,
  emitBattleEvent,
  emitLogEvent,
} from './battleEvents';

let battleRandom: () => number = () => 0.5;

export function withBattleRandom<T>(random: () => number, run: () => T): T {
  const previousRandom = battleRandom;
  battleRandom = random;
  try {
    return run();
  } finally {
    battleRandom = previousRandom;
  }
}

export function getBattleSlots(type: BattleType, aliveCount: number): number {
  const desiredSlots: Record<BattleType, number> = {
    battle: 1,
    elite: 2,
    boss: 3,
  };

  return Math.max(1, Math.min(desiredSlots[type], aliveCount));
}

function emitBossLine(emit: BattleEventEmitter | undefined, boss: Character, timing: 'start' | 'win' | 'lose') {
  const line = getBossBattleLine(boss.templateId, timing);
  if (!line) {
    return;
  }

  emitBattleEvent(emit, {
    kind: 'major',
    text: `Boss台词：${boss.name}「${line}」`,
    actorId: boss.id,
    actorName: boss.name,
  });
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
  const multiplier = character.healingMultiplier ?? (character.healingReduced ? 0.5 : 1);
  const finalAmount = Math.ceil(amount * multiplier);
  character.hp = Math.min(character.maxHp, character.hp + finalAmount);
  return character.hp - before;
}

function addShield(character: Character, amount: number, log: string[], reason: string, emit?: BattleEventEmitter) {
  if (amount <= 0) {
    return;
  }

  const multiplier = character.shieldGainMultiplier ?? (character.shieldGainReduced ? 0.5 : 1);
  const finalAmount = Math.ceil(amount * multiplier);
  character.shield += finalAmount;
  const reductionText = multiplier < 1 ? `（护盾削弱，获得量降低${Math.round((1 - multiplier) * 100)}%）` : '';
  const text = `${character.name}${reason}，获得${finalAmount}护盾${reductionText}。`;
  log.push(text);
  emitBattleEvent(emit, {
    kind: 'shield',
    text,
    actorId: character.id,
    targetId: character.id,
    actorName: character.name,
    targetName: character.name,
    amount: finalAmount,
  });
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

function applyShieldReduction(target: Character, log: string[], multiplier = 0.5) {
  const currentMultiplier = target.shieldGainMultiplier ?? (target.shieldGainReduced ? 0.5 : 1);
  if (currentMultiplier <= multiplier) {
    return;
  }

  applyStatus(target, '护盾削弱', () => {
    target.shieldGainReduced = true;
    target.shieldGainMultiplier = multiplier;
    log.push(`${target.name}受到护盾削弱，后续获得的护盾量降低${Math.round((1 - multiplier) * 100)}%。`);
  }, log);
}

function applyHealingReduction(target: Character, log: string[], multiplier = 0.5) {
  const currentMultiplier = target.healingMultiplier ?? (target.healingReduced ? 0.5 : 1);
  if (currentMultiplier <= multiplier) {
    return;
  }

  applyStatus(target, '回血削弱', () => {
    target.healingReduced = true;
    target.healingMultiplier = multiplier;
    log.push(`${target.name}受到回血削弱，后续回血效果降低${Math.round((1 - multiplier) * 100)}%。`);
  }, log);
}

function applyPoison(target: Character, layers: number, log: string[], maxLayers?: number) {
  applyStatus(target, '毒', () => {
    const before = target.poison;
    target.poison = maxLayers === undefined ? target.poison + layers : Math.min(maxLayers, target.poison + layers);
    log.push(`${target.name}获得${target.poison - before}层毒${maxLayers === undefined ? '' : `（${target.poison}/${maxLayers}）`}。`);
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
  emit?: BattleEventEmitter,
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

  if (!isAlly && actor.passive && (actor.rarity === 'elite' || actor.enemyTier === 'strong')) {
    emitBattleEvent(emit, {
      kind: 'start',
      text: `${actor.name}的「${actor.passive.name}」准备生效。`,
      actorId: actor.id,
      actorName: actor.name,
    });
  }

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

  if (isAlly && actor.passive?.id === 'rina_board' && upgradeLevel(actor) >= 2) {
    addShield(actor, 10, log, '触发Lv2璃奈板', emit);
  }

  if (isAlly && actor.passive?.id === 'kotori_shield_breaker') {
    applyShieldReduction(_opponent, log);
  }

  if (isAlly && actor.passive?.id === 'eli_training') {
    applyHealingReduction(_opponent, log);
  }

  if (!isAlly && actor.passive?.id === 'boss_chisato_perfect_rhythm') {
    team.filter((member) => !member.injured && member.hp > 0).forEach((member) => {
      applyHealingReduction(member, log, 0.7);
      applyShieldReduction(member, log, 0.7);
    });
    log.push(`${actor.name}发动「${actor.passive.name}」，敌方全体治疗与护盾获得降低30%。`);
  }

  if (!isAlly && actor.passive?.id === 'boss_izumi_suppression') {
    const suppressionTarget = team
      .filter((member) => !member.injured && member.hp > 0)
      .sort((left, right) => {
        const levelDifference = upgradeLevel(right) - upgradeLevel(left);
        if (levelDifference !== 0) {
          return levelDifference;
        }
        return effectiveAttack(right) - effectiveAttack(left);
      })[0];
    if (suppressionTarget) {
      suppressionTarget.battleAttackBonus -= 3;
      log.push(`${actor.name}发动「${actor.passive.name}」，压制${suppressionTarget.name}，攻击-3。`);
    }
  }

  if (isAlly && hasSecondaryBond(team, 'full_speed')) {
    actor.battleSpeedBonus += 5;
    log.push(`${actor.name}触发「全速模式」，速度+5。`);
  }

  if (isAlly && hasBond(team, 'cute', 2)) {
    const attackBonus = hasBond(team, 'cute', 3) ? 3 : 1;
    actor.battleAttackBonus += attackBonus;
    log.push(`${actor.name}触发「萌力扩散」，攻击+${attackBonus}。`);
  }

  if (isAlly && actor.group === 'president' && hasBond(team, 'president', 3)) {
    addShield(actor, Math.ceil(actor.maxHp * 0.2), log, '触发「领袖风范」', emit);
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
  emit?: BattleEventEmitter,
): boolean {
  if (actor.poison <= 0 || actor.hp <= 0) {
    return actor.hp <= 0;
  }

  const damage = actor.poison;
  actor.hp = Math.max(0, actor.hp - damage);
  const text = `${actor.name}受到${damage}点毒伤害。`;
  log.push(text);
  emitBattleEvent(emit, {
    kind: 'damage',
    text,
    targetId: actor.id,
    targetName: actor.name,
    amount: damage,
    hpLeft: actor.hp,
  });
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
  emit?: BattleEventEmitter,
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
    const text = `${attacker.name}发动「${attacker.skill.name}」，直接斩杀${defender.name}。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'damage',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
      amount: remainingHp,
      hpLeft: defender.hp,
    });
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

function applyRoleDamageMultiplier(
  damage: number,
  defender: Character,
  isAllyDefender: boolean,
): { damage: number; logText?: string } {
  if (!isAllyDefender || !defender.role) {
    return { damage };
  }

  const multiplier = ROLE_DAMAGE_MULTIPLIERS[defender.role];
  if (multiplier === 1) {
    return { damage };
  }

  const adjustedDamage = Math.max(1, Math.round(damage * multiplier));
  return {
    damage: adjustedDamage,
    logText: `${defender.name}作为${ROLE_LABELS[defender.role]}，承受伤害${Math.round(multiplier * 100)}%，本次伤害调整为${adjustedDamage}。`,
  };
}

function applyDamageToShieldAndHp(defender: Character, damage: number): { shieldDamage: number; hpDamage: number } {
  const shieldDamage = Math.min(defender.shield, damage);
  const hpDamage = Math.min(defender.hp, Math.max(0, damage - shieldDamage));
  defender.shield -= shieldDamage;
  defender.hp = Math.max(0, defender.hp - hpDamage);
  return { shieldDamage, hpDamage };
}

function dealDirectDamage(
  attacker: Character,
  targets: Character[],
  amount: number,
  isAllyAttacker: boolean,
  stats: BattleStats,
  log: string[],
  emit: BattleEventEmitter | undefined,
  reason: string,
) {
  targets.filter((target) => target.hp > 0).forEach((target) => {
    const shieldBefore = target.shield;
    const durabilityBefore = target.hp + target.shield;
    const { shieldDamage, hpDamage } = applyDamageToShieldAndHp(target, amount);
    const actualDamage = Math.min(amount, durabilityBefore);
    const shieldBlocked = Math.min(shieldBefore, shieldDamage);
    const resultText = shieldBlocked > 0
      ? `护盾抵挡${shieldBlocked}点，生命受到${hpDamage}点伤害`
      : `生命受到${hpDamage}点伤害`;
    const text = `${attacker.name}发动「${reason}」，对${target.name}造成${amount}点伤害；${resultText}，${target.name}剩余${target.hp}HP。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'damage',
      text,
      actorId: attacker.id,
      targetId: target.id,
      actorName: attacker.name,
      targetName: target.name,
      amount: actualDamage,
      hpDamage,
      shieldBlocked,
      shieldBroken: shieldBefore > 0 && target.shield === 0,
      hpLeft: target.hp,
    });
    if (actualDamage > 0 && isAllyAttacker) {
      getBattleStat(stats, attacker).damageDealt += actualDamage;
    }
    if (actualDamage > 0 && !isAllyAttacker) {
      const targetStats = getBattleStat(stats, target);
      targetStats.damageTaken += actualDamage - shieldBlocked;
      targetStats.shieldBlocked += shieldBlocked;
    }
  });
}

function expireIzumiPressureDebuff(actor: Character, runtime: RuntimeState, log: string[]) {
  const flags = getFlags(runtime, actor.id);
  const stacks = flags.izumiPressureDebuff ?? 0;
  if (stacks <= 0) {
    return;
  }

  actor.battleAttackBonus += stacks;
  flags.izumiPressureDebuff = 0;
  log.push(`${actor.name}的压制效果结束，攻击恢复${stacks}点。`);
}

function addFightingSpirit(character: Character, runtime: RuntimeState, log: string[], amount = 1) {
  if (character.templateId !== 'mari') {
    return;
  }

  const flags = getFlags(runtime, character.id);
  const limit = upgradeLevel(character) >= 5 ? 4 : 3;
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

function battleFlags(runtime: RuntimeState): RuntimeFlags {
  return getFlags(runtime, '__battle');
}

function hasMembersOnField(allies: Character[], memberIds: string[]): boolean {
  const activeIds = new Set(allies.filter((ally) => ally.hp > 0 && !ally.injured).map((ally) => ally.templateId));
  return memberIds.every((id) => activeIds.has(id));
}

function setActiveSecondaryBondFlags(allies: Character[], runtime: RuntimeState) {
  const flags = battleFlags(runtime);
  flags.littleDevilOnField = hasMembersOnField(allies, ['nico', 'yoshiko']);
  flags.nozoeliOnField = hasMembersOnField(allies, ['eli', 'nozomi']);
  flags.campusLeaderOnField = hasMembersOnField(allies, ['ren', 'ayumu']);
  flags.energeticIdolOnField = hasMembersOnField(allies, ['you', 'nico']);
  const mysteryCount = allies.filter((ally) => ally.hp > 0 && !ally.injured && ally.group === 'mystery').length;
  flags.mysteryOnFieldLevel = mysteryCount >= 3 ? 3 : mysteryCount >= 2 ? 2 : mysteryCount === 1 ? 1 : 0;
}

function calculateDamage(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  isAllyDefender: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
): { damage: number; critical: boolean; roleAdjustmentText?: string; calloutTexts: string[] } {
  const flags = getFlags(runtime, attacker.id);
  const calloutTexts: string[] = [];
  const pushCallout = (text: string) => {
    log.push(text);
    calloutTexts.push(text);
  };
  let damage = effectiveAttack(attacker);
  let criticalChance = 0;
  const kotoriCritSkillActive = attacker.skill.id === 'kotori_crit';
  const bossPowerSkillActive =
    (attacker.skill.id === 'boss_honoka_rush' || attacker.skill.id === 'boss_maki_passion') &&
    (flags.skillCooldown ?? 0) <= 0;
  const kasumiSkillActive =
    attacker.skill.id === 'boss_kasumi_cutest' && (flags.skillCooldown ?? 0) <= 0;

  if (attacker.passive?.id === 'mari_shiny' && attacker.shield > 0 && flags.mariSkillActive) {
    const flags = getFlags(runtime, attacker.id);
    const spirit = flags.fightingSpirit ?? 0;
    const multiplier = 1.5;
    damage *= multiplier;
    criticalChance = 1;
    pushCallout(`${attacker.name}发动《${attacker.skill.name}》，拥有护盾时必定暴击，造成1.5倍伤害。`);
    if (upgradeLevel(attacker) >= 5 && spirit >= 4) {
      const teammateAttackSum = team
        .filter((member) => member.id !== attacker.id && !member.injured && member.hp > 0)
        .reduce((sum, member) => sum + effectiveAttack(member), 0);
      const teamAttackBonus = Math.round(teammateAttackSum * 0.65);
      if (teamAttackBonus > 0) {
        damage += teamAttackBonus;
        log.push(`${attacker.name}处于4级战意，技能追加队友攻击力总和65%的伤害（+${teamAttackBonus}）。`);
      }
    }
  }

  if (attacker.passive?.id === 'elite_umi_low_hp' && attacker.hp / attacker.maxHp < 0.6) {
    damage *= 2;
    if (!flags.eliteUmiCalloutUsedThisTurn) {
      flags.eliteUmiCalloutUsedThisTurn = true;
      pushCallout(`${attacker.name}发动「${attacker.passive.name}」，攻击力翻倍。`);
    }
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
    pushCallout(`${attacker.name}发动「${attacker.skill.name}」，本次攻击造成1.5倍伤害。`);
  }


  if (attacker.skill.id === 'keke_charge' && flags.kekeCharged) {
    flags.kekeCharged = false;
    flags.kekeChargeCooldown = 1;
    damage *= 2;
    pushCallout(`${attacker.name}消耗《可可重击》，本次攻击造成2倍伤害。`);
  }

  if (attacker.skill.id === 'keke_charge' && flags.transformed && upgradeLevel(attacker) >= 2) {
    const multiplier = upgradeLevel(attacker) >= 5
      ? (battleRandom() < 0.1 ? 5 : 3.3)
      : upgradeLevel(attacker) >= 4
        ? (battleRandom() < 0.1 ? 4 : 2.5)
        : (battleRandom() < 0.1 ? 3 : 1.75);
    damage *= multiplier;
    pushCallout(`${attacker.name}发动《可可重击》，本次攻击造成${multiplier}倍伤害。`);
  }

  if (flags.nextAttackMultiplier) {
    const multiplier = flags.nextAttackMultiplier;
    flags.nextAttackMultiplier = undefined;
    damage *= multiplier;
    pushCallout(`${attacker.name}发动《${attacker.skill.name}》，本次攻击造成${multiplier}倍伤害。`);
  }

  if (kotoriCritSkillActive) {
    criticalChance += upgradeLevel(attacker) >= 2 ? 0.5 : 0.3;
    pushCallout(`${attacker.name}发动《${attacker.skill.name}》，本次攻击更容易暴击。`);
  }

  if (kasumiSkillActive) {
    damage *= 1.5;
    pushCallout(`${attacker.name}发动《${attacker.skill.name}》，本次攻击伤害+50%。`);
  }

  if (flags.forceCritical) {
    criticalChance = 1;
    flags.forceCritical = false;
    pushCallout(`${attacker.name}发动「${attacker.passive?.name ?? '必定暴击'}」，本次攻击必定暴击。`);
  }

  if (isAllyAttacker && hasBond(team, 'cute', 3)) {
    criticalChance += 0.1;
  }

  if (isAllyAttacker && battleFlags(runtime).energeticIdolOnField && flags.openingRound) {
    damage += 3;
    log.push(`${attacker.name}触发「元气偶像」，首回合攻击+3。`);
  }

  if (attacker.passive?.id === 'elite_natsumi_little_boss') {
    criticalChance = 1;
  }

  const critical = battleRandom() < Math.min(1, criticalChance);
  if (critical) {
    const criticalMultiplier = 2;
    damage *= criticalMultiplier;
    log.push(`${attacker.name}打出暴击。`);
  }

  if (bossPowerSkillActive || kasumiSkillActive) {
    flags.skillCooldown = 1;
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

  const roleDamage = applyRoleDamageMultiplier(damage, defender, isAllyDefender);

  return { damage: Math.max(1, Math.round(roleDamage.damage)), critical, roleAdjustmentText: roleDamage.logText, calloutTexts };
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
  emit?: BattleEventEmitter,
) {
  if (attacker.skill.id !== 'kanata_execute' && tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats, emit)) {
    return;
  }

  if (attacker.passive?.id === 'kotori_shield_breaker' && upgradeLevel(attacker) >= 3) {
    if (defender.shield > 0) {
      log.push(`${attacker.name}发动「${attacker.passive.name}」，击碎${defender.name}的${defender.shield}点护盾。`);
      defender.shield = 0;
    }
  }

  let { damage, critical, roleAdjustmentText, calloutTexts } = calculateDamage(
    attacker,
    defender,
    isAllyAttacker,
    isAllyDefender,
    team,
    runtime,
    log,
  );
  calloutTexts.forEach((text) => {
    emitBattleEvent(emit, {
      kind: 'major',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
    });
  });

  const defenderFlags = getFlags(runtime, defender.id);
  if (defender.passive?.id === 'elite_riko_inspiration' && (defenderFlags.damageNegatedCount ?? 0) < 2) {
    defenderFlags.damageNegatedCount = (defenderFlags.damageNegatedCount ?? 0) + 1;
    damage = 0;
    const text = `${defender.name}发动「${defender.passive.name}」，受到的第${defenderFlags.damageNegatedCount}次伤害无效。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'major',
      text,
      actorId: defender.id,
      targetId: attacker.id,
      actorName: defender.name,
      targetName: attacker.name,
    });
  }

  if (damage > 0 && defender.passive?.id === 'enemy_shizuku_first_guard' && !defenderFlags.firstDamageHalved) {
    defenderFlags.firstDamageHalved = true;
    damage = Math.max(1, Math.ceil(damage * 0.5));
    log.push(`${defender.name}发动「${defender.passive.name}」，首次受到伤害减半。`);
  }

  if (damage > 0 && defender.passive?.id === 'boss_hanabi_counter' && !defenderFlags.hanabiRoundGuardUsed) {
    defenderFlags.hanabiRoundGuardUsed = true;
    damage = Math.max(1, Math.ceil(damage * 0.5));
    log.push(`${defender.name}发动「${defender.passive.name}」，本回合首次受到的伤害降低50%。`);
  }

  if (damage > 0 && defender.skill.id === 'boss_umi_absolute_defense' && (defenderFlags.bossUmiAbsoluteDefenseHits ?? 0) > 0) {
    defenderFlags.bossUmiAbsoluteDefenseHits = Math.max(0, (defenderFlags.bossUmiAbsoluteDefenseHits ?? 0) - 1);
    damage = Math.max(1, Math.ceil(damage * 0.5));
    log.push(`${defender.name}发动「${defender.skill.name}」，受到的本回合前3次伤害降低50%。`);
  }

  if (damage > 0 && defender.passive?.id === 'boss_umi_iron_wall') {
    const takenThisRound = defenderFlags.bossUmiRoundDamageTaken ?? 0;
    const remainingCap = Math.max(0, 40 - takenThisRound);
    if (remainingCap <= 0) {
      damage = 0;
      log.push(`${defender.name}发动「${defender.passive.name}」，本回合伤害上限已满，超出伤害无效。`);
    } else if (damage > remainingCap) {
      log.push(`${defender.name}发动「${defender.passive.name}」，本回合最多再承受${remainingCap}点伤害。`);
      damage = remainingCap;
    }
  }

  if (
    damage > 0 &&
    isAllyDefender &&
    defender.group === 'mystery' &&
    (battleFlags(runtime).mysteryOnFieldLevel ?? 0) >= 2 &&
    !defenderFlags.bossFatalGuardUsed
  ) {
    const hpDamage = Math.max(0, damage - defender.shield);
    if (hpDamage >= defender.hp) {
      defenderFlags.bossFatalGuardUsed = true;
      if (defender.templateId === 'kanata' && upgradeLevel(defender) >= 2 && attacker.bossTier) {
        defenderFlags.nextAttackMultiplier = 3;
      }
      const mysteryLevel = battleFlags(runtime).mysteryOnFieldLevel ?? 0;
      if (mysteryLevel >= 3) {
        defenderFlags.fatalGuardShieldPending = 35;
      }
      damage = Math.max(0, defender.shield + defender.hp - 1);
      log.push(`${defender.name}触发「命运之子」，首次致命伤保留1HP${mysteryLevel >= 3 ? '并准备获得35护盾' : ''}。`);
    }
  }

  const defenderShieldBefore = defender.shield;
  const defenderDurabilityBefore = defender.hp + defender.shield;
  const { shieldDamage, hpDamage } = applyDamageToShieldAndHp(defender, damage);
  const actualDamage = Math.min(damage, defenderDurabilityBefore);
  if (actualDamage > 0 && defender.passive?.id === 'boss_umi_iron_wall') {
    defenderFlags.bossUmiRoundDamageTaken = (defenderFlags.bossUmiRoundDamageTaken ?? 0) + actualDamage;
  }
  const shieldResultText = shieldDamage > 0
    ? `护盾抵挡${shieldDamage}点，生命受到${hpDamage}点伤害`
    : `生命受到${hpDamage}点伤害`;
  const attackText = `${attacker.name}攻击${defender.name}，造成${damage}伤害；${shieldResultText}，${defender.name}剩余${defender.hp}HP。`;
  log.push(attackText);
  if (roleAdjustmentText) {
    log.push(roleAdjustmentText);
  }
  if (actualDamage > 0) {
    emitBattleEvent(emit, {
      kind: 'attack',
      text: attackText,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
      amount: actualDamage,
      hpDamage,
      shieldBlocked: Math.min(defenderShieldBefore, shieldDamage),
      shieldBroken: defenderShieldBefore > 0 && defender.shield === 0,
      critical,
      hpLeft: defender.hp,
    });
  } else {
    emitBattleEvent(emit, {
      kind: 'status',
      text: attackText,
      amount: 0,
      hpLeft: defender.hp,
    });
  }
  if (defenderFlags.fatalGuardShieldPending && defender.hp > 0) {
    const shieldAmount = defenderFlags.fatalGuardShieldPending;
    defenderFlags.fatalGuardShieldPending = undefined;
    addShield(defender, shieldAmount, log, '触发「命运之子」', emit);
  }

  const kotoriTrueDamage =
    actualDamage > 0 && attacker.skill.id === 'kotori_crit' && upgradeLevel(attacker) >= 4 && defender.hp > 0
      ? Math.min(10, defender.hp)
      : 0;
  if (kotoriTrueDamage > 0) {
    defender.hp = Math.max(0, defender.hp - kotoriTrueDamage);
    const text = `${attacker.name}触发Lv4强化，攻击额外造成${kotoriTrueDamage}点真实伤害，${defender.name}剩余${defender.hp}HP。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'damage',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
      amount: kotoriTrueDamage,
      hpLeft: defender.hp,
    });
    tryBossEncore(defender, runtime, log);
  }

  if (damage > 0 && isAllyDefender && battleFlags(runtime).campusLeaderOnField && !defenderFlags.campusLeaderGuardUsed) {
    defenderFlags.campusLeaderGuardUsed = true;
    damage = Math.max(0, damage - 3);
    log.push(`${defender.name}触发「校园领袖」，首次受到的伤害-3点。`);
  }
  let kanataDreamDamage = 0;
  if (actualDamage > 0 && attacker.skill.id === 'kanata_execute' && defender.hp > 0) {
    const dreamRate = battleRandom() < (upgradeLevel(attacker) >= 5 ? 0.5 : 0.2) ? 0.2 : 0.1;
    kanataDreamDamage = Math.max(1, Math.floor(defender.hp * dreamRate));
    defender.hp = Math.max(0, defender.hp - kanataDreamDamage);
    const text = `${attacker.name}发动《${attacker.skill.name}》，追加目标当前生命${Math.round(dreamRate * 100)}%的伤害，造成${kanataDreamDamage}点，${defender.name}剩余${defender.hp}HP。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'damage',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
      amount: kanataDreamDamage,
      hpLeft: defender.hp,
    });
    tryBossEncore(defender, runtime, log);
    tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats, emit);
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

  if (attacker.passive?.id === 'keke_inspiration') {
    const restored = heal(attacker, Math.floor(totalActualDamage * 0.15));
    if (restored > 0) {
      const text = `${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: attacker.id,
        targetId: attacker.id,
        actorName: attacker.name,
        targetName: attacker.name,
        amount: restored,
        hpLeft: attacker.hp,
      });
    }
  }

  if (actualDamage > 0) {
    addFightingSpirit(attacker, runtime, log);
  }

  if (actualDamage > 0 && attacker.passive?.id === 'enemy_karin_drain') {
    const restored = heal(attacker, 2);
    if (restored > 0) {
      const text = `${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: attacker.id,
        targetId: attacker.id,
        actorName: attacker.name,
        targetName: attacker.name,
        amount: restored,
        hpLeft: attacker.hp,
      });
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
    const text = `${defender.name}发动「${defender.passive.name}」，生命首次低于20%，恢复${restored}HP。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'heal',
      text,
      actorId: defender.id,
      targetId: defender.id,
      actorName: defender.name,
      targetName: defender.name,
      amount: restored,
      hpLeft: defender.hp,
    });
  }

  if (defender.hp > 0 && defender.passive?.id === 'elite_emma_warm_power') {
    defender.battleAttackBonus += 2;
    log.push(`${defender.name}发动「${defender.passive.name}」，本场攻击力+2。`);
  }

  if (attacker.passive?.id === 'you_full_speed' && actualDamage > 0 && defender.hp > 0) {
    const multiplier = upgradeLevel(attacker) >= 3 ? 2.5 : upgradeLevel(attacker) >= 2 ? 2 : 1.5;
    log.push(`${attacker.name}发动「${attacker.passive.name}」。`);
    applyVulnerable(defender, log, multiplier);
  }

  tryExecute(attacker, defender, isAllyAttacker, team, runtime, log, stats, emit);
}

function applyLittleDevilTurnStart(attacker: Character, runtime: RuntimeState, log: string[], emit?: BattleEventEmitter) {
  if (!battleFlags(runtime).littleDevilOnField || (attacker.templateId !== 'nico' && attacker.templateId !== 'yoshiko')) {
    return;
  }

  if (attacker.hp / attacker.maxHp > 0.5) {
    attacker.battleAttackBonus += 1;
    log.push(`${attacker.name}触发「小恶魔」，生命高于50%，本场攻击力+1。`);
    return;
  }

  addShield(attacker, 2, log, '触发「小恶魔」', emit);
}

function applyNozoeliTurnStart(attacker: Character, runtime: RuntimeState, log: string[]) {
  if (!battleFlags(runtime).nozoeliOnField || (attacker.templateId !== 'eli' && attacker.templateId !== 'nozomi')) {
    return;
  }

  if (battleRandom() < 0.5) {
    attacker.battleAttackBonus += 2;
    log.push(`${attacker.name}触发「永恒」，随机获得本场攻击力+2。`);
    return;
  }

  attacker.battleSpeedBonus += 2;
  log.push(`${attacker.name}触发「永恒」，随机获得本场速度+2。`);
}

function drawNozomiTarotCard(flags: RuntimeFlags): 'hanged' | 'wheel' | 'magician' {
  const cards: Array<'hanged' | 'wheel' | 'magician'> = flags.tarotMagicianUsedThisTurn
    ? ['hanged', 'wheel']
    : ['hanged', 'wheel', 'magician'];
  return cards[Math.floor(battleRandom() * cards.length)];
}

function castNozomiTarot(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
  stats: BattleStats,
  emit?: BattleEventEmitter,
) {
  const flags = getFlags(runtime, attacker.id);
  const card = drawNozomiTarotCard(flags);

  if (card === 'hanged') {
    const multiplier = upgradeLevel(attacker) >= 2 ? 2.5 : 1.75;
    flags.nextAttackMultiplier = multiplier;
    const text = `${attacker.name}发动《${attacker.skill.name}》，抽到「倒吊人」，本次技能伤害×${multiplier}。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'major',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
    });
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    return;
  }

  if (card === 'wheel') {
    const multiplier = upgradeLevel(attacker) >= 3 ? 1.25 : 1.1;
    const shieldAmount = upgradeLevel(attacker) >= 3 ? 12 : 8;
    flags.nextAttackMultiplier = multiplier;
    const text = `${attacker.name}发动《${attacker.skill.name}》，抽到「命运之轮」，造成${multiplier}倍伤害并获得${shieldAmount}护盾。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'major',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
    });
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    if (attacker.hp > 0) {
      addShield(attacker, shieldAmount, log, '抽到「命运之轮」', emit);
    }
    return;
  }

  flags.tarotMagicianUsedThisTurn = true;
  flags.tarotMagicianTriggeredLastSkill = true;
  const text = `${attacker.name}发动《${attacker.skill.name}》，抽到「魔术师」，本次造成1倍伤害并立即再次抽牌。`;
  log.push(text);
  emitBattleEvent(emit, {
    kind: 'major',
    text,
    actorId: attacker.id,
    targetId: defender.id,
    actorName: attacker.name,
    targetName: defender.name,
  });
  resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
  if (defender.hp > 0 && attacker.hp > 0) {
    castNozomiTarot(attacker, defender, isAllyAttacker, team, runtime, log, stats, emit);
  }
}

function takeTurn(
  attacker: Character,
  defender: Character,
  isAllyAttacker: boolean,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
  stats: BattleStats,
  emit?: BattleEventEmitter,
) {
  if (processPoison(attacker, isAllyAttacker, team, runtime, log, emit)) {
    return;
  }

  const flags = getFlags(runtime, attacker.id);
  flags.tarotMagicianUsedThisTurn = false;
  flags.tarotMagicianTriggeredLastSkill = false;
  flags.eliteUmiCalloutUsedThisTurn = false;
  const chargeCooldown = flags.kekeChargeCooldown ?? 0;
  const skillCooldown = flags.skillCooldown ?? 0;

  applyLittleDevilTurnStart(attacker, runtime, log, emit);
  applyNozoeliTurnStart(attacker, runtime, log);

  if (attacker.passive?.id === 'elite_kanan_ocean_wrath') {
    const targets = isAllyAttacker ? [defender] : team.filter((member) => !member.injured && member.hp > 0);
    dealDirectDamage(attacker, targets, 2, isAllyAttacker, stats, log, emit, attacker.passive.name);
  }

  if (attacker.passive?.id === 'elite_setsuna_burning_song') {
    const targets = isAllyAttacker ? [defender] : team.filter((member) => !member.injured && member.hp > 0);
    dealDirectDamage(attacker, targets, 4, isAllyAttacker, stats, log, emit, attacker.passive.name);
    attacker.attack += 1;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，攻击永久+1。`);
  }

  if (attacker.passive?.id === 'elite_natsumi_little_boss') {
    flags.turnsTaken = (flags.turnsTaken ?? 0) + 1;
    if (!flags.natsumiGrowthTriggered && flags.turnsTaken >= 5) {
      flags.natsumiGrowthTriggered = true;
      attacker.attack += 5;
      log.push(`${attacker.name}发动「${attacker.passive.name}」，第五回合开始攻击+5。`);
    }
  }

  if (attacker.passive?.id === 'nozomi_turn_shield') {
    addShield(attacker, upgradeLevel(attacker) >= 3 ? 5 : 3, log, `发动「${attacker.passive.name}」`, emit);
  }

  if (attacker.passive?.id === 'mari_shiny') {
    const spiritFlags = getFlags(runtime, attacker.id);
    if (upgradeLevel(attacker) >= 2 && !spiritFlags.spiritOpeningGranted) {
      spiritFlags.spiritOpeningGranted = true;
      addFightingSpirit(attacker, runtime, log, 2);
    }
    const spirit = spiritFlags.fightingSpirit ?? 0;
    if (spirit > 0) {
      const shieldPerStack = upgradeLevel(attacker) >= 3 ? 2 : 0.5;
      const shieldAmount = Math.floor(spirit * shieldPerStack);
      const attackBonus = Math.floor(spirit * (upgradeLevel(attacker) >= 3 ? 1 : 0.5));
      if (shieldAmount > 0) {
        addShield(attacker, shieldAmount, log, `发动「${attacker.passive.name}」`, emit);
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
      const text = `${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: attacker.id,
        targetId: attacker.id,
        actorName: attacker.name,
        targetName: attacker.name,
        amount: restored,
        hpLeft: attacker.hp,
      });
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
    const baseHeal = upgradeLevel(attacker) >= 3 ? 15 : 10;
    const bonus = flags.ayumuHealBonus ?? 0;
    const amount = baseHeal + bonus;
    const woundedAllies = team.filter((member) => !member.injured && member.hp > 0 && member.hp < member.maxHp);
    const targets = upgradeLevel(attacker) >= 2
      ? woundedAllies
      : woundedAllies
          .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)
          .slice(0, 1);

    if (targets.length > 0) {
      let totalRestored = 0;
      targets.forEach((member) => {
        totalRestored += heal(member, amount);
      });
      flags.ayumuHealBonus = bonus + 3;
      if (upgradeLevel(attacker) < 4) {
        flags.skillCooldown = 1;
      }
      const targetName = upgradeLevel(attacker) >= 2 ? '受伤友方' : targets[0].name;
      const text = `${attacker.name}发动《${attacker.skill.name}》，${targetName}恢复${totalRestored}HP，后续治疗量+3。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: attacker.id,
        targetId: upgradeLevel(attacker) >= 2 ? undefined : targets[0]?.id,
        actorName: attacker.name,
        targetName,
        amount: totalRestored,
        hpLeft: attacker.hp,
      });
      return;
    }
  }

  if (attacker.passive?.id === 'boss_honoka_growth' || attacker.passive?.id === 'boss_maki_growth') {
    const attackBonus = attacker.passive.id === 'boss_honoka_growth' ? 1 : 2;
    attacker.battleAttackBonus += attackBonus;
    log.push(`${attacker.name}发动「${attacker.passive.name}」，本场攻击力+${attackBonus}。`);
  }

  if (attacker.passive?.id === 'boss_chika_regen') {
    const restored = heal(attacker, 5);
    const text = `${attacker.name}发动「${attacker.passive.name}」，恢复${restored}HP。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'heal',
      text,
      actorId: attacker.id,
      targetId: attacker.id,
      actorName: attacker.name,
      targetName: attacker.name,
      amount: restored,
      hpLeft: attacker.hp,
    });
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
      const text = `${attacker.name}发动「${attacker.skill.name}」，恢复${restored}HP。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: attacker.id,
        targetId: attacker.id,
        actorName: attacker.name,
        targetName: attacker.name,
        amount: restored,
        hpLeft: attacker.hp,
      });
    } else {
      addShield(attacker, 25, log, `发动「${attacker.skill.name}」`, emit);
    }
    flags.skillCooldown = 1;
    return;
  }

  if (attacker.skill.id === 'boss_hanabi_position' && skillCooldown <= 0) {
    addShield(attacker, 10, log, `发动「${attacker.skill.name}」`, emit);
    flags.skillCooldown = 1;
    if (defender.hp > 0) {
      log.push(`${attacker.name}发动「${attacker.skill.name}」，立即进行一次普通攻击。`);
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    }
    return;
  }

  if (attacker.skill.id === 'boss_izumi_pressure' && skillCooldown <= 0) {
    flags.nextAttackMultiplier = 1.5;
    flags.skillCooldown = 1;
    team.filter((member) => !member.injured && member.hp > 0).forEach((member) => {
      member.battleAttackBonus -= 1;
      const memberFlags = getFlags(runtime, member.id);
      memberFlags.izumiPressureDebuff = (memberFlags.izumiPressureDebuff ?? 0) + 1;
    });
    log.push(`${attacker.name}发动「${attacker.skill.name}」，本次攻击造成1.5倍伤害，并使敌方全体攻击-1。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    return;
  }

  if (attacker.skill.id === 'boss_umi_absolute_defense' && skillCooldown <= 0) {
    flags.bossUmiAbsoluteDefenseHits = 3;
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，本回合受到的前三次伤害降低50%。`);
  }

  if (attacker.skill.id === 'boss_chisato_double_step' && skillCooldown <= 0) {
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动「${attacker.skill.name}」，连续攻击两次。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    if (defender.hp > 0 && attacker.hp > 0) {
      flags.nextAttackMultiplier = 0.5;
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    }
    return;
  }

  if (attacker.skill.id === 'nozomi_fortune' && skillCooldown <= 0) {
    const shieldTarget = team
      .filter((member) => member.id !== attacker.id && !member.injured && member.hp > 0)
      .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
    if (shieldTarget) {
      const shieldAmount = upgradeLevel(attacker) >= 2 ? 8 : 5;
      addShield(shieldTarget, shieldAmount, log, `发动「${attacker.skill.name}」`, emit);
      flags.skillCooldown = 1;
      return;
    }
  }

  if (attacker.skill.id === 'nozomi_tarot' && skillCooldown <= 0 && defender.hp > 0) {
    castNozomiTarot(attacker, defender, isAllyAttacker, team, runtime, log, stats, emit);
    flags.skillCooldown = upgradeLevel(attacker) >= 4 && flags.tarotMagicianTriggeredLastSkill ? 0 : 1;
    return;
  }

  if (attacker.skill.id === 'eli_discipline' && skillCooldown <= 0) {
    const attackBonus = upgradeLevel(attacker) >= 3 ? 4 : 2;
    team.filter((member) => !member.injured && member.hp > 0).forEach((member) => {
      member.battleAttackBonus += attackBonus;
    });
    flags.skillCooldown = 1;
    log.push(`${attacker.name}发动《${attacker.skill.name}》，全体友方攻击力+${attackBonus}。`);
    if (upgradeLevel(attacker) >= 4) {
      const commandTarget = team
        .filter((member) => member.id !== attacker.id && !member.injured && member.hp > 0)
        .sort((left, right) => effectiveAttack(right) - effectiveAttack(left))[0];
      if (commandTarget && defender.hp > 0) {
        log.push(`${attacker.name}指定${commandTarget.name}立即进行一次普通攻击。`);
        resolveAttack(commandTarget, defender, true, false, team, runtime, log, stats, emit);
      }
      return;
    }
    if (defender.hp > 0) {
      log.push(`${attacker.name}随后进行一次普通攻击。`);
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    }
    return;
  }

  if (attacker.skill.id === 'mari_shield') {
    addFightingSpirit(attacker, runtime, log);
    flags.mariSkillActive = true;
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    flags.mariSkillActive = false;
    return;
  }

  if (attacker.skill.id === 'nico_triple' && (skillCooldown <= 0 || upgradeLevel(attacker) >= 4)) {
    if (upgradeLevel(attacker) >= 4 && attacker.hp / attacker.maxHp <= 0.2) {
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
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
    flags.nicoComboActive = true;
    for (let hit = 0; hit < hits && defender.hp > 0; hit += 1) {
      resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
    }
    flags.nicoComboActive = false;
    return;
  }

  if (attacker.skill.id === 'keke_charge' && !flags.transformed && !flags.skillUsedOnce) {
    flags.transformed = true;
    flags.skillUsedOnce = true;
    attacker.battleSkin = HERO_BATTLE_TRANSFORM_ILLUSTRATIONS.keke;
    const attackBonus = upgradeLevel(attacker) >= 5 ? 5 : upgradeLevel(attacker) >= 3 ? 3 : 1;
    attacker.attack += attackBonus;
    attacker.speed += 1;
    const text = `${attacker.name}发动《超级变身》，变身完成，攻击力+${attackBonus}，速度+1。`;
    log.push(text);
    emitBattleEvent(emit, {
      kind: 'major',
      text,
      actorId: attacker.id,
      targetId: defender.id,
      actorName: attacker.name,
      targetName: defender.name,
    });
    return;
  }

  resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);

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
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
  }

  if (
    attacker.hp > 0 &&
    defender.hp > 0 &&
    attacker.passive?.id === 'rina_board' &&
    battleRandom() < (upgradeLevel(attacker) >= 3 ? 0.75 : 0.5)
  ) {
    log.push(`${attacker.name}发动「${attacker.passive.name}」，追加一次攻击。`);
    resolveAttack(attacker, defender, isAllyAttacker, !isAllyAttacker, team, runtime, log, stats, emit);
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

function hasAllyOpeningTurn(character: Character): boolean {
  return character.passive?.id === 'eli_training' && upgradeLevel(character) >= 2;
}

function runGroupBattle(
  allies: Character[],
  enemy: Character,
  team: Character[],
  runtime: RuntimeState,
  log: string[],
  stats: BattleStats,
  emit?: BattleEventEmitter,
) {
  setActiveSecondaryBondFlags(allies, runtime);
  allies.forEach((ally) => prepareCombatant(ally, enemy, true, team, runtime, log, emit));
  prepareCombatant(enemy, allies[0], false, team, runtime, log, emit);

  const startText = `开始团队战斗：${allies.map((ally) => ally.name).join("、")} VS ${enemy.name}。`;
  log.push(startText);
  emitLogEvent(emit, 'start', startText);
  let rounds = 0;

  while (allies.some((ally) => ally.hp > 0) && enemy.hp > 0 && rounds < 80) {
    rounds += 1;
    const roundText = `第${rounds}回合。`;
    log.push(roundText);
    emitLogEvent(emit, 'round', roundText);
    [...allies, enemy].forEach((unit) => {
      const unitFlags = getFlags(runtime, unit.id);
      unitFlags.hanabiRoundGuardUsed = false;
      unitFlags.bossUmiRoundDamageTaken = 0;
      unitFlags.bossUmiAbsoluteDefenseHits = 0;
    });
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

      const allyOpeningDifference =
        Number(right.isAlly && hasAllyOpeningTurn(right.character)) -
        Number(left.isAlly && hasAllyOpeningTurn(left.character));
      if (allyOpeningDifference !== 0) {
        return allyOpeningDifference;
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
          getFlags(runtime, actor.character.id).openingRound = rounds === 1;
          takeTurn(actor.character, enemy, true, team, runtime, log, stats, emit);
          expireIzumiPressureDebuff(actor.character, runtime, log);
        }
        continue;
      }

      if (enemy.hp <= 0) {
        break;
      }
      const livingAllies = allies.filter((ally) => ally.hp > 0);
      const firstTarget = livingAllies[Math.floor(battleRandom() * livingAllies.length)];
      if (firstTarget) {
        getFlags(runtime, enemy.id).openingRound = rounds === 1;
        takeTurn(enemy, firstTarget, false, team, runtime, log, stats, emit);
        expireIzumiPressureDebuff(enemy, runtime, log);
      }

      for (const extraTarget of livingAllies) {
        if (enemy.hp <= 0 || extraTarget.hp <= 0 || extraTarget.id === firstTarget?.id) {
          continue;
        }
        resolveAttack(enemy, extraTarget, false, true, team, runtime, log, stats, emit);
      }
    }
  }

  if (rounds >= 80) {
    const text = '战斗回合过长，系统强制结束本段团队战斗。';
    log.push(text);
    emitLogEvent(emit, 'major', text);
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

function applySecondaryVictoryEffects(team: Character[], log: string[], emit?: BattleEventEmitter): number {
  let rewardGold = 0;
  const aliveTeam = team.filter((member) => !member.injured && member.hp > 0);

  if (hasSecondaryBond(team, 'angel')) {
    aliveTeam.forEach((member) => {
      const restored = heal(member, Math.ceil(member.maxHp * 0.15));
      if (restored > 0) {
        const text = `${member.name}触发「天使」，战后恢复${restored}HP。`;
        log.push(text);
        emitBattleEvent(emit, {
          kind: 'heal',
          text,
          actorId: member.id,
          targetId: member.id,
          actorName: member.name,
          targetName: member.name,
          amount: restored,
          hpLeft: member.hp,
        });
      }
    });
  }

  if (hasSecondaryBond(team, 'lucky_star')) {
    const roll = Math.floor(battleRandom() * 3);
    const target = aliveTeam[Math.floor(battleRandom() * aliveTeam.length)];
    if (roll === 0) {
      rewardGold += 25;
      log.push('触发「幸运星」，额外获得25金币。');
    } else if (roll === 1 && target) {
      const restored = heal(target, 30);
      const text = `触发「幸运星」，${target.name}恢复${restored}HP。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'heal',
        text,
        actorId: target.id,
        targetId: target.id,
        actorName: target.name,
        targetName: target.name,
        amount: restored,
        hpLeft: target.hp,
      });
    } else if (target) {
      if (battleRandom() < 0.5) {
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
  const events: BattleEvent[] = [...(battleInput.events ?? [])];
  const emit = createBattleEventEmitter(events, team, enemies);
  const uniqueIds = [...new Set(allyIds)];
  const allies = uniqueIds
    .map((allyId) => team.find((member) => member.id === allyId))
    .filter((member): member is Character => Boolean(member && !member.injured && member.hp > 0));

  if (allies.length !== battleInput.slots) {
    const text = `需要选择${battleInput.slots}名可出战角色。`;
    log.push(text);
    emitLogEvent(emit, 'major', text);
    return {
      team,
      battle: {
        ...battleInput,
        enemies,
        log,
        events,
        runtime,
        stats,
      },
    };
  }

  const enterText = `${allies.map((ally) => ally.name).join("、")}同时上场。`;
  log.push(enterText);
  emitBattleEvent(emit, {
    kind: 'start',
    text: enterText,
    targetName: allies.map((ally) => ally.name).join('、'),
  });
  if (battleInput.type === 'boss' && enemies[0]) {
    emitBossLine(emit, enemies[0], 'start');
  }
  let activeEnemyIndex = battleInput.activeEnemyIndex;
  let winningAlly: Character | null = null;

  while (allies.some((ally) => ally.hp > 0) && activeEnemyIndex < enemies.length) {
    const enemy = enemies[activeEnemyIndex];
    allies.forEach((ally) => getBattleStat(stats, ally));
    runGroupBattle(allies, enemy, team, runtime, log, stats, emit);

    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.injured = true;
      winningAlly = allies.find((ally) => ally.hp > 0) ?? allies[0];
      const text = `${enemy.name}被击败。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'defeat',
        text,
        targetId: enemy.id,
        targetName: enemy.name,
        hpLeft: enemy.hp,
      });
      activeEnemyIndex += 1;
    } else {
      break;
    }
  }

  allies.forEach((ally) => {
    if (ally.hp <= 0) {
      ally.hp = 0;
      ally.injured = true;
      const text = `${ally.name}进入重伤状态。`;
      log.push(text);
      emitBattleEvent(emit, {
        kind: 'defeat',
        text,
        targetId: ally.id,
        targetName: ally.name,
        hpLeft: ally.hp,
      });
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
    rewardGold += applySecondaryVictoryEffects(team, log, emit);
    const text = `战斗胜利，获得${rewardGold}金币。`;
    log.push(text);
    emitLogEvent(emit, 'victory', text);
    if (battleInput.type === 'boss' && enemies[0]) {
      emitBossLine(emit, enemies[0], 'lose');
    }
  }

  if (phase === 'relay') {
    const text = `本组角色已无法继续战斗，请选择${nextSlots}名伙伴接力。`;
    log.push(text);
    emitLogEvent(emit, 'relay', text);
  }

  if (phase === 'lost') {
    const text = '所有伙伴都进入重伤状态，挑战失败。';
    log.push(text);
    emitLogEvent(emit, 'lost', text);
    if (battleInput.type === 'boss' && enemies[0]) {
      emitBossLine(emit, enemies[0], 'win');
    }
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
      events,
      runtime,
      stats,

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
