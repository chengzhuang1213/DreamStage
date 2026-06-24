import { useState } from 'react';
import type { BattleState, BattleStats, Character, CharacterBattleStats } from '../game';
import { Avatar } from './common';

function getOrderedStats(team: Character[], stats: BattleStats): CharacterBattleStats[] {
  return team
    .map((member) => ({
      characterId: member.id,
      name: member.name,
      damageDealt: stats[member.id]?.damageDealt ?? 0,
      damageTaken: stats[member.id]?.damageTaken ?? 0,
      shieldBlocked: stats[member.id]?.shieldBlocked ?? 0,
      criticalHits: stats[member.id]?.criticalHits ?? 0,
    }))
    .sort((left, right) => right.damageDealt - left.damageDealt);
}

export function DamageMeter({ stats, team, title }: { stats: BattleStats; team: Character[]; title: string }) {
  const orderedStats = getOrderedStats(team, stats);
  const maxDamage = Math.max(1, ...orderedStats.map((stat) => stat.damageDealt));
  const maxTaken = Math.max(1, ...orderedStats.map((stat) => stat.damageTaken));
  const maxShieldBlocked = Math.max(1, ...orderedStats.map((stat) => stat.shieldBlocked));

  return (
    <section className="damage-meter" aria-label={title}>
      <h3>{title}</h3>
      <div className="damage-meter-list">
        {orderedStats.map((stat) => (
          <div className={`damage-meter-row ${stats[stat.characterId] ? '' : 'not-deployed'}`.trim()} key={stat.characterId}>
            {team.find((member) => member.id === stat.characterId) && (
              <div className="damage-meter-avatar">
                <Avatar character={team.find((member) => member.id === stat.characterId)!} label={stat.name} small />
              </div>
            )}
            <div className="damage-meter-bars">
              <div className="damage-bar-line damage-dealt-line">
                <span className="damage-bar-label">造成伤害</span>
                <span className="damage-bar-track">
                  <span style={{ width: `${stat.damageDealt === 0 ? 0 : Math.max(8, Math.round((stat.damageDealt / maxDamage) * 100))}%` }} />
                </span>
                <b>{stat.damageDealt}</b>
              </div>
              <div className="damage-bar-line damage-taken-line">
                <span className="damage-bar-label">承受伤害</span>
                <span className="damage-bar-track">
                  <span style={{ width: `${stat.damageTaken === 0 ? 0 : Math.max(8, Math.round((stat.damageTaken / maxTaken) * 100))}%` }} />
                </span>
                <b>{stat.damageTaken}</b>
              </div>
              <div className="damage-bar-line shield-blocked-line">
                <span className="damage-bar-label">护盾抵挡</span>
                <span className="damage-bar-track">
                  <span style={{ width: `${stat.shieldBlocked === 0 ? 0 : Math.max(8, Math.round((stat.shieldBlocked / maxShieldBlocked) * 100))}%` }} />
                </span>
                <b>{stat.shieldBlocked}</b>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BattleResultModal({
  phase,
  stats,
  team,
  primaryLabel = '返回',
  onClose,
  onPrimary,
}: {
  phase: BattleState['phase'];
  stats: BattleStats;
  team: Character[];
  primaryLabel?: string;
  onClose: () => void;
  onPrimary?: () => void;
}) {
  const [showStats, setShowStats] = useState(false);
  const isLost = phase === 'lost';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="reward-modal battle-result-modal" role="dialog" aria-modal="true" aria-label="战斗结果" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <h2>{isLost ? '战斗失败' : '战斗胜利'}</h2>
        </div>
        <p className="battle-result-modal-copy">
          {isLost ? '所有可出战角色都已无法继续战斗。' : '敌方已被击败，我方保留战后生命值。'}
        </p>
        {showStats && <DamageMeter stats={stats} team={team} title="伤害统计" />}
        <div className="battle-result-modal-actions">
          {onPrimary && (
            <button className="secondary-button" onClick={onClose} type="button">
              返回战斗
            </button>
          )}
          <button className="secondary-button" onClick={() => setShowStats((visible) => !visible)} type="button">
            {showStats ? '收起伤害统计' : '查看伤害统计'}
          </button>
          <button className="primary-button" onClick={onPrimary ?? onClose} type="button">
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function RunStatsModal({ stats, team, onClose }: { stats: BattleStats; team: Character[]; onClose: () => void }) {
  const orderedStats = getOrderedStats(team, stats);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="reward-modal stats-modal" role="dialog" aria-modal="true" aria-label="本局统计" onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <h2>本局统计</h2>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>
        <div className="run-stat-list">
          {orderedStats.map((stat) => (
            <div className="run-stat-card" key={stat.characterId}>
              <div className="run-stat-card-heading">
                {team.find((member) => member.id === stat.characterId) && (
                  <Avatar character={team.find((member) => member.id === stat.characterId)!} label={stat.name} small />
                )}
                <h3>{stat.name}</h3>
              </div>
              <p>总伤害：{stat.damageDealt}</p>
              <p>承伤：{stat.damageTaken}</p>
              <p>护盾抵挡：{stat.shieldBlocked}</p>
              <p>暴击：{stat.criticalHits}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const LOG_WORDS = {
  attack: '\u653b\u51fb',
  damage: '\u4f24\u5bb3',
  hpLeft: '\u5269\u4f59',
  startBattle: '\u5f00\u59cb\u56e2\u961f\u6218\u6597\uff1a',
  battleStartShort: '\u5f00\u6218\uff1a',
  enterField: '\u540c\u65f6\u4e0a\u573a\u3002',
  enterFieldShort: '\u4e0a\u573a\u3002',
  victory: '\u6218\u6597\u80dc\u5229\uff0c\u83b7\u5f97',
  victoryShort: '\u80dc\u5229\uff1a\u83b7\u5f97',
  injured: '\u8fdb\u5165\u91cd\u4f24\u72b6\u6001\u3002',
  injuredShort: '\u91cd\u4f24\u3002',
  relay: '\u672c\u7ec4\u89d2\u8272\u5df2\u65e0\u6cd5\u7ee7\u7eed\u6218\u6597\uff0c\u8bf7\u9009\u62e9',
  relayShort: '\u63a5\u529b\uff1a\u8bf7\u9009\u62e9',
  defeated: '\u88ab\u51fb\u8d25',
  failed: '\u6311\u6218\u5931\u8d25',
  heal: '\u6062\u590d',
  shield: '\u62a4\u76fe',
  poisonDamage: '\u6bd2\u4f24\u5bb3',
  roundPrefix: '\u7b2c',
  roundSuffix: '\u56de\u5408\u3002',
  combo: '\u8fde\u51fb',
  hits: '\u6b21',
  total: '\u5171',
  mainOutput: '\u662f\u4e3b\u8981\u8f93\u51fa\uff0c\u9020\u6210',
  shieldBlocked: '\u62a4\u76fe\u62b5\u6321',
  mostTaken: '\u627f\u53d7\u6700\u591a\u4f24\u5bb3\uff1a',
  summary: '\u6218\u6597\u603b\u7ed3',
  title: '\u6218\u6597\u65e5\u5fd7',
  collapse: '\u6536\u8d77\u7ec6\u8282',
  expand: '\u5c55\u5f00\u7ec6\u8282',
};

type BattleLogLevel = 'major' | 'action' | 'detail';

interface ReadableBattleLogEntry {
  id: string;
  text: string;
  level: BattleLogLevel;
  round: number | null;
}

function normalizeLogActorName(name: string) {
  return name.replace(/^对手\s*/, '').replace(/^敌方/, '').replace(/^Boss\s*/, '').replace(/^精英\s*/, '').trim();
}

function getLogActorName(text: string) {
  const attackMatch = text.match(/^(.+?) -> /);
  if (attackMatch) {
    return attackMatch[1];
  }

  const comboMatch = text.match(new RegExp(`^(.+?) ${LOG_WORDS.combo} `));
  if (comboMatch) {
    return comboMatch[1];
  }

  const skillMatch = text.match(/^(.+?)(?:发动|触发|恢复|获得)/);
  return skillMatch?.[1] ?? null;
}

function isAllyActionEntry(entry: ReadableBattleLogEntry, team?: Character[]) {
  if (entry.level !== 'action' || !team || team.length === 0) {
    return false;
  }

  const actorName = getLogActorName(entry.text);
  if (!actorName) {
    return false;
  }

  const normalizedActor = normalizeLogActorName(actorName);
  return team.some((member) => {
    const normalizedMember = normalizeLogActorName(member.name);
    return normalizedActor === normalizedMember || normalizedActor.includes(normalizedMember) || normalizedMember.includes(normalizedActor);
  });
}

function isEnemyActionEntry(entry: ReadableBattleLogEntry, team?: Character[]) {
  return entry.level === 'action' && Boolean(getLogActorName(entry.text)) && !isAllyActionEntry(entry, team);
}

function shortenBattleLogEntry(entry: string) {
  const attackMatch = entry.match(new RegExp(`^(.+?)${LOG_WORDS.attack}(.+?)\uff0c\u9020\u6210(\\d+)${LOG_WORDS.damage}\uff0c.+?${LOG_WORDS.hpLeft}(\\d+)HP\u3002$`));
  if (attackMatch) {
    return `${attackMatch[1]} -> ${attackMatch[2]}: ${attackMatch[3]}${LOG_WORDS.damage}${LOG_WORDS.hpLeft}${attackMatch[4]}HP`;
  }

  return entry
    .replace(LOG_WORDS.startBattle, LOG_WORDS.battleStartShort)
    .replace(LOG_WORDS.enterField, LOG_WORDS.enterFieldShort)
    .replace(LOG_WORDS.victory, LOG_WORDS.victoryShort)
    .replace(LOG_WORDS.injured, LOG_WORDS.injuredShort)
    .replace(LOG_WORDS.relay, LOG_WORDS.relayShort);
}

function getBattleLogLevel(entry: string): BattleLogLevel {
  if (
    entry.includes(LOG_WORDS.battleStartShort) ||
    entry.includes(LOG_WORDS.startBattle) ||
    entry.includes(LOG_WORDS.defeated) ||
    entry.includes(LOG_WORDS.victory) ||
    entry.includes(LOG_WORDS.failed) ||
    entry.includes(LOG_WORDS.injuredShort.slice(0, 2)) ||
    new RegExp(`^${LOG_WORDS.roundPrefix}\\d+${LOG_WORDS.roundSuffix}$`).test(entry)
  ) {
    return 'major';
  }

  if (entry.includes(LOG_WORDS.attack) || entry.includes(LOG_WORDS.heal) || entry.includes(LOG_WORDS.shield) || entry.includes(LOG_WORDS.poisonDamage)) {
    return 'action';
  }

  return 'detail';
}

function buildReadableBattleLog(entries: string[]): ReadableBattleLogEntry[] {
  let currentRound: number | null = null;

  return entries.map((entry, index) => {
    const roundMatch = entry.match(new RegExp(`^${LOG_WORDS.roundPrefix}(\\d+)${LOG_WORDS.roundSuffix}$`));
    if (roundMatch) {
      currentRound = Number(roundMatch[1]);
    }

    return {
      id: `${entry}-${index}`,
      text: shortenBattleLogEntry(entry),
      level: getBattleLogLevel(entry),
      round: currentRound,
    };
  });
}

function mergeConsecutiveAttacks(entries: ReadableBattleLogEntry[]) {
  const merged: ReadableBattleLogEntry[] = [];
  const attackPattern = new RegExp(`^(.+?) -> (.+?): (\\d+)${LOG_WORDS.damage}${LOG_WORDS.hpLeft}(\\d+)HP$`);
  const comboPattern = new RegExp(`^(.+?) ${LOG_WORDS.combo} (.+?): (\\d+)${LOG_WORDS.hits}\uff0c${LOG_WORDS.total}(\\d+)${LOG_WORDS.damage}${LOG_WORDS.hpLeft}(\\d+)HP$`);

  entries.forEach((entry) => {
    const current = entry.text.match(attackPattern);
    const previous = merged[merged.length - 1];
    const previousCombo = previous?.text.match(comboPattern);
    const previousAttack = previous?.text.match(attackPattern);

    if (current && previous && previous.round === entry.round) {
      const previousActor = previousCombo?.[1] ?? previousAttack?.[1];
      const previousTarget = previousCombo?.[2] ?? previousAttack?.[2];
      if (previousActor === current[1] && previousTarget === current[2]) {
        const previousHits = previousCombo ? Number(previousCombo[3]) : 1;
        const previousDamage = previousCombo ? Number(previousCombo[4]) : Number(previousAttack?.[3] ?? 0);
        previous.text = `${current[1]} ${LOG_WORDS.combo} ${current[2]}: ${previousHits + 1}${LOG_WORDS.hits}\uff0c${LOG_WORDS.total}${previousDamage + Number(current[3])}${LOG_WORDS.damage}${LOG_WORDS.hpLeft}${current[4]}HP`;
        previous.level = 'action';
        return;
      }
    }

    merged.push({ ...entry });
  });

  return merged;
}

function renderBattleLogText(text: string) {
  const comboMatch = text.match(new RegExp(`^(.+? ${LOG_WORDS.combo} .+?: \\d+${LOG_WORDS.hits}\uff0c${LOG_WORDS.total})(\\d+)(${LOG_WORDS.damage}${LOG_WORDS.hpLeft}\\d+HP)$`));
  if (comboMatch) {
    return (
      <>
        {comboMatch[1]}
        <b className="battle-log-number log-damage-number">{comboMatch[2]}</b>
        {comboMatch[3]}
      </>
    );
  }

  const attackMatch = text.match(new RegExp(`^(.+?: )(\\d+)(${LOG_WORDS.damage}${LOG_WORDS.hpLeft}\\d+HP)$`));
  if (attackMatch) {
    return (
      <>
        {attackMatch[1]}
        <b className="battle-log-number log-damage-number">{attackMatch[2]}</b>
        {attackMatch[3]}
      </>
    );
  }

  if (text.includes(LOG_WORDS.shield)) {
    return renderTypedNumber(text, 'log-shield-number');
  }

  if (text.includes(LOG_WORDS.heal)) {
    return renderTypedNumber(text, 'log-heal-number');
  }

  if (text.includes(LOG_WORDS.poisonDamage) || text.includes(LOG_WORDS.damage)) {
    return renderTypedNumber(text, 'log-damage-number');
  }

  return text;
}

function renderTypedNumber(text: string, className: string) {
  const numberMatch = text.match(/\d+/);
  if (!numberMatch || numberMatch.index === undefined) {
    return text;
  }

  const start = numberMatch.index;
  const end = start + numberMatch[0].length;
  return (
    <>
      {text.slice(0, start)}
      <b className={`battle-log-number ${className}`}>{numberMatch[0]}</b>
      {text.slice(end)}
    </>
  );
}

export function BattleLogSummary({ stats, team }: { stats?: BattleStats; team?: Character[] }) {
  if (!stats || !team || team.length === 0) {
    return null;
  }

  const ordered = getOrderedStats(team, stats);
  const topDamage = ordered.reduce((best, stat) => (stat.damageDealt > best.damageDealt ? stat : best), ordered[0]);
  const topShield = ordered.reduce((best, stat) => (stat.shieldBlocked > best.shieldBlocked ? stat : best), ordered[0]);
  const topTaken = ordered.reduce((best, stat) => (stat.damageTaken > best.damageTaken ? stat : best), ordered[0]);
  const lines = [
    topDamage?.damageDealt > 0 ? `${topDamage.name} ${LOG_WORDS.mainOutput} ${topDamage.damageDealt} ${LOG_WORDS.damage}\u3002` : null,
    topShield?.shieldBlocked > 0 ? `${topShield.name} ${LOG_WORDS.shieldBlocked} ${topShield.shieldBlocked} ${LOG_WORDS.damage}\u3002` : null,
    topTaken?.damageTaken > 0 ? `${topTaken.name} ${LOG_WORDS.mostTaken}${topTaken.damageTaken}\u3002` : null,
  ].filter((line): line is string => Boolean(line));

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="battle-log-summary">
      <strong>{LOG_WORDS.summary}</strong>
      {lines.map((line) => <span key={line}>{line}</span>)}
    </div>
  );
}

export function BattleLog({ entries, stats, team, extraAction, showDamageButton = true }: { entries: string[]; stats?: BattleStats; team?: Character[]; extraAction?: { label: string; onClick: () => void }; showDamageButton?: boolean }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showDamage, setShowDamage] = useState(false);
  const readableEntries = mergeConsecutiveAttacks(buildReadableBattleLog(entries));
  const visibleEntries = showDetails ? readableEntries : readableEntries.filter((entry) => entry.level !== 'detail');
  const canShowDamage = showDamageButton && Boolean(stats && team && team.length > 0);

  return (
    <div className="battle-log" aria-live="polite">
      <div className="battle-log-heading">
        <h3>{LOG_WORDS.title}</h3>
        <div className="battle-log-actions">
          {extraAction && (
            <button className="ghost-button battle-log-retry-button" type="button" onClick={extraAction.onClick}>
              {extraAction.label}
            </button>
          )}
          {canShowDamage && (
            <button className="ghost-button" type="button" onClick={() => setShowDamage((visible) => !visible)}>
              {showDamage ? '收起伤害' : '本场伤害'}
            </button>
          )}
          <button className="ghost-button" type="button" onClick={() => setShowDetails((visible) => !visible)}>
            {showDetails ? LOG_WORDS.collapse : LOG_WORDS.expand}
          </button>
        </div>
      </div>
      {showDamage && stats && team && (
        <div className="battle-log-damage">
          <DamageMeter stats={stats} team={team} title="本场伤害" />
        </div>
      )}
      <BattleLogSummary stats={stats} team={team} />
      <ol>
        {visibleEntries.map((entry) => (
          <li className={`battle-log-entry log-${entry.level} ${isAllyActionEntry(entry, team) ? 'log-ally-action' : ''} ${isEnemyActionEntry(entry, team) ? 'log-enemy-action' : ''}`.trim()} key={entry.id}>
            <span>{renderBattleLogText(entry.text)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
