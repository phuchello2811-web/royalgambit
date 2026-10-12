// Tài khoản, hồ sơ, hệ thống rank (exp + sao), ảnh đại diện, cài đặt và bảng xếp hạng.
//
// Hai chế độ, tự chọn theo config.js:
//   • Có cấu hình Firebase  → tài khoản email/mật khẩu (tên đăng nhập được đổi thành email giả
//     "tên@rg-user.app"), dữ liệu lưu trên Realtime Database, bảng xếp hạng dùng chung toàn thế giới.
//   • Chưa cấu hình         → "chế độ cục bộ": tài khoản và bảng xếp hạng chỉ nằm trong trình duyệt này.
//
// Rank (chỉ ván Online): thắng +15 exp, hòa +5 exp, thua -10 exp (không xuống dưới 0).
// 30 exp = 1 sao, đủ 3 sao (90 exp) thì lên rank tiếp theo. Rank cao nhất không giới hạn sao.
//
// Elo (hệ thống riêng, giống chess.com): tính cả ván Online lẫn ván đấu với máy.
//   Elo kỳ vọng   E = 1 / (1 + 10^((Elo đối thủ − Elo của bạn) / 400))
//   Elo mới       = Elo cũ + K × (kết quả − E)      (thắng = 1, hòa = 0.5, thua = 0)
//   K             = 40 trong 20 ván Elo đầu, 24 khi Elo < 2000, 16 khi Elo ≥ 2000
// Lần đầu vào web, người chơi tự chọn trình độ (LEVELS) để có Elo khởi điểm.
//
// Quyền admin: tài khoản tên ADMIN (OWNER) là chủ web, chỉ chủ web cấp / thu hồi được quyền admin.
//   Firebase: quyền lưu ở /admins/<uid> = true, luật server chỉ cho email admin@rg-user.app ghi vào đó.
//   Admin được dùng Gợi ý trong ván Online, và dùng Gợi ý vẫn được tính Elo / rank.

const Profile = (() => {
  const PREFS_KEY = 'covua-prefs';
  const AUTH_KEY = 'rg-auth';              // phiên đăng nhập (Firebase)
  const USERS_KEY = 'rg-local-users';      // tài khoản cục bộ
  const SESSION_KEY = 'rg-local-session';  // phiên đăng nhập cục bộ
  const EMAIL_DOMAIN = '@rg-user.app';
  const OWNER = 'admin';                   // tên (viết thường) của chủ web; khớp admin@rg-user.app trong firebase-rules.json

  const EXP_WIN = 15, EXP_DRAW = 5, EXP_LOSS = -10;
  const EXP_PER_STAR = 30;
  const STARS_PER_RANK = 3;
  const EXP_PER_RANK = EXP_PER_STAR * STARS_PER_RANK;

  const RANKS = [
    { name: 'Đồng',      color: '#cd7f32' },
    { name: 'Bạc',       color: '#c0c7d0' },
    { name: 'Vàng',      color: '#f5b83d' },
    { name: 'Bạch Kim',  color: '#4fd1c5' },
    { name: 'Kim Cương', color: '#5aa9ff' },
    { name: 'Cao Thủ',   color: '#c77dff' },
    { name: 'Thách Đấu', color: '#ff5a5f' },
  ];

  // ---------- Elo ----------
  const START_ELO = 800;                     // Elo tạm thời trước khi chọn trình độ
  const MIN_ELO = 100, MAX_ELO = 3500;
  const K_NEW = 40, K_MID = 24, K_HIGH = 16; // hệ số K
  const NEW_GAMES = 20;                      // số ván Elo đầu dùng K lớn
  const HIGH_ELO = 2000;                     // từ mức này trở lên dùng K nhỏ nhất

  // Elo của máy theo độ khó (khớp với nhãn trong ô "Độ khó")
  const BOT_ELO = { 1: 800, 2: 1200, 3: 1600 };

  // Các mức tự chọn lần đầu (min/max Elo khởi điểm phải khớp firebase-rules.json: 400–1500)
  const LEVELS = [
    { id: 'newbie', name: 'Người mới', elo: 400,  desc: 'Chưa chơi bao giờ hoặc vừa mới học luật' },
    { id: 'basic',  name: 'Cơ bản',    elo: 700,  desc: 'Biết cách đi các quân nhưng hay bị mất quân' },
    { id: 'mid',    name: 'Trung cấp', elo: 1000, desc: 'Chơi khá đều, biết vài khai cuộc và chiến thuật cơ bản' },
    { id: 'expert', name: 'Expert',    elo: 1200, desc: 'Chơi lâu năm, tính trước được nhiều nước, ít mắc lỗi' },
    { id: 'master', name: 'Cao thủ',   elo: 1500, desc: 'Thành thạo chiến thuật, tàn cuộc; từng đấu câu lạc bộ hoặc giải' },
  ];
  const PLACE_MIN = LEVELS[0].elo, PLACE_MAX = LEVELS[LEVELS.length - 1].elo;

  const cfg = window.LEADERBOARD || {};
  const remote = !!(cfg.apiKey && cfg.databaseURL);
  const db = (cfg.databaseURL || '').replace(/\/+$/, '');

  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const drop = k => { try { localStorage.removeItem(k); } catch {} };

  const guest = () => ({ name: 'Khách', exp: 0, elo: START_ELO, placed: false, eloGames: 0, games: 0, wins: 0, draws: 0, losses: 0, photo: '' });
  let me = guest();
  let signedIn = false;
  let adminFlag = false;             // đã được chủ web cấp quyền admin
  let auth = read(AUTH_KEY, null);   // Firebase: { uid, idToken, refreshToken, expires, name }
  let localKey = null;               // cục bộ: tên đăng nhập viết thường
  let queue = Promise.resolve();
  let prefs = { board: 'green', sound: true, ...read(PREFS_KEY, {}) };
  const listeners = [];
  const notify = () => listeners.forEach(f => f());

  // ---------- Ảnh đại diện: JPEG vuông 128×128 lưu dạng data URL ----------

  const AVATAR_SIZE = 128;
  const MAX_PHOTO_FILE = 10 * 1024 * 1024;
  const validPhoto = s => typeof s === 'string' && s.length <= 40000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s);

  // ---------- Rank ----------

  function rankOf(exp) {
    exp = Math.max(0, Math.floor(Number(exp) || 0));
    const last = RANKS.length - 1;
    const tier = Math.min(Math.floor(exp / EXP_PER_RANK), last);
    const top = tier === last;
    const into = exp - tier * EXP_PER_RANK;
    const stars = Math.floor(into / EXP_PER_STAR);
    const inStar = into % EXP_PER_STAR;
    const starText = top ? '★' + stars : '★'.repeat(stars) + '☆'.repeat(STARS_PER_RANK - stars);
    const { name, color } = RANKS[tier];
    return { exp, tier, name, color, top, stars, inStar, text: `${name} ${starText}` };
  }

  // ---------- Tính Elo ----------

  const clampElo = v => Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(Number(v) || START_ELO)));
  const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  const kFactor = () => me.eloGames < NEW_GAMES ? K_NEW : me.elo < HIGH_ELO ? K_MID : K_HIGH;

  // Elo thay đổi bao nhiêu nếu có kết quả `score` trước đối thủ `oppElo`
  function eloDelta(score, oppElo) {
    let d = Math.round(kFactor() * (score - expected(me.elo, clampElo(oppElo))));
    if (score === 1) d = Math.max(1, d);   // thắng luôn được ít nhất +1
    if (score === 0) d = Math.min(-1, d);  // thua luôn mất ít nhất -1
    return d;
  }

  const preview = oppElo => ({ win: eloDelta(1, oppElo), draw: eloDelta(0.5, oppElo), loss: eloDelta(0, oppElo) });

  function applyElo(score, oppElo) {
    const before = me.elo;
    me.elo = clampElo(me.elo + eloDelta(score, oppElo));
    me.eloGames++;
    return { before, after: me.elo, delta: me.elo - before, oppElo: clampElo(oppElo) };
  }

  const dataOf = m => ({ name: m.name, exp: m.exp, elo: m.elo, placed: !!m.placed, eloGames: m.eloGames, games: m.games, wins: m.wins, draws: m.draws, losses: m.losses, photo: m.photo || '' });

  function applyData(d) {
    const int = v => Math.max(0, Math.floor(Number(v) || 0));
    me = {
      name: String(d.name || me.name),
      exp: int(d.exp), elo: d.elo == null ? START_ELO : clampElo(d.elo), placed: d.placed === true, eloGames: int(d.eloGames),
      games: int(d.games), wins: int(d.wins), draws: int(d.draws), losses: int(d.losses),
      photo: validPhoto(d.photo) ? d.photo : '',
    };
  }

  // Lưu thay đổi: cục bộ ghi vào localStorage, Firebase thì do sync() lo
  function save() {
    if (signedIn && !remote && localKey) {
      const users = read(USERS_KEY, {});
      if (users[localKey]) { Object.assign(users[localKey], dataOf(me)); write(USERS_KEY, users); }
    }
    notify();
  }

  // Ván Online: score 1 thắng, 0.5 hòa, 0 thua. Cập nhật cả rank (exp) lẫn Elo.
  // Trả về rank trước/sau, exp thay đổi thực tế và `elo` = { before, after, delta }.
  function record(score, oppElo) {
    const before = rankOf(me.exp);
    const delta = score === 1 ? EXP_WIN : score === 0 ? EXP_LOSS : EXP_DRAW;
    me.exp = Math.max(0, me.exp + delta);
    me.games++;
    if (score === 1) me.wins++;
    else if (score === 0) me.losses++;
    else me.draws++;
    const elo = applyElo(score, oppElo);
    save();
    sync('online');
    return { before, after: rankOf(me.exp), delta: me.exp - before.exp, elo };
  }

  // Ván đấu với máy: chỉ đổi Elo, không đổi rank
  function recordBot(score, oppElo) {
    const elo = applyElo(score, oppElo);
    save();
    sync('bot');
    return { elo };
  }

  // Chọn trình độ lần đầu → Elo khởi điểm
  function place(elo) {
    elo = Math.round(Number(elo));
    if (!(elo >= PLACE_MIN && elo <= PLACE_MAX)) throw new Error('LEVEL');
    me.elo = elo;
    me.placed = true;
    save();
    syncPlacement();
  }

  function setPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('type'));
      if (file.size > MAX_PHOTO_FILE) return reject(new Error('size'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = AVATAR_SIZE;
        const g = canvas.getContext('2d');
        g.fillStyle = '#3d3a35'; // nền cho ảnh PNG/GIF trong suốt
        g.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
        g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        me.photo = canvas.toDataURL('image/jpeg', 0.85);
        save();
        syncPhoto();
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read')); };
      img.src = url;
    });
  }

  function removePhoto() {
    me.photo = '';
    save();
    syncPhoto();
  }

  // ---------- Tên đăng nhập / mật khẩu ----------

  function checkName(raw) {
    const name = String(raw || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error('NAME');
    return name;
  }
  function checkPassword(pw) {
    if (String(pw || '').length < 6) throw new Error('WEAK');
    return String(pw);
  }
  // Tên bắt đầu bằng "admin" chỉ dành riêng cho chủ web (chống mạo danh)
  function checkReserved(name) {
    const n = name.toLowerCase();
    if (n.startsWith('admin') && n !== OWNER) throw new Error('RESERVED');
  }
  const toEmail = name => name.toLowerCase() + EMAIL_DOMAIN;

  // ---------- Firebase (REST) ----------

  function errCode(data) {
    const msg = String((data && data.error && (data.error.message || data.error)) || '');
    if (/EMAIL_EXISTS/.test(msg)) return 'EXISTS';
    if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_EMAIL/.test(msg)) return 'BAD_LOGIN';
    if (/WEAK_PASSWORD/.test(msg)) return 'WEAK';
    if (/TOO_MANY_ATTEMPTS/.test(msg)) return 'TOO_MANY';
    if (/OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(msg)) return 'NOT_ALLOWED';
    if (/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED/.test(msg)) return 'SESSION';
    if (/Permission denied/i.test(msg)) return 'DENIED';
    return 'SERVER';
  }

  async function call(url, opts) {
    let res;
    try { res = await fetch(url, opts); } catch { throw new Error('NETWORK'); }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(errCode(data));
    return data;
  }

  const postJson = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  function setAuth(r, name) {
    auth = {
      uid: r.localId || r.user_id,
      idToken: r.idToken || r.id_token,
      refreshToken: r.refreshToken || r.refresh_token,
      expires: Date.now() + Number(r.expiresIn || r.expires_in) * 1000,
      name: name || (auth && auth.name) || '',
    };
    write(AUTH_KEY, auth);
  }

  async function token() {
    if (!auth) throw new Error('SESSION');
    if (Date.now() < auth.expires - 60000) return auth.idToken;
    try {
      const r = await call(`https://securetoken.googleapis.com/v1/token?key=${cfg.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken),
      });
      setAuth(r);
      return auth.idToken;
    } catch (e) {
      if (e.message === 'SESSION') { auth = null; drop(AUTH_KEY); }
      throw e;
    }
  }

  const playerUrl = t => `${db}/players/${auth.uid}.json?auth=${t}`;
  const photoUrl = t => `${db}/photos/${auth.uid}.json?auth=${t}`;
  const adminUrl = (t, uid = auth.uid) => `${db}/admins/${encodeURIComponent(uid)}.json?auth=${t}`;

  async function putProfile(t) {
    const body = { ...dataOf(me), lastGame: { '.sv': 'timestamp' } };
    delete body.photo;
    await call(playerUrl(t), { method: 'PUT', body: JSON.stringify(body) });
  }

  // Lấy bản ghi trên server làm chuẩn; chưa có thì tạo mới (luật server chỉ cho tạo với 0 exp)
  async function pull(defaultName) {
    const t = await token();
    const r = await call(playerUrl(t));
    if (r) {
      applyData(r);
    } else {
      me = { ...guest(), name: defaultName || auth.name };
      await putProfile(t);
    }
    auth.name = me.name;
    write(AUTH_KEY, auth);
    try {
      const p = await call(photoUrl(t));
      me.photo = validPhoto(p) ? p : '';
    } catch { me.photo = ''; }
    try { adminFlag = (await call(adminUrl(t))) === true; } catch { adminFlag = false; }
    notify();
  }

  // Ghi lần lượt theo hàng đợi để không bị đảo thứ tự
  function sync(kind) {
    if (!remote || !signedIn) return;
    queue = queue.then(async () => {
      const body = kind === 'bot'
        ? { elo: me.elo, eloGames: me.eloGames, lastGame: { '.sv': 'timestamp' } }
        : { exp: me.exp, games: me.games, wins: me.wins, draws: me.draws, losses: me.losses, elo: me.elo, eloGames: me.eloGames, lastGame: { '.sv': 'timestamp' } };
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await call(playerUrl(await token()), { method: 'PATCH', body: JSON.stringify(body) }); return; }
        catch { if (attempt === 0) await new Promise(r => setTimeout(r, 10500)); } // luật server cách nhau ≥ 10 giây
      }
      try { await pull(); } catch {} // lệch dữ liệu với server: lấy lại bản trên server
    });
  }

  function syncPlacement() {
    if (!remote || !signedIn) return;
    queue = queue.then(async () => {
      const body = { elo: me.elo, placed: true, eloGames: me.eloGames };
      for (let attempt = 0; attempt < 2; attempt++) {
        try { await call(playerUrl(await token()), { method: 'PATCH', body: JSON.stringify(body) }); return; }
        catch { if (attempt === 0) await new Promise(r => setTimeout(r, 1500)); }
      }
      try { await pull(); } catch {}
    });
  }

  function syncPhoto() {
    if (!remote || !signedIn) return;
    queue = queue.then(async () => {
      try {
        const t = await token();
        await call(photoUrl(t), me.photo ? { method: 'PUT', body: JSON.stringify(me.photo) } : { method: 'DELETE' });
      } catch {}
    });
  }

  // ---------- Tài khoản cục bộ ----------

  async function hash(s) {
    s = 'royal-gambit:' + s;
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
    } catch {
      let h = 5381;
      for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
      return 'x' + h;
    }
  }

  // ---------- Đăng ký / đăng nhập / đăng xuất ----------

  async function register(username, password) {
    const name = checkName(username);
    checkReserved(name);
    password = checkPassword(password);
    if (remote) {
      const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`,
        postJson({ email: toEmail(name), password, returnSecureToken: true }));
      setAuth(r, name);
      me = { ...guest(), name };
      adminFlag = false;
      signedIn = true;
      try { await putProfile(await token()); } catch {} // tạo lại ở lần đăng nhập sau nếu lỗi
    } else {
      const users = read(USERS_KEY, {});
      const key = name.toLowerCase();
      if (users[key]) throw new Error('EXISTS');
      users[key] = { ...guest(), name, hash: await hash(key + ':' + password) };
      write(USERS_KEY, users);
      write(SESSION_KEY, key);
      localKey = key;
      applyData(users[key]);
      adminFlag = false;
      signedIn = true;
    }
    notify();
  }

  async function login(username, password) {
    const name = checkName(username);
    if (remote) {
      const r = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.apiKey}`,
        postJson({ email: toEmail(name), password: String(password || ''), returnSecureToken: true }));
      setAuth(r, name);
      await pull(name);
      signedIn = true;
    } else {
      const users = read(USERS_KEY, {});
      const key = name.toLowerCase();
      const u = users[key];
      if (!u || u.hash !== await hash(key + ':' + String(password || ''))) throw new Error('BAD_LOGIN');
      write(SESSION_KEY, key);
      localKey = key;
      applyData(u);
      adminFlag = !!u.admin;
      signedIn = true;
    }
    notify();
  }

  // Tự đăng nhập lại bằng phiên đã lưu. Trả về true nếu thành công.
  async function restore() {
    try {
      if (remote) {
        if (!auth) return false;
        await token();
        await pull(auth.name);
      } else {
        const key = read(SESSION_KEY, null);
        const u = key && read(USERS_KEY, {})[key];
        if (!u) return false;
        localKey = key;
        applyData(u);
        adminFlag = !!u.admin;
      }
      signedIn = true;
      notify();
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    await queue.catch(() => {}); // đợi ghi nốt dữ liệu đang chờ
    signedIn = false;
    auth = null; localKey = null; adminFlag = false;
    drop(AUTH_KEY); drop(SESSION_KEY);
    me = guest();
    notify();
  }

  // ---------- Bảng xếp hạng ----------

  async function leaderboard() {
    let rows;
    if (remote) {
      const r = await call(`${db}/players.json?orderBy=%22exp%22&limitToLast=100`);
      rows = Object.entries(r || {}).map(([uid, p]) => ({ ...p, uid, me: !!auth && uid === auth.uid }));
    } else {
      rows = Object.entries(read(USERS_KEY, {})).map(([key, p]) => ({ ...p, uid: key, me: key === localKey }));
    }
    return rows
      .filter(p => p && (p.games > 0 || p.eloGames > 0) && typeof p.name === 'string')
      .map(p => ({ uid: p.uid, name: p.name.slice(0, 20), exp: Number(p.exp) || 0, elo: Number(p.elo) || START_ELO, games: p.games, wins: p.wins || 0, draws: p.draws || 0, losses: p.losses || 0, me: p.me }))
      .sort((a, b) => b.exp - a.exp || b.wins - a.wins || a.name.localeCompare(b.name));
  }

  // ---------- Quyền admin ----------

  const isOwner = () => signedIn && me.name.toLowerCase() === OWNER;
  const isAdmin = () => isOwner() || adminFlag;

  // Đọc lại quyền admin (người vừa được cấp quyền không cần đăng nhập lại)
  async function refreshAdmin() {
    if (!signedIn) return;
    try {
      if (remote) adminFlag = (await call(adminUrl(await token()))) === true;
      else adminFlag = !!(read(USERS_KEY, {})[localKey] || {}).admin;
    } catch {}
    notify();
  }

  // Danh sách người chơi cho bảng quản trị (chỉ chủ web)
  async function listPlayers() {
    if (!isOwner()) throw new Error('DENIED');
    let rows, adminsDenied = false;
    if (remote) {
      const t = await token();
      const [players, admins] = await Promise.all([
        call(`${db}/players.json`),
        // Luật Firebase cũ chưa có mục admins: vẫn hiện danh sách người chơi, chỉ chưa biết ai đã là admin
        call(`${db}/admins.json?auth=${t}`).catch(e => { if (e.message !== 'DENIED') throw e; adminsDenied = true; return null; }),
      ]);
      rows = Object.entries(players || {}).map(([uid, d]) => ({ uid, d, admin: !!(admins && admins[uid]), self: uid === auth.uid }));
    } else {
      rows = Object.entries(read(USERS_KEY, {})).map(([uid, d]) => ({ uid, d, admin: !!d.admin, self: uid === localKey }));
    }
    return {
      adminsDenied,
      rows: rows
        .filter(r => r.d && typeof r.d.name === 'string')
        .map(r => ({
          uid: r.uid, name: r.d.name.slice(0, 20), exp: Number(r.d.exp) || 0, elo: Number(r.d.elo) || START_ELO,
          admin: r.admin, owner: r.d.name.toLowerCase() === OWNER, me: r.self,
        })),
    };
  }

  // Cấp (on = true) hoặc thu hồi quyền admin. Luật Firebase chỉ cho chủ web ghi vào /admins.
  async function setAdmin(uid, on) {
    if (!isOwner()) throw new Error('DENIED');
    if (remote) {
      await call(adminUrl(await token(), uid), on ? { method: 'PUT', body: 'true' } : { method: 'DELETE' });
    } else {
      const users = read(USERS_KEY, {});
      if (!users[uid]) throw new Error('SERVER');
      if (on) users[uid].admin = true; else delete users[uid].admin;
      write(USERS_KEY, users);
    }
  }

  // ---------- Cầu nối cho Contest ----------

  // ID người chơi: Firebase uid, hoặc tên đăng nhập viết thường ở chế độ cục bộ
  const uid = () => remote ? ((auth && auth.uid) || null) : localKey;

  // Gọi Realtime Database bằng tài khoản đang đăng nhập. path như 'contests/abc'.
  async function dbCall(path, method = 'GET', body) {
    const t = await token();
    const opts = { method };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return call(`${db}/${path}.json?auth=${t}`, opts);
  }

  return {
    me: () => me,
    uid, dbCall,
    remote,
    signedIn: () => signedIn,
    register, login, restore, logout,
    leaderboard,
    isOwner, isAdmin, refreshAdmin, listPlayers, setAdmin,
    rankOf,
    record,
    recordBot,
    place,
    preview,
    setPhoto,
    removePhoto,
    validPhoto,
    RANKS,
    LEVELS,
    BOT_ELO,
    rules: {
      win: EXP_WIN, draw: EXP_DRAW, loss: EXP_LOSS, perStar: EXP_PER_STAR, starsPerRank: STARS_PER_RANK, perRank: EXP_PER_RANK,
      elo: { start: START_ELO, kNew: K_NEW, kMid: K_MID, kHigh: K_HIGH, newGames: NEW_GAMES, highElo: HIGH_ELO },
    },
    prefs: () => prefs,
    setPref(k, v) { prefs[k] = v; write(PREFS_KEY, prefs); notify(); },
    onChange: f => listeners.push(f),
  };
})();
