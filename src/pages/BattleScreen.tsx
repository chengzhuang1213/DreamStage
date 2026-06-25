import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { BattleState, BossTemplate, BossTier, Character } from '../game';
import type { BattleStats } from '../game';
import {
  GROUP_LABELS,
  NODE_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC, bondBackgroundStyle } from '../assets';
import { Avatar, UpgradeLevelBadge } from '../components/common';
import { BattleLog, DamageMeter } from '../components/battleLog';
import { CharacterCard } from '../components/cards';
import { EnhanceModal } from '../components/EnhanceModal';
import { InfoPill, rarityDetail, roleDetail } from '../components/info';
import { HighlightText } from '../game/data/upgrades';
import { getBattleIllustration } from '../battleAssets';
import {
  type ReplayEvent,
  applySnapshot,
  buildReplayEvents,
  buildReplayStats,
  getReplayTargetAmount,
  isReplayPhase,
  isReplayTarget,
  nameMatches,
} from '../battleReplay';

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

function hpPercent(character: Pick<Character, 'hp' | 'maxHp'>) {
  return `${Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)))}%`;
}

function enemyThemeClass(character: Character) {
  if (character.rarity === 'elite') {
    return 'enemy-theme-elite';
  }

  if (character.rarity === 'boss') {
    return `enemy-theme-boss-${character.bossTier ?? 1}`;
  }

  return '';
}

function battleFloatLabel(character: Character, replayEvent: ReplayEvent | null | undefined) {
  const amount = getReplayTargetAmount(character, replayEvent);
  if (!amount) {
    return null;
  }

  if (replayEvent?.kind === 'attack' || replayEvent?.kind === 'damage') {
    return `-${amount}`;
  }

  if (replayEvent?.kind === 'heal') {
    return `+${amount}`;
  }

  if (replayEvent?.kind === 'shield') {
    return `护盾 +${amount}`;
  }

  return null;
}

function battleCalloutLabel(character: Character, replayEvent: ReplayEvent | null | undefined) {
  const isActor = replayEvent?.actorId === character.id || (replayEvent?.actorName ? nameMatches(character, replayEvent.actorName) : false);
  if (!replayEvent || !isActor) {
    return null;
  }

  if (replayEvent.text.includes('伤害无效')) {
    return '免疫';
  }

  if (character.passive?.id === 'elite_natsumi_traffic' && replayEvent.text.includes('打出暴击')) {
    return '必定暴击';
  }

  const bossLineMatch = replayEvent.text.match(/^.+?「(.+?)」$/);
  if (character.rarity === 'boss' && bossLineMatch && !/(?:发动|触发|消耗)/.test(replayEvent.text)) {
    return bossLineMatch[1];
  }

  const calloutMatch = replayEvent.text.match(/(?:发动|触发|消耗)[「《](.+?)[」》]/);
  const callout = calloutMatch?.[1]?.trim();
  if (!callout || callout === '普通攻击') {
    return null;
  }

  const eliteTriggerLabel = elitePassiveTriggerLabel(character, replayEvent.text);
  if (eliteTriggerLabel) {
    return eliteTriggerLabel;
  }

  const flavorCallout = legendaryFlavorCallout(character, replayEvent, callout);
  if (flavorCallout) {
    return flavorCallout;
  }

  return callout;
}

const LEGENDARY_FLAVOR_CALLOUTS: Record<string, string> = {
  nico: '妮可妮可妮',
  mari: 'shiny!',
  kanata: '好困Orz',
  keke: '我太厉害了8',
};

function stableCalloutRoll(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return (hash % 100) / 100;
}

function legendaryFlavorCallout(character: Character, replayEvent: ReplayEvent, callout: string) {
  if (character.rarity !== 'legendary' || !LEGENDARY_FLAVOR_CALLOUTS[character.templateId]) {
    return null;
  }

  if (!/(?:发动|触发|消耗)[「《]/.test(replayEvent.text) || callout === '免疫') {
    return null;
  }

  return stableCalloutRoll(`${character.id}-${replayEvent.text}`) < 0.35
    ? LEGENDARY_FLAVOR_CALLOUTS[character.templateId]
    : null;
}

const ELITE_PASSIVE_INTRO_LABELS: Record<string, string> = {
  elite_kanan_training: '每回合速度+1',
  elite_riko_inspiration: '前两次伤害无效',
  elite_umi_low_hp: '低血量攻击翻倍',
  elite_kaho_never_give_up: '每2回合恢复15',
  elite_emma_warm_power: '受击后攻击+2',
  elite_kanon_center_stage: '低血量恢复30',
  elite_setsuna_focus: '专注叠伤害',
  elite_shioriko_execution: '半血以上减伤',
  elite_natsumi_traffic: '必定暴击',
};

const ELITE_PASSIVE_TRIGGER_LABELS: Record<string, string> = {
  elite_kanan_training: '速度+1',
  elite_riko_inspiration: '免疫',
  elite_umi_low_hp: '攻击翻倍',
  elite_kaho_never_give_up: '坚持住！',
  elite_emma_warm_power: '攻击+2',
  elite_kanon_center_stage: '恢复30',
  elite_setsuna_focus: '专注+1',
  elite_shioriko_execution: '伤害减半',
  elite_natsumi_traffic: '必定暴击',
};

function elitePassiveTriggerLabel(character: Character, text: string) {
  const passiveId = character.passive?.id;
  if (character.rarity !== 'elite' || !passiveId || !text.includes(character.passive?.name ?? '')) {
    return null;
  }

  return ELITE_PASSIVE_TRIGGER_LABELS[passiveId] ?? null;
}

function passiveIntroLabel(character: Character, replayEvent: ReplayEvent | null | undefined) {
  if (replayEvent?.kind !== 'start' || !character.passive?.description) {
    return null;
  }

  if (replayEvent.actorId || replayEvent.actorName) {
    const isActor = replayEvent.actorId === character.id || (replayEvent.actorName ? nameMatches(character, replayEvent.actorName) : false);
    if (!isActor) {
      return null;
    }
  } else {
    return null;
  }

  if (character.rarity === 'elite') {
    return ELITE_PASSIVE_INTRO_LABELS[character.passive.id] ?? null;
  }

  if (character.rarity !== 'enemy' || character.enemyTier !== 'strong') {
    return null;
  }

  return character.passive.description
    .replace(/[。，.]+$/u, '')
    .replace(/\s+/g, '');
}

function BattleStandee({ character, replayEvent, side, defeated = false }: { character: Character; replayEvent?: ReplayEvent | null; side: 'enemy' | 'ally'; defeated?: boolean }) {
  const isActing = replayEvent?.actorName ? nameMatches(character, replayEvent.actorName) : false;
  const isTarget = isReplayTarget(character, replayEvent);
  const floatLabel = battleFloatLabel(character, replayEvent);
  const calloutLabel = battleCalloutLabel(character, replayEvent) ?? passiveIntroLabel(character, replayEvent);
  const legendarySkinScale: Record<string, number> = {
    nico: 0.72,
    keke: 0.72,
    mari: 0.7,
    kanata: 0.72,
  };
  const enemyScale = character.rarity === 'boss' ? 1.02 : character.rarity === 'elite' ? 0.92 : 0.86;
  const scale = side === 'enemy'
    ? enemyScale
    : legendarySkinScale[character.templateId] ?? 1.28;
  const calloutBottom = side === 'enemy'
    ? character.rarity === 'boss' ? '230px' : character.rarity === 'elite' ? '158px' : '148px'
    : legendarySkinScale[character.templateId] ? '178px' : '214px';

  return (
    <div
      className={`battle-standee battle-standee-${side} rarity-${character.rarity} ${side === 'enemy' ? enemyThemeClass(character) : ''} ${defeated ? 'defeated' : ''} ${isActing ? 'is-acting' : ''} ${isTarget ? `is-${replayEvent?.kind}` : ''}`.trim()}
      style={{ '--standee-scale': scale, '--callout-bottom': calloutBottom } as CSSProperties}
    >
      {floatLabel && <span className={`battle-float-text float-${replayEvent?.kind}`} key={`${replayEvent?.text}-${character.id}-${floatLabel}`}>{floatLabel}</span>}
      {calloutLabel && <span className="battle-skill-callout" key={`${replayEvent?.text}-${character.id}-callout`}>{calloutLabel}</span>}
      <img src={getBattleIllustration(character)} alt="" draggable={false} />
      <div className="battle-standee-name">
        <strong>{character.name.replace('对手 ', '').replace('敌方', '').replace('Boss ', '').replace('精英 ', '')}</strong>
        <span>{character.hp}/{character.maxHp}</span>
        <div className="battle-standee-hp" aria-hidden="true">
          <i style={{ width: hpPercent(character) }} />
        </div>
      </div>
    </div>
  );
}

function BattleUnitCard({ character, defeated = false, replayEvent }: { character: Character; defeated?: boolean; replayEvent?: ReplayEvent | null }) {
  const isActing = replayEvent?.actorName ? nameMatches(character, replayEvent.actorName) : false;
  const isTarget = isReplayTarget(character, replayEvent);
  const floatLabel = battleFloatLabel(character, replayEvent);

  return (
    <div className={`battle-unit-card rarity-${character.rarity} ${enemyThemeClass(character)} ${defeated ? 'defeated' : ''} ${isActing ? 'is-acting' : ''} ${isTarget ? `is-${replayEvent?.kind}` : ''}`.trim()}>
      {floatLabel && <span className={`battle-float-text float-${replayEvent?.kind}`} key={`${replayEvent?.text}-${floatLabel}`}>{floatLabel}</span>}
      <Avatar character={character} label={character.name.replace('对手 ', '').replace('敌方', '').replace('Boss ', '').replace('精英 ', '')} />
      <div className="battle-unit-copy">
        <div className="battle-unit-title">
          <strong>{character.name}</strong>
          {character.rarity !== 'enemy' && character.rarity !== 'elite' && character.rarity !== 'boss' && <UpgradeLevelBadge level={character.upgradeLevel ?? 1} />}
          <InfoPill className="battle-title-pill" label={RARITY_LABELS[character.rarity]} tooltip={rarityDetail(character.rarity)} />
          {character.role && <InfoPill className="battle-title-pill" label={ROLE_LABELS[character.role]} tooltip={roleDetail(character.role)} />}
        </div>
        <div className="battle-hp-line">
          <b>HP {character.hp}/{character.maxHp}</b>
          <div className="battle-hp-track"><span style={{ width: hpPercent(character) }} /></div>
        </div>
        <small>攻击 {character.attack}　速度 {character.speed}</small>
        {character.passive && <small><HighlightText text={`被动：${character.passive.description}`} /></small>}
        {character.skill && <small><HighlightText text={`技能：${character.skill.description}`} /></small>}
      </div>
    </div>
  );
}

function BattleTeamPanel({ team, liveStats }: { team: Character[]; liveStats: BattleStats }) {
  const slots = Array.from({ length: 4 }, (_, index) => team[index] ?? null);
  const primaryBonds = getActiveBonds(team).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(team).filter((bond) => bond.count > 0);
  const visibleBonds = [
    ...primaryBonds.map((bond) => ({
      id: bond.group.id,
      name: bond.group.name,
      count: bond.count,
      total: 3,
      active: bond.level > 0,
      description: bond.level >= 3 ? bond.group.level3Description : bond.level >= 2 ? bond.group.level2Description : `${bond.group.level2Description} ${bond.group.level3Description}`,
      logoSrc: BOND_LOGO_SRC[bond.group.id],
    })),
    ...secondaryBonds.map((activeBond) => ({
      id: activeBond.bond.id,
      name: activeBond.bond.name,
      count: activeBond.count,
      total: 2,
      active: activeBond.active,
      description: activeBond.bond.description,
      logoSrc: BOND_LOGO_SRC[activeBond.bond.id],
    })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count || right.total - left.total);

  return (
    <aside className="battle-left-panel">
      <section className="battle-card-panel battle-team-compact-panel">
        <h3>队伍</h3>
        <div className="battle-team-avatar-grid">
          {slots.map((member, index) =>
            member ? (
              <div className={`battle-mini-item rarity-${member.rarity} ${member.injured || member.hp <= 0 ? 'injured' : ''}`} key={member.id} tabIndex={0}>
                <Avatar character={member} label={member.name} />
                <div className="battle-mini-popover">
                  <strong>{member.name}</strong>
                  <span>{RARITY_LABELS[member.rarity]} · {GROUP_LABELS[member.group]}{member.role ? ` · ${ROLE_LABELS[member.role]}` : ''} · LV{member.upgradeLevel ?? 1}</span>
                  <span>HP {member.hp}/{member.maxHp} · 攻 {member.attack} · 速 {member.speed}</span>
                  {member.passive && <small><HighlightText text={`被动：${member.passive.description}`} /></small>}
                  {member.skill && <small><HighlightText text={`技能：${member.skill.description}`} /></small>}
                </div>
              </div>
            ) : (
              <div className="battle-mini-empty" key={`empty-${index}`}>＋</div>
            ),
          )}
        </div>
        <h3>羁绊</h3>
        <div className="battle-bond-logo-grid">
          {visibleBonds.length > 0 ? (
            visibleBonds.map((bond) => (
              <div className={`battle-bond-logo-item bond-theme-card ${bond.active ? 'active' : 'inactive'}`} key={bond.id} style={bond.active ? bondBackgroundStyle(bond.id) : undefined} tabIndex={0}>
                <img src={bond.logoSrc} alt="" />
                <div className="battle-mini-popover">
                  <strong>{bond.name} {bond.count}/{bond.total}</strong>
                  <span>{bond.description}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="battle-bond-empty">暂无羁绊</div>
          )}
        </div>
      </section>
      <DamageMeter stats={liveStats} team={team} title="本场伤害" compact />
    </aside>
  );
}

function BattleSlotStrip({ selectedMembers, slots, replayEvent }: { selectedMembers: Character[]; slots: number; replayEvent?: ReplayEvent | null }) {
  const slotItems = Array.from({ length: slots }, (_, index) => selectedMembers[index] ?? null);

  return (
    <section className="battle-slot-strip" aria-label="出战位" style={{ '--slot-count': slots } as CSSProperties}>
      {slotItems.map((member, index) => (
        <div
          className={`battle-slot ${member ? `filled rarity-${member.rarity}` : ''} ${member && replayEvent?.actorName && nameMatches(member, replayEvent.actorName) ? 'is-acting' : ''} ${member && isReplayTarget(member, replayEvent) ? `is-${replayEvent?.kind}` : ''}`.trim()}
          key={member?.id ?? `slot-${index}`}
        >
          {member ? (
            <>
              {replayEvent && isReplayTarget(member, replayEvent) && getReplayTargetAmount(member, replayEvent) > 0 && (
                <span className={`battle-float-text slot-float float-${replayEvent.kind}`} key={`${replayEvent.text}-${member.id}`}>
                  {battleFloatLabel(member, replayEvent)}
                </span>
              )}
              <Avatar character={member} label={member.name} />
              <div className="battle-slot-copy">
                <strong>{member.name}</strong>
                <span>HP {member.hp}/{member.maxHp} · 攻 {member.attack} · 速 {member.speed}</span>
                <div className="battle-slot-hp-track" aria-hidden="true">
                  <i style={{ width: hpPercent(member) }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <b>＋</b>
              <span>空缺</span>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
function BossContinueModal({ tier, onBack, onBlessing }: { tier: BossTier; onBack: () => void; onBlessing: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="reward-modal boss-victory-modal">
        <p className="eyebrow">Boss胜利</p>
        <h3>胜利！解锁第{tier + 1}层！</h3>
        <p>可以先返回查看战斗结果，也可以进入祝福处开启下一层前的回复。</p>
        <div className="action-row">
          <button className="secondary-button" onClick={onBack}>返回</button>
          <button className="primary-button" onClick={onBlessing}>进入祝福处</button>
        </div>
      </div>
    </div>
  );
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
  const currentReplayEvent = replayEnabled ? replayEvents[Math.min(replayStep, replayEvents.length - 1)] : null;
  const replayDone = !replayEnabled || replayStep >= replayEvents.length - 1;
  const visibleLogEntries = replayEnabled
    ? replayDone
      ? battle.log
      : replayEvents.slice(0, Math.min(replayEvents.length, replayStep + 1)).map((event) => event.text)
    : battle.log;
  const defeatedNames = replayEnabled
    ? replayEvents.slice(0, replayStep + 1).filter((event) => event.kind === 'defeat').map((event) => event.targetName).filter((name): name is string => Boolean(name))
    : [];
  const canContinueRoute = isWon && !isBossWon && !isFinalBossWon && !pendingEnhance && !hasPendingEnhance && replayDone;
  const replayNotifiedKey = useRef('');
  const snapshotUnits = currentReplayEvent?.units;
  const displayEnemyWithSnapshot = displayEnemy ? applySnapshot(displayEnemy, snapshotUnits) : null;
  const selectedMembersWithSnapshot = selectedMembers.map((member) => applySnapshot(member, snapshotUnits));
  const liveStats = useMemo(
    () => buildReplayStats(team, replayEvents, replayStep, battle.stats, replayDone),
    [battle.stats, replayDone, replayEvents, replayStep, team],
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
    setReplayStep(0);
  }, [replayKey]);

  useEffect(() => {
    if (!replayEnabled || replayStep >= replayEvents.length - 1) {
      return;
    }

    const delay = currentReplayEvent?.kind === 'round' ? 540 : 980;
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
    const delay = battle.type === 'boss' && (battle.phase === 'won' || battle.phase === 'lost') ? 2000 : 0;
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
