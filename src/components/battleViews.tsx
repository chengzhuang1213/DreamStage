import type { CSSProperties } from 'react';
import type { BattleStats, Character } from '../game';
import type { BossTier } from '../game';
import {
  GROUP_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC, bondBackgroundStyle } from '../assets';
import { Avatar, UpgradeLevelBadge } from './common';
import { DamageMeter } from './battleLog';
import { InfoPill, rarityDetail, roleDetail } from './info';
import { HighlightText } from '../game/data/upgrades';
import { getBattleIllustration } from '../battleAssets';
import {
  type ReplayEvent,
  getReplayTargetAmount,
  isReplayTarget,
  nameMatches,
} from '../battleReplay';

export function hpPercent(character: Pick<Character, 'hp' | 'maxHp'>) {
  return `${Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)))}%`;
}

export function enemyThemeClass(character: Character) {
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

  const bossLineMatch = replayEvent.text.match(/^(?:Boss台词：)?.+?「(.+?)」$/);
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

export function BattleStandee({ character, replayEvent, side, defeated = false }: { character: Character; replayEvent?: ReplayEvent | null; side: 'enemy' | 'ally'; defeated?: boolean }) {
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

export function BattleUnitCard({ character, defeated = false, replayEvent }: { character: Character; defeated?: boolean; replayEvent?: ReplayEvent | null }) {
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

export function BattleTeamPanel({ team, liveStats }: { team: Character[]; liveStats: BattleStats }) {
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

export function BattleSlotStrip({ selectedMembers, slots, replayEvent }: { selectedMembers: Character[]; slots: number; replayEvent?: ReplayEvent | null }) {
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

export function BossContinueModal({ tier, onBack, onBlessing }: { tier: BossTier; onBack: () => void; onBlessing: () => void }) {
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
