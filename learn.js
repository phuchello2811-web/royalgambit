// Chế độ Học cờ kiểu Duolingo: lộ trình các Phần → Bài, mỗi bài gồm vài thử thách (xem lessons.js).
// • Mỗi bài có 3 tim, sai mất 1 tim; hết tim thì làm lại bài. Không sai, không gợi ý = 3 sao.
// • XP, chuỗi ngày học, mục tiêu hằng ngày; "Nhảy cóc" = làm bài kiểm tra để mở khoá một phần.
// • Tiến độ lưu trong localStorage theo từng tài khoản.
// Dùng chung bàn cờ `game`, `hint`, `flipped`, `marks` và hàm `render` của app.js.

const Learn = (() => {
  const $ = id => document.getElementById(id);
  const HEARTS = 3;
  const DAILY_GOAL = 30;
  const XP_NEW = 10, XP_PERFECT = 5, XP_REPLAY = 5, XP_TEST = 20;
  const OFFSETS = [0, 44, 70, 44, 0, -44, -70, -44]; // đường đi zig-zag như Duolingo
  const PRAISE = ['Tuyệt vời!', 'Chính xác!', 'Xuất sắc!', 'Giỏi lắm!', 'Hay quá!'];
  const BOARD_STEPS = new Set(['stars', 'capture', 'line', 'goal', 'mate', 'win', 'run']);

  // Danh sách phẳng các bài để tính mở khoá theo thứ tự
  const FLAT = [];
  COURSE.forEach((unit, u) => unit.lessons.forEach((lesson, k) => FLAT.push({ u, k, lesson, id: `${u}-${k}`, idx: FLAT.length })));
  const unitStart = COURSE.map((_, u) => FLAT.findIndex(x => x.u === u));

  let view = 'home'; // 'home' | 'lesson'
  let store = load();
  let run = null;    // bài đang học: { entry, steps, si, hearts, mistakes, hints, correct, started, test }
  let st = null;     // thử thách đang làm
  let token = 0;     // hủy các setTimeout của thử thách cũ

  // ---------- Tiến độ ----------

  function storeKey() { return 'rg-learn2:' + (Profile.signedIn() ? Profile.me().name.toLowerCase() : 'guest'); }
  function load() {
    const base = { done: {}, xp: 0, streak: 0, last: '', day: '', dayXp: 0, jump: 0, hist: {} };
    try { return { ...base, ...JSON.parse(localStorage.getItem(storeKey())) }; } catch { return base; }
  }
  function save() { try { localStorage.setItem(storeKey(), JSON.stringify(store)); } catch {} }
  const pad = n => String(n).padStart(2, '0');
  const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const today = () => dayOf(Date.now());
  const yesterday = () => dayOf(Date.now() - 86400000);

  function addXp(n) {
    const t = today();
    if (store.day !== t) { store.day = t; store.dayXp = 0; }
    store.dayXp += n;
    store.xp += n;
    store.hist = store.hist || {};
    store.hist[t] = (store.hist[t] || 0) + n;
    for (const d of Object.keys(store.hist)) if (Date.now() - new Date(d).getTime() > 40 * 86400000) delete store.hist[d];
    if (store.last !== t) {
      store.streak = store.last === yesterday() ? store.streak + 1 : 1;
      store.last = t;
    }
    save();
  }
  const streakNow = () => (store.last === today() || store.last === yesterday() ? store.streak : 0);
  const dayXp = () => (store.day === today() ? store.dayXp : 0);

  const isDone = i => !!store.done[FLAT[i].id];
  const unlocked = i => i === 0 || i <= store.jump || isDone(i) || isDone(i - 1);
  function currentIdx() {
    for (let i = store.jump; i < FLAT.length; i++) if (!isDone(i)) return i;
    for (let i = 0; i < FLAT.length; i++) if (!isDone(i)) return i;
    return -1;
  }
  const doneCount = () => FLAT.filter((x, i) => isDone(i)).length;

  // ---------- Chuẩn bị bài ----------

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Thử thách ôn tập: bỏ các ván đấu máy (dài) cho bài ôn gọn
  function pool(units, before = Infinity) {
    return FLAT.filter(x => units.includes(x.u) && !x.lesson.review && x.idx < before)
      .flatMap(x => x.lesson.steps).filter(s => s.t !== 'win' && s.t !== 'run');
  }

  function stepsFor(entry) {
    const l = entry.lesson;
    if (!l.review) return l.steps.slice();
    const units = l.from === 'all' ? COURSE.map((_, i) => i) : l.from || [entry.u];
    const list = shuffle(pool(units, l.from ? Infinity : entry.idx));
    // Ưu tiên trộn đều các loại thử thách
    list.sort((a, b) => (a.t === 'quiz') - (b.t === 'quiz'));
    return shuffle(list.slice(0, l.count));
  }

  function start(entry, test = null) {
    token++;
    closePopover();
    $('learnDone').hidden = true;
    const steps = test ? test.steps : stepsFor(entry);
    run = { entry, steps, si: 0, hearts: HEARTS, mistakes: 0, hints: 0, correct: 0, started: Date.now(), test };
    view = 'lesson';
    document.body.dataset.learn = 'lesson';
    window.scrollTo({ top: 0 });
    openStep();
  }

  // Nhảy cóc tới phần u: kiểm tra kiến thức các phần đang bị khoá phía trước
  function startTest(u) {
    const cur = currentIdx();
    const from = cur < 0 ? 0 : FLAT[cur].u;
    const units = [];
    for (let i = from; i < u; i++) units.push(i);
    const steps = shuffle(pool(units)).slice(0, 6);
    if (!steps.length) return;
    const entry = { u, k: -1, idx: unitStart[u], id: 'test-' + u, lesson: { title: `Nhảy cóc tới Phần ${u + 1}`, steps } };
    start(entry, { unit: u, steps });
  }

  // Luyện tập nhanh: thử thách ngẫu nhiên từ các bài đã học xong
  function practicePool() {
    return FLAT.filter((x, i) => isDone(i) && !x.lesson.review)
      .flatMap(x => x.lesson.steps).filter(s => s.t !== 'win' && s.t !== 'run');
  }
  function startPractice() {
    const steps = shuffle(practicePool()).slice(0, 5);
    if (!steps.length) return;
    const entry = { u: 0, k: -1, idx: -1, id: 'practice', lesson: { title: 'Luyện tập nhanh', steps } };
    start(entry, { practice: true, steps });
  }

  // ---------- Một thử thách ----------

  const parse = u => ({ from: sqIndex(u.slice(0, 2)), to: sqIndex(u.slice(2, 4)), promotion: u[4] ? u[4].toUpperCase() : undefined });
  const same = (m, w) => m.from === w.from && m.to === w.to && (!w.promotion || m.promotion === w.promotion);

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

  // Điều kiện các bài một nước; gọi sau khi đã đi nước đó
  const GOALS = {
    castle: (m, s) => (m.flag === 'castleK' || m.flag === 'castleQ') && (!s.castle || m.flag === 'castle' + s.castle),
    promote: m => !!m.promotion,
    check: () => game.inCheck(),
    dcheck: () => game.inCheck() && attackers(game) >= 2,
    mate: () => game.status() === 'checkmate',
  };
  const GOAL_TEXT = {
    castle: 'Đó chưa phải nhập thành. Bấm vào Vua rồi chọn ô cách 2 ô về phía Xe.',
    promote: 'Hãy đưa Tốt tới hàng cuối.',
    check: 'Nước này chưa chiếu Vua Đen.',
    dcheck: 'Chưa phải chiếu đôi – cần cả hai quân cùng chiếu.',
    mate: 'Chưa chiếu hết – Vua Đen vẫn thoát được.',
  };

  const targetsLeft = () => game.board.filter(p => p && p[0] !== st.side && p[1] !== 'K').length;

  function openStep() {
    token++;
    const s = run.steps[run.si];
    st = {
      s, side: s.side || 'w', stars: new Set(), ok: new Set(), bad: new Set(),
      focus: new Set((s.marks || []).map(sqIndex)), ply: 0, busy: false, done: false,
      pick: -1, answered: false, tapIdx: 0, left: s.n || 1, moves: 0, removed: new Set(), feedback: null,
    };
    hint = null;
    marks.clear();
    clearSelection();
    game.load(s.fen);
    flipped = st.side === 'b';
    if (s.t === 'stars') st.stars = new Set(s.stars.map(sqIndex));
    renderPanel();
    render();
    if (s.t === 'line') autoLine();
  }

  const later = (fn, ms) => { const t = token; setTimeout(() => { if (t === token) fn(); }, ms); };

  // Máy tự đi các nước của bên kia trong chuỗi `line`
  function autoLine() {
    const s = st.s;
    if (st.ply >= s.line.length) return success();
    if (game.turn === st.side) return;
    st.busy = true;
    renderPanel();
    later(() => {
      game.move(parse(s.line[st.ply].split('|')[0]));
      st.ply++;
      st.busy = false;
      render();
      renderPanel();
      if (st.ply >= s.line.length) success();
      else autoLine();
    }, 600);
  }

  function onMove(m) {
    const s = st.s;
    if (!canMove()) return;
    game.move(m);
    if (s.t === 'stars' || s.t === 'capture') {
      game.turn = st.side; // chỉ bên người học đi, quân Đen đứng yên
      game.ep = -1;
      if (s.t === 'stars') st.stars.delete(m.to);
      const left = s.t === 'stars' ? st.stars.size : targetsLeft();
      if (!left) success();
      else coach(s.t === 'stars' ? `Tốt lắm! Còn ${left} ngôi sao.` : `Tốt lắm! Còn ${left} quân.`);
    } else if (s.t === 'line') {
      const alts = s.line[st.ply].split('|').map(parse);
      if (!alts.some(w => same(m, w))) wrongMove('Chưa đúng nước, thử lại nhé!');
      else { st.ply++; autoLine(); }
    } else if (s.t === 'goal') {
      if (GOALS[s.goal](m, s)) success(); else wrongMove(GOAL_TEXT[s.goal]);
    } else if (s.t === 'mate') {
      if (game.status() === 'checkmate') success();
      else if (st.left > 1 && LessonSolver.forced(game, st.left - 1)) { st.left--; coach('Đúng hướng rồi! Đen đáp lại…'); defend(); }
      else wrongMove(st.left > 1 ? 'Nước này để Đen thoát được. Tìm nước buộc Đen không còn đường chạy!' : 'Chưa chiếu hết – Vua Đen vẫn thoát được.');
    } else if (s.t === 'win' || s.t === 'run') {
      st.moves++;
      vsMachine(m);
    }
    render();
    renderPanel();
  }

  // Đen chống đỡ trong bài chiếu hết nhiều nước
  function defend() {
    st.busy = true;
    later(() => {
      const r = findBestMove(game, 2);
      game.move(r);
      st.busy = false;
      coach(`Giờ chiếu hết${st.left > 1 ? ` trong ${st.left} nước` : ''}!`);
      render();
      renderPanel();
    }, 650);
  }

  const pawnsLeft = () => game.board.some(p => p === st.side + 'P');

  function vsMachine(m) {
    const s = st.s;
    if (s.t === 'win' && game.status() === 'checkmate') return success();
    if (s.t === 'run' && m.promotion) {
      const lost = game.legalMoves().some(r => r.to === m.to);
      if (!lost) return success();
    }
    if (game.isGameOver()) return lose(game.status() === 'stalemate' ? 'Pat! Đen hết nước đi – ván hòa.' : 'Ván cờ hòa.');
    if (s.t === 'run' && !pawnsLeft()) return lose('Mất Tốt rồi!');
    if (st.moves >= s.limit) return lose(`Đã hết ${s.limit} nước.`);
    st.busy = true;
    coach(`Máy đang nghĩ… (nước ${st.moves}/${s.limit})`);
    later(() => {
      const r = findBestMove(game, 2);
      if (r) game.move(r);
      st.busy = false;
      if (game.isGameOver()) lose('Ván cờ hòa.');
      else if (s.t === 'run' && !pawnsLeft()) lose('Đen đã bắt được Tốt!');
      else coach(`Lượt bạn · còn ${s.limit - st.moves} nước`);
      render();
      renderPanel();
    }, 450);
  }

  // Thua ván với máy: mất tim rồi bày lại thế cờ
  function lose(text) {
    mistake();
    showFeedback(false, 'Chưa được rồi', text + (run.hearts > 0 ? ' Thử lại nhé!' : ''));
    st.busy = true;
    if (run.hearts > 0) later(() => openStep(), 1800);
  }

  // Nước sai: mất tim, lùi lại sau một chút
  function wrongMove(text) {
    mistake();
    showFeedback(false, 'Chưa đúng', text);
    st.busy = true;
    later(() => {
      game.undo();
      st.busy = false;
      st.feedback = null;
      render();
      renderPanel();
    }, 900);
  }

  function mistake() {
    run.mistakes++;
    run.hearts = Math.max(0, run.hearts - 1);
    Sound.play('bad');
    const h = document.querySelector('.ls-hearts');
    h.classList.remove('lost');
    void h.offsetWidth;
    h.classList.add('lost');
    if (run.hearts <= 0) later(outOfHearts, 1100);
  }

  function success(extra) {
    if (st.done) return;
    st.done = true;
    st.busy = false;
    run.correct++;
    hint = null;
    Sound.play('ok');
    showFeedback(true, PRAISE[Math.floor(Math.random() * PRAISE.length)], extra || st.s.explain || '');
    render();
    renderPanel();
  }

  function showFeedback(ok, title, text) {
    st.feedback = { ok, title, text };
    renderPanel();
  }

  function coach(text) { st.coach = text; }

  // ---------- Bấm ô / trắc nghiệm ----------

  function tap(i) {
    if (!st || st.done || st.busy) return;
    const sq = st.s.squares.map(sqIndex);
    const want = st.s.ordered ? [sq[st.tapIdx]] : sq.filter(x => !st.ok.has(x));
    if (st.ok.has(i)) return;
    if (want.includes(i)) {
      st.ok.add(i);
      st.tapIdx++;
      st.focus.delete(i);
      Sound.play('move');
      if (st.ok.size === sq.length) success();
    } else {
      st.bad.add(i);
      mistake();
      later(() => { st.bad.delete(i); render(); }, 600);
    }
    render();
    renderPanel();
  }

  function pickOption(k) {
    if (st.answered || st.removed.has(k)) return;
    st.pick = k;
    renderPanel();
  }

  function checkQuiz() {
    const s = st.s;
    if (st.pick < 0 || st.answered) return;
    st.answered = true;
    if (st.pick === s.answer) return success();
    st.done = true; // sang thử thách tiếp, câu này hỏi lại ở cuối bài
    run.steps.push(s);
    mistake();
    showFeedback(false, 'Chưa đúng', `Đáp án đúng: ${s.options[s.answer]}` + (s.explain ? ' · ' + s.explain : ''));
  }

  // ---------- Gợi ý ----------

  function findHint() {
    const s = st.s;
    if (s.t === 'stars' || s.t === 'capture') {
      const targets = s.t === 'stars' ? st.stars : new Set(game.board.map((p, i) => (p && p[0] !== st.side && p[1] !== 'K' ? i : -1)).filter(i => i >= 0));
      const path = LessonSolver.collect(game, targets);
      return path && path[0];
    }
    if (s.t === 'line') {
      const w = parse(s.line[st.ply].split('|')[0]);
      return game.legalMoves().find(m => same(m, w));
    }
    if (s.t === 'goal') {
      return game.legalMoves().find(m => { const x = game.move(m); const ok = GOALS[s.goal](x, s); game.undo(); return ok; });
    }
    if (s.t === 'mate') return LessonSolver.mateIn(game, st.left);
    if (s.t === 'win' || s.t === 'run') return findBestMove(game, 3);
    return null;
  }

  function showHint() {
    if (!st || st.done || st.busy) return;
    const s = st.s;
    run.hints++;
    if (s.t === 'quiz') {
      const wrong = s.options.map((_, k) => k).filter(k => k !== s.answer && !st.removed.has(k));
      if (wrong.length > 1) { st.removed.add(wrong[Math.floor(Math.random() * wrong.length)]); if (st.removed.has(st.pick)) st.pick = -1; }
    } else if (s.t === 'tap') {
      const sq = s.squares.map(sqIndex);
      const next = s.ordered ? sq[st.tapIdx] : sq.find(x => !st.ok.has(x));
      if (next != null) st.focus.add(next);
    } else if (canMove()) {
      const m = findHint();
      if (m) { hint = { from: m.from, to: m.to }; coach('Gợi ý: đi quân ở ô được tô xanh tới ô đánh dấu.'); }
    }
    render();
    renderPanel();
  }

  // ---------- Kết thúc bài ----------

  function next() {
    if (run.si + 1 < run.steps.length) { run.si++; openStep(); }
    else finish();
  }

  function finish() {
    token++;
    const entry = run.entry, secs = Math.round((Date.now() - run.started) / 1000);
    const slips = run.mistakes + run.hints;
    const stars = slips === 0 ? 3 : slips <= 2 ? 2 : 1;
    let xp;
    if (run.test && run.test.practice) {
      xp = XP_REPLAY;
    } else if (run.test) {
      xp = XP_TEST;
      store.jump = Math.max(store.jump, unitStart[run.test.unit]);
    } else {
      const prev = store.done[entry.id] || 0;
      xp = prev ? XP_REPLAY : XP_NEW + (stars === 3 ? XP_PERFECT : 0);
      store.done[entry.id] = Math.max(prev, stars);
    }
    addXp(xp);
    Sound.play('end');
    const total = run.correct + run.mistakes;
    showDone({
      title: run.test ? (run.test.practice ? 'Luyện tập xong!' : `Đã mở khoá Phần ${run.test.unit + 1}!`) : 'Hoàn thành bài học!',
      stars: run.test && !run.test.practice ? 0 : stars,
      xp, acc: total ? Math.round(100 * run.correct / total) : 100,
      time: `${Math.floor(secs / 60)}:${pad(secs % 60)}`,
      note: dayXp() >= DAILY_GOAL && dayXp() - xp < DAILY_GOAL ? `Đạt mục tiêu hằng ngày! Chuỗi ${streakNow()} ngày học liên tiếp` : `Chuỗi ${streakNow()} ngày · hôm nay ${dayXp()}/${DAILY_GOAL} XP`,
      ok: true,
    });
  }

  function outOfHearts() {
    token++;
    showDone({ title: 'Hết tim rồi!', note: 'Đừng lo – làm lại bài, bạn sẽ giỏi hơn sau mỗi lần thử.', ok: false });
  }

  function showDone(d) {
    const box = $('learnDone');
    box.classList.toggle('fail', !d.ok);
    $('ldTitle').textContent = d.title;
    $('ldStars').innerHTML = d.stars ? [1, 2, 3].map(i => `<span class="${i <= d.stars ? 'on' : ''}">★</span>`).join('') : '';
    $('ldCards').hidden = !d.ok;
    if (d.ok) {
      $('ldXp').textContent = '+' + d.xp;
      $('ldAcc').textContent = d.acc + '%';
      $('ldTime').textContent = d.time;
    }
    $('ldNote').textContent = d.note;
    $('ldNext').textContent = d.ok ? 'Tiếp tục' : 'Làm lại';
    $('ldNext').dataset.act = d.ok ? 'home' : 'retry';
    $('ldBack').hidden = d.ok;
    box.hidden = false;
  }

  $('ldNext').addEventListener('click', () => {
    $('learnDone').hidden = true;
    if ($('ldNext').dataset.act === 'retry' && run) {
      if (run.test) start(run.entry, run.test); else start(run.entry);
    } else home();
  });
  $('ldBack').addEventListener('click', () => { $('learnDone').hidden = true; home(); });

  // ---------- Bảng bài học ----------

  function renderPanel() {
    if (!run || !st) return;
    const s = st.s, entry = run.entry;
    const unit = COURSE[entry.u];
    $('learnPanel').style.setProperty('--uc', unit.color);
    $('lsUnit').textContent = run.test ? (run.test.practice ? 'Luyện tập' : 'Nhảy cóc') : entry.lesson.review ? `Phần ${entry.u + 1} · Ôn tập` : `Phần ${entry.u + 1} · Bài ${entry.k + 1}`;
    $('lsTitle').textContent = entry.lesson.title;
    $('lsText').textContent = s.t === 'quiz' ? s.q : (st.coach && !st.done ? st.coach + ' — ' : '') + s.text;
    $('lsBar').style.width = (100 * (run.si + (st.done ? 1 : 0)) / run.steps.length) + '%';
    $('lsHearts').textContent = run.hearts;

    const quiz = $('lsQuiz');
    quiz.hidden = s.t !== 'quiz';
    if (s.t === 'quiz') {
      quiz.innerHTML = '';
      s.options.forEach((o, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ls-opt' + (st.pick === k ? ' picked' : '') + (st.answered && k === s.answer ? ' right' : '') +
          (st.answered && st.pick === k && k !== s.answer ? ' wrong' : '');
        b.disabled = st.answered || st.removed.has(k);
        b.innerHTML = `<span class="ls-key">${k + 1}</span><span></span>`;
        b.children[1].textContent = o;
        b.addEventListener('click', () => pickOption(k));
        quiz.appendChild(b);
      });
    }

    const board = BOARD_STEPS.has(s.t);
    $('lsRetry').hidden = !board;
    $('lsHint').disabled = st.done || st.busy;
    $('lsRetry').disabled = st.busy && !st.feedback;

    const fb = $('lsFeedback');
    fb.hidden = !st.feedback;
    if (st.feedback) {
      fb.className = 'ls-feedback ' + (st.feedback.ok ? 'ok' : 'bad');
      $('lfIcon').innerHTML = `<svg class="ic"><use href="#i-${st.feedback.ok ? 'check' : 'close'}"/></svg>`;
      $('lfTitle').textContent = st.feedback.title;
      $('lfText').textContent = st.feedback.text;
    }

    const main = $('lsMain');
    main.className = 'ls-main';
    if (st.done) {
      main.hidden = false;
      main.disabled = false;
      main.textContent = 'Tiếp tục';
      if (st.feedback && !st.feedback.ok) main.classList.add('bad');
    } else if (s.t === 'quiz') {
      main.hidden = false;
      main.disabled = st.pick < 0;
      main.textContent = 'Kiểm tra';
    } else {
      main.hidden = true;
    }
  }

  $('lsMain').addEventListener('click', () => {
    if (!st) return;
    if (st.done) next();
    else if (st.s.t === 'quiz') checkQuiz();
  });
  $('lsHint').addEventListener('click', showHint);
  $('lsRetry').addEventListener('click', () => { if (st && !st.done && run.hearts > 0) openStep(); });
  $('lsClose').addEventListener('click', () => {
    if (run && (run.si > 0 || run.mistakes) && !confirm('Thoát bây giờ thì tiến độ bài này sẽ mất. Thoát?')) return;
    home();
  });
  document.addEventListener('keydown', e => {
    if (view !== 'lesson' || !st || document.body.dataset.mode !== 'learn' || !$('learnDone').hidden) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    if (st.s.t === 'quiz' && /^[1-9]$/.test(e.key) && Number(e.key) <= st.s.options.length) pickOption(Number(e.key) - 1);
    else if (e.key === 'Enter' && !$('lsMain').hidden && !$('lsMain').disabled) { e.preventDefault(); $('lsMain').click(); }
  });

  // ---------- Lộ trình ----------

  function iconHtml(icon, state) {
    if (state === 'locked') return '<svg class="ic"><use href="#i-lock"/></svg>';
    if (icon === 'quiz') return '<svg class="ic"><use href="#i-book"/></svg>';
    if (icon === 'tap') return '<svg class="ic"><use href="#i-target"/></svg>';
    if (icon === 'review') return '<svg class="ic"><use href="#i-dumbbell"/></svg>';
    return `<img src="pieces/${icon}.svg" alt="">`;
  }

  function renderHome() {
    const cur = currentIdx();
    $('lhStreak').textContent = streakNow();
    $('lhXp').textContent = store.xp;
    $('lhDone').textContent = doneCount();
    $('lhGoalText').textContent = `${Math.min(dayXp(), DAILY_GOAL)}/${DAILY_GOAL} XP`;
    $('lhGoalBar').style.width = Math.min(100, 100 * dayXp() / DAILY_GOAL) + '%';
    $('lhCourseText').textContent = `${doneCount()}/${FLAT.length} bài`;
    $('lhCourseBar').style.width = (100 * doneCount() / FLAT.length) + '%';
    $('lhNextText').textContent = cur < 0 ? 'Bạn đã học xong cả khoá – tuyệt vời! Ôn lại bất cứ bài nào bạn thích.'
      : `Tiếp theo: Phần ${FLAT[cur].u + 1} · ${FLAT[cur].lesson.title}`;
    $('lhContinue').hidden = cur < 0;

    const box = $('lhUnits');
    box.innerHTML = '';
    COURSE.forEach((unit, u) => {
      const sec = document.createElement('section');
      sec.className = 'unit';
      sec.style.setProperty('--uc', unit.color);
      sec.style.setProperty('--us', unit.shade);
      const lockedUnit = !unlocked(unitStart[u]);
      const items = FLAT.filter(x => x.u === u);
      const doneHere = items.filter(x => isDone(x.idx)).length;
      sec.id = 'unit-' + u;
      sec.innerHTML = `<div class="unit-head${lockedUnit ? ' locked' : ''}">
          <span class="uh-icon"><img src="pieces/${unitIcon(u)}.svg" alt=""></span>
          <div class="uh-text"><small>Phần ${u + 1} · ${items.length} bài</small><h3></h3><p></p></div>
          <div class="uh-side"></div>
          <div class="uh-bar"><i style="width:${100 * doneHere / items.length}%"></i></div>
        </div>
        <div class="unit-path"></div>`;
      sec.querySelector('h3').textContent = unit.title;
      sec.querySelector('p').textContent = unit.desc;
      const side = sec.querySelector('.uh-side');
      if (lockedUnit) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'uh-jump';
        b.textContent = 'Nhảy cóc';
        b.title = 'Làm bài kiểm tra để mở khoá phần này';
        b.addEventListener('click', () => {
          if (confirm(`Làm bài kiểm tra 6 câu để mở khoá Phần ${u + 1}? Sai 3 lần là không qua.`)) startTest(u);
        });
        side.appendChild(b);
      } else {
        side.innerHTML = doneHere === items.length ? '<span class="uh-count full"><svg class="ic"><use href="#i-check"/></svg></span>'
          : `<span class="uh-count">${doneHere}/${items.length}</span>`;
      }
      const path = sec.querySelector('.unit-path');
      items.forEach((x, n) => {
        const state = isDone(x.idx) ? 'done' : x.idx === cur ? 'current' : unlocked(x.idx) ? 'open' : 'locked';
        const wrap = document.createElement('div');
        wrap.className = 'node-wrap';
        wrap.style.setProperty('--x', OFFSETS[n % OFFSETS.length] + 'px');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `node ${state}` + (x.lesson.review ? ' review' : '');
        btn.dataset.idx = x.idx;
        btn.innerHTML = iconHtml(x.lesson.icon, state);
        btn.setAttribute('aria-label', `${x.lesson.title} (${state === 'locked' ? 'đang khoá' : state === 'done' ? 'đã xong' : 'mở'})`);
        btn.addEventListener('click', e => { e.stopPropagation(); openPopover(wrap, x, state); });
        wrap.appendChild(btn);
        if (state === 'current') wrap.insertAdjacentHTML('afterbegin', '<span class="node-start">Bắt đầu</span>');
        if (state === 'done') {
          const s = store.done[x.id];
          btn.insertAdjacentHTML('beforeend', '<span class="node-badge"><svg class="ic"><use href="#i-check"/></svg></span>');
          wrap.insertAdjacentHTML('beforeend', `<span class="node-stars">${[1, 2, 3].map(i => `<i class="${i <= s ? 'on' : ''}">★</i>`).join('')}</span>`);
        }
        path.appendChild(wrap);
      });
      box.appendChild(sec);
    });
    renderToc(cur);
    renderChart();
    const pool = practicePool().length;
    $('lhPractice').disabled = !pool;
    $('lhPracticeText').textContent = pool ? '5 thử thách ngẫu nhiên từ các bài bạn đã học · +5 XP' : 'Học xong ít nhất 1 bài để mở luyện tập.';
  }

  const unitIcon = u => (COURSE[u].lessons.find(l => /^[wb][KQRBNP]$/.test(l.icon)) || { icon: 'wK' }).icon;

  // Mục lục các phần ở cột bên
  function renderToc(cur) {
    const box = $('lhToc');
    box.innerHTML = '';
    COURSE.forEach((unit, u) => {
      const items = FLAT.filter(x => x.u === u);
      const n = items.filter(x => isDone(x.idx)).length;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toc-item' + (!unlocked(unitStart[u]) ? ' locked' : '') + (cur >= 0 && FLAT[cur].u === u ? ' cur' : '') + (n === items.length ? ' full' : '');
      b.style.setProperty('--uc', unit.color);
      b.innerHTML = `<img src="pieces/${unitIcon(u)}.svg" alt=""><span class="toc-name"><b></b><i style="width:${100 * n / items.length}%"></i></span><small>${n}/${items.length}</small>`;
      b.querySelector('b').textContent = `${u + 1}. ${unit.title}`;
      b.addEventListener('click', () => $('unit-' + u).scrollIntoView({ behavior: 'smooth', block: 'start' }));
      box.appendChild(b);
    });
  }

  // XP 7 ngày gần nhất
  function renderChart() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const t = Date.now() - i * 86400000;
      days.push({ key: dayOf(t), label: i === 0 ? 'Nay' : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(t).getDay()] });
    }
    const hist = store.hist || {};
    const vals = days.map(d => hist[d.key] || 0);
    const max = Math.max(DAILY_GOAL, ...vals);
    $('lhChart').innerHTML = days.map((d, i) => `<div class="ch-col${i === 6 ? ' today' : ''}${vals[i] >= DAILY_GOAL ? ' goal' : ''}" title="${vals[i]} XP">
        <span class="ch-val">${vals[i] || ''}</span><div class="ch-bar"><i style="height:${100 * vals[i] / max}%"></i></div><small>${d.label}</small></div>`).join('');
    $('lhWeek').textContent = vals.reduce((a, b) => a + b, 0) + ' XP';
  }

  $('lhPractice').addEventListener('click', startPractice);

  let pop = null;
  function closePopover() { if (pop) { pop.remove(); pop = null; } }
  function openPopover(wrap, x, state) {
    const same = pop && pop.parentNode === wrap;
    closePopover();
    if (same) return;
    pop = document.createElement('div');
    pop.className = 'node-pop ' + state;
    const unit = COURSE[x.u];
    pop.style.setProperty('--uc', unit.color);
    pop.style.setProperty('--us', unit.shade);
    const n = FLAT.filter(y => y.u === x.u).length;
    pop.innerHTML = '<b></b><small></small><button type="button"></button>';
    pop.querySelector('b').textContent = x.lesson.title;
    const btn = pop.querySelector('button');
    if (state === 'locked') {
      pop.querySelector('small').textContent = 'Hoàn thành các bài phía trên để mở khoá bài này.';
      btn.textContent = 'Đang khoá';
      btn.disabled = true;
    } else {
      const count = x.lesson.review ? x.lesson.count : x.lesson.steps.length;
      pop.querySelector('small').textContent = `${x.lesson.review ? 'Ôn tập' : `Bài ${x.k + 1}/${n}`} · ${count} thử thách`;
      btn.textContent = state === 'done' ? `Ôn lại +${XP_REPLAY} XP` : `Bắt đầu +${XP_NEW} XP`;
      btn.addEventListener('click', e => { e.stopPropagation(); start(x); });
    }
    pop.addEventListener('click', e => e.stopPropagation());
    wrap.appendChild(pop);
  }
  document.addEventListener('click', closePopover);

  $('lhContinue').addEventListener('click', () => { const i = currentIdx(); if (i >= 0) start(FLAT[i]); });

  function home() {
    token++;
    view = 'home';
    run = st = null;
    hint = null;
    document.body.dataset.learn = 'home';
    $('learnDone').hidden = true;
    renderHome();
    const cur = document.querySelector('.node.current') || document.querySelector('.node.open');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }

  // ---------- Giao tiếp với app.js ----------

  function canMove() {
    return view === 'lesson' && !!st && BOARD_STEPS.has(st.s.t) && !st.done && !st.busy && game.turn === st.side && run.hearts > 0;
  }

  const EMPTY_DECO = { stars: new Set(), ok: new Set(), bad: new Set(), focus: new Set() };

  return {
    enter() { store = load(); home(); },
    leave() { token++; closePopover(); view = 'home'; run = st = null; document.body.dataset.learn = ''; $('learnDone').hidden = true; },
    onMove, canMove, tap,
    tapMode: () => view === 'lesson' && !!st && st.s.t === 'tap' && !st.done,
    inLesson: () => view === 'lesson',
    status: () => ({ text: '' }),
    deco: () => (view === 'lesson' && st ? st : EMPTY_DECO),
    stars: () => (view === 'lesson' && st ? st.stars : new Set()),
    count: FLAT.length,
  };
})();
