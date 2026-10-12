// Engine cờ vua: luật đầy đủ (nhập thành, bắt tốt qua đường, phong cấp,
// chiếu, chiếu hết, hết nước đi, luật 50 nước, lặp lại 3 lần, không đủ quân).
// Bàn cờ là mảng 64 ô: index 0 = a8, 7 = h8, 56 = a1, 63 = h1.
// Quân cờ là chuỗi 2 ký tự: màu ('w' | 'b') + loại ('K','Q','R','B','N','P').

const FILES = 'abcdefgh';
const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function sqName(i) { return FILES[i & 7] + (8 - (i >> 3)); }
function sqIndex(name) { return (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]); }
function opposite(color) { return color === 'w' ? 'b' : 'w'; }

class Chess {
  constructor(fen = START_FEN) { this.load(fen); }

  load(fen) {
    const parts = fen.trim().split(/\s+/);
    const castle = parts[2] || '-';
    this.board = Array(64).fill(null);
    let i = 0;
    for (const ch of parts[0]) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) { i += Number(ch); continue; }
      this.board[i++] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
    }
    this.turn = parts[1] || 'w';
    this.castling = {
      wK: castle.includes('K'), wQ: castle.includes('Q'),
      bK: castle.includes('k'), bQ: castle.includes('q'),
    };
    this.ep = parts[3] && parts[3] !== '-' ? sqIndex(parts[3]) : -1;
    this.halfmove = Number(parts[4]) || 0;
    this.fullmove = Number(parts[5]) || 1;
    this.history = [];
    this.rep = { [this.key()]: 1 };
  }

  reset() { this.load(START_FEN); }

  // Khóa vị trí dùng để phát hiện lặp lại 3 lần
  key() {
    const c = this.castling;
    return this.board.map(p => p || '--').join('') + this.turn +
      (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '') + this.ep;
  }

  kingSquare(color) { return this.board.indexOf(color + 'K'); }

  isAttacked(sq, by) {
    const b = this.board, r = sq >> 3, c = sq & 7;
    const inside = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;

    const pr = by === 'w' ? r + 1 : r - 1; // tốt tấn công theo đường chéo về phía trước
    for (const dc of [-1, 1]) {
      if (inside(pr, c + dc) && b[pr * 8 + c + dc] === by + 'P') return true;
    }
    for (const [dr, dc] of KNIGHT_D) {
      if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'N') return true;
    }
    for (const [dr, dc] of KING_D) {
      if (inside(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === by + 'K') return true;
    }
    const rays = [[ROOK_D, 'R'], [BISHOP_D, 'B']];
    for (const [dirs, type] of rays) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) {
            if (p === by + type || p === by + 'Q') return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }

  // Thế cờ không có vua (dùng trong bài học) thì coi như không bị chiếu
  inCheck(color = this.turn) {
    const k = this.kingSquare(color);
    return k >= 0 && this.isAttacked(k, opposite(color));
  }

  _slide(moves, i, p, dirs, single) {
    const r = i >> 3, c = i & 7;
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const t = rr * 8 + cc, q = this.board[t];
        if (q) {
          if (q[0] !== p[0]) moves.push({ from: i, to: t, piece: p, captured: q });
          break;
        }
        moves.push({ from: i, to: t, piece: p });
        if (single) break;
        rr += dr; cc += dc;
      }
    }
  }

  _pawn(moves, i, p) {
    const b = this.board, color = p[0];
    const r = i >> 3, c = i & 7;
    const dir = color === 'w' ? -1 : 1;
    const startRow = color === 'w' ? 6 : 1;
    const promoRow = color === 'w' ? 0 : 7;
    const r1 = r + dir;
    const add = (to, captured) => {
      if (r1 === promoRow) {
        for (const promo of ['Q', 'R', 'B', 'N']) moves.push({ from: i, to, piece: p, captured, promotion: promo });
      } else {
        moves.push({ from: i, to, piece: p, captured });
      }
    };
    const one = r1 * 8 + c;
    if (!b[one]) {
      add(one);
      const two = (r + 2 * dir) * 8 + c;
      if (r === startRow && !b[two]) moves.push({ from: i, to: two, piece: p, flag: 'double' });
    }
    for (const dc of [-1, 1]) {
      const cc = c + dc;
      if (cc < 0 || cc > 7) continue;
      const t = r1 * 8 + cc;
      if (b[t] && b[t][0] !== color) add(t, b[t]);
      else if (t === this.ep) moves.push({ from: i, to: t, piece: p, captured: opposite(color) + 'P', flag: 'ep' });
    }
  }

  _castling(moves, i, p) {
    const color = p[0], opp = opposite(color), home = color === 'w' ? 60 : 4, b = this.board;
    if (i !== home) return;
    if (this.castling[color + 'K'] && !b[home + 1] && !b[home + 2] && b[home + 3] === color + 'R' &&
        !this.isAttacked(home, opp) && !this.isAttacked(home + 1, opp) && !this.isAttacked(home + 2, opp)) {
      moves.push({ from: home, to: home + 2, piece: p, flag: 'castleK' });
    }
    if (this.castling[color + 'Q'] && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === color + 'R' &&
        !this.isAttacked(home, opp) && !this.isAttacked(home - 1, opp) && !this.isAttacked(home - 2, opp)) {
      moves.push({ from: home, to: home - 2, piece: p, flag: 'castleQ' });
    }
  }

  pseudoMoves(color = this.turn) {
    const moves = [];
    for (let i = 0; i < 64; i++) {
      const p = this.board[i];
      if (!p || p[0] !== color) continue;
      switch (p[1]) {
        case 'P': this._pawn(moves, i, p); break;
        case 'N': this._slide(moves, i, p, KNIGHT_D, true); break;
        case 'B': this._slide(moves, i, p, BISHOP_D, false); break;
        case 'R': this._slide(moves, i, p, ROOK_D, false); break;
        case 'Q': this._slide(moves, i, p, KING_D, false); break;
        case 'K': this._slide(moves, i, p, KING_D, true); this._castling(moves, i, p); break;
      }
    }
    return moves;
  }

  legalMoves(color = this.turn) {
    return this.pseudoMoves(color).filter(m => {
      const u = this._apply(m);
      const ok = !this.inCheck(color);
      this._undo(u);
      return ok;
    });
  }

  // Thực hiện nước đi (không kiểm tra hợp lệ), trả về dữ liệu để hoàn tác
  _apply(m) {
    const b = this.board, color = m.piece[0];
    const undo = { m, castling: { ...this.castling }, ep: this.ep, halfmove: this.halfmove, fullmove: this.fullmove };
    b[m.to] = m.promotion ? color + m.promotion : m.piece;
    b[m.from] = null;
    if (m.flag === 'ep') b[m.to + (color === 'w' ? 8 : -8)] = null;
    if (m.flag === 'castleK') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null; }
    if (m.flag === 'castleQ') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null; }
    this.ep = m.flag === 'double' ? (m.from + m.to) / 2 : -1;
    if (m.piece[1] === 'K') { this.castling[color + 'K'] = false; this.castling[color + 'Q'] = false; }
    for (const sq of [m.from, m.to]) {
      if (sq === 63) this.castling.wK = false;
      if (sq === 56) this.castling.wQ = false;
      if (sq === 7) this.castling.bK = false;
      if (sq === 0) this.castling.bQ = false;
    }
    this.halfmove = m.piece[1] === 'P' || m.captured ? 0 : this.halfmove + 1;
    if (color === 'b') this.fullmove++;
    this.turn = opposite(color);
    return undo;
  }

  _undo(u) {
    const m = u.m, b = this.board, color = m.piece[0];
    b[m.from] = m.piece;
    if (m.flag === 'ep') {
      b[m.to] = null;
      b[m.to + (color === 'w' ? 8 : -8)] = m.captured;
    } else {
      b[m.to] = m.captured || null;
    }
    if (m.flag === 'castleK') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = null; }
    if (m.flag === 'castleQ') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = null; }
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    this.fullmove = u.fullmove;
    this.turn = color;
  }

  _san(m, legal) {
    if (m.flag === 'castleK') return 'O-O';
    if (m.flag === 'castleQ') return 'O-O-O';
    const type = m.piece[1];
    let s = '';
    if (type === 'P') {
      if (m.captured) s = FILES[m.from & 7] + 'x';
      s += sqName(m.to);
      if (m.promotion) s += '=' + m.promotion;
      return s;
    }
    s = type;
    const others = legal.filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
    if (others.length) {
      const sameFile = others.some(o => (o.from & 7) === (m.from & 7));
      const sameRank = others.some(o => (o.from >> 3) === (m.from >> 3));
      if (!sameFile) s += FILES[m.from & 7];
      else if (!sameRank) s += 8 - (m.from >> 3);
      else s += sqName(m.from);
    }
    if (m.captured) s += 'x';
    return s + sqName(m.to);
  }

  // Đi một nước hợp lệ: {from, to, promotion?}. Trả về nước đi đầy đủ hoặc null.
  move({ from, to, promotion }) {
    const legal = this.legalMoves();
    const m = legal.find(x => x.from === from && x.to === to && (x.promotion || null) === (promotion || null));
    if (!m) return null;
    let san = this._san(m, legal);
    const undo = this._apply(m);
    if (this.inCheck()) san += this.legalMoves().length ? '+' : '#';
    this.history.push({ move: m, undo, san });
    const k = this.key();
    this.rep[k] = (this.rep[k] || 0) + 1;
    return m;
  }

  undo() {
    const h = this.history.pop();
    if (!h) return null;
    this.rep[this.key()]--;
    this._undo(h.undo);
    return h.move;
  }

  insufficientMaterial() {
    const pieces = this.board.filter(p => p && p[1] !== 'K');
    if (pieces.length === 0) return true;
    return pieces.length === 1 && (pieces[0][1] === 'N' || pieces[0][1] === 'B');
  }

  // 'playing' | 'checkmate' | 'stalemate' | 'fifty' | 'repetition' | 'insufficient'
  status() {
    if (this.legalMoves().length === 0) return this.inCheck() ? 'checkmate' : 'stalemate';
    if (this.halfmove >= 100) return 'fifty';
    if (this.rep[this.key()] >= 3) return 'repetition';
    if (this.insufficientMaterial()) return 'insufficient';
    return 'playing';
  }

  isGameOver() { return this.status() !== 'playing'; }
}

if (typeof module !== 'undefined') module.exports = { Chess, sqName, sqIndex, opposite };
