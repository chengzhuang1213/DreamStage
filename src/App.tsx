import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import {
  CHARACTER_POOL,
  NODE_LABELS,
  REWARD_GOLD,
  RARITY_LABELS,
  applyPostNodePassives,
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
  GROUP_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
  getBattleSlots,
  getRandomBossForTier,
  isBattleNode,
  resolveBattleGroup,
  sample,
} from './game';

type Screen = 'start' | 'draft' | 'map' | 'battle' | 'result' | 'shop' | 'rest' | 'win' | 'loss';

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
  shopOffers: CharacterTemplate[];
  restHealUsed: boolean;
  restReviveUsed: boolean;
}

type HealType = 'small' | 'large';

const HEAL_OPTIONS: Record<HealType, { label: string; cost: number; amount: number }> = {
  small: { label: '小治疗', cost: 20, amount: 50 },
  large: { label: '大治疗', cost: 40, amount: 100 },
};
const REVIVE_COST = 60;
const REVIVE_HP_RATIO = 0.6;

const DRAFT_IMAGE_BY_ID: Record<string, string> = {
  ayumu: '/cards/Image/102Uehara-Ayumu-KN13pl.png',
  rina: '/cards/Image/97Tennoji-Rina-YB8JUo.png',
  nico: '/cards/Image/18Yazawa-Nico-agidhY.png',
  kotori: '/cards/Image/9Minami-Kotori-BkWR39.png',
  keke: '/cards/Image/119Tang-Keke-4Tr0Yx.png',
  you: '/cards/Image/17Watanabe-You-En1r2L.png',
  eli: '/cards/Image/1Ayase-Eli-wRbUwD.png',
  mari: '/cards/Image/11Ohara-Mari-nI3CW6.png',
  ren: '/cards/Image/122Hazuki-Ren-fZ9vXK.png',
  yoshiko: '/cards/Image/16Tsushima-Yoshiko-NdFuZH.png',
  nozomi: '/cards/Image/15Toujou-Nozomi-S678cZ.png',
  kanata: '/cards/Image/50Konoe-Kanata-82Ei8T.png',
};

function createRun(): RunState {
  const boss = getRandomBossForTier(1);

  return {
    screen: 'start',
    candidates: createDraftCandidates(),
    draftSelection: [],
    team: [],
    gold: 40,
    map: buildMap(),
    currentNodeId: null,
    battle: null,
    boss,
    result: null,
    shopOffers: [],
    restHealUsed: false,
    restReviveUsed: false,
  };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function portraitStyle(character: Pick<Character | CharacterTemplate, 'color' | 'accent'>): CSSProperties {
  return {
    '--tone': character.color,
    '--accent': character.accent,
  } as CSSProperties;
}

function getInitial(name: string) {
  return name.slice(0, 1);
}

function draftImageSrc(template: CharacterTemplate) {
  return DRAFT_IMAGE_BY_ID[template.id] ?? template.avatar;
}

function getTemplateById(id: string) {
  return CHARACTER_POOL.find((character) => character.id === id) ?? null;
}

interface AvatarProps {
  character: Pick<Character | CharacterTemplate, 'color' | 'accent' | 'avatar'>;
  label: string;
  small?: boolean;
}

function Avatar({ character, label, small = false }: AvatarProps) {
  return (
    <div className={`avatar ${small ? 'small' : ''}`} style={portraitStyle(character)}>
      <span className="avatar-fallback">{getInitial(label)}</span>
      <img
        aria-hidden="true"
        className="avatar-image"
        src={character.avatar}
        alt=""
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
}

function App() {
  const [run, setRun] = useState<RunState>(() => createRun());

  const currentNode = useMemo(
    () => run.map.find((node) => node.id === run.currentNodeId) ?? null,
    [run.currentNodeId, run.map],
  );

  const aliveTeam = run.team.filter((member) => !member.injured && member.hp > 0);

  function resetRun() {
    setRun(createRun());
  }

  function startGame() {
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
    setRun((previous) => {
      if (previous.draftSelection.length !== 2) {
        return previous;
      }

      const team = previous.draftSelection
        .map((id) => CHARACTER_POOL.find((character) => character.id === id))
        .filter((character): character is CharacterTemplate => Boolean(character))
        .map(createAlly);

      return { ...previous, team, screen: 'map' };
    });
  }

  function enterNode(node: MapNode) {
    if (!node.available || node.completed) {
      return;
    }

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
        const battle: BattleState = {
          nodeId: node.id,
          type: battleType,
          enemies: createEnemiesForBattle(battleType, previous.boss),
          activeEnemyIndex: 0,
          selectedIds: [],
          slots,
          phase: 'select',
          rewardGold: REWARD_GOLD[battleType],
          log: [`遭遇${NODE_LABELS[battleType]}。先确认敌人，再选择${slots}名出战伙伴。`],
          runtime: {},
        };

        return {
          ...previous,
          screen: 'battle',
          currentNodeId: node.id,
          battle,
          result: null,
          restHealUsed: false,
          restReviveUsed: false,
        };
      }

      if (node.type === 'shop') {
        const ownedIds = new Set(previous.team.map((member) => member.templateId));
        const shopOffers = sample(
          CHARACTER_POOL.filter((character) => !ownedIds.has(character.id)),
          3,
        );

        return {
          ...previous,
          screen: 'shop',
          currentNodeId: node.id,
          shopOffers,
          result: null,
          restHealUsed: false,
          restReviveUsed: false,
        };
      }

      return {
        ...previous,
        screen: 'rest',
        currentNodeId: node.id,
        result: null,
        restHealUsed: false,
        restReviveUsed: false,
      };
    });
  }

  function finishCurrentNode() {
    setRun((previous) => {
      if (!previous.currentNodeId) {
        return { ...previous, screen: 'map' };
      }

      const team = applyPostNodePassives(previous.team);
      const clearedNodeMap = completeMapNode(previous.map, previous.currentNodeId);
      const shouldAdvanceLayer =
        previous.battle?.type === 'boss' &&
        previous.battle.phase === 'won' &&
        previous.boss.bossTier < 3;

      if (shouldAdvanceLayer) {
        const nextTier = (previous.boss.bossTier + 1) as BossTier;
        return {
          ...previous,
          screen: 'map',
          team,
          map: buildMap(),
          currentNodeId: null,
          battle: null,
          boss: getRandomBossForTier(nextTier),
          result: null,
          shopOffers: [],
          restHealUsed: false,
          restReviveUsed: false,
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
      };
    });
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
        const isBossBattle = battle.type === 'boss';
        const isFinalBoss = isBossBattle && previous.boss.bossTier === 3;
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
          screen: isFinalBoss ? 'win' : 'result',
        };
      }

      if (battle.phase === 'lost') {
        return {
          ...previous,
          team,
          battle,
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

  function buyCharacter(template: CharacterTemplate) {
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
      const healAmount = heal.amount;
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
      <div className="app-shell start-shell">
        <StartScreen onStart={startGame} />
      </div>
    );
  }

  if (run.screen === 'draft') {
    return (
      <div className="app-shell draft-shell">
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

  return (
    <div className="app-shell game-shell">
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
          {run.screen === 'map' && <MapScreen nodes={run.map} boss={run.boss} onEnter={enterNode} />}

          {run.screen === 'battle' && run.battle && (
            <BattleScreen
              battle={run.battle}
              team={run.team}
              onToggleSelection={toggleBattleSelection}
              onStart={startBattle}
            />
          )}

          {run.screen === 'result' && run.result && run.battle && (
            <ResultScreen result={run.result} log={run.battle.log} onContinue={finishCurrentNode} />
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

          {run.screen === 'win' && run.battle && (
            <EndScreen
              title="胜利"
              body="Boss战完成，Beta角色构筑循环已经跑通。"
              log={run.battle.log}
              onRestart={resetRun}
            />
          )}

          {run.screen === 'loss' && (
            <EndScreen
              title="失败"
              body="所有伙伴都进入重伤状态。下一局可以更早休息或招募。"
              log={run.battle?.log ?? []}
              onRestart={resetRun}
            />
          )}
        </section>
      </main>

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
}

function BondItem({ name, count, total, subtitle, details, memberIds, ownedIds, active, secondary = false }: BondItemProps) {
  return (
    <div className={`bond-item ${active ? 'active' : ''} ${secondary && active ? 'secondary-active' : ''}`}>
      <div>
        <strong>
          {name} {count}/{total}
        </strong>
        <span>{subtitle}</span>
      </div>
      {details.map((detail) => (
        <small key={detail}>{detail}</small>
      ))}
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
                  details={activeBond.active ? [activeBond.bond.description] : ['再集齐1名成员激活。']}
                  key={activeBond.bond.id}
                  memberIds={activeBond.bond.memberIds}
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
      <DraftBondPreview selectedCharacters={selectedCandidates} />
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
        <p className="eyebrow">羁绊预览</p>
        <h3>当前选择可触发的羁绊</h3>
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
            details={[activeBond.bond.description]}
            key={activeBond.bond.id}
            memberIds={activeBond.bond.memberIds}
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
          <span className="group-tag">{GROUP_LABELS[template.group]}</span>
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

interface MapScreenProps {
  nodes: MapNode[];
  boss: BossTemplate;
  onEnter: (node: MapNode) => void;
}

function BossForecast({ boss }: { boss: BossTemplate }) {
  return (
    <section className="boss-forecast" aria-label="本层 Boss 预告">
      <div className="boss-forecast-copy">
        <p className="eyebrow">第{boss.bossTier}层 Boss 预告</p>
        <h3>{boss.name}</h3>
        <p>{boss.feature}</p>
      </div>
      <div className="character-card boss-preview-card rarity-boss">
        <Avatar character={boss} label={boss.name} />
        <div className="card-copy">
          <strong>{boss.name}</strong>
          <div className="card-tags">
            <span className="group-tag">第一层 Boss</span>
            <span className="rarity-tag rarity-boss">{RARITY_LABELS[boss.rarity]}</span>
          </div>
          <span>HP {boss.maxHp} · 攻 {boss.attack} · 速 {boss.speed}</span>
          {boss.passive && <small>被动「{boss.passive.name}」：{boss.passive.description}</small>}
          <small>技能「{boss.skill.name}」：{boss.skill.description}</small>
          {boss.mechanic && <small>终极机制：{boss.mechanic}</small>}
        </div>
      </div>
    </section>
  );
}

function MapScreen({ nodes, boss, onEnter }: MapScreenProps) {
  const rows = useMemo(
    () =>
      unique(nodes.map((node) => node.row)).map((row) => ({
        row,
        nodes: nodes.filter((node) => node.row === row),
      })),
    [nodes],
  );

  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">第{boss.bossTier}层路线规划</p>
        <h2>选择下一站</h2>
        <p>本层Boss已预告。已完成节点会锁定路线，只能进入亮起的相邻节点。</p>
      </div>
      <BossForecast boss={boss} />
      <div className="map-board">
        {rows.map((row) => (
          <div className="map-row" key={row.row}>
            {row.nodes.map((node) => (
              <button
                className={`map-node node-${node.type}`}
                disabled={!node.available || node.completed}
                key={node.id}
                onClick={() => onEnter(node)}
              >
                <span>{NODE_LABELS[node.type]}</span>
                <small>{node.completed ? '已完成' : node.available ? '可进入' : '未连接'}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface BattleScreenProps {
  battle: BattleState;
  team: Character[];
  onToggleSelection: (id: string) => void;
  onStart: () => void;
}

function BattleScreen({ battle, team, onToggleSelection, onStart }: BattleScreenProps) {
  const aliveMembers = team.filter((member) => !member.injured && member.hp > 0);
  const activeEnemy = battle.enemies[battle.activeEnemyIndex];

  return (
    <div className="flow-screen battle-screen">
      <div className="screen-heading">
        <p className="eyebrow">{NODE_LABELS[battle.type]}</p>
        <h2>{battle.type === 'boss' ? '3v1 Boss战' : battle.type === 'elite' ? '2v1 精英战' : '1v1 普通战斗'}</h2>
        <p>所选角色会同时出战。敌人生命会保留，角色重伤后必须在休息处复活。</p>
      </div>

      <div className="battle-columns">
        <div>
          <h3>敌人</h3>
          <div className="character-grid compact-grid">
            {battle.enemies.map((enemy, index) => (
              <CharacterCard
                key={enemy.id}
                character={enemy}
                selected={index === battle.activeEnemyIndex && battle.phase !== 'won'}
                disabled={enemy.hp <= 0}
              />
            ))}
          </div>
        </div>

        <div>
          {(battle.phase === 'select' || battle.phase === 'relay') && (
            <>
              <h3>
                {battle.phase === 'relay' ? '接力出战' : '选择出战角色'} {battle.selectedIds.length}/{battle.slots}
              </h3>
              {battle.phase === 'relay' && activeEnemy && (
                <div className="relay-note">
                  {activeEnemy.name} 剩余 {activeEnemy.hp}/{activeEnemy.maxHp} HP。
                </div>
              )}
              <div className="character-grid compact-grid">
                {(battle.phase === 'relay' ? aliveMembers : team).map((member) => (
                  <CharacterCard
                    key={member.id}
                    character={member}
                    selected={battle.selectedIds.includes(member.id)}
                    disabled={member.injured || member.hp <= 0}
                    onClick={() => onToggleSelection(member.id)}
                  />
                ))}
              </div>
              <button
                className="primary-button wide-button"
                disabled={battle.selectedIds.length !== battle.slots}
                onClick={onStart}
              >
                {battle.phase === 'relay' ? '开始接力战斗' : '开始自动战斗'}
              </button>
            </>
          )}
        </div>
      </div>

      <BattleLog entries={battle.log} />
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
              onClick={() => onBuy(offer)}
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
  const largeHealAmount = HEAL_OPTIONS.large.amount;

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
                大治疗 {HEAL_OPTIONS.large.cost}金币 / {largeHealAmount}HP
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
  onContinue: () => void;
}

function ResultScreen({ result, log, onContinue }: ResultScreenProps) {
  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">结算</p>
        <h2>{result.title}</h2>
        <p>
          {result.body} 获得 {result.rewardGold} 金币。
        </p>
      </div>
      <BattleLog entries={log} />
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
  onRestart: () => void;
}

function EndScreen({ title, body, log, onRestart }: EndScreenProps) {
  return (
    <div className="flow-screen">
      <div className="screen-heading">
        <p className="eyebrow">本局结束</p>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {log.length > 0 && <BattleLog entries={log} />}
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
        </span>
        {(character.shield > 0 || character.poison > 0 || character.vulnerable > 0 || character.shieldGainReduced) && (
          <span>
            {character.shield > 0 ? `护盾 ${character.shield} ` : ''}
            {character.poison > 0 ? `毒 ${character.poison} ` : ''}
            {character.vulnerable > 0 ? '易损 ' : ''}
            {character.shieldGainReduced ? '护盾削弱 ' : ''}
          </span>
        )}
        {character.passive && (
          <small>
            被动「{character.passive.name}」：{character.passive.description}
          </small>
        )}
        <small>
          技能「{character.skill.name}」：{character.skill.description}
        </small>
        {character.feature && <small>定位：{character.feature}</small>}
        {character.mechanic && <small>终极机制：{character.mechanic}</small>}
        {character.injured && <em>重伤</em>}
      </div>
    </button>
  );
}

function CompactCharacter({ character }: { character: Character }) {
  const hpPercent = Math.max(0, Math.round((character.hp / character.maxHp) * 100));

  return (
    <div className={`compact-character rarity-${character.rarity} ${character.injured ? 'injured' : ''}`}>
      <Avatar character={character} label={character.name} small />
      <div className="compact-copy">
        <div>
          <strong>{character.name}</strong>
          <span>{RARITY_LABELS[character.rarity]} · {GROUP_LABELS[character.group]} · {character.injured ? '重伤' : `${character.hp}/${character.maxHp} HP`}</span>
        </div>
        <div className="hp-track" aria-label={`${character.name}生命值`}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>
      </div>
    </div>
  );
}

function BattleLog({ entries }: { entries: string[] }) {
  const visibleEntries = entries.slice(-18);

  return (
    <div className="battle-log" aria-live="polite">
      <h3>战斗日志</h3>
      <ol>
        {visibleEntries.map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </div>
  );
}

export default App;

