import type { CSSProperties } from 'react';
import type { Character, CharacterTemplate } from '../game';

export function portraitStyle(character: Pick<Character | CharacterTemplate, 'color' | 'accent'>): CSSProperties {
  return {
    '--tone': character.color,
    '--accent': character.accent,
  } as CSSProperties;
}

function getInitial(name: string) {
  return name.slice(0, 1);
}

export function UpgradeLevelBadge({ level }: { level: number }) {
  return <span className="level-badge" data-tooltip={`当前强化等级：LV${level}。等级越高，技能或被动效果越强。`} tabIndex={0}>LV{level}</span>;
}

export function MusicToggleButton({ muted, onToggle, className = '' }: { muted: boolean; onToggle: () => void; className?: string }) {
  return (
    <button className={`music-toggle ${muted ? 'is-muted' : ''} ${className}`.trim()} type="button" onClick={onToggle} aria-label={muted ? '开启声音' : '关闭声音'} title={muted ? '开启声音' : '关闭声音'}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {muted ? (
          <>
            <path d="M17 9l4 4" />
            <path d="M21 9l-4 4" />
          </>
        ) : (
          <>
            <path d="M16 8.5a5 5 0 010 7" />
            <path d="M18.5 6a8 8 0 010 12" />
          </>
        )}
      </svg>
    </button>
  );
}

interface AvatarProps {
  character: Pick<Character | CharacterTemplate, 'color' | 'accent' | 'avatar'>;
  label: string;
  small?: boolean;
}

export function Avatar({ character, label, small = false }: AvatarProps) {
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
