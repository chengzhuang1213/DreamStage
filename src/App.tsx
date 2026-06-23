import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARACTER_POOL,
  BOND_GROUPS,
  NODE_LABELS,
  RARITY_LABELS,
  SECONDARY_BONDS,
  applyPostNodePassives,
  type BattleStats,
  type BattleState,
  type BattleType,
  type BossTier,
  type BossTemplate,
  type Character,
  type CharacterBattleStats,
  type CharacterTemplate,
  type MapNode,
  buildMap,
  completeMapNode,
  createAlly,
  createDraftCandidates,
  createEnemiesForBattle,
  GROUP_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
  getBattleSlots,
  getRandomBossForTier,
  getRewardGold,
  isBattleNode,
  resolveBattleGroup,
  sample,
} from './game';
import { BOND_LOGO_SRC, DRAFT_IMAGE_BY_ID, MUSIC_SRC, SFX_SRC, type MusicKey, type SfxKey } from './assets';
import { Avatar, MusicToggleButton, UpgradeLevelBadge } from './components/common';
import { MapScreen } from './pages/MapScreen';

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
  pendingBossVictory: boolean;
}

type HealType = 'small' | 'large';

const HEAL_OPTIONS: Record<HealType, { label: string; cost: number; amount: number; full?: boolean }> = {
  small: { label: '小治疗', cost: 20, amount: 15 },
  large: { label: '大治疗', cost: 50, amount: 0, full: true },
};
const REVIVE_COST = 80;
const REVIVE_HP_RATIO = 0.6;
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
    pendingBossVictory: false,
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

function draftImageSrc(template: CharacterTemplate) {
  return DRAFT_IMAGE_BY_ID[template.id] ?? template.avatar;
}

function getSecondaryBondsForTemplate(templateId: string) {
  return SECONDARY_BONDS.filter((bond) => bond.memberIds.includes(templateId));
}

function getBondGroupForTemplate(template: CharacterTemplate) {
  return BOND_GROUPS.find((group) => group.id === template.group) ?? null;
}

function getTemplateById(id: string) {
  return CHARACTER_POOL.find((character) => character.id === id) ?? null;
}

function maxUpgradeLevel(rarity: Character['rarity'] | CharacterTemplate['rarity']) {
  if (rarity === 'normal') {
    return 2;
  }
  if (rarity === 'star' || rarity === 'legendary') {
    return 3;
  }
  return 1;
}

function getUpgradeEffectLines(templateId: string, level: number): string[] {
  switch (templateId) {
    case 'ayumu':
      return level >= 3 ? ['技能：全体恢复15生命，并解除所有毒层。', '被动：治疗友军后，下次治疗+3点。'] : level >= 2 ? ['技能：全体恢复10生命。', '被动：治疗友军后，下次治疗+3点。'] : ['技能：全体恢复5生命。', '被动：治疗友军后，下次治疗+3点。'];
    case 'rina':
      return level >= 2 ? ['技能：50%概率追加攻击，并获得10护盾。'] : ['技能：30%概率追加攻击。'];
    case 'nico':
      return level >= 3 ? ['被动：每次使用技能攻击力+4。', '技能：失去10%当前生命，连续攻击4次。'] : level >= 2 ? ['被动：每次使用技能攻击力+4。', '技能：失去10%当前生命，连续攻击3次。'] : ['被动：每次使用技能攻击力+3。', '技能：失去10%当前生命，连续攻击3次。'];
    case 'kotori':
      return level >= 3 ? ['被动：攻击击碎所有护盾，后续护盾量减半。', '技能：Lv2强化暴击率提升至50%；先结算技能伤害，再额外造成10点真实伤害。'] : level >= 2 ? ['被动：攻击击碎所有护盾，后续护盾量减半。', '技能：Lv2强化暴击率提升至50%，暴击造成2倍伤害。'] : ['被动：攻击击碎所有护盾，后续护盾量减半。', '技能：30%暴击，暴击造成2倍伤害。'];
    case 'keke':
      return level >= 3 ? ['被动：造成伤害的30%恢复为生命。', '技能CD1：立即发动，50%造成3倍伤害，50%造成4倍伤害。'] : level >= 2 ? ['被动：造成伤害的30%恢复为生命。', '技能CD1：立即发动，本次攻击造成2倍伤害。'] : ['被动：造成伤害的30%恢复为生命。', '技能CD1：本回合不攻击，下次攻击造成2倍伤害。'];
    case 'you':
      return level >= 2 ? ['技能：首次攻击施加易损，下次伤害2.5倍。'] : ['技能：首次攻击施加易损，下次伤害2倍。'];
    case 'eli':
      return level >= 3 ? ['被动：每受到一次攻击，本场攻击力+1。', '技能CD1：全体友方攻击力+4，并获得2点速度。'] : level >= 2 ? ['被动：每受到一次攻击，本场攻击力+1。', '技能CD1：全体友方攻击力+3。'] : ['被动：每受到一次攻击，本场攻击力+1。', '技能CD1：全体友方攻击力+2。'];
    case 'mari':
      return level >= 3 ? ['被动：拥有护盾时伤害提高150%。', '技能：获得20护盾。'] : level >= 2 ? ['被动：拥有护盾时伤害提高100%。', '技能：获得15护盾。'] : ['被动：拥有护盾时伤害提高50%。', '技能：获得10护盾。'];
    case 'ren':
      return level >= 2 ? ['被动：生命值额外+50。', '无主动技能。'] : ['被动：生命值额外+30。', '无主动技能。'];
    case 'yoshiko':
      return level >= 3 ? ['被动：攻击附加1层毒；目标已有毒时，攻击额外+3伤害。', '技能：附加4层毒。'] : level >= 2 ? ['被动：攻击附加1层毒。', '技能：附加4层毒。'] : ['被动：攻击附加1层毒。', '技能：附加3层毒。'];
    case 'nozomi':
      return level >= 2 ? ['被动：每回合开始获得3点护盾。', '技能：给一名非自己的友方8点护盾。'] : ['被动：每回合开始获得3点护盾。', '技能：给一名非自己的友方5点护盾。'];
    case 'kanata':
      return level >= 3 ? ['被动：战斗结束后生命强制变为50%。', '技能：敌方生命低于35%立即斩杀。', 'Boss战首次受到致命伤害时保留1HP，下次攻击3倍。'] : level >= 2 ? ['被动：战斗结束后生命强制变为50%。', '技能：敌方生命低于30%立即斩杀。', 'Boss战首次受到致命伤害时保留1HP，下次攻击3倍。'] : ['被动：战斗结束后生命强制变为50%。', '技能：敌方生命低于30%立即斩杀。'];
    default:
      return [];
  }
}

function App() {
  const [run, setRun] = useState<RunState>(() => createRun());
  const [musicMuted, setMusicMuted] = useState(false);

  const currentNode = useMemo(
    () => run.map.find((node) => node.id === run.currentNodeId) ?? null,
    [run.currentNodeId, run.map],
  );

  const aliveTeam = run.team.filter((member) => !member.injured && member.hp > 0);
  const audioRefs = useRef<Partial<Record<MusicKey | SfxKey, HTMLAudioElement>>>({});
  const audioUnlockedRef = useRef(false);
  const currentMusicRef = useRef<MusicKey | null>(null);
  const lastVictoryNodeRef = useRef<string | null>(null);

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
    if (!audioUnlockedRef.current) {
      return;
    }

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

  function toggleMusic() {
    unlockAudio();
    setMusicMuted((muted) => !muted);
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
    setRun(createRun());
  }

  function startGame() {
    playSfx('next');
    setRun({
      ...createRun(),
      screen: 'draft',
      candidates: createDraftCandidates(),
      draftSelection: [],
    });
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
          runtime: {},
          stats: {},
        };

        return {
          ...previous,
          screen: 'battle',
          currentNodeId: node.id,
          battle,
          result: null,
          restHealUsed: false,
          restReviveUsed: false,
          eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
        };
      }

      if (node.type === 'shop') {
        const ownedIds = new Set(previous.team.map((member) => member.templateId));
        const availableOffers = CHARACTER_POOL.filter((character) => !ownedIds.has(character.id));
        const legendaryOffers = availableOffers.filter((character) => character.rarity === 'legendary');
        const nonLegendaryOffers = availableOffers.filter((character) => character.rarity !== 'legendary');
        const guaranteedLegendary = previous.boss.bossTier >= 2 ? sample(legendaryOffers, 1) : [];
        const shopOffers = guaranteedLegendary.length > 0
          ? [...guaranteedLegendary, ...sample(nonLegendaryOffers, 2)]
          : sample(availableOffers, 3);

        return {
          ...previous,
          screen: 'shop',
          currentNodeId: node.id,
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
        result: null,
        restHealUsed: false,
        restReviveUsed: false,
        eventLog: [...previous.eventLog, `进入${NODE_LABELS[node.type]}节点。`],
      };
    });
  }

  function advanceAfterCurrentNode(previous: RunState, teamInput = previous.team): RunState {
    if (!previous.currentNodeId) {
      return { ...previous, screen: 'map', pendingEnhance: null, pendingBossVictory: false };
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
        pendingBossVictory: false,
        eventLog: [...previous.eventLog, ...completionLog, `进入第${nextTier}层。`],
      };
    }

    return {
      ...previous,
      screen: 'map',
      team,
      map: clearedNodeMap,
      currentNodeId: null,
      battle: null,
      result: null,
      shopOffers: [],
      restHealUsed: false,
      restReviveUsed: false,
      pendingEnhance: null,
      pendingBossVictory: false,
      eventLog: [...previous.eventLog, ...completionLog],
    };
  }
  function finishCurrentNode() {
    setRun((previous) => advanceAfterCurrentNode(previous));
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

      const selectedIds = previous.battle.selectedIds.includes(id)
        ? previous.battle.selectedIds.filter((selectedId) => selectedId !== id)
        : previous.battle.selectedIds.length < previous.battle.slots
          ? [...previous.battle.selectedIds, id]
          : previous.battle.selectedIds;

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
          battleStatsOpen: true,
          screen: isFinalBoss ? 'win' : 'battle',
          pendingEnhance: canEnhance
            ? { source: battle.type === 'boss' ? 'boss' : 'elite', cost: battle.type === 'boss' ? 0 : ENHANCE_COST, free: battle.type === 'boss' }
            : null,
        };
      }

      if (battle.phase === 'lost') {
        return {
          ...previous,
          team,
          battle,
          battleStatsOpen: true,
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
          const nextLevel = Math.min(maxUpgradeLevel(member.rarity), currentLevel + 1) as 1 | 2 | 3;
          const renHpBonus = member.templateId === 'ren' && currentLevel === 1 && nextLevel >= 2 ? 20 : 0;
          return {
            ...member,
            upgradeLevel: nextLevel,
            maxHp: member.maxHp + renHpBonus,
            hp: member.hp + renHpBonus,
          };
        });
      }

      const nextState = { ...previous, gold: nextGold, team: nextTeam, pendingEnhance: null };
      if (source === 'boss') {
        return { ...nextState, screen: 'battle', pendingBossVictory: true };
      }

      return advanceAfterCurrentNode(nextState, nextTeam);
    });
  }

  function dismissEnhancement() {
    setRun((previous) => {
      if (!previous.pendingEnhance) {
        return previous;
      }

      const nextState = { ...previous, pendingEnhance: null };
      if (previous.pendingEnhance.source === 'boss') {
        return { ...nextState, screen: 'battle', pendingBossVictory: true };
      }

      return advanceAfterCurrentNode(nextState);
    });
  }

  function dismissBossVictory() {
    setRun((previous) => ({ ...previous, pendingBossVictory: false }));
  }

  function buyCharacter(template: CharacterTemplate) {
    if (!run.team.some((member) => member.templateId === template.id) && run.gold >= template.price) {
      playSfx('buy');
    }

    setRun((previous) => {
      const alreadyOwned = previous.team.some((member) => member.templateId === template.id);
      if (alreadyOwned || previous.gold < template.price) {
        return previous;
      }

      return {
        ...previous,
        gold: previous.gold - template.price,
        team: [...previous.team, createAlly(template)],
        shopOffers: previous.shopOffers.filter((offer) => offer.id !== template.id),
      };
    });
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
      <div className="app-shell start-shell scene-home">
        <MusicToggleButton muted={musicMuted} onToggle={toggleMusic} className="floating-music-toggle" />
        <StartScreen onStart={startGame} />
      </div>
    );
  }

  if (run.screen === 'draft') {
    return (
      <div className="app-shell draft-shell scene-draft-shop">
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

  return (
    <div className={`app-shell game-shell ${sceneClass} ${run.screen === 'map' ? 'map-hud-shell' : ''} ${run.screen === 'battle' ? 'battle-shell' : ''}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">非商用个人 Beta</p>
          <h1>LoveLive Roguelike Beta</h1>
        </div>
        <div className="run-stats" aria-label="当前资源">
          <span>金币 {run.gold}</span>
          <span>伙伴 {run.team.length}</span>
          <span>可出战 {aliveTeam.length}</span>
        </div>
      </header>

      <main className="main-layout">
        <aside className="side-panel">
            <div className="panel-heading">
              <h2>队伍</h2>
              <button className="ghost-button" onClick={resetRun}>
                新一局
              </button>
            </div>
            <div className="team-list">
              {run.team.map((member) => (
                <CompactCharacter key={member.id} character={member} />
              ))}
            </div>
            <BondPanel team={run.team} />
          </aside>

        <section className="screen-panel">
          {run.screen === 'map' && <MapScreen nodes={run.map} boss={run.boss} team={run.team} stats={run.runStats} gold={run.gold} musicMuted={musicMuted} onToggleMusic={toggleMusic} onEnter={enterNode} onOpenStats={() => setRun((previous) => ({ ...previous, statsOpen: true }))} eventLog={run.eventLog} onRestart={resetRun} />}

          {run.screen === 'battle' && run.battle && (
            <BattleScreen
              battle={run.battle}              boss={run.boss}
              gold={run.gold}
              team={run.team}
              pendingEnhance={run.pendingEnhance}
              pendingBossVictory={run.pendingBossVictory}
              onContinue={finishCurrentNode}
              onToggleSelection={toggleBattleSelection}              onStart={startBattle}
              onEnhance={completeEnhancement}
              onDismissEnhancement={dismissEnhancement}
              onBossBack={dismissBossVictory}
              onBossBlessing={finishCurrentNode}
            />
          )}

          {run.screen === 'result' && run.result && run.battle && (
            <ResultScreen result={run.result} log={run.battle.log} stats={run.battle.stats} team={run.team} onContinue={finishCurrentNode} />
          )}

          {run.screen === 'shop' && (
            <ShopScreen
              gold={run.gold}
              offers={run.shopOffers}
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
              stats={run.battle?.stats}
              team={run.team}
              onRestart={resetRun}
            />
          )}
        </section>
      </main>

      {run.battleStatsOpen && run.battle && (
        <BattleResultModal
          phase={run.battle.phase}
          stats={run.battle.stats}
          team={run.team}
          onClose={() => setRun((previous) => ({ ...previous, battleStatsOpen: false }))}
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

interface DraftScreenProps {
  candidates: CharacterTemplate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onReroll: () => void;
  onConfirm: () => void;
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="start-page">
      <div className="start-copy">
        <p className="eyebrow">LoveLive Roguelike Beta</p>
        <h1>开始巡演</h1>
        <p>选择初始偶像，规划路线，撑过三层Boss战。</p>
        <button className="primary-button start-button" onClick={onStart}>
          开始游戏
        </button>
      </div>
    </main>
  );
}

function BondMemberPopover({ memberIds, ownedIds }: { memberIds: string[]; ownedIds: Set<string> }) {
  return (
    <div className="bond-member-popover">
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
  subtitle: string;
  details: string[];
  memberIds: string[];
  ownedIds: Set<string>;
  active: boolean;
  secondary?: boolean;
  logoSrc?: string;
}

function BondItem({ name, count, total, subtitle, details, memberIds, ownedIds, active, secondary = false, logoSrc }: BondItemProps) {
  return (
    <div className={`bond-item ${active ? 'active' : ''} ${secondary && active ? 'secondary-active' : ''}`}>
      <div className="bond-item-heading">
        {logoSrc && <img className="bond-logo" src={logoSrc} alt="" />}
        <div>
          <strong>
            {name} {count}/{total}
          </strong>
          <span>{subtitle}</span>
        </div>
      </div>
      {details.map((detail) => (
        <small key={detail}>{detail}</small>
      ))}
      <BondMemberPopover memberIds={memberIds} ownedIds={ownedIds} />
    </div>
  );
}
interface BondTagProps {
  className?: string;
  label: string;
  memberIds: string[];
  ownedIds: Set<string>;
}

function BondTag({ className = '', label, memberIds, ownedIds }: BondTagProps) {
  return (
    <div className={`group-tag bond-tag ${className}`.trim()}>
      <span>{label}</span>
      <BondMemberPopover memberIds={memberIds} ownedIds={ownedIds} />
    </div>
  );
}
function BondPanel({ team }: { team: Character[] }) {
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
                          `2人：${bond.group.level2Name}，${bond.group.level2Description}`,
                          ...(bond.level >= 3 ? [`3人：${bond.group.level3Name}，${bond.group.level3Description}`] : []),
                        ]
                      : ['再集齐1名成员激活2人羁绊。']
                  }
                  key={bond.group.id}
                  memberIds={bond.group.memberIds}
                  logoSrc={BOND_LOGO_SRC[bond.group.id]}
                  name={bond.group.name}
                  ownedIds={ownedIds}
                  subtitle={bond.group.theme}
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
                  details={activeBond.active ? [] : ['再集齐1名成员激活。']}
                  key={activeBond.bond.id}
                  memberIds={activeBond.bond.memberIds}
                  logoSrc={BOND_LOGO_SRC[activeBond.bond.id]}
                  name={activeBond.bond.name}
                  ownedIds={ownedIds}
                  secondary
                  subtitle={activeBond.bond.description}
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

function DraftScreen({ candidates, selectedIds, onToggle, onReroll, onConfirm }: DraftScreenProps) {
  const visibleCandidates = candidates.slice(0, 4);
  const selectedCandidates = visibleCandidates.filter((candidate) => selectedIds.includes(candidate.id));

  return (
    <main className="draft-page">
      <div className="draft-toolbar">
        <div className="screen-heading">
          <p className="eyebrow">初始伙伴</p>
          <h2>选择 2 名偶像开局</h2>
          <p>本次候选 {visibleCandidates.length}/4，已选择 {selectedIds.length}/2。</p>
        </div>
        <div className="draft-actions">
          <button className="secondary-button" onClick={onReroll}>
            重抽候选
          </button>
          <button className="primary-button" disabled={selectedIds.length !== 2} onClick={onConfirm}>
            确认开局
          </button>
        </div>
      </div>
      <div className="draft-grid">
        {visibleCandidates.map((candidate) => (
          <DraftCandidateCard
            key={candidate.id}
            template={candidate}
            selected={selectedIds.includes(candidate.id)}
            onClick={() => onToggle(candidate.id)}
          />
        ))}
      </div>
      <DraftBondPreview selectedCharacters={selectedCandidates} />
    </main>
  );
}

function DraftBondPreview({ selectedCharacters }: { selectedCharacters: CharacterTemplate[] }) {
  const ownedIds = new Set(selectedCharacters.map((character) => character.id));
  const bonds = getActiveBonds(selectedCharacters);
  const secondaryBonds = getActiveSecondaryBonds(selectedCharacters);

  return (
    <section className="draft-bonds">
      <div className="draft-bonds-heading">
        <p className="eyebrow">羁绊说明</p>
        <h3>主羁绊与次羁绊</h3>
      </div>
      <div className="draft-bond-grid">
        {bonds.map((bond) => (
          <BondItem
            active={bond.level > 0}
            count={bond.count}
            details={[
              `2人：${bond.group.level2Name}，${bond.group.level2Description}`,
              `3人：${bond.group.level3Name}，${bond.group.level3Description}`,
            ]}
            key={bond.group.id}
            memberIds={bond.group.memberIds}
            logoSrc={BOND_LOGO_SRC[bond.group.id]}
            name={bond.group.name}
            ownedIds={ownedIds}
            subtitle={bond.group.theme}
            total={3}
          />
        ))}
        {secondaryBonds.map((activeBond) => (
          <BondItem
            active={activeBond.active}
            count={activeBond.count}
            details={[]}
            key={activeBond.bond.id}
            memberIds={activeBond.bond.memberIds}
            logoSrc={BOND_LOGO_SRC[activeBond.bond.id]}
            name={activeBond.bond.name}
            ownedIds={ownedIds}
            secondary
            subtitle={activeBond.bond.description}
            total={2}
          />
        ))}
      </div>
    </section>
  );
}

interface DraftCandidateCardProps {
  template: CharacterTemplate;
  selected: boolean;
  onClick: () => void;
}

function DraftCandidateCard({ template, selected, onClick }: DraftCandidateCardProps) {
  const primaryBond = getBondGroupForTemplate(template);
  const secondaryBonds = getSecondaryBondsForTemplate(template.id);
  const tagOwnedIds = new Set([template.id]);

  return (
    <button
      className={`draft-card rarity-${template.rarity} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className="draft-portrait">
        <img
          alt=""
          src={draftImageSrc(template)}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="draft-card-body">
        <div className="card-tags">
          {primaryBond ? (
            <BondTag label={GROUP_LABELS[template.group]} memberIds={primaryBond.memberIds} ownedIds={tagOwnedIds} />
          ) : (
            <span className="group-tag">{GROUP_LABELS[template.group]}</span>
          )}
          {secondaryBonds.map((bond) => (
            <BondTag
              className="secondary-bond-tag"
              key={bond.id}
              label={bond.name}
              memberIds={bond.memberIds}
              ownedIds={tagOwnedIds}
            />
          ))}
          <span className={`rarity-tag rarity-${template.rarity}`}>{RARITY_LABELS[template.rarity]}</span>
        </div>
        <h3>{template.name}</h3>
        <div className="draft-stats" aria-label={`${template.name}数值`}>
          <span>
            <strong>{template.maxHp}</strong>
            HP
          </span>
          <span>
            <strong>{template.attack}</strong>
            攻击
          </span>
          <span>
            <strong>{template.speed}</strong>
            速度
          </span>
        </div>
        {template.passive && (
          <div className="draft-ability">
            <span>被动</span>
            <p>被动「{template.passive.name}」：{template.passive.description}</p>
          </div>
        )}
        <div className="draft-ability">
          <span>技能</span>
          <p>技能「{template.skill.name}」：{template.skill.description}</p>
        </div>
        <em>{selected ? '已选择' : '点击选择'}</em>
      </div>
    </button>
  );
}

interface BattleScreenProps {
  battle: BattleState;
  boss: BossTemplate;
  gold: number;
  team: Character[];
  onContinue: () => void;
  onToggleSelection: (id: string) => void;
  pendingEnhance: RunState['pendingEnhance'];
  pendingBossVictory: boolean;
  onStart: () => void;
  onEnhance: (id: string | null) => void;
  onDismissEnhancement: () => void;
  onBossBack: () => void;
  onBossBlessing: () => void;
}

function hpPercent(character: Pick<Character, 'hp' | 'maxHp'>) {
  return `${Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100)))}%`;
}

function BattleUnitCard({ character, defeated = false }: { character: Character; defeated?: boolean }) {
  return (
    <div className={`battle-unit-card rarity-${character.rarity} ${defeated || character.hp <= 0 ? 'defeated' : ''}`}>
      <Avatar character={character} label={character.name.replace('敌方', '').replace('Boss ', '').replace('精英 ', '')} />
      <div className="battle-unit-copy">
        <div className="battle-unit-title">
          <strong>{character.name}</strong>
          {character.rarity !== 'enemy' && character.rarity !== 'elite' && character.rarity !== 'boss' && <UpgradeLevelBadge level={character.upgradeLevel ?? 1} />}
          <span>{RARITY_LABELS[character.rarity]}</span>
        </div>
        <div className="battle-hp-line">
          <b>HP {character.hp}/{character.maxHp}</b>
          <div className="battle-hp-track"><span style={{ width: hpPercent(character) }} /></div>
        </div>
        <small>攻击 {character.attack}　速度 {character.speed}</small>
        {character.passive && <small>被动：{character.passive.description}</small>}
        {character.skill && <small>技能：{character.skill.description}</small>}
      </div>
    </div>
  );
}

function BattleTeamPanel({ team }: { team: Character[] }) {
  return (
    <aside className="battle-left-panel">
      <section className="battle-card-panel">
        <h3>队伍</h3>
        <div className="battle-team-list">
          {team.map((member) => (
            <CompactCharacter key={member.id} character={member} />
          ))}
        </div>
      </section>
      <section className="battle-card-panel">
        <h3>羁绊</h3>
        <BondPanel team={team} />
      </section>
    </aside>
  );
}

function BattleSlotStrip({ selectedMembers, slots }: { selectedMembers: Character[]; slots: number }) {
  const slotItems = Array.from({ length: slots }, (_, index) => selectedMembers[index] ?? null);

  return (
    <section className="battle-slot-strip" aria-label="出战位">
      {slotItems.map((member, index) => (
        <div className={`battle-slot ${member ? 'filled' : ''}`} key={member?.id ?? `slot-${index}`}>
          {member ? (
            <>
              <Avatar character={member} label={member.name} />
              <strong>{member.name}</strong>
              <span>{member.hp}/{member.maxHp} HP</span>
            </>
          ) : (
            <>
              <b>＋</b>
              <strong>出战位</strong>
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

function BattleScreen({ battle, boss, gold, team, pendingEnhance, pendingBossVictory, onContinue, onToggleSelection, onStart, onEnhance, onDismissEnhancement, onBossBack, onBossBlessing }: BattleScreenProps) {
  const aliveMembers = team.filter((member) => !member.injured && member.hp > 0);
  const displayEnemy = battle.enemies[Math.min(battle.activeEnemyIndex, battle.enemies.length - 1)] ?? null;
  const selectableMembers = battle.phase === 'relay' ? aliveMembers : team;
  const selectedMembers = team.filter((member) => battle.selectedIds.includes(member.id));
  const battleTitle = battle.type === 'boss' ? '3v1 Boss战' : battle.type === 'elite' ? '2v1 精英战' : '1v1 普通战斗';
  const canStart = (battle.phase === 'select' || battle.phase === 'relay') && battle.selectedIds.length === battle.slots;
  const isWon = battle.phase === 'won';
  const isBossWon = isWon && battle.type === 'boss' && boss.bossTier < 3;
  const canContinueRoute = isWon && !isBossWon && !pendingEnhance;

  return (
    <div className="battle-hud-screen">
      <header className="battle-hud-header">
        <div>
          <p className="eyebrow">{NODE_LABELS[battle.type]}</p>
          <h2>{battleTitle}</h2>
          <p>所选角色会同时出战，敌人会攻击所有出战角色。</p>
        </div>
        <div className="battle-resource-pills">
          <span>◎ 金币 {gold}</span>
          <span>伙伴 {team.length}</span>
          <span>可出战 {aliveMembers.length}</span>
        </div>
      </header>

      <div className="battle-hud-grid">
        <BattleTeamPanel team={team} />

        <main className="battle-center-panel">
          <section className="battle-card-panel battle-enemy-stage">
            <h3>敌人</h3>
            {displayEnemy && <BattleUnitCard character={displayEnemy} defeated={displayEnemy.hp <= 0 || isWon} />}
          </section>

          <section className="battle-card-panel battle-selection-stage">
            <div className="battle-section-heading">
              <h3>{battle.phase === 'relay' ? '接力出战' : isWon ? '战斗结果' : '选择出战角色'} {battle.selectedIds.length}/{battle.slots}</h3>
              {battle.phase === 'relay' && displayEnemy && <span>{displayEnemy.name} 剩余 {displayEnemy.hp}/{displayEnemy.maxHp} HP</span>}
            </div>

            <BattleSlotStrip selectedMembers={selectedMembers} slots={battle.slots} />

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

            {isWon && (
              <div className="battle-result-banner">
                <strong>战斗胜利</strong>
                <span>敌方生命已归零，我方保留战后生命值。</span>
              </div>
            )}
          </section>

          <div className="battle-bottom-actions">
            {(battle.phase === 'select' || battle.phase === 'relay') && (
              <button className="primary-button battle-start-button" disabled={!canStart} onClick={onStart}>
                {battle.phase === 'relay' ? '开始接力战斗' : '开始自动战斗'}
              </button>
            )}
            {canContinueRoute && (
              <button className="primary-button battle-start-button" onClick={onContinue}>继续路线</button>
            )}
            {isBossWon && !pendingEnhance && !pendingBossVictory && (
              <button className="primary-button battle-start-button" onClick={onBossBlessing}>进入祝福处</button>
            )}
          </div>
        </main>

        <aside className="battle-right-panel">
          <BattleLog entries={battle.log} stats={battle.stats} team={team} />
        </aside>
      </div>

      {pendingEnhance && (
        <EnhanceModal
          gold={gold}
          pending={pendingEnhance}
          team={team}
          onEnhance={onEnhance}
          onDismiss={onDismissEnhancement}
        />
      )}
      {pendingBossVictory && isBossWon && (
        <BossContinueModal tier={boss.bossTier} onBack={onBossBack} onBlessing={onBossBlessing} />
      )}
    </div>
  );
}
interface ShopScreenProps {
  gold: number;
  offers: CharacterTemplate[];
  onBuy: (template: CharacterTemplate) => void;
  onLeave: () => void;
}

function ShopScreen({ gold, offers, onBuy, onLeave }: ShopScreenProps) {
  const [pendingOffer, setPendingOffer] = useState<CharacterTemplate | null>(null);

  function confirmPurchase() {
    if (!pendingOffer) {
      return;
    }
    onBuy(pendingOffer);
    setPendingOffer(null);
  }

  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">商店</p>
        <h2>招募伙伴</h2>
        <p>商店只出售角色。购买后立即加入队伍并保持满生命值。</p>
      </div>
      {offers.length > 0 ? (
        <div className="character-grid">
          {offers.map((offer) => (
            <TemplateCard
              key={offer.id}
              template={offer}
              footer={`${offer.price}金币`}
              disabled={gold < offer.price}
              onClick={() => setPendingOffer(offer)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">当前可招募角色已经全部加入队伍。</div>
      )}
      <div className="action-row">
        <button className="primary-button" onClick={onLeave}>
          离开商店
        </button>
      </div>
      {pendingOffer && (
        <div className="modal-backdrop">
          <div className="reward-modal shop-confirm-modal">
            <p className="eyebrow">购买确认</p>
            <h2>{pendingOffer.name}</h2>
            <p>
              花费 {pendingOffer.price}金币招募该角色吗？购买后会立即加入队伍。
            </p>
            <div className="shop-confirm-preview">
              <TemplateCard template={pendingOffer} footer={`${pendingOffer.price}金币`} disabled />
            </div>
            <div className="action-row">
              <button className="secondary-button" type="button" onClick={() => setPendingOffer(null)}>
                取消
              </button>
              <button className="primary-button" type="button" disabled={gold < pendingOffer.price} onClick={confirmPurchase}>
                确认购买
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BlessingScreenProps {
  team: Character[];
  tier: BossTier;
  onContinue: () => void;
}

function BlessingScreen({ team, tier, onContinue }: BlessingScreenProps) {
  return (
    <div className="flow-screen blessing-screen modal-like-screen">
      <div className="reward-modal blessing-modal-inline">
        <p className="eyebrow">祝福处</p>
        <h2>祝福处</h2>
        <p>所有偶像复活，并且回复生命值。低于50%生命的偶像会恢复到自身生命值的50%。</p>
        <div className="character-grid compact-grid">
          {team.map((member) => (
            <CompactCharacter key={member.id} character={member} />
          ))}
        </div>
        <button className="primary-button wide-button" onClick={onContinue}>
          进入第{tier}层
        </button>
      </div>
    </div>
  );
}

interface EnhanceModalProps {
  gold: number;
  pending: { source: 'elite' | 'boss'; cost: number; free: boolean };
  team: Character[];
  onEnhance: (id: string | null) => void;
  onDismiss: () => void;
}

function EnhanceModal({ gold, pending, team, onEnhance, onDismiss }: EnhanceModalProps) {
  const candidates = team.filter((member) => !member.injured && member.hp > 0 && (member.upgradeLevel ?? 1) < maxUpgradeLevel(member.rarity));
  const canPay = pending.free || gold >= pending.cost;
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? null);
  const selected = candidates.find((member) => member.id === selectedId) ?? null;
  const sourceLabel = pending.source === 'boss' ? 'Boss胜利强化' : '精英胜利强化';
  const costLabel = pending.free ? '免费' : `${pending.cost}金币`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="reward-modal enhance-modal">
        <p className="eyebrow">强化系统</p>
        <h3>{sourceLabel}</h3>
        <p>选择一名偶像强化。白卡最多2星，紫卡和橙卡最多3星。本次费用：{costLabel}。</p>
        <div className="enhance-modal-grid">
          {candidates.map((member) => {
            const level = member.upgradeLevel ?? 1;
            const max = maxUpgradeLevel(member.rarity);
            const nextLevel = Math.min(max, level + 1);
            return (
              <button
                className={`enhance-choice rarity-${member.rarity} ${selectedId === member.id ? 'selected' : ''}`}
                disabled={!canPay}
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                type="button"
              >
                <Avatar character={member} label={member.name} />
                <div>
                  <strong>{member.name}</strong>
                  <UpgradeLevelBadge level={level} />
                  <small>悬浮查看强化效果</small>
                </div>
                <div className="upgrade-tooltip">
                  <b>当前效果</b>
                  {getUpgradeEffectLines(member.templateId, level).map((line) => <span key={`current-${line}`}>{line}</span>)}
                  <b>升级后</b>
                  {getUpgradeEffectLines(member.templateId, nextLevel).map((line) => <span key={`next-${line}`}>{line}</span>)}
                </div>
              </button>
            );
          })}
        </div>
        {candidates.length === 0 && <div className="empty-state">当前没有可强化的偶像。</div>}
        {!canPay && <div className="empty-state">金币不足，无法强化。</div>}
        <div className="action-row">
          <button className="secondary-button" onClick={onDismiss}>返回游戏</button>
          <button className="primary-button" disabled={!selected || !canPay} onClick={() => onEnhance(selected?.id ?? null)}>
            确认强化
          </button>
        </div>
      </div>
    </div>
  );
}

interface RestScreenProps {
  gold: number;
  team: Character[];
  healUsed: boolean;
  reviveUsed: boolean;
  onHeal: (id: string, healType: HealType) => void;
  onRevive: (id: string) => void;
  onLeave: () => void;
}

function RestScreen({ gold, team, healUsed, reviveUsed, onHeal, onRevive, onLeave }: RestScreenProps) {
  const smallHealAmount = HEAL_OPTIONS.small.amount;
  const largeHealText = '恢复至满血';

  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">休息处</p>
        <h2>治疗一次，复活一次</h2>
        <p>每个休息处最多执行一次治疗和一次复活。治疗可选小治疗或大治疗；复活恢复60%最大生命。</p>
      </div>
      {(healUsed || reviveUsed) && (
        <div className="empty-state">
          {healUsed ? '治疗已使用。' : '治疗还可使用。'} {reviveUsed ? '复活已使用。' : '复活还可使用。'}
        </div>
      )}
      <div className="rest-list">
        {team.map((member) => (
          <div className="rest-row" key={member.id}>
            <CompactCharacter character={member} />
            <div className="rest-actions">
              <button
                className="secondary-button"
                disabled={healUsed || member.injured || member.hp >= member.maxHp || gold < HEAL_OPTIONS.small.cost}
                onClick={() => onHeal(member.id, 'small')}
              >
                小治疗 {HEAL_OPTIONS.small.cost}金币 / {smallHealAmount}HP
              </button>
              <button
                className="secondary-button"
                disabled={healUsed || member.injured || member.hp >= member.maxHp || gold < HEAL_OPTIONS.large.cost}
                onClick={() => onHeal(member.id, 'large')}
              >
                大治疗 {HEAL_OPTIONS.large.cost}金币 / {largeHealText}
              </button>
              <button
                className="secondary-button"
                disabled={reviveUsed || !member.injured || gold < REVIVE_COST}
                onClick={() => onRevive(member.id)}
              >
                复活 {REVIVE_COST}金币
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="action-row">
        <button className="primary-button" onClick={onLeave}>
          离开休息处
        </button>
      </div>
    </div>
  );
}

interface ResultScreenProps {
  result: ResultState;
  log: string[];
  stats: BattleStats;
  team: Character[];
  onContinue: () => void;
}

function ResultScreen({ result, log, stats, team, onContinue }: ResultScreenProps) {
  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">结算</p>
        <h2>{result.title}</h2>
        <p>
          {result.body} 获得 {result.rewardGold} 金币。
        </p>
      </div>
      <DamageMeter stats={stats} team={team} title="伤害统计" />
      <BattleLog entries={log} stats={stats} team={team} />
      <div className="action-row">
        <button className="primary-button" onClick={onContinue}>
          回到地图
        </button>
      </div>
    </div>
  );
}

interface EndScreenProps {
  title: string;
  body: string;
  log: string[];
  stats?: BattleStats;
  team: Character[];
  onRestart: () => void;
}

function EndScreen({ title, body, log, stats, team, onRestart }: EndScreenProps) {
  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">本局结束</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {stats && <DamageMeter stats={stats} team={team} title="伤害统计" />}
      {log.length > 0 && <BattleLog entries={log} stats={stats} team={team} />}
      <div className="action-row">
        <button className="primary-button" onClick={onRestart}>
          再开一局
        </button>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: CharacterTemplate;
  selected?: boolean;
  disabled?: boolean;
  footer?: string;
  onClick?: () => void;
}

function TemplateCard({ template, selected = false, disabled = false, footer, onClick }: TemplateCardProps) {
  const identityLabel = template.bossTier
    ? `第${template.bossTier}层 Boss`
    : template.eliteTier
      ? `第${template.eliteTier}层精英`
      : template.enemyTier === 'weak'
        ? '弱怪'
        : template.enemyTier === 'strong'
          ? '强怪'
          : GROUP_LABELS[template.group];

  return (
    <button
      className={`character-card rarity-${template.rarity} ${selected ? 'selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Avatar character={template} label={template.name} />
      <div className="card-copy">
        <strong>{template.name}</strong>
        <div className="card-tags">
          <span className="group-tag">{identityLabel}</span>
          <span className={`rarity-tag rarity-${template.rarity}`}>{RARITY_LABELS[template.rarity]}</span>
        </div>
        <span>
          HP {template.maxHp} · 攻 {template.attack} · 速 {template.speed}
        </span>
        {template.passive && (
          <small>
            被动「{template.passive.name}」：{template.passive.description}
          </small>
        )}
        <small>
          技能「{template.skill.name}」：{template.skill.description}
        </small>
        {template.feature && <small>定位：{template.feature}</small>}
        {footer && <em>{footer}</em>}
      </div>
    </button>
  );
}

interface CharacterCardProps {
  character: Character;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function CharacterCard({ character, selected = false, disabled = false, onClick }: CharacterCardProps) {
  const identityLabel = character.bossTier
    ? `第${character.bossTier}层 Boss`
    : character.eliteTier
      ? `第${character.eliteTier}层精英`
      : character.enemyTier === 'weak'
        ? '弱怪'
        : character.enemyTier === 'strong'
          ? '强怪'
          : GROUP_LABELS[character.group];
  const level = character.upgradeLevel ?? 1;
  const upgradeLines = getUpgradeEffectLines(character.templateId, level);

  return (
    <button
      className={`character-card rarity-${character.rarity} ${selected ? 'selected' : ''} ${character.injured ? 'injured' : ''}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Avatar character={character} label={character.name.replace('敌方', '').replace('Boss ', '').replace('精英 ', '')} />
      <div className="card-copy">
        <strong>{character.name}</strong>
        <div className="card-tags">
          <span className="group-tag">{identityLabel}</span>
          <span className={`rarity-tag rarity-${character.rarity}`}>{RARITY_LABELS[character.rarity]}</span>
        </div>
        <span>
          HP {character.hp}/{character.maxHp} · 攻 {character.attack} · 速 {character.speed}
          {character.rarity !== 'enemy' && character.rarity !== 'elite' && character.rarity !== 'boss' ? ` LV${level}` : ''}
        </span>
        {(character.shield > 0 || character.poison > 0 || character.vulnerable > 0 || character.shieldGainReduced) && (
          <span>
            {character.shield > 0 ? `护盾 ${character.shield} ` : ''}
            {character.poison > 0 ? `毒 ${character.poison} ` : ''}
            {character.vulnerable > 0 ? '易损 ' : ''}
            {character.shieldGainReduced ? '护盾削弱 ' : ''}
          </span>
        )}
        {upgradeLines.length > 0 ? (
          upgradeLines.map((line) => <small key={line}>{line}</small>)
        ) : (
          <>
            {character.passive && (
              <small>
                被动「{character.passive.name}」：{character.passive.description}
              </small>
            )}
            <small>
              技能「{character.skill.name}」：{character.skill.description}
            </small>
          </>
        )}
        {character.feature && <small>定位：{character.feature}</small>}
        {character.mechanic && <small>终极机制：{character.mechanic}</small>}
        {character.injured && <em>重伤</em>}
      </div>
    </button>
  );
}

function CompactCharacter({ character }: { character: Character }) {
  const hpPercent = Math.max(0, Math.round((character.hp / character.maxHp) * 100));
  const levelText = character.rarity !== 'enemy' && character.rarity !== 'elite' && character.rarity !== 'boss'
    ? ` LV${character.upgradeLevel ?? 1}`
    : '';

  return (
    <div className={`compact-character rarity-${character.rarity} ${character.injured ? 'injured' : ''}`}>
      <Avatar character={character} label={character.name} small />
      <div className="compact-copy">
        <div>
          <div className="character-name-line compact">
            <strong>{character.name}</strong>
          </div>
          <span>{RARITY_LABELS[character.rarity]} · {GROUP_LABELS[character.group]}{levelText} · {character.injured ? '重伤' : `${character.hp}/${character.maxHp} HP`}</span>
        </div>
        <div className="hp-track" aria-label={`${character.name}生命值`}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function DamageMeter({ stats, team, title }: { stats: BattleStats; team: Character[]; title: string }) {
  const orderedStats = getOrderedStats(team, stats);
  const maxDamage = Math.max(1, ...orderedStats.map((stat) => stat.damageDealt));
  const maxTaken = Math.max(1, ...orderedStats.map((stat) => stat.damageTaken));
  const maxShieldBlocked = Math.max(1, ...orderedStats.map((stat) => stat.shieldBlocked));

  return (
    <section className="damage-meter" aria-label={title}>
      <h3>{title}</h3>
      <div className="damage-meter-list">
        {orderedStats.map((stat) => (
          <div className="damage-meter-row" key={stat.characterId}>
            <strong>{stat.name}</strong>
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
        ))}
      </div>
    </section>
  );
}

function BattleResultModal({ phase, stats, team, onClose }: { phase: BattleState['phase']; stats: BattleStats; team: Character[]; onClose: () => void }) {
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
          <button className="secondary-button" onClick={() => setShowStats((visible) => !visible)} type="button">
            {showStats ? '收起伤害统计' : '查看伤害统计'}
          </button>
          <button className="primary-button" onClick={onClose} type="button">
            返回
          </button>
        </div>
      </section>
    </div>
  );
}

function RunStatsModal({ stats, team, onClose }: { stats: BattleStats; team: Character[]; onClose: () => void }) {
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
              <h3>{stat.name}</h3>
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

function BattleLogSummary({ stats, team }: { stats?: BattleStats; team?: Character[] }) {
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

function BattleLog({ entries, stats, team }: { entries: string[]; stats?: BattleStats; team?: Character[] }) {
  const [showDetails, setShowDetails] = useState(false);
  const readableEntries = mergeConsecutiveAttacks(buildReadableBattleLog(entries));
  const visibleEntries = showDetails ? readableEntries : readableEntries.filter((entry) => entry.level !== 'detail');

  return (
    <div className="battle-log" aria-live="polite">
      <div className="battle-log-heading">
        <h3>{LOG_WORDS.title}</h3>
        <button className="ghost-button" type="button" onClick={() => setShowDetails((visible) => !visible)}>
          {showDetails ? LOG_WORDS.collapse : LOG_WORDS.expand}
        </button>
      </div>
      <BattleLogSummary stats={stats} team={team} />
      <ol>
        {visibleEntries.map((entry) => (
          <li className={`battle-log-entry log-${entry.level}`} key={entry.id}>
            <span>{entry.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
export default App;
