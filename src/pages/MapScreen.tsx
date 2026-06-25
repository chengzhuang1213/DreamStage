import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleStats, BossTemplate, Character, MapNode } from '../game';
import {
  BondDetail,
  BondProgressDock,
  BossDetail,
  BossForecast,
  EventLogDetail,
  MapActions,
  MapCursor,
  MapLegend,
  MapModalShell,
  MapNodeButton,
  MapRoutes,
  TeamDetail,
  TeamDock,
  getActiveBondKeys,
  getRouteConnections,
} from '../components/mapViews';

export interface MapScreenProps {
  nodes: MapNode[];
  boss: BossTemplate;
  team: Character[];
  stats: BattleStats;
  gold: number;
  musicMuted: boolean;
  onToggleMusic: () => void;
  onEnter: (node: MapNode) => void;
  onOpenTeamScene: () => void;
  onOpenStats: () => void;
  eventLog: string[];
  onRestart: () => void;
  onClose?: () => void;
  pulseNodeId?: string | null;
}

type MapModal = 'team' | 'bonds' | 'boss' | 'events' | 'restart' | null;

export function MapScreen({ nodes, boss, team, stats: _stats, gold, musicMuted: _musicMuted, onToggleMusic: _onToggleMusic, onEnter, onOpenTeamScene, onOpenStats, eventLog, onRestart, onClose, pulseNodeId }: MapScreenProps) {
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
        <button className="map-back-button" type="button" aria-label={'\u8fd4\u56de'} onClick={onClose ?? (() => setActiveModal('restart'))}>{'\u2190'}</button>
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
          <MapCursor node={cursorNode} nodes={nodes} entering={Boolean(enteringNodeId)} />
          {nodes.map((node) => (
            <MapNodeButton
              key={node.id}
              node={node}
              nodes={nodes}
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
          <MapActions onOpenTeamScene={onOpenTeamScene} onOpenStats={onOpenStats} onOpenEvents={() => setActiveModal('events')} />
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
              <button className="danger-button" type="button" onClick={onRestart}>{'\u8fd4\u56de\u6807\u9898'}</button>
            </>
          )}
        >
          <p className="map-empty-copy">{'\u8fd4\u56de\u6807\u9898\u4f1a\u653e\u5f03\u5f53\u524d\u5de1\u6f14\u8fdb\u5ea6\u3002'}</p>
        </MapModalShell>
      )}
    </div>
  );
}
