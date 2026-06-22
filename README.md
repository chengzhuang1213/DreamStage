# LoveLive Roguelike Beta

React + TypeScript single-player frontend prototype for testing a character-build roguelike loop.

Implemented Beta loop:

- choose 2 starting partners from 4 random candidates in a 12-character pool
- progress through a 15-node Slay-the-Spire-style map
- resolve 1v1 battles, 2v1 elite fights, and a 3v1 boss fight
- keep remaining HP between fights
- mark defeated allies as injured
- use relay combat when an ally falls and enemies still have HP
- recruit partners in shops
- always visit a rest node before the boss
- heal once at each rest node, choosing either a small heal or a large heal
- revive once at each rest node, restoring 60% max HP
- trigger character passives, automatic skills, and 2/3-member bonds

Beta bond groups:

- Cute: crit, combo, lifesteal
- Silver-haired: speed, charge, vulnerable
- Presidents: shield, immunity, damage reduction
- Mystery: poison, random rewards, execute

Secondary bonds:

- Little Devil: Nico + Yoshiko, crits add 3 poison
- NozoEli: Eli + Nozomi, battle start shield plus random buff
- Angels: Ayumu + Kotori, heal after battle
- Dreamers: Keke + Kanata, gain attack or speed after each node
- Lucky Star: Mari + Nozomi, random extra reward after battle wins
- Campus Leaders: Ren + Ayumu, first attack deals double damage
- Full Speed: You + Rina, speed +5
- Energetic Idols: You + Nico, first attack crit chance +50%

## Run

```bash
pnpm install
pnpm dev
```

In this Codex desktop environment, use the bundled Node runtime if `node` is not on PATH.

