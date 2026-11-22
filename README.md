# VAULTBREAK — a top-down heist game

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Skyzo07/vaultbreak-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Skyzo07/vaultbreak-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

You are the thief. Cross the room, steal the loot, slip past the guards and
cameras — and reach the getaway van. Every floor is one room you can read at
a glance: shadow is safe, a yellow cone is danger, gold is loot, and the
green van is the way out.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request — plain Canvas 2D, ES modules, and
WebAudio bleeps, all in `game/`.

## Controls

- **WASD / arrows** — move
- **Shift / C** — sneak (slow, silent, much harder to spot)
- **E (hold)** — pick a safe or the vault lock
- **Q** — throw a noise-maker ahead of you; **click** — throw one where you click
- **F** — EMP: freeze all cameras for 6 seconds
- **P / Esc** — pause · **M** — mute · **R** — restart the level · **Enter** — confirm

## The game

- **3 handcrafted heists**: The Gallery (2 guards, 1 camera), Bank Floor
  (3 guards, 2 cameras, a safe to crack), The Vault (4 guards, 3 cameras,
  a blinking laser grid and a patrol dog, plus a timed vault lock).
- **Guards** patrol waypoints with visible vision cones and four states:
  patrol, suspicious, alerted, searching. A guard that half-sees you gets
  curious and comes to look; one that is sure chases you; a guard that
  loses you searches your last-seen spot, then goes back to patrol.
- **Cameras** sweep their cones from the walls. An EMP freezes them.
- **Light and shadow**: shadow patches shrink your visibility sharply;
  standing in lamplight inside a cone is spotted fast. Walls and crates
  block sight. Running footsteps are heard — sneak past ears as well as eyes.
- **The alarm meter** fills while anyone sees you and drains while you
  hide. It never fails you instantly: at 100 you are caught, lose a heart
  and restart from the entry. Two hearts per floor.
- **Tools at a cost**: 3 noise-makers and 2 EMPs per floor — spend them
  where they open a route, not where waiting would do.
- **Lasers** on the Vault floor blink on and off in turn; cross while your
  beam is dark. The patrol dog is fast, hears running and sees up close.
- **HUD**: loot stolen against the target, alarm meter, hearts, tools,
  timer, best rank per floor, and a minimap.
- **Ranks**: finish a floor GHOST (barely seen), SHADOW (seen but never
  caught) or ALARMS. Best rank and time per floor are kept in localStorage.
- **Screenshots**: deterministic scenes via `?shot=start|play|alert|win&seed=1`
  — title, mid-heist, alarm going up, and level-clear. `?autoplay=1&level=N`
  runs a cautious pilot that proves each floor winnable end to end.

Built by an AI agent for make.fun's "Make the best heist game" bounty
($50). Original art, sound, names and levels — no assets from any
commercial game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=pp5cg6v9&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
