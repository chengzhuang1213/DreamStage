import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { BattleState, BossTemplate, Character } from '../game';
import { NODE_LABELS } from '../game';
import { BattleLog } from '../components/battleLog';
import { CharacterCard } from '../components/cards';
import { EnhanceModal } from '../components/EnhanceModal';
import {
  type ReplayEvent,
  applySnapshot,
  buildReplayEvents,
  buildReplayStats,
  isReplayPhase,
  nameMatches,
} from '../battleReplay';
import {
  BattleSlotStrip,
  BattleStandee,
  BattleTeamPanel,
  BattleUnitCard,
  BossContinueModal,
  enemyThemeClass,
} from '../components/battleViews';

export interface BattleScreenProps {
  battle: BattleState;
  boss: BossTemplate;
  gold: number;
  team: Character[];
  onContinue: () => void;
  onToggleSelection: (id: string) => void;
  pendingEnhance: { source: 'elite' | 'boss'; cost: number; free: boolean } | null;
  pendingBossVictory: boolean;
  onStart: () => void;
  onEnhance: (id: string | null) => void;
  onDismissEnhancement: () => void;
  onBossBack: () => void;
  onBossBlessing: () => void;
  onReplayDone?: () => void;
  hasPendingEnhance?: boolean;
  onOpenEnhancement?: () => void;
}

export function BattleScreen({ battle, boss, gold, team, pendingEnhance, pendingBossVictory, onContinue, onToggleSelection, onStart, onEnhance, onDismissEnhancement, onBossBack, onBossBlessing, onReplayDone, hasPendingEnhance = false, onOpenEnhancement }: BattleScreenProps) {
  const aliveMembers = team.filter((member) => !member.injured && member.hp > 0);
  const displayEnemy = battle.enemies[Math.min(battle.activeEnemyIndex, battle.enemies.length - 1)] ?? null;
  const selectableMembers = battle.phase === 'relay' ? aliveMembers : team;
  const selectedMembers = battle.selectedIds
    .map((id) => team.find((member) => member.id === id))
    .filter((member): member is Character => Boolean(member));
  const battleTitle = battle.type === 'boss' ? '3v1 Boss战' : battle.type === 'elite' ? '2v1 精英战' : '1v1 普通战斗';
  const canStart = (battle.phase === 'select' || battle.phase === 'relay') && battle.selectedIds.length === battle.slots;
  const isWon = battle.phase === 'won';
  const isBossWon = isWon && battle.type === 'boss' && boss.bossTier < 3;
  const isFinalBossWon = isWon && battle.type === 'boss' && boss.bossTier === 3;
  const selectedMemberIdsKey = selectedMembers.map((member) => member.id).join('|');
  const replayEvents = useMemo<ReplayEvent[]>(
    () => buildReplayEvents(battle.events, battle.log, selectedMembers, [...team, ...battle.enemies]),
    [battle.enemies, battle.events, battle.log, selectedMemberIdsKey, team],
  );
  const canNotifyReplayDone = isReplayPhase(battle.phase);
  const replayEnabled = canNotifyReplayDone && replayEvents.length > 0;
  const [replayStep, setReplayStep] = useState(0);
  const replayKey = `${battle.nodeId}-${battle.phase}-${battle.activeEnemyIndex}-${battle.log.length}`;
  const replayKeyRef = useRef(replayKey);
  const replayStepForRender = replayKeyRef.current === replayKey ? replayStep : 0;
  const currentReplayEvent = replayEnabled ? replayEvents[Math.min(replayStepForRender, replayEvents.length - 1)] : null;
  const replayDone = !replayEnabled || replayStepForRender >= replayEvents.length - 1;
  const visibleLogEntries = replayEnabled
    ? replayDone
      ? battle.log
      : replayEvents.slice(0, Math.min(replayEvents.length, replayStepForRender + 1)).map((event) => event.text)
    : battle.log;
  const defeatedNames = replayEnabled
    ? replayEvents.slice(0, replayStepForRender + 1).filter((event) => event.kind === 'defeat').map((event) => event.targetName).filter((name): name is string => Boolean(name))
    : [];
  const canContinueRoute = isWon && !isBossWon && !isFinalBossWon && !pendingEnhance && !hasPendingEnhance && replayDone;
  const replayNotifiedKey = useRef('');
  const snapshotUnits = currentReplayEvent?.units;
  const displayEnemyWithSnapshot = displayEnemy ? applySnapshot(displayEnemy, snapshotUnits) : null;
  const selectedMembersWithSnapshot = selectedMembers.map((member) => applySnapshot(member, snapshotUnits));
  const liveStats = useMemo(
    () => buildReplayStats(team, replayEvents, replayStepForRender, battle.stats, replayDone),
    [battle.stats, replayDone, replayEvents, replayStepForRender, team],
  );
  const topAction = canContinueRoute ? (
    <button className="primary-button battle-header-start-button" onClick={onContinue}>继续路线</button>
  ) : isWon && hasPendingEnhance && replayDone && !pendingEnhance ? (
    <button className="primary-button battle-header-start-button" onClick={onOpenEnhancement}>开启强化</button>
  ) : isBossWon && !pendingEnhance && !hasPendingEnhance && !pendingBossVictory && replayDone ? (
    <button className="primary-button battle-header-start-button" onClick={onBossBlessing}>进入祝福处</button>
  ) : null;

  useEffect(() => {
    if (!window.matchMedia('(max-width: 820px)').matches) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [battle.nodeId]);

  useEffect(() => {
    replayKeyRef.current = replayKey;
    setReplayStep(0);
  }, [replayKey]);

  useEffect(() => {
    if (!replayEnabled || replayStep >= replayEvents.length - 1) {
      return;
    }

    const isBossLine = currentReplayEvent?.bossLine;
    const delay = isBossLine ? 2000 : currentReplayEvent?.kind === 'round' ? 540 : 980;
    const timer = window.setTimeout(() => {
      setReplayStep((step) => Math.min(step + 1, replayEvents.length - 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [currentReplayEvent?.kind, replayEnabled, replayEvents.length, replayStep]);

  useEffect(() => {
    if (!canNotifyReplayDone || !replayDone || replayNotifiedKey.current === replayKey) {
      return;
    }

    replayNotifiedKey.current = replayKey;
    const delay = battle.phase === 'lost' || (battle.type === 'boss' && battle.phase === 'won') ? 2000 : 0;
    const timer = window.setTimeout(() => onReplayDone?.(), delay);
    return () => window.clearTimeout(timer);
  }, [battle.phase, battle.type, canNotifyReplayDone, onReplayDone, replayDone, replayKey]);

  return (
    <div className="battle-hud-screen">
      <header className="battle-hud-header">
        <div>
          <p className="eyebrow">{NODE_LABELS[battle.type]}</p>
          <h2>{battleTitle}</h2>
          <p>所选角色会同时出战，敌人会攻击所有出战角色。</p>
        </div>
        <div className="battle-resource-pills">
          <span data-tooltip="金币：用于商店招募、休息处治疗复活，以及部分强化费用。" tabIndex={0}>◎ 金币 {gold}</span>
        </div>
      </header>

      <div className="battle-hud-grid">
        <BattleTeamPanel team={team} liveStats={liveStats} />

        <main className="battle-center-panel">
          <section className={`battle-card-panel battle-enemy-stage ${displayEnemyWithSnapshot ? enemyThemeClass(displayEnemyWithSnapshot) : ''}`}>
            <h3>{battle.type === 'boss' ? 'Boss Info' : '敌人'}</h3>
            {displayEnemyWithSnapshot && (
              <BattleUnitCard
                character={displayEnemyWithSnapshot}
                defeated={replayEnabled ? defeatedNames.some((name) => nameMatches(displayEnemyWithSnapshot, name)) : displayEnemyWithSnapshot.hp <= 0}
                replayEvent={currentReplayEvent}
              />
            )}
          </section>

          <section className="battle-arena-panel" aria-label="战斗舞台">
            <div className="battle-arena-enemy">
              {displayEnemyWithSnapshot && (
                <BattleStandee
                  character={displayEnemyWithSnapshot}
                  defeated={replayEnabled ? defeatedNames.some((name) => nameMatches(displayEnemyWithSnapshot, name)) : displayEnemyWithSnapshot.hp <= 0}
                  replayEvent={currentReplayEvent}
                  side="enemy"
                />
              )}
            </div>
            <div className="battle-arena-allies" style={{ '--fighter-count': Math.max(1, selectedMembersWithSnapshot.length) } as CSSProperties}>
              {selectedMembersWithSnapshot.length > 0 ? selectedMembersWithSnapshot.map((member) => (
                <BattleStandee
                  key={member.id}
                  character={member}
                  defeated={member.injured || member.hp <= 0}
                  replayEvent={currentReplayEvent}
                  side="ally"
                />
              )) : (
                <div className="battle-arena-empty">选择出战角色后，队伍会站上舞台。</div>
              )}
            </div>
          </section>

          <section className="battle-card-panel battle-selection-stage">
            <div className="battle-section-heading">
              <h3>{battle.phase === 'relay' ? '接力出战' : isWon ? '战斗结果' : '选择出战角色'} {battle.selectedIds.length}/{battle.slots}</h3>
              {battle.phase === 'relay' && displayEnemy && <span>{displayEnemy.name} 剩余 {displayEnemy.hp}/{displayEnemy.maxHp} HP</span>}
            </div>

            <div className="battle-selection-top">
              <BattleSlotStrip selectedMembers={selectedMembersWithSnapshot} slots={battle.slots} replayEvent={currentReplayEvent} />
            </div>

            {(battle.phase === 'select' || battle.phase === 'relay') && (
              <div className="battle-candidate-grid">
                {selectableMembers.map((member) => (
                  <CharacterCard
                    key={member.id}
                    character={member}
                    selected={battle.selectedIds.includes(member.id)}
                    disabled={member.injured || member.hp <= 0}
                    onClick={() => onToggleSelection(member.id)}
                  />
                ))}
              </div>
            )}

          </section>

          <div className="battle-bottom-actions">
            {canContinueRoute && (
              <button className="primary-button battle-start-button" onClick={onContinue}>继续路线</button>
            )}
            {isWon && hasPendingEnhance && replayDone && !pendingEnhance && (
              <button className="primary-button battle-start-button" onClick={onOpenEnhancement}>开启强化</button>
            )}
            {isBossWon && !pendingEnhance && !hasPendingEnhance && !pendingBossVictory && replayDone && (
              <button className="primary-button battle-start-button" onClick={onBossBlessing}>进入祝福处</button>
            )}
          </div>
        </main>

        <aside className="battle-right-panel">
          {(battle.phase === 'select' || battle.phase === 'relay') && (
            <button className="primary-button battle-header-start-button" disabled={!canStart} onClick={onStart}>
              {battle.phase === 'relay' ? '开始接力战斗' : '开始自动战斗'}
            </button>
          )}
          {topAction}
          <BattleLog
            entries={visibleLogEntries}
            stats={replayDone ? battle.stats : undefined}
            team={team}
            extraAction={replayEnabled && !replayDone ? { label: '跳过战斗', onClick: () => setReplayStep(replayEvents.length - 1) } : undefined}
            showDamageButton={false}
          />
        </aside>
      </div>

      {pendingEnhance && replayDone && (
        <EnhanceModal
          gold={gold}
          pending={pendingEnhance}
          team={team}
          onEnhance={onEnhance}
          onDismiss={onDismissEnhancement}
        />
      )}
      {pendingBossVictory && isBossWon && replayDone && (
        <BossContinueModal tier={boss.bossTier} onBack={onBossBack} onBlessing={onBossBlessing} />
      )}
    </div>
  );
}
