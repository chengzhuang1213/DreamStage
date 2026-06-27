import type { Character } from './game';

export const ENEMY_ILLUSTRATIONS: Record<string, string> = {
  enemy_rin: '/cards/Enemy_Images/2Hoshizora-Rin-hO1h4C.png',
  enemy_ai: '/cards/Enemy_Images/62Miyashita-Ai-f38Jhw.png',
  enemy_mia: '/cards/Enemy_Images/123Mia-Taylor-jCx23M.png',
  enemy_lanzhu: '/cards/Enemy_Images/124Lanzhu-aPGOOW.png',
  enemy_sumire: '/cards/Enemy_Images/121Heanna-Sumire-Ben4YX.png',
  enemy_kinako: '/cards/Enemy_Images/172Sakurakoji-Kinako-ZyHhGE.png',
  enemy_shiki: '/cards/Enemy_Images/174Wakana-Shiki-r1LpGa.png',
  enemy_mei: '/cards/Enemy_Images/173Yoneme-Mei-6Ywcqq.png',
  enemy_polka: '/cards/Enemy_Images/267Polka-Takahashi-W1qD4B.png',
  enemy_miracle_kana: '/cards/Enemy_Images/271Miracle-Kanazawa-e47sZw.png',
  enemy_noriko: '/cards/Enemy_Images/272Noriko-Chofu-WK3G8D.png',
  enemy_hanayo: '/cards/Enemy_Images/3Koizumi-Hanayo-wuvH3R.png',
  enemy_hanamaru: '/cards/Enemy_Images/5Kunikida-Hanamaru-TomAYd.png',
  enemy_ruby: '/cards/Enemy_Images/7Kurosawa-Ruby-RoBWBL.png',
  enemy_karin: '/cards/Enemy_Images/24Asaka-Karin-3nF3em.png',
  enemy_kasumi: '/cards/Enemy_Images/67Nakasu-Kasumi-rQd4Or.png',
  enemy_shizuku: '/cards/Enemy_Images/70Osaka-Shizuku-1WGIlr.png',
  enemy_margarete: '/cards/Enemy_Images/178Margarete-Wien-qc6kCY.png',
  enemy_kozue: '/cards/Enemy_Images/205Kozue-Otomune-kNrbPK.png',
  enemy_tsuzuri: '/cards/Enemy_Images/206Tsuzuri-Yugiri-3KKfOJ.png',
  enemy_rurino: '/cards/Enemy_Images/207Rurino-Osawa-DKPmwE.png',
  enemy_ceras: '/cards/Enemy_Images/230Lilienfeld-Yanagida-Ceras-hVBTJn.png',
  elite_kanan: '/cards/Enemy_Images/8Matsuura-Kanan-aT2Td5.png',
  elite_riko: '/cards/Enemy_Images/12Sakurauchi-Riko-p2EuTb.png',
  elite_megumi: '/cards/Enemy_Images/208Megumi-Fujishima-vQJs20.png',
  elite_kaho: '/cards/Enemy_Images/203Kaho-Hinoshita-PS7Ud5.png',
  elite_emma: '/cards/Enemy_Images/28Emma-Verde-pVzmKV.png',
  elite_kanon: '/cards/Enemy_Images/118Shibuya-Kanon-if8zlW.png',
  elite_setsuna: '/cards/Enemy_Images/110Yuki-Setsuna-2gVQWE.png',
  elite_shioriko: '/cards/Enemy_Images/113Mifune-Shioriko-tNDNRT.png',
  elite_natsumi: '/cards/Enemy_Images/175Onitsuka-Natsumi-6nLfeH.png',
  boss_honoka: '/cards/Enemy_Images/4Kousaka-Honoka-2nSYRU.png',
  boss_chika: '/cards/Enemy_Images/14Takami-Chika-MumE0U.png',
  boss_hanabi: '/cards/Enemy_Images/270Hanabi-Komagata-hk69uk.png',
  boss_dia: '/cards/Enemy_Images/6Kurosawa-Dia-6ovIG8.png',
  boss_kasumi: '/cards/Enemy_Images/67Nakasu-Kasumi-rQd4Or.png',
  boss_izumi: '/cards/Enemy_Images/229Izumi-Katsuragi-w8C1z6.png',
  boss_chisato: '/cards/Enemy_Images/120Arashi-Chisato-eySO7L.png',
  boss_umi: '/cards/Enemy_Images/13Sonoda-Umi-rxgV8z.png',
  boss_maki: '/cards/Enemy_Images/10Nishikino-Maki-UFQB4E.png',
};

export const HERO_ILLUSTRATIONS: Record<string, string> = {
  ayumu: '/cards/Image/102Uehara-Ayumu-KN13pl.png',
  rina: '/cards/Image/97Tennoji-Rina-YB8JUo.png',
  nico: '/cards/Image/18Yazawa-Nico-agidhY.png',
  kotori: '/cards/Image/9Minami-Kotori-BkWR39.png',
  keke: '/cards/Image/119Tang-Keke-4Tr0Yx.png',
  you: '/cards/Image/17Watanabe-You-En1r2L.png',
  eli: '/cards/Image/1Ayase-Eli-wRbUwD.png',
  iris: '/cards/Origin_Heros/iris/iris_arena.png',
  ren: '/cards/Image/122Hazuki-Ren-fZ9vXK.png',
  yoshiko: '/cards/Image/16Tsushima-Yoshiko-NdFuZH.png',
  nozomi: '/cards/Image/15Toujou-Nozomi-S678cZ.png',
  kanata: '/cards/Image/50Konoe-Kanata-82Ei8T.png',
};

export const HERO_SKIN_ILLUSTRATIONS: Record<string, string> = {
  nico: '/cards/Image/Image_Skins/矢泽妮可皮肤.battle.png',
  keke: '/cards/Image/Image_Skins/唐可可皮肤.battle.png',
  kanata: '/cards/Image/Image_Skins/近江彼方皮肤.battle.png',
};

export const HERO_BATTLE_TRANSFORM_ILLUSTRATIONS: Record<string, string> = {
  keke: '/cards/Image/Image_Skins/唐可可皮肤变身后.battle.png',
};

export function getBattleIllustration(character: Character) {
  if (character.battleSkin) {
    return character.battleSkin;
  }

  if (character.rarity === 'legendary' && HERO_SKIN_ILLUSTRATIONS[character.templateId]) {
    return HERO_SKIN_ILLUSTRATIONS[character.templateId];
  }

  return ENEMY_ILLUSTRATIONS[character.templateId] ?? HERO_ILLUSTRATIONS[character.templateId] ?? character.avatar;
}
