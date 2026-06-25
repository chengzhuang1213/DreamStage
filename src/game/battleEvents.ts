import type { BattleEvent, BattleEventKind, Character } from './types';

export type BattleEventInput = Omit<BattleEvent, 'id' | 'units'>;
export type BattleEventEmitter = (event: BattleEventInput) => void;

export function createBattleEventEmitter(events: BattleEvent[], team: Character[], enemies: Character[]): BattleEventEmitter {
  return (event) => {
    events.push({
      id: `battle-event-${events.length + 1}`,
      ...event,
      units: [...team, ...enemies].map((unit) => ({
        id: unit.id,
        hp: unit.hp,
        maxHp: unit.maxHp,
        shield: unit.shield,
        injured: unit.injured,
        battleSkin: unit.battleSkin,
      })),
    });
  };
}

export function emitBattleEvent(emit: BattleEventEmitter | undefined, event: BattleEventInput) {
  emit?.(event);
}

export function emitLogEvent(emit: BattleEventEmitter | undefined, kind: BattleEventKind, text: string) {
  emitBattleEvent(emit, { kind, text });
}

