// Kiểm tra toàn bộ bài học trong lessons.js: node tools/check-lessons.js
// Mỗi thử thách phải giải được: sao ăn được hết, chuỗi nước hợp lệ, có nước chiếu hết đúng số nước...
const path = require('path');
Object.assign(global, require(path.join(__dirname, '..', 'chess.js')));
const { COURSE, LessonSolver } = require(path.join(__dirname, '..', 'lessons.js'));

const parse = u => ({ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), promotion: u[4] ? u[4].toUpperCase() : undefined });
const validSq = s => /^[a-h][1-8]$/.test(s);
let errors = 0, lessons = 0, steps = 0;

function fail(where, msg) { errors++; console.log(`✗ ${where}: ${msg}`); }

function checkLine(g, line, i, side, where) {
  if (i >= line.length) return;
  const alts = line[i].split('|');
  const mine = g.turn === side;
  if (!mine && alts.length > 1) fail(where, `nước ${i + 1} của máy không được có nhiều đáp án`);
  for (const a of mine ? alts : alts.slice(0, 1)) {
    const m = g.move(parse(a));
    if (!m) { fail(where, `nước ${i + 1} (${a}) không hợp lệ`); continue; }
    checkLine(g, line, i + 1, side, where);
    g.undo();
  }
}

const GOALS = {
  castle: (g, m, s) => (m.flag === 'castleK' || m.flag === 'castleQ') && (!s.castle || m.flag === 'castle' + s.castle),
  promote: (g, m) => !!m.promotion,
  check: g => g.inCheck(),
  dcheck: g => g.inCheck() && attackers(g) >= 2,
  mate: g => g.status() === 'checkmate',
};

function attackers(g) {
  const k = g.kingSquare(g.turn), by = opposite(g.turn);
  let n = 0;
  for (let i = 0; i < 64; i++) {
    const p = g.board[i];
    if (!p || p[0] !== by) continue;
    const saved = g.board.slice();
    for (let j = 0; j < 64; j++) if (j !== i && j !== k && g.board[j] && g.board[j][0] === by) g.board[j] = null;
    if (g.isAttacked(k, by)) n++;
    g.board = saved;
  }
  return n;
}

COURSE.forEach((unit, u) => {
  unit.lessons.forEach((lesson, k) => {
    lessons++;
    const where0 = `Phần ${u + 1} · Bài ${k + 1} "${lesson.title}"`;
    if (lesson.review) return;
    if (!lesson.steps.length) fail(where0, 'không có thử thách nào');
    lesson.steps.forEach((s, j) => {
      steps++;
      const where = `${where0} · thử thách ${j + 1}`;
      const side = s.side || 'w';
      let g;
      try { g = new Chess(s.fen); } catch (e) { return fail(where, 'FEN lỗi: ' + e.message); }
      if (s.marks && !s.marks.every(validSq)) fail(where, 'marks có ô sai');
      if (s.t === 'quiz') {
        if (!(s.answer >= 0 && s.answer < s.options.length)) fail(where, 'answer sai');
        return;
      }
      if (s.t === 'tap') {
        if (!s.squares.length || !s.squares.every(validSq)) fail(where, 'squares sai');
        return;
      }
      if (s.t !== 'line' && g.turn !== side) fail(where, `FEN phải tới lượt ${side}`);
      if (g.kingSquare(opposite(g.turn)) >= 0 && g.inCheck(opposite(g.turn))) fail(where, 'bên không tới lượt đang bị chiếu (thế cờ sai luật)');
      switch (s.t) {
        case 'stars': {
          if (!s.stars.every(validSq)) return fail(where, 'stars có ô sai');
          const p = LessonSolver.collect(g, new Set(s.stars.map(sqIndex)));
          if (!p) fail(where, 'không ăn hết được sao');
          break;
        }
        case 'capture': {
          const targets = new Set();
          g.board.forEach((p, i) => { if (p && p[0] !== side && p[1] !== 'K') targets.add(i); });
          if (!targets.size) return fail(where, 'không có quân để ăn');
          if (!LessonSolver.collect(g, targets)) fail(where, 'không ăn hết được quân');
          break;
        }
        case 'line':
          checkLine(g, s.line, 0, side, where);
          if (!s.line.some((x, i) => { const gg = new Chess(s.fen); for (let t = 0; t < i; t++) gg.move(parse(s.line[t].split('|')[0])); return gg.turn === side; }))
            fail(where, 'người học không có nước nào để đi');
          break;
        case 'goal': {
          const f = GOALS[s.goal];
          if (!f) return fail(where, 'goal lạ: ' + s.goal);
          const ok = g.legalMoves().filter(m => { const x = g.move(m); const r = f(g, x, s); g.undo(); return r; });
          if (!ok.length) fail(where, 'không có nước nào đạt mục tiêu');
          if (ok.length === g.legalMoves().length && s.goal !== 'castle' && s.goal !== 'promote') console.log(`  (lưu ý) ${where}: nước nào cũng đúng`);
          break;
        }
        case 'mate': {
          if (!LessonSolver.mateIn(g, s.n)) fail(where, `không có chiếu hết trong ${s.n} nước`);
          else if (s.n > 1 && LessonSolver.mateIn(g, s.n - 1)) fail(where, `có chiếu hết nhanh hơn (${s.n - 1} nước)`);
          break;
        }
        case 'win':
        case 'run':
          if (g.kingSquare('w') < 0 || g.kingSquare('b') < 0) fail(where, 'cần đủ hai Vua');
          if (g.isGameOver()) fail(where, 'ván đã kết thúc');
          if (!(s.limit > 0)) fail(where, 'thiếu limit');
          break;
        default:
          fail(where, 'loại thử thách lạ: ' + s.t);
      }
    });
  });
});

console.log(`\n${COURSE.length} phần · ${lessons} bài · ${steps} thử thách · ${errors ? errors + ' lỗi' : 'không có lỗi'}`);
if (lessons < 100) { console.log('✗ Cần ít nhất 100 bài'); process.exitCode = 1; }
if (errors) process.exitCode = 1;
