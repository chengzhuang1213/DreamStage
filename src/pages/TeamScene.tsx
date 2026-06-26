import { useEffect, useMemo, useRef, useState } from 'react';
import type { BossTemplate, Character, MapNode } from '../game';
import {
  GROUP_LABELS,
  RARITY_LABELS,
  ROLE_LABELS,
  getActiveBonds,
  getActiveSecondaryBonds,
} from '../game';
import { BOND_LOGO_SRC, PROFILE_IMAGE_BY_ID, bondBackgroundStyle } from '../assets';
import { Avatar } from '../components/common';
import { getUpgradeEffectLines, maxUpgradeLevel } from '../game/data/upgrades';

export interface TeamSceneProps {
  team: Character[];
  gold: number;
  boss: BossTemplate;
  nodes: MapNode[];
  runSeed: string;
  onOpenMap: () => void;
  onOpenStats: () => void;
  onRestart: () => void;
}

function getNodeProgress(nodes: MapNode[]) {
  const completed = nodes.filter((node) => node.completed).length;
  const available = nodes.filter((node) => node.available && !node.completed);
  const nextRow = Math.min(...available.map((node) => node.row + 1));
  return {
    completed,
    total: nodes.length,
    nextRow: Number.isFinite(nextRow) ? nextRow : null,
  };
}

function portraitSrc(member: Character) {
  return PROFILE_IMAGE_BY_ID[member.templateId] ?? member.avatar;
}

function profileVideoSrc(member: Character) {
  return member.templateId === 'iris' ? '/cards/Origin_Heros/Iris/Iris_profile_video.mp4' : null;
}

function removeConnectedVideoBackground(imageData: ImageData, width: number, height: number) {
  const { data } = imageData;
  const samples = [
    0,
    (width - 1) * 4,
    ((height - 1) * width) * 4,
    ((height - 1) * width + width - 1) * 4,
  ];
  const bg = samples.reduce(
    (color, index) => {
      color.r += data[index];
      color.g += data[index + 1];
      color.b += data[index + 2];
      return color;
    },
    { r: 0, g: 0, b: 0 },
  );
  bg.r /= samples.length;
  bg.g /= samples.length;
  bg.b /= samples.length;

  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let stackLength = 0;

  function isBackground(pixelIndex: number) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) {
      return true;
    }

    const dr = data[dataIndex] - bg.r;
    const dg = data[dataIndex + 1] - bg.g;
    const db = data[dataIndex + 2] - bg.b;
    return dr * dr + dg * dg + db * db < 3600;
  }

  function push(pixelIndex: number) {
    if (visited[pixelIndex] || !isBackground(pixelIndex)) {
      return;
    }
    visited[pixelIndex] = 1;
    stack[stackLength] = pixelIndex;
    stackLength += 1;
  }

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (stackLength > 0) {
    stackLength -= 1;
    const pixelIndex = stack[stackLength];
    const dataIndex = pixelIndex * 4;
    data[dataIndex + 3] = 0;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) push(pixelIndex - 1);
    if (x < width - 1) push(pixelIndex + 1);
    if (y > 0) push(pixelIndex - width);
    if (y < height - 1) push(pixelIndex + width);
  }
}

function ChromaKeyProfileVideo({ src, onEnded, playback = 'forward' }: { src: string; onEnded: () => void; playback?: 'forward' | 'reverse' }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return undefined;
    }

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return undefined;
    }

    let frameId = 0;
    let stopped = false;
    let seekTimer = 0;
    const handleEnded = () => {
      onEnded();
    };

    const renderFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
        const scale = Math.min(1, 760 / video.videoHeight);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.clearRect(0, 0, width, height);
        context.drawImage(video, 0, 0, width, height);
        const frame = context.getImageData(0, 0, width, height);
        removeConnectedVideoBackground(frame, width, height);
        context.putImageData(frame, 0, 0);
      }
    };

    const render = () => {
      if (stopped) {
        return;
      }

      renderFrame();

      frameId = window.requestAnimationFrame(render);
    };

    if (playback === 'reverse') {
      const frameStep = 1 / 10;
      const frameDelay = 1000 / 45;

      const stepBackward = () => {
        if (stopped) {
          return;
        }
        if (!Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime <= frameStep) {
          renderFrame();
          onEnded();
          return;
        }

        const nextTime = Math.max(0, video.currentTime - frameStep);
        video.addEventListener('seeked', () => {
          renderFrame();
          seekTimer = window.setTimeout(stepBackward, frameDelay);
        }, { once: true });
        video.currentTime = nextTime;
      };

      const startReverse = () => {
        if (stopped || !Number.isFinite(video.duration) || video.duration <= 0) {
          return;
        }
        video.pause();
        video.addEventListener('seeked', () => {
          renderFrame();
          seekTimer = window.setTimeout(stepBackward, frameDelay);
        }, { once: true });
        video.currentTime = Math.max(0, video.duration - 0.01);
      };

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        startReverse();
      } else {
        video.addEventListener('loadedmetadata', startReverse, { once: true });
      }
    } else {
      void video.play().catch(() => undefined);
      video.addEventListener('ended', handleEnded);
      frameId = window.requestAnimationFrame(render);
    }

    return () => {
      stopped = true;
      window.clearTimeout(seekTimer);
      video.removeEventListener('ended', handleEnded);
      window.cancelAnimationFrame(frameId);
    };
  }, [onEnded, playback, src]);

  return (
    <>
      <video ref={videoRef} className="team-profile-source-video" src={src} autoPlay={playback === 'forward'} muted playsInline preload="auto" />
      <canvas ref={canvasRef} aria-hidden="true" />
    </>
  );
}

const PROFILE_COPY: Record<string, { name: string; signature: string; bio: string[]; passive: string; skill: string }> = {
  ayumu: {
    name: '上原步梦',
    signature: 'Ayumu',
    passive: '每次释放技能后，后续治疗量+3。',
    skill: '治疗友方单位；升级后改为全体治疗并移除冷却。',
    bio: ['虹咲学园二年级生。', '温柔可靠的支援角色，用歌声守护队伍。'],
  },
  rina: {
    name: '天王寺璃奈',
    signature: 'Rina',
    passive: '攻击时有概率追加一次攻击。',
    skill: '普通攻击节奏稳定，升级后开场获得护盾。',
    bio: ['虹咲学园一年级生。', '用璃奈板表达心情，擅长持续输出。'],
  },
  nico: {
    name: '矢泽妮可',
    signature: 'Nico',
    passive: '每次使用技能时，永久提高攻击力。',
    skill: '连续攻击多次，低等级会消耗当前生命。',
    bio: ['音乃木坂学院三年级生，μ\'s成员。', '世界第一可爱的偶像，擅长爆发连击。'],
  },
  kotori: {
    name: '南小鸟',
    signature: 'Kotori',
    passive: '敌方获得护盾效果降低50%。',
    skill: '30%暴击，暴击造成2倍伤害。',
    bio: ['音乃木坂学院二年级生，μ\'s成员。', '温柔可爱的大家的妹妹型角色，总是用自己的歌声为大家带来温暖和元气。'],
  },
  keke: {
    name: '唐可可',
    signature: 'Keke',
    passive: '每次攻击时，恢复造成伤害15%的生命值。',
    skill: '超级变身后提高攻击和速度，升级后解锁重击。',
    bio: ['结丘女子高等学校一年级生。', '热情满满的策划担当，用高爆发打开局面。'],
  },
  you: {
    name: '渡边曜',
    signature: 'You',
    passive: '攻击后施加易损，提高目标下次受到的单体伤害。',
    skill: '普通攻击配合易损，适合为队友创造爆发窗口。',
    bio: ['浦之星女学院二年级生。', '行动力十足的全速型角色，擅长抢节奏。'],
  },
  eli: {
    name: '绚濑绘里',
    signature: 'Eli',
    passive: '上场时，敌方所有回血效果降低50%。',
    skill: '提高全体友方攻击力，并指挥队友追击。',
    bio: ['音乃木坂学院三年级生。', '冷静可靠的队伍指挥，能让全队输出更集中。'],
  },
  iris: {
    name: 'Iris',
    signature: 'Iris',
    passive: '攻击和释放技能获得星辉，每回合转化为护盾和攻击。',
    skill: '拥有护盾时必定暴击，造成高额伤害。',
    bio: ['原创星舞台偶像。', '相信星光会回应努力。'],
  },
  ren: {
    name: '叶月恋',
    signature: 'Ren',
    passive: '生命值额外提高，升级后获得攻击加成。',
    skill: '无主动技能，以高生命承受压力。',
    bio: ['结丘女子高等学校一年级生。', '端正认真的守护者，适合稳定前排。'],
  },
  yoshiko: {
    name: '津岛善子',
    signature: 'Yoshiko',
    passive: '每回合开始时获得护盾。',
    skill: '为一名队友提供护盾。',
    bio: ['浦之星女学院一年级生。', '小恶魔风格的辅助角色，擅长保护队友。'],
  },
  nozomi: {
    name: '东条希',
    signature: 'Nozomi',
    passive: '通过塔罗牌效果改变战斗节奏。',
    skill: '随机抽取塔罗牌，造成伤害或获得护盾。',
    bio: ['音乃木坂学院三年级生。', '神秘而温柔的幸运担当，能带来不可预测的转机。'],
  },
  kanata: {
    name: '近江彼方',
    signature: 'Kanata',
    passive: '每回合给敌人施加梦境，提高自身伤害。',
    skill: '造成攻击伤害，并追加目标当前生命比例伤害。',
    bio: ['虹咲学园三年级生。', '慢热的梦境输出手，适合处理高生命目标。'],
  },
};

function profileCopy(member: Character) {
  return PROFILE_COPY[member.templateId] ?? {
    name: member.name,
    signature: member.templateId,
    passive: member.passive?.description ?? '暂无被动技能。',
    skill: member.skill.description,
    bio: [member.feature ?? '队伍成员。'],
  };
}

function TeamProfilePanel({ member, onSwitch }: { member: Character; onSwitch?: () => void }) {
  const level = member.upgradeLevel ?? 1;
  const maxLevel = maxUpgradeLevel(member.rarity);
  const copy = profileCopy(member);
  const videoSrc = profileVideoSrc(member);
  const [videoEnded, setVideoEnded] = useState(false);

  useEffect(() => {
    setVideoEnded(false);
  }, [member.id, member.templateId, videoSrc]);

  return (
    <article className={`team-profile-card rarity-${member.rarity} ${member.injured ? 'injured' : ''}`}>
      <div className="team-profile-copy">
        <div className="team-profile-heading">
          <p className="team-profile-kicker"><span aria-hidden="true">★</span> 详细信息</p>
          <h3>{copy.name}</h3>
          <span className="team-profile-signature">{copy.signature}</span>
        </div>

        <div className="team-profile-level">
          <strong>LV {level}</strong>
          <span>/ {maxLevel}</span>
        </div>
        <div className="team-profile-stats" aria-label={`${copy.name} 数值`}>
          <div className="team-profile-stat hp"><span aria-hidden="true">◆</span><strong>HP</strong><em>{member.hp} / {member.maxHp}</em></div>
          <div className="team-profile-stat atk"><span aria-hidden="true">◆</span><strong>ATK</strong><em>{member.attack}</em></div>
          <div className="team-profile-stat spd"><span aria-hidden="true">◆</span><strong>SPD</strong><em>{member.speed}</em></div>
        </div>

        <div className="team-profile-abilities">
          <div className="team-profile-ability">
            <span className="team-profile-ability-icon shield" aria-hidden="true">◎</span>
            <div>
              <strong>被动技能</strong>
              <p>{copy.passive}</p>
            </div>
          </div>
          <div className="team-profile-ability">
            <span className="team-profile-ability-icon spark" aria-hidden="true">✦</span>
            <div>
              <strong>主动技能</strong>
              <p>{copy.skill}</p>
            </div>
          </div>
        </div>

        <div className="team-profile-bio">
          <strong>角色简介</strong>
          {copy.bio.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>

      <div className="team-profile-portrait">
        {videoSrc && !videoEnded ? (
          <ChromaKeyProfileVideo key={`${member.id}-${videoSrc}`} src={videoSrc} onEnded={() => setVideoEnded(true)} />
        ) : (
          <img
            key={member.templateId}
            alt=""
            src={portraitSrc(member)}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      {onSwitch && (
        <button className="team-profile-switch" type="button" onClick={onSwitch}>
          更换带队
        </button>
      )}
    </article>
  );
}

function TeamMemberCard({ member, featured = false, selected = false, onSelect }: { member: Character; featured?: boolean; selected?: boolean; onSelect?: () => void }) {
  const upgradeLevel = member.upgradeLevel ?? 1;
  const effectLines = getUpgradeEffectLines(member.templateId, upgradeLevel).slice(0, featured ? 3 : 1);
  const className = `team-scene-member rarity-${member.rarity} ${featured ? 'featured' : ''} ${selected ? 'selected' : ''} ${member.injured ? 'injured' : ''}`;
  const content = (
    <>
      {featured ? (
        <div className="team-scene-portrait">
          <img
            alt=""
            src={portraitSrc(member)}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <Avatar character={member} label={member.name} />
      )}
      <div className="team-scene-member-copy">
        <p className="eyebrow">{RARITY_LABELS[member.rarity]} · {GROUP_LABELS[member.group]}{member.role ? ` · ${ROLE_LABELS[member.role]}` : ''}</p>
        <h3>{member.name}</h3>
        <div className="team-scene-statline">
          <span>LV{upgradeLevel}</span>
          <span>{member.injured ? '重伤' : `HP ${member.hp}/${member.maxHp}`}</span>
          <span>ATK {member.attack}</span>
          <span>SPD {member.speed}</span>
        </div>
        {effectLines.length > 0 && (
          <ul className="team-scene-skill-lines">
            {effectLines.map((line) => <li key={line}>{line}</li>)}
          </ul>
        )}
      </div>
    </>
  );

  if (!featured && onSelect) {
    return (
      <button className={className} type="button" onClick={onSelect} aria-pressed={selected}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

function BondSummary({ team }: { team: Character[] }) {
  const ownedIds = new Set(team.map((member) => member.templateId));
  const visibleBonds = [
    ...getActiveBonds(team)
      .filter((bond) => bond.count > 0)
      .map((bond) => ({
        id: bond.group.id,
        name: bond.group.name,
        count: bond.count,
        total: 3,
        active: bond.level > 0,
        memberIds: bond.group.memberIds,
        logoSrc: BOND_LOGO_SRC[bond.group.id],
      })),
    ...getActiveSecondaryBonds(team)
      .filter((bond) => bond.count > 0)
      .map((bond) => ({
        id: bond.bond.id,
        name: bond.bond.name,
        count: bond.count,
        total: 2,
        active: bond.active,
        memberIds: bond.bond.memberIds,
        logoSrc: BOND_LOGO_SRC[bond.bond.id],
      })),
  ].sort((left, right) => Number(right.active) - Number(left.active) || right.count - left.count);

  if (visibleBonds.length === 0) {
    return <p className="team-scene-empty">还没有形成羁绊。继续招募，让队伍开始发光。</p>;
  }

  return (
    <div className="team-scene-bond-list">
      {visibleBonds.slice(0, 6).map((bond) => (
        <article className={`team-scene-bond bond-theme-card ${bond.active ? 'active' : ''}`} key={bond.id} style={bondBackgroundStyle(bond.id)}>
          <img src={bond.logoSrc} alt="" />
          <div>
            <strong>{bond.name}</strong>
            <span>{bond.count}/{bond.total}{bond.active ? ' 已激活' : ' 未激活'}</span>
          </div>
          <div className="team-scene-bond-members">
            {bond.memberIds.slice(0, 4).map((memberId) => (
              <span className={ownedIds.has(memberId) ? 'owned' : ''} key={memberId} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TeamScene({ team, gold, boss, nodes, runSeed, onOpenMap, onOpenStats, onRestart }: TeamSceneProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(team[0]?.id ?? null);
  const selectedMember = team.find((member) => member.id === selectedMemberId) ?? team[0] ?? null;
  const progress = useMemo(() => getNodeProgress(nodes), [nodes]);

  useEffect(() => {
    if (!team.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(team[0]?.id ?? null);
    }
  }, [selectedMemberId, team]);

  return (
    <div className="team-scene">
      <header className="team-scene-topbar">
        <div>
          <p className="eyebrow">DreamStage Tour</p>
          <h1>队伍休息室</h1>
        </div>
        <div className="team-scene-resources">
          <span className="coin">金币 {gold}</span>
          <span>第 {boss.bossTier} 层</span>
          <span>Seed {runSeed}</span>
        </div>
      </header>

      <main className="team-scene-layout">
        <section className="team-scene-feature-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">偶像详情</p>
          </div>
          {selectedMember ? (
            <TeamProfilePanel
              member={selectedMember}
              onSwitch={team.length > 1
                ? () => {
                    const currentIndex = team.findIndex((member) => member.id === selectedMember.id);
                    const nextMember = team[(currentIndex + 1) % team.length];
                    setSelectedMemberId(nextMember.id);
                  }
                : undefined}
            />
          ) : (
            <p className="team-scene-empty">完成招募后，这里会展示偶像详情。</p>
          )}
        </section>

        <section className="team-scene-roster-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">队伍</p>
            <h2>{team.length}/4</h2>
          </div>
          <div className="team-scene-roster-grid">
            {team.map((member) => (
              <TeamMemberCard
                member={member}
                selected={member.id === selectedMember?.id}
                onSelect={() => setSelectedMemberId(member.id)}
                key={member.id}
              />
            ))}
            {Array.from({ length: Math.max(0, 4 - team.length) }, (_, index) => (
              <div className="team-scene-empty-slot" key={index}>空位</div>
            ))}
          </div>
        </section>

        <section className="team-scene-bond-panel">
          <div className="team-scene-section-heading">
            <p className="eyebrow">羁绊进度</p>
            <h2>队伍成长</h2>
          </div>
          <BondSummary team={team} />
        </section>

        <aside className="team-scene-tour-panel">
          <div className="team-scene-progress-card">
          <p className="eyebrow">当前巡演</p>
          <h2>第 {boss.bossTier} 层 Boss</h2>
          <strong>{boss.name}</strong>
          <div className="team-scene-boss-portrait">
            <img
              alt=""
              src={boss.avatar}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <span>节点进度 {progress.completed}/{progress.total}</span>
          <span>{progress.nextRow ? `下一排：第 ${progress.nextRow} 排` : '等待选择下一条路线'}</span>
        </div>
          <button className="primary-button team-scene-map-button" type="button" onClick={onOpenMap}>继续巡演 / 打开地图</button>
          <button className="secondary-button" type="button" onClick={onOpenStats}>查看统计</button>
          <button className="danger-button" type="button" onClick={onRestart}>重新开始</button>
        </aside>
      </main>
    </div>
  );
}
