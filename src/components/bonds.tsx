import type { Character } from '../game';
import { useEffect, useRef, useState } from 'react';
import {
  CHARACTER_POOL,
  GROUP_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC } from '../assets';
import { Avatar } from './common';
import { getUpgradeEffectLines } from '../game/data/upgrades';

function getTemplateById(id: string) {
  return CHARACTER_POOL.find((character) => character.id === id) ?? null;
}

function getActiveBondKeys(team: Character[]) {
  return [
    ...getActiveBonds(team).filter((bond) => bond.level > 0).map((bond) => bond.group.id),
    ...getActiveSecondaryBonds(team).filter((bond) => bond.active).map((bond) => bond.bond.id),
  ];
}

export function CompactRunSidePanel({ team, onRestart }: { team: Character[]; onRestart: () => void }) {
  const [newMemberId, setNewMemberId] = useState<string | null>(null);
  const [flashingBondIds, setFlashingBondIds] = useState<Set<string>>(new Set());
  const previousTeamIdsRef = useRef(team.map((member) => member.id).join('|'));
  const previousActiveBondIdsRef = useRef(getActiveBondKeys(team).join('|'));
  const slots = Array.from({ length: 4 }, (_, index) => team[index] ?? null);
  const ownedIds = new Set(team.map((member) => member.templateId));
  const primaryBonds = getActiveBonds(team).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(team).filter((bond) => bond.count > 0);
  const visibleBonds = [
    ...primaryBonds.map((bond) => ({
      id: bond.group.id,
      name: bond.group.name,
      count: bond.count,
      total: 3,
      active: bond.level > 0,
      secondary: false,
      logoSrc: BOND_LOGO_SRC[bond.group.id],
      memberIds: bond.group.memberIds,
      details: [
        `2人：${bond.group.level2Description}`,
        `3人：${bond.group.level3Description}`,
      ],
    })),
    ...secondaryBonds.map((bond) => ({
      id: bond.bond.id,
      name: bond.bond.name,
      count: bond.count,
      total: 2,
      active: bond.active,
      secondary: true,
      logoSrc: BOND_LOGO_SRC[bond.bond.id],
      memberIds: bond.bond.memberIds,
      details: [bond.bond.description],
    })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count || right.total - left.total).slice(0, 6);

  useEffect(() => {
    const previousIds = new Set(previousTeamIdsRef.current.split('|').filter(Boolean));
    const currentIds = team.map((member) => member.id);
    const addedId = currentIds.find((id) => !previousIds.has(id)) ?? null;
    previousTeamIdsRef.current = currentIds.join('|');

    if (!addedId) {
      return;
    }

    setNewMemberId(addedId);
    const timer = window.setTimeout(() => setNewMemberId(null), 840);
    return () => window.clearTimeout(timer);
  }, [team]);

  useEffect(() => {
    const previousIds = new Set(previousActiveBondIdsRef.current.split('|').filter(Boolean));
    const currentIds = getActiveBondKeys(team);
    const activatedIds = currentIds.filter((id) => !previousIds.has(id));
    previousActiveBondIdsRef.current = currentIds.join('|');

    if (activatedIds.length === 0) {
      return;
    }

    setFlashingBondIds(new Set(activatedIds));
    const timer = window.setTimeout(() => setFlashingBondIds(new Set()), 980);
    return () => window.clearTimeout(timer);
  }, [team]);

  return (
    <aside className="side-panel compact-run-side-panel">
      <section className="hud-card team-dock">
        <div className="hud-card-heading">
          <h3>当前队伍</h3>
          <span>{team.length}/4</span>
        </div>
        <div className="team-dock-grid">
          {slots.map((member, index) =>
            member ? (
              <div className={`team-dock-member rarity-${member.rarity} ${member.injured ? 'injured' : ''} ${newMemberId === member.id ? 'new-member' : ''}`} key={member.id} tabIndex={0}>
                <Avatar character={member} label={member.name} />
                <span>{member.injured ? '重伤' : `${member.hp}/${member.maxHp}`}</span>
                <div className="dock-popover team-dock-popover">
                  <strong>{member.name}</strong>
                  <small>{RARITY_LABELS[member.rarity]} · {GROUP_LABELS[member.group]}{member.role ? ` · ${ROLE_LABELS[member.role]}` : ''} · LV{member.upgradeLevel ?? 1}</small>
                  <small>HP {member.hp}/{member.maxHp} · 攻 {member.attack} · 速 {member.speed}</small>
                  {getUpgradeEffectLines(member.templateId, member.upgradeLevel ?? 1).map((line) => <span key={line}>{line}</span>)}
                </div>
              </div>
            ) : (
              <div className="team-empty-slot" key={`empty-${index}`}>
                <span>＋</span>
              </div>
            ),
          )}
        </div>
        <button className="hud-wide-button" type="button" onClick={onRestart}>新一局</button>
      </section>
      <section className="hud-card bond-progress-dock">
        <div className="hud-card-heading">
          <h3>羁绊进度</h3>
          <span>i</span>
        </div>
        <div className="bond-progress-list">
          {visibleBonds.map((bond) => (
            <div className={`bond-progress-row ${bond.secondary ? 'secondary' : ''} ${bond.active ? 'active' : 'inactive'} ${flashingBondIds.has(bond.id) ? 'bond-flash' : ''}`} key={bond.id} tabIndex={0}>
              <span className="bond-dot"><img src={bond.logoSrc} alt="" /></span>
              <em>{bond.count}/{bond.total}</em>
              <div className="dock-popover bond-dock-popover">
                <strong>{bond.name} {bond.count}/{bond.total}</strong>
                {bond.details.map((detail) => <span key={detail}>{detail}</span>)}
                <div className="dock-member-grid">
                  {bond.memberIds.map((memberId) => {
                    const member = getTemplateById(memberId);
                    if (!member) {
                      return null;
                    }
                    return (
                      <div className={`bond-member ${ownedIds.has(member.id) ? 'owned' : 'missing'}`} key={member.id}>
                        <Avatar character={member} label={member.name} small />
                        <span>{member.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function BondMemberPopover({ memberIds, ownedIds, summary }: { memberIds: string[]; ownedIds: Set<string>; summary?: string }) {
  return (
    <div className="bond-member-popover">
      {summary && <p>{summary}</p>}
      {memberIds.map((memberId) => {
        const member = getTemplateById(memberId);
        if (!member) {
          return null;
        }

        const owned = ownedIds.has(member.id);
        return (
          <div className={`bond-member ${owned ? 'owned' : 'missing'}`} key={member.id}>
            <Avatar character={member} label={member.name} small />
            <span>{member.name}</span>
          </div>
        );
      })}
    </div>
  );
}

interface BondItemProps {
  name: string;
  count: number;
  total: number;
  details: string[];
  memberIds: string[];
  ownedIds: Set<string>;
  active: boolean;
  secondary?: boolean;
  logoSrc?: string;
}

export function BondItem({ name, count, total, details, memberIds, ownedIds, active, secondary = false, logoSrc }: BondItemProps) {
  return (
    <div className={`bond-item ${active ? 'active' : ''} ${secondary && active ? 'secondary-active' : ''}`}>
      <div className="bond-item-heading">
        {logoSrc && <img className="bond-logo" src={logoSrc} alt="" />}
        <div>
          <strong>
            {name} {count}/{total}
          </strong>
        </div>
      </div>
      <div className="bond-item-details">
        {details.map((detail) => (
          <small key={detail}>{detail}</small>
        ))}
      </div>
      <BondMemberPopover memberIds={memberIds} ownedIds={ownedIds} />
    </div>
  );
}
interface BondTagProps {
  className?: string;
  label: string;
  memberIds: string[];
  ownedIds: Set<string>;
  summary?: string;
}

export function BondTag({ className = '', label, memberIds, ownedIds, summary }: BondTagProps) {
  return (
    <div className={`group-tag bond-tag ${className}`.trim()}>
      <span>{label}</span>
      <BondMemberPopover memberIds={memberIds} ownedIds={ownedIds} summary={summary} />
    </div>
  );
}

export function BondPanel({ team }: { team: Character[] }) {
  const ownedIds = new Set(team.map((member) => member.templateId));
  const bonds = getActiveBonds(team).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(team).filter((bond) => bond.count > 0);

  return (
    <div className="bond-panel">
      <h3>羁绊</h3>
      {bonds.length === 0 && secondaryBonds.length === 0 ? (
        <p>暂无羁绊成员。</p>
      ) : (
        <>
          {bonds.length > 0 && (
            <div className="bond-list">
              {bonds.map((bond) => (
                <BondItem
                  active={bond.level > 0}
                  count={bond.count}
                  details={
                    bond.level >= 2
                      ? [
                          `2人：${bond.group.level2Description}`,
                          ...(bond.level >= 3 ? [`3人：${bond.group.level3Description}`] : []),
                        ]
                      : ['再集齐1名成员激活2人羁绊。']
                  }
                  key={bond.group.id}
                  memberIds={bond.group.memberIds}
                  logoSrc={BOND_LOGO_SRC[bond.group.id]}
                  name={bond.group.name}
                  ownedIds={ownedIds}
                  total={3}
                />
              ))}
            </div>
          )}
          {secondaryBonds.length > 0 && (
            <div className="bond-list">
              <p className="bond-subtitle">次羁绊</p>
              {secondaryBonds.map((activeBond) => (
                <BondItem
                  active={activeBond.active}
                  count={activeBond.count}
                  details={activeBond.active ? [activeBond.bond.description] : ['再集齐1名成员激活。']}
                  key={activeBond.bond.id}
                  memberIds={activeBond.bond.memberIds}
                  logoSrc={BOND_LOGO_SRC[activeBond.bond.id]}
                  name={activeBond.bond.name}
                  ownedIds={ownedIds}
                  secondary
                  total={2}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
