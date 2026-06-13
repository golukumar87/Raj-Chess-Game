# Raj Chess Game



---

## Table of Contents

<div class="toc-3d">

- [Screenshot / Demo](#screenshot--demo)
- [Features](#features)
- [How to Play](#how-to-play)
- [Installation](#installation)
- [Game Modes](#game-modes)
- [Special Rules](#special-rules)
- [Tech Stack](#tech-stack)
- [3D Styling Notes](#3d-styling-notes)
- [Future Improvements](#future-improvements)
- [License](#license)

</div>

---

## Screenshot / Demo

![3D Chessboard](https://via.placeholder.com/800x400?text=3D+Chess+Game)

> <div class="note-3d">
> The current app opens with the message <strong>Welcome to Real Chess</strong>,
> then lets players sign in, continue as guest, and choose a match mode.
> </div>

---

## Features

| Icon | Feature | Description |
| --- | --- | --- |
| &#128100; | Guest Mode | Start instantly with `Play Without Login`. |
| &#128100; | Player Login | Enter player name and optional email or username. |
| &#129302; | Computer Levels | Play against the computer with difficulty levels. |
| &#128101; | Two Players | Play local chess with two players on one device. |
| &#9881; | Special Rules | Supports important chess rules and game flow. |
| &#9817; | Legal Moves | Highlights legal moves for selected pieces. |
| &#127922; | 3D Style | Dark glass UI with shadows, glow, and gradients. |

### 3D Feature Card Concept

```html
<div class="feature-card">
  <h3>&#9817; Legal Moves</h3>
  <p>Selected pieces show valid move hints with polished board highlights.</p>
</div>
```

---

## How to Play

### Login Mode

1. Open the game.
2. Enter your `Player Name`.
3. Add an optional `Email or Username`.
4. Click `Login & Continue`.
5. Choose the game mode and start playing.

### Guest Mode

1. Open the game.
2. Click `Play Without Login`.
3. Select `Computer vs You` or `Two Players`.
4. Choose a clock and difficulty level if needed.
5. Start the match.

> <div class="note-3d">
> Guest mode is perfect for quick practice games without account setup.
> </div>

---

## Installation

Clone the project:

```bash
git clone <your-repository-url>
```

Open the project folder:

```bash
cd "Chees Game"
```

Install dependencies if you want to run the optional Node.js server:

```bash
npm install
```

Run with Node.js:

```bash
npm start
```

Or open the game directly in your browser:

```bash
open index.html
```

For Windows PowerShell:

```powershell
Start-Process .\index.html
```

---

## Game Modes

| Mode | Best For | Details |
| --- | --- | --- |
| Computer vs You | Practice | Play as white against a computer opponent. |
| Two Players | Friends | Local two-player chess on the same device. |
| Guest Match | Quick Play | Start without login and jump into setup. |
| Timed Match | Challenge | Use optional clock settings for faster games. |

### Computer Levels

```text
Easy    - Best for beginners
Normal  - Balanced practice level
Hard    - Stronger computer challenge
```

---

## Special Rules

Raj Chess Game is designed to support real chess gameplay, including:

- Legal move validation
- Check and checkmate detection
- Stalemate detection
- Castling
- Pawn promotion
- En passant
- Resign and draw options
- Move history tracking
- Captured pieces display

> <div class="note-3d">
> The game focuses on a clean chess experience first: readable board,
> responsive controls, and rules that feel natural while playing.
> </div>

---

## Tech Stack

| Icon | Technology | Purpose |
| --- | --- | --- |
| &#129482; | HTML5 | Structure and layout |
| &#127912; | CSS3 | Dark glassmorphic UI and 3D-style visuals |
| &#128377; | JavaScript | Chess logic and browser interaction |
| &#127922; | Three.js | 3D-ready enhancement layer |
| &#128640; | Node.js | Optional local backend/server |

---

## 3D Styling Notes

The visual language uses:

- Dark glassmorphic panels
- Gold and emerald gradient lighting
- 3D-style title shadows
- Perspective transforms
- Glowing gradient borders
- Smooth hover states
- Premium chess-board inspired contrast

### CSS Animation Suggestion

<div class="code-glow">

```css
.readme-title {
  transform: perspective(900px) rotateX(3deg);
  text-shadow:
    0 8px 0 rgba(0, 0, 0, 0.28),
    0 20px 42px rgba(242, 199, 106, 0.22);
  animation: chessFloat 3s ease-in-out infinite;
}

@keyframes chessFloat {
  0%, 100% {
    transform: perspective(900px) translateY(0) rotateX(0deg);
  }
  50% {
    transform: perspective(900px) translateY(-6px) rotateX(3deg);
  }
}
```

</div>

### Button Hover Example

<div class="code-glow">

```css
.primary-button {
  background: linear-gradient(135deg, #f6d47c, #d7a949);
  box-shadow: 0 12px 28px rgba(242, 199, 106, 0.22);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 38px rgba(242, 199, 106, 0.3);
}
```

</div>

---

## Future Improvements

- Add a fully rendered 3D chessboard with Three.js
- Add piece movement animations
- Add sound effects for move, capture, check, and checkmate
- Add saved match history
- Add online multiplayer matchmaking
- Add board themes and custom piece skins
- Add analysis mode for completed games
- Add responsive mobile-first board controls

---

## License

This project is recommended to be released under the MIT License.

```text
MIT License

Copyright (c) 2026 Raj

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software.
```

---

<p align="center">
  <strong>&#9812; Raj Chess Game &#9813;</strong><br>
  Built for clean gameplay, modern UI, and a 3D chess-inspired experience.
</p>
