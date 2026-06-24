import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  CHARACTER_POOL,
  NODE_LABELS,
  applyPostNodePassives,
  type BattleStats,
  type BattleState,
  type BattleType,
  type BossTier,
  type BossTemplate,
  type Character,
  type CharacterTemplate,
  type MapNode,
  buildMap,
  completeMapNode,
  createAlly,
  createDraftCandidates,
  createEnemiesForBattle,
  createShopOffers,
  getBattleSlots,
  getRandomBossForTier,
  getRewardGold,
  isBattleNode,
  resolveBattleGroup,
} from './game';
import { MUSIC_SRC, SFX_SRC, type MusicKey, type SfxKey } from './assets';
import { Avatar, MusicToggleButton } from './components/common';
import { BattleResultModal, RunStatsModal } from './components/battleLog';
import { CompactRunSidePanel } from './components/bonds';
import { BattleScreen } from './pages/BattleScreen';
import { BlessingScreen } from './pages/BlessingScreen';
import { MapScreen } from './pages/MapScreen';
import { RestScreen } from './pages/RestScreen';
import { EndScreen, ResultScreen } from './pages/ResultScreens';
import { ShopScreen } from './pages/ShopScreen';
import { StartScreen } from './pages/StartScreen';
import { DraftScreen } from './pages/DraftScreen';

type Screen = 'start' | 'draft' | 'map' | 'battle' | 'result' | 'shop' | 'rest' | 'blessing' | 'win' | 'loss';

function getMusicKey(run: RunState): MusicKey {
  if (run.screen === 'battle') {
    return 'battle';
  }
  if (run.screen === 'draft' || run.screen === 'shop') {
    return 'draftShop';
  }
  if (run.screen === 'rest' || run.screen === 'blessing') {
    return 'rest';
  }
  if (run.screen === 'map') {
    return 'map';
  }
  return 'home';
}

interface ResultState {
  title: string;
  body: string;
  rewardGold: number;
}

interface RunState {
  screen: Screen;
  candidates: CharacterTemplate[];
  draftSelection: string[];
  team: Character[];
  gold: number;
  map: MapNode[];
  currentNodeId: string | null;
  battle: BattleState | null;
  boss: BossTemplate;
  result: ResultState | null;
  runStats: BattleStats;
  statsOpen: boolean;
  battleStatsOpen: boolean;
  eventLog: string[];
  shopOffers: CharacterTemplate[];
  restHealUsed: boolean;
  restReviveUsed: boolean;
  pendingEnhance: { source: 'elite' | 'boss'; cost: number; free: boolean } | null;
  enhanceReady: boolean;
  pendingBossVictory: boolean;
  bossRetrySnapshot: { team: Character[]; battle: BattleState } | null;
  mapPulseNodeId: string | null;
}

type HealType = 'small' | 'large';

const SAKURA_PETALS = Array.from({ length: 26 }, (_, index) => index);
const SCENE_PARTICLES = Array.from({ length: 18 }, (_, index) => index);
const START_TRANSITION_MS = 1800;
const BOSS_BLESSING_TRANSITION_MS = 1700;

const HEAL_OPTIONS: Record<HealType, { label: string; cost: number; amount: number; full?: boolean }> = {
  small: { label: '小治疗', cost: 20, amount: 15 },
  large: { label: '大治疗', cost: 50, amount: 50 },
};
const REVIVE_COST = 40;
const REVIVE_HP_RATIO = 0.3;
const ENHANCE_COST = 20;

function applyLayerBlessing(team: Character[]): Character[] {
  return team.map((member) => {
    const blessedHp = Math.ceil(member.maxHp * 0.5);
    if (member.injured || member.hp <= 0) {
      return { ...member, injured: false, hp: blessedHp };
    }

    if (member.hp < blessedHp) {
      return { ...member, hp: blessedHp };
    }

    return member;
  });
}

function createRun(): RunState {
  const boss = getRandomBossForTier(1);

  return {
    screen: 'start',
    candidates: createDraftCandidates(),
    draftSelection: [],
    team: [],
    gold: 80,
    map: buildMap(),
    currentNodeId: null,
    battle: null,
    boss,
    result: null,
    runStats: {},
    statsOpen: false,
    battleStatsOpen: false,
    eventLog: [],
    shopOffers: [],
    restHealUsed: false,
    restReviveUsed: false,
    pendingEnhance: null,
    enhanceReady: false,
    pendingBossVictory: false,
    bossRetrySnapshot: null,
    mapPulseNodeId: null,
  };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function mergeBattleStats(current: BattleStats, battleStats: BattleStats): BattleStats {
  const merged: BattleStats = Object.fromEntries(
    Object.entries(current).map(([id, stat]) => [id, { ...stat }]),
  );

  Object.entries(battleStats).forEach(([id, stat]) => {
    const target = merged[id] ?? {
      characterId: stat.characterId,
      name: stat.name,
      damageDealt: 0,
      damageTaken: 0,
      shieldBlocked: 0,
      criticalHits: 0,
    };
    target.name = stat.name;
    target.damageDealt += stat.damageDealt;
    target.damageTaken += stat.damageTaken;
    target.shieldBlocked += stat.shieldBlocked ?? 0;
    target.criticalHits += stat.criticalHits;
    merged[id] = target;
  });

  return merged;
}

function maxUpgradeLevel(rarity: Character['rarity'] | CharacterTemplate['rarity']) {
  if (rarity === 'normal') {
    return 3;
  }
  if (rarity === 'star') {
    return 4;
  }
  if (rarity === 'legendary') {
    return 5;
  }
  return 1;
}

function BossBlessingTransition({ team }: { team: Character[] }) {
  const visibleTeam = team.slice(0, 4);

  return (
    <div className="boss-blessing-transition" aria-hidden="true">
      <div className="boss-blessing-aura" />
      <div className="boss-blessing-copy">
        <span>Stage Clear</span>
        <strong>祝福降临</strong>
      </div>
      <div className="boss-blessing-team" style={{ '--blessing-count': Math.max(1, visibleTeam.length) } as CSSProperties}>
        {visibleTeam.map((member, index) => (
          <div
            className={`boss-blessing-member rarity-${member.rarity}`}
            key={member.id}
            style={{ '--member-delay': `${index * 120}ms` } as CSSProperties}
          >
            <Avatar character={member} label={member.name} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneParticles({ variant }: { variant: string }) {
  return (
    <div className={`scene-particles particles-${variant}`} aria-hidden="true">
      {SCENE_PARTICLES.map((particle) => (
        <span key={particle} className="scene-particle" />
      ))}
    </div>
  );
}

function App() {
  const [run, setRun] = useState<RunState>(() => createRun());
  const [musicMuted, setMusicMuted] = useState(false);
  const [shopSelectedOffer, setShopSelectedOffer] = useState<CharacterTemplate | null>(null);
  const [goldPulse, setGoldPulse] = useState(false);
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [bossBlessingTransitioning, setBossBlessingTransitioning] = useState(false);

  const currentNode = useMemo(
    () => run.map.find((node) => node.id === run.currentNodeId) ?? null,
    [run.currentNodeId, run.map],
  );

  const aliveTeam = run.team.filter((member) => !member.injured && member.hp > 0);
  const shopPreviewTeam = useMemo(() => {
    if (run.screen !== 'shop' || !shopSelectedOffer) {
      return run.team;
    }
    return [...run.team, createAlly(shopSelectedOffer)];
  }, [run.screen, run.team, shopSelectedOffer]);
  const audioRefs = useRef<Partial<Record<MusicKey | SfxKey, HTMLAudioElement>>>({});
  const audioUnlockedRef = useRef(false);
  const currentMusicRef = useRef<MusicKey | null>(null);
  const lastVictoryNodeRef = useRef<string | null>(null);
  const lastSfxRef = useRef<{ key: SfxKey; time: number } | null>(null);
  const previousGoldRef = useRef(run.gold);
  const startTransitionTimeoutRef = useRef<number | null>(null);
  const bossBlessingTransitionTimeoutRef = useRef<number | null>(null);

  function getAudio(key: MusicKey | SfxKey, src: string) {
    const existing = audioRefs.current[key];
    if (existing) {
      return existing;
    }

    const audio = new Audio(src);
    audio.preload = 'auto';
    audioRefs.current[key] = audio;
    return audio;
  }

  function playMusic(key: MusicKey) {
    if (musicMuted) {
      (Object.keys(MUSIC_SRC) as MusicKey[]).forEach((musicKey) => {
        getAudio(musicKey, MUSIC_SRC[musicKey]).pause();
      });
      return;
    }

    if (!audioUnlockedRef.current) {
      return;
    }

    (Object.keys(MUSIC_SRC) as MusicKey[]).forEach((musicKey) => {
      const audio = getAudio(musicKey, MUSIC_SRC[musicKey]);
      if (musicKey !== key) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    const audio = getAudio(key, MUSIC_SRC[key]);
    audio.loop = true;
    audio.volume = key === 'battle' ? 0.38 : 0.42;
    if (currentMusicRef.current !== key) {
      audio.currentTime = 0;
      currentMusicRef.current = key;
    }
    void audio.play().catch(() => undefined);
  }

  function playSfx(key: SfxKey) {
    if (musicMuted || !audioUnlockedRef.current) {
      return;
    }

    const now = Date.now();
    if (lastSfxRef.current?.key === key && now - lastSfxRef.current.time < 90) {
      return;
    }
    lastSfxRef.current = { key, time: now };

    const audio = getAudio(key, SFX_SRC[key]);
    audio.loop = false;
    audio.volume = 0.74;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  function unlockAudio() {
    if (audioUnlockedRef.current) {
      return;
    }

    audioUnlockedRef.current = true;
    playMusic(getMusicKey(run));
  }

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  });

  useEffect(() => {
    playMusic(getMusicKey(run));
  }, [run.screen, run.battle?.type, musicMuted]);

  useEffect(() => {
    return () => {
      if (startTransitionTimeoutRef.current !== null) {
        window.clearTimeout(startTransitionTimeoutRef.current);
      }
      if (bossBlessingTransitionTimeoutRef.current !== null) {
        window.clearTimeout(bossBlessingTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (run.screen !== 'shop') {
      setShopSelectedOffer(null);
      return;
    }

    if (shopSelectedOffer && !run.shopOffers.some((offer) => offer.id === shopSelectedOffer.id)) {
      setShopSelectedOffer(null);
    }
  }, [run.screen, run.shopOffers, shopSelectedOffer]);

  useEffect(() => {
    if (previousGoldRef.current === run.gold) {
      return;
    }

    previousGoldRef.current = run.gold;
    setGoldPulse(true);
    const timer = window.setTimeout(() => setGoldPulse(false), 620);
    return () => window.clearTimeout(timer);
  }, [run.gold]);

  function toggleMusic() {
    unlockAudio();
    setMusicMuted((muted) => !muted);
  }

  function handleShellPointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const button = target?.closest('button');
    if (!button || button.disabled || button.classList.contains('map-node')) {
      return;
    }

    playSfx('next');
  }

  useEffect(() => {
    if (run.screen === 'battle' && run.battle?.phase === 'won') {
      if (lastVictoryNodeRef.current !== run.battle.nodeId) {
        lastVictoryNodeRef.current = run.battle.nodeId;
        playSfx('battleVictory');
      }
      return;
    }

    if (run.battle?.phase !== 'won') {
      lastVictoryNodeRef.current = null;
    }
  }, [run.screen, run.battle?.phase, run.battle?.nodeId]);


  function resetRun() {
    if (startTransitionTimeoutRef.current !== null) {
      window.clearTimeout(startTransitionTimeoutRef.current);
      startTransitionTimeoutRef.current = null;
    }
    if (bossBlessingTransitionTimeoutRef.current !== null) {
      window.clearTimeout(bossBlessingTransitionTimeoutRef.current);
      bossBlessingTransitionTimeoutRef.current = null;
    }
    setStartTransitioning(false);
    setBossBlessingTransitioning(false);
    setRun(createRun());
  }

  function startGame() {
    if (startTransitioning) {
      return;
    }

    playSfx('next');
    setStartTransitioning(true);
    startTransitionTimeoutRef.current = window.setTimeout(() => {
      startTransitionTimeoutRef.current = null;
      setStartTransitioning(false);
      setRun({
        ...createRun(),
        screen: 'draft',
        candidates: createDraftCandidates(),
        draftSelection: [],
      });
    }, START_TRANSITION_MS);
  }

  function rerollDraft() {
    setRun((previous) => ({
      ...previous,
      candidates: createDraftCandidates(),
      draftSelection: [],
    }));
  }

  function toggleDraft(id: string) {
    setRun((previous) => {
      const hasSelected = previous.draftSelection.includes(id);
      const draftSelection = hasSelected
        ? previous.draftSelection.filter((selectedId) => selectedId !== id)
        : previous.draftSelection.length < 2
          ? [...previous.draftSelection, id]
          : previous.draftSelection;

      return { ...previous, draftSelection };
    });
  }

  function confirmDraft() {
    if (run.draftSelection.length === 2) {
      playSfx('next');
    }

    setRun((previous) => {
      if (previous.draftSelection.length !== 2) {
        return previous;
      }

      const team = previous.draftSelection
        .map((id) => CHARACTER_POOL.find((character) => character.id === id))
        .filter((character): character is CharacterTemplate => Boolean(character))
        .map(createAlly);

      return { ...previous, team, screen: 'map', eventLog: ['巡演开始。'] };
    });
  }

  function enterNode(node: MapNode) {
    if (!node.available || node.completed) {
      return;
    }

    playSfx('mapSelect');

    setRun((previous) => {
      if (!node.available || node.completed) {
        return previous;
      }

      if (isBattleNode(node.type)) {
        const aliveCount = previous.team.filter((member) => !member.injured && member.hp > 0).length;
        if (aliveCount === 0) {
          return { ...previous, screen: 'loss' };
        }

        const battleType: BattleType = node.type;
        const slots = getBattleSlots(battleType, aliveCount);
        const enemies = createEnemiesForBattle(battleType, previous.boss);
        const battle: BattleState = {
          nodeId: node.id,
          type: battleType,
          enemies,
          activeEnemyIndex: 0,
          selectedIds: [],
          slots,
          phase: 'select',
          rewardGold: getRewardGold(battleType, enemies),
          log: [`遭遇${NODE_LABELS[battleType]}。先确认敌人，再选择${slots}名出战伙伴。`],
          events: [],
          runtime: {},
          stats: {},
        };

        return {
          ...previous,
          screen: 'battle',
          currentNodeId: node.id,
          mapPulseNodeId: null,
          battle,
          result: null,
          restHealUsed: false,
          restReviveUsed: false,
          bossRetrySnapshot: battleType === 'boss' ? { team: previous.team.map((member) => ({ ...member })), battle: { ...battle, enemies: battle.enemies.map((enemy) => ({ ...enemy })) } } : null,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      if (node.type === 'shop') {
        const ownedIds = new Set(previous.team.map((member) => member.templateId));
        const shopOffers = createShopOffers(previous.boss.bossTier, ownedIds);

        return {
          ...previous,
          screen: 'shop',
          currentNodeId: node.id,
          mapPulseNodeId: null,
          shopOffers,
          result: null,
          restHealUsed: false,
          restReviveUsed: false,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      return {
        ...previous,
        screen: 'rest',
        currentNodeId: node.id,
        mapPulseNodeId: null,
        result: null,
        restHealUsed: false,
        restReviveUsed: false,
        eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
      };
    });
  }

  function advanceAfterCurrentNode(previous: RunState, teamInput = previous.team): RunState {
    if (!previous.currentNodeId) {
      return { ...previous, screen: 'map', pendingEnhance: null, enhanceReady: false, pendingBossVictory: false };
    }

    const team = applyPostNodePassives(teamInput);
    const clearedNodeMap = completeMapNode(previous.map, previous.currentNodeId);
    const completedNode = previous.map.find((node) => node.id === previous.currentNodeId);
    const completionLog = [
      ...(completedNode ? [`完成${NODE_LABELS[completedNode.type]}节点。`] : []),
      ...(previous.battle?.log ?? []),
    ];
    const shouldAdvanceLayer =
      previous.battle?.type === 'boss' &&
      previous.battle.phase === 'won' &&
      previous.boss.bossTier < 3;

    if (shouldAdvanceLayer) {
      const nextTier = (previous.boss.bossTier + 1) as BossTier;
      return {
        ...previous,
        screen: 'blessing',
        mapPulseNodeId: null,
        team: applyLayerBlessing(team),
        map: buildMap(),
        currentNodeId: null,
        battle: null,
        boss: getRandomBossForTier(nextTier),
        result: null,
        shopOffers: [],
        restHealUsed: false,
        restReviveUsed: false,
        pendingEnhance: null,
        enhanceReady: false,
        pendingBossVictory: false,
        bossRetrySnapshot: null,
        eventLog: [...previous.eventLog, ...completionLog, `进入第${nextTier}层。`],
      };
    }

    return {
      ...previous,
      screen: 'map',
      team,
      map: clearedNodeMap,
      currentNodeId: null,
      mapPulseNodeId: previous.currentNodeId,
      battle: null,
      result: null,
      shopOffers: [],
      restHealUsed: false,
      restReviveUsed: false,
      pendingEnhance: null,
      enhanceReady: false,
      pendingBossVictory: false,
      bossRetrySnapshot: null,
      eventLog: [...previous.eventLog, ...completionLog],
    };
  }
  function finishCurrentNode() {
    setRun((previous) => advanceAfterCurrentNode(previous));
  }

  function closeBattleStatsModal() {
    setRun((previous) => ({
      ...previous,
      battleStatsOpen: false,
      enhanceReady: false,
    }));
  }

  function openPendingEnhancement() {
    setRun((previous) => {
      if (!previous.pendingEnhance || previous.battle?.phase !== 'won') {
        return previous;
      }

      return {
        ...previous,
        battleStatsOpen: false,
        enhanceReady: true,
      };
    });
  }

  function retryBossBattle() {
    setRun((previous) => {
      if (!previous.bossRetrySnapshot || previous.battle?.type !== 'boss' || previous.battle.phase !== 'lost') {
        return previous;
      }

      const snapshot = previous.bossRetrySnapshot;
      return {
        ...previous,
        screen: 'battle',
        team: snapshot.team.map((member) => ({ ...member })),
        battle: {
          ...snapshot.battle,
          enemies: snapshot.battle.enemies.map((enemy) => ({ ...enemy })),
          selectedIds: [],
          phase: 'select',
          runtime: {},
          stats: {},
        },
        result: null,
        battleStatsOpen: false,
        pendingEnhance: null,
        enhanceReady: false,
        pendingBossVictory: false,
        eventLog: [...previous.eventLog, '重开Boss战。'],
      };
    });
  }

  function continueFromBlessing() {
    setRun((previous) => ({
      ...previous,
      screen: 'map',
    }));
  }

  function toggleBattleSelection(id: string) {
    setRun((previous) => {
      if (
        !previous.battle ||
        (previous.battle.phase !== 'select' && previous.battle.phase !== 'relay')
      ) {
        return previous;
      }

      const alreadySelected = previous.battle.selectedIds.includes(id);
      const selectedIds = alreadySelected
        ? previous.battle.selectedIds.filter((selectedId) => selectedId !== id)
        : previous.battle.selectedIds.length < previous.battle.slots
          ? [...previous.battle.selectedIds, id]
          : [...previous.battle.selectedIds.slice(0, -1), id];

      return {
        ...previous,
        battle: { ...previous.battle, selectedIds },
      };
    });
  }

  function startBattle() {
    setRun((previous) => {
      if (
        !previous.battle ||
        (previous.battle.phase !== 'select' && previous.battle.phase !== 'relay') ||
        previous.battle.selectedIds.length !== previous.battle.slots
      ) {
        return previous;
      }

      const { team, battle } = resolveBattleGroup(
        previous.team,
        previous.battle,
        previous.battle.selectedIds,
      );

      if (battle.phase === 'won') {
        const runStats = mergeBattleStats(previous.runStats, battle.stats);
        const isBossBattle = battle.type === 'boss';
        const isFinalBoss = isBossBattle && previous.boss.bossTier === 3;
        const canEnhance = battle.type === 'elite' || (isBossBattle && !isFinalBoss);
        const result: ResultState = {
          title: isBossBattle ? `第${previous.boss.bossTier}层 Boss胜利` : `${NODE_LABELS[battle.type]}胜利`,
          body: isBossBattle
            ? isFinalBoss
              ? '最终Boss被击败，三层巡演路线完成。'
              : `第${previous.boss.bossTier}层Boss被击败，即将进入第${previous.boss.bossTier + 1}层。`
            : '保留当前生命值，继续规划下一段路线。',
          rewardGold: battle.rewardGold,
        };

        return {
          ...previous,
          team,
          gold: previous.gold + battle.rewardGold,
          battle,
          result,
          runStats,
          battleStatsOpen: false,
          screen: isFinalBoss ? 'win' : 'battle',
          pendingEnhance: canEnhance
            ? { source: battle.type === 'boss' ? 'boss' : 'elite', cost: battle.type === 'boss' ? 0 : ENHANCE_COST, free: battle.type === 'boss' }
            : null,
          enhanceReady: false,
        };
      }

      if (battle.phase === 'lost') {
        return {
          ...previous,
          team,
          battle,
          battleStatsOpen: true,
          enhanceReady: false,
          screen: 'loss',
        };
      }

      return {
        ...previous,
        team,
        battle,
        screen: 'battle',
      };
    });
  }

  function completeEnhancement(id: string | null) {
    setRun((previous) => {
      if (!previous.pendingEnhance) {
        return previous;
      }

      const source = previous.pendingEnhance.source;
      let nextGold = previous.gold;
      let nextTeam = previous.team;

      if (id) {
        const target = previous.team.find((member) => member.id === id);
        const cost = previous.pendingEnhance.cost;
        if (!target || (target.upgradeLevel ?? 1) >= maxUpgradeLevel(target.rarity) || (!previous.pendingEnhance.free && previous.gold < cost)) {
          return previous;
        }

        nextGold = previous.pendingEnhance.free ? previous.gold : previous.gold - cost;
        nextTeam = previous.team.map((member) => {
          if (member.id !== id) {
            return member;
          }

          const currentLevel = member.upgradeLevel ?? 1;
          const nextLevel = Math.min(maxUpgradeLevel(member.rarity), currentLevel + 1) as Character['upgradeLevel'];
          const renHpBonus = member.templateId === 'ren' && currentLevel === 1 && nextLevel >= 2 ? 20 : 0;
          const renAttackBonus = member.templateId === 'ren' && currentLevel === 2 && nextLevel >= 3 ? 5 : 0;
          return {
            ...member,
            upgradeLevel: nextLevel,
            maxHp: member.maxHp + renHpBonus,
            hp: member.hp + renHpBonus,
            attack: member.attack + renAttackBonus,
          };
        });
      }

      const nextState = { ...previous, gold: nextGold, team: nextTeam, pendingEnhance: null, enhanceReady: false };
      if (source === 'boss') {
        return { ...nextState, screen: 'battle', pendingBossVictory: true };
      }

      return { ...nextState, screen: 'battle' };
    });
  }

  function dismissEnhancement() {
    setRun((previous) => {
      if (!previous.pendingEnhance) {
        return previous;
      }

      const nextState = { ...previous, pendingEnhance: null, enhanceReady: false };
      if (previous.pendingEnhance.source === 'boss') {
        return { ...nextState, screen: 'battle', pendingBossVictory: true };
      }

      return advanceAfterCurrentNode(nextState);
    });
  }

  function dismissBossVictory() {
    setRun((previous) => ({ ...previous, pendingBossVictory: false }));
  }

  function enterBossBlessing() {
    if (bossBlessingTransitioning) {
      return;
    }

    playSfx('next');
    setBossBlessingTransitioning(true);
    setRun((previous) => ({ ...previous, pendingBossVictory: false }));
    bossBlessingTransitionTimeoutRef.current = window.setTimeout(() => {
      bossBlessingTransitionTimeoutRef.current = null;
      setBossBlessingTransitioning(false);
      setRun((previous) => advanceAfterCurrentNode(previous));
    }, BOSS_BLESSING_TRANSITION_MS);
  }

  function handleBattleReplayDone() {
    setRun((previous) => {
      if (previous.screen !== 'battle' || !previous.battle || previous.battleStatsOpen) {
        return previous;
      }

      if (previous.battle.phase !== 'won') {
        return previous;
      }

      return { ...previous, battleStatsOpen: true };
    });
  }

  function buyCharacter(template: CharacterTemplate) {
    let didBuy = false;

    setRun((previous) => {
      const offerStillAvailable = previous.shopOffers.some((offer) => offer.id === template.id);
      const alreadyOwned = previous.team.some((member) => member.templateId === template.id);
      if (previous.screen !== 'shop' || !offerStillAvailable || alreadyOwned || previous.team.length >= 4 || previous.gold < template.price) {
        return previous;
      }

      didBuy = true;
      return {
        ...previous,
        gold: previous.gold - template.price,
        team: [...previous.team, createAlly(template)],
        shopOffers: previous.shopOffers.filter((offer) => offer.id !== template.id),
      };
    });

    if (didBuy) {
      playSfx('buy');
    }
  }

  function healCharacter(id: string, healType: HealType) {
    setRun((previous) => {
      const heal = HEAL_OPTIONS[healType];
      const healAmount = heal.full ? Number.MAX_SAFE_INTEGER : heal.amount;
      const member = previous.team.find((character) => character.id === id);
      if (
        previous.restHealUsed ||
        !member ||
        member.injured ||
        member.hp >= member.maxHp ||
        previous.gold < heal.cost
      ) {
        return previous;
      }

      return {
        ...previous,
        gold: previous.gold - heal.cost,
        restHealUsed: true,
        team: previous.team.map((character) =>
          character.id === id
            ? { ...character, hp: Math.min(character.maxHp, character.hp + healAmount) }
            : character,
        ),
      };
    });
  }

  function reviveCharacter(id: string) {
    setRun((previous) => {
      const member = previous.team.find((character) => character.id === id);
      if (previous.restReviveUsed || !member || !member.injured || previous.gold < REVIVE_COST) {
        return previous;
      }

      return {
        ...previous,
        gold: previous.gold - REVIVE_COST,
        restReviveUsed: true,
        team: previous.team.map((character) =>
          character.id === id
            ? {
                ...character,
                injured: false,
                hp: Math.max(1, Math.ceil(character.maxHp * REVIVE_HP_RATIO)),
              }
            : character,
        ),
      };
    });
  }

  if (run.screen === 'start') {
    return (
      <div className={`app-shell start-shell scene-home ${startTransitioning ? 'is-entering' : ''}`}>
        <div className="sakura-layer" aria-hidden="true">
          {SAKURA_PETALS.map((petal) => (
            <span key={petal} className="sakura-petal" />
          ))}
        </div>
        {startTransitioning && <div className="start-transition-flash" aria-hidden="true" />}
        <MusicToggleButton muted={musicMuted} onToggle={toggleMusic} className="floating-music-toggle" />
        <StartScreen onStart={startGame} />
      </div>
    );
  }

  if (run.screen === 'draft') {
    return (
      <div className="app-shell draft-shell scene-draft-shop">
        <SceneParticles variant="draft-shop" />
        <MusicToggleButton muted={musicMuted} onToggle={toggleMusic} className="floating-music-toggle" />
        <DraftScreen
          candidates={run.candidates}
          selectedIds={run.draftSelection}
          onToggle={toggleDraft}
          onReroll={rerollDraft}
          onConfirm={confirmDraft}
        />
      </div>
    );
  }

  const sceneClass = run.screen === 'battle' && run.battle
    ? `scene-battle-${run.battle.type}`
    : run.screen === 'shop'
      ? 'scene-draft-shop'
      : run.screen === 'map'
        ? 'scene-map'
        : run.screen === 'rest' || run.screen === 'blessing'
          ? 'scene-rest-blessing'
          : 'scene-home';
  const particleVariant = run.screen === 'battle' && run.battle
    ? run.battle.type === 'elite'
      ? 'battle-elite'
      : run.battle.type === 'boss'
        ? 'battle-boss'
        : 'battle-normal'
    : run.screen === 'shop'
      ? 'draft-shop'
      : run.screen === 'map'
        ? 'map'
        : run.screen === 'rest'
          ? 'rest'
          : run.screen === 'blessing'
            ? 'blessing'
            : null;

  return (
    <div className={`app-shell game-shell ${sceneClass} ${run.screen === 'map' ? 'map-hud-shell' : ''} ${run.screen === 'battle' ? 'battle-shell' : ''} ${run.screen === 'shop' ? 'shop-shell' : ''}`} onPointerDownCapture={handleShellPointerDown}>
      {particleVariant && <SceneParticles variant={particleVariant} />}
      <MusicToggleButton muted={musicMuted} onToggle={toggleMusic} className="floating-music-toggle" />
      {run.screen !== 'shop' && (
        <header className="topbar">
          <div>
            <p className="eyebrow">非商用个人 Beta</p>
            <h1>DreamStage</h1>
          </div>
          <div className="run-stats" aria-label="当前资源">
            <span className={goldPulse ? 'resource-pulse' : ''}>金币 {run.gold}</span>
            <span>伙伴 {run.team.length}</span>
            <span>可出战 {aliveTeam.length}</span>
          </div>
        </header>
      )}

      <main className="main-layout">
        <CompactRunSidePanel team={shopPreviewTeam} onRestart={resetRun} />

        <section className="screen-panel">
          {run.screen === 'map' && <MapScreen nodes={run.map} boss={run.boss} team={run.team} stats={run.runStats} gold={run.gold} musicMuted={musicMuted} onToggleMusic={toggleMusic} onEnter={enterNode} onOpenStats={() => setRun((previous) => ({ ...previous, statsOpen: true }))} eventLog={run.eventLog} onRestart={resetRun} pulseNodeId={run.mapPulseNodeId} />}

          {run.screen === 'battle' && run.battle && (
            <BattleScreen
              battle={run.battle}              boss={run.boss}
              gold={run.gold}
              team={run.team}
              pendingEnhance={run.enhanceReady ? run.pendingEnhance : null}
              pendingBossVictory={run.pendingBossVictory}
              onContinue={finishCurrentNode}
              onToggleSelection={toggleBattleSelection}              onStart={startBattle}
              onEnhance={completeEnhancement}
              onDismissEnhancement={dismissEnhancement}
              onBossBack={dismissBossVictory}
              onBossBlessing={enterBossBlessing}
              onReplayDone={handleBattleReplayDone}
              hasPendingEnhance={Boolean(run.pendingEnhance && run.battle.phase === 'won')}
              onOpenEnhancement={openPendingEnhancement}
            />
          )}

          {run.screen === 'result' && run.result && run.battle && (
            <ResultScreen result={run.result} log={run.battle.log} stats={run.battle.stats} team={run.team} onContinue={finishCurrentNode} />
          )}

          {run.screen === 'shop' && (
            <ShopScreen
              gold={run.gold}
              offers={run.shopOffers}
              selectedOffer={shopSelectedOffer}
              onSelectOffer={setShopSelectedOffer}
              onBuy={buyCharacter}
              onLeave={finishCurrentNode}
            />
          )}

          {run.screen === 'rest' && (
            <RestScreen
              gold={run.gold}
              team={run.team}
              healUsed={run.restHealUsed}
              reviveUsed={run.restReviveUsed}
              onHeal={healCharacter}
              onRevive={reviveCharacter}
              onLeave={finishCurrentNode}
            />
          )}

          {run.screen === 'blessing' && (
            <BlessingScreen team={run.team} tier={run.boss.bossTier} onContinue={continueFromBlessing} />
          )}

          {run.screen === 'win' && run.battle && (
            <EndScreen
              title="胜利"
              body="Boss战完成，Beta角色构筑循环已经跑通。"
              log={run.battle.log}
              stats={run.battle.stats}
              team={run.team}
              onRestart={resetRun}
            />
          )}

          {run.screen === 'loss' && (
            <EndScreen
              title="失败"
              body="所有伙伴都进入重伤状态。下一局可以更早休息或招募。"
              log={run.battle?.log ?? []}
              enemies={run.battle?.enemies ?? []}
              stats={run.battle?.stats}
              team={run.team}
              onRetryBattle={run.battle?.type === 'boss' && run.bossRetrySnapshot ? retryBossBattle : undefined}
              onRestart={resetRun}
            />
          )}
        </section>
      </main>

      {bossBlessingTransitioning && <BossBlessingTransition team={run.team} />}

      {run.battleStatsOpen && run.battle && (
        <BattleResultModal
          phase={run.battle.phase}
          stats={run.battle.stats}
          team={run.team}
          primaryLabel={run.pendingEnhance && run.battle.phase === 'won' ? '开启强化' : '返回'}
          onClose={closeBattleStatsModal}
          onPrimary={run.pendingEnhance && run.battle.phase === 'won' ? openPendingEnhancement : undefined}
        />
      )}
      {run.statsOpen && (
        <RunStatsModal
          stats={run.runStats}
          team={run.team}
          onClose={() => setRun((previous) => ({ ...previous, statsOpen: false }))}
        />
      )}

      {currentNode && (
        <footer className="context-bar">
          当前层：第 {run.boss.bossTier} 层 · 当前节点：{NODE_LABELS[currentNode.type]} · 路线第 {currentNode.row + 1} 排
        </footer>
      )}
    </div>
  );
}

export default App;
