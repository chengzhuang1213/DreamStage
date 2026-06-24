import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { BattleEvent, BattleState, BattleUnitSnapshot, BossTemplate, BossTier, Character } from '../game';
import type { BattleStats } from '../game';
import {
  GROUP_LABELS,
  NODE_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC } from '../assets';
import { Avatar, UpgradeLevelBadge } from '../components/common';
import { BattleLog, DamageMeter } from '../components/battleLog';
import { CharacterCard } from '../components/cards';
import { EnhanceModal } from '../components/EnhanceModal';
import { InfoPill, rarityDetail, roleDetail } from '../components/info';
import { HighlightText } from '../game/data/upgrades';

const ENEMY_ILLUSTRATIONS: Record<string, string> = {
  enemy_rin: '/cards/Enemy_Images/2Hoshizora-Rin-hO1h4C.png',
  enemy_ai: '/cards/Enemy_Images/62Miyashita-Ai-f38Jhw.png',
  enemy_mia: '/cards/Enemy_Images/123Mia-Taylor-jCx23M.png',
  enemy_lanzhu: '/cards/Enemy_Images/124Lanzhu-aPGOOW.png',
  enemy_sumire: '/cards/Enemy_Images/121Heanna-Sumire-Ben4YX.png',
  enemy_kinako: '/cards/Enemy_Images/172Sakurakoji-Kinako-ZyHhGE.png',
  enemy_shiki: '/cards/Enemy_Images/174Wakana-Shiki-r1LpGa.png',
  enemy_mei: '/cards/Enemy_Images/173Yoneme-Mei-6Ywcqq.png',
  enemy_polka: '/cards/Enemy_Images/267Polka-Takahashi-W1qD4B.png',
  enemy_miracle_kana: '/cards/Enemy_Images/271Miracle-Kanazawa-e47sZw.png',
  enemy_noriko: '/cards/Enemy_Images/272Noriko-Chofu-WK3G8D.png',
  enemy_hanayo: '/cards/Enemy_Images/3Koizumi-Hanayo-wuvH3R.png',
  enemy_hanamaru: '/cards/Enemy_Images/5Kunikida-Hanamaru-TomAYd.png',
  enemy_ruby: '/cards/Enemy_Images/7Kurosawa-Ruby-RoBWBL.png',
  enemy_karin: '/cards/Enemy_Images/24Asaka-Karin-3nF3em.png',
  enemy_kasumi: '/cards/Enemy_Images/67Nakasu-Kasumi-rQd4Or.png',
  enemy_shizuku: '/cards/Enemy_Images/70Osaka-Shizuku-1WGIlr.png',
  enemy_margarete: '/cards/Enemy_Images/178Margarete-Wien-qc6kCY.png',
  enemy_kozue: '/cards/Enemy_Images/205Kozue-Otomune-kNrbPK.png',
  enemy_tsuzuri: '/cards/Enemy_Images/206Tsuzuri-Yugiri-3KKfOJ.png',
  enemy_rurino: '/cards/Enemy_Images/207Rurino-Osawa-DKPmwE.png',
  enemy_ceras: '/cards/Enemy_Images/230Lilienfeld-Yanagida-Ceras-hVBTJn.png',
  elite_kanan: '/cards/Enemy_Images/8Matsuura-Kanan-aT2Td5.png',
  elite_riko: '/cards/Enemy_Images/12Sakurauchi-Riko-p2EuTb.png',
  elite_umi: '/cards/Enemy_Images/13Sonoda-Umi-rxgV8z.png',
  elite_kaho: '/cards/Enemy_Images/203Kaho-Hinoshita-PS7Ud5.png',
  elite_emma: '/cards/Enemy_Images/28Emma-Verde-pVzmKV.png',
  elite_kanon: '/cards/Enemy_Images/118Shibuya-Kanon-if8zlW.png',
  elite_setsuna: '/cards/Enemy_Images/110Yuki-Setsuna-2gVQWE.png',
  elite_shioriko: '/cards/Enemy_Images/113Mifune-Shioriko-tNDNRT.png',
  elite_natsumi: '/cards/Enemy_Images/175Onitsuka-Natsumi-6nLfeH.png',
  boss_honoka: '/cards/Enemy_Images/4Kousaka-Honoka-2nSYRU.png',
  boss_chika: '/cards/Enemy_Images/14Takami-Chika-MumE0U.png',
  boss_dia: '/cards/Enemy_Images/6Kurosawa-Dia-6ovIG8.png',
  boss_kasumi: '/cards/Enemy_Images/67Nakasu-Kasumi-rQd4Or.png',
  boss_chisato: '/cards/Enemy_Images/120Arashi-Chisato-eySO7L.png',
  boss_maki: '/cards/Enemy_Images/10Nishikino-Maki-UFQB4E.png',
};

const HERO_ILLUSTRATIONS: Record<string, string> = {
  ayumu: '/cards/Image/102Uehara-Ayumu-KN13pl.png',
  rina: '/cards/Image/97Tennoji-Rina-YB8JUo.png',
  nico: '/cards/Image/18Yazawa-Nico-agidhY.png',
  kotori: '/cards/Image/9Minami-Kotori-BkWR39.png',
  keke: '/cards/Image/119Tang-Keke-4Tr0Yx.png',
  you: '/cards/Image/17Watanabe-You-En1r2L.png',
  eli: '/cards/Image/1Ayase-Eli-wRbUwD.png',
  mari: '/cards/Image/11Ohara-Mari-nI3CW6.png',
  ren: '/cards/Image/122Hazuki-Ren-fZ9vXK.png',
  yoshiko: '/cards/Image/16Tsushima-Yoshiko-NdFuZH.png',
  nozomi: '/cards/Image/15Toujou-Nozomi-S678cZ.png',
  kanata: '/cards/Image/50Konoe-Kanata-82Ei8T.png',
};

const HERO_SKIN_ILLUSTRATIONS: Record<string, string> = {
  nico: '/cards/Image/Image_Skins/矢泽妮可皮肤.battle.png',
  keke: '/cards/Image/Image_Skins/唐可可皮肤.battle.png',
  mari: '/cards/Image/Image_Skins/小原鞠莉皮肤.battle.png',
  kanata: '/cards/Image/Image_Skins/近江彼方皮肤.battle.png',
};

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

type ReplayEventKind = BattleEvent['kind'];

interface ReplayEvent {
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

function parseReplayEvent(entry: string): ReplayEvent {
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

  const defeatMatch = entry.match(/^(.+?)被击败。$/);
  if (defeatMatch) {
    return { kind: 'defeat', text: entry, targetName: defeatMatch[1] };
  }

  return { kind: 'major', text: entry };
}

function isReplayPhase(phase: BattleState['phase']) {
  return phase === 'won' || phase === 'lost' || phase === 'relay';
}

function normalizeBattleName(name: string) {
  return name.replace(/^对手\s*/, '').replace(/^敌方/, '').replace(/^Boss\s*/, '').replace(/^精英\s*/, '').trim();
}

function nameMatches(character: Character, maybeName?: string) {
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

function isReplayTarget(character: Character, event?: ReplayEvent | null) {
  if (!event) {
    return false;
  }

  if (event.targetIds?.includes(character.id) || event.targetId === character.id) {
    return true;
  }

  return getReplayTargetNames(event).some((name) => nameMatches(character, name));
}

function getReplayTargetAmount(character: Character, event?: ReplayEvent | null) {
  if (!event) {
    return 0;
  }

  return event.amountsByTarget?.[character.id] ?? (isReplayTarget(character, event) ? event.amount ?? 0 : 0);
}

function groupTeamDamageEvents(events: ReplayEvent[], selectedMembers: Character[]) {
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

function buildReplayStats(team: Character[], events: ReplayEvent[], replayStep: number, finalStats: BattleStats, replayDone: boolean): BattleStats {
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

function applySnapshot(character: Character, units?: BattleUnitSnapshot[]) {
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

function getBattleIllustration(character: Character) {
  if (character.rarity === 'legendary' && HERO_SKIN_ILLUSTRATIONS[character.templateId]) {
    return HERO_SKIN_ILLUSTRATIONS[character.templateId];
  }

  return ENEMY_ILLUSTRATIONS[character.templateId] ?? HERO_ILLUSTRATIONS[character.templateId] ?? character.avatar;
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

function BattleStandee({ character, replayEvent, side, defeated = false }: { character: Character; replayEvent?: ReplayEvent | null; side: 'enemy' | 'ally'; defeated?: boolean }) {
  const isActing = replayEvent?.actorName ? nameMatches(character, replayEvent.actorName) : false;
  const isTarget = isReplayTarget(character, replayEvent);
  const floatLabel = battleFloatLabel(character, replayEvent);
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

  return (
    <div
      className={`battle-standee battle-standee-${side} rarity-${character.rarity} ${defeated ? 'defeated' : ''} ${isActing ? 'is-acting' : ''} ${isTarget ? `is-${replayEvent?.kind}` : ''}`.trim()}
      style={{ '--standee-scale': scale } as CSSProperties}
    >
      {floatLabel && <span className={`battle-float-text float-${replayEvent?.kind}`} key={`${replayEvent?.text}-${character.id}-${floatLabel}`}>{floatLabel}</span>}
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
    <div className={`battle-unit-card rarity-${character.rarity} ${defeated ? 'defeated' : ''} ${isActing ? 'is-acting' : ''} ${isTarget ? `is-${replayEvent?.kind}` : ''}`.trim()}>
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
              <div className={`battle-bond-logo-item ${bond.active ? 'active' : 'inactive'}`} key={bond.id} tabIndex={0}>
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
      <DamageMeter stats={liveStats} team={team} title="本场伤害" />
    </aside>
  );
}

function BattleSlotStrip({ selectedMembers, slots, replayEvent }: { selectedMembers: Character[]; slots: number; replayEvent?: ReplayEvent | null }) {
  const slotItems = Array.from({ length: slots }, (_, index) => selectedMembers[index] ?? null);

  return (
    <section className="battle-slot-strip" aria-label="出战位" style={{ '--slot-count': slots } as CSSProperties}>
      {slotItems.map((member, index) => (
        <div
          className={`battle-slot ${member ? 'filled' : ''} ${member && replayEvent?.actorName && nameMatches(member, replayEvent.actorName) ? 'is-acting' : ''} ${member && isReplayTarget(member, replayEvent) ? `is-${replayEvent?.kind}` : ''}`.trim()}
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
  const selectedMemberIdsKey = selectedMembers.map((member) => member.id).join('|');
  const replayEvents = useMemo<ReplayEvent[]>(() => {
    const rawEvents = (
    battle.events?.length
      ? battle.events
      : battle.log.map(parseReplayEvent)
    );
    return groupTeamDamageEvents(rawEvents, selectedMembers);
  }, [battle.events, battle.log, selectedMemberIdsKey]);
  const replayEnabled = isReplayPhase(battle.phase) && replayEvents.length > 0;
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
  const canContinueRoute = isWon && !isBossWon && !pendingEnhance && !hasPendingEnhance && replayDone;
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
    if (!replayEnabled || !replayDone || replayNotifiedKey.current === replayKey) {
      return;
    }

    replayNotifiedKey.current = replayKey;
    onReplayDone?.();
  }, [onReplayDone, replayDone, replayEnabled, replayKey]);

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
          <section className="battle-card-panel battle-enemy-stage">
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
            extraAction={replayEnabled && !replayDone ? { label: '跳过回放', onClick: () => setReplayStep(replayEvents.length - 1) } : undefined}
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
