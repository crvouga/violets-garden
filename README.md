# Violet

A polished, mobile-first Sokoban-style puzzle maze game starring **Violet**, a black pug.
Guide Violet through five hedge mazes: grab keys to unlock gates, push crates onto pressure
buttons to hold doors open, sniff out every bone, and curl up in the dog bed at the end.

Built with **Phaser 3**, **Tone.js** and **TypeScript** (Vite). All art is vector SVG or
procedurally drawn on canvas; all music and sound effects are synthesized at runtime, so the
build ships with zero image or audio files.

## How to play

- Move Violet one tile at a time through the maze.
- **Crates** can be pushed (never pulled) if the tile behind them is free.
- **Buttons** open their linked **gate** while anything (Violet or a crate) rests on them.
  Park a crate on a button to keep the gate open.
- **Keys** unlock the matching coloured **locked door** and are used up in the process.
- **Bones** are optional treats. Reach the **dog bed** to finish the level.
- Stars: one for finishing, one for collecting every bone, one for finishing within par moves.
- **Undo** rewinds any move (including pushes, doors and keys). **Restart** resets the level.

### Controls

| Action  | Touch (phone / tablet)          | Keyboard (desktop)         |
| ------- | ------------------------------- | -------------------------- |
| Move    | Swipe on the board, or D-pad    | Arrow keys / WASD          |
| Undo    | ↶ button                        | `Z` or `Backspace`         |
| Restart | ↻ button                        | `R`                        |
| Pause   | ⏸ button (top left)             | `Esc` or `P`               |

Music and sound can be toggled from the main menu or the pause menu; settings and level
progress are stored in `localStorage`.

## Levels

1. **First Walk** – maze + one key and gate
2. **Heavy Lifting** – push a crate onto a button
3. **Two Locks** – two coloured keys, order matters
4. **Hold the Door** – two buttons; park a crate to keep the gate open
5. **Violet's Garden** – everything together

## Development

Requires Node 22+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev        # Vite dev server with HMR (also reachable on your LAN for phone testing)
pnpm build      # type-check + production build to dist/
pnpm preview    # serve the production build
pnpm test       # vitest: board logic + every level is solvable (BFS solver)
pnpm lint       # eslint
pnpm format     # prettier
pnpm check      # format + lint + typecheck + test
```

### Project layout

```
src/
  main.ts            Phaser game config, hi-DPI canvas sizing, resize handling
  config.ts          constants, depth layers, palette
  levels.ts          the five levels as ASCII maps + par moves
  save.ts            localStorage progress and audio settings
  logic/board.ts     pure grid model: moves, pushes, keys, doors, buttons, undo
  logic/solver.ts    BFS solver used by the tests to verify levels and par values
  art/               SVG loader + procedural canvas textures (tiles, doors, particles, icons)
  audio/             Tone.js engine, synthesized SFX and two sequenced music loops
  ui/                Button, Panel, StarRating, DPad game objects
  scenes/            Boot, Menu, LevelSelect, Game, LevelComplete, GameComplete
  assets/svg/        pug poses and props
```

### Level legend

```
#  wall        .  floor       P  Violet (start)    X  dog bed (exit)
B  crate       b  button      D  gate (toggle door linked to buttons)
k K  gold key / gold door     g G  green key / door     v V  violet key / door
t  bone (treat)               L  lamp (decorative, casts light)
```

## Mobile notes

The canvas renders at device resolution (capped at 2x) and re-lays out on rotate/resize.
`index.html` disables zoom, pull-to-refresh and long-press callouts, and includes a web app
manifest so the game can be added to the home screen. Audio starts on the first tap because
mobile browsers require a user gesture.
