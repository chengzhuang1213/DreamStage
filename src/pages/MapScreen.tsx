import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOND_GROUPS,
  CHARACTER_POOL,
  GROUP_LABELS,
  NODE_LABELS,
  SECONDARY_BONDS,
  getActiveBonds,
  getActiveSecondaryBonds,
  type BattleStats,
  type BossTemplate,
  type Character,
  type MapNode,
} from '../game';
import { BOND_LOGO_SRC, NODE_ICON_SRC } from '../assets';
import { Avatar } from '../components/common';

export interface MapScreenProps {
  nodes: MapNode[];
  boss: BossTemplate;
  team: Character[];
  stats: BattleStats;
  gold: number;
  musicMuted: boolean;
  onToggleMusic: () => void;
  onEnter: (node: MapNode) => void;
  onOpenStats: () => void;
  eventLog: string[];
  onRestart: () => void;
  pulseNodeId?: string | null;
}

type MapModal = 'team' | 'bonds' | 'boss' | 'events' | 'restart' | null;

function BossForecast({ boss, onOpen }: { boss: BossTemplate; onOpen: () => void }) {
  return (
    <section className="boss-forecast" aria-label="本层 Boss 预告">
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
  rest: '恢复生命/移除卡牌',
  boss: '击败Boss前往下一层',
};
const MAP_ROW_Y: Record<number, number> = {
  5: 8,
  4: 24,
  3: 40,
  2: 56,
  1: 72,
  0: 88,
};

function getNodeX(node: MapNode) {
  const rowSize = node.row === 5 ? 1 : node.row === 4 ? 2 : 3;
  if (rowSize === 1) {
    return 50;
  }
  if (rowSize === 2) {
    return node.col === 0 ? 38 : 62;
  }
  return [28, 50, 72][node.col] ?? 50;
}

function getNodePosition(node: MapNode) {
  return {
    x: getNodeX(node),
    y: MAP_ROW_Y[node.row] ?? 50,
  };
}

function getRouteConnections(nodes: MapNode[]) {
  const byRow = new Map<number, MapNode[]>();
  nodes.forEach((node) => {
    byRow.set(node.row, [...(byRow.get(node.row) ?? []), node]);
  });

  return nodes.flatMap((fromNode) => {
    if (!fromNode.available && !fromNode.completed) {
      return [];
    }

    const nextNodes = byRow.get(fromNode.row + 1) ?? [];
    return nextNodes
      .filter((toNode) => Math.abs(toNode.col - fromNode.col) <= 1)
      .filter((toNode) => fromNode.available || toNode.available || toNode.completed)
      .map((toNode) => ({
        id: `${fromNode.id}-${toNode.id}`,
        fromId: fromNode.id,
        toId: toNode.id,
        from: getNodePosition(fromNode),
        to: getNodePosition(toNode),
        preview: fromNode.available && !fromNode.completed,
        reachable: fromNode.completed && toNode.available,
        completed: fromNode.completed && toNode.completed,
      }));
  });
}

function MapRoutes({ connections, pulseNodeId }: { connections: ReturnType<typeof getRouteConnections>; pulseNodeId?: string | null }) {
  return (
    <svg className="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {connections.map((connection) => {
        const dx = connection.to.x - connection.from.x;
        const dy = connection.to.y - connection.from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <image
            className={`route-line ${connection.preview ? 'preview' : ''} ${connection.reachable ? 'reachable' : ''} ${connection.completed ? 'completed' : ''} ${pulseNodeId && connection.toId === pulseNodeId ? 'route-advanced' : ''}`}
            href="/ui/route-lines/star-route.png"
            key={connection.id}
            preserveAspectRatio="none"
            transform={`translate(${connection.from.x} ${connection.from.y}) rotate(${angle})`}
            x="0"
            y="-3.6"
            width={length}
            height="7.2"
          />
        );
      })}
    </svg>
  );
}

function MapCursor({ node, entering }: { node: MapNode | null; entering?: boolean }) {
  if (!node) {
    return null;
  }

  const position = getNodePosition(node);

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

function MapNodeButton({
  node,
  onEnter,
  onPreview,
  scrollRef,
  entering,
  pulse,
  skipped,
}: {
  node: MapNode;
  onEnter: (node: MapNode) => void;
  onPreview: (node: MapNode) => void;
  scrollRef?: (element: HTMLButtonElement | null) => void;
  entering?: boolean;
  pulse?: boolean;
  skipped?: boolean;
}) {
  const position = getNodePosition(node);
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

function TeamDock({ team, onOpenDetails, newMemberId }: { team: Character[]; onOpenDetails: () => void; newMemberId?: string | null }) {
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

function BondProgressDock({ team, onOpenDetails, flashingBondIds }: { team: Character[]; onOpenDetails: () => void; flashingBondIds?: Set<string> }) {
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
          <div className={`bond-progress-row ${bond.secondary ? 'secondary' : ''} ${bond.active ? 'active' : 'inactive'} ${flashingBondIds?.has(bond.id) ? 'bond-flash' : ''}`} key={bond.id} tabIndex={0}>
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

function MapLegend({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const entries: MapNode['type'][] = ['battle', 'elite', 'shop', 'rest', 'boss'];

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



function MapModalShell({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
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

function TeamDetail({ team }: { team: Character[] }) {
  return (
    <div className="map-detail-list">
      {team.map((member) => (
        <div className="map-detail-row" key={member.id}>
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

function BondDetail({ team }: { team: Character[] }) {
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
        <div className={'map-detail-row bond-row ' + (bond.active ? 'active' : '')} key={bond.id}>
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

function BossDetail({ boss }: { boss: BossTemplate }) {
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

function EventLogDetail({ eventLog }: { eventLog: string[] }) {
  return (
    <ol className="map-event-log">
      {eventLog.length === 0 && <li>{'\u6682\u65e0\u4e8b\u4ef6\u8bb0\u5f55\u3002'}</li>}
      {eventLog.map((entry, index) => (
        <li key={entry + '-' + index}>{entry}</li>
      ))}
    </ol>
  );
}

function MapActions({ onOpenStats, onOpenEvents }: { onOpenStats: () => void; onOpenEvents: () => void }) {
  return (
    <aside className="map-actions">
      <button type="button" onClick={onOpenStats}>
        <span>{'\u25a3'}</span>
        {'\u4f24\u5bb3\u7edf\u8ba1'}
      </button>
      <button type="button" onClick={onOpenEvents}>
        <span>{'\u2630'}</span>
        {'\u4e8b\u4ef6\u65e5\u5fd7'}
      </button>
    </aside>
  );
}

function getActiveBondKeys(team: Character[]) {
  return [
    ...getActiveBonds(team).filter((bond) => bond.level > 0).map((bond) => bond.group.id),
    ...getActiveSecondaryBonds(team).filter((bond) => bond.active).map((bond) => bond.bond.id),
  ];
}

export function MapScreen({ nodes, boss, team, stats: _stats, gold, musicMuted: _musicMuted, onToggleMusic: _onToggleMusic, onEnter, onOpenStats, eventLog, onRestart, pulseNodeId }: MapScreenProps) {
  const routeConnections = useMemo(() => getRouteConnections(nodes), [nodes]);
  const [activeModal, setActiveModal] = useState<MapModal>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [enteringNodeId, setEnteringNodeId] = useState<string | null>(null);
  const [goldPulse, setGoldPulse] = useState(false);
  const [newMemberId, setNewMemberId] = useState<string | null>(null);
  const [flashingBondIds, setFlashingBondIds] = useState<Set<string>>(new Set());
  const currentNodeRef = useRef<HTMLButtonElement | null>(null);
  const previousGoldRef = useRef(gold);
  const previousTeamIdsRef = useRef(team.map((member) => member.id).join('|'));
  const previousActiveBondIdsRef = useRef(getActiveBondKeys(team).join('|'));
  const hoveredNode = hoveredNodeId ? nodes.find((node) => node.id === hoveredNodeId && node.available && !node.completed) ?? null : null;
  const enteringNode = enteringNodeId ? nodes.find((node) => node.id === enteringNodeId) ?? null : null;
  const lastCompletedNode = [...nodes]
    .filter((node) => node.completed)
    .sort((left, right) => right.row - left.row || right.col - left.col)[0] ?? null;
  const defaultAvailableNode = nodes.find((node) => node.available && !node.completed) ?? null;
  const cursorNode = enteringNode ?? hoveredNode ?? lastCompletedNode ?? defaultAvailableNode;
  const scrollTargetNode = defaultAvailableNode ?? lastCompletedNode;
  const progressedPastRow = Math.max(
    -1,
    ...nodes.filter((node) => node.completed).map((node) => node.row),
    ...nodes.filter((node) => node.available && !node.completed).map((node) => node.row - 1),
  );

  useEffect(() => {
    if (previousGoldRef.current === gold) {
      return;
    }

    previousGoldRef.current = gold;
    setGoldPulse(true);
    const timer = window.setTimeout(() => setGoldPulse(false), 620);
    return () => window.clearTimeout(timer);
  }, [gold]);

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

  useEffect(() => {
    setEnteringNodeId(null);
  }, [nodes]);

  function handleEnterNode(node: MapNode) {
    if (enteringNodeId || !node.available || node.completed) {
      return;
    }

    setHoveredNodeId(node.id);
    setEnteringNodeId(node.id);
    window.setTimeout(() => onEnter(node), 440);
  }

  useEffect(() => {
    const element = currentNodeRef.current;
    if (!element || !scrollTargetNode) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const lowerViewportLine = window.innerHeight * 0.72;
    if (rect.top > lowerViewportLine || rect.bottom > window.innerHeight - 72) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [scrollTargetNode?.id]);

  return (
    <div className={`map-hud-screen ${enteringNodeId ? 'route-entering' : ''}`}>
      <header className="map-hud-topbar">
        <button className="map-back-button" type="button" aria-label={'\u8fd4\u56de'} onClick={() => setActiveModal('restart')}>{'\u2190'}</button>
        <h2>{'\u7b2c'}{boss.bossTier}{'\u5c42'}</h2>
        <span aria-hidden="true" />
      </header>

      <BossForecast boss={boss} onOpen={() => setActiveModal('boss')} />

      <div className="map-stage">
        <aside className="map-left-rail">
          <TeamDock team={team} newMemberId={newMemberId} onOpenDetails={() => setActiveModal('team')} />
          <BondProgressDock team={team} flashingBondIds={flashingBondIds} onOpenDetails={() => setActiveModal('bonds')} />
        </aside>
        <div className="map-board">
          <MapRoutes connections={routeConnections} pulseNodeId={pulseNodeId} />
          <MapCursor node={cursorNode} entering={Boolean(enteringNodeId)} />
          {nodes.map((node) => (
            <MapNodeButton
              key={node.id}
              node={node}
              skipped={!node.completed && !node.available && node.row <= progressedPastRow}
              entering={enteringNodeId === node.id}
              pulse={pulseNodeId === node.id}
              onEnter={handleEnterNode}
              onPreview={(previewNode) => setHoveredNodeId(previewNode.id)}
              scrollRef={node.id === scrollTargetNode?.id ? (element) => { currentNodeRef.current = element; } : undefined}
            />
          ))}
        </div>
        <aside className="map-right-rail">
          <MapActions onOpenStats={onOpenStats} onOpenEvents={() => setActiveModal('events')} />
          <MapLegend expanded={legendExpanded} onToggle={() => setLegendExpanded((expanded) => !expanded)} />
          <div className="map-rail-gold">
            <span className={`resource-pill coin ${goldPulse ? 'resource-pulse' : ''}`} data-tooltip={'\u91d1\u5e01\uff1a\u7528\u4e8e\u5546\u5e97\u62db\u52df\u3001\u4f11\u606f\u5904\u6cbb\u7597\u590d\u6d3b\uff0c\u4ee5\u53ca\u90e8\u5206\u5f3a\u5316\u8d39\u7528\u3002'} tabIndex={0}>{'\u91d1\u5e01 '}{gold}</span>
          </div>
        </aside>
      </div>

      {activeModal === 'team' && (
        <MapModalShell title={'\u961f\u4f0d\u8be6\u60c5'} onClose={() => setActiveModal(null)}>
          <TeamDetail team={team} />
        </MapModalShell>
      )}
      {activeModal === 'bonds' && (
        <MapModalShell title={'\u7f81\u7eca\u8be6\u60c5'} onClose={() => setActiveModal(null)}>
          <BondDetail team={team} />
        </MapModalShell>
      )}
      {activeModal === 'boss' && (
        <MapModalShell title={'Boss\u56fe\u9274'} onClose={() => setActiveModal(null)}>
          <BossDetail boss={boss} />
        </MapModalShell>
      )}
      {activeModal === 'events' && (
        <MapModalShell title={'\u4e8b\u4ef6\u65e5\u5fd7'} onClose={() => setActiveModal(null)}>
          <EventLogDetail eventLog={eventLog} />
        </MapModalShell>
      )}
      {activeModal === 'restart' && (
        <MapModalShell
          title={'\u8fd4\u56de\u786e\u8ba4'}
          onClose={() => setActiveModal(null)}
          actions={(
            <>
              <button className="secondary-button" type="button" onClick={() => setActiveModal(null)}>{'\u7ee7\u7eed\u5de1\u6f14'}</button>
              <button className="primary-button" type="button" onClick={onRestart}>{'\u8fd4\u56de\u6807\u9898'}</button>
            </>
          )}
        >
          <p className="map-empty-copy">{'\u8fd4\u56de\u6807\u9898\u4f1a\u653e\u5f03\u5f53\u524d\u5de1\u6f14\u8fdb\u5ea6\u3002'}</p>
        </MapModalShell>
      )}
    </div>
  );
}
