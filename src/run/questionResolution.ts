import {
  CHARACTER_POOL,
  NODE_LABELS,
  createAlly,
  getBattleSlots,
  getRewardGold,
  type BattleState,
  type BattleType,
} from '../game';
import { QUESTION_EVENTS, getGachaRarityLabel, getQuestionEvent } from '../questionEvents';
import { createSeedRng } from '../rng';
import { maxUpgradeLevel, upgradeCharacterOneLevel } from '../game/upgrades';
import { createUniqueEnemiesForBattle, randomItem } from './encounters';
import type { RunState } from './types';

export function canUseMysteryGacha(team: RunState['team'], gold: number) {
  if (team.length >= 4 || gold < 110) {
    return false;
  }
  const ownedIds = new Set(team.map((member) => member.templateId));
  return CHARACTER_POOL.some((template) => !ownedIds.has(template.id));
}

export function pickQuestionEvent(run: RunState, rng: ReturnType<typeof createSeedRng>) {
  const candidates = getQuestionEventCandidates(run);
  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  let cursor = rng.next() * totalWeight;
  for (const event of candidates) {
    cursor -= event.weight;
    if (cursor <= 0) {
      return event;
    }
  }
  return candidates[0];
}

function getQuestionEventCandidates(run: RunState) {
  const availableEvents = QUESTION_EVENTS.filter((event) => {
    if (event.id === 'fortune_teller') {
      return run.gold >= 20 && run.team.length > 0;
    }
    if (event.id === 'mystery_gacha') {
      return canUseMysteryGacha(run.team, run.gold);
    }
    return true;
  });
  return availableEvents.length > 0 ? availableEvents : QUESTION_EVENTS;
}

export function resolveQuestionEventState(
  previous: RunState,
  optionId: string,
  targetId: string | undefined,
  advanceAfterCurrentNode: (state: RunState, teamInput?: RunState['team']) => RunState,
): RunState {
  if (previous.screen !== 'question' || !previous.currentNodeId || !previous.questionEventId) {
    return previous;
  }

  const event = getQuestionEvent(previous.questionEventId);
  const rng = createSeedRng(previous.rngState);
  let team = previous.team;
  let gold = previous.gold;
  let nextEnemyAttackBonus = previous.nextEnemyAttackBonus;
  const eventLog: string[] = [`机遇「${event.title}」：${event.options.find((option) => option.id === optionId)?.label ?? '确认'}。`];

  if (event.id === 'encounter_enemy' || event.id === 'encounter_elite') {
    const aliveCount = previous.team.filter((member) => !member.injured && member.hp > 0).length;
    if (aliveCount === 0) {
      return { ...previous, screen: 'loss' };
    }

    const battleType: BattleType = event.id === 'encounter_elite' ? 'elite' : 'battle';
    const slots = getBattleSlots(battleType, aliveCount);
    const enemyAttackBonus = previous.nextEnemyAttackBonus;
    const encounter = createUniqueEnemiesForBattle(previous, battleType, rng);
    const enemies = encounter.enemies.map((enemy) =>
      enemyAttackBonus > 0 ? { ...enemy, attack: enemy.attack + enemyAttackBonus } : enemy,
    );
    const battle: BattleState = {
      nodeId: previous.currentNodeId,
      type: battleType,
      enemies,
      activeEnemyIndex: 0,
      selectedIds: [],
      slots,
      phase: 'select',
      rewardGold: getRewardGold(battleType, enemies),
      log: [
        `机遇「${event.title}」转入${NODE_LABELS[battleType]}。`,
        ...(enemyAttackBonus > 0 ? [`偶像直播风险触发，本场敌人攻击+${enemyAttackBonus}。`] : []),
      ],
      events: [],
      runtime: {},
      stats: {},
    };

    return {
      ...previous,
      screen: 'battle',
      battle,
      result: null,
      questionEventId: null,
      restHealUsed: false,
      restReviveUsed: false,
      nextEnemyAttackBonus: 0,
      rngState: rng.state,
      seenEnemyTemplateIds: encounter.seenEnemyTemplateIds,
      seenEliteTemplateIds: encounter.seenEliteTemplateIds,
      eventLog: [
        ...previous.eventLog,
        `机遇「${event.title}」触发${NODE_LABELS[battleType]}。`,
        ...(enemyAttackBonus > 0 ? [`偶像直播风险触发：本场敌人攻击+${enemyAttackBonus}。`] : []),
      ],
    };
  }

  if (event.id === 'lucky_fans') {
    gold += 40;
    eventLog.push('获得40金币。');
  }

  if (event.id === 'free_show') {
    team = team.map((member) =>
      member.injured ? member : { ...member, hp: Math.min(member.maxHp, member.hp + 15) },
    );
    eventLog.push('全队回复15HP。');
  }

  if (event.id === 'training') {
    const target = randomItem(team.filter((member) => (member.upgradeLevel ?? 1) < maxUpgradeLevel(member.rarity)), rng);
    if (target) {
      team = team.map((member) => member.id === target.id ? upgradeCharacterOneLevel(member) : member);
      eventLog.push(`${target.name}升级1级。`);
    } else {
      gold += 30;
      eventLog.push('没有可升级角色，转化为30金币。');
    }
  }

  if (event.id === 'extreme_training') {
    team = team.map((member) => {
      const nextHp = Math.max(0, member.hp - 10);
      return {
        ...member,
        hp: nextHp,
        injured: member.injured || nextHp <= 0,
        attack: member.attack + 1,
      };
    });
    eventLog.push('全队失去10HP，全队攻击永久+1。');
  }

  if (event.id === 'idol_stream') {
    gold += 100;
    nextEnemyAttackBonus += 2;
    eventLog.push('获得100金币。下一场敌人攻击+2。');
  }

  if (event.id === 'school_festival') {
    const target = team.find((member) => member.id === targetId);
    if (!target) {
      return previous;
    }
    team = team.map((member) => member.id === target.id ? { ...member, attack: member.attack + 1 } : member);
    eventLog.push(`${target.name}攻击永久+1。`);
  }

  if (event.id === 'fortune_teller') {
    const target = team.find((member) => member.id === targetId);
    if (!target || gold < 20) {
      return previous;
    }
    gold -= 20;
    team = team.map((member) =>
      member.id === target.id ? { ...member, maxHp: member.maxHp + 5, hp: member.hp + 5 } : member,
    );
    eventLog.push(`花费20金币，${target.name}生命上限+5。`);
  }

  if (event.id === 'student_council' && optionId === 'follow_rules') {
    const paid = Math.min(20, gold);
    gold -= paid;
    eventLog.push(`遵守规定，失去${paid}金币。`);
  }

  if (event.id === 'student_council' && optionId === 'sneak_away') {
    if (rng.next() < 0.5) {
      const target = randomItem(team, rng);
      if (target) {
        team = team.map((member) => member.id === target.id ? { ...member, attack: member.attack + 2 } : member);
        eventLog.push(`偷偷溜走成功，${target.name}攻击永久+2。`);
      }
    } else {
      eventLog.push('偷偷溜走，没有发生额外效果。');
    }
  }

  if (event.id === 'mystery_gacha') {
    if (gold < 110 || team.length >= 4) {
      return previous;
    }
    const ownedIds = new Set(team.map((member) => member.templateId));
    const available = CHARACTER_POOL.filter((template) => !ownedIds.has(template.id));
    if (available.length === 0) {
      return previous;
    }
    gold -= 110;
    const rarityRoll = rng.next();
    const preferredRarity = rarityRoll < 0.1 ? 'legendary' : rarityRoll < 0.35 ? 'star' : 'normal';
    const template = randomItem(available.filter((candidate) => candidate.rarity === preferredRarity), rng) ?? randomItem(available, rng);
    if (!template) {
      return previous;
    }
    team = [...team, createAlly(template)];
    eventLog.push(`抽卡获得${getGachaRarityLabel(template)}色角色：${template.name}。`);
  }

  return advanceAfterCurrentNode(
    {
      ...previous,
      gold,
      team,
      nextEnemyAttackBonus,
      rngState: rng.state,
      questionEventId: null,
      eventLog: [...previous.eventLog, ...eventLog],
    },
    team,
  );
}
