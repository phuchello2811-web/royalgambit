// Giao diện: vẽ bàn cờ, kéo thả quân, hiệu ứng, đăng nhập, rank, Elo và bảng xếp hạng.

// Kiểm tra các file đã được cập nhật đủ chưa (tránh lỗi âm thầm khi trộn file cũ và mới)
if (typeof Profile === 'undefined' || !Profile.BOT_ELO || typeof Online === 'undefined' || !Online.oppElo || !document.getElementById('placeModal') ||
    !Profile.isAdmin || !document.getElementById('adminModal') || !document.getElementById('adminNote') ||
    !Online.findMatch || typeof Contest === 'undefined' || !Profile.dbCall || !document.getElementById('contestModal') ||
    !Contest.medals || !Online.startedAt || typeof Learn === 'undefined' || !Learn.enter || !document.getElementById('contestBanner') ||
    !document.getElementById('learnHome')) {
  throw new Error('Thiếu file mới: hãy thay đủ index.html, app.js, profile.js, online.js, contest.js, lessons.js, learn.js, sound.js, style.css rồi bấm Ctrl+F5');
}

const MIN_RANKED_PLIES = 4; // ván ngắn hơn 4 nước (tính cả hai bên) không tính rank/Elo
const BOT_ELO = Profile.BOT_ELO; // Elo của máy theo độ khó
const COLOR_NAME = { w: 'Trắng', b: 'Đen' };
const LEVEL_NAME = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó' };
const REASONS = {
  checkmate: 'Chiếu hết',
  stalemate: 'Hết nước đi (pat)',
  fifty: 'Luật 50 nước',
  repetition: 'Lặp lại thế cờ 3 lần',
  insufficient: 'Không đủ quân để chiếu hết',
};
const THEMES = [
  ['green', 'Xanh lá', '#ebecd0', '#739552'],
  ['brown', 'Gỗ', '#f0d9b5', '#b58863'],
  ['blue', 'Xanh dương', '#dee3e6', '#8ca2ad'],
  ['purple', 'Tím', '#efe6f7', '#9479b8'],
  ['night', 'Đêm', '#9fa8b5', '#4f5b6c'],
];

const game = new Chess();
const $ = id => document.getElementById(id);
const boardEl = $('board');

let selected = -1;      // ô đang chọn
let selectedMoves = []; // các nước hợp lệ của quân đang chọn
let flipped = false;
let aiColor = $('mode').value; // 'w' | 'b' | 'none'
let gameLevel = Number($('level').value);
let thinking = false;
let gameId = 0;         // để bỏ qua kết quả AI của ván cũ
let mode = 'play';      // 'play' (máy / 2 người) | 'online' | 'learn'
let hint = null;        // {from, to}: nước gợi ý đang tô sáng
let marks = new Set();  // ô được đánh dấu bằng chuột phải
let playResult = null;  // xin thua ở chế độ Chơi: { winner, reason, score }
let ratedDone = false;  // ván hiện tại đã xử lý kết quả chưa
let quietResult = false;
let assisted = false;   // ván với máy có dùng Gợi ý / Đi lại thì không tính Elo
let seenMove = null, seenLen = 0; // để nhận ra nước mới cần hiệu ứng
let skipAnim = false;   // nước vừa đi bằng kéo thả thì không cần trượt
let drag = null;
const contestById = new Map(); // tra contest theo id (kể cả khi đang chơi ván contest)
// Tự ghép cặp contest (xem phần "Contest: tự ghép cặp" ở cuối file)
const AUTO_NEXT = 8000; // ván contest xong bao lâu thì tự tìm ván tiếp
const Auto = {
  mine: [],          // contest sắp / đang diễn ra mà mình đã đăng ký
  paused: new Set(), // contest người chơi đã tạm dừng tự ghép
  running: null,     // contest đang tự ghép / đang đấu
  doneAt: 0,         // lúc ván contest vừa xong
  retryAt: 0,        // tìm lỗi (mạng...) thì chờ tới lúc này mới thử lại
};

const pieceSrc = p => `pieces/${p}.svg`;
const disp = i => flipped ? 63 - i : i; // vị trí hiển thị của ô i
const rowCol = i => [disp(i) >> 3, disp(i) & 7];

// ---------------- Vẽ bàn cờ ----------------

function render() {
  const h = game.history;
  const last = h.length ? h[h.length - 1].move : null;
  const isNew = last && last !== seenMove && h.length === seenLen + 1;
  seenMove = last;
  seenLen = h.length;

  const checkSq = game.inCheck() ? game.kingSquare(game.turn) : -1;
  const targets = new Map(selectedMoves.map(m => [m.to, m]));
  const deco = mode === 'learn' ? Learn.deco() : null; // { stars, ok, bad, focus }: tô ô cho bài học
  const stars = deco ? deco.stars : new Set();

  boardEl.innerHTML = '';
  for (let k = 0; k < 64; k++) {
    const i = flipped ? 63 - k : k;
    const r = i >> 3, c = i & 7;
    const sq = document.createElement('div');
    sq.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
    if (i === selected) sq.classList.add('selected');
    if (last && (i === last.from || i === last.to)) sq.classList.add('last');
    if (i === checkSq) sq.classList.add('check');
    if (marks.has(i)) sq.classList.add('marked');
    if (targets.has(i)) sq.classList.add(targets.get(i).captured ? 'capture' : 'target');
    if (hint && (i === hint.from || i === hint.to)) sq.classList.add('hint');
    if (deco) {
      if (deco.focus.has(i)) sq.classList.add('focus');
      if (deco.ok.has(i)) sq.classList.add('tap-ok');
      if (deco.bad.has(i)) sq.classList.add('tap-bad');
    }

    const p = game.board[i];
    if (p) {
      const img = document.createElement('img');
      img.className = 'piece';
      img.src = pieceSrc(p);
      img.alt = '';
      img.draggable = false;
      if (drag && drag.moved && drag.from === i) img.classList.add('dragging');
      sq.appendChild(img);
    }
    if (stars.has(i)) sq.insertAdjacentHTML('beforeend', '<span class="star">★</span>');
    if ((k & 7) === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
    if (k >= 56) sq.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
    boardEl.appendChild(sq);
  }

  if (isNew) {
    if (!skipAnim) animate(last);
    const over = game.isGameOver();
    Sound.play(over ? 'end' : game.inCheck() ? 'check' : last.captured ? 'capture' : 'move');
  }
  skipAnim = false;

  renderStatus();
  renderMoves();
  renderPlayers();
  checkResult();
}

// Trượt quân từ ô cũ sang ô mới (và Xe khi nhập thành)
function animate(m) {
  const slide = (from, to) => {
    const img = boardEl.children[disp(to)].querySelector('.piece');
    if (!img) return;
    const [fr, fc] = rowCol(from), [tr, tc] = rowCol(to);
    img.classList.add('moving');
    img.style.transition = 'none';
    img.style.transform = `translate(${(fc - tc) * 100}%, ${(fr - tr) * 100}%)`;
    img.getBoundingClientRect(); // ép trình duyệt áp vị trí đầu
    img.style.transition = '';
    img.style.transform = '';
    img.addEventListener('transitionend', () => img.classList.remove('moving'), { once: true });
  };
  slide(m.from, m.to);
  if (m.flag === 'castleK') slide(m.to + 1, m.to - 1);
  if (m.flag === 'castleQ') slide(m.to - 2, m.to + 1);
}

function renderStatus() {
  const el = $('status');
  el.className = 'status';
  const custom = mode === 'learn' ? Learn.status() : mode === 'online' ? Online.status() : null;
  if (custom) {
    el.textContent = custom.text;
    if (custom.cls) el.classList.add(custom.cls);
    return;
  }
  const s = game.status();
  if (playResult) {
    el.textContent = `${playResult.reason} – ${COLOR_NAME[playResult.winner]} thắng`;
    el.classList.add('over');
  } else if (s === 'checkmate') {
    el.textContent = `Chiếu hết! ${COLOR_NAME[opposite(game.turn)]} thắng`;
    el.classList.add('over');
  } else if (s !== 'playing') {
    el.textContent = 'Hòa – ' + REASONS[s].toLowerCase();
    el.classList.add('over');
  } else if (thinking) {
    el.textContent = 'Máy đang suy nghĩ…';
    el.classList.add('thinking');
  } else {
    el.textContent = `Lượt ${COLOR_NAME[game.turn]} đi` + (game.inCheck() ? ' – đang bị chiếu!' : '');
    if (game.inCheck()) el.classList.add('in-check');
  }
}

function renderMoves() {
  const box = $('moves');
  box.innerHTML = '';
  const h = game.history;
  if (!h.length) box.innerHTML = '<p class="empty">Chưa có nước đi nào</p>';
  for (let i = 0; i < h.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    row.innerHTML = `<span class="num">${i / 2 + 1}.</span><span class="mv"></span><span class="mv"></span>`;
    row.children[1].textContent = h[i].san;
    if (h[i + 1]) row.children[2].textContent = h[i + 1].san;
    const cur = row.children[(h.length - 1 - i) + 1];
    if (cur && h.length - 1 - i < 2) cur.classList.add('current');
    box.appendChild(row);
  }
  box.scrollTop = box.scrollHeight;
}

// Thông tin người chơi ở mỗi bên bàn cờ
function playerInfo(c) {
  if (mode === 'online') return Online.player(c);
  if (mode === 'play' && aiColor !== 'none') {
    if (c === aiColor) return { name: 'Máy · ' + LEVEL_NAME[gameLevel], rank: null, elo: BOT_ELO[gameLevel], bot: true };
    const me = Profile.me();
    return { name: me.name, rank: Profile.rankOf(me.exp), elo: me.elo, photo: me.photo, me: true };
  }
  return { name: 'Người chơi ' + COLOR_NAME[c], rank: null };
}

function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 42%)`;
}

function setAvatar(el, info, c) {
  el.innerHTML = '';
  el.className = el.className.replace(/ ?(bot|piece-av|photo)/g, '');
  el.style.background = '';
  if (info.photo) {
    el.classList.add('photo');
    const img = document.createElement('img');
    img.src = info.photo;
    img.alt = '';
    el.appendChild(img);
  } else if (info.bot || (!info.me && info.rank == null)) {
    el.classList.add(info.bot ? 'bot' : 'piece-av');
    el.style.background = '';
    const img = document.createElement('img');
    img.src = pieceSrc(c + (info.bot ? 'N' : 'K'));
    img.alt = '';
    el.appendChild(img);
  } else {
    el.textContent = (info.name.trim()[0] || '?').toUpperCase();
    el.style.background = avatarColor(info.name);
  }
}

function renderPlayers() {
  const capturedBy = { w: [], b: [] };
  for (const { move } of game.history) {
    if (move.captured) capturedBy[move.piece[0]].push(move.captured);
  }
  const order = 'QRBNP';
  const value = { Q: 9, R: 5, B: 3, N: 3, P: 1 };
  const material = { w: 0, b: 0 };
  for (const c of ['w', 'b']) {
    capturedBy[c].sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));
    material[c] = capturedBy[c].reduce((s, p) => s + value[p[1]], 0);
  }
  const fill = (pos, c) => {
    const info = playerInfo(c);
    $(pos + 'Name').textContent = info.name;
    const parts = [];
    if (info.rank) parts.push(info.rank.text);
    if (info.elo != null) parts.push(info.elo + ' Elo');
    $(pos + 'Rating').textContent = parts.length ? `(${parts.join(' · ')})` : '';
    $(pos + 'Rating').style.color = info.rank ? info.rank.color : '';
    setAvatar($(pos + 'Avatar'), info, c);
    const diff = material[c] - material[opposite(c)];
    const box = $(pos + 'Captured');
    box.innerHTML = '';
    let prev = '';
    for (const p of capturedBy[c]) {
      const img = document.createElement('img');
      img.src = pieceSrc(p);
      img.alt = '';
      if (p[1] !== prev) img.className = 'group';
      prev = p[1];
      box.appendChild(img);
    }
    if (diff > 0) box.insertAdjacentHTML('beforeend', `<b>+${diff}</b>`);
    $(pos + 'Player').classList.toggle('active', game.turn === c && !game.isGameOver() && !playResult && mode !== 'learn');
  };
  const bottom = flipped ? 'b' : 'w';
  fill('bottom', bottom);
  fill('top', opposite(bottom));
}

function renderHeader() {
  const me = Profile.me();
  $('meName').textContent = me.name;
  const rank = Profile.rankOf(me.exp);
  $('meRating').textContent = `${rank.text} · ${me.elo} Elo`;
  $('meRating').style.color = rank.color;
  setAvatar($('meAvatar'), { name: me.name, photo: me.photo, me: true }, 'w');
  document.body.dataset.board = Profile.prefs().board;
  // Chỉ tài khoản ADMIN thấy tab Admin; admin được dùng Gợi ý trong ván Online
  const staff = Profile.isAdmin();
  $('adminTab').hidden = !Profile.isOwner();
  $('onlineHint').hidden = !staff;
  $('onlineTools').classList.toggle('three', !staff);
}

// ---------------- Thao tác trên bàn cờ ----------------

function canHumanMove() {
  if (mode === 'learn') return Learn.canMove();
  if (mode === 'online') return Online.canMove();
  return !thinking && !playResult && game.turn !== aiColor && !game.isGameOver();
}

function select(i) {
  selected = i;
  selectedMoves = game.legalMoves().filter(m => m.from === i);
}

function onSquare(i, dragged = false) {
  if (!canHumanMove()) return;
  const matches = selectedMoves.filter(m => m.to === i);
  if (matches.length) {
    if (matches.length > 1) askPromotion(matches, dragged);
    else play(matches[0], dragged);
    return;
  }
  const p = game.board[i];
  if (p && p[0] === game.turn && i !== selected) select(i);
  else clearSelection();
  render();
}

function clearSelection() {
  selected = -1;
  selectedMoves = [];
}

function squareAt(e) {
  const r = boardEl.getBoundingClientRect();
  const col = Math.floor((e.clientX - r.left) / r.width * 8);
  const row = Math.floor((e.clientY - r.top) / r.height * 8);
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  const k = row * 8 + col;
  return flipped ? 63 - k : k;
}

function setDragOver(i) {
  if (drag.over === i) return;
  if (drag.over >= 0) boardEl.children[disp(drag.over)].classList.remove('drag-over');
  if (i >= 0) boardEl.children[disp(i)].classList.add('drag-over');
  drag.over = i;
}

function endDrag() {
  if (drag && drag.ghost) drag.ghost.remove();
  drag = null;
}

boardEl.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  Sound.unlock();
  const i = squareAt(e);
  if (i < 0) return;
  if (mode === 'learn' && Learn.tapMode()) return Learn.tap(i); // bài "bấm vào ô"
  if (marks.size) { marks.clear(); render(); }
  if (!canHumanMove()) return;
  const p = game.board[i];
  if (!p || p[0] !== game.turn) return onSquare(i);
  const wasSelected = selected === i;
  if (!wasSelected) { select(i); render(); }
  drag = { from: i, x: e.clientX, y: e.clientY, moved: false, wasSelected, over: -1, ghost: null };
  boardEl.setPointerCapture(e.pointerId);
  e.preventDefault();
});

boardEl.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!drag.moved) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
    drag.moved = true;
    const size = boardEl.getBoundingClientRect().width / 8;
    const ghost = document.createElement('img');
    ghost.className = 'drag-ghost';
    ghost.src = pieceSrc(game.board[drag.from]);
    ghost.style.width = ghost.style.height = size + 'px';
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    const img = boardEl.children[disp(drag.from)].querySelector('.piece');
    if (img) img.classList.add('dragging');
  }
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top = e.clientY + 'px';
  setDragOver(squareAt(e));
});

boardEl.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  endDrag();
  const i = squareAt(e);
  if (d.moved) {
    if (selectedMoves.some(m => m.to === i)) onSquare(i, true);
    else render(); // thả ra ngoài: quân về chỗ cũ, vẫn giữ chọn
  } else if (d.wasSelected) {
    clearSelection();
    render();
  }
});

boardEl.addEventListener('pointercancel', () => { endDrag(); render(); });

// Chuột phải: đánh dấu ô (như khi phân tích)
boardEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  const i = squareAt(e);
  if (i < 0) return;
  if (marks.has(i)) marks.delete(i); else marks.add(i);
  render();
});

function askPromotion(moves, dragged) {
  const modal = $('promo');
  const box = $('promoChoices');
  box.innerHTML = '';
  for (const m of moves) {
    const btn = document.createElement('button');
    btn.innerHTML = `<img src="${pieceSrc(m.piece[0] + m.promotion)}" alt="${m.promotion}">`;
    btn.addEventListener('click', () => { modal.hidden = true; play(m, dragged); });
    box.appendChild(btn);
  }
  modal.hidden = false;
}

function play(m, dragged = false) {
  clearSelection();
  hint = null;
  marks.clear();
  skipAnim = dragged;
  if (mode === 'learn') return Learn.onMove(m);
  game.move(m);
  if (mode === 'online') Online.sendMove(m);
  render();
  maybeAiMove();
}

// Gợi ý nước đi tốt (dùng AI mức Trung bình). Chế độ Chơi: ai cũng dùng được;
// ván Online: chỉ admin. Admin dùng Gợi ý vẫn được tính Elo và rank (không đặt `assisted`).
function showHint() {
  const staff = Profile.isAdmin();
  if (!(mode === 'play' || (mode === 'online' && staff)) || !canHumanMove()) return;
  if (!staff && isRatedBotGame() && !assisted) {
    if (!confirm('Dùng Gợi ý thì ván này sẽ không tính Elo. Tiếp tục?')) return;
    assisted = true;
    renderRatedNote();
  }
  const m = findBestMove(game, 2);
  if (m) hint = { from: m.from, to: m.to };
  render();
}

function maybeAiMove() {
  if (mode !== 'play' || game.turn !== aiColor || game.isGameOver() || playResult) return;
  thinking = true;
  render();
  const id = gameId;
  // setTimeout để trình duyệt kịp vẽ lại trước khi AI tính toán
  setTimeout(() => {
    if (id !== gameId) return;
    const m = findBestMove(game, gameLevel);
    thinking = false;
    if (m) game.move(m);
    render();
  }, 350);
}

// ---------------- Ván đấu & rank ----------------

function startRatedGame() {
  ratedDone = false;
  assisted = false;
  playResult = null;
  $('resultModal').hidden = true;
}

// Đang đấu với máy (ván có thể tính Elo)
function isRatedBotGame() {
  return mode === 'play' && aiColor !== 'none' && !ratedDone && !playResult && !game.isGameOver();
}

// Bỏ ván giữa chừng khi đấu với máy bị tính thua (như chess.com). Trả về false nếu người chơi hủy.
function abandonBotGame() {
  if (!isRatedBotGame() || assisted || game.history.length < MIN_RANKED_PLIES) return true;
  if (!confirm('Bỏ ván giữa chừng sẽ bị tính thua và mất Elo. Tiếp tục?')) return false;
  ratedDone = true;
  Profile.recordBot(0, BOT_ELO[gameLevel]);
  return true;
}

function renderRatedNote() {
  const el = $('ratedNote');
  const rated = aiColor !== 'none';
  el.classList.toggle('off', !rated || assisted);
  el.textContent = !rated ? '2 người cùng máy không tính Elo'
    : assisted ? (Profile.isAdmin() ? 'Ván này không tính Elo vì đã dùng Đi lại' : 'Ván này không tính Elo vì đã dùng Gợi ý / Đi lại')
    : `Đấu với máy ${LEVEL_NAME[gameLevel]} (${BOT_ELO[gameLevel]} Elo) có tính Elo, không tính rank · ${Profile.isAdmin() ? 'Admin: Gợi ý vẫn tính, Đi lại thì không' : 'dùng Gợi ý hoặc Đi lại thì không tính'}`;
}

function newGame() {
  if (!abandonBotGame()) return false;
  gameId++;
  thinking = false;
  game.reset();
  clearSelection();
  hint = null;
  marks.clear();
  aiColor = $('mode').value;
  gameLevel = Number($('level').value);
  flipped = aiColor === 'w';
  startRatedGame();
  renderRatedNote();
  render();
  maybeAiMove();
  return true;
}

// Đổi chế độ / độ khó giữa ván: nếu người chơi hủy thì trả ô chọn về như cũ
function changeSetup() {
  if (!newGame()) {
    $('mode').value = aiColor;
    $('level').value = String(gameLevel);
  }
}

function undo() {
  if (thinking || playResult || !game.history.length) return;
  if (isRatedBotGame() && !assisted) {
    if (!confirm('Đi lại thì ván này sẽ không tính Elo. Tiếp tục?')) return;
    assisted = true;
    renderRatedNote();
  }
  hint = null;
  game.undo();
  // Khi đấu với máy, lùi thêm một nước để quay về lượt của người chơi
  if (game.turn === aiColor && game.history.length) game.undo();
  clearSelection();
  render();
  maybeAiMove();
}

function resignPlay() {
  if (playResult || game.isGameOver() || !game.history.length) return;
  const loser = aiColor === 'none' ? game.turn : opposite(aiColor);
  if (!confirm(aiColor === 'none' ? `${COLOR_NAME[loser]} xin thua?` : 'Bạn chắc chắn muốn xin thua?')) return;
  gameId++;
  thinking = false;
  playResult = { winner: opposite(loser), reason: `${COLOR_NAME[loser]} xin thua`, score: aiColor === 'none' ? null : 0 };
  render();
}

function gameOutcome() {
  if (mode === 'online') {
    const o = Online.outcome();
    return o && { ...o, reason: o.reason || REASONS[game.status()] };
  }
  if (mode !== 'play') return null;
  const human = aiColor === 'none' ? null : opposite(aiColor);
  if (playResult) return { ...playResult };
  const s = game.status();
  if (s === 'playing') return null;
  const winner = s === 'checkmate' ? opposite(game.turn) : null;
  return { winner, reason: REASONS[s], score: human ? (winner ? (winner === human ? 1 : 0) : 0.5) : null };
}

function checkResult() {
  if (ratedDone) return;
  const o = gameOutcome();
  if (!o) return;
  ratedDone = true;
  // Ván Online: tính rank (exp) và Elo. Ván đấu với máy: chỉ tính Elo. 2 người cùng máy: không tính.
  let change = null, note = null;
  if (o.score != null) {
    if (mode === 'play' && assisted) note = Profile.isAdmin() ? 'Ván có dùng Đi lại nên không tính Elo' : 'Ván có dùng Gợi ý / Đi lại nên không tính Elo';
    else if (game.history.length < MIN_RANKED_PLIES) note = mode === 'online' ? 'Ván quá ngắn nên không tính rank và Elo' : 'Ván quá ngắn nên không tính Elo';
    else change = mode === 'online' ? Profile.record(o.score, Online.oppElo()) : Profile.recordBot(o.score, BOT_ELO[gameLevel]);
    // Ván ghép trong contest: cộng điểm contest (thắng +2, hòa +1, thua 0)
    if (change && mode === 'online' && Online.contest()) {
      const c = contestById.get(Online.contest());
      if (c) change.contest = Contest.record(c, o.score, Online.startedAt());
    }
  }
  if (mode === 'online' && Online.contest()) Auto.doneAt = Date.now(); // đếm giờ tự ghép ván contest tiếp theo
  if (!quietResult) setTimeout(() => showResult(o, change, note), 600);
}

function showResult(o, change, note) {
  const title = o.score == null
    ? (o.winner ? `${COLOR_NAME[o.winner]} thắng!` : 'Hòa!')
    : o.score === 1 ? 'Bạn thắng!' : o.score === 0 ? 'Bạn thua' : 'Hòa!';
  const kind = o.score == null ? (o.winner ? 'win' : 'draw') : o.score === 1 ? 'win' : o.score === 0 ? 'loss' : 'draw';
  $('resultIcon').className = 'result-icon ' + kind;
  $('resultIcon').innerHTML = `<svg class="ic"><use href="#i-${kind === 'win' ? 'trophy' : kind === 'loss' ? 'flag' : 'handshake'}"/></svg>`;
  $('resultTitle').textContent = title;
  $('resultReason').textContent = o.reason || '';
  const box = $('resultRating');
  box.innerHTML = '';
  if (change) {
    if (change.before) { // ván Online: có đổi rank
      const { before, after } = change;
      const sign = change.delta > 0 ? '+' : '';
      box.innerHTML = `<span class="muted">Rank</span> <b style="color:${before.color}">${before.text}</b> → <b style="color:${after.color}">${after.text}</b>
        <span class="delta ${change.delta > 0 ? 'up' : change.delta < 0 ? 'down' : ''}">${sign}${change.delta} exp</span>`;
      if (after.tier > before.tier) box.insertAdjacentHTML('beforeend', `<div class="rank-up">Lên rank ${after.name}!</div>`);
      else if (after.tier < before.tier) box.insertAdjacentHTML('beforeend', `<div class="rank-down">Xuống rank ${after.name}</div>`);
    }
    const e = change.elo;
    const es = e.delta > 0 ? '+' : '';
    box.insertAdjacentHTML('beforeend', `<div class="elo-line"><span class="muted">Elo</span> <b>${e.before}</b> → <b>${e.after}</b>
      <span class="delta ${e.delta > 0 ? 'up' : e.delta < 0 ? 'down' : ''}">${es}${e.delta}</span></div>`);
    if (change.contest) {
      const line = document.createElement('div');
      line.className = 'elo-line';
      line.innerHTML = '<span class="muted">Contest</span> <b></b> <span class="delta"></span>';
      line.querySelector('b').textContent = change.contest.name;
      const d = line.querySelector('.delta');
      d.textContent = `+${change.contest.pts} điểm`;
      if (change.contest.pts > 0) d.classList.add('up');
      box.appendChild(line);
    }
  } else if (note) {
    box.innerHTML = `<span class="muted">${note}</span>`;
  }
  const inContest = mode === 'online' && !!Online.contest();
  if (inContest) box.insertAdjacentHTML('beforeend', `<div class="elo-line muted">Web sẽ tự ghép ván contest tiếp theo sau ${AUTO_NEXT / 1000} giây</div>`);
  $('resultAgain').textContent = inContest ? 'Ván contest tiếp theo' : mode === 'online' ? 'Mời chơi ván mới' : 'Ván mới';
  $('resultAgain').hidden = mode === 'online' && !inContest && !Online.connected();
  $('resultModal').hidden = false;
}

// ---------------- Chuyển chế độ ----------------

function setMode(m) {
  if (m === mode) return;
  if (mode === 'online' && Online.inGame() && game.history.length >= 2 &&
      !confirm('Rời phòng giữa ván sẽ bị tính thua. Tiếp tục?')) return;
  if (mode === 'play' && m !== 'play' && !abandonBotGame()) return;
  if (mode === 'online' && Auto.running) Auto.paused.add(Auto.running); // tự rời Online: tạm dừng tự ghép contest
  quietResult = true;
  if (mode === 'online') Online.leave();
  if (mode === 'learn') Learn.leave();
  quietResult = false;
  mode = m;
  gameId++;
  thinking = false;
  aiColor = 'none';
  hint = null;
  marks.clear();
  ratedDone = true;
  playResult = null;
  $('resultModal').hidden = true;
  document.body.dataset.mode = m;
  if (m === 'online') Profile.refreshAdmin(); // người vừa được cấp quyền admin thấy nút Gợi ý ngay
  for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.setAttribute('aria-selected', tab.dataset.mode === m);
  $('playPanel').hidden = m !== 'play';
  $('onlinePanel').hidden = m !== 'online';
  $('learnPanel').hidden = m !== 'learn';
  if (m === 'play') newGame();
  else if (m === 'learn') Learn.enter();
  else render();
}

// ---------------- Hộp thoại ----------------

function openModal(id) { $(id).hidden = false; }

for (const modal of document.querySelectorAll('.modal:not(.auth-gate)')) {
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true;
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') for (const m of document.querySelectorAll('.modal:not(.auth-gate)')) m.hidden = true;
});

$('resultAgain').addEventListener('click', () => {
  $('resultModal').hidden = true;
  if (mode === 'online' && Online.contest()) autoNow();
  else if (mode === 'online') Online.rematch();
  else newGame();
});

// Hộp thoại rank: rank hiện tại, luật cộng/trừ exp và danh sách các rank
function openRank() {
  const R = Profile.rules;
  const me = Profile.me();
  const r = Profile.rankOf(me.exp);
  const stars = r.top
    ? `<span class="on">★</span> × ${r.stars}`
    : Array.from({ length: R.starsPerRank }, (_, i) => `<span class="${i < r.stars ? 'on' : ''}">★</span>`).join('');
  const note = r.top
    ? `Rank cao nhất · Tổng ${r.exp} exp`
    : `${r.inStar}/${R.perStar} exp tới sao tiếp theo · Tổng ${r.exp} exp`;
  const cur = $('rankCurrent');
  cur.style.setProperty('--rk', r.color);
  cur.innerHTML = `<div class="rank-badge">${r.name}</div>
    <div class="rk-stars">${stars}</div>
    <div class="progress"><div class="progress-bar" style="width:${100 * r.inStar / R.perStar}%;background:${r.color}"></div></div>
    <p class="muted">${note}</p>`;

  const fmt = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  $('rankRules').innerHTML = `<span class="up">Thắng<b>${fmt(R.win)}</b></span>
    <span>Hòa<b>${fmt(R.draw)}</b></span>
    <span class="down">Thua<b>${fmt(R.loss)}</b></span>`;
  $('rankHint').textContent = `Rank chỉ tính ván Online · ${R.perStar} exp = 1 sao · đủ ${R.starsPerRank} sao thì lên rank tiếp theo.`;

  const list = $('rankTiers');
  list.innerHTML = '';
  Profile.RANKS.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = i === r.tier ? 'cur' : i < r.tier ? 'done' : 'locked';
    li.style.setProperty('--rk', t.color);
    li.innerHTML = '<span class="dot"></span><b></b><small></small>';
    li.children[1].textContent = t.name;
    li.children[2].textContent = i === 0 ? 'Khởi đầu' : `từ ${i * R.perRank} exp`;
    list.appendChild(li);
  });
  openModal('rankModal');
}

// Hồ sơ & cài đặt
function renderProfileAvatar() {
  const me = Profile.me();
  setAvatar($('profileAvatar'), { name: me.name, photo: me.photo, me: true }, 'w');
  $('avatarRemove').hidden = !me.photo;
}

function openProfile() {
  const me = Profile.me();
  const rank = Profile.rankOf(me.exp);
  $('profileUser').textContent = me.name;
  $('profileRank').textContent = `${rank.text} · ${me.elo} Elo`;
  $('profileRank').style.color = rank.color;
  const role = Profile.isOwner() ? 'Chủ web' : Profile.isAdmin() ? 'Admin' : '';
  $('profileRole').textContent = role;
  $('profileRole').hidden = !role;
  renderProfileAvatar();
  $('statGames').textContent = me.games;
  $('statWins').textContent = me.wins;
  $('statDraws').textContent = me.draws;
  $('statLosses').textContent = me.losses;
  $('soundToggle').checked = Profile.prefs().sound;
  $('profileMsg').textContent = '';
  renderThemes();
  renderMedals();
  openModal('profileModal');
}

// ----- Huy chương contest (hạng 1 / 2 / 3 khi contest kết thúc) -----

const MEDAL_NAME = { 1: 'Vàng', 2: 'Bạc', 3: 'Đồng' };
const MEDAL_CLS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function medalEl(place, n) {
  const m = document.createElement('span');
  m.className = 'medal ' + MEDAL_CLS[place];
  m.title = `Huy chương ${MEDAL_NAME[place]}` + (n > 1 ? ` × ${n}` : '');
  m.textContent = place;
  if (n > 1) m.dataset.n = '×' + n;
  return m;
}

async function renderMedals() {
  const box = $('profileMedals');
  box.hidden = true;
  let list = [];
  try { list = (await Contest.medals())[Profile.uid()] || []; } catch { return; }
  if (!list.length) return; // không có huy chương thì không hiện gì
  const [g, s, b] = Contest.count(list);
  $('medalCounts').innerHTML = '';
  [[1, g], [2, s], [3, b]].forEach(([p, n]) => {
    const card = document.createElement('div');
    card.className = 'medal-card ' + MEDAL_CLS[p] + (n ? '' : ' none');
    card.appendChild(medalEl(p));
    card.insertAdjacentHTML('beforeend', `<b>${n}</b><span>${MEDAL_NAME[p]}</span>`);
    $('medalCounts').appendChild(card);
  });
  const ul = $('medalList');
  ul.innerHTML = '';
  for (const m of list.slice(0, 12)) {
    const li = document.createElement('li');
    li.appendChild(medalEl(m.place));
    li.insertAdjacentHTML('beforeend', '<span class="ml-name"></span><small></small>');
    li.querySelector('.ml-name').textContent = `Hạng ${m.place} · ${m.name}`;
    li.querySelector('small').textContent = fmtDate(m.end);
    ul.appendChild(li);
  }
  box.hidden = false;
}

function renderThemes() {
  const box = $('themeChoices');
  box.innerHTML = '';
  for (const [key, name, light, dark] of THEMES) {
    const b = document.createElement('button');
    b.className = 'theme' + (Profile.prefs().board === key ? ' on' : '');
    b.title = name;
    b.innerHTML = `<span style="background:linear-gradient(135deg, ${light} 50%, ${dark} 50%)"></span><small>${name}</small>`;
    b.addEventListener('click', () => { Profile.setPref('board', key); renderThemes(); });
    box.appendChild(b);
  }
}

$('logoutBtn').addEventListener('click', async () => {
  const midGame = mode === 'online' && Online.inGame() && game.history.length >= 2;
  if (midGame && !confirm('Đăng xuất giữa ván online sẽ bị tính thua. Tiếp tục?')) return;
  quietResult = true;
  if (mode === 'online') Online.leave(); // rời ván giữa chừng được ghi thua trước khi đăng xuất
  quietResult = false;
  $('logoutBtn').disabled = true;
  await Profile.logout();
  location.reload();
});
$('avatarUpload').addEventListener('click', () => $('avatarFile').click());
$('profileAvatar').addEventListener('click', () => $('avatarFile').click());
$('avatarFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = ''; // cho phép chọn lại cùng một file
  if (!file) return;
  try {
    await Profile.setPhoto(file);
    $('profileMsg').textContent = '';
  } catch (err) {
    $('profileMsg').textContent = err.message === 'size' ? 'Ảnh quá lớn (tối đa 10 MB).'
      : err.message === 'type' ? 'Chỉ nhận ảnh PNG, JPG, WebP hoặc GIF.'
      : 'Không đọc được ảnh này.';
  }
  renderProfileAvatar();
});
$('avatarRemove').addEventListener('click', () => { Profile.removePhoto(); renderProfileAvatar(); });
$('soundToggle').addEventListener('change', e => Profile.setPref('sound', e.target.checked));

Profile.onChange(() => {
  renderHeader();
  renderPlayers();
  renderRatedNote();
  if (entered && needsPlacement()) openPlacement(); // server báo chưa chọn trình độ
});

// ---------------- Nút bấm ----------------

for (const tab of document.querySelectorAll('.tab[data-mode]')) tab.addEventListener('click', () => setMode(tab.dataset.mode));
$('lbTab').addEventListener('click', openLeaderboard);
$('contestTab').addEventListener('click', openContests);
$('lbRefresh').addEventListener('click', openLeaderboard);
$('newGame').addEventListener('click', newGame);
$('hint').addEventListener('click', showHint);
$('onlineHint').addEventListener('click', showHint);
$('adminTab').addEventListener('click', openAdmin);
$('adminRefresh').addEventListener('click', openAdmin);
$('adminSearch').addEventListener('input', renderAdminList);
$('undo').addEventListener('click', undo);
$('playResign').addEventListener('click', resignPlay);
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
$('mode').addEventListener('change', changeSetup);
$('level').addEventListener('change', changeSetup);
$('rankBtn').addEventListener('click', openRank);
$('profileBtn').addEventListener('click', openProfile);
$('promo').addEventListener('click', e => {
  if (e.target === $('promo')) $('promo').hidden = true;
});

// Mở bằng link mời (?room=MÃ) thì vào thẳng phòng online
const room = new URLSearchParams(location.search).get('room');
renderHeader();
newGame();

// ---------------- Đăng nhập / đăng ký ----------------

const AUTH_ERRORS = {
  NAME: 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ không dấu, số và dấu _',
  WEAK: 'Mật khẩu cần ít nhất 6 ký tự',
  MISMATCH: 'Hai mật khẩu không khớp',
  EXISTS: 'Tên đăng nhập này đã có người dùng',
  RESERVED: 'Tên bắt đầu bằng "admin" chỉ dành cho chủ web, hãy chọn tên khác',
  BAD_LOGIN: 'Sai tên đăng nhập hoặc mật khẩu',
  TOO_MANY: 'Thử quá nhiều lần, hãy đợi một lúc rồi thử lại',
  NETWORK: 'Không kết nối được máy chủ. Kiểm tra mạng Internet.',
  NOT_ALLOWED: 'Máy chủ chưa bật đăng nhập Email/Password (xem README).',
  DENIED: 'Máy chủ từ chối truy cập, kiểm tra lại luật Firebase (xem README).',
};
let authMode = 'login';
let entered = false;

function setAuthMode(m) {
  authMode = m;
  $('authTabLogin').classList.toggle('on', m === 'login');
  $('authTabRegister').classList.toggle('on', m === 'register');
  $('authPass2Wrap').hidden = m !== 'register';
  $('authPass2').required = m === 'register';
  $('authPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
  $('authSubmit').textContent = m === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
  $('authMsg').textContent = '';
}

function enterApp() {
  if (entered) return;
  entered = true;
  $('authModal').hidden = true;
  renderHeader();
  renderPlayers();
  // Mở bằng link mời (?room=MÃ) thì vào thẳng phòng online (sau khi chọn trình độ)
  const go = () => {
    if (room) {
      setMode('online');
      Online.join(room);
    }
  };
  if (needsPlacement()) { afterPlace = go; openPlacement(); }
  else go();
  refreshAuto(); // contest đã đăng ký: hiện thông báo và tự ghép cặp khi tới giờ
}

// ---------------- Chọn trình độ lần đầu ----------------

let afterPlace = null;

function needsPlacement() { return Profile.signedIn() && !Profile.me().placed; }

function openPlacement() {
  const box = $('placeChoices');
  if (!box.children.length) {
    for (const lv of Profile.LEVELS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'place-opt';
      btn.innerHTML = '<span class="po-main"><b></b><small></small></span><span class="po-elo"></span>';
      btn.querySelector('b').textContent = lv.name;
      btn.querySelector('small').textContent = lv.desc;
      btn.querySelector('.po-elo').textContent = lv.elo + ' Elo';
      btn.addEventListener('click', () => {
        Profile.place(lv.elo);
        $('placeModal').hidden = true;
        renderHeader();
        renderPlayers();
        const f = afterPlace;
        afterPlace = null;
        if (f) f();
      });
      box.appendChild(btn);
    }
  }
  $('placeModal').hidden = false;
}

$('authNote').textContent = Profile.remote
  ? ''
  : 'Chế độ cục bộ: tài khoản và bảng xếp hạng chỉ có trên trình duyệt này (bật bản toàn thế giới: xem README).';
$('authTabLogin').addEventListener('click', () => setAuthMode('login'));
$('authTabRegister').addEventListener('click', () => setAuthMode('register'));
$('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const user = $('authUser').value, pass = $('authPass').value;
  const msg = $('authMsg');
  msg.textContent = '';
  if (authMode === 'register' && pass !== $('authPass2').value) { msg.textContent = AUTH_ERRORS.MISMATCH; return; }
  $('authSubmit').disabled = true;
  try {
    if (authMode === 'login') await Profile.login(user, pass);
    else await Profile.register(user, pass);
    $('authPass').value = $('authPass2').value = '';
    enterApp();
  } catch (err) {
    msg.textContent = AUTH_ERRORS[err.message] || 'Có lỗi xảy ra, thử lại sau.';
  }
  $('authSubmit').disabled = false;
});

Profile.restore().then(ok => {
  if (ok) enterApp();
  else $('authUser').focus();
});

// ---------------- Bảng xếp hạng ----------------

async function openLeaderboard() {
  openModal('lbModal');
  $('lbNote').textContent = Profile.remote
    ? 'Toàn thế giới · xếp theo exp rank (chỉ ván Online) · cột Elo tính cả ván đấu máy'
    : 'Chỉ gồm tài khoản trên máy này · bảng toàn thế giới: xem README';
  const list = $('lbList');
  list.innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const [rows, medals] = await Promise.all([Profile.leaderboard(), Contest.medals().catch(() => ({}))]);
    list.innerHTML = '';
    rows.forEach((p, i) => {
      const r = Profile.rankOf(p.exp);
      const row = document.createElement('div');
      row.className = 'rank-row' + (p.me ? ' me' : '');
      row.innerHTML = `<span class="rank-no">${i < 3 ? `<span class="podium p${i + 1}">${i + 1}</span>` : i + 1}</span>
        <span class="rank-name"><span class="avatar sm"></span><span class="nm"></span></span>
        <span class="rank-tier"></span>
        <span class="rank-elo">${p.exp}</span>
        <span class="rank-elo2">${p.elo}</span>
        <span class="wdl"><i class="w">${p.wins}</i> / ${p.draws} / <i class="l">${p.losses}</i></span>`;
      row.querySelector('.nm').textContent = p.name + (p.me ? ' (bạn)' : '');
      const won = Contest.count(medals[p.uid]);
      if (won.some(Boolean)) {
        const ms = document.createElement('span');
        ms.className = 'medals';
        won.forEach((n, k) => { if (n) ms.appendChild(medalEl(k + 1, n)); });
        row.querySelector('.rank-name').appendChild(ms);
      }
      const tier = row.querySelector('.rank-tier');
      tier.textContent = r.text;
      tier.style.color = r.color;
      setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.me ? Profile.me().photo : '', me: true }, 'w');
      list.appendChild(row);
    });
    if (!rows.length) list.innerHTML = '<p class="empty">Chưa có ai trên bảng. Chơi một ván Online để có tên ở đây!</p>';
  } catch (err) {
    list.innerHTML = '<p class="empty">Không tải được bảng xếp hạng. Kiểm tra mạng và cấu hình Firebase.</p>';
  }
}

// ---------------- Bảng quản trị (chỉ tài khoản ADMIN) ----------------

let adminRows = [];

async function openAdmin() {
  if (!Profile.isOwner()) return;
  openModal('adminModal');
  $('adminSearch').value = '';
  $('adminMsg').className = 'admin-msg';
  $('adminMsg').textContent = '';
  $('adminCount').textContent = '';
  $('adminNote').textContent = Profile.remote
    ? ''
    : 'Chế độ cục bộ: chỉ thấy tài khoản tạo trên trình duyệt này, người chơi ở máy khác sẽ không hiện ở đây (bật Firebase: xem README).';
  $('adminList').innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const { rows, adminsDenied } = await Profile.listPlayers();
    adminRows = rows;
    renderAdminList();
    if (adminsDenied) {
      $('adminMsg').className = 'admin-msg err';
      $('adminMsg').textContent = 'Chưa đọc được danh sách admin: hãy dán luật Firebase mới (có mục "admins") rồi bấm Publish. Tới lúc đó nút cấp / thu hồi chưa hoạt động.';
    }
  } catch (err) {
    const why = err.message === 'NETWORK' ? 'Kiểm tra mạng Internet.'
      : err.message === 'DENIED' ? 'Máy chủ từ chối đọc, kiểm tra luật Firebase.'
      : err.message === 'SERVER' ? 'Kiểm tra lại databaseURL trong config.js.'
      : 'Kiểm tra mạng và cấu hình Firebase (xem README).';
    $('adminList').innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'empty';
    msg.textContent = `Không tải được danh sách (mã lỗi: ${err.message}). ${why}`;
    $('adminList').appendChild(msg);
  }
}

function renderAdminList() {
  const q = $('adminSearch').value.trim().toLowerCase();
  const rows = adminRows
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((x, y) => (y.owner - x.owner) || (y.admin - x.admin) || x.name.localeCompare(y.name));
  $('adminCount').textContent = `${adminRows.length} người chơi · ${adminRows.filter(p => p.owner || p.admin).length} admin`;
  const list = $('adminList');
  list.innerHTML = '';
  for (const p of rows) {
    const row = document.createElement('div');
    row.className = 'admin-row' + (p.me ? ' me' : '');
    row.innerHTML = '<span class="avatar sm"></span><span class="admin-name"><b></b><small></small></span><span class="role-badge" hidden></span>';
    row.querySelector('b').textContent = p.name + (p.me ? ' (bạn)' : '');
    row.querySelector('small').textContent = `${Profile.rankOf(p.exp).text} · ${p.elo} Elo`;
    setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.me ? Profile.me().photo : '', me: true }, 'w');
    const badge = row.querySelector('.role-badge');
    badge.textContent = p.owner ? 'Chủ web' : 'Admin';
    badge.hidden = !(p.owner || p.admin);
    if (!p.owner) { // tài khoản ADMIN luôn là admin, không cần (và không thể) thu hồi
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = p.admin ? '' : 'primary';
      btn.textContent = p.admin ? 'Thu hồi' : 'Cấp admin';
      btn.addEventListener('click', () => toggleAdmin(p, btn));
      row.appendChild(btn);
    }
    list.appendChild(row);
  }
  if (!rows.length) list.innerHTML = '<p class="empty">Không có người chơi nào khớp.</p>';
  else if (adminRows.length <= 1 && !q) list.insertAdjacentHTML('beforeend', '<p class="empty">Mới chỉ có tài khoản ADMIN. Người khác cần đăng ký và vào web ít nhất một lần thì mới hiện ở đây.</p>');
}

async function toggleAdmin(p, btn) {
  const on = !p.admin;
  if (!confirm(on ? `Cấp quyền admin cho ${p.name}?` : `Thu hồi quyền admin của ${p.name}?`)) return;
  const msg = $('adminMsg');
  btn.disabled = true;
  msg.className = 'admin-msg';
  msg.textContent = '';
  try {
    await Profile.setAdmin(p.uid, on);
    p.admin = on;
    msg.textContent = on ? `Đã cấp quyền admin cho ${p.name}.` : `Đã thu hồi quyền admin của ${p.name}.`;
  } catch (err) {
    msg.className = 'admin-msg err';
    msg.textContent = err.message === 'DENIED' ? 'Máy chủ từ chối: hãy dán luật Firebase mới (có mục "admins") và bấm Publish.'
      : err.message === 'NETWORK' ? AUTH_ERRORS.NETWORK
      : 'Có lỗi xảy ra, thử lại sau.';
  }
  renderAdminList();
}

// ---------------- Contest ----------------
// Chỉ admin tạo / xóa được contest (giao diện ẩn với người khác, luật Firebase chặn ở máy chủ).
// Người chơi đăng ký trước giờ bắt đầu; đến giờ web tự ghép cặp (xem "Contest: tự ghép cặp" bên dưới).

let contestView = null;        // contest đang xem chi tiết
let contestScores = null;      // bảng điểm của contest đang xem (null = chưa tải được)
let contestPhase = '';         // pha đang hiển thị, để biết khi nào cần vẽ lại
let contestTimer = null;

const CONTEST_ERRORS = {
  NAME: 'Tên contest cần 3–60 ký tự.',
  TIME: 'Thời gian không hợp lệ (contest dài tối đa 7 ngày).',
  PAST: 'Giờ bắt đầu phải ở tương lai để mọi người kịp đăng ký.',
  DENIED: 'Máy chủ từ chối: chỉ admin mới tạo / xóa được contest. Nếu bạn là admin, hãy dán lại firebase-rules.json mới rồi bấm Publish (xem README).',
  ENDED: 'Contest đã kết thúc.',
  CLOSED: 'Contest đã bắt đầu nên đã đóng đăng ký.',
  NETWORK: AUTH_ERRORS.NETWORK,
};
const contestError = err => CONTEST_ERRORS[err.message] || 'Có lỗi xảy ra, thử lại sau.';
const PHASE_TEXT = { live: 'Đang diễn ra', upcoming: 'Mở đăng ký', ended: 'Đã kết thúc' };

const p2 = n => String(n).padStart(2, '0');
function fmtDate(t) {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
}
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m % 1440 === 0) return `${m / 1440} ngày`;
  if (m >= 120 && m % 60 === 0) return `${m / 60} giờ`;
  return `${m} phút`;
}
function fmtSpan(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (d) return `${d} ngày ${h} giờ`;
  return h ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`;
}
function localInputValue(t) { // giá trị cho <input type="datetime-local"> theo giờ máy
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function setContestMsg(el, text, err) {
  el.className = 'admin-msg' + (err ? ' err' : '');
  el.textContent = text || '';
}

async function openContests() {
  openModal('contestModal');
  showContestList();
  $('contestNote').textContent = Profile.remote
    ? 'Đăng ký trước · đến giờ web tự ghép cặp · Thắng +2 · Hòa +1 · Thua 0 · Top 3 nhận huy chương'
    : 'Chế độ cục bộ: contest chỉ có trên trình duyệt này (bật bản toàn thế giới: xem README)';
  $('contestAdminBox').hidden = !Profile.isAdmin();
  $('contestPlain').textContent = Profile.isAdmin() ? '' : 'Chỉ admin mới tạo được contest.';
  Profile.refreshAdmin().then(() => {
    $('contestAdminBox').hidden = !Profile.isAdmin();
    $('contestPlain').textContent = Profile.isAdmin() ? '' : 'Chỉ admin mới tạo được contest.';
  });
  startContestClock();
  await loadContests();
}

function showContestList() {
  contestView = null;
  $('contestListView').hidden = false;
  $('contestDetailView').hidden = true;
}

async function loadContests() {
  const box = $('contestList');
  box.innerHTML = '<p class="empty">Đang tải…</p>';
  try {
    const rows = await Contest.list();
    for (const c of rows) contestById.set(c.id, c);
    const regs = await Promise.all(rows.map(c => Contest.phase(c) === 'ended' ? false : Contest.registered(c).catch(() => false)));
    renderContestList(rows, new Set(rows.filter((c, i) => regs[i]).map(c => c.id)));
  } catch (err) {
    box.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = `Không tải được danh sách contest (mã lỗi: ${err.message}). Kiểm tra mạng và luật Firebase (xem README).`;
    box.appendChild(p);
  }
}

function renderContestList(rows, mine) {
  const box = $('contestList');
  box.innerHTML = '';
  const groups = [
    ['live', rows.filter(c => Contest.phase(c) === 'live').sort((a, b) => a.end - b.end)],
    ['upcoming', rows.filter(c => Contest.phase(c) === 'upcoming').sort((a, b) => a.start - b.start)],
    ['ended', rows.filter(c => Contest.phase(c) === 'ended').sort((a, b) => b.end - a.end).slice(0, 15)],
  ];
  for (const [ph, items] of groups) {
    if (!items.length) continue;
    const h = document.createElement('div');
    h.className = 'contest-group';
    h.textContent = ph === 'upcoming' ? 'Sắp diễn ra' : PHASE_TEXT[ph];
    box.appendChild(h);
    for (const c of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'contest-item ' + ph;
      btn.innerHTML = '<span class="ci-main"><b></b><small></small></span><span class="ci-badge"></span>';
      btn.querySelector('b').textContent = c.name;
      btn.querySelector('small').textContent = `${fmtDate(c.start)} · ${fmtDuration(c.end - c.start)}` + (c.byName ? ` · tạo bởi ${c.byName}` : '');
      btn.querySelector('.ci-badge').textContent = mine.has(c.id) ? 'Đã đăng ký ✓' : PHASE_TEXT[ph];
      if (mine.has(c.id)) btn.classList.add('joined');
      btn.addEventListener('click', () => openContestDetail(c.id));
      box.appendChild(btn);
    }
  }
  if (!rows.length) box.innerHTML = '<p class="empty">Chưa có contest nào.' + (Profile.isAdmin() ? ' Hãy bấm "Tạo contest" ở trên.' : '') + '</p>';
}

// ----- Chi tiết một contest -----

async function openContestDetail(id) {
  const c = contestById.get(id);
  if (!c) return;
  contestView = c;
  contestScores = null;
  $('contestListView').hidden = true;
  $('contestDetailView').hidden = false;
  setContestMsg($('contestMsg'), '');
  $('cdName').textContent = c.name;
  $('cdDesc').textContent = c.desc;
  $('cdTime').textContent = `${fmtDate(c.start)} → ${fmtDate(c.end)} · ${fmtDuration(c.end - c.start)}`;
  contestPhase = '';
  updateContestClock();
  $('contestBoard').innerHTML = '<p class="empty">Đang tải…</p>';
  await loadContestScores();
}

async function loadContestScores() {
  const c = contestView;
  if (!c) return;
  let rows = null;
  try { rows = await Contest.scores(c.id); } catch {}
  if (contestView !== c) return; // người dùng đã chuyển sang màn khác
  contestScores = rows;
  renderContestBoard();
  renderContestActions();
}

function renderContestBoard() {
  const box = $('contestBoard');
  box.innerHTML = '';
  if (contestScores === null) { box.innerHTML = '<p class="empty">Không tải được bảng điểm. Kiểm tra mạng và luật Firebase.</p>'; return; }
  if (!contestScores.length) {
    box.innerHTML = `<p class="empty">${Contest.phase(contestView) === 'upcoming' ? 'Chưa có ai đăng ký. Hãy là người đầu tiên!' : 'Không có ai đăng ký contest này.'}</p>`;
    return;
  }
  const final = Contest.isFinal(contestView);
  for (const p of contestScores) {
    const row = document.createElement('div');
    row.className = 'contest-row' + (p.me ? ' me' : '');
    row.innerHTML = `<span class="rank-no"></span>
      <span class="rank-name"><span class="avatar sm"></span><span class="nm"></span></span>
      <span class="pts">${p.pts}</span>
      <span>${p.games}</span>
      <span class="wdl"><i class="w">${p.wins}</i> / ${p.draws} / <i class="l">${p.losses}</i></span>`;
    const no = row.querySelector('.rank-no');
    if (p.medal) no.appendChild(medalEl(p.medal)); else no.textContent = p.place;
    row.querySelector('.nm').textContent = p.name + (p.me ? ' (bạn)' : '');
    setAvatar(row.querySelector('.avatar'), { name: p.name, photo: p.me ? Profile.me().photo : '', me: true }, 'w');
    box.appendChild(row);
  }
  if (final) {
    const me = contestScores.find(r => r.me);
    if (me) {
      const note = document.createElement('p');
      note.className = 'empty';
      note.textContent = me.medal ? `Chúc mừng! Bạn giành huy chương ${MEDAL_NAME[me.medal]} (hạng ${me.place}) – xem trong Hồ sơ.`
        : `Bạn xếp hạng ${me.place}/${contestScores.length}.`;
      box.prepend(note);
    }
  }
}

function renderContestActions() {
  const c = contestView;
  const box = $('contestActions');
  box.innerHTML = '';
  if (!c) return;
  const ph = Contest.phase(c);
  const joined = !!(contestScores && contestScores.some(r => r.me));
  const add = (text, cls, fn, disabled) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.disabled = !!disabled;
    b.addEventListener('click', () => fn(b));
    box.appendChild(b);
    return b;
  };
  const note = text => box.insertAdjacentHTML('beforeend', `<p class="muted center">${text}</p>`);
  if (ph === 'upcoming') {
    if (joined) {
      add('Đã đăng ký ✓', 'big', () => {}, true);
      add('Hủy đăng ký', 'ghost', contestUnregister);
      note('Đến giờ bắt đầu, web sẽ tự ghép cặp bạn với những người đã đăng ký. Chỉ cần mở web lúc đó.');
    } else {
      add('Đăng ký tham gia', 'primary big', contestRegister);
      note('Đăng ký đóng khi contest bắt đầu.');
    }
  } else if (ph === 'live') {
    if (joined) {
      const busy = Auto.running === c.id && !Auto.paused.has(c.id) && mode === 'online' && !Online.idle();
      if (busy) add(Online.searching() ? 'Đang tự ghép cặp…' : 'Đang thi đấu', 'big', () => {}, true);
      else add(Auto.paused.has(c.id) ? 'Tiếp tục thi đấu' : 'Vào thi đấu ngay', 'primary big', contestPlay);
      note('Web tự ghép cặp bạn với người đã đăng ký đang mở web; xong ván sẽ tự tìm ván tiếp.');
    } else {
      add('Đăng ký đã đóng', 'big', () => {}, true);
      note('Contest đã bắt đầu, chỉ người đăng ký trước mới được thi đấu.');
    }
  }
  if (Profile.isAdmin()) add('Xóa contest', 'ghost', contestDelete);
}

// Đồng hồ: đếm ngược tới giờ bắt đầu / kết thúc, tự làm mới bảng điểm, tự đổi nút khi đổi pha
function updateContestClock() {
  const c = contestView;
  if (!c) return;
  const ph = Contest.phase(c), now = Date.now();
  $('cdClock').textContent = ph === 'live' ? `Còn ${fmtSpan(c.end - now)}`
    : ph === 'upcoming' ? `Bắt đầu sau ${fmtSpan(c.start - now)}`
    : Contest.isFinal(c) ? 'Đã kết thúc · kết quả chung cuộc' : 'Đã kết thúc · đang chờ các ván cuối';
  const key = ph + Contest.isFinal(c);
  if (key !== contestPhase) {
    contestPhase = key;
    renderContestActions();
    if (contestScores) renderContestBoard();
  }
}

function startContestClock() {
  clearInterval(contestTimer);
  let n = 0;
  contestTimer = setInterval(() => {
    if ($('contestModal').hidden) { clearInterval(contestTimer); return; }
    if (!contestView) return;
    updateContestClock();
    if (++n % 15 === 0 && Contest.phase(contestView) !== 'upcoming') loadContestScores();
  }, 1000);
}

async function contestRegister(btn) {
  const c = contestView;
  btn.disabled = true;
  setContestMsg($('contestMsg'), '');
  try {
    await Contest.join(c);
    setContestMsg($('contestMsg'), `Đã đăng ký! Contest bắt đầu lúc ${fmtDate(c.start)}, web sẽ tự ghép cặp cho bạn.`);
    if (!Auto.mine.some(x => x.id === c.id)) Auto.mine.push(c);
    await loadContestScores();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

async function contestUnregister(btn) {
  const c = contestView;
  if (!confirm(`Hủy đăng ký contest "${c.name}"?`)) return;
  btn.disabled = true;
  try {
    await Contest.unjoin(c);
    Auto.mine = Auto.mine.filter(x => x.id !== c.id);
    setContestMsg($('contestMsg'), 'Đã hủy đăng ký.');
    await loadContestScores();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

// Vào thi đấu ngay (hoặc tiếp tục sau khi đã tạm dừng tự ghép)
function contestPlay() {
  const c = contestView;
  if (mode === 'online' && !Online.idle() && Online.contest() !== c.id) {
    setContestMsg($('contestMsg'), 'Bạn đang trong phòng hoặc ván Online khác. Hãy rời phòng trước.', true);
    return;
  }
  if (!Auto.mine.some(x => x.id === c.id)) Auto.mine.push(c);
  Auto.paused.delete(c.id);
  Auto.retryAt = 0;
  $('contestModal').hidden = true;
  autoStart(c, true);
}

async function contestDelete(btn) {
  const c = contestView;
  if (!confirm(`Xóa contest "${c.name}" cùng toàn bộ bảng điểm?`)) return;
  btn.disabled = true;
  try {
    await Contest.remove(c.id);
    contestById.delete(c.id);
    Auto.mine = Auto.mine.filter(x => x.id !== c.id);
    showContestList();
    setContestMsg($('contestAdminMsg'), `Đã xóa contest "${c.name}".`);
    await loadContests();
  } catch (err) {
    setContestMsg($('contestMsg'), contestError(err), true);
    btn.disabled = false;
  }
}

// ----- Tạo contest (chỉ admin) -----

$('contestNewBtn').addEventListener('click', () => {
  if (!Profile.isAdmin()) return;
  const t = new Date(Date.now() + 3600000);
  t.setMinutes(0, 0, 0); // mặc định: đầu giờ kế tiếp, cho mọi người thời gian đăng ký
  $('cStart').value = localInputValue(t.getTime() + 3600000);
  setContestMsg($('contestAdminMsg'), '');
  $('contestForm').hidden = false;
  $('cName').focus();
});
$('cCancel').addEventListener('click', () => { $('contestForm').hidden = true; });
$('contestForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('contestAdminMsg');
  if (!Profile.isAdmin()) { setContestMsg(msg, CONTEST_ERRORS.DENIED, true); return; }
  const start = new Date($('cStart').value).getTime();
  const end = start + Number($('cDur').value) * 60000;
  $('cSubmit').disabled = true;
  try {
    await Contest.create({ name: $('cName').value, desc: $('cDesc').value, start, end });
    $('contestForm').hidden = true;
    $('contestForm').reset();
    setContestMsg(msg, 'Đã tạo contest! Người chơi có thể đăng ký tới giờ bắt đầu.');
    await loadContests();
  } catch (err) {
    setContestMsg(msg, contestError(err), true);
  }
  $('cSubmit').disabled = false;
});

$('contestBack').addEventListener('click', () => { showContestList(); loadContests(); });
$('contestRefresh').addEventListener('click', () => { if (contestView) loadContestScores(); else loadContests(); });

// ---------------- Contest: tự ghép cặp ----------------
// Không có máy chủ riêng nên việc ghép chạy trên trình duyệt của từng người đã đăng ký:
// đến giờ contest, web tự chuyển sang Online và vào phòng chờ riêng của contest đó (xem online.js),
// ván xong thì sau AUTO_NEXT tự tìm ván tiếp. Không cắt ngang ván đang chơi với máy / bài học đang dở:
// đợi xong mới ghép. Hủy tìm trận, rời phòng hoặc rời tab Online thì tạm dừng tự ghép (bấm Tiếp tục để chơi lại).

const MEDAL_SEEN_KEY = 'rg-medal-seen';

async function refreshAuto() {
  if (!Profile.signedIn()) return;
  try {
    const rows = await Contest.list();
    for (const c of rows) contestById.set(c.id, c);
    const open = rows.filter(c => Contest.phase(c) !== 'ended');
    const regs = await Promise.all(open.map(c => Contest.registered(c, true).catch(() => Auto.mine.some(x => x.id === c.id))));
    Auto.mine = open.filter((c, i) => regs[i]);
    if (rows.some(c => Contest.isFinal(c) && Date.now() - c.end < 3 * 86400000)) checkNewMedals();
  } catch {}
  autoTick();
}

// Báo khi vừa giành huy chương (mỗi huy chương báo một lần)
async function checkNewMedals() {
  let list;
  try { list = (await Contest.medals())[Profile.uid()] || []; } catch { return; }
  const key = MEDAL_SEEN_KEY + ':' + Profile.uid();
  let seen;
  try { seen = new Set(JSON.parse(localStorage.getItem(key)) || []); } catch { seen = new Set(); }
  const fresh = list.filter(m => !seen.has(m.id) && Date.now() - m.end < 3 * 86400000);
  for (const m of list) seen.add(m.id);
  try { localStorage.setItem(key, JSON.stringify([...seen])); } catch {}
  if (fresh.length) {
    const m = fresh[0];
    toast(`Chúc mừng! Bạn giành huy chương ${MEDAL_NAME[m.place]} ở contest "${m.name}"`, m.place);
  }
}

function toast(text, medal) {
  const el = $('toast');
  el.innerHTML = '';
  if (medal) el.appendChild(medalEl(medal));
  el.appendChild(document.createTextNode(text));
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 7000);
}

// Đang làm dở việc khác (ván với máy, ván 2 người, bài học) thì chưa tự chuyển sang contest
function autoCanStart() {
  if (!$('promo').hidden || !$('placeModal').hidden || !$('authModal').hidden) return false;
  if (mode === 'online') return Online.idle();
  if (mode === 'learn') return !Learn.inLesson();
  return !game.history.length || game.isGameOver() || !!playResult;
}

function autoStart(c, manual = false) {
  Auto.running = c.id;
  Auto.doneAt = 0;
  if (mode === 'online' && !Online.idle()) {
    quietResult = true;
    Online.leave(); // chỉ gọi khi ván trước đã xong nên không bị tính thua
    quietResult = false;
  }
  if (mode !== 'online') {
    setMode('online');
    if (mode !== 'online') { if (!manual) Auto.paused.add(c.id); return; } // người chơi không muốn bỏ ván đang dở
    Auto.paused.delete(c.id);
  }
  $('resultModal').hidden = true;
  Online.findMatch({ id: c.id, end: c.end });
  autoBanner();
}

// Bấm "Ván contest tiếp theo" trong hộp kết quả
function autoNow() {
  const c = contestById.get(Online.contest());
  if (c && Contest.phase(c) === 'live') { Auto.paused.delete(c.id); autoStart(c, true); }
}

function liveAuto(now = Date.now()) {
  const live = Auto.mine.filter(c => Contest.phase(c, now) === 'live').sort((a, b) => a.end - b.end);
  return live.find(c => !Auto.paused.has(c.id)) || live[0] || null;
}

function autoTick() {
  autoBanner();
  if (!entered) return;
  const now = Date.now();
  const c = liveAuto(now);
  if (!c || Auto.paused.has(c.id)) return;
  if (mode === 'online' && Online.contest() === c.id) {
    // Ván contest đã xong (hoặc đối thủ bỏ đi): đợi một chút rồi tự tìm ván tiếp
    if (!Online.outcome() && Online.connected()) return;
    if (!Auto.doneAt) Auto.doneAt = now;
    if (now - Auto.doneAt >= AUTO_NEXT) autoStart(c);
    return;
  }
  if (mode === 'online' && Online.searchContest() === c.id) return;
  if (now < Auto.retryAt || !autoCanStart()) return;
  autoStart(c);
}

Online.onFail((code, ct) => {
  if (!ct) return;
  if (code === 'self') Auto.paused.add(ct);
  else if (code !== 'ended') Auto.retryAt = Date.now() + 15000; // lỗi mạng: thử lại sau 15 giây
});
// Người chơi tự hủy tìm / rời phòng: tạm dừng tự ghép contest đó
for (const id of ['cancelSearch', 'leaveRoom']) {
  $(id).addEventListener('click', () => { if (Auto.running && Online.idle()) Auto.paused.add(Auto.running); autoBanner(); });
}

// Thanh thông báo contest dưới thanh trên cùng
function autoBanner() {
  const el = $('contestBanner');
  const now = Date.now();
  const c = liveAuto(now);
  const soon = Auto.mine.filter(x => Contest.phase(x, now) === 'upcoming' && x.start - now < 86400000).sort((a, b) => a.start - b.start)[0];
  if (!entered || (!c && !soon)) { el.hidden = true; return; }
  el.hidden = false;
  let text, action = null, cls = 'live';
  if (c) {
    const left = `còn ${fmtSpan(c.end - now)}`;
    if (Auto.paused.has(c.id)) {
      text = `${c.name} đang diễn ra (${left}) · bạn đã tạm dừng tự ghép cặp`;
      action = ['Tiếp tục thi đấu', 'resume'];
      cls = 'paused';
    } else if (mode === 'online' && Online.contest() === c.id && (Online.outcome() || !Online.connected())) {
      text = `${c.name} · ván tiếp theo sau ${Math.max(0, Math.ceil((AUTO_NEXT - (now - (Auto.doneAt || now))) / 1000))} giây`;
      action = ['Tạm dừng', 'pause'];
    } else if (mode === 'online' && Online.contest() === c.id) {
      text = `${c.name} · đang thi đấu (${left})`;
    } else if (mode === 'online' && Online.searchContest() === c.id) {
      text = `${c.name} · đang tự ghép cặp với người đã đăng ký… (${left})`;
      action = ['Tạm dừng', 'pause'];
    } else {
      text = `${c.name} đang diễn ra (${left}) · web sẽ tự ghép cặp khi bạn xong việc đang làm`;
      action = ['Vào thi đấu ngay', 'resume'];
    }
  } else {
    text = `${soon.name} bắt đầu sau ${fmtSpan(soon.start - now)} · bạn đã đăng ký, đến giờ web sẽ tự ghép cặp`;
    cls = 'soon';
  }
  el.className = 'contest-banner ' + cls;
  $('cbText').textContent = text;
  const btn = $('cbAction');
  btn.hidden = !action;
  if (action) { btn.textContent = action[0]; btn.dataset.act = action[1]; }
  el.dataset.id = (c || soon).id;
}

$('cbAction').addEventListener('click', () => {
  const c = contestById.get($('contestBanner').dataset.id);
  if (!c) return;
  if ($('cbAction').dataset.act === 'pause') {
    Auto.paused.add(c.id);
    if (mode === 'online' && Online.searchContest() === c.id) Online.leave();
  } else {
    Auto.paused.delete(c.id);
    Auto.retryAt = 0;
    if (mode === 'online' && !Online.idle() && Online.contest() !== c.id) {
      toast('Bạn đang trong phòng Online khác, hãy rời phòng trước.');
    } else autoStart(c, true);
  }
  autoBanner();
});
$('cbOpen').addEventListener('click', async () => {
  const id = $('contestBanner').dataset.id;
  await openContests();
  if (contestById.has(id)) openContestDetail(id);
});

setInterval(autoTick, 1000);
setInterval(refreshAuto, 60000);
