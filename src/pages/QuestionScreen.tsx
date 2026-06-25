import { useMemo, useState } from 'react';
import type { Character } from '../game';
import { GROUP_LABELS, RARITY_LABELS } from '../game';
import { Avatar, UpgradeLevelBadge } from '../components/common';
import type { QuestionEvent } from '../questionEvents';

export interface QuestionScreenProps {
  event: QuestionEvent;
  gold: number;
  team: Character[];
  canUseGacha: boolean;
  onResolve: (optionId: string, targetId?: string) => void;
}

const KIND_LABELS: Record<QuestionEvent['kind'], string> = {
  reward: '好运事件',
  risk: '风险收益',
  special: '特殊事件',
};

function hpPercent(member: Character) {
  return `${Math.max(0, Math.min(100, Math.round((member.hp / member.maxHp) * 100)))}%`;
}

export function QuestionScreen({ event, gold, team, canUseGacha, onResolve }: QuestionScreenProps) {
  const [selectedOptionId, setSelectedOptionId] = useState(event.options[0]?.id ?? '');
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const selectedOption = useMemo(
    () => event.options.find((option) => option.id === selectedOptionId) ?? event.options[0],
    [event.options, selectedOptionId],
  );
  const selectedTarget = selectedTargetId ? team.find((member) => member.id === selectedTargetId) ?? null : null;
  const needsTarget = selectedOption?.target === 'ally';
  const cannotAfford = Boolean(selectedOption?.cost && gold < selectedOption.cost);
  const gachaBlocked = event.id === 'mystery_gacha' && !canUseGacha;
  const canConfirm = Boolean(selectedOption) && !cannotAfford && !gachaBlocked && (!needsTarget || Boolean(selectedTarget));

  function selectOption(optionId: string) {
    setSelectedOptionId(optionId);
    setSelectedTargetId(null);
  }

  return (
    <div className={`flow-screen question-screen question-kind-${event.kind}`}>
      <section className="question-panel">
        <div className="question-heading">
          <div>
            <p className="eyebrow">{KIND_LABELS[event.kind]}</p>
            <h2>{event.title}</h2>
            <p>{event.summary}</p>
          </div>
          <div className="question-resource-card">
            <small>当前金币</small>
            <strong>{gold}</strong>
          </div>
        </div>

        <div className="question-option-grid">
          {event.options.map((option) => {
            const disabled = Boolean(option.cost && gold < option.cost) || (event.id === 'mystery_gacha' && !canUseGacha);
            return (
              <button
                className={`question-option-card ${selectedOptionId === option.id ? 'selected' : ''}`}
                disabled={disabled}
                key={option.id}
                onClick={() => selectOption(option.id)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
                {option.cost && <em>消耗 {option.cost} 金币</em>}
                {disabled && (
                  <small>{event.id === 'mystery_gacha' && !canUseGacha ? '队伍已满或没有可获得角色' : '金币不足'}</small>
                )}
              </button>
            );
          })}
        </div>

        {needsTarget && (
          <div className="question-team-picker">
            <strong>指定一名偶像</strong>
            <div className="question-team-grid">
              {team.map((member) => (
                <button
                  className={`question-member-card rarity-${member.rarity} ${selectedTargetId === member.id ? 'selected' : ''}`}
                  key={member.id}
                  onClick={() => setSelectedTargetId(member.id)}
                  type="button"
                >
                  <Avatar character={member} label={member.name} small />
                  <span>{member.name}</span>
                  <small>{RARITY_LABELS[member.rarity]} · {GROUP_LABELS[member.group]} · LV{member.upgradeLevel ?? 1}</small>
                  <UpgradeLevelBadge level={member.upgradeLevel ?? 1} />
                  <div className="hp-track" aria-hidden="true">
                    <span style={{ width: hpPercent(member) }} />
                  </div>
                  <em>HP {member.hp}/{member.maxHp} · 攻 {member.attack}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="question-result-preview">
          <strong>{selectedOption?.label}</strong>
          <span>
            {selectedOption?.description}
            {needsTarget && selectedTarget ? ` 目标：${selectedTarget.name}` : ''}
          </span>
        </div>

        <div className="question-actions">
          <button
            className="primary-button"
            disabled={!canConfirm}
            onClick={() => selectedOption && onResolve(selectedOption.id, selectedTarget?.id)}
            type="button"
          >
            确认事件
          </button>
        </div>
      </section>
    </div>
  );
}
