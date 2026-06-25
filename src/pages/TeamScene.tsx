import { useEffect, useMemo, useState } from 'react';
import type { BossTemplate, Character, MapNode } from '../game';
import {
  GROUP_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC, DRAFT_IMAGE_BY_ID, bondBackgroundStyle } from '../assets';
import { Avatar } from '../components/common';
import { getUpgradeEffectLines } from '../game/data/upgrades';

export interface TeamSceneProps {
  team: Character[];
  gold: number;
  boss: BossTemplate;
  nodes: MapNode[];
  runSeed: string;
  onOpenMap: () => void;
  onOpenStats: () => void;
  onRestart: () => void;
}

function getNodeProgress(nodes: MapNode[]) {
  const completed = nodes.filter((node) => node.completed).length;
  const available = nodes.filter((node) => node.available && !node.completed);
  const nextRow = Math.min(...available.map((node) => node.row + 1));
  return {
    completed,
    total: nodes.length,
    nextRow: Number.isFinite(nextRow) ? nextRow : null,
  };
}

function portraitSrc(member: Character) {
  return DRAFT_IMAGE_BY_ID[member.templateId] ?? member.avatar;
}

function TeamMemberCard({ member, featured = false, selected = false, onSelect }: { member: Character; featured?: boolean; selected?: boolean; onSelect?: () => void }) {
  const upgradeLevel = member.upgradeLevel ?? 1;
  const effectLines = getUpgradeEffectLines(member.templateId, upgradeLevel).slice(0, featured ? 3 : 1);
  const className = `team-scene-member rarity-${member.rarity} ${featured ? 'featured' : ''} ${selected ? 'selected' : ''} ${member.injured ? 'injured' : ''}`;
  const content = (
    <>
      {featured ? (
        <div className="team-scene-portrait">
          <img
            alt=""
            src={portraitSrc(member)}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <Avatar character={member} label={member.name} />
      )}
      <div className="team-scene-member-copy">
        <p className="eyebrow">{RARITY_LABELS[member.rarity]} · {GROUP_LABELS[member.group]}{member.role ? ` · ${ROLE_LABELS[member.role]}` : ''}</p>
        <h3>{member.name}</h3>
        <div className="team-scene-statline">
          <span>LV{upgradeLevel}</span>
          <span>{member.injured ? '重伤' : `HP ${member.hp}/${member.maxHp}`}</span>
          <span>ATK {member.attack}</span>
          <span>SPD {member.speed}</span>
        </div>
        {effectLines.length > 0 && (
          <ul className="team-scene-skill-lines">
            {effectLines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
    </>
  );

  if (!featured && onSelect) {
    return (
      <button className={className} type="button" onClick={onSelect} aria-pressed={selected}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

function BondSummary({ team }: { team: Character[] }) {
  const ownedIds = new Set(team.map((member) => member.templateId));
  const visibleBonds = [
    ...getActiveBonds(team)
      .filter((bond) => bond.count > 0)
      .map((bond) => ({
        id: bond.group.id,
        name: bond.group.name,
        count: bond.count,
        total: 3,
        active: bond.level > 0,
        memberIds: bond.group.memberIds,
        logoSrc: BOND_LOGO_SRC[bond.group.id],
      })),
    ...getActiveSecondaryBonds(team)
      .filter((bond) => bond.count > 0)
      .map((bond) => ({
        id: bond.bond.id,
        name: bond.bond.name,
        count: bond.count,
        total: 2,
        active: bond.active,
        memberIds: bond.bond.memberIds,
        logoSrc: BOND_LOGO_SRC[bond.bond.id],
      })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count);

  if (visibleBonds.length === 0) {
    return <p className="team-scene-empty">还没有形成羁绊。继续招募，让队伍开始发光。</p>;
  }

  return (
    <div className="team-scene-bond-list">
      {visibleBonds.slice(0, 6).map((bond) => (
        <article className={`team-scene-bond bond-theme-card ${bond.active ? 'active' : ''}`} key={bond.id} style={bondBackgroundStyle(bond.id)}>
          <img src={bond.logoSrc} alt="" />
          <div>
            <strong>{bond.name}</strong>
            <span>{bond.count}/{bond.total}{bond.active ? ' 已激活' : ' 未激活'}</span>
          </div>
          <div className="team-scene-bond-members">
            {bond.memberIds.slice(0, 4).map((memberId) => (
              <span className={ownedIds.has(memberId) ? 'owned' : ''} key={memberId} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TeamScene({ team, gold, boss, nodes, runSeed, onOpenMap, onOpenStats, onRestart }: TeamSceneProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(team[0]?.id ?? null);
  const selectedMember = team.find((member) => member.id === selectedMemberId) ?? team[0] ?? null;
  const progress = useMemo(() => getNodeProgress(nodes), [nodes]);

  useEffect(() => {
    if (!team.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(team[0]?.id ?? null);
    }
  }, [selectedMemberId, team]);

  return (
    <div className="team-scene">
      <header className="team-scene-topbar">
        <div>
          <p className="eyebrow">DreamStage Tour</p>
          <h1>队伍休息室</h1>
        </div>
        <div className="team-scene-resources">
          <span className="coin">金币 {gold}</span>
          <span>第 {boss.bossTier} 层</span>
          <span>Seed {runSeed}</span>
        </div>
      </header>

      <main className="team-scene-layout">
        <section className="team-scene-feature-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">偶像详情</p>
          </div>
          {selectedMember ? (
            <TeamMemberCard member={selectedMember} featured />
          ) : (
            <p className="team-scene-empty">完成招募后，这里会展示偶像详情。</p>
          )}
        </section>

        <section className="team-scene-roster-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">队伍</p>
            <h2>{team.length}/4</h2>
          </div>
          <div className="team-scene-roster-grid">
            {team.map((member) => (
              <TeamMemberCard
                member={member}
                selected={member.id === selectedMember?.id}
                onSelect={() => setSelectedMemberId(member.id)}
                key={member.id}
              />
            ))}
            {Array.from({ length: Math.max(0, 4 - team.length) }, (_, index) => (
              <div className="team-scene-empty-slot" key={index}>空位</div>
            ))}
          </div>
        </section>

        <section className="team-scene-bond-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">羁绊进度</p>
            <h2>队伍成长</h2>
          </div>
          <BondSummary team={team} />
        </section>

        <aside className="team-scene-tour-panel">
          <div className="team-scene-progress-card">
          <p className="eyebrow">当前巡演</p>
          <h2>第 {boss.bossTier} 层 Boss</h2>
          <strong>{boss.name}</strong>
          <div className="team-scene-boss-portrait">
            <img
              alt=""
              src={boss.avatar}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span>节点进度 {progress.completed}/{progress.total}</span>
          <span>{progress.nextRow ? `下一排：第 ${progress.nextRow} 排` : '等待选择下一条路线'}</span>
        </div>
          <button className="primary-button team-scene-map-button" type="button" onClick={onOpenMap}>继续巡演 / 打开地图</button>
          <button className="secondary-button" type="button" onClick={onOpenStats}>查看统计</button>
          <button className="danger-button" type="button" onClick={onRestart}>重新开始</button>
        </aside>
      </main>
    </div>
  );
}
