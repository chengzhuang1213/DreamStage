import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  NODE_LABELS,
  CHARACTER_POOL,
  applyPostNodePassives,
  type BattleStats,
  type BattleState,
  type BattleType,
  type BossTier,
  type Character,
  type CharacterTemplate,
  type MapNode,
  buildMap,
  completeMapNode,
  createAlly,
  createDraftCandidates,
  createShopOffers,
  getBattleSlots,
  getRandomBossForTier,
  getRewardGold,
  isBattleNode,
  resolveBattleGroup,
  withBattleRandom,
} from './game';
import { MUSIC_SRC, SFX_SRC, type MusicKey, type SfxKey } from './assets';
import { MusicToggleButton } from './components/common';
import { BattleResultModal, RunStatsModal } from './components/battleLog';
import { BattleScreen } from './pages/BattleScreen';
import { BlessingScreen } from './pages/BlessingScreen';
import { MapScreen } from './pages/MapScreen';
import { RestScreen } from './pages/RestScreen';
import { QuestionScreen } from './pages/QuestionScreen';
import { EndScreen, ResultScreen } from './pages/ResultScreens';
import { ShopScreen } from './pages/ShopScreen';
import { StartScreen } from './pages/StartScreen';
import { DraftScreen } from './pages/DraftScreen';
import { TeamScene } from './pages/TeamScene';
import {
  BOSS_BLESSING_TRANSITION_MS,
  BossBlessingTransition,
  START_TRANSITION_MS,
  SakuraLayer,
} from './components/sceneEffects';
import { getQuestionEvent } from './questionEvents';
import { createRun } from './run/createRun';
import { createUniqueEnemiesForBattle } from './run/encounters';
import { canUseMysteryGacha, pickQuestionEvent, resolveQuestionEventState } from './run/questionResolution';
import type { HealType, ResultState, RunState } from './run/types';
import { maxUpgradeLevel, upgradeCharacterOneLevel } from './game/upgrades';
import { createSeedRng } from './rng';

const DISABLED_CLICK_SFX = new Set<SfxKey>(['next', 'mapSelect', 'buy']);
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

function getViewportScale() {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.min(1, window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
}

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
  if (run.screen === 'team' || run.screen === 'map') {
    return 'map';
  }
  return 'home';
}

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

function App() {
  const [run, setRun] = useState<RunState>(() => createRun());
  const [viewportScale, setViewportScale] = useState(getViewportScale);
  const [musicMuted, setMusicMuted] = useState(true);
  const [shopSelectedOffer, setShopSelectedOffer] = useState<CharacterTemplate | null>(null);
  const [goldPulse, setGoldPulse] = useState(false);
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [bossBlessingTransitioning, setBossBlessingTransitioning] = useState(false);
  const [sceneTransitioning, setSceneTransitioning] = useState(false);

  const currentNode = useMemo(
    () => run.map.find((node) => node.id === run.currentNodeId) ?? null,
    [run.currentNodeId, run.map],
  );

  const currentQuestionEvent = getQuestionEvent(run.questionEventId);
  const audioRefs = useRef<Partial<Record<MusicKey | SfxKey, HTMLAudioElement>>>({});
  const audioUnlockedRef = useRef(false);
  const currentMusicRef = useRef<MusicKey | null>(null);
  const currentMusicKeyRef = useRef<MusicKey>(getMusicKey(run));
  const lastVictoryNodeRef = useRef<string | null>(null);
  const lastSfxRef = useRef<{ key: SfxKey; time: number } | null>(null);
  const previousGoldRef = useRef(run.gold);
  const startTransitionTimeoutRef = useRef<number | null>(null);
  const bossBlessingTransitionTimeoutRef = useRef<number | null>(null);
  const previousScreenRef = useRef(run.screen);
  const sceneTransitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const updateViewportScale = () => {
      setViewportScale(getViewportScale());
    };

    updateViewportScale();
    window.addEventListener('resize', updateViewportScale);
    return () => window.removeEventListener('resize', updateViewportScale);
  }, []);

  function getAudio(key: MusicKey | SfxKey, src: string, preload: HTMLMediaElement['preload'] = 'metadata') {
    const existing = audioRefs.current[key];
    if (existing) {
      return existing;
    }

    const audio = new Audio(src);
    audio.preload = preload;
    audioRefs.current[key] = audio;
    return audio;
  }

  const pauseLoadedMusic = useCallback(() => {
    (Object.keys(MUSIC_SRC) as MusicKey[]).forEach((musicKey) => {
      const audio = audioRefs.current[musicKey];
      if (!audio) {
        return;
      }
      audio.pause();
      audio.currentTime = 0;
    });
    currentMusicRef.current = null;
  }, []);

  const playMusic = useCallback((key: MusicKey) => {
    if (musicMuted) {
      pauseLoadedMusic();
      return;
    }

    if (!audioUnlockedRef.current) {
      return;
    }

    if (currentMusicRef.current && currentMusicRef.current !== key) {
      const previousAudio = audioRefs.current[currentMusicRef.current];
      previousAudio?.pause();
      if (previousAudio) {
        previousAudio.currentTime = 0;
      }
    }

    const audio = getAudio(key, MUSIC_SRC[key], 'metadata');
    audio.loop = true;
    audio.volume = key === 'battle' ? 0.38 : 0.42;
    if (currentMusicRef.current !== key) {
      audio.currentTime = 0;
      currentMusicRef.current = key;
    }
    void audio.play().catch(() => undefined);
  }, [musicMuted, pauseLoadedMusic]);

  function playSfx(key: SfxKey) {
    if (DISABLED_CLICK_SFX.has(key)) {
      return;
    }

    if (musicMuted || !audioUnlockedRef.current) {
      return;
    }

    const now = Date.now();
    if (lastSfxRef.current?.key === key && now - lastSfxRef.current.time < 90) {
      return;
    }
    lastSfxRef.current = { key, time: now };

    const audio = getAudio(key, SFX_SRC[key], 'none');
    audio.loop = false;
    audio.volume = 0.74;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) {
      return;
    }

    audioUnlockedRef.current = true;
    playMusic(currentMusicKeyRef.current);
  }, [playMusic]);

  useEffect(() => {
    currentMusicKeyRef.current = getMusicKey(run);
  }, [run]);

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [unlockAudio]);

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
      if (sceneTransitionTimeoutRef.current !== null) {
        window.clearTimeout(sceneTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousScreenRef.current === run.screen) {
      return;
    }

    previousScreenRef.current = run.screen;
    setSceneTransitioning(true);
    if (sceneTransitionTimeoutRef.current !== null) {
      window.clearTimeout(sceneTransitionTimeoutRef.current);
    }
    sceneTransitionTimeoutRef.current = window.setTimeout(() => {
      sceneTransitionTimeoutRef.current = null;
      setSceneTransitioning(false);
    }, 420);
  }, [run.screen]);

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
    if (sceneTransitionTimeoutRef.current !== null) {
      window.clearTimeout(sceneTransitionTimeoutRef.current);
      sceneTransitionTimeoutRef.current = null;
    }
    setStartTransitioning(false);
    setBossBlessingTransitioning(false);
    setSceneTransitioning(false);
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
      const nextRun = createRun();
      setRun({
        ...nextRun,
        screen: 'draft',
        draftSelection: [],
      });
    }, START_TRANSITION_MS);
  }

  function rerollDraft() {
    setRun((previous) => {
      const rng = createSeedRng(previous.rngState);
      return {
        ...previous,
        candidates: createDraftCandidates(rng),
        draftSelection: [],
        rngState: rng.state,
      };
    });
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
      const rng = createSeedRng(previous.rngState);

      if (isBattleNode(node.type)) {
        const aliveCount = previous.team.filter((member) => !member.injured && member.hp > 0).length;
        if (aliveCount === 0) {
          return { ...previous, screen: 'loss' };
        }

        const battleType: BattleType = node.type;
        const slots = getBattleSlots(battleType, aliveCount);
        const enemyAttackBonus = previous.nextEnemyAttackBonus;
        const encounter = createUniqueEnemiesForBattle(previous, battleType, rng);
        const enemies = encounter.enemies.map((enemy) =>
          enemyAttackBonus > 0 ? { ...enemy, attack: enemy.attack + enemyAttackBonus } : enemy,
        );
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
        if (enemyAttackBonus > 0) {
          battle.log.push(`偶像直播风险触发，本场敌人攻击+${enemyAttackBonus}。`);
        }

        return {
          ...previous,
          screen: 'battle',
          currentNodeId: node.id,
          mapPulseNodeId: null,
          battle,
          result: null,
          battleStatsOpen: false,
          restHealUsed: false,
          restReviveUsed: false,
          nextEnemyAttackBonus: 0,
          rngState: rng.state,
          seenEnemyTemplateIds: encounter.seenEnemyTemplateIds,
          seenEliteTemplateIds: encounter.seenEliteTemplateIds,
          bossRetrySnapshot: battleType === 'boss' ? { team: previous.team.map((member) => ({ ...member })), battle: { ...battle, enemies: battle.enemies.map((enemy) => ({ ...enemy })) } } : null,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      if (node.type === 'shop') {
        const ownedIds = new Set(previous.team.map((member) => member.templateId));
        const shopOffers = createShopOffers(previous.boss.bossTier, ownedIds, rng);

        return {
          ...previous,
          screen: 'shop',
          currentNodeId: node.id,
          mapPulseNodeId: null,
          shopOffers,
          result: null,
          battleStatsOpen: false,
          restHealUsed: false,
          restReviveUsed: false,
          rngState: rng.state,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      if (node.type === 'rest') {
        return {
          ...previous,
          screen: 'rest',
          currentNodeId: node.id,
          mapPulseNodeId: null,
          result: null,
          battleStatsOpen: false,
          restHealUsed: false,
          restReviveUsed: false,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      if (node.type === 'question') {
        const event = pickQuestionEvent(previous, rng);
        return {
          ...previous,
          screen: 'question',
          map: previous.map,
          currentNodeId: node.id,
          mapPulseNodeId: null,
          questionEventId: event.id,
          result: null,
          battleStatsOpen: false,
          rngState: rng.state,
          restHealUsed: false,
          restReviveUsed: false,
          eventLog: [...previous.eventLog, `进入机遇节点：${event.title}。`],
        };
      }

      return previous;
    });
  }

  function advanceAfterCurrentNode(previous: RunState, teamInput = previous.team): RunState {
    if (!previous.currentNodeId) {
      return { ...previous, screen: 'map', pendingEnhance: null, enhanceReady: false, pendingBossVictory: false, questionEventId: null };
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
      const rng = createSeedRng(previous.rngState);
      return {
        ...previous,
        screen: 'blessing',
        mapPulseNodeId: null,
        team: applyLayerBlessing(team),
        map: buildMap(rng),
        currentNodeId: null,
        battle: null,
        boss: getRandomBossForTier(nextTier, rng),
        rngState: rng.state,
        result: null,
        shopOffers: [],
        battleStatsOpen: false,
        restHealUsed: false,
        restReviveUsed: false,
        pendingEnhance: null,
        enhanceReady: false,
        pendingBossVictory: false,
        questionEventId: null,
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
      battleStatsOpen: false,
      restHealUsed: false,
      restReviveUsed: false,
      pendingEnhance: null,
      enhanceReady: false,
      pendingBossVictory: false,
      questionEventId: null,
      bossRetrySnapshot: null,
      eventLog: [...previous.eventLog, ...completionLog],
    };
  }
  function finishCurrentNode() {
    setRun((previous) => advanceAfterCurrentNode(previous));
  }

  function finishCurrentNodeToMap() {
    setRun((previous) => ({
      ...advanceAfterCurrentNode(previous),
      screen: 'map',
    }));
  }

  function openMapScene() {
    setRun((previous) => (previous.screen === 'team' ? { ...previous, screen: 'map' } : previous));
  }

  function openTeamScene() {
    setRun((previous) => (previous.screen === 'map' ? { ...previous, screen: 'team' } : previous));
  }

  function resolveQuestionEvent(optionId: string, targetId?: string) {
    setRun((previous) => resolveQuestionEventState(previous, optionId, targetId, advanceAfterCurrentNode));
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

      const rng = createSeedRng(previous.rngState);
      const { team, battle } = withBattleRandom(
        () => rng.next(),
        () => resolveBattleGroup(
          previous.team,
          previous.battle!,
          previous.battle!.selectedIds,
        ),
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
          rngState: rng.state,
          battleStatsOpen: false,
          screen: 'battle',
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
          rngState: rng.state,
          battleStatsOpen: false,
          enhanceReady: false,
          screen: 'battle',
        };
      }

      return {
        ...previous,
        team,
        battle,
        rngState: rng.state,
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
        nextTeam = previous.team.map((member) => (member.id === id ? upgradeCharacterOneLevel(member) : member));
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

      if (previous.battle.phase === 'lost') {
        return { ...previous, screen: 'loss', battleStatsOpen: true };
      }

      if (previous.battle.phase !== 'won') {
        return previous;
      }

      if (previous.battle.type === 'boss' && previous.boss.bossTier === 3) {
        return { ...previous, screen: 'win', battleStatsOpen: false };
      }

      return { ...previous, battleStatsOpen: true };
    });
  }

  function buyCharacter(template: CharacterTemplate, replaceMemberId?: string) {
    let didBuy = false;

    setRun((previous) => {
      const offerStillAvailable = previous.shopOffers.some((offer) => offer.id === template.id);
      const alreadyOwned = previous.team.some((member) => member.templateId === template.id);
      const needsReplacement = previous.team.length >= 4;
      if (
        previous.screen !== 'shop' ||
        !offerStillAvailable ||
        alreadyOwned ||
        previous.gold < template.price ||
        (needsReplacement && !replaceMemberId)
      ) {
        return previous;
      }
      if (needsReplacement && !previous.team.some((member) => member.id === replaceMemberId)) {
        return previous;
      }

      const nextMember = createAlly(template);
      const nextTeam = needsReplacement
        ? previous.team.map((member) => (member.id === replaceMemberId ? nextMember : member))
        : [...previous.team, nextMember];

      didBuy = true;
      return {
        ...previous,
        gold: previous.gold - template.price,
        team: nextTeam,
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

  const viewportSceneClass = run.screen === 'start'
    ? 'scene-home'
    : run.screen === 'draft' || run.screen === 'shop'
      ? 'scene-draft-shop'
      : run.screen === 'battle' && run.battle
        ? `scene-battle-${run.battle.type}`
        : run.screen === 'rest' || run.screen === 'question' || run.screen === 'blessing'
          ? 'scene-rest-blessing'
          : run.screen === 'team'
            ? 'scene-team'
            : 'scene-map';
  const hasMapScene = run.screen === 'map';
  const hasOverlay = false;

  return (
    <div
      className={`game-viewport ${viewportSceneClass}`}
      style={{ '--viewport-scale': viewportScale } as CSSProperties}
      onPointerDownCapture={handleShellPointerDown}
    >
      <MusicToggleButton muted={musicMuted} onToggle={toggleMusic} className="floating-music-toggle" />

      <div className="game-scene" key={run.screen}>
        {run.screen === 'start' && (
          <div className={`viewport-shell home-scene-shell start-shell ${startTransitioning ? 'is-entering' : ''}`}>
            <SakuraLayer />
            {startTransitioning && <div className="start-transition-flash" aria-hidden="true" />}
            <StartScreen onStart={startGame} />
          </div>
        )}

        {run.screen === 'team' && (
          <div className="viewport-shell team-scene-shell">
            <TeamScene
              team={run.team}
              gold={run.gold}
              boss={run.boss}
              nodes={run.map}
              runSeed={run.runSeed}
              onOpenMap={openMapScene}
              onOpenStats={() => setRun((previous) => ({ ...previous, statsOpen: true }))}
              onRestart={resetRun}
            />
          </div>
        )}

        {run.screen === 'draft' && (
          <div className="viewport-shell draft-scene-shell draft-shell">
            <DraftScreen
              candidates={run.candidates}
              selectedIds={run.draftSelection}
              onToggle={toggleDraft}
              onReroll={rerollDraft}
              onConfirm={confirmDraft}
            />
          </div>
        )}

        {hasMapScene && (
          <div className="viewport-shell map-scene-shell game-shell map-hud-shell">
            <main className="main-layout">
              <section className="screen-panel">
                <MapScreen
                  nodes={run.map}
                  boss={run.boss}
                  team={run.team}
                  stats={run.runStats}
                  gold={run.gold}
                  musicMuted={musicMuted}
                  onToggleMusic={toggleMusic}
                  onEnter={enterNode}
                  onOpenTeamScene={openTeamScene}
                  onOpenStats={() => setRun((previous) => ({ ...previous, statsOpen: true }))}
                  eventLog={run.eventLog}
                  onRestart={resetRun}
                  pulseNodeId={run.mapPulseNodeId}
                />
              </section>
            </main>
          </div>
        )}

        {run.screen === 'battle' && run.battle && (
          <div className="viewport-shell battle-scene-shell battle-shell">
            <BattleScreen
              battle={run.battle}
              boss={run.boss}
              gold={run.gold}
              team={run.team}
              pendingEnhance={run.enhanceReady ? run.pendingEnhance : null}
              pendingBossVictory={run.pendingBossVictory}
              onContinue={finishCurrentNode}
              onToggleSelection={toggleBattleSelection}
              onStart={startBattle}
              onEnhance={completeEnhancement}
              onDismissEnhancement={dismissEnhancement}
              onBossBack={dismissBossVictory}
              onBossBlessing={enterBossBlessing}
              onReplayDone={handleBattleReplayDone}
              hasPendingEnhance={Boolean(run.pendingEnhance && run.battle.phase === 'won')}
              onOpenEnhancement={openPendingEnhancement}
            />
          </div>
        )}

        {run.screen === 'result' && run.result && run.battle && (
          <div className="viewport-shell result-scene-shell">
            <ResultScreen result={run.result} log={run.battle.log} stats={run.battle.stats} team={run.team} onContinue={finishCurrentNode} />
          </div>
        )}

        {run.screen === 'shop' && (
          <div className="viewport-shell shop-scene-shell shop-shell">
            <ShopScreen
              gold={run.gold}
              offers={run.shopOffers}
              team={run.team}
              selectedOffer={shopSelectedOffer}
              onSelectOffer={setShopSelectedOffer}
              onBuy={buyCharacter}
              onLeave={finishCurrentNode}
            />
          </div>
        )}

        {run.screen === 'rest' && (
          <div className="viewport-shell rest-scene-shell rest-shell">
            <RestScreen
              gold={run.gold}
              team={run.team}
              healUsed={run.restHealUsed}
              reviveUsed={run.restReviveUsed}
              onHeal={healCharacter}
              onRevive={reviveCharacter}
              onLeave={finishCurrentNode}
            />
          </div>
        )}

        {run.screen === 'question' && (
          <div className="viewport-shell event-scene-shell">
            <QuestionScreen
              event={currentQuestionEvent}
              gold={run.gold}
              team={run.team}
              canUseGacha={canUseMysteryGacha(run.team, run.gold)}
              onResolve={resolveQuestionEvent}
            />
          </div>
        )}

        {run.screen === 'blessing' && (
          <div className="viewport-shell result-scene-shell">
            <BlessingScreen team={run.team} tier={run.boss.bossTier} onContinue={continueFromBlessing} />
          </div>
        )}

        {run.screen === 'win' && run.battle && (
          <div className="viewport-shell result-scene-shell">
            <EndScreen
              title="胜利"
              body="Boss 战完成，Beta 角色构筑循环已经跑通。"
              log={run.battle.log}
              stats={run.battle.stats}
              team={run.team}
              onRestart={resetRun}
            />
          </div>
        )}

        {run.screen === 'loss' && (
          <div className="viewport-shell result-scene-shell">
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
          </div>
        )}
      </div>

      <div className={`scene-blackout ${sceneTransitioning ? 'active' : ''}`} aria-hidden="true" />

      {hasOverlay && (
        <div className="game-overlay-layer">
          {run.screen === 'battle' && run.battle && (
            <div className="game-overlay battle-overlay">
              <section className="game-overlay-panel battle-shell">
                <BattleScreen
                  battle={run.battle}
                  boss={run.boss}
                  gold={run.gold}
                  team={run.team}
                  pendingEnhance={run.enhanceReady ? run.pendingEnhance : null}
                  pendingBossVictory={run.pendingBossVictory}
                  onContinue={finishCurrentNode}
                  onToggleSelection={toggleBattleSelection}
                  onStart={startBattle}
                  onEnhance={completeEnhancement}
                  onDismissEnhancement={dismissEnhancement}
                  onBossBack={dismissBossVictory}
                  onBossBlessing={enterBossBlessing}
                  onReplayDone={handleBattleReplayDone}
                  hasPendingEnhance={Boolean(run.pendingEnhance && run.battle.phase === 'won')}
                  onOpenEnhancement={openPendingEnhancement}
                />
              </section>
            </div>
          )}

          {run.screen === 'result' && run.result && run.battle && (
            <div className="game-overlay result-overlay">
              <section className="game-overlay-panel">
                <ResultScreen result={run.result} log={run.battle.log} stats={run.battle.stats} team={run.team} onContinue={finishCurrentNode} />
              </section>
            </div>
          )}

          {run.screen === 'shop' && (
            <div className="game-overlay shop-overlay">
              <section className="game-overlay-panel shop-shell">
                <ShopScreen
                  gold={run.gold}
                  offers={run.shopOffers}
                  team={run.team}
                  selectedOffer={shopSelectedOffer}
                  onSelectOffer={setShopSelectedOffer}
                  onBuy={buyCharacter}
                  onLeave={finishCurrentNode}
                />
              </section>
            </div>
          )}

          {run.screen === 'rest' && (
            <div className="game-overlay rest-overlay">
              <section className="game-overlay-panel rest-shell">
                <RestScreen
                  gold={run.gold}
                  team={run.team}
                  healUsed={run.restHealUsed}
                  reviveUsed={run.restReviveUsed}
                  onHeal={healCharacter}
                  onRevive={reviveCharacter}
                  onLeave={finishCurrentNode}
                />
              </section>
            </div>
          )}

          {run.screen === 'question' && (
            <div className="game-overlay question-overlay">
              <section className="game-overlay-panel">
                <QuestionScreen
                  event={currentQuestionEvent}
                  gold={run.gold}
                  team={run.team}
                  canUseGacha={canUseMysteryGacha(run.team, run.gold)}
                  onResolve={resolveQuestionEvent}
                />
              </section>
            </div>
          )}

          {run.screen === 'blessing' && (
            <div className="game-overlay blessing-overlay">
              <section className="game-overlay-panel">
                <BlessingScreen team={run.team} tier={run.boss.bossTier} onContinue={continueFromBlessing} />
              </section>
            </div>
          )}

          {run.screen === 'win' && run.battle && (
            <div className="game-overlay end-overlay">
              <section className="game-overlay-panel">
                <EndScreen
                  title="胜利"
                  body="Boss 战完成，Beta 角色构筑循环已经跑通。"
                  log={run.battle.log}
                  stats={run.battle.stats}
                  team={run.team}
                  onRestart={resetRun}
                />
              </section>
            </div>
          )}

          {run.screen === 'loss' && (
            <div className="game-overlay end-overlay">
              <section className="game-overlay-panel">
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
              </section>
            </div>
          )}
        </div>
      )}

      <div className="game-system-layer">
        {bossBlessingTransitioning && <BossBlessingTransition team={run.team} />}

        {run.battleStatsOpen && run.battle && (
          <BattleResultModal
            phase={run.battle.phase}
            stats={run.battle.stats}
            team={run.team}
            primaryLabel={run.pendingEnhance && run.battle.phase === 'won' ? '开启强化' : undefined}
            mapLabel="返回地图"
            onClose={closeBattleStatsModal}
            onPrimary={run.pendingEnhance && run.battle.phase === 'won' ? openPendingEnhancement : undefined}
            onMap={run.battle.type === 'battle' && run.battle.phase === 'won' && !run.pendingEnhance ? finishCurrentNodeToMap : undefined}
          />
        )}

        {run.statsOpen && (
          <RunStatsModal
            stats={run.runStats}
            team={run.team}
            onClose={() => setRun((previous) => ({ ...previous, statsOpen: false }))}
          />
        )}
      </div>
    </div>
  );

}

export default App;
