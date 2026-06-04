const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const WHITE = "white";
const BLACK = "black";
const PIECES = {
  king: { white: "\u2654", black: "\u265a", value: 1000, letter: "K" },
  queen: { white: "\u2655", black: "\u265b", value: 9, letter: "Q" },
  rook: { white: "\u2656", black: "\u265c", value: 5, letter: "R" },
  bishop: { white: "\u2657", black: "\u265d", value: 3, letter: "B" },
  knight: { white: "\u2658", black: "\u265e", value: 3, letter: "N" },
  pawn: { white: "\u2659", black: "\u265f", value: 1, letter: "" }
};

const els = {};
let state;
let selected = null;
let legalForSelected = [];
let flipped = false;
let pendingPromotion = null;
let timerId = null;
let aiThinking = false;
let playerProfile = {
  name: "Guest",
  email: "",
  avatar: "\u2654",
  loggedIn: false
};
let setupMode = "ai";
let settings = {
  sound: true,
  boardTheme: "gold",
  colorMode: "dark",
  practiceMode: false
};
let playerStats = {
  wins: 0,
  losses: 0,
  draws: 0
};
let matchHistory = [];
let audioContext = null;
let hintedMove = null;

function newState() {
  return {
    board: createStartBoard(),
    turn: WHITE,
    history: [],
    snapshots: [],
    captures: { white: [], black: [] },
    enPassant: null,
    halfMove: 0,
    fullMove: 1,
    gameOver: false,
    result: null,
    resultRecorded: false,
    lastMove: null,
    clocks: { white: 600, black: 600 },
    clockEnabled: true,
    startedAt: Date.now()
  };
}

function createStartBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const order = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  for (let col = 0; col < 8; col++) {
    board[0][col] = piece(order[col], BLACK);
    board[1][col] = piece("pawn", BLACK);
    board[6][col] = piece("pawn", WHITE);
    board[7][col] = piece(order[col], WHITE);
  }
  return board;
}

function piece(type, color, hasMoved = false) {
  return { type, color, hasMoved };
}

function cloneState(source) {
  return {
    board: cloneBoard(source.board),
    turn: source.turn,
    history: source.history.map((m) => ({ ...m, from: { ...m.from }, to: { ...m.to } })),
    snapshots: [],
    captures: {
      white: source.captures.white.map((p) => ({ ...p })),
      black: source.captures.black.map((p) => ({ ...p }))
    },
    enPassant: source.enPassant ? { ...source.enPassant } : null,
    halfMove: source.halfMove,
    fullMove: source.fullMove,
    gameOver: source.gameOver,
    result: source.result ? { ...source.result } : null,
    resultRecorded: source.resultRecorded || false,
    lastMove: source.lastMove ? { ...source.lastMove, from: { ...source.lastMove.from }, to: { ...source.lastMove.to } } : null,
    clocks: { ...source.clocks },
    clockEnabled: source.clockEnabled,
    startedAt: source.startedAt
  };
}

function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function opposite(color) {
  return color === WHITE ? BLACK : WHITE;
}

function squareName(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function allLegalMoves(game, color = game.turn) {
  const moves = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (game.board[row][col]?.color === color) {
        moves.push(...legalMovesFor(game, row, col, color));
      }
    }
  }
  return moves;
}

function legalMovesFor(game, row, col, color = game.turn) {
  const movingPiece = game.board[row][col];
  if (!movingPiece || movingPiece.color !== color || game.gameOver) return [];
  return pseudoMoves(game, row, col).filter((move) => {
    const copy = cloneState(game);
    applyMove(copy, move, { record: false });
    return !isKingInCheck(copy, movingPiece.color);
  });
}

function pseudoMoves(game, row, col) {
  const movingPiece = game.board[row][col];
  if (!movingPiece) return [];
  const moves = [];
  const push = (toRow, toCol, extra = {}) => {
    if (!inBounds(toRow, toCol)) return;
    const target = game.board[toRow][toCol];
    if (!target || target.color !== movingPiece.color) {
      moves.push({
        from: { row, col },
        to: { row: toRow, col: toCol },
        piece: movingPiece.type,
        color: movingPiece.color,
        capture: Boolean(target),
        ...extra
      });
    }
  };

  if (movingPiece.type === "pawn") {
    const dir = movingPiece.color === WHITE ? -1 : 1;
    const startRow = movingPiece.color === WHITE ? 6 : 1;
    const nextRow = row + dir;
    if (inBounds(nextRow, col) && !game.board[nextRow][col]) {
      push(nextRow, col);
      const doubleRow = row + dir * 2;
      if (row === startRow && !game.board[doubleRow][col]) {
        push(doubleRow, col, { doublePawn: true });
      }
    }
    for (const dc of [-1, 1]) {
      const targetRow = row + dir;
      const targetCol = col + dc;
      if (!inBounds(targetRow, targetCol)) continue;
      const target = game.board[targetRow][targetCol];
      if (target && target.color !== movingPiece.color) {
        push(targetRow, targetCol, { capture: true });
      }
      if (game.enPassant?.row === targetRow && game.enPassant?.col === targetCol) {
        push(targetRow, targetCol, { capture: true, enPassant: true });
      }
    }
    return moves;
  }

  if (movingPiece.type === "knight") {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      push(row + dr, col + dc);
    }
    return moves;
  }

  if (movingPiece.type === "king") {
    for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
      push(row + dr, col + dc);
    }
    moves.push(...castleMoves(game, row, col));
    return moves;
  }

  const directions = {
    bishop: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
    rook: [[-1, 0], [1, 0], [0, -1], [0, 1]],
    queen: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
  }[movingPiece.type];

  for (const [dr, dc] of directions) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const target = game.board[r][c];
      if (!target) {
        push(r, c);
      } else {
        if (target.color !== movingPiece.color) push(r, c, { capture: true });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function castleMoves(game, row, col) {
  const king = game.board[row][col];
  if (!king || king.hasMoved || isKingInCheck(game, king.color)) return [];
  const moves = [];
  const enemy = opposite(king.color);
  const options = [
    { rookCol: 7, pass: [5, 6], toCol: 6, side: "kingside" },
    { rookCol: 0, pass: [3, 2], empty: [1, 2, 3], toCol: 2, side: "queenside" }
  ];
  for (const option of options) {
    const rook = game.board[row][option.rookCol];
    const emptyCols = option.empty || option.pass;
    if (!rook || rook.type !== "rook" || rook.color !== king.color || rook.hasMoved) continue;
    if (emptyCols.some((c) => game.board[row][c])) continue;
    if (option.pass.some((c) => isSquareAttacked(game, row, c, enemy))) continue;
    moves.push({
      from: { row, col },
      to: { row, col: option.toCol },
      piece: "king",
      color: king.color,
      castling: option.side
    });
  }
  return moves;
}

function isKingInCheck(game, color) {
  const king = findKing(game.board, color);
  return king ? isSquareAttacked(game, king.row, king.col, opposite(color)) : false;
}

function findKing(board, color) {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = board[row][col];
      if (p?.type === "king" && p.color === color) return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(game, row, col, attacker) {
  const pawnDir = attacker === WHITE ? -1 : 1;
  for (const dc of [-1, 1]) {
    const r = row - pawnDir;
    const c = col + dc;
    if (game.board[r]?.[c]?.type === "pawn" && game.board[r][c].color === attacker) return true;
  }

  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const p = game.board[row + dr]?.[col + dc];
    if (p?.type === "knight" && p.color === attacker) return true;
  }

  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    const p = game.board[row + dr]?.[col + dc];
    if (p?.type === "king" && p.color === attacker) return true;
  }

  const rays = [
    [-1, -1, ["bishop", "queen"]], [-1, 1, ["bishop", "queen"]],
    [1, -1, ["bishop", "queen"]], [1, 1, ["bishop", "queen"]],
    [-1, 0, ["rook", "queen"]], [1, 0, ["rook", "queen"]],
    [0, -1, ["rook", "queen"]], [0, 1, ["rook", "queen"]]
  ];
  for (const [dr, dc, attackers] of rays) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const p = game.board[r][c];
      if (p) {
        if (p.color === attacker && attackers.includes(p.type)) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

function makeMove(move, promotion = "queen") {
  if (state.gameOver || aiThinking) return false;
  const legal = allLegalMoves(state).find((m) => sameMove(m, move));
  if (!legal) return false;
  if (isPromotionMove(state, legal) && !promotion) {
    openPromotion(legal);
    return false;
  }
  state.snapshots.push(cloneState(state));
  applyMove(state, { ...legal, promotion: isPromotionMove(state, legal) ? promotion : null }, { record: true });
  playMoveSound(state.lastMove);
  afterMove();
  return true;
}

function playMoveSound(move) {
  if (!settings.sound) return;
  if (state.gameOver && state.result?.type === "checkmate") {
    playTone(740, 0.16, "triangle");
    window.setTimeout(() => playTone(980, 0.18, "triangle"), 120);
    return;
  }
  if (isKingInCheck(state, state.turn)) {
    playTone(880, 0.14, "sine");
  } else if (move?.captured) {
    playTone(260, 0.12, "square");
  } else {
    playTone(520, 0.08, "sine");
  }
}

function playTone(frequency, duration = 0.1, type = "sine") {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration + 0.03);
  } catch (error) {
    settings.sound = false;
  }
}

function showToast(message, type = "info") {
  if (!els.toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastStack.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function sameMove(a, b) {
  return a.from.row === b.from.row && a.from.col === b.from.col && a.to.row === b.to.row && a.to.col === b.to.col;
}

function isPromotionMove(game, move) {
  return move.piece === "pawn" && (move.to.row === 0 || move.to.row === 7);
}

function applyMove(game, move, { record }) {
  const movingPiece = game.board[move.from.row][move.from.col];
  const captured = move.enPassant
    ? game.board[move.from.row][move.to.col]
    : game.board[move.to.row][move.to.col];

  game.board[move.from.row][move.from.col] = null;
  if (move.enPassant) game.board[move.from.row][move.to.col] = null;

  const placed = { ...movingPiece, hasMoved: true };
  if (move.promotion) placed.type = move.promotion;
  game.board[move.to.row][move.to.col] = placed;

  if (move.castling) {
    const rookFrom = move.castling === "kingside" ? 7 : 0;
    const rookTo = move.castling === "kingside" ? 5 : 3;
    const rook = game.board[move.from.row][rookFrom];
    game.board[move.from.row][rookFrom] = null;
    game.board[move.from.row][rookTo] = { ...rook, hasMoved: true };
  }

  game.enPassant = move.doublePawn
    ? { row: (move.from.row + move.to.row) / 2, col: move.from.col }
    : null;

  if (record) {
    if (captured) game.captures[movingPiece.color].push(captured);
    const notation = notationForMove(game, move, captured);
    const recordMove = { ...move, captured: captured?.type || null, notation };
    game.history.push(recordMove);
    game.lastMove = recordMove;
    game.halfMove = movingPiece.type === "pawn" || captured ? 0 : game.halfMove + 1;
    if (movingPiece.color === BLACK) game.fullMove++;
  }

  game.turn = opposite(game.turn);
}

function notationForMove(gameAfterMoveBeforeTurn, move, captured) {
  if (move.castling === "kingside") return "O-O";
  if (move.castling === "queenside") return "O-O-O";
  const p = PIECES[move.piece];
  let text = p.letter;
  if (move.piece === "pawn" && captured) text += FILES[move.from.col];
  if (captured) text += "x";
  text += squareName(move.to.row, move.to.col);
  if (move.promotion) text += `=${PIECES[move.promotion].letter}`;
  const enemy = opposite(move.color);
  const copy = cloneState(gameAfterMoveBeforeTurn);
  copy.turn = enemy;
  if (isKingInCheck(copy, enemy)) {
    text += allLegalMoves(copy, enemy).length ? "+" : "#";
  }
  return text;
}

function afterMove() {
  selected = null;
  legalForSelected = [];
  updateGameResult();
  render();
  maybeAiMove();
}

function updateGameResult() {
  const legalMoves = allLegalMoves(state);
  const checked = isKingInCheck(state, state.turn);
  if (checked && legalMoves.length === 0) {
    state.gameOver = true;
    state.result = { type: "checkmate", winner: opposite(state.turn) };
  } else if (!checked && legalMoves.length === 0) {
    state.gameOver = true;
    state.result = { type: "stalemate", winner: null };
  } else if (state.halfMove >= 100) {
    state.gameOver = true;
    state.result = { type: "fifty-move draw", winner: null };
  } else if (insufficientMaterial(state.board)) {
    state.gameOver = true;
    state.result = { type: "insufficient material", winner: null };
  }
  if (state.gameOver) {
    recordCompletedGame();
    playMoveSound(state.lastMove);
    showResult();
  } else if (checked) {
    showToast(`${capitalize(state.turn)} is in check.`, "warning");
  }
}

function recordCompletedGame() {
  if (state.resultRecorded || !state.result) return;
  state.resultRecorded = true;
  const playerWon = state.result.winner === WHITE;
  if (!state.result.winner) {
    playerStats.draws++;
  } else if (playerWon) {
    playerStats.wins++;
  } else {
    playerStats.losses++;
  }
  const record = {
    result: resultText(),
    mode: gameModeName(),
    moves: state.history.length,
    date: new Date().toLocaleString()
  };
  matchHistory.unshift(record);
  matchHistory = matchHistory.slice(0, 12);
  saveProfileData();
  renderMatchHistory();
}

function insufficientMaterial(board) {
  const pieces = [];
  for (const row of board) {
    for (const p of row) {
      if (p && p.type !== "king") pieces.push(p.type);
    }
  }
  if (pieces.length === 0) return true;
  if (pieces.length === 1 && ["bishop", "knight"].includes(pieces[0])) return true;
  return false;
}

function chooseAiMove() {
  const depth = Math.min(4, Number(els.difficulty.value) + 1);
  return getBestMoveFor(BLACK, depth);
}

function getBestMoveFor(color, depth = 1) {
  const moves = allLegalMoves(state, color);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = color === WHITE ? -Infinity : Infinity;
  for (const move of orderedMoves(moves)) {
    const copy = cloneState(state);
    applyMove(copy, { ...move, promotion: isPromotionMove(copy, move) ? "queen" : null }, { record: true });
    updateVirtualResult(copy);
    const score = minimax(copy, Math.max(0, depth - 1), -Infinity, Infinity, color !== WHITE);
    const isBetter = color === WHITE ? score > bestScore : score < bestScore;
    if (isBetter) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function minimax(game, depth, alpha, beta, maximizingWhite) {
  updateVirtualResult(game);
  if (depth === 0 || game.gameOver) return evaluate(game);
  const moves = orderedMoves(allLegalMoves(game));
  if (maximizingWhite) {
    let value = -Infinity;
    for (const move of moves) {
      const copy = cloneState(game);
      applyMove(copy, { ...move, promotion: isPromotionMove(copy, move) ? "queen" : null }, { record: true });
      value = Math.max(value, minimax(copy, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  }
  let value = Infinity;
  for (const move of moves) {
    const copy = cloneState(game);
    applyMove(copy, { ...move, promotion: isPromotionMove(copy, move) ? "queen" : null }, { record: true });
    value = Math.min(value, minimax(copy, depth - 1, alpha, beta, true));
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return value;
}

function updateVirtualResult(game) {
  const moves = allLegalMoves(game);
  if (moves.length === 0) {
    const checked = isKingInCheck(game, game.turn);
    game.gameOver = true;
    game.result = checked ? { type: "checkmate", winner: opposite(game.turn) } : { type: "stalemate", winner: null };
  }
}

function evaluate(game) {
  if (game.gameOver) {
    if (!game.result?.winner) return 0;
    return game.result.winner === WHITE ? 10000 : -10000;
  }
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = game.board[row][col];
      if (!p) continue;
      const center = 3.5 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) * 0.08;
      const value = PIECES[p.type].value + (p.type === "king" ? 0 : center);
      score += p.color === WHITE ? value : -value;
    }
  }
  score += allLegalMoves(game, WHITE).length * 0.03;
  score -= allLegalMoves(game, BLACK).length * 0.03;
  return score;
}

function orderedMoves(moves) {
  return [...moves].sort((a, b) => Number(Boolean(b.capture)) - Number(Boolean(a.capture)));
}

function maybeAiMove() {
  if (state.gameOver || els.mode.value !== "ai" || state.turn !== BLACK) return;
  aiThinking = true;
  els.aiThinking?.classList.add("active");
  renderStatus("Computer thinking", "Black is choosing a move.");
  const thinkingDelay = { 1: 160, 2: 260, 3: 420 }[els.difficulty.value] || 260;
  window.setTimeout(() => {
    const move = chooseAiMove();
    if (move) {
      state.snapshots.push(cloneState(state));
      applyMove(state, { ...move, promotion: isPromotionMove(state, move) ? "queen" : null }, { record: true });
      playMoveSound(state.lastMove);
      updateGameResult();
    }
    aiThinking = false;
    els.aiThinking?.classList.remove("active");
    render();
  }, thinkingDelay);
}

function render() {
  renderBoard();
  renderLabels();
  renderPanels();
  renderStatus();
}

function renderBoard() {
  els.board.innerHTML = "";
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const checkedKing = isKingInCheck(state, state.turn) ? findKing(state.board, state.turn) : null;

  for (const row of rows) {
    for (const col of cols) {
      const button = document.createElement("button");
      const p = state.board[row][col];
      button.className = `square ${(row + col) % 2 ? "dark" : "light"}`;
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute("aria-label", squareName(row, col));
      if (selected?.row === row && selected?.col === col) button.classList.add("selected");
      if (state.lastMove && (sameCoord(state.lastMove.from, { row, col }) || sameCoord(state.lastMove.to, { row, col }))) button.classList.add("last");
      if (hintedMove && (sameCoord(hintedMove.from, { row, col }) || sameCoord(hintedMove.to, { row, col }))) button.classList.add("hinted");
      if (legalForSelected.some((m) => sameCoord(m.to, { row, col }) && !m.capture)) button.classList.add("legal");
      if (legalForSelected.some((m) => sameCoord(m.to, { row, col }) && m.capture)) button.classList.add("capture");
      if (checkedKing && checkedKing.row === row && checkedKing.col === col) button.classList.add("check");
      if (p) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${p.color}`;
        if (state.lastMove && sameCoord(state.lastMove.to, { row, col })) {
          pieceEl.classList.add("moved");
        }
        pieceEl.textContent = PIECES[p.type][p.color];
        button.append(pieceEl);
      }
      button.addEventListener("click", () => onSquareClick(row, col));
      els.board.append(button);
    }
  }
}

function sameCoord(a, b) {
  return a.row === b.row && a.col === b.col;
}

function renderLabels() {
  const files = flipped ? [...FILES].reverse() : FILES;
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  els.files.innerHTML = files.map((file) => `<span>${file}</span>`).join("");
  els.ranks.innerHTML = ranks.map((rank) => `<span>${rank}</span>`).join("");
}

function renderPanels() {
  els.whitePlayer.classList.toggle("active", state.turn === WHITE && !state.gameOver);
  els.blackPlayer.classList.toggle("active", state.turn === BLACK && !state.gameOver);
  els.whiteClock.textContent = formatTime(state.clocks.white, state.clockEnabled);
  els.blackClock.textContent = formatTime(state.clocks.black, state.clockEnabled);
  els.whiteLabel.textContent = playerProfile.name || "Player 1";
  els.blackLabel.textContent = els.mode.value === "ai" ? computerLevelName() : "Player 2";
  els.sessionName.textContent = playerProfile.loggedIn
    ? `${playerProfile.name} signed in`
    : `${playerProfile.name} playing as guest`;
  els.whiteCaptures.textContent = state.captures.white.map((p) => PIECES[p.type][p.color]).join(" ");
  els.blackCaptures.textContent = state.captures.black.map((p) => PIECES[p.type][p.color]).join(" ");
  els.moveList.innerHTML = "";
  for (let i = 0; i < state.history.length; i += 2) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${state.history[i]?.notation || ""}</strong> ${state.history[i + 1]?.notation || ""}`;
    els.moveList.append(li);
  }
  els.moveList.scrollTop = els.moveList.scrollHeight;
  els.moveCount.textContent = state.history.length;
  els.material.textContent = materialAdvantageText();
  els.scoreSummary.textContent = `${playerStats.wins} / ${playerStats.losses} / ${playerStats.draws}`;
  els.bestMove.textContent = bestMoveText();
  renderMatchHistory();
}

function computerLevelName() {
  const names = { 1: "Computer - Easy", 2: "Computer - Normal", 3: "Computer - Hard" };
  return names[els.difficulty?.value] || "Computer";
}

function gameModeName() {
  return els.mode?.value === "ai" ? computerLevelName() : "Two Players";
}

function bestMoveText() {
  const move = getBestMoveFor(state.turn, 1);
  return move ? `${squareName(move.from.row, move.from.col)}-${squareName(move.to.row, move.to.col)}` : "--";
}

function renderMatchHistory() {
  if (!els.matchHistory) return;
  if (!matchHistory.length) {
    els.matchHistory.innerHTML = `<div class="match-history-item">No completed matches yet.</div>`;
    return;
  }
  els.matchHistory.innerHTML = matchHistory
    .map((item) => `
      <div class="match-history-item">
        <strong>${item.result}</strong>
        ${item.mode} · ${item.moves} moves · ${item.date}
      </div>
    `)
    .join("");
}

function renderStatus(title, detail) {
  els.statusCard?.classList.remove("check-warning");
  if (title) {
    els.statusTitle.textContent = title;
    els.statusDetail.textContent = detail || "";
    return;
  }
  if (state.gameOver) {
    els.statusTitle.textContent = "Game over";
    els.statusDetail.textContent = resultText();
    return;
  }
  const player = state.turn === WHITE ? "White" : "Black";
  const check = isKingInCheck(state, state.turn);
  if (check) els.statusCard?.classList.add("check-warning");
  els.statusTitle.textContent = check ? `${player} is in check` : `${player} to move`;
  els.statusDetail.textContent = selected
    ? `${legalForSelected.length} legal move${legalForSelected.length === 1 ? "" : "s"} available.`
    : "Select a piece to move.";
}

function onSquareClick(row, col) {
  if (state.gameOver || aiThinking || (els.mode.value === "ai" && state.turn === BLACK)) return;
  const p = state.board[row][col];
  if (selected) {
    const target = legalForSelected.find((m) => m.to.row === row && m.to.col === col);
    if (target) {
      if (isPromotionMove(state, target)) {
        openPromotion(target);
      } else {
        makeMove(target, null);
      }
      return;
    }
  }
  if (p?.color === state.turn) {
    selected = { row, col };
    legalForSelected = legalMovesFor(state, row, col);
  } else {
    if (selected) showToast("Invalid move. Choose a highlighted square.", "warning");
    selected = null;
    legalForSelected = [];
  }
  render();
}

function openPromotion(move) {
  pendingPromotion = move;
  for (const button of els.promotion.querySelectorAll(".promotion-choice")) {
    const type = button.dataset.piece;
    button.textContent = PIECES[type][state.turn];
  }
  els.promotion.showModal();
}

function showResult() {
  window.setTimeout(() => {
    els.resultTitle.textContent = state.result?.winner ? `${capitalize(state.result.winner)} wins` : "Draw";
    els.resultMessage.textContent = resultText();
    els.resultMoveCount.textContent = state.history.length;
    els.resultMode.textContent = gameModeName();
    els.result.showModal();
  }, 120);
}

function resultText() {
  if (!state.result) return "";
  if (state.result.winner) return `${capitalize(state.result.winner)} wins by ${state.result.type}.`;
  return `Draw by ${state.result.type}.`;
}

function materialScore() {
  let score = 0;
  for (const row of state.board) {
    for (const p of row) {
      if (!p || p.type === "king") continue;
      score += p.color === WHITE ? PIECES[p.type].value : -PIECES[p.type].value;
    }
  }
  return score > 0 ? `+${score}` : `${score}`;
}

function materialAdvantageText() {
  const score = Number(materialScore());
  if (score > 0) return `White +${score}`;
  if (score < 0) return `Black +${Math.abs(score)}`;
  return "Even";
}

function formatTime(seconds, enabled) {
  if (!enabled) return "--:--";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function resetGame() {
  clearInterval(timerId);
  state = newState();
  const seconds = Number(els.time.value);
  state.clockEnabled = seconds > 0;
  state.clocks.white = seconds;
  state.clocks.black = seconds;
  selected = null;
  legalForSelected = [];
  pendingPromotion = null;
  aiThinking = false;
  startClock();
  render();
}

function requestRestart() {
  if (state.history.length && !state.gameOver) {
    els.restart.showModal();
  } else {
    resetGame();
    showToast("New game ready.", "success");
  }
}

function saveCurrentGame() {
  try {
    const data = {
      state: cloneState(state),
      settings,
      playerProfile,
      setupMode,
      flipped
    };
    localStorage.setItem("raj_chess_saved_game", JSON.stringify(data));
    flashButton(els.save);
    showToast("Game saved locally.", "success");
  } catch (error) {
    showToast("Could not save this game.", "error");
  }
}

function loadSavedGame() {
  try {
    const data = JSON.parse(localStorage.getItem("raj_chess_saved_game") || "null");
    if (!data?.state) {
      showToast("No saved game found.", "warning");
      return;
    }
    clearInterval(timerId);
    state = { ...data.state, snapshots: [] };
    settings = { ...settings, ...(data.settings || {}) };
    playerProfile = { ...playerProfile, ...(data.playerProfile || {}) };
    setupMode = data.setupMode || setupMode;
    flipped = Boolean(data.flipped);
    applySettings();
    startClock();
    render();
    flashButton(els.load);
    showToast("Saved game loaded.", "success");
  } catch (error) {
    showToast("Saved game is invalid.", "error");
  }
}

function moveText() {
  if (!state.history.length) return "No moves played.";
  const rows = [];
  for (let i = 0; i < state.history.length; i += 2) {
    rows.push(`${i / 2 + 1}. ${state.history[i]?.notation || ""} ${state.history[i + 1]?.notation || ""}`.trim());
  }
  return rows.join("\n");
}

async function copyMoves() {
  const text = moveText();
  try {
    await navigator.clipboard.writeText(text);
    showToast("Move notation copied.", "success");
  } catch (error) {
    showToast(text, "info");
  }
}

function exportGame() {
  const payload = [
    "Raj Chess Game",
    `Mode: ${gameModeName()}`,
    `Player: ${playerProfile.name}`,
    `Result: ${state.result ? resultText() : "In progress"}`,
    "",
    moveText()
  ].join("\n");
  const blob = new Blob([payload], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `raj-chess-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Game exported.", "success");
}

function showHint() {
  if (state.gameOver || aiThinking) return;
  const move = getBestMoveFor(state.turn, Math.min(3, Math.max(1, Number(els.difficulty.value))));
  if (!move) {
    showToast("No hint available.", "warning");
    return;
  }
  hintedMove = move;
  selected = { ...move.from };
  legalForSelected = legalMovesFor(state, move.from.row, move.from.col);
  render();
  showToast(`Hint: ${squareName(move.from.row, move.from.col)} to ${squareName(move.to.row, move.to.col)}.`, "success");
  window.setTimeout(() => {
    hintedMove = null;
    render();
  }, 4500);
}

function toggleColorMode() {
  settings.colorMode = settings.colorMode === "dark" ? "light" : "dark";
  applySettings();
  saveProfileData();
  showToast(`${capitalize(settings.colorMode)} mode enabled.`, "success");
}

function toggleFullscreenBoard() {
  document.body.classList.toggle("fullscreen-board");
  showToast(document.body.classList.contains("fullscreen-board") ? "Fullscreen board enabled." : "Fullscreen board closed.", "success");
}

function startClock() {
  if (!state.clockEnabled) return;
  timerId = setInterval(() => {
    if (state.gameOver || aiThinking) return;
    state.clocks[state.turn] -= 1;
    if (state.clocks[state.turn] <= 0) {
      state.clocks[state.turn] = 0;
      state.gameOver = true;
      state.result = { type: "timeout", winner: opposite(state.turn) };
      recordCompletedGame();
      showResult();
    }
    renderPanels();
    renderStatus();
  }, 1000);
}

function undoMove() {
  if (!state.snapshots.length || aiThinking) return;
  state = state.snapshots.pop();
  if (!settings.practiceMode && els.mode.value === "ai" && state.turn === BLACK && state.snapshots.length) {
    state = state.snapshots.pop();
  }
  state.snapshots = state.snapshots || [];
  selected = null;
  legalForSelected = [];
  render();
  showToast("Move undone.", "success");
}

function flashButton(button) {
  if (!button) return;
  button.classList.remove("saved-flash");
  void button.offsetWidth;
  button.classList.add("saved-flash");
}

function handleShortcut(event) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if (key === "n") {
    event.preventDefault();
    requestRestart();
  } else if (key === "u") {
    event.preventDefault();
    undoMove();
  } else if (key === "h") {
    event.preventDefault();
    showHint();
  } else if (key === "f") {
    event.preventDefault();
    toggleFullscreenBoard();
  } else if (key === "s") {
    event.preventDefault();
    saveCurrentGame();
  }
}

function setupCollapsiblePanels() {
  document.querySelectorAll(".side-panel .panel-block").forEach((panel) => {
    if (panel.classList.contains("compact-actions")) return;
    panel.classList.add("collapsible");
    const heading = panel.querySelector("h2");
    heading?.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 700px)").matches) {
        panel.classList.toggle("collapsed");
      }
    });
  });
}

function showScreen(screen) {
  els.loginScreen.classList.toggle("hidden", screen !== "login");
  els.setupScreen.classList.toggle("hidden", screen !== "setup");
  els.gameScreen.classList.toggle("hidden", screen !== "game");
  const active = { login: els.loginScreen, setup: els.setupScreen, game: els.gameScreen }[screen];
  active?.classList.remove("screen-enter");
  void active?.offsetWidth;
  active?.classList.add("screen-enter");
}

function continueToSetup({ guest }) {
  const typedName = els.loginName.value.trim();
  playerProfile = {
    name: typedName || (guest ? "Guest Player" : "Player"),
    email: els.loginEmail.value.trim(),
    avatar: els.avatar.value,
    loggedIn: !guest
  };
  saveProfileData();
  els.welcomePlayer.textContent = `Ready, ${playerProfile.name}`;
  showScreen("setup");
  showToast(`Welcome ${playerProfile.name}.`, "success");
}

function chooseMode(mode) {
  setupMode = mode;
  for (const choice of els.modeChoices) {
    choice.classList.toggle("active", choice.dataset.mode === mode);
  }
  els.setupLevel.disabled = mode !== "ai";
  updateDifficultyHelp();
}

function startConfiguredMatch() {
  els.mode.value = setupMode;
  els.difficulty.value = els.setupLevel.value;
  els.time.value = els.setupClock.value;
  settings.boardTheme = els.setupTheme.value;
  settings.practiceMode = els.practiceMode.checked;
  els.boardTheme.value = settings.boardTheme;
  applySettings();
  saveProfileData();
  showScreen("game");
  resetGame();
  showToast(`${gameModeName()} started.`, "success");
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem("raj_chess_profile") || "null");
    const savedSettings = JSON.parse(localStorage.getItem("raj_chess_settings") || "null");
    const savedStats = JSON.parse(localStorage.getItem("raj_chess_stats") || "null");
    const savedHistory = JSON.parse(localStorage.getItem("raj_chess_match_history") || "null");
    if (saved?.name) {
      playerProfile = { ...playerProfile, ...saved };
      els.loginName.value = saved.name;
      els.loginEmail.value = saved.email || "";
      els.avatar.value = saved.avatar || "\u2654";
    }
    if (savedSettings) settings = { ...settings, ...savedSettings };
    if (savedStats) playerStats = { ...playerStats, ...savedStats };
    if (Array.isArray(savedHistory)) matchHistory = savedHistory;
  } catch (error) {
    playerProfile = { name: "Guest", email: "", avatar: "\u2654", loggedIn: false };
  }
}

function saveProfileData() {
  try {
    localStorage.setItem("raj_chess_profile", JSON.stringify(playerProfile));
    localStorage.setItem("raj_chess_settings", JSON.stringify(settings));
    localStorage.setItem("raj_chess_stats", JSON.stringify(playerStats));
    localStorage.setItem("raj_chess_match_history", JSON.stringify(matchHistory));
  } catch (error) {
    showToast("Storage is not available in this browser.", "warning");
  }
}

function updateDifficultyHelp() {
  const descriptions = {
    1: "Easy level for beginners and quick practice.",
    2: "Balanced computer play for practice.",
    3: "Hard level with deeper move search."
  };
  els.difficultyHelp.textContent = setupMode === "ai"
    ? descriptions[els.setupLevel.value]
    : "Computer level is disabled in two-player mode.";
}

function applySettings() {
  document.body.dataset.boardTheme = settings.boardTheme;
  document.body.dataset.colorMode = settings.colorMode;
  els.soundToggle.checked = settings.sound;
  els.boardTheme.value = settings.boardTheme;
  els.setupTheme.value = settings.boardTheme;
  els.practiceMode.checked = settings.practiceMode;
}

function init() {
  Object.assign(els, {
    loading: document.getElementById("loading-screen"),
    toastStack: document.getElementById("toast-stack"),
    loginScreen: document.getElementById("login-screen"),
    setupScreen: document.getElementById("setup-screen"),
    gameScreen: document.getElementById("game-screen"),
    loginForm: document.getElementById("login-form"),
    loginName: document.getElementById("login-name"),
    loginEmail: document.getElementById("login-email"),
    avatar: document.getElementById("avatar-select"),
    guestPlay: document.getElementById("guest-play"),
    welcomePlayer: document.getElementById("welcome-player"),
    modeChoices: document.querySelectorAll(".mode-choice"),
    setupLevel: document.getElementById("setup-level"),
    setupClock: document.getElementById("setup-clock"),
    setupTheme: document.getElementById("setup-theme"),
    practiceMode: document.getElementById("practice-mode"),
    difficultyHelp: document.getElementById("difficulty-help"),
    startMatch: document.getElementById("start-match"),
    backLogin: document.getElementById("back-login"),
    sessionName: document.getElementById("session-name"),
    board: document.getElementById("chess-board"),
    files: document.getElementById("file-labels"),
    ranks: document.getElementById("rank-labels"),
    mode: document.getElementById("mode-select"),
    difficulty: document.getElementById("difficulty-select"),
    time: document.getElementById("time-select"),
    newGame: document.getElementById("new-game"),
    themeToggle: document.getElementById("theme-toggle"),
    fullscreen: document.getElementById("fullscreen-board"),
    flip: document.getElementById("flip-board"),
    undo: document.getElementById("undo-move"),
    hint: document.getElementById("hint-move"),
    resign: document.getElementById("resign-game"),
    draw: document.getElementById("draw-game"),
    save: document.getElementById("save-game"),
    load: document.getElementById("load-game"),
    boardTheme: document.getElementById("board-theme"),
    soundToggle: document.getElementById("sound-toggle"),
    aiThinking: document.getElementById("ai-thinking"),
    whitePlayer: document.getElementById("white-player"),
    blackPlayer: document.getElementById("black-player"),
    whiteAvatar: document.querySelector("#white-player .player-dot"),
    whiteClock: document.getElementById("white-clock"),
    blackClock: document.getElementById("black-clock"),
    whiteLabel: document.getElementById("white-label"),
    blackLabel: document.getElementById("black-label"),
    whiteCaptures: document.getElementById("white-captures"),
    blackCaptures: document.getElementById("black-captures"),
    moveList: document.getElementById("move-list"),
    moveCount: document.getElementById("move-count"),
    material: document.getElementById("material-score"),
    scoreSummary: document.getElementById("score-summary"),
    bestMove: document.getElementById("best-move"),
    matchHistory: document.getElementById("match-history"),
    statusCard: document.querySelector(".status-card"),
    statusTitle: document.getElementById("status-title"),
    statusDetail: document.getElementById("status-detail"),
    promotion: document.getElementById("promotion-dialog"),
    restart: document.getElementById("restart-dialog"),
    result: document.getElementById("result-dialog"),
    resultTitle: document.getElementById("result-title"),
    resultMessage: document.getElementById("result-message"),
    resultMoveCount: document.getElementById("result-move-count"),
    resultMode: document.getElementById("result-mode")
  });

  loadProfile();
  applySettings();
  els.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    continueToSetup({ guest: false });
  });
  els.guestPlay.addEventListener("click", () => continueToSetup({ guest: true }));
  for (const choice of els.modeChoices) {
    choice.addEventListener("click", () => chooseMode(choice.dataset.mode));
  }
  els.setupLevel.addEventListener("change", updateDifficultyHelp);
  els.startMatch.addEventListener("click", startConfiguredMatch);
  els.backLogin.addEventListener("click", () => showScreen("login"));
  els.newGame.addEventListener("click", requestRestart);
  els.mode.addEventListener("change", resetGame);
  els.difficulty.addEventListener("change", () => {
    renderPanels();
    showToast(`${computerLevelName()} selected.`, "success");
  });
  els.time.addEventListener("change", resetGame);
  els.themeToggle.addEventListener("click", toggleColorMode);
  els.fullscreen.addEventListener("click", toggleFullscreenBoard);
  els.boardTheme.addEventListener("change", () => {
    settings.boardTheme = els.boardTheme.value;
    applySettings();
    saveProfileData();
    showToast(`${capitalize(settings.boardTheme)} board enabled.`, "success");
  });
  els.soundToggle.addEventListener("change", () => {
    settings.sound = els.soundToggle.checked;
    saveProfileData();
  });
  els.flip.addEventListener("click", () => {
    flipped = !flipped;
    render();
  });
  els.undo.addEventListener("click", undoMove);
  els.hint.addEventListener("click", showHint);
  els.save.addEventListener("click", saveCurrentGame);
  els.load.addEventListener("click", loadSavedGame);
  els.resign.addEventListener("click", () => {
    if (state.gameOver) return;
    state.gameOver = true;
    state.result = { type: "resignation", winner: opposite(state.turn) };
    recordCompletedGame();
    render();
    showResult();
  });
  els.draw.addEventListener("click", () => {
    if (state.gameOver) return;
    state.gameOver = true;
    state.result = { type: "agreement", winner: null };
    recordCompletedGame();
    render();
    showResult();
  });
  els.promotion.addEventListener("close", () => {
    if (!pendingPromotion || !els.promotion.returnValue) return;
    makeMove(pendingPromotion, els.promotion.returnValue);
    pendingPromotion = null;
    els.promotion.returnValue = "";
  });
  els.result.addEventListener("close", () => {
    if (els.result.returnValue === "new") resetGame();
    els.result.returnValue = "";
  });
  els.restart.addEventListener("close", () => {
    if (els.restart.returnValue === "restart") {
      resetGame();
      showToast("New game ready.", "success");
    }
    els.restart.returnValue = "";
  });
  document.addEventListener("keydown", handleShortcut);
  setupCollapsiblePanels();
  chooseMode("ai");
  updateDifficultyHelp();
  resetGame();
  showScreen("login");
  window.setTimeout(() => els.loading?.classList.add("hidden"), 650);
}

document.addEventListener("DOMContentLoaded", init);
