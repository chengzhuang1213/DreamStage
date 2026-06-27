import type { CSSProperties, ReactNode } from 'react';
import {
  BOND_GROUPS,
  CHARACTER_POOL,
  GROUP_LABELS,
  NODE_LABELS,
  SECONDARY_BONDS,
  getActiveBonds,
  getActiveSecondaryBonds,
  type BossTemplate,
  type Character,
  type MapNode,
} from '../game';
import { BOND_LOGO_SRC, NODE_ICON_SRC, bondBackgroundStyle } from '../assets';
import { Avatar } from './common';

export function BossForecast({ boss, onOpen }: { boss: BossTemplate; onOpen: () => void }) {
  return (
    <section className={`boss-forecast boss-tier-${boss.bossTier}`} aria-label="本层 Boss 预告">
      <div className="boss-portrait-strip">
        <Avatar character={boss} label={boss.name} />
      </div>
      <div className="boss-forecast-copy">
        <h3>
          <span className="boss-crown">♛</span> 本层Boss：{boss.name}
          <span className="boss-type-pill" data-tooltip={`Boss定位：${boss.feature}。${boss.mechanic ? `机制：${boss.mechanic}` : ''}`} tabIndex={0}>{boss.feature}</span>
        </h3>
        {boss.passive && <p>被动：{boss.passive.description}</p>}
      </div>
      <button className="codex-button" type="button" onClick={onOpen}>
        <span>▣</span>
        Boss图鉴
      </button>
    </section>
  );
}

const NODE_HELP: Record<MapNode['type'], string> = {
  battle: '击败敌人',
  elite: '更强敌人',
  shop: '招募角色/道具',
  rest: '恢复生命',
  boss: '击败Boss前往下一层',
  question: '随机事件/机遇房',
};
function getNodeX(node: MapNode, nodes: MapNode[]) {
  const maxRow = Math.max(1, ...nodes.map((candidate) => candidate.row));
  return 5 + (node.row / maxRow) * 90;
}

function getNodeY(node: MapNode, nodes: MapNode[]) {
  const rowSize = nodes.filter((candidate) => candidate.row === node.row).length;
  if (rowSize === 1) {
    return 50;
  }
  if (rowSize === 2) {
    return node.col === 0 ? 25 : 75;
  }
  return [14, 50, 86][node.col] ?? 50;
}

function nodeJitter(node: MapNode, axis: 'x' | 'y') {
  if (node.type === 'boss') {
    return 0;
  }

  const seed = Array.from(`${node.id}-${axis}`).reduce((total, char) => total + char.charCodeAt(0), 0);
  const amplitude = node.type === 'rest' ? 2 : axis === 'x' ? 2.8 : 5.2;
  return ((seed % 101) / 100 - 0.5) * amplitude;
}

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getNodePosition(node: MapNode, nodes: MapNode[]) {
  return {
    x: clampPercent(getNodeX(node, nodes) + nodeJitter(node, 'x'), 4, 96),
    y: clampPercent(getNodeY(node, nodes) + nodeJitter(node, 'y'), 10, 90),
  };
}

function getVisibleRouteNodeIds(nodes: MapNode[], nodeById: Map<string, MapNode>) {
  if (!nodes.some((node) => node.completed)) {
    return null;
  }

  const visibleIds = new Set(
    nodes
      .filter((node) => node.completed || node.available)
      .map((node) => node.id),
  );
  const queue = nodes.filter((node) => node.available).map((node) => node.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodeById.get(currentId);
    if (!currentNode) {
      continue;
    }

    currentNode.nextIds.forEach((nextId) => {
      if (visibleIds.has(nextId)) {
        return;
      }
      visibleIds.add(nextId);
      queue.push(nextId);
    });
  }

  return visibleIds;
}

export function getRouteConnections(nodes: MapNode[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const visibleRouteNodeIds = getVisibleRouteNodeIds(nodes, nodeById);

  return nodes.flatMap((fromNode) => {
    if (visibleRouteNodeIds && !visibleRouteNodeIds.has(fromNode.id)) {
      return [];
    }

    return fromNode.nextIds
      .map((nextId) => nodeById.get(nextId))
      .filter((toNode): toNode is MapNode => Boolean(toNode))
      .filter((toNode) => !visibleRouteNodeIds || visibleRouteNodeIds.has(toNode.id))
      .map((toNode) => ({
        id: `${fromNode.id}-${toNode.id}`,
        fromId: fromNode.id,
        toId: toNode.id,
        from: getNodePosition(fromNode, nodes),
        to: getNodePosition(toNode, nodes),
        preview: fromNode.available && !fromNode.completed,
        reachable: fromNode.completed && toNode.available,
        completed: fromNode.completed && toNode.completed,
        unseen: !fromNode.available && !fromNode.completed && !toNode.available && !toNode.completed,
      }));
  });
}

export function MapRoutes({ connections, pulseNodeId }: { connections: ReturnType<typeof getRouteConnections>; pulseNodeId?: string | null }) {
  return (
    <svg className="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {connections.map((connection) => {
        const dx = connection.to.x - connection.from.x;
        const dy = connection.to.y - connection.from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const routeClassName = `route-line ${connection.unseen ? 'unseen' : ''} ${connection.preview ? 'preview' : ''} ${connection.reachable ? 'reachable' : ''} ${connection.completed ? 'completed' : ''} ${pulseNodeId && connection.toId === pulseNodeId ? 'route-advanced' : ''}`;

        return (
          <g className={routeClassName} key={connection.id}>
            <line
              className="route-line-stroke route-line-stroke-underlay"
              x1={connection.from.x}
              y1={connection.from.y}
              x2={connection.to.x}
              y2={connection.to.y}
            />
            <line
              className="route-line-stroke"
              x1={connection.from.x}
              y1={connection.from.y}
              x2={connection.to.x}
              y2={connection.to.y}
            />
            {!connection.unseen && (
              <image
                className="route-line-texture"
                href="/ui/route-lines/star-route.png"
                preserveAspectRatio="none"
                transform={`translate(${connection.from.x} ${connection.from.y}) rotate(${angle})`}
                x="0"
                y="-3.6"
                width={length}
                height="7.2"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MapCursor({ node, nodes, entering }: { node: MapNode | null; nodes: MapNode[]; entering?: boolean }) {
  if (!node) {
    return null;
  }

  const position = getNodePosition(node, nodes);

  return (
    <div
      className={`map-cursor ${node.completed ? 'completed' : ''} ${node.available ? 'available' : ''} ${entering ? 'entering' : ''}`}
      style={{ '--cursor-x': `${position.x}%`, '--cursor-y': `${position.y}%` } as CSSProperties}
      aria-hidden="true"
    >
      <span />
    </div>
  );
}

export function MapNodeButton({
  node,
  onEnter,
  onPreview,
  scrollRef,
  entering,
  pulse,
  skipped,
  nodes,
}: {
  node: MapNode;
  nodes: MapNode[];
  onEnter: (node: MapNode) => void;
  onPreview: (node: MapNode) => void;
  scrollRef?: (element: HTMLButtonElement | null) => void;
  entering?: boolean;
  pulse?: boolean;
  skipped?: boolean;
}) {
  const position = getNodePosition(node, nodes);
  const canPreview = node.available && !node.completed;

  return (
    <button
      className={`map-node node-${node.type} ${node.completed ? 'completed' : ''} ${node.available ? 'available' : ''} ${skipped ? 'skipped' : ''} ${entering ? 'entering' : ''} ${pulse ? 'just-completed' : ''}`}
      disabled={!node.available || node.completed}
      onFocus={() => canPreview && onPreview(node)}
      onClick={() => onEnter(node)}
      onPointerEnter={() => canPreview && onPreview(node)}
      ref={scrollRef}
      style={{ '--node-x': `${position.x}%`, '--node-y': `${position.y}%` } as CSSProperties}
      type="button"
    >
      <span className="node-orb"><img className="node-icon-art" src={NODE_ICON_SRC[node.type]} alt="" /></span>
    </button>
  );
}

export function TeamDock({ team, onOpenDetails, newMemberId }: { team: Character[]; onOpenDetails: () => void; newMemberId?: string | null }) {
  const slots = Array.from({ length: 4 }, (_, index) => team[index] ?? null);

  return (
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
              <span>
                {member.injured ? '重伤' : `${member.hp}/${member.maxHp}`}
              </span>
              <div className="dock-popover team-dock-popover">
                <strong>{member.name}</strong>
                <small>{GROUP_LABELS[member.group]} · LV{member.upgradeLevel ?? 1}</small>
                <small>HP {member.hp}/{member.maxHp} · 攻 {member.attack} · 速 {member.speed}</small>
                {member.passive && <span>被动：{member.passive.description}</span>}
                {member.skill && <span>技能：{member.skill.description}</span>}
              </div>
            </div>
          ) : (
            <div className="team-empty-slot" key={`empty-${index}`}>
              <span>＋</span>
            </div>
          ),
        )}
      </div>
      <button className="hud-wide-button" type="button" onClick={onOpenDetails}>详细</button>
    </section>
  );
}

export function BondProgressDock({ team, onOpenDetails, flashingBondIds }: { team: Character[]; onOpenDetails: () => void; flashingBondIds?: Set<string> }) {
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
      details: [bond.bond.description],
    })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count || right.total - left.total).slice(0, 6);

  return (
    <section className="hud-card bond-progress-dock">
      <div className="hud-card-heading">
        <h3>羁绊进度</h3>
        <span>i</span>
      </div>
      <div className="bond-progress-list">
        {visibleBonds.map((bond) => (
          <div className={`bond-progress-row bond-theme-card ${bond.secondary ? 'secondary' : ''} ${bond.active ? 'active' : 'inactive'} ${flashingBondIds?.has(bond.id) ? 'bond-flash' : ''}`} key={bond.id} style={bondBackgroundStyle(bond.id)} tabIndex={0}>
            <span className="bond-dot"><img src={bond.logoSrc} alt="" /></span>
            <em>{bond.count}/{bond.total}</em>
            <div className="dock-popover bond-dock-popover">
              <strong>{bond.name} {bond.count}/{bond.total}</strong>
              {bond.details.map((detail) => <span key={detail}>{detail}</span>)}
            </div>
          </div>
        ))}
      </div>
      <button className="hud-wide-button" type="button" onClick={onOpenDetails}>详细</button>
    </section>
  );
}

export function MapLegend({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const entries: MapNode['type'][] = ['battle', 'elite', 'shop', 'rest', 'question', 'boss'];

  return (
    <aside className={`map-legend ${expanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="map-legend-toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls="map-node-legend"
        onClick={onToggle}
      >
        <span>节点说明</span>
        <span className="map-legend-chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="map-legend-content" id="map-node-legend">
          {entries.map((type) => (
            <div className={`legend-row node-${type}`} key={type}>
              <span><img className="legend-icon-art" src={NODE_ICON_SRC[type]} alt="" /></span>
              <div>
                <strong>{NODE_LABELS[type]}</strong>
                <small>{NODE_HELP[type]}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}



export function MapModalShell({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="reward-modal map-detail-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="ghost-button" type="button" onClick={onClose}>{'\u5173\u95ed'}</button>
        </div>
        <div className="map-detail-content">{children}</div>
        {actions && <div className="map-detail-actions">{actions}</div>}
      </section>
    </div>
  );
}

function getTemplateById(id: string) {
  return CHARACTER_POOL.find((character) => character.id === id) ?? null;
}

function CharacterBondLogos({ member }: { member: Character }) {
  const bonds = [
    ...BOND_GROUPS.filter((bond) => bond.memberIds.includes(member.templateId)).map((bond) => ({
      id: bond.id,
      name: bond.name,
      logoSrc: BOND_LOGO_SRC[bond.id],
    })),
    ...SECONDARY_BONDS.filter((bond) => bond.memberIds.includes(member.templateId)).map((bond) => ({
      id: bond.id,
      name: bond.name,
      logoSrc: BOND_LOGO_SRC[bond.id],
    })),
  ];

  return (
    <div className="map-character-bonds" aria-label={`${member.name}羁绊`}>
      {bonds.map((bond) => (
        <span className="map-bond-logo-chip" key={bond.id} title={bond.name}>
          <img src={bond.logoSrc} alt="" />
        </span>
      ))}
    </div>
  );
}

function BondMemberAvatars({ memberIds, ownedIds }: { memberIds: string[]; ownedIds: Set<string> }) {
  return (
    <div className="map-bond-members">
      {memberIds.map((memberId) => {
        const member = getTemplateById(memberId);
        if (!member) {
          return null;
        }
        const owned = ownedIds.has(memberId);
        return (
          <div className={`map-bond-member ${owned ? 'owned' : 'missing'}`} key={memberId}>
            <Avatar character={member} label={member.name} small />
            <span>{member.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TeamDetail({ team }: { team: Character[] }) {
  return (
    <div className="map-detail-list">
      {team.map((member) => (
        <div className={`map-detail-row rarity-${member.rarity}`} key={member.id}>
          <Avatar character={member} label={member.name} />
          <div>
            <strong>{member.name}</strong>
            <span>{GROUP_LABELS[member.group]}{' \u00b7 LV'}{member.upgradeLevel ?? 1}{' \u00b7 '}{member.hp}/{member.maxHp} HP</span>
            <small>{'\u653b\u51fb '}{member.attack}{' \u00b7 \u901f\u5ea6 '}{member.speed}</small>
            {member.passive && <small>{'\u88ab\u52a8\uff1a'}{member.passive.description}</small>}
            {member.skill && <small>{'\u6280\u80fd\uff1a'}{member.skill.description}</small>}
          </div>
          <CharacterBondLogos member={member} />
        </div>
      ))}
    </div>
  );
}

export function BondDetail({ team }: { team: Character[] }) {
  const ownedIds = new Set(team.map((member) => member.templateId));
  const primaryBonds = getActiveBonds(team).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(team).filter((bond) => bond.count > 0);
  const bonds = [
    ...primaryBonds.map((bond) => ({
      id: bond.group.id,
      name: bond.group.name,
      memberIds: bond.group.memberIds,
      count: bond.count,
      total: 3,
      active: bond.level > 0,
      description: bond.level >= 3 ? bond.group.level3Description : bond.level >= 2 ? bond.group.level2Description : bond.group.theme,
      logoSrc: BOND_LOGO_SRC[bond.group.id],
    })),
    ...secondaryBonds.map((bond) => ({
      id: bond.bond.id,
      name: bond.bond.name,
      memberIds: bond.bond.memberIds,
      count: bond.count,
      total: 2,
      active: bond.active,
      description: bond.bond.description,
      logoSrc: BOND_LOGO_SRC[bond.bond.id],
    })),
  ];

  return (
    <div className="map-detail-list">
      {bonds.length === 0 && <p className="map-empty-copy">{'\u5f53\u524d\u8fd8\u6ca1\u6709\u7f81\u7eca\u8fdb\u5ea6\u3002'}</p>}
      {bonds.map((bond) => (
        <div className={'map-detail-row bond-row bond-theme-card ' + (bond.active ? 'active' : '')} key={bond.id} style={bondBackgroundStyle(bond.id)}>
          <span className="bond-dot"><img src={bond.logoSrc} alt="" /></span>
          <div>
            <strong>{bond.name} {bond.count}/{bond.total}</strong>
            <small>{bond.description}</small>
          </div>
          <BondMemberAvatars memberIds={bond.memberIds} ownedIds={ownedIds} />
        </div>
      ))}
    </div>
  );
}

export function BossDetail({ boss }: { boss: BossTemplate }) {
  return (
    <div className="map-detail-list">
      <div className="map-detail-row">
        <Avatar character={boss} label={boss.name} />
        <div>
          <strong>{boss.name}</strong>
          <span>{boss.feature}{' \u00b7 HP '}{boss.maxHp}{' \u00b7 \u653b\u51fb '}{boss.attack}{' \u00b7 \u901f\u5ea6 '}{boss.speed}</span>
          {boss.passive && <small>{'\u88ab\u52a8\uff1a'}{boss.passive.description}</small>}
          {boss.skill && <small>{'\u6280\u80fd\uff1a'}{boss.skill.description}</small>}
          {boss.mechanic && <small>{'\u673a\u5236\uff1a'}{boss.mechanic}</small>}
        </div>
      </div>
    </div>
  );
}

export function EventLogDetail({ eventLog }: { eventLog: string[] }) {
  return (
    <ol className="map-event-log">
      {eventLog.length === 0 && <li>{'\u6682\u65e0\u4e8b\u4ef6\u8bb0\u5f55\u3002'}</li>}
      {eventLog.map((entry, index) => (
        <li key={entry + '-' + index}>{entry}</li>
      ))}
    </ol>
  );
}

export function MapActions({ onOpenTeamScene, onOpenStats, onOpenEvents }: { onOpenTeamScene: () => void; onOpenStats: () => void; onOpenEvents: () => void }) {
  return (
    <aside className="map-actions">
      <button className="map-team-scene-button" type="button" aria-label={'\u961f\u4f0d\u8be6\u60c5'} title={'\u961f\u4f0d\u8be6\u60c5'} onClick={onOpenTeamScene}>
        <span aria-hidden="true">{'\u2605'}</span>
        <em className="map-action-label">{'\u961f\u4f0d'}</em>
      </button>
      <button type="button" aria-label={'\u4f24\u5bb3\u7edf\u8ba1'} title={'\u4f24\u5bb3\u7edf\u8ba1'} onClick={onOpenStats}>
        <span aria-hidden="true">{'\u25a3'}</span>
        <em className="map-action-label">{'\u7edf\u8ba1'}</em>
      </button>
      <button type="button" aria-label={'\u4e8b\u4ef6\u65e5\u5fd7'} title={'\u4e8b\u4ef6\u65e5\u5fd7'} onClick={onOpenEvents}>
        <span aria-hidden="true">{'\u2630'}</span>
        <em className="map-action-label">{'\u65e5\u5fd7'}</em>
      </button>
    </aside>
  );
}

export function getActiveBondKeys(team: Character[]) {
  return [
    ...getActiveBonds(team).filter((bond) => bond.level > 0).map((bond) => bond.group.id),
    ...getActiveSecondaryBonds(team).filter((bond) => bond.active).map((bond) => bond.bond.id),
  ];
}

