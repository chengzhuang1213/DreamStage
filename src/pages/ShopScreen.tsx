import { useEffect, useRef, useState } from 'react';
import type { Character, CharacterTemplate } from '../game';
import { GROUP_LABELS, RARITY_LABELS, ROLE_LABELS, getActiveBonds, getActiveSecondaryBonds } from '../game';
import { BOND_LOGO_SRC, DRAFT_IMAGE_BY_ID } from '../assets';
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
  onBuy: (template: CharacterTemplate) => void;
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
  const [goldPulse, setGoldPulse] = useState(false);
  const previousGoldRef = useRef(gold);
  const isMobileShop = useMobileShopMode();
  const pendingOfferAvailable = pendingOffer ? offers.some((offer) => offer.id === pendingOffer.id) : false;
  const canConfirmPurchase = Boolean(pendingOffer && pendingOfferAvailable && gold >= pendingOffer.price);
  const canBuySelectedOffer = Boolean(selectedOffer && offers.some((offer) => offer.id === selectedOffer.id) && gold >= selectedOffer.price);

  function confirmPurchase() {
    if (!pendingOffer || !canConfirmPurchase) {
      return;
    }
    onBuy(pendingOffer);
    setPendingOffer(null);
    onSelectOffer(null);
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
        <div className="shop-resource-bar">
          <div className={`shop-resource-pill gold-pill ${goldPulse ? 'resource-pulse' : ''}`}>
            <span>◎</span>
            <strong>金币 {gold}</strong>
          </div>
        </div>
      </div>

      <div className="shop-recruit-panel">
        <div className="shop-title-block">
          <h2>✦ 招募伙伴 ✦</h2>
          <p>招募新伙伴加入队伍，开启新的巡演之旅！</p>
        </div>
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
      <ShopRunPreview team={team} />
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
              花费 {pendingOffer.price}金币招募该角色吗？购买后会立即加入队伍。
            </p>
            {!canConfirmPurchase && (
              <div className="empty-state shop-confirm-warning">
                金币不足，当前无法购买。
              </div>
            )}
            <div className="shop-confirm-preview">
              <ShopDetailCharacter character={pendingOffer} upgradeMode="changes" />
            </div>
            <div className="action-row">
              <button className="secondary-button" type="button" onClick={() => setPendingOffer(null)}>
                取消
              </button>
              <button className="primary-button" type="button" disabled={!canConfirmPurchase} onClick={confirmPurchase}>
                确认购买 {pendingOffer.price}金币
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopRunPreview({ team }: { team: Character[] }) {
  const slots = Array.from({ length: 4 }, (_, index) => team[index] ?? null);
  const primaryBonds = getActiveBonds(team).filter((bond) => bond.count > 0);
  const secondaryBonds = getActiveSecondaryBonds(team).filter((bond) => bond.count > 0);
  const visibleBonds = [
    ...primaryBonds.map((bond) => ({
      id: bond.group.id,
      name: bond.group.name,
      count: bond.count,
      total: 3,
      active: bond.level > 0,
      logoSrc: BOND_LOGO_SRC[bond.group.id],
    })),
    ...secondaryBonds.map((activeBond) => ({
      id: activeBond.bond.id,
      name: activeBond.bond.name,
      count: activeBond.count,
      total: 2,
      active: activeBond.active,
      logoSrc: BOND_LOGO_SRC[activeBond.bond.id],
    })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count || right.total - left.total);

  return (
    <section className="shop-run-preview" aria-label="当前队伍和羁绊">
      <div>
        <strong>已有成员</strong>
        <div className="shop-team-strip">
          {slots.map((member, index) => member ? (
            <div className={`shop-team-chip rarity-${member.rarity} ${member.injured ? 'injured' : ''}`} key={member.id}>
              <Avatar character={member} label={member.name} small />
              <span>{member.name}</span>
              <small>{member.injured ? '重伤' : `${member.hp}/${member.maxHp}`}</small>
            </div>
          ) : (
            <div className="shop-team-chip empty" key={`empty-${index}`}>空位</div>
          ))}
        </div>
      </div>
      <div>
        <strong>羁绊</strong>
        <div className="shop-bond-strip">
          {visibleBonds.length > 0 ? visibleBonds.map((bond) => (
            <div className={`shop-bond-chip ${bond.active ? 'active' : 'inactive'}`} key={bond.id}>
              {bond.logoSrc && <img src={bond.logoSrc} alt="" />}
              <span>{bond.name}</span>
              <small>{bond.count}/{bond.total}</small>
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
        <h3>{template.name}</h3>
        <div className="shop-offer-stats">
          <span>HP <strong>{template.maxHp}</strong></span>
          <span>攻 <strong>{template.attack}</strong></span>
          <span>速 <strong>{template.speed}</strong></span>
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
