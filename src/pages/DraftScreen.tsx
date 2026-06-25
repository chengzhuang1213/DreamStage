import { useEffect, useState } from 'react';
import type { CharacterTemplate } from '../game';
import {
  BOND_GROUPS,
  GROUP_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  SECONDARY_BONDS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC, DRAFT_IMAGE_BY_ID } from '../assets';
import { BondItem, BondTag } from '../components/bonds';
import { groupDetail, InfoPill, rarityDetail, roleDetail } from '../components/info';
import { getCompactAbilityDescription, getUpgradeEffectLines } from '../game/data/upgrades';

function draftImageSrc(template: CharacterTemplate) {
  return DRAFT_IMAGE_BY_ID[template.id] ?? template.avatar;
}

function getSecondaryBondsForTemplate(templateId: string) {
  return SECONDARY_BONDS.filter((bond) => bond.memberIds.includes(templateId));
}

function getBondGroupForTemplate(template: CharacterTemplate) {
  return BOND_GROUPS.find((group) => group.id === template.group) ?? null;
}

export interface DraftScreenProps {
  candidates: CharacterTemplate[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onReroll: () => void;
  onConfirm: () => void;
}

function useMobileDraftMode() {
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

export function DraftScreen({ candidates, selectedIds, onToggle, onReroll, onConfirm }: DraftScreenProps) {
  const visibleCandidates = candidates.slice(0, 3);
  const selectedCandidates = visibleCandidates.filter((candidate) => selectedIds.includes(candidate.id));
  const isMobileDraft = useMobileDraftMode();
  const [detailCandidate, setDetailCandidate] = useState<CharacterTemplate | null>(null);

  function handleCandidateClick(candidate: CharacterTemplate) {
    if (isMobileDraft) {
      setDetailCandidate(candidate);
      return;
    }

    onToggle(candidate.id);
  }

  function confirmCandidate(candidate: CharacterTemplate) {
    onToggle(candidate.id);
    setDetailCandidate(null);
  }

  return (
    <main className="draft-page">
      <div className="draft-toolbar">
        <div className="screen-heading">
          <p className="eyebrow">初始伙伴</p>
          <h2>选择 2 名偶像开局</h2>
          <p>本次候选 {visibleCandidates.length}/3，已选择 {selectedIds.length}/2。</p>
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
      <div className="draft-stage">
        <DraftBondPreview selectedCharacters={selectedCandidates} />
        <div className="draft-grid">
          {visibleCandidates.map((candidate) => (
            <DraftCandidateCard
              key={candidate.id}
              template={candidate}
              selected={selectedIds.includes(candidate.id)}
              onClick={() => handleCandidateClick(candidate)}
            />
          ))}
        </div>
      </div>
      {detailCandidate && (
        <DraftCandidateDetailModal
          selected={selectedIds.includes(detailCandidate.id)}
          template={detailCandidate}
          onClose={() => setDetailCandidate(null)}
          onConfirm={() => confirmCandidate(detailCandidate)}
        />
      )}
    </main>
  );
}

function DraftBondPreview({ selectedCharacters }: { selectedCharacters: CharacterTemplate[] }) {
  const ownedIds = new Set(selectedCharacters.map((character) => character.id));
  const bonds = getActiveBonds(selectedCharacters);
  const secondaryBonds = getActiveSecondaryBonds(selectedCharacters);

  return (
    <section className={`draft-bonds ${selectedCharacters.length > 0 ? 'has-selection' : ''}`}>
      <div className="draft-bonds-heading">
        <p className="eyebrow">羁绊说明</p>
        <h3>{selectedCharacters.length > 0 ? '已选成员羁绊' : '选择成员后显示'}</h3>
        {selectedCharacters.length === 0 && <span>左侧会展示本次开局候选的详细羁绊进度。</span>}
      </div>
      <div className="draft-bond-grid">
        {bonds.map((bond) => (
          <BondItem
            active={bond.level > 0}
            count={bond.count}
            details={[
              `2人：${bond.group.level2Description}`,
              `3人：${bond.group.level3Description}`,
            ]}
            key={bond.group.id}
            bondId={bond.group.id}
            memberIds={bond.group.memberIds}
            logoSrc={BOND_LOGO_SRC[bond.group.id]}
            name={bond.group.name}
            ownedIds={ownedIds}
            total={3}
          />
        ))}
        {secondaryBonds.map((activeBond) => (
          <BondItem
            active={activeBond.active}
            count={activeBond.count}
            details={[activeBond.bond.description]}
            key={activeBond.bond.id}
            bondId={activeBond.bond.id}
            memberIds={activeBond.bond.memberIds}
            logoSrc={BOND_LOGO_SRC[activeBond.bond.id]}
            name={activeBond.bond.name}
            ownedIds={ownedIds}
            secondary
            total={2}
          />
        ))}
        {selectedCharacters.length > 0 && bonds.length === 0 && secondaryBonds.length === 0 && (
          <div className="draft-bond-empty">当前选择尚未形成可追踪羁绊。</div>
        )}
      </div>
    </section>
  );
}

function DraftDetailInfo({ template }: { template: CharacterTemplate }) {
  const upgradeLines = getUpgradeEffectLines(template.id, 1).slice(0, 2);

  return (
    <div className="draft-detail-info">
      <span>详细信息</span>
      {template.passive && <p>被动「{template.passive.name}」：{getCompactAbilityDescription(template.passive.description)}</p>}
      <p>技能「{template.skill.name}」：{getCompactAbilityDescription(template.skill.description)}</p>
      {upgradeLines.length > 0 && <small>成长：{upgradeLines.join('；')}</small>}
    </div>
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
          <div className="card-tag-row bond-row">
            {primaryBond ? (
              <BondTag bondId={primaryBond.id} label={GROUP_LABELS[template.group]} memberIds={primaryBond.memberIds} ownedIds={tagOwnedIds} summary={groupDetail(template.group)} />
            ) : (
              <InfoPill className="group-tag" label={GROUP_LABELS[template.group]} tooltip={groupDetail(template.group)} />
            )}
            {secondaryBonds.map((bond) => (
              <BondTag
                className="secondary-bond-tag"
                bondId={bond.id}
                key={bond.id}
                label={bond.name}
                memberIds={bond.memberIds}
                ownedIds={tagOwnedIds}
                summary={bond.description}
              />
            ))}
          </div>
          <div className="card-tag-row meta-row">
            <InfoPill className={`rarity-tag rarity-${template.rarity}`} label={RARITY_LABELS[template.rarity]} tooltip={rarityDetail(template.rarity)} />
            {template.role && <InfoPill className="group-tag" label={ROLE_LABELS[template.role]} tooltip={roleDetail(template.role)} />}
          </div>
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
        <DraftDetailInfo template={template} />
        <em>{selected ? '已选择' : '点击选择'}</em>
      </div>
    </button>
  );
}

function DraftCandidateDetailModal({ template, selected, onClose, onConfirm }: { template: CharacterTemplate; selected: boolean; onClose: () => void; onConfirm: () => void }) {
  const primaryBond = getBondGroupForTemplate(template);
  const secondaryBonds = getSecondaryBondsForTemplate(template.id);
  const tagOwnedIds = new Set([template.id]);

  return (
    <div className="modal-backdrop draft-detail-backdrop" role="dialog" aria-modal="true" aria-label={`${template.name}详情`}>
      <div className={`reward-modal draft-detail-modal rarity-${template.rarity}`}>
        <div className="draft-detail-heading">
          <div className="draft-detail-portrait">
            <img
              alt=""
              src={draftImageSrc(template)}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <div>
            <p className="eyebrow">候选偶像</p>
            <h2>{template.name}</h2>
            <div className="card-tags">
              <div className="card-tag-row bond-row">
                {primaryBond ? (
                  <BondTag bondId={primaryBond.id} label={GROUP_LABELS[template.group]} memberIds={primaryBond.memberIds} ownedIds={tagOwnedIds} summary={groupDetail(template.group)} />
                ) : (
                  <InfoPill className="group-tag" label={GROUP_LABELS[template.group]} tooltip={groupDetail(template.group)} />
                )}
                {secondaryBonds.map((bond) => (
                  <BondTag bondId={bond.id} className="secondary-bond-tag" key={bond.id} label={bond.name} memberIds={bond.memberIds} ownedIds={tagOwnedIds} summary={bond.description} />
                ))}
              </div>
              <div className="card-tag-row meta-row">
                <InfoPill className={`rarity-tag rarity-${template.rarity}`} label={RARITY_LABELS[template.rarity]} tooltip={rarityDetail(template.rarity)} />
                {template.role && <InfoPill className="group-tag" label={ROLE_LABELS[template.role]} tooltip={roleDetail(template.role)} />}
              </div>
            </div>
          </div>
        </div>
        <div className="draft-stats draft-detail-stats" aria-label={`${template.name}数值`}>
          <span><strong>{template.maxHp}</strong>HP</span>
          <span><strong>{template.attack}</strong>攻击</span>
          <span><strong>{template.speed}</strong>速度</span>
        </div>
        {template.passive && (
          <div className="draft-ability">
            <span>被动</span>
            <p>{`被动「${template.passive.name}」：${template.passive.description}`}</p>
          </div>
        )}
        <div className="draft-ability">
          <span>技能</span>
          <p>{`技能「${template.skill.name}」：${template.skill.description}`}</p>
        </div>
        <div className="draft-modal-upgrades">
          <strong>升级效果</strong>
          {getUpgradeEffectLines(template.id, 1).map((line) => <small key={line}>{line}</small>)}
        </div>
        <div className="draft-detail-actions">
          <button className="secondary-button" type="button" onClick={onClose}>返回</button>
          <button className="primary-button" type="button" onClick={onConfirm}>{selected ? '取消选择' : '确认选择'}</button>
        </div>
      </div>
    </div>
  );
}
