import type { CharacterTemplate } from '../types';

export function maxUpgradeLevel(rarity: CharacterTemplate['rarity']) {
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

export function getUpgradeEffectLines(templateId: string, level: number): string[] {
  switch (templateId) {
    case 'ayumu':
      return level >= 4 ? ['技能：温柔守护无CD，全体恢复15生命。', '被动：每次释放技能后，后续治疗量+3。'] : level >= 3 ? ['技能CD1：全体恢复15生命。', '被动：每次释放技能后，后续治疗量+3。'] : level >= 2 ? ['技能CD1：全体恢复10生命。', '被动：每次释放技能后，后续治疗量+3。'] : ['技能CD1：治疗一个单位10生命。', '被动：每次释放技能后，后续治疗量+3。'];
    case 'rina':
      return level >= 3
        ? ['被动：攻击时有75%概率追加一次攻击。', '战斗开始时获得10点护盾。']
        : level >= 2
          ? ['被动：攻击时有50%概率追加一次攻击。', '战斗开始时获得10点护盾。']
          : ['被动：攻击时有50%概率追加一次攻击。'];
    case 'nico':
      return level >= 5 ? ['被动：每次使用技能时，攻击力永久提高4点。', '技能：连续攻击4次，不损失生命，可连续释放但生命值必须高于20%，基础攻击力+1。'] : level >= 4 ? ['被动：每次使用技能时，攻击力永久提高4点。', '技能：连续攻击3次，不损失生命，可连续释放但生命值必须高于20%，基础攻击力+1。'] : level >= 3 ? ['被动：每次使用技能时，攻击力永久提高4点。', '技能：连续攻击3次，不再损失生命值，基础攻击力+1。'] : level >= 2 ? ['被动：每次使用技能时，攻击力永久提高4点。', '技能：失去当前生命值10%，连续攻击2次。'] : ['被动：每次使用技能时，攻击力永久提高3点。', '技能CD1：失去当前生命值10%，连续攻击2次。'];
    case 'kotori':
      return level >= 4 ? ['被动：敌方获得护盾效果降低50%；攻击前摧毁目标所有护盾。', '技能：50%暴击，暴击造成2倍伤害；攻击额外附加10点真实伤害。'] : level >= 3 ? ['被动：敌方获得护盾效果降低50%；攻击前摧毁目标所有护盾。', '技能：50%暴击，暴击造成2倍伤害。'] : level >= 2 ? ['被动：敌方获得护盾效果降低50%。', '技能：50%暴击，暴击造成2倍伤害。'] : ['被动：敌方获得护盾效果降低50%。', '技能：30%暴击，暴击造成2倍伤害。'];
    case 'keke':
      return level >= 5 ? ['被动：每次攻击恢复造成伤害15%的生命值。', '超级变身：攻击力+5，速度+1，仅一次。', '可可重击：10%造成5倍伤害，90%造成3.3倍伤害。'] : level >= 4 ? ['被动：每次攻击恢复造成伤害15%的生命值。', '超级变身：攻击力+3，速度+1，仅一次。', '可可重击：10%造成4倍伤害，90%造成2.5倍伤害。'] : level >= 3 ? ['被动：每次攻击恢复造成伤害15%的生命值。', '超级变身：攻击力+3，速度+1，仅一次。', '可可重击：10%造成3倍伤害，90%造成1.75倍伤害。'] : level >= 2 ? ['被动：每次攻击恢复造成伤害15%的生命值。', '超级变身：攻击力+1，速度+1，仅一次。', '解锁可可重击：10%造成3倍伤害，90%造成1.75倍伤害。'] : ['被动：每次攻击恢复造成伤害15%的生命值。', '超级变身：全场仅一次，攻击力+1，速度+1，本回合不进行其他行动。'];
    case 'you':
      return level >= 3
        ? ['被动：攻击后施加易损，使下一次单体攻击造成2.5倍伤害。']
        : level >= 2
          ? ['被动：攻击后施加易损，使下一次单体攻击造成2倍伤害。']
          : ['被动：攻击后施加易损，使下一次单体攻击造成1.5倍伤害。'];
    case 'eli':
      return level >= 4 ? ['被动：敌方回血效果降低50%；绘里保证成为玩家方第一个行动单位。', '技能CD1：全体友方攻击力+4，并指定一名友方立即普通攻击。'] : level >= 3 ? ['被动：敌方回血效果降低50%；绘里保证成为玩家方第一个行动单位。', '技能CD1：全体友方攻击力+4，随后绘里普通攻击。'] : level >= 2 ? ['被动：敌方回血效果降低50%；绘里保证成为玩家方第一个行动单位。', '技能CD1：全体友方攻击力+2，随后绘里普通攻击。'] : ['被动：敌方回血效果降低50%。', '技能CD1：全体友方攻击力+2，随后绘里普通攻击。'];
    case 'mari':
      return level >= 5 ? ['核心资源：战意。每次攻击和释放技能获得1层战意，最多4层。', '每层战意每回合提供2护盾和1攻击力。', '4级战意下「完美谢幕」追加队友攻击力总和65%的伤害。'] : level >= 3 ? ['核心资源：战意。每次攻击和释放技能获得1层战意，最多3层。', '每层战意每回合提供2护盾和1攻击力。'] : level >= 2 ? ['核心资源：战意。开场获得2层战意，最多3层。', '每层战意每回合提供0.5护盾和0.5攻击力。'] : ['核心资源：战意。每次攻击和释放技能获得1层战意，最多3层。', '每层战意每回合提供0.5护盾和0.5攻击力。', '完美谢幕：进行一次攻击；若拥有护盾，必定暴击并造成1.5倍伤害。'];
    case 'ren':
      return level >= 3
        ? ['被动：生命值额外+50，攻击力+5。', '无主动技能。']
        : level >= 2
          ? ['被动：生命值额外+50。', '无主动技能。']
          : ['被动：生命值额外+30。', '无主动技能。'];
    case 'yoshiko':
      return level >= 3
        ? ['被动：每回合开始时获得5点护盾。', '技能CD1：为一名非自己的友方提供8点护盾。']
        : level >= 2
          ? ['被动：每回合开始时获得3点护盾。', '技能CD1：为一名非自己的友方提供8点护盾。']
          : ['被动：每回合开始时获得3点护盾。', '技能CD1：为一名非自己的友方提供5点护盾。'];
    case 'nozomi':
      return level >= 4
        ? ['技能CD1：随机抽取塔罗牌。', '倒吊人：本次技能伤害×2.5。', '命运之轮：造成1.25倍伤害并获得12护盾。', '魔术师：造成1倍伤害并立即再次抽牌；触发后下回合仍可使用技能；每回合最多抽到1次魔术师。']
        : level >= 3
          ? ['技能CD1：随机抽取塔罗牌。', '倒吊人：本次技能伤害×2.5。', '命运之轮：造成1.25倍伤害并获得12护盾。', '魔术师：造成1倍伤害并立即再次抽牌；每回合最多抽到1次魔术师。']
          : level >= 2
            ? ['技能CD1：随机抽取塔罗牌。', '倒吊人：本次技能伤害×2.5。', '命运之轮：造成1.1倍伤害并获得8护盾。', '魔术师：造成1倍伤害并立即再次抽牌；每回合最多抽到1次魔术师。']
            : ['技能CD1：随机抽取塔罗牌。', '倒吊人：本次技能伤害×1.75。', '命运之轮：造成1.1倍伤害并获得8护盾。', '魔术师：造成1倍伤害并立即再次抽牌；每回合最多抽到1次魔术师。'];
    case 'kanata':
      return level >= 5 ? ['被动：每回合给敌人施加1层梦境，最多2层；每层使彼方伤害+8%。', '技能：造成攻击力100%伤害；50%追加目标当前生命20%，否则追加10%；结算后目标低于30%立即斩杀。'] : level >= 4 ? ['被动：每回合给敌人施加1层梦境，最多2层；每层使彼方伤害+8%。', '技能：造成攻击力100%伤害；20%追加目标当前生命20%，否则追加10%；结算后目标低于20%立即斩杀。'] : level >= 3 ? ['被动：每回合给敌人施加1层梦境，最多2层；每层使彼方伤害+5%。', '技能：造成攻击力100%伤害；20%追加目标当前生命20%，否则追加10%；结算后目标低于20%立即斩杀。'] : level >= 2 ? ['被动：每回合给敌人施加1层梦境，最多2层；每层使彼方伤害+5%。', '技能：造成攻击力100%伤害；20%追加目标当前生命20%，否则追加10%。'] : ['被动：每回合给敌人施加1层梦境，最多2层；每层使彼方伤害+3%。', '技能：造成攻击力100%伤害；20%追加目标当前生命20%，否则追加10%。'];
    default:
      return [];
  }
}

export function getUpgradeChangeLines(templateId: string, level: number): string[] {
  const changes: Record<string, Record<number, string[]>> = {
    ayumu: {
      2: ['治疗从单体改为全体。'],
      3: ['治疗量 10 -> 15。'],
      4: ['移除技能CD。'],
    },
    rina: {
      2: ['战斗开始时获得10点护盾。'],
      3: ['追加攻击概率 50% -> 75%。'],
    },
    nico: {
      2: ['被动攻击力成长 +3 -> +4。'],
      3: ['连续攻击 2次 -> 3次，不再损失生命，基础攻击力+1。'],
      4: ['技能可连续释放，条件为生命值高于20%。'],
      5: ['连续攻击 3次 -> 4次。'],
    },
    kotori: {
      2: ['暴击率 30% -> 50%。'],
      3: ['攻击时先摧毁目标所有护盾，再计算伤害。'],
      4: ['攻击额外附加10点真实伤害。'],
    },
    keke: {
      2: ['解锁可可重击：10%造成3倍伤害，90%造成1.75倍伤害。'],
      3: ['超级变身攻击力 +1 -> +3。'],
      4: ['可可重击提高为10%造成4倍，90%造成2.5倍。'],
      5: ['超级变身攻击力 +3 -> +5；可可重击提高为10%造成5倍，90%造成3.3倍。'],
    },
    you: {
      2: ['易损伤害 1.5倍 -> 2倍。'],
      3: ['易损伤害 2倍 -> 2.5倍。'],
    },
    eli: {
      2: ['保证绘里成为玩家方第一个行动单位。'],
      3: ['全体友方攻击力 +2 -> +4。'],
      4: ['绘里不再普通攻击，改为指定一名友方立即普通攻击。'],
    },
    mari: {
      2: ['开场获得2层战意；每层护盾为0.5。'],
      3: ['每层战意每回合提供 0.5护盾/0.5攻击 -> 2护盾/1攻击。'],
      4: ['战意体系保持不变，继续提高等级上限。'],
      5: ['解锁4级战意；4级战意下技能追加队友攻击力总和65%的伤害。'],
    },
    ren: {
      2: ['额外生命 +30 -> +50。'],
      3: ['攻击力 +5。'],
    },
    yoshiko: {
      2: ['堕天守护提供的护盾 5 -> 8。'],
      3: ['每回合开始时获得的护盾 3 -> 5。'],
    },
    nozomi: {
      2: ['倒吊人伤害 1.75倍 -> 2.5倍。'],
      3: ['命运之轮伤害 1.1倍 -> 1.25倍，护盾 8 -> 12。'],
      4: ['魔术师触发后，下回合仍可使用技能。'],
    },
    kanata: {
      2: ['每层梦境伤害 +3% -> +5%。'],
      3: ['技能新增：结算后目标低于20%立即斩杀。'],
      4: ['每层梦境伤害 +5% -> +8%。'],
      5: ['追加当前生命20%的概率 20% -> 50%；斩杀线 20% -> 30%。'],
    },
  };

  return changes[templateId]?.[level] ?? getUpgradeEffectLines(templateId, level);
}

export function getEnhancementChangeLines(templateId: string, level: number): string[] {
  const lines = getUpgradeChangeLines(templateId, level).filter((line) => !line.includes('维持'));
  return lines.length > 0 ? lines : ['仅提升等级。'];
}

export function HighlightText({ text }: { text: string }) {
  const pattern = /(LV\d+|CD\d+|[+-]?\d+(?:\.\d+)?倍|[+-]?\d+(?:\.\d+)?%|[+-]?\d+(?:\.\d+)?)/g;
  const exactPattern = /^(LV\d+|CD\d+|[+-]?\d+(?:\.\d+)?倍|[+-]?\d+(?:\.\d+)?%|[+-]?\d+(?:\.\d+)?)$/;
  return (
    <>
      {text.split(pattern).map((part, index) =>
        exactPattern.test(part) ? <span className="value-highlight" key={`${part}-${index}`}>{part}</span> : part,
      )}
    </>
  );
}

export function HighlightChangedValues({ text, baseText }: { text: string; baseText: string }) {
  const pattern = /(LV\d+|CD\d+|[+-]?\d+(?:\.\d+)?倍|[+-]?\d+(?:\.\d+)?%|[+-]?\d+(?:\.\d+)?)/g;
  const exactPattern = /^(LV\d+|CD\d+|[+-]?\d+(?:\.\d+)?倍|[+-]?\d+(?:\.\d+)?%|[+-]?\d+(?:\.\d+)?)$/;
  const baseValueCounts = new Map<string, number>();

  for (const value of baseText.match(pattern) ?? []) {
    baseValueCounts.set(value, (baseValueCounts.get(value) ?? 0) + 1);
  }

  return (
    <>
      {text.split(pattern).map((part, index) => {
        if (!exactPattern.test(part)) {
          return part;
        }

        const remainingBaseCount = baseValueCounts.get(part) ?? 0;
        if (remainingBaseCount > 0) {
          baseValueCounts.set(part, remainingBaseCount - 1);
          return part;
        }

        return <span className="value-highlight" key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

export function UpgradePreview({ template }: { template: CharacterTemplate }) {
  if (template.rarity === 'enemy' || template.rarity === 'elite' || template.rarity === 'boss') {
    return null;
  }

  const maxLevel = maxUpgradeLevel(template.rarity);
  const levels = Array.from({ length: Math.max(0, maxLevel - 1) }, (_, index) => index + 2);

  return (
    <div className="upgrade-preview">
      <span>升级预览</span>
      {levels.map((level) => (
        <div className="upgrade-preview-row" key={level}>
          <b>LV{level}</b>
          <p><HighlightText text={getUpgradeChangeLines(template.id, level).join(' ')} /></p>
        </div>
      ))}
    </div>
  );
}

export function getCompactAbilityDescription(description: string) {
  const upgradeStarts = [
    description.search(/(?:^|[。；;]\s*)(?:LV|Lv|lv)\d/),
    description.search(/(?:^|[。；;]\s*)高等级/),
  ].filter((index) => index >= 0);

  if (upgradeStarts.length === 0) {
    return description;
  }

  return description
    .slice(0, Math.min(...upgradeStarts))
    .trim()
    .replace(/[，,；;：:、\s]+$/, '')
    .replace(/[。.!！?？]+$/, '');
}
