import { useEffect, useRef, useState } from 'react';
import type { Character, CharacterTemplate } from '../game';
import { CHARACTER_POOL, GROUP_LABELS, RARITY_LABELS, ROLE_LABELS, SECONDARY_BONDS, getActiveBonds, getActiveSecondaryBonds } from '../game';
import { BOND_LOGO_SRC, DRAFT_IMAGE_BY_ID, bondBackgroundStyle } from '../assets';
import { Avatar } from '../components/common';
import { getEnhancementChangeLines, getUpgradeEffectLines, HighlightText, maxUpgradeLevel } from '../game/data/upgrades';

function draftImageSrc(character: CharacterTemplate | Character) {
  const templateId = 'templateId' in character ? character.templateId : character.id;
  return DRAFT_IMAGE_BY_ID[templateId] ?? character.avatar;
}

export interface ShopScreenProps {
  gold: number;
  offers: CharacterTemplate[];
  team: Character[];
  selectedOffer: CharacterTemplate | null;
  onSelectOffer: (template: CharacterTemplate | null) => void;
  onBuy: (template: CharacterTemplate, replaceMemberId?: string) => void;
  onLeave: () => void;
}

function useMobileShopMode() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export function ShopScreen({ gold, offers, team, selectedOffer, onSelectOffer, onBuy, onLeave }: ShopScreenProps) {
  const [pendingOffer, setPendingOffer] = useState<CharacterTemplate | null>(null);
  const [replaceMemberId, setReplaceMemberId] = useState<string | null>(null);
  const [goldPulse, setGoldPulse] = useState(false);
  const previousGoldRef = useRef(gold);
  const isMobileShop = useMobileShopMode();
  const pendingOfferAvailable = pendingOffer ? offers.some((offer) => offer.id === pendingOffer.id) : false;
  const needsReplacement = team.length >= 4;
  const canConfirmPurchase = Boolean(pendingOffer && pendingOfferAvailable && gold >= pendingOffer.price && (!needsReplacement || replaceMemberId));
  const canBuySelectedOffer = Boolean(selectedOffer && offers.some((offer) => offer.id === selectedOffer.id) && gold >= selectedOffer.price);

  function confirmPurchase() {
    if (!pendingOffer || !canConfirmPurchase) {
      return;
    }
    onBuy(pendingOffer, replaceMemberId ?? undefined);
    setPendingOffer(null);
    setReplaceMemberId(null);
    onSelectOffer(null);
  }

  function closePurchaseConfirm() {
    setPendingOffer(null);
    setReplaceMemberId(null);
  }

  useEffect(() => {
    if (previousGoldRef.current === gold) {
      return;
    }

    previousGoldRef.current = gold;
    setGoldPulse(true);
    const timer = window.setTimeout(() => setGoldPulse(false), 620);
    return () => window.clearTimeout(timer);
  }, [gold]);

  return (
    <div className="flow-screen shop-screen">
      <div className="shop-header">
        <div className="shop-title-block">
          <p className="eyebrow">DreamStage Tour</p>
          <h2>招募伙伴</h2>
          <p>选择一位伙伴加入队伍，开启新的巡演之旅！</p>
        </div>
        <div className="shop-resource-bar">
          <div className={`shop-resource-pill gold-pill ${goldPulse ? 'resource-pulse' : ''}`}>
            <span>◎</span>
            <strong>金币 {gold}</strong>
          </div>
        </div>
      </div>

      <div className="shop-main-stage">
        <ShopRunPreview team={team} selectedOffer={selectedOffer} />
        <div className="shop-recruit-panel">
          <div className="shop-note">每次商店可招募 1 位伙伴。购买后会加入当前队伍。</div>
          {offers.length > 0 ? (
            <div className="shop-offer-grid">
              {offers.map((offer) => (
                <ShopOfferCard
                  key={offer.id}
                  template={offer}
                  selected={selectedOffer?.id === offer.id}
                  unaffordable={gold < offer.price}
                  onClick={() => {
                    onSelectOffer(offer);
                    setReplaceMemberId(null);
                    if (isMobileShop) {
                      setPendingOffer(offer);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">当前可招募角色已经全部加入队伍。</div>
          )}
        </div>
      </div>
      <div className="shop-bottom-actions">
        {selectedOffer && (
          <button
            className="primary-button shop-buy-button"
            type="button"
            disabled={!canBuySelectedOffer}
            onClick={() => setPendingOffer(selectedOffer)}
          >
              购买 {selectedOffer.price}金币
          </button>
        )}
        <button className="primary-button shop-leave-button" onClick={onLeave}>
        离开商店
        </button>
      </div>
      {pendingOffer && (
        <div className="modal-backdrop">
          <div className="reward-modal shop-confirm-modal">
            <p className="eyebrow">购买确认</p>
            <h2>{pendingOffer.name}</h2>
            <p>
              {team.length >= 4
                ? `花费 ${pendingOffer.price}金币招募${pendingOffer.name}，并替换一位当前成员。`
                : `花费 ${pendingOffer.price}金币招募该角色吗？购买后会立即加入队伍。`}
            </p>
            {!canConfirmPurchase && (
              <div className="empty-state shop-confirm-warning">
                {gold < pendingOffer.price ? '金币不足，当前无法购买。' : '队伍已满，请选择一位成员替换。'}
              </div>
            )}
            {team.length >= 4 && (
              <div className="shop-replace-picker">
                <strong>选择要替换的成员</strong>
                <div className="shop-replace-grid">
                  {team.map((member) => (
                    <button
                      className={`shop-replace-card rarity-${member.rarity} ${replaceMemberId === member.id ? 'selected' : ''}`}
                      key={member.id}
                      onClick={() => setReplaceMemberId(member.id)}
                      type="button"
                    >
                      <Avatar character={member} label={member.name} small />
                      <span>{member.name}</span>
                      <small>LV{member.upgradeLevel ?? 1} · {member.hp}/{member.maxHp} HP</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="shop-confirm-preview">
              <ShopDetailCharacter character={pendingOffer} upgradeMode="changes" />
            </div>
            <div className="action-row">
              <button className="secondary-button" type="button" onClick={closePurchaseConfirm}>
                取消
              </button>
              <button className="primary-button" type="button" disabled={!canConfirmPurchase} onClick={confirmPurchase}>
                {team.length >= 4 ? `确认替换 ${pendingOffer.price}金币` : `确认购买 ${pendingOffer.price}金币`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TEMPLATE_BY_ID = new Map(CHARACTER_POOL.map((template) => [template.id, template]));

function getCharacterTemplateId(character: Character | CharacterTemplate) {
  return 'templateId' in character ? character.templateId : character.id;
}

function getCharacterHp(character: Character | CharacterTemplate) {
  return 'hp' in character ? character.hp : character.maxHp;
}

function getMemberTooltip(character: Character | CharacterTemplate) {
  const level = 'upgradeLevel' in character ? character.upgradeLevel : 1;
  return `${character.name}｜LV${level}｜HP ${getCharacterHp(character)}/${character.maxHp}｜${GROUP_LABELS[character.group]}｜${ROLE_LABELS[character.role ?? 'fighter']}。${character.passive ? ` 被动：${character.passive.name}。` : ''} 技能：${character.skill.name}。`;
}

function getMemberBondChips(character: Character | CharacterTemplate) {
  const id = getCharacterTemplateId(character);
  return [
    { id: character.group, name: GROUP_LABELS[character.group] },
    ...SECONDARY_BONDS.filter((bond) => bond.memberIds.includes(id)).map((bond) => ({ id: bond.id, name: bond.name })),
  ];
}

function ShopRunPreview({ team, selectedOffer }: { team: Character[]; selectedOffer: CharacterTemplate | null }) {
  const previewTeam = selectedOffer && team.length < 4 && !team.some((member) => member.templateId === selectedOffer.id)
    ? [...team, selectedOffer]
    : team;
  const slots = Array.from({ length: 4 }, (_, index) => previewTeam[index] ?? null);
  const primaryBonds = getActiveBonds(previewTeam).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(previewTeam).filter((bond) => bond.count > 0);
  const selectedId = selectedOffer?.id;
  const visibleBonds = [
    ...primaryBonds.map((bond) => ({
      id: bond.group.id,
      name: bond.group.name,
      count: bond.count,
      total: 3,
      active: bond.level > 0,
      logoSrc: BOND_LOGO_SRC[bond.group.id],
      memberIds: bond.group.memberIds,
      description: `${bond.group.level2Name}：${bond.group.level2Description} ${bond.group.level3Name}：${bond.group.level3Description}`,
    })),
    ...secondaryBonds.map((activeBond) => ({
      id: activeBond.bond.id,
      name: activeBond.bond.name,
      count: activeBond.count,
      total: 2,
      active: activeBond.active,
      logoSrc: BOND_LOGO_SRC[activeBond.bond.id],
      memberIds: activeBond.bond.memberIds,
      description: activeBond.bond.description,
    })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count || right.total - left.total);

  return (
    <section className={`shop-run-preview ${selectedOffer ? 'has-shop-preview' : ''}`} aria-label="当前队伍和羁绊">
      <div className="shop-run-section shop-team-section" key={`team-${selectedId ?? 'none'}`}>
        <strong>已有成员</strong>
        <div className="shop-team-strip">
          {slots.map((member, index) => member ? (
            <div
              className={`shop-team-chip rarity-${member.rarity} ${'injured' in member && member.injured ? 'injured' : ''} ${getCharacterTemplateId(member) === selectedId ? 'incoming' : ''}`}
              data-tooltip={getMemberTooltip(member)}
              key={'templateId' in member ? member.id : `offer-${member.id}`}
              tabIndex={0}
            >
              <Avatar character={member} label={member.name} small />
              <div className="shop-team-copy">
                <span>{member.name}</span>
                <small>{'injured' in member && member.injured ? '重伤' : `HP ${getCharacterHp(member)}/${member.maxHp}`}</small>
                <div className="shop-hp-track" aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(100, Math.round((getCharacterHp(member) / member.maxHp) * 100)))}%` }} />
                </div>
              </div>
              <div className="shop-member-bonds" aria-label={`${member.name}羁绊`}>
                {getMemberBondChips(member).map((bond) => (
                  <span className="shop-member-bond-pill" key={bond.id}>{bond.name}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="shop-team-chip empty" key={`empty-${index}`}>
              <span className="shop-empty-plus" aria-hidden="true">+</span>
              <span>空位</span>
            </div>
          ))}
        </div>
      </div>
      <div className="shop-run-section shop-bond-section" key={`bonds-${selectedId ?? 'none'}`}>
        <strong>当前羁绊</strong>
        <div className="shop-bond-strip">
          {visibleBonds.length > 0 ? visibleBonds.map((bond) => (
            <div
              className={`shop-bond-chip bond-theme-card ${bond.active ? 'active' : 'inactive'} ${selectedOffer && bond.memberIds.includes(selectedOffer.id) ? 'bond-preview-jump' : ''}`}
              data-tooltip={`${bond.name} ${bond.count}/${bond.total}。${bond.description}`}
              key={bond.id}
              style={bondBackgroundStyle(bond.id)}
              tabIndex={0}
            >
              {bond.logoSrc && <img src={bond.logoSrc} alt="" />}
              <span>{bond.name}</span>
              <small>{bond.count}/{bond.total}</small>
              <div className="shop-bond-members" aria-label={`${bond.name}需要成员`}>
                {bond.memberIds.map((memberId) => {
                  const member = TEMPLATE_BY_ID.get(memberId);
                  return member ? (
                    <img className={previewTeam.some((owned) => getCharacterTemplateId(owned) === memberId) ? 'owned' : ''} src={member.avatar} alt={member.name} key={memberId} />
                  ) : null;
                })}
              </div>
            </div>
          )) : (
            <div className="shop-bond-chip empty">暂无羁绊</div>
          )}
        </div>
      </div>
    </section>
  );
}

function ShopOfferCard({ template, selected, unaffordable, onClick }: { template: CharacterTemplate; selected?: boolean; unaffordable?: boolean; onClick?: () => void }) {
  const upgradeLines = getUpgradeEffectLines(template.id, 1).slice(0, 1);

  return (
    <button className={`shop-offer-card rarity-${template.rarity} ${selected ? 'selected' : ''} ${unaffordable ? 'unaffordable' : ''}`} onClick={onClick} type="button">
      <div className="shop-offer-portrait">
        <img
          alt=""
          src={draftImageSrc(template)}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="shop-offer-body">
        <span className="shop-rarity-mark">{RARITY_LABELS[template.rarity]}</span>
        <h3>{template.name}</h3>
        <div className="shop-offer-stats">
          <span>HP <strong>{template.maxHp}</strong></span>
          <span>攻 <strong>{template.attack}</strong></span>
          <span>速 <strong>{template.speed}</strong></span>
        </div>
        <div className="shop-offer-skill">
          <strong>{template.passive ? `被动技能｜${template.passive.name}` : `主动技能｜${template.skill.name}`}</strong>
          <p>{template.passive ? template.passive.description : template.skill.description}</p>
          {upgradeLines.length > 0 && <small>{upgradeLines.join('；')}</small>}
        </div>
      </div>
      <div className="shop-price-button">
        <span>◎</span>
        <strong>{template.price}</strong>
      </div>
    </button>
  );
}

function ShopDetailModal({ team, offers, onClose }: { team: Character[]; offers: CharacterTemplate[]; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="reward-modal shop-detail-modal">
        <p className="eyebrow">商店详细</p>
        <h2>完整信息</h2>
        <p>这里展示当前队伍与本次可招募角色的完整技能、被动和升级效果。</p>
        <div className="shop-detail-sections">
          <section>
            <h3>当前队伍</h3>
            <div className="shop-detail-grid">
              {team.map((member) => <ShopDetailCharacter key={member.id} character={member} />)}
            </div>
          </section>
          <section>
            <h3>可招募</h3>
            <div className="shop-detail-grid">
              {offers.map((offer) => <ShopDetailCharacter key={offer.id} character={offer} />)}
            </div>
          </section>
        </div>
        <div className="action-row">
          <button className="primary-button" type="button" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}

function ShopDetailCharacter({ character, upgradeMode = 'full' }: { character: Character | CharacterTemplate; upgradeMode?: 'full' | 'changes' }) {
  const level = 'upgradeLevel' in character ? character.upgradeLevel : 1;
  const maxLevel = maxUpgradeLevel(character.rarity);
  const templateId = 'templateId' in character ? character.templateId : character.id;
  const upgradeLevels = Array.from({ length: Math.max(0, maxLevel - level) }, (_, index) => level + index + 1);

  return (
    <article className={`shop-detail-card rarity-${character.rarity}`}>
      <div className="shop-detail-portrait">
        <img
          alt=""
          src={draftImageSrc(character)}
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      </div>
      <div className="shop-detail-copy">
        <h4>{character.name}</h4>
        <span>LV{level} · {RARITY_LABELS[character.rarity]} · {GROUP_LABELS[character.group]}{character.role ? ` · ${ROLE_LABELS[character.role]}` : ''}</span>
        <b>HP {character.maxHp} · 攻 {character.attack} · 速 {character.speed}</b>
        {character.passive && <p>被动「{character.passive.name}」：{character.passive.description}</p>}
        <p>技能「{character.skill.name}」：{character.skill.description}</p>
        <div className="shop-upgrade-lines">
          <strong>{upgradeMode === 'changes' ? '升级变化' : '升级效果'}</strong>
          {upgradeMode === 'changes' ? (
            upgradeLevels.length > 0 ? upgradeLevels.map((targetLevel) => (
              <small key={targetLevel}>LV{targetLevel}：<HighlightText text={getEnhancementChangeLines(templateId, targetLevel).join('；')} /></small>
            )) : (
              <small>已达到最高等级。</small>
            )
          ) : (
            Array.from({ length: maxLevel }, (_, index) => index + 1).map((targetLevel) => (
              <small key={targetLevel}>LV{targetLevel}：{getUpgradeEffectLines(templateId, targetLevel).join('；') || '基础效果'}</small>
            ))
          )}
        </div>
      </div>
    </article>
  );
}
