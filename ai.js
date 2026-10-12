// AI đơn giản: negamax + cắt tỉa alpha-beta + tìm kiếm tĩnh (quiescence) cho các nước ăn quân.

const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

// Bảng điểm vị trí, nhìn từ phía Trắng (index 0 = a8)
const PST = {
  P: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0],
  N: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50],
  B: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20],
  R: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0],
  Q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20],
  K: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20],
};

const MATE = 100000;
const MAX_QUIESCE = 4;

// Điểm theo góc nhìn của bên đang tới lượt
function evaluate(game) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (!p) continue;
    const t = p[1];
    if (p[0] === 'w') score += PIECE_VALUE[t] + PST[t][i];
    else score -= PIECE_VALUE[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
  }
  return game.turn === 'w' ? score : -score;
}

function moveOrder(m) {
  let s = 0;
  if (m.captured) s += 10 * PIECE_VALUE[m.captured[1]] - PIECE_VALUE[m.piece[1]] + 1000;
  if (m.promotion) s += PIECE_VALUE[m.promotion];
  return s;
}

function quiesce(game, alpha, beta, depth) {
  const stand = evaluate(game);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (depth >= MAX_QUIESCE) return alpha;
  const captures = game.legalMoves().filter(m => m.captured);
  captures.sort((a, b) => moveOrder(b) - moveOrder(a));
  for (const m of captures) {
    const u = game._apply(m);
    const score = -quiesce(game, -beta, -alpha, depth + 1);
    game._undo(u);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(game, depth, alpha, beta, ply) {
  const moves = game.legalMoves();
  if (moves.length === 0) return game.inCheck() ? -MATE + ply : 0;
  if (game.halfmove >= 100) return 0;
  if (depth === 0) return quiesce(game, alpha, beta, 0);
  moves.sort((a, b) => moveOrder(b) - moveOrder(a));
  for (const m of moves) {
    const u = game._apply(m);
    const score = -negamax(game, depth - 1, -beta, -alpha, ply + 1);
    game._undo(u);
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// level: 1 = Dễ, 2 = Trung bình, 3 = Khó
function findBestMove(game, level) {
  const moves = game.legalMoves();
  if (!moves.length) return null;
  // Xáo trộn để máy không đi giống hệt nhau mỗi ván
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  moves.sort((a, b) => moveOrder(b) - moveOrder(a));

  const depth = level;
  const noise = level === 1 ? 120 : 0; // mức Dễ thỉnh thoảng đi nước chưa tối ưu
  let best = moves[0], bestScore = -Infinity;
  for (const m of moves) {
    const u = game._apply(m);
    let score = -negamax(game, depth - 1, -MATE - 1, MATE + 1, 1);
    game._undo(u);
    score += Math.random() * noise;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { findBestMove, evaluate };
