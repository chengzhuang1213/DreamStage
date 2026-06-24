import type { BattleEvent, BattleState, BattleStats, BattleUnitSnapshot, Character } from './game';

type ReplayEventKind = BattleEvent['kind'];

export interface ReplayEvent {
  kind: ReplayEventKind;
  text: string;
  actorId?: string;
  targetId?: string;
  targetIds?: string[];
  actorName?: string;
  targetName?: string;
  targetNames?: string[];
  amount?: number;
  amountsByTarget?: Record<string, number>;
  shieldBlocked?: number;
  hpLeft?: number;
  units?: BattleUnitSnapshot[];
}

export function parseReplayEvent(entry: string): ReplayEvent {
  if (/^第\d+回合。$/.test(entry)) {
    return { kind: 'round', text: entry };
  }

  const attackMatch = entry.match(/^(.+?)攻击(.+?)，造成(\d+)伤害，.+?剩余(\d+)HP。$/);
  if (attackMatch) {
    return {
      kind: 'attack',
      text: entry,
      actorName: attackMatch[1],
      targetName: attackMatch[2],
      amount: Number(attackMatch[3]),
      hpLeft: Number(attackMatch[4]),
    };
  }

  const extraDamageMatch = entry.match(/^(.+?)(?:触发|发动).+?造成(\d+)点.+?，(.+?)剩余(\d+)HP。$/);
  if (extraDamageMatch) {
    return {
      kind: 'attack',
      text: entry,
      actorName: extraDamageMatch[1],
      targetName: extraDamageMatch[3],
      amount: Number(extraDamageMatch[2]),
      hpLeft: Number(extraDamageMatch[4]),
    };
  }

  const healMatch = entry.match(/^(.+?)(?:发动|触发).+?恢复(\d+)HP。$/) ?? entry.match(/^(.+?)恢复(\d+)HP。$/);
  if (healMatch) {
    return { kind: 'heal', text: entry, actorName: healMatch[1], targetName: healMatch[1], amount: Number(healMatch[2]) };
  }

  const shieldMatch = entry.match(/^(.+?)受到?.*?获得(\d+)护盾/) ?? entry.match(/^(.+?)获得(\d+)护盾/);
  if (shieldMatch) {
    return { kind: 'shield', text: entry, actorName: shieldMatch[1], targetName: shieldMatch[1], amount: Number(shieldMatch[2]) };
  }

  const calloutMatch = entry.match(/^(.+?)(?:发动|触发|消耗)[「《](.+?)[」》]/);
  if (calloutMatch) {
    return { kind: 'major', text: entry, actorName: calloutMatch[1] };
  }

  const criticalMatch = entry.match(/^(.+?)打出暴击。$/);
  if (criticalMatch) {
    return { kind: 'major', text: entry, actorName: criticalMatch[1] };
  }

  const defeatMatch = entry.match(/^(.+?)被击败。$/);
  if (defeatMatch) {
    return { kind: 'defeat', text: entry, targetName: defeatMatch[1] };
  }

  return { kind: 'major', text: entry };
}

export function isReplayPhase(phase: BattleState['phase']) {
  return phase === 'won' || phase === 'lost' || phase === 'relay';
}

export function normalizeBattleName(name: string) {
  return name.replace(/^对手\s*/, '').replace(/^敌方/, '').replace(/^Boss\s*/, '').replace(/^精英\s*/, '').trim();
}

export function nameMatches(character: Character, maybeName?: string) {
  if (!maybeName) {
    return false;
  }

  const normalizedCharacter = normalizeBattleName(character.name);
  const normalizedName = normalizeBattleName(maybeName);
  return character.name.includes(maybeName) || maybeName.includes(character.name) || normalizedCharacter === normalizedName || normalizedName.includes(normalizedCharacter);
}

function getReplayTargetNames(event?: ReplayEvent | null) {
  return event?.targetNames ?? (event?.targetName ? [event.targetName] : []);
}

export function isReplayTarget(character: Character, event?: ReplayEvent | null) {
  if (!event) {
    return false;
  }

  if (event.targetIds?.includes(character.id) || event.targetId === character.id) {
    return true;
  }

  return getReplayTargetNames(event).some((name) => nameMatches(character, name));
}

export function getReplayTargetAmount(character: Character, event?: ReplayEvent | null) {
  if (!event) {
    return 0;
  }

  return event.amountsByTarget?.[character.id] ?? (isReplayTarget(character, event) ? event.amount ?? 0 : 0);
}

export function groupTeamDamageEvents(events: ReplayEvent[], selectedMembers: Character[]) {
  const selectedIds = new Set(selectedMembers.map((member) => member.id));
  const grouped: ReplayEvent[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const canGroup =
      (event.kind === 'attack' || event.kind === 'damage') &&
      Boolean(event.actorId) &&
      Boolean(event.targetId) &&
      selectedIds.has(event.targetId ?? '') &&
      !selectedIds.has(event.actorId ?? '');

    if (!canGroup) {
      grouped.push(event);
      continue;
    }

    const targetIds = [event.targetId!];
    const targetNames = event.targetName ? [event.targetName] : [];
    const amountsByTarget: Record<string, number> = { [event.targetId!]: event.amount ?? 0 };
    let lastEvent = event;
    let cursor = index + 1;

    while (cursor < events.length) {
      const next = events[cursor];
      const sameEnemyGroup =
        (next.kind === 'attack' || next.kind === 'damage') &&
        next.actorId === event.actorId &&
        Boolean(next.targetId) &&
        selectedIds.has(next.targetId ?? '') &&
        !targetIds.includes(next.targetId!);

      if (!sameEnemyGroup) {
        break;
      }

      targetIds.push(next.targetId!);
      if (next.targetName) {
        targetNames.push(next.targetName);
      }
      amountsByTarget[next.targetId!] = next.amount ?? 0;
      lastEvent = next;
      cursor += 1;
    }

    grouped.push({
      ...lastEvent,
      text: targetNames.length > 1 ? `${event.actorName ?? '敌人'}攻击${targetNames.join('、')}。` : event.text,
      actorId: event.actorId,
      actorName: event.actorName,
      targetId: event.targetId,
      targetIds,
      targetName: targetNames[0] ?? event.targetName,
      targetNames,
      amount: Object.values(amountsByTarget).reduce((sum, amount) => sum + amount, 0),
      amountsByTarget,
    });
    index = cursor - 1;
  }

  return grouped;
}

function hasCalloutText(event: ReplayEvent) {
  return /(?:发动|触发|消耗)[「《].+?[」》]/.test(event.text) || event.text.includes('伤害无效') || event.text.includes('打出暴击');
}

function hydrateReplayEvent(event: ReplayEvent, combatants: Character[], fallbackUnits?: BattleUnitSnapshot[]) {
  const actor = combatants.find((character) => nameMatches(character, event.actorName));
  const target = combatants.find((character) => nameMatches(character, event.targetName));

  return {
    ...event,
    actorId: event.actorId ?? actor?.id,
    targetId: event.targetId ?? target?.id,
    units: event.units ?? fallbackUnits ?? combatants.map((unit) => ({
      id: unit.id,
      hp: unit.hp,
      maxHp: unit.maxHp,
      shield: unit.shield,
      injured: unit.injured,
    })),
  };
}

export function buildReplayEvents(events: ReplayEvent[] | undefined, log: string[], selectedMembers: Character[], combatants = selectedMembers) {
  if (!events?.length) {
    return groupTeamDamageEvents(log.map((entry) => hydrateReplayEvent(parseReplayEvent(entry), combatants)), selectedMembers);
  }

  const mergedEvents: ReplayEvent[] = [];
  let eventIndex = 0;
  let lastUnits = events[0]?.units;
  const logTextSet = new Set(log);
  const eventTextSet = new Set(events.map((event) => event.text));

  log.forEach((entry) => {
    while (events[eventIndex] && events[eventIndex].text !== entry && !logTextSet.has(events[eventIndex].text)) {
      mergedEvents.push(hydrateReplayEvent(events[eventIndex], combatants));
      lastUnits = events[eventIndex].units ?? lastUnits;
      eventIndex += 1;
    }

    if (events[eventIndex]?.text === entry) {
      mergedEvents.push(hydrateReplayEvent(events[eventIndex], combatants));
      lastUnits = events[eventIndex].units ?? lastUnits;
      eventIndex += 1;
      return;
    }

    const parsed = parseReplayEvent(entry);
    if (parsed.actorName && hasCalloutText(parsed) && !eventTextSet.has(entry)) {
      const nextUnits = events[eventIndex]?.units;
      mergedEvents.push(hydrateReplayEvent(parsed, combatants, lastUnits ?? nextUnits));
    }
  });

  while (eventIndex < events.length) {
    mergedEvents.push(hydrateReplayEvent(events[eventIndex], combatants));
    lastUnits = events[eventIndex].units ?? lastUnits;
    eventIndex += 1;
  }

  return groupTeamDamageEvents(mergedEvents, selectedMembers);
}

export function buildReplayStats(team: Character[], events: ReplayEvent[], replayStep: number, finalStats: BattleStats, replayDone: boolean): BattleStats {
  if (replayDone) {
    return finalStats;
  }

  const teamIds = new Set(team.map((member) => member.id));
  const stats: BattleStats = {};

  team.forEach((member) => {
    stats[member.id] = {
      characterId: member.id,
      name: member.name,
      damageDealt: 0,
      damageTaken: 0,
      shieldBlocked: 0,
      criticalHits: 0,
    };
  });

  events.slice(0, replayStep + 1).forEach((event) => {
    if (event.kind !== 'attack' && event.kind !== 'damage') {
      return;
    }

    if (event.actorId && teamIds.has(event.actorId)) {
      stats[event.actorId].damageDealt += event.amount ?? 0;
    }

    const targetIds = event.targetIds ?? (event.targetId ? [event.targetId] : []);
    targetIds.forEach((targetId) => {
      if (!teamIds.has(targetId)) {
        return;
      }

      stats[targetId].damageTaken += event.amountsByTarget?.[targetId] ?? event.amount ?? 0;
      stats[targetId].shieldBlocked += event.shieldBlocked ?? 0;
    });
  });

  return stats;
}

export function applySnapshot(character: Character, units?: BattleUnitSnapshot[]) {
  const snapshot = units?.find((unit) => unit.id === character.id);
  if (!snapshot) {
    return character;
  }

  return {
    ...character,
    hp: snapshot.hp,
    maxHp: snapshot.maxHp,
    shield: snapshot.shield,
    injured: snapshot.injured,
  };
}
