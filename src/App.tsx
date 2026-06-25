import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  CHARACTER_POOL,
  BATTLE_ENEMY_TEMPLATES,
  ELITE_TEMPLATES,
  NODE_LABELS,
  applyPostNodePassives,
  type BattleStats,
  type BattleState,
  type BattleType,
  type BossTier,
  type BossTemplate,
  type Character,
  type CharacterTemplate,
  type EliteTemplate,
  type EnemyTemplate,
  type MapNode,
  buildMap,
  completeMapNode,
  createAlly,
  createDraftCandidates,
  createElite,
  createEnemy,
  createEnemiesForBattle,
  createShopOffers,
  getBattleEnemiesForTier,
  getBattleSlots,
  getElitesForTier,
  getRandomBossForTier,
  getRewardGold,
  isBattleNode,
  resolveBattleGroup,
  withBattleRandom,
} from './game';
import { MUSIC_SRC, SFX_SRC, type MusicKey, type SfxKey } from './assets';
import { MusicToggleButton } from './components/common';
import { BattleResultModal, RunStatsModal } from './components/battleLog';
import { CompactRunSidePanel } from './components/bonds';
import { BattleScreen } from './pages/BattleScreen';
import { BlessingScreen } from './pages/BlessingScreen';
import { MapScreen } from './pages/MapScreen';
import { RestScreen } from './pages/RestScreen';
import { QuestionScreen } from './pages/QuestionScreen';
import { EndScreen, ResultScreen } from './pages/ResultScreens';
import { ShopScreen } from './pages/ShopScreen';
import { StartScreen } from './pages/StartScreen';
import { DraftScreen } from './pages/DraftScreen';
import {
  BOSS_BLESSING_TRANSITION_MS,
  BossBlessingTransition,
  START_TRANSITION_MS,
  SakuraLayer,
  SceneParticles,
} from './components/sceneEffects';
import { QUESTION_EVENTS, getGachaRarityLabel, getQuestionEvent } from './questionEvents';
import type { SeedRng } from './rng';
import { createRandomSeed, createSeedRng, rngPick } from './rng';

type Screen = 'start' | 'draft' | 'map' | 'battle' | 'result' | 'shop' | 'rest' | 'question' | 'blessing' | 'win' | 'loss';

const DISABLED_CLICK_SFX = new Set<SfxKey>(['next', 'mapSelect', 'buy']);

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
  questionEventId: string | null;
  nextEnemyAttackBonus: number;
  seenEnemyTemplateIds: string[];
  seenEliteTemplateIds: string[];
  runSeed: string;
  rngState: number;
}

type HealType = 'small' | 'large';

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

function getInitialSeed() {
  if (typeof window === 'undefined') {
    return createRandomSeed();
  }
  return new URLSearchParams(window.location.search).get('seed')?.trim() || createRandomSeed();
}

function createRun(seed = getInitialSeed()): RunState {
  const rng = createSeedRng(seed);
  const boss = getRandomBossForTier(1, rng);

  return {
    screen: 'start',
    candidates: createDraftCandidates(rng),
    draftSelection: [],
    team: [],
    gold: 80,
    map: buildMap(rng),
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
    questionEventId: null,
    nextEnemyAttackBonus: 0,
    seenEnemyTemplateIds: [],
    seenEliteTemplateIds: [],
    runSeed: seed,
    rngState: rng.state,
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

function upgradeCharacterOneLevel(member: Character): Character {
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
}

function randomItem<T>(items: T[], rng: SeedRng): T | null {
  return rngPick(rng, items);
}

function canUseMysteryGacha(team: Character[], gold: number) {
  if (team.length >= 4 || gold < 110) {
    return false;
  }
  const ownedIds = new Set(team.map((member) => member.templateId));
  return CHARACTER_POOL.some((template) => !ownedIds.has(template.id));
}

function pickQuestionEvent(run: RunState, rng: SeedRng) {
  const availableEvents = QUESTION_EVENTS.filter((event) => {
    if (event.id === 'fortune_teller') {
      return run.gold >= 20 && run.team.length > 0;
    }
    if (event.id === 'mystery_gacha') {
      return canUseMysteryGacha(run.team, run.gold);
    }
    return true;
  });
  const candidates = availableEvents.length > 0 ? availableEvents : QUESTION_EVENTS;
  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  let cursor = rng.next() * totalWeight;
  for (const event of candidates) {
    cursor -= event.weight;
    if (cursor <= 0) {
      return event;
    }
  }
  return candidates[0];
}

function chooseUnseenEnemyTemplate(tier: BossTier, seenIds: string[], rng: SeedRng): EnemyTemplate {
  const seen = new Set(seenIds);
  const tierCandidates = getBattleEnemiesForTier(tier).filter((enemy) => !seen.has(enemy.id));
  const globalCandidates = BATTLE_ENEMY_TEMPLATES.filter((enemy) => !seen.has(enemy.id));
  const candidates = tierCandidates.length > 0 ? tierCandidates : globalCandidates;
  return randomItem(candidates, rng) ?? getBattleEnemiesForTier(tier)[0] ?? BATTLE_ENEMY_TEMPLATES[0];
}

function chooseUnseenEliteTemplate(tier: BossTier, seenIds: string[], rng: SeedRng): EliteTemplate {
  const seen = new Set(seenIds);
  const tierCandidates = getElitesForTier(tier).filter((elite) => !seen.has(elite.id));
  const globalCandidates = ELITE_TEMPLATES.filter((elite) => !seen.has(elite.id));
  const candidates = tierCandidates.length > 0 ? tierCandidates : globalCandidates;
  return randomItem(candidates, rng) ?? getElitesForTier(tier)[0] ?? ELITE_TEMPLATES[0];
}

function createUniqueEnemiesForBattle(previous: RunState, battleType: BattleType, rng: SeedRng) {
  if (battleType === 'battle') {
    const template = chooseUnseenEnemyTemplate(previous.boss.bossTier, previous.seenEnemyTemplateIds, rng);
    return {
      enemies: [createEnemy(template, battleType, 0)],
      seenEnemyTemplateIds: unique([...previous.seenEnemyTemplateIds, template.id]),
      seenEliteTemplateIds: previous.seenEliteTemplateIds,
    };
  }

  if (battleType === 'elite') {
    const template = chooseUnseenEliteTemplate(previous.boss.bossTier, previous.seenEliteTemplateIds, rng);
    return {
      enemies: [createElite(template)],
      seenEnemyTemplateIds: previous.seenEnemyTemplateIds,
      seenEliteTemplateIds: unique([...previous.seenEliteTemplateIds, template.id]),
    };
  }

  return {
    enemies: createEnemiesForBattle(battleType, rng, previous.boss),
    seenEnemyTemplateIds: previous.seenEnemyTemplateIds,
    seenEliteTemplateIds: previous.seenEliteTemplateIds,
  };
}

function shouldStartMuted() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
}

function App() {
  const [run, setRun] = useState<RunState>(() => createRun());
  const [musicMuted, setMusicMuted] = useState(() => shouldStartMuted());
  const [shopSelectedOffer, setShopSelectedOffer] = useState<CharacterTemplate | null>(null);
  const [goldPulse, setGoldPulse] = useState(false);
  const [startTransitioning, setStartTransitioning] = useState(false);
  const [bossBlessingTransitioning, setBossBlessingTransitioning] = useState(false);

  const currentNode = useMemo(
    () => run.map.find((node) => node.id === run.currentNodeId) ?? null,
    [run.currentNodeId, run.map],
  );

  const aliveTeam = run.team.filter((member) => !member.injured && member.hp > 0);
  const currentQuestionEvent = getQuestionEvent(run.questionEventId);
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

  function resolveQuestionEvent(optionId: string, targetId?: string) {
    setRun((previous) => {
      if (previous.screen !== 'question' || !previous.currentNodeId || !previous.questionEventId) {
        return previous;
      }

      const event = getQuestionEvent(previous.questionEventId);
      const rng = createSeedRng(previous.rngState);
      let team = previous.team;
      let gold = previous.gold;
      let nextEnemyAttackBonus = previous.nextEnemyAttackBonus;
      const eventLog: string[] = [`机遇「${event.title}」：${event.options.find((option) => option.id === optionId)?.label ?? '确认'}。`];

      if (event.id === 'encounter_enemy' || event.id === 'encounter_elite') {
        const aliveCount = previous.team.filter((member) => !member.injured && member.hp > 0).length;
        if (aliveCount === 0) {
          return { ...previous, screen: 'loss' };
        }

        const battleType: BattleType = event.id === 'encounter_elite' ? 'elite' : 'battle';
        const slots = getBattleSlots(battleType, aliveCount);
        const enemyAttackBonus = previous.nextEnemyAttackBonus;
        const encounter = createUniqueEnemiesForBattle(previous, battleType, rng);
        const enemies = encounter.enemies.map((enemy) =>
          enemyAttackBonus > 0 ? { ...enemy, attack: enemy.attack + enemyAttackBonus } : enemy,
        );
        const battle: BattleState = {
          nodeId: previous.currentNodeId,
          type: battleType,
          enemies,
          activeEnemyIndex: 0,
          selectedIds: [],
          slots,
          phase: 'select',
          rewardGold: getRewardGold(battleType, enemies),
          log: [
            `机遇「${event.title}」转入${NODE_LABELS[battleType]}。`,
            ...(enemyAttackBonus > 0 ? [`偶像直播风险触发，本场敌人攻击+${enemyAttackBonus}。`] : []),
          ],
          events: [],
          runtime: {},
          stats: {},
        };

        return {
          ...previous,
          screen: 'battle',
          battle,
          result: null,
          questionEventId: null,
          restHealUsed: false,
          restReviveUsed: false,
          nextEnemyAttackBonus: 0,
          rngState: rng.state,
          seenEnemyTemplateIds: encounter.seenEnemyTemplateIds,
          seenEliteTemplateIds: encounter.seenEliteTemplateIds,
          eventLog: [
            ...previous.eventLog,
            `机遇「${event.title}」触发${NODE_LABELS[battleType]}。`,
            ...(enemyAttackBonus > 0 ? [`偶像直播风险触发：本场敌人攻击+${enemyAttackBonus}。`] : []),
          ],
        };
      }

      if (event.id === 'lucky_fans') {
        gold += 40;
        eventLog.push('获得40金币。');
      }

      if (event.id === 'free_show') {
        team = team.map((member) =>
          member.injured ? member : { ...member, hp: Math.min(member.maxHp, member.hp + 15) },
        );
        eventLog.push('全队回复15HP。');
      }

      if (event.id === 'training') {
        const target = randomItem(team.filter((member) => (member.upgradeLevel ?? 1) < maxUpgradeLevel(member.rarity)), rng);
        if (target) {
          team = team.map((member) => member.id === target.id ? upgradeCharacterOneLevel(member) : member);
          eventLog.push(`${target.name}升级1级。`);
        } else {
          gold += 30;
          eventLog.push('没有可升级角色，转化为30金币。');
        }
      }

      if (event.id === 'extreme_training') {
        team = team.map((member) => {
          const nextHp = Math.max(0, member.hp - 10);
          return {
            ...member,
            hp: nextHp,
            injured: member.injured || nextHp <= 0,
            attack: member.attack + 1,
          };
        });
        eventLog.push('全队失去10HP，全队攻击永久+1。');
      }

      if (event.id === 'idol_stream') {
        gold += 100;
        nextEnemyAttackBonus += 2;
        eventLog.push('获得100金币。下一场敌人攻击+2。');
      }

      if (event.id === 'school_festival') {
        const target = team.find((member) => member.id === targetId);
        if (!target) {
          return previous;
        }
        team = team.map((member) => member.id === target.id ? { ...member, attack: member.attack + 1 } : member);
        eventLog.push(`${target.name}攻击永久+1。`);
      }

      if (event.id === 'fortune_teller') {
        const target = team.find((member) => member.id === targetId);
        if (!target || gold < 20) {
          return previous;
        }
        gold -= 20;
        team = team.map((member) =>
          member.id === target.id ? { ...member, maxHp: member.maxHp + 5, hp: member.hp + 5 } : member,
        );
        eventLog.push(`花费20金币，${target.name}生命上限+5。`);
      }

      if (event.id === 'student_council' && optionId === 'follow_rules') {
        const paid = Math.min(20, gold);
        gold -= paid;
        eventLog.push(`遵守规定，失去${paid}金币。`);
      }

      if (event.id === 'student_council' && optionId === 'sneak_away') {
        if (rng.next() < 0.5) {
          const target = randomItem(team, rng);
          if (target) {
            team = team.map((member) => member.id === target.id ? { ...member, attack: member.attack + 2 } : member);
            eventLog.push(`偷偷溜走成功，${target.name}攻击永久+2。`);
          }
        } else {
          eventLog.push('偷偷溜走，没有发生额外效果。');
        }
      }

      if (event.id === 'mystery_gacha') {
        if (gold < 110 || team.length >= 4) {
          return previous;
        }
        const ownedIds = new Set(team.map((member) => member.templateId));
        const available = CHARACTER_POOL.filter((template) => !ownedIds.has(template.id));
        if (available.length === 0) {
          return previous;
        }
        gold -= 110;
        const rarityRoll = rng.next();
        const preferredRarity = rarityRoll < 0.1 ? 'legendary' : rarityRoll < 0.35 ? 'star' : 'normal';
        const template = randomItem(available.filter((candidate) => candidate.rarity === preferredRarity), rng) ?? randomItem(available, rng);
        if (!template) {
          return previous;
        }
        team = [...team, createAlly(template)];
        eventLog.push(`抽卡获得${getGachaRarityLabel(template)}色角色：${template.name}。`);
      }

      return advanceAfterCurrentNode(
        {
          ...previous,
          gold,
          team,
          nextEnemyAttackBonus,
          rngState: rng.state,
          questionEventId: null,
          eventLog: [...previous.eventLog, ...eventLog],
        },
        team,
      );
    });
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
        <SakuraLayer />
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
        : run.screen === 'rest' || run.screen === 'question' || run.screen === 'blessing'
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
        : run.screen === 'rest' || run.screen === 'question'
          ? 'rest'
          : run.screen === 'blessing'
            ? 'blessing'
            : null;

  return (
    <div className={`app-shell game-shell ${sceneClass} ${run.screen === 'map' ? 'map-hud-shell' : ''} ${run.screen === 'battle' ? 'battle-shell' : ''} ${run.screen === 'shop' ? 'shop-shell' : ''} ${run.screen === 'rest' || run.screen === 'question' ? 'rest-shell' : ''}`} onPointerDownCapture={handleShellPointerDown}>
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
            <span title={`Seed: ${run.runSeed}`}>Seed {run.runSeed}</span>
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
              team={run.team}
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

          {run.screen === 'question' && (
            <QuestionScreen
              event={currentQuestionEvent}
              gold={run.gold}
              team={run.team}
              canUseGacha={canUseMysteryGacha(run.team, run.gold)}
              onResolve={resolveQuestionEvent}
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
