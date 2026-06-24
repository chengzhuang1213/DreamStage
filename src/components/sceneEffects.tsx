import type { CSSProperties } from 'react';
import type { Character } from '../game';
import { Avatar } from './common';

const SAKURA_PETALS = Array.from({ length: 26 }, (_, index) => index);
const SCENE_PARTICLES = Array.from({ length: 18 }, (_, index) => index);
export const START_TRANSITION_MS = 1800;
export const BOSS_BLESSING_TRANSITION_MS = 1700;

export function BossBlessingTransition({ team }: { team: Character[] }) {
  const visibleTeam = team.slice(0, 4);

  return (
    <div className="boss-blessing-transition" aria-hidden="true">
      <div className="boss-blessing-aura" />
      <div className="boss-blessing-copy">
        <span>Stage Clear</span>
        <strong>祝福降临</strong>
      </div>
      <div className="boss-blessing-team" style={{ '--blessing-count': Math.max(1, visibleTeam.length) } as CSSProperties}>
        {visibleTeam.map((member, index) => (
          <div
            className={`boss-blessing-member rarity-${member.rarity}`}
            key={member.id}
            style={{ '--member-delay': `${index * 120}ms` } as CSSProperties}
          >
            <Avatar character={member} label={member.name} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SceneParticles({ variant }: { variant: string }) {
  return (
    <div className={`scene-particles particles-${variant}`} aria-hidden="true">
      {SCENE_PARTICLES.map((particle) => (
        <span key={particle} className="scene-particle" />
      ))}
    </div>
  );
}


export function SakuraLayer() {
  return (
    <div className="sakura-layer" aria-hidden="true">
      {SAKURA_PETALS.map((petal) => (
        <span key={petal} className="sakura-petal" />
      ))}
    </div>
  );
}
