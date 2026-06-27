import type { MapNode } from './game';
import type { CSSProperties } from 'react';

export type MusicKey = 'home' | 'draftShop' | 'battle' | 'rest' | 'map';
export type SfxKey = 'mapSelect' | 'next' | 'buy' | 'battleVictory';

export const MUSIC_SRC: Record<MusicKey, string> = {
  home: '/audio/home.mp3',
  draftShop: '/audio/draft-shop.mp3',
  battle: '/audio/battle.mp3',
  rest: '/audio/rest.mp3',
  map: '/audio/home.mp3',
};

export const SFX_SRC: Record<SfxKey, string> = {
  mapSelect: '/audio/map-select.mp3',
  next: '/audio/next.mp3',
  buy: '/audio/buy.mp3',
  battleVictory: '/audio/battle-victory.mp3',
};

export const BOND_LOGO_SRC: Record<string, string> = {
  cute: '/ui/bond-logos/cute.png',
  silver: '/ui/bond-logos/silver.png',
  president: '/ui/bond-logos/president.png',
  mystery: '/ui/bond-logos/mystery.png',
  little_devil: '/ui/bond-logos/little_devil.png',
  nozoeli: '/ui/bond-logos/nozoeli.png',
  angel: '/ui/bond-logos/angel.png',
  dreamer: '/ui/bond-logos/dreamer.png',
  lucky_star: '/ui/bond-logos/lucky_star.png',
  campus_leader: '/ui/bond-logos/campus_leader.png',
  full_speed: '/ui/bond-logos/full_speed.png',
  energetic_idol: '/ui/bond-logos/energetic_idol.png',
};

export const BOND_BACKGROUND_SRC: Record<string, string> = {
  cute: '/ui/bond-backgrounds/cute.png?v=user-banners',
  silver: '/ui/bond-backgrounds/silver.png?v=user-banners',
  president: '/ui/bond-backgrounds/president.png?v=user-banners',
  mystery: '/ui/bond-backgrounds/mystery.png?v=user-banners',
  little_devil: '/ui/bond-backgrounds/little_devil.png?v=user-banners',
  nozoeli: '/ui/bond-backgrounds/nozoeli.png?v=user-banners',
  angel: '/ui/bond-backgrounds/angel.png?v=user-banners',
  dreamer: '/ui/bond-backgrounds/dreamer.png?v=user-banners',
  lucky_star: '/ui/bond-backgrounds/lucky_star.png?v=user-banners',
  campus_leader: '/ui/bond-backgrounds/campus_leader.png?v=user-banners',
  full_speed: '/ui/bond-backgrounds/full_speed.png?v=user-banners',
  energetic_idol: '/ui/bond-backgrounds/energetic_idol.png?v=user-banners',
};

export function bondBackgroundStyle(bondId?: string): CSSProperties | undefined {
  const src = bondId ? BOND_BACKGROUND_SRC[bondId] : undefined;
  return src ? ({ '--bond-bg-image': `url("${src}")` } as CSSProperties) : undefined;
}

export const DRAFT_IMAGE_BY_ID: Record<string, string> = {
  ayumu: '/cards/Image/102Uehara-Ayumu-KN13pl.png',
  rina: '/cards/Image/97Tennoji-Rina-YB8JUo.png',
  nico: '/cards/heroes/skins/nico-legendary.png',
  kotori: '/cards/Image/9Minami-Kotori-BkWR39.png',
  keke: '/cards/heroes/skins/keke-legendary.png',
  you: '/cards/Image/17Watanabe-You-En1r2L.png',
  eli: '/cards/Image/1Ayase-Eli-wRbUwD.png',
  iris: '/cards/Origin_Heros/iris/iris_image.png',
  ren: '/cards/Image/122Hazuki-Ren-fZ9vXK.png',
  yoshiko: '/cards/Image/16Tsushima-Yoshiko-NdFuZH.png',
  nozomi: '/cards/Image/15Toujou-Nozomi-S678cZ.png',
  kanata: '/cards/heroes/skins/kanata-legendary.png',
};

export const PROFILE_IMAGE_BY_ID: Record<string, string> = {
  ayumu: '/cards/profiles/ayumu.png',
  rina: '/cards/profiles/rina.png',
  nico: '/cards/profiles/nico.png',
  kotori: '/cards/profiles/kotori.png',
  keke: '/cards/profiles/keke.png',
  you: '/cards/profiles/you.png',
  eli: '/cards/profiles/eli.png',
  iris: '/cards/Origin_Heros/iris/iris_full_card.png',
  ren: '/cards/profiles/ren.png',
  yoshiko: '/cards/profiles/yoshiko.png',
  nozomi: '/cards/profiles/nozomi.png',
  kanata: '/cards/profiles/kanata.png',
};

export const NODE_ICON_SRC: Record<MapNode['type'], string> = {
  battle: '/ui/node-icons/battle.png',
  elite: '/ui/node-icons/elite.png',
  shop: '/ui/node-icons/shop.png',
  rest: '/ui/node-icons/rest.png',
  boss: '/ui/node-icons/boss.png',
  question: '/ui/node-icons/question.png',
};
