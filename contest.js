// Contest: giải đấu theo thời gian kiểu Arena. Chỉ admin tạo được contest.
// • Trước giờ bắt đầu: người chơi bấm Đăng ký (hủy đăng ký được). Contest bắt đầu thì đóng đăng ký.
// • Trong giờ thi đấu: web tự ghép cặp những người đã đăng ký đang mở web (xem app.js, phần "Tự ghép cặp"),
//   ván xong thì tự tìm ván tiếp. Thắng +2, hòa +1, thua 0 (rank và Elo vẫn tính như ván Online thường).
// • Kết thúc: xếp hạng theo điểm → số ván thắng → ít ván hơn. Hạng 1/2/3 (đã chơi ít nhất 1 ván) nhận
//   huy chương vàng / bạc / đồng, hiện trên hồ sơ và bảng xếp hạng.
//
// Dữ liệu (Firebase, cần dán lại firebase-rules.json):
//   /contests/<id>            = { name, desc?, start, end, by, byName }          (chỉ admin ghi)
//   /contestScores/<id>/<uid> = { name, pts, games, wins, draws, losses, last }  (mỗi người chỉ ghi dòng của mình)
// Chế độ cục bộ (chưa cấu hình Firebase): lưu trong localStorage của trình duyệt này.

const Contest = (() => {
  const LOCAL_C = 'rg-local-contests';
  const LOCAL_S = 'rg-local-cscores';
  const MAX_SPAN = 7 * 24 * 3600 * 1000; // contest dài tối đa 7 ngày (khớp firebase-rules.json)
  const GRACE = 30 * 60 * 1000;          // ván bắt đầu trước giờ kết thúc vẫn được tính tới 30 phút sau (khớp firebase-rules.json)
  const MIN_GAP = 20000;                 // hai lần ghi điểm cách nhau ít nhất 20 giây (khớp firebase-rules.json)
  const remote = Profile.remote;

  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const int = v => Math.max(0, Math.floor(Number(v) || 0));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let queue = Promise.resolve(); // ghi điểm lần lượt, không bị đảo thứ tự
  const reg = new Map();         // contest id → đã đăng ký chưa (của tài khoản đang đăng nhập)
  let regOwner = null;
  let medalCache = null;         // { at, data }

  // 'upcoming' | 'live' | 'ended'
  function phase(c, t = Date.now()) { return t < c.start ? 'upcoming' : t < c.end ? 'live' : 'ended'; }
  // Đã chốt kết quả (hết cả thời gian gia hạn cho ván đang dở)
  const isFinal = (c, t = Date.now()) => t > c.end + GRACE;

  // ID chỉ gồm chữ thường và số: dùng được luôn làm một phần ID PeerJS của phòng chờ
  function newId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = 'c';
    for (let i = 0; i < 9; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function list() {
    const raw = remote ? await Profile.dbCall('contests') : read(LOCAL_C, {});
    return Object.entries(raw || {})
      .filter(([, c]) => c && typeof c.name === 'string' && Number.isFinite(c.start) && Number.isFinite(c.end))
      .map(([id, c]) => ({
        id, name: c.name.slice(0, 60), desc: String(c.desc || '').slice(0, 200),
        start: c.start, end: c.end, byName: String(c.byName || '').slice(0, 20),
      }));
  }

  // Chỉ admin. Máy chủ cũng kiểm tra lại bằng luật Firebase.
  async function create({ name, desc, start, end }) {
    if (!Profile.isAdmin()) throw new Error('DENIED');
    name = String(name || '').trim();
    desc = String(desc || '').trim().slice(0, 200);
    if (name.length < 3 || name.length > 60) throw new Error('NAME');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_SPAN) throw new Error('TIME');
    if (start <= Date.now()) throw new Error('PAST'); // phải có thời gian cho mọi người đăng ký
    const id = newId();
    const row = { name, start, end, by: Profile.uid(), byName: Profile.me().name };
    if (desc) row.desc = desc;
    if (remote) {
      await Profile.dbCall('contests/' + id, 'PUT', row);
    } else {
      const all = read(LOCAL_C, {});
      all[id] = row;
      write(LOCAL_C, all);
    }
    medalCache = null;
    return id;
  }

  async function remove(id) {
    if (!Profile.isAdmin()) throw new Error('DENIED');
    if (remote) {
      await Profile.dbCall('contestScores/' + id, 'DELETE');
      await Profile.dbCall('contests/' + id, 'DELETE');
    } else {
      const all = read(LOCAL_C, {}), sc = read(LOCAL_S, {});
      delete all[id]; delete sc[id];
      write(LOCAL_C, all); write(LOCAL_S, sc);
    }
    reg.delete(id);
    medalCache = null;
  }

  // Bộ nhớ đăng ký gắn với tài khoản: đổi tài khoản thì xóa
  function regMap() {
    const u = Profile.uid();
    if (u !== regOwner) { reg.clear(); regOwner = u; }
    return reg;
  }

  // Đăng ký tham gia: chỉ trước giờ bắt đầu (làm nhiều lần cũng không sao)
  async function join(c) {
    if (!Profile.signedIn()) throw new Error('DENIED');
    const ph = phase(c);
    if (ph === 'ended') throw new Error('ENDED');
    if (ph === 'live') throw new Error('CLOSED');
    const uid = Profile.uid();
    const row = { name: Profile.me().name, pts: 0, games: 0, wins: 0, draws: 0, losses: 0 };
    if (remote) {
      const path = `contestScores/${c.id}/${uid}`;
      if (!(await Profile.dbCall(path))) await Profile.dbCall(path, 'PUT', { ...row, last: { '.sv': 'timestamp' } });
    } else {
      const all = read(LOCAL_S, {});
      all[c.id] = all[c.id] || {};
      if (!all[c.id][uid]) all[c.id][uid] = { ...row, last: Date.now() };
      write(LOCAL_S, all);
    }
    regMap().set(c.id, true);
  }

  // Hủy đăng ký: chỉ trước giờ bắt đầu
  async function unjoin(c) {
    if (phase(c) !== 'upcoming') throw new Error('CLOSED');
    const uid = Profile.uid();
    if (remote) {
      await Profile.dbCall(`contestScores/${c.id}/${uid}`, 'DELETE');
    } else {
      const all = read(LOCAL_S, {});
      if (all[c.id]) delete all[c.id][uid];
      write(LOCAL_S, all);
    }
    regMap().set(c.id, false);
  }

  // Tài khoản đang đăng nhập đã đăng ký contest này chưa (có bộ nhớ đệm)
  async function registered(c, fresh = false) {
    const m = regMap();
    if (!fresh && m.has(c.id)) return m.get(c.id);
    const uid = Profile.uid();
    if (!uid) return false;
    const row = remote ? await Profile.dbCall(`contestScores/${c.id}/${uid}`) : ((read(LOCAL_S, {})[c.id] || {})[uid] || null);
    const ok = !!row;
    m.set(c.id, ok);
    return ok;
  }

  function rowsOf(raw) {
    const me = Profile.uid();
    return Object.entries(raw || {})
      .filter(([, r]) => r && typeof r.name === 'string')
      .map(([uid, r]) => ({
        uid, name: r.name.slice(0, 20), pts: int(r.pts), games: int(r.games),
        wins: int(r.wins), draws: int(r.draws), losses: int(r.losses), me: uid === me,
      }));
  }

  // Sắp xếp và gán hạng: bằng điểm, bằng số ván thắng và bằng số ván thì cùng hạng
  function standings(rows) {
    rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.games - b.games || a.name.localeCompare(b.name));
    rows.forEach((r, i) => {
      const p = rows[i - 1];
      r.place = p && p.pts === r.pts && p.wins === r.wins && p.games === r.games ? p.place : i + 1;
      r.medal = r.games > 0 && r.place <= 3 ? r.place : 0;
    });
    return rows;
  }

  // Bảng điểm đã sắp xếp
  async function scores(id) {
    const raw = remote ? await Profile.dbCall('contestScores/' + id) : (read(LOCAL_S, {})[id] || {});
    const rows = standings(rowsOf(raw));
    const mine = rows.some(r => r.me);
    regMap().set(id, mine);
    return rows;
  }

  // Huy chương của mọi người chơi: uid → [{ id, name, end, place }] (chỉ contest đã chốt kết quả)
  async function medals(fresh = false) {
    if (!fresh && medalCache && Date.now() - medalCache.at < 60000) return medalCache.data;
    const contests = (await list()).filter(c => isFinal(c));
    const data = {};
    if (contests.length) {
      const all = remote ? await Profile.dbCall('contestScores') : read(LOCAL_S, {});
      for (const c of contests) {
        for (const r of standings(rowsOf(all && all[c.id]))) {
          if (!r.medal) continue;
          (data[r.uid] = data[r.uid] || []).push({ id: c.id, name: c.name, end: c.end, place: r.medal });
        }
      }
      for (const k in data) data[k].sort((a, b) => b.end - a.end);
    }
    medalCache = { at: Date.now(), data };
    return data;
  }

  const count = list => [1, 2, 3].map(p => (list || []).filter(m => m.place === p).length);

  // Cộng điểm cho một ván vừa xong (score: 1 thắng, 0.5 hòa, 0 thua).
  // Chỉ tính ván bắt đầu trong giờ contest và kết thúc trước hạn gia hạn.
  // Trả về { pts, name } ngay để hiện trong hộp kết quả; việc ghi lên máy chủ chạy nền.
  function record(c, score, startedAt) {
    const t = Date.now();
    if (!startedAt || startedAt < c.start || startedAt > c.end || t > c.end + GRACE) return null;
    const uid = Profile.uid(); // chốt người chơi ngay lúc ván kết thúc, phòng khi đổi tài khoản trước khi ghi xong
    queue = queue.then(() => bump(c.id, uid, score)).catch(() => {});
    medalCache = null;
    return { pts: score === 1 ? 2 : score === 0 ? 0 : 1, name: c.name };
  }

  async function bump(id, uid, score) {
    const key = score === 1 ? 'wins' : score === 0 ? 'losses' : 'draws';
    const next = r => {
      const n = { wins: int(r.wins), draws: int(r.draws), losses: int(r.losses) };
      n[key]++;
      return { ...n, games: n.wins + n.draws + n.losses, pts: 2 * n.wins + n.draws };
    };
    if (remote) {
      const path = `contestScores/${id}/${uid}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const row = await Profile.dbCall(path);
        if (!row) return; // chưa đăng ký contest này thì không có điểm
        const gap = Number(row.last) ? MIN_GAP + 1000 - (Date.now() - Number(row.last)) : 0;
        if (gap > 0) await wait(gap);
        try { await Profile.dbCall(path, 'PATCH', { ...next(row), last: { '.sv': 'timestamp' } }); return; }
        catch (e) { if (attempt) throw e; await wait(MIN_GAP + 1000); }
      }
    } else {
      const all = read(LOCAL_S, {});
      const row = all[id] && all[id][uid];
      if (!row) return;
      Object.assign(row, next(row), { last: Date.now() });
      write(LOCAL_S, all);
    }
  }

  return { phase, isFinal, list, create, remove, join, unjoin, registered, scores, medals, count, record, MAX_SPAN, GRACE };
})();
