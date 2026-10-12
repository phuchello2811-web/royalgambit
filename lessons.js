// Khoá học cờ vua kiểu Duolingo: các Phần (unit) → các Bài (lesson) → các Thử thách (step).
// Kiểm tra lại toàn bộ bài bằng: node tools/check-lessons.js
//
// Các loại thử thách (trường `t`):
//   'quiz'    – câu hỏi trắc nghiệm: q, options, answer (vị trí đáp án đúng), explain?, marks? (ô được tô)
//   'tap'     – bấm vào các ô: squares, ordered? (phải bấm đúng thứ tự)
//   'stars'   – đi quân ăn hết ngôi sao (chỉ bên Trắng đi, quân Đen đứng yên)
//   'capture' – ăn hết quân Đen (quân Đen đứng yên)
//   'line'    – đi đúng chuỗi nước; nước của người học có thể có nhiều đáp án 'a|b', máy tự đi nước của bên kia
//   'goal'    – một nước thỏa mục tiêu: castle (castle?: 'K' | 'Q'), promote, check, dcheck (chiếu đôi), mate
//   'mate'    – chiếu hết trong n nước (máy chống đỡ)
//   'win'     – đấu với máy tới khi chiếu hết, tối đa `limit` nước
//   'run'     – đấu với máy, đưa Tốt phong cấp an toàn trong tối đa `limit` nước
// Chung: text (lời dặn), fen, side? ('w' mặc định; 'b' = người học cầm Đen).
// Bài có review: true là bài ôn tập, lấy ngẫu nhiên thử thách từ các bài trước trong phần.

// Các hàm tạo bài để trong một phạm vi riêng: các file .js của web dùng chung phạm vi toàn cục
const COURSE = (() => {
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const Q = (q, options, answer, o = {}) => ({ t: 'quiz', q, options, answer, fen: EMPTY, ...o });
const TAP = (text, squares, o = {}) => ({ t: 'tap', text, squares, fen: EMPTY, ...o });
const STARS = (text, fen, stars) => ({ t: 'stars', text, fen, stars });
const CAP = (text, fen) => ({ t: 'capture', text, fen });
const LINE = (text, fen, line, o = {}) => ({ t: 'line', text, fen, line, ...o });
const GOAL = (goal, text, fen, o = {}) => ({ t: 'goal', goal, text, fen, ...o });
const MATE1 = (text, fen) => ({ t: 'goal', goal: 'mate', text, fen });
const MATE = (n, text, fen) => ({ t: 'mate', n, text, fen });
const WIN = (text, fen, limit) => ({ t: 'win', text, fen, limit });
const RUN = (text, fen, limit) => ({ t: 'run', text, fen, limit });
const L = (title, icon, ...steps) => ({ title, icon, steps });
const REVIEW = (title = 'Ôn tập', count = 4) => ({ title, icon: 'review', review: true, count, steps: [] });

return [
  {
    title: 'Làm quen bàn cờ', desc: 'Bàn cờ, tên các ô và quân cờ', color: '#81b64c', shade: '#5d8a32',
    lessons: [
      L('Bàn cờ', 'quiz',
        Q('Bàn cờ vua có bao nhiêu ô?', ['32 ô', '64 ô', '81 ô', '100 ô'], 1, { explain: '8 hàng × 8 cột = 64 ô, xen kẽ sáng và tối.' }),
        Q('Khi đặt bàn cờ, ô ở góc dưới bên phải mỗi người có màu gì?', ['Ô sáng', 'Ô tối'], 0, { marks: ['h1'], explain: 'Nhớ câu "trắng bên phải": ô h1 luôn là ô sáng.' })),
      L('Cột và hàng', 'tap',
        TAP('Cột đặt tên bằng chữ a–h (trái sang phải), hàng bằng số 1–8 (dưới lên trên). Hãy bấm vào ô a1.', ['a1']),
        TAP('Giờ bấm vào ô h8 – góc đối diện.', ['h8']),
        TAP('Ô e4 nằm ở cột e, hàng 4. Hãy bấm vào ô e4.', ['e4'])),
      L('Tên ô', 'tap',
        TAP('Bấm vào ô d5.', ['d5']),
        TAP('Bấm lần lượt các ô c3, f6 rồi b7.', ['c3', 'f6', 'b7'], { ordered: true }),
        Q('Ô được tô có tên là gì?', ['g2', 'b7', 'g7', 'b2'], 0, { marks: ['g2'] }),
        Q('Còn ô này?', ['c6', 'f3', 'c3', 'f6'], 1, { marks: ['f3'] })),
      L('Đường chéo', 'tap',
        TAP('Đường chéo dài nhất nối a1 với h8. Hãy bấm vào 4 ô: b2, c3, d4, e5.', ['b2', 'c3', 'd4', 'e5'], { marks: ['a1', 'h8'] }),
        Q('Ô nào KHÔNG nằm trên đường chéo a1–h8?', ['c3', 'f6', 'g8', 'h8'], 2, { marks: ['a1', 'h8'] })),
      L('Xếp quân', 'wK',
        TAP('Đây là thế cờ lúc bắt đầu ván. Bấm vào Vua Trắng.', ['e1'], { fen: START }),
        TAP('Bấm vào hai Xe Đen.', ['a8', 'h8'], { fen: START }),
        Q('Hậu Trắng đứng ô nào khi bắt đầu ván?', ['d1', 'e1', 'c1', 'd8'], 0, { fen: START, explain: 'Hậu đứng ô cùng màu với mình: Hậu Trắng ở ô sáng d1, Hậu Đen ở ô tối d8.' })),
      L('Giá trị quân', 'wQ',
        Q('Quân nào mạnh nhất (không tính Vua)?', ['Xe', 'Hậu', 'Mã', 'Tượng'], 1, { fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1' }),
        Q('Mã và Tượng mỗi quân đáng khoảng mấy Tốt?', ['1', '3', '5', '9'], 1),
        Q('Xe đáng khoảng mấy Tốt?', ['3', '5', '7', '9'], 1),
        Q('Đổi Xe (5 điểm) lấy Mã (3 điểm) là lời hay lỗ?', ['Lời', 'Lỗ', 'Hòa vốn'], 1)),
      L('Mục tiêu ván cờ', 'quiz',
        Q('Bạn thắng ván cờ khi nào?', ['Ăn hết quân đối phương', 'Chiếu hết Vua đối phương', 'Phong được Hậu', 'Ăn được Hậu đối phương'], 1),
        Q('Bên nào đi trước?', ['Trắng', 'Đen', 'Bốc thăm'], 0),
        Q('Vua có bị ăn như các quân khác không?', ['Có', 'Không – Vua chỉ bị chiếu và chiếu hết'], 1)),
      REVIEW(),
    ],
  },
  {
    title: 'Xe và Tượng', desc: 'Đi thẳng và đi chéo', color: '#4a90d0', shade: '#336ea6',
    lessons: [
      L('Xe đi ngang dọc', 'wR',
        STARS('Xe đi theo hàng ngang hoặc cột dọc, bao nhiêu ô cũng được. Hãy đi Xe ăn hết các ngôi sao ★', '8/8/8/8/3R4/8/8/8 w - - 0 1', ['d7', 'g7', 'g2', 'b2'])),
      L('Xe đi vòng', 'wR',
        STARS('Đi Xe tới ba góc còn lại của bàn cờ.', '8/8/8/8/8/8/8/R7 w - - 0 1', ['a8', 'h8', 'h1']),
        STARS('Xe không nhảy qua quân khác được. Tìm đường vòng!', '8/8/8/2P5/8/8/8/2R5 w - - 0 1', ['c7', 'f7'])),
      L('Xe ăn quân', 'wR',
        CAP('Xe ăn quân bằng cách đi vào ô của quân đối phương. Hãy ăn hết quân Đen (quân Đen đứng yên).', '8/1p6/8/8/1R3p2/8/8/5n2 w - - 0 1')),
      L('Tượng đi chéo', 'wB',
        STARS('Tượng đi theo đường chéo, bao nhiêu ô cũng được.', '8/8/8/8/8/8/8/2B5 w - - 0 1', ['e3', 'h6', 'f8', 'a3'])),
      L('Tượng và màu ô', 'wB',
        Q('Tượng đứng ô tối có đi sang ô sáng được không?', ['Được', 'Không bao giờ'], 1, { fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', explain: 'Tượng luôn ở trên ô cùng màu suốt ván cờ.' }),
        STARS('Tượng ô sáng chỉ đi trên ô sáng. Ăn hết sao nào!', '8/8/8/8/8/8/8/5B2 w - - 0 1', ['b5', 'e8', 'h5', 'd1'])),
      L('Tượng ăn quân', 'wB',
        CAP('Dùng Tượng ăn hết quân Đen.', '3n4/8/8/6p1/8/4p3/8/2B5 w - - 0 1')),
      L('Xe và Tượng', 'wR',
        Q('Quân nào đi được tới mọi ô trên bàn cờ?', ['Xe', 'Tượng'], 0),
        CAP('Phối hợp Xe và Tượng để ăn hết quân Đen.', '8/8/7n/8/4b3/8/8/R1B5 w - - 0 1')),
      REVIEW(),
    ],
  },
  {
    title: 'Hậu, Mã và Vua', desc: 'Quân mạnh nhất, quân nhảy và quân quan trọng nhất', color: '#9a72d4', shade: '#7552aa',
    lessons: [
      L('Hậu', 'wQ',
        STARS('Hậu đi được như Xe và Tượng: ngang, dọc và chéo.', '8/8/8/8/8/8/8/3Q4 w - - 0 1', ['d5', 'a8', 'h8', 'h1'])),
      L('Hậu săn quân', 'wQ',
        CAP('Hậu là quân mạnh nhất. Ăn hết quân Đen!', '8/p5b1/8/8/3Q3r/8/1n6/8 w - - 0 1')),
      L('Mã nhảy chữ L', 'wN',
        STARS('Mã đi hình chữ L: 2 ô theo một hướng rồi rẽ 1 ô.', '8/8/8/8/8/8/8/1N6 w - - 0 1', ['c3', 'd5', 'f6', 'g8'])),
      L('Mã nhảy qua quân', 'wN',
        STARS('Mã là quân duy nhất nhảy qua được quân khác.', '8/8/8/8/8/8/5PPP/6N1 w - - 0 1', ['f3', 'e5', 'd7', 'b8'])),
      L('Mã ăn quân', 'wN',
        CAP('Dùng Mã ăn hết quân Đen.', '8/4p3/2p3p1/8/3N4/8/8/8 w - - 0 1')),
      L('Mã ở trung tâm', 'wN',
        Q('Mã đứng ở đâu thì mạnh hơn?', ['Ở góc bàn', 'Ở trung tâm'], 1, { fen: '8/8/8/8/3N4/8/8/N7 w - - 0 1', explain: 'Mã ở trung tâm khống chế 8 ô, ở góc chỉ có 2 ô.' }),
        STARS('Đưa Mã từ góc a1 tới ô h8.', '8/8/8/8/8/8/8/N7 w - - 0 1', ['h8'])),
      L('Vua', 'wK',
        STARS('Vua đi 1 ô theo mọi hướng.', '8/8/8/8/8/8/8/4K3 w - - 0 1', ['d2', 'd3', 'e4', 'f5'])),
      L('Vua tránh ô bị tấn công', 'wK',
        STARS('Xe Đen khống chế hàng 3. Vua không được đi vào ô bị tấn công – tìm đường tới ngôi sao!', '8/8/8/8/8/3P3r/8/4K3 w - - 0 1', ['c4']),
        Q('Hai Vua có được đứng cạnh nhau không?', ['Được', 'Không bao giờ'], 1, { fen: '8/8/8/3k4/8/3K4/8/8 w - - 0 1', explain: 'Vua không được đi vào ô bị tấn công, mà ô cạnh Vua đối phương luôn bị nó tấn công.' })),
      REVIEW(),
    ],
  },
  {
    title: 'Tốt', desc: 'Quân nhỏ nhưng có thể thành Hậu', color: '#e08a2c', shade: '#ad6619',
    lessons: [
      L('Tốt đi thẳng', 'wP',
        STARS('Tốt đi thẳng 1 ô (nước đầu được đi 2 ô) và ăn chéo phía trước. Tốt không đi lùi.', '8/8/8/3p4/8/8/4P3/8 w - - 0 1', ['e4', 'd5', 'd6'])),
      L('Bước đầu 2 ô', 'wP',
        Q('Khi nào Tốt được đi 2 ô?', ['Bất cứ lúc nào', 'Chỉ ở nước đi đầu tiên của Tốt đó', 'Khi ăn quân'], 1),
        STARS('Đưa Tốt tới ngôi sao nhanh nhất.', '8/8/8/8/8/8/2P5/8 w - - 0 1', ['c4', 'c6'])),
      L('Tốt ăn chéo', 'wP',
        CAP('Tốt ăn quân theo đường chéo phía trước.', '8/8/8/1b6/2n5/3n4/4P3/8 w - - 0 1')),
      L('Tốt bị chặn', 'wP',
        Q('Tốt e4 có đi tiếp được không?', ['Được, lên e5', 'Không, Tốt bị chặn', 'Được, ăn Tốt e5'], 1, { fen: '8/8/8/4p3/4P3/8/8/8 w - - 0 1', explain: 'Tốt đi thẳng nhưng không ăn thẳng, nên quân đứng ngay trước sẽ chặn nó.' }),
        Q('Tốt Trắng ở e4 ăn được quân nào?', ['Quân ở e5', 'Quân ở d5 hoặc f5', 'Quân ở d3'], 1, { fen: '8/8/8/3n1b2/4P3/8/8/8 w - - 0 1' })),
      L('Phong cấp', 'wQ',
        GOAL('promote', 'Tốt đi tới hàng cuối được phong thành Hậu, Xe, Tượng hoặc Mã. Hãy phong cấp!', '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1')),
      L('Phong thành Mã', 'wN',
        LINE('Đôi khi phong Mã hay hơn phong Hậu! Phong Mã để chiếu Vua và tấn công Hậu cùng lúc, rồi ăn Hậu.', '8/1k1P1q2/8/8/8/8/8/7K w - - 0 1', ['d7d8n', 'b7c7', 'd8f7'])),
      L('Bắt tốt qua đường', 'wP',
        LINE('Tốt Đen đi 2 ô (d7–d5) và dừng cạnh Tốt e5 của bạn. Bạn được ăn nó như thể nó chỉ đi 1 ô – nhưng phải ăn ngay! Đi e5×d6.', '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', ['d7d5', 'e5d6'])),
      L('Bắt tốt qua đường (2)', 'wP',
        LINE('Lần này Đen đi g7–g5. Bắt tốt qua đường nào!', '4k3/6p1/8/5P2/8/8/8/4K3 b - - 0 1', ['g7g5', 'f5g6']),
        Q('Phải bắt tốt qua đường khi nào?', ['Bất cứ lúc nào', 'Ngay ở nước kế tiếp', 'Trong vòng 3 nước'], 1)),
      REVIEW(),
    ],
  },
  {
    title: 'Luật đặc biệt', desc: 'Nhập thành, pat và các kiểu hòa', color: '#30a58b', shade: '#227a67',
    lessons: [
      L('Nhập thành gần', 'wK',
        GOAL('castle', 'Nhập thành: Vua đi 2 ô về phía Xe, Xe nhảy qua đứng cạnh Vua. Hãy nhập thành gần (Vua tới g1).', '4k3/8/8/8/8/8/8/4K2R w K - 0 1', { castle: 'K' })),
      L('Nhập thành xa', 'wK',
        GOAL('castle', 'Nhập thành xa: Vua đi 2 ô về phía Xe a1 (Vua tới c1).', '4k3/8/8/8/8/8/8/R3K3 w Q - 0 1', { castle: 'Q' }),
        GOAL('castle', 'Chọn một bên và nhập thành.', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')),
      L('Khi nào không được nhập thành', 'quiz',
        Q('Vua Trắng đang bị chiếu. Có được nhập thành không?', ['Được', 'Không'], 1, { fen: '4k3/8/8/8/8/8/4r3/4K2R w K - 0 1' }),
        Q('Ô f1 bị Tượng Đen tấn công. Có nhập thành gần được không?', ['Được', 'Không – Vua không được đi qua ô bị tấn công'], 1, { fen: '4k3/8/b7/8/8/8/8/4K2R w K - 0 1', marks: ['f1'] }),
        Q('Vua đã đi rồi quay về chỗ cũ. Còn được nhập thành không?', ['Còn', 'Không'], 1)),
      L('Pat – hết nước đi', 'quiz',
        Q('Đen tới lượt, không bị chiếu nhưng không còn nước đi hợp lệ. Kết quả là gì?', ['Trắng thắng', 'Hòa (pat)', 'Đen thắng'], 1, { fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', explain: 'Hết nước đi mà không bị chiếu gọi là pat – ván cờ hòa.' })),
      L('Tránh pat', 'wQ',
        MATE1('Chiếu hết trong 1 nước – cẩn thận đừng để Đen hết nước đi mà không bị chiếu (pat là hòa)!', 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1')),
      L('Các kiểu hòa', 'quiz',
        Q('Trường hợp nào là hòa?', ['Lặp lại cùng thế cờ 3 lần', 'Mất Hậu', 'Bị chiếu 3 lần'], 0),
        Q('Chỉ còn Vua + Mã đấu Vua. Kết quả?', ['Bên có Mã thắng', 'Hòa vì không đủ quân chiếu hết'], 1, { fen: '8/8/3k4/8/8/2N5/8/4K3 w - - 0 1' }),
        Q('Luật 50 nước: hòa khi nào?', ['50 nước liên tiếp không ăn quân và không đi Tốt', 'Ván dài quá 50 nước', 'Mỗi bên đã đi 50 nước'], 0)),
      REVIEW(),
    ],
  },
  {
    title: 'Chiếu và thoát chiếu', desc: 'Tấn công Vua và cách thoát', color: '#d65a4f', shade: '#a8413a',
    lessons: [
      L('Chiếu', 'wR',
        GOAL('check', 'Chiếu là tấn công Vua đối phương. Hãy chiếu Vua Đen bằng Xe.', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1')),
      L('Chiếu bằng Mã và Tượng', 'wN',
        GOAL('check', 'Chiếu Vua Đen bằng Mã.', '4k3/8/8/8/4N3/8/8/4K3 w - - 0 1'),
        GOAL('check', 'Giờ chiếu bằng Tượng.', '4k3/8/8/8/8/8/8/4KB2 w - - 0 1')),
      L('Chạy Vua', 'wK',
        Q('Bị chiếu thì có những cách thoát nào?', ['Chỉ chạy Vua', 'Chạy Vua, chặn đường chiếu, hoặc ăn quân đang chiếu', 'Bỏ lượt'], 1),
        LINE('Vua Trắng bị Xe chiếu. Hãy chạy Vua ra khỏi đường chiếu.', 'k3r3/8/8/8/8/8/3P1P2/4K3 w - - 0 1', ['e1d1|e1f1'])),
      L('Chặn đường chiếu', 'wB',
        LINE('Xe Đen chiếu theo hàng 1. Đưa Tượng về chặn đường chiếu!', '7k/8/8/8/8/4B3/6PP/1r5K w - - 0 1', ['e3c1|e3g1'])),
      L('Ăn quân đang chiếu', 'wP',
        LINE('Mã Đen đang chiếu. Đừng chạy Vua – hãy dùng Tốt ăn Mã!', '4k3/8/8/8/8/3n4/4P3/4K3 w - - 0 1', ['e2d3'])),
      L('Chiếu mở', 'wB',
        GOAL('check', 'Chiếu mở: đi một quân ra khỏi đường để quân phía sau chiếu. Đi Tượng để Xe chiếu Vua Đen!', '4k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1')),
      L('Chiếu đôi', 'wN',
        Q('Bị chiếu đôi (hai quân cùng chiếu), cách thoát duy nhất là?', ['Chặn đường chiếu', 'Ăn một quân', 'Chạy Vua'], 2),
        GOAL('dcheck', 'Đi Mã sao cho cả Mã và Xe cùng chiếu Vua Đen – chiếu đôi!', '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1')),
      REVIEW(),
    ],
  },
  {
    title: 'Chiếu hết 1 nước', desc: 'Các mẫu chiếu hết kinh điển', color: '#d4a72c', shade: '#a5801b',
    lessons: [
      L('Chiếu hết hàng cuối', 'wR',
        MATE1('Vua Đen bị chính các Tốt của mình chặn đường. Chiếu hết trong 1 nước!', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'),
        MATE1('Thêm một lần nữa.', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1')),
      L('Hậu và Vua', 'wQ',
        MATE1('Vua Trắng khóa các ô a7, b7. Dùng Hậu chiếu hết.', 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1'),
        MATE1('Vua Trắng giữ các ô trước mặt Vua Đen. Chiếu hết!', '4k3/8/4K3/8/8/8/8/7Q w - - 0 1')),
      L('Xe và Vua', 'wR',
        MATE1('Vua Trắng đứng đối diện Vua Đen. Xe chiếu hết!', '3k4/8/3K4/8/8/8/8/7R w - - 0 1'),
        MATE1('Vua Đen ở cạnh bàn. Hậu chiếu hết!', '7k/8/6K1/8/8/8/8/1Q6 w - - 0 1')),
      L('Hai Xe', 'wR',
        MATE1('Một Xe chặn hàng 7, Xe kia chiếu hết.', 'k7/7R/8/8/8/8/8/K5R1 w - - 0 1')),
      L('Chiếu hết Học giả', 'wQ',
        MATE1('Ô f7 chỉ có Vua bảo vệ. Đen vừa đi Mã f6 – một sai lầm. Chiếu hết!', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4')),
      L('Chiếu hết cầu vai', 'wQ',
        MATE1('Hai Xe Đen đứng hai bên chặn đường Vua của chính mình. Chiếu hết!', '3rkr2/8/8/8/8/8/Q7/6K1 w - - 0 1')),
      L('Mã chiếu ngạt', 'wN',
        MATE1('Vua Đen bị chính quân mình vây kín. Chỉ một quân chiếu hết được…', '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1'),
        MATE1('Mã và Xe phối hợp (chiếu hết kiểu Ả Rập).', '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1')),
      L('Hậu có hỗ trợ', 'wQ',
        MATE1('Hậu ăn Tốt h7 có Tượng bảo vệ.', '5rk1/5ppp/8/7Q/8/3B4/8/6K1 w - - 0 1'),
        MATE1('Lần này Mã bảo vệ Hậu.', '5rk1/5ppp/8/6N1/8/3Q4/8/6K1 w - - 0 1')),
      L('Tượng chiếu hết', 'wB',
        MATE1('Hai Tượng phối hợp: một Tượng khóa ô a7, Tượng kia chiếu.', 'k7/2K5/8/2B5/8/8/8/5B2 w - - 0 1'),
        MATE1('Tượng trên đường chéo dài bảo vệ Hậu.', '6k1/5p1p/6pQ/8/8/8/1B6/6K1 w - - 0 1')),
      L('Chiếu hết Anastasia', 'wN',
        MATE1('Mã khóa đường thoát, Xe chiếu hết trên cột h.', '8/4N1pk/8/3R4/8/8/8/6K1 w - - 0 1')),
      L('Chiếu hết bằng Tốt', 'wP',
        MATE1('Cả Tốt cũng chiếu hết được! Cẩn thận: ăn Tốt h7 sẽ thành pat.', '7k/5K1p/6P1/8/8/8/8/8 w - - 0 1'),
        MATE1('Phong cấp và chiếu hết cùng lúc.', '6k1/4Pppp/8/8/8/8/8/6K1 w - - 0 1')),
      REVIEW('Ôn tập chiếu hết', 5),
    ],
  },
  {
    title: 'Chiến thuật', desc: 'Chĩa, ghim, xiên và chiếu mở', color: '#4f74c4', shade: '#385594',
    lessons: [
      L('Đòn chĩa', 'wN',
        Q('Đòn chĩa (fork) là gì?', ['Một quân tấn công hai quân đối phương cùng lúc', 'Hai quân cùng tấn công một quân', 'Đổi quân ngang giá'], 0),
        LINE('Mã rất giỏi chĩa. Chiếu Vua và tấn công Hậu cùng lúc, rồi ăn Hậu.', 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', ['b5c7', 'e8d7', 'c7a8'])),
      L('Chĩa Vua và Hậu', 'wN',
        LINE('Tìm ô để Mã chiếu Vua và tấn công Hậu, rồi ăn Hậu!', '3q3k/6pp/8/4N3/8/8/5PPP/6K1 w - - 0 1', ['e5f7', 'h8g8', 'f7d8'])),
      L('Chĩa bằng Tốt', 'wP',
        LINE('Đẩy Tốt tấn công hai Mã cùng lúc, rồi ăn một con.', '4k3/8/8/2n1n3/8/3P4/8/4K3 w - - 0 1', ['d3d4', 'c5e6', 'd4e5'])),
      L('Chĩa bằng Hậu', 'wQ',
        LINE('Chiếu Vua và tấn công Tượng cùng lúc, rồi ăn Tượng.', '4k3/8/8/8/7b/8/8/2KQ4 w - - 0 1', ['d1a4', 'e8f7', 'a4h4']),
        LINE('Lần nữa: chiếu Vua và tấn công Xe a7.', '7k/rp6/8/8/8/8/8/3Q2K1 w - - 0 1', ['d1d4', 'h8g8', 'd4a7'])),
      L('Đòn ghim', 'wB',
        Q('Đòn ghim là gì?', ['Quân bị tấn công không đi được vì sẽ để lộ quân giá trị hơn phía sau', 'Hai quân đổi nhau', 'Chiếu liên tục'], 0),
        LINE('Mã Đen bị Tượng ghim vào Vua nên không đi được. Đẩy Tốt tấn công nó!', '4k3/8/2n5/1B6/3P4/8/8/4K3 w - - 0 1', ['d4d5', 'e8e7', 'd5c6'])),
      L('Ghim bằng Xe', 'wR',
        LINE('Xe ghim Mã vào Vua trên cột e. Tấn công Mã bằng Tốt!', '4k3/8/8/4n3/8/8/5P2/4R1K1 w - - 0 1', ['f2f4', 'e8d7', 'f4e5'])),
      L('Đòn xiên', 'wR',
        LINE('Đòn xiên: tấn công quân giá trị cao, nó tránh đi thì ăn quân phía sau. Chiếu Vua theo cột e, rồi ăn Hậu.', '7R/8/4k3/8/8/8/4q3/K7 w - - 0 1', ['h8e8', 'e6d5', 'e8e2']),
        LINE('Xiên bằng Tượng: chiếu Vua trên đường chéo, rồi ăn Hậu phía sau.', '6q1/8/4k3/8/8/8/8/5B1K w - - 0 1', ['f1c4', 'e6e7', 'c4g8'])),
      L('Chiếu mở thắng Hậu', 'wB',
        LINE('Tượng đang chặn đường Xe. Đi Tượng ăn Hậu – đồng thời Xe chiếu Vua!', '4k3/7q/8/8/4B3/8/8/4R1K1 w - - 0 1', ['e4h7'])),
      L('Ăn quân treo', 'wQ',
        Q('Quân "treo" là gì?', ['Quân bị tấn công mà không được bảo vệ', 'Quân bị ghim', 'Quân vừa phong cấp'], 0),
        LINE('Một quân Đen đang treo. Hãy ăn nó – đừng ăn quân có bảo vệ!', '6k1/5ppp/4p3/3n4/6b1/8/5PPP/3Q2K1 w - - 0 1', ['d1g4'])),
      L('Chĩa Mã thắng Xe', 'wN',
        LINE('Mã chiếu Vua và tấn công Xe cùng lúc.', '2r3k1/5ppp/8/3N4/8/8/5PPP/6K1 w - - 0 1', ['d5e7', 'g8f8', 'e7c8'])),
      REVIEW('Ôn tập chiến thuật', 5),
    ],
  },
  {
    title: 'Chiếu hết 2 nước', desc: 'Tính trước một nước', color: '#c4659c', shade: '#974b77',
    lessons: [
      L('Vua giúp Hậu', 'wQ',
        MATE(2, 'Đưa Vua lại gần trước, rồi Hậu chiếu hết. Chiếu hết trong 2 nước!', 'k7/8/8/2K5/8/8/8/1Q6 w - - 0 1')),
      L('Vua giúp Xe', 'wR',
        MATE(2, 'Dùng Vua chiếm thế đối diện, rồi Xe chiếu hết. Chiếu hết trong 2 nước!', 'k7/8/2K5/8/8/8/8/7R w - - 0 1')),
      L('Xe lăn', 'wR',
        MATE(2, 'Hai Xe thay nhau "lăn" Vua Đen. Chiếu hết trong 2 nước!', '7k/8/8/8/8/8/1R6/R5K1 w - - 0 1')),
      L('Chiếu ngạt Philidor', 'wN',
        MATE(2, 'Hy sinh Hậu để Đen tự chặn đường Vua, rồi Mã chiếu ngạt! Chiếu hết trong 2 nước.', '3r3k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1')),
      L('Anastasia 2 nước', 'wQ',
        MATE(2, 'Hy sinh Hậu trên h7, rồi Xe chiếu hết trên cột h.', '5r1k/4N1pp/8/7Q/6R1/8/5PPP/6K1 w - - 0 1')),
      L('Hy sinh trên hàng cuối', 'wR',
        MATE(2, 'Hy sinh để kéo Xe Đen ra, rồi chiếu hết hàng cuối. Chiếu hết trong 2 nước!', '3r2k1/5ppp/8/8/8/8/4QPPP/4R1K1 w - - 0 1')),
      L('Nước im lặng', 'wB',
        MATE(2, 'Không phải nước nào cũng là chiếu! Đặt Hậu vào vị trí đe dọa, Đen không cản được chiếu hết.', '5rk1/5p1p/5Bp1/8/8/8/3Q1PPP/6K1 w - - 0 1')),
      REVIEW('Ôn tập 2 nước', 4),
    ],
  },
  {
    title: 'Tàn cuộc', desc: 'Kết thúc ván cờ khi còn ít quân', color: '#a8804c', shade: '#7c5d35',
    lessons: [
      L('Vua trong tàn cuộc', 'quiz',
        Q('Trong tàn cuộc, Vua nên…', ['Trốn trong góc', 'Tiến lên giúp các quân khác', 'Không quan trọng'], 1),
        Q('Vua + Hậu đấu Vua thì kết quả thường là…', ['Hòa', 'Bên có Hậu thắng', 'Tuỳ may mắn'], 1)),
      L('Hậu chiếu hết Vua', 'wQ',
        WIN('Dồn Vua Đen về cạnh bàn rồi chiếu hết. Đừng để pat! Máy cầm Đen.', '8/8/8/4k3/8/8/8/4K2Q w - - 0 1', 25)),
      L('Xe chiếu hết Vua', 'wR',
        WIN('Xe cắt đường, Vua Trắng tiến lên hỗ trợ. Chiếu hết Vua Đen!', '8/8/8/3k4/8/8/8/R3K3 w - - 0 1', 35)),
      L('Hai Xe chiếu hết', 'wR',
        WIN('Dùng hai Xe "lăn" Vua Đen về cạnh bàn rồi chiếu hết.', '8/8/8/3k4/8/8/8/R3K2R w - - 0 1', 15)),
      L('Luật hình vuông', 'wP',
        Q('Tốt cách hàng phong cấp 4 ô. Vua Đen bắt kịp nếu…', ['Vua Đen ở trong "hình vuông" của Tốt', 'Vua Đen ở xa hơn 2 ô', 'Không bao giờ'], 0, { fen: '8/8/8/5k2/P7/8/8/7K w - - 0 1', marks: ['a4', 'e4', 'e8', 'a8'] }),
        RUN('Vua Đen ở ngoài hình vuông – đẩy Tốt ngay, đừng chần chừ!', '8/8/8/5k2/P7/8/8/7K w - - 0 1', 8)),
      L('Tốt có Vua hỗ trợ', 'wP',
        RUN('Vua Trắng đứng trước Tốt. Đi đúng thì Tốt sẽ phong cấp an toàn. Máy cầm Đen.', '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', 15)),
      L('Đột phá Tốt', 'wP',
        LINE('Ba Tốt đấu ba Tốt: một đòn đột phá tạo ra Tốt thông. Đi b5–b6!', '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1', ['b5b6', 'c7b6', 'a5a6', 'b7a6', 'c5c6'])),
      L('Đối Vua', 'wK',
        Q('Thế "đối Vua" là gì?', ['Hai Vua đối diện, cách 1 ô – bên phải đi thường bất lợi', 'Hai Vua đứng cạnh nhau', 'Vua đứng đối diện Hậu'], 0, { fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1' })),
      REVIEW('Ôn tập tàn cuộc', 4),
    ],
  },
  {
    title: 'Khai cuộc', desc: 'Bắt đầu ván cờ đúng cách', color: '#81b64c', shade: '#5d8a32',
    lessons: [
      L('Nguyên tắc khai cuộc', 'quiz',
        Q('Nguyên tắc khai cuộc nào ĐÚNG?', ['Đi Hậu ra thật sớm', 'Chiếm trung tâm, ra Mã và Tượng, nhập thành sớm', 'Đi nhiều Tốt cánh'], 1),
        Q('Vì sao không nên đưa Hậu ra quá sớm?', ['Hậu dễ bị quân nhỏ đuổi, mất nhịp ra quân', 'Hậu yếu', 'Luật cấm'], 0)),
      L('Chiếm trung tâm', 'wP',
        LINE('Mở đầu bằng một Tốt trung tâm: đi e4 hoặc d4.', START, ['e2e4|d2d4']),
        LINE('Ra Mã hướng vào trung tâm: Mã g1 lên f3.', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', ['g1f3'])),
      L('Ván cờ Ý', 'wB',
        LINE('Ván cờ Ý: e4, Mã f3, rồi Tượng c4 nhắm vào ô f7.', START, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'])),
      L('Ván Tây Ban Nha', 'wB',
        LINE('Ván Tây Ban Nha: e4, Mã f3, rồi Tượng b5 gây sức ép lên Mã c6.', START, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'])),
      L('Gambit Hậu', 'wP',
        LINE('Gambit Hậu: d4, rồi c4 thách Tốt d5 của Đen.', START, ['d2d4', 'd7d5', 'c2c4'])),
      L('Hệ thống London', 'wB',
        LINE('Hệ thống London: d4, Tượng f4 rồi e3 – dễ nhớ, chắc chắn.', START, ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'])),
      L('Phòng thủ Sicilia', 'bP',
        LINE('Bạn cầm Đen. Trắng đi e4, đáp lại bằng c5 – Phòng thủ Sicilia.', START, ['e2e4', 'c7c5', 'g1f3', 'd7d6'], { side: 'b' })),
      L('Phòng thủ Pháp', 'bP',
        LINE('Cầm Đen: đáp e4 bằng e6, rồi d5.', START, ['e2e4', 'e7e6', 'd2d4', 'd7d5'], { side: 'b' })),
      L('Phòng thủ Caro-Kann', 'bP',
        LINE('Cầm Đen: đáp e4 bằng c6, rồi d5.', START, ['e2e4', 'c7c6', 'd2d4', 'd7d5'], { side: 'b' })),
      L('Nhập thành sớm', 'wK',
        GOAL('castle', 'Đã ra Mã và Tượng – giờ nhập thành để Vua an toàn!', 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', { castle: 'K' })),
      L('Chặn bẫy Học giả', 'bP',
        LINE('Cầm Đen: Trắng đưa Hậu h5 nhắm f7. Hãy chặn mối đe dọa chiếu hết!', START, ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g7g6|d8e7|d8f6'], { side: 'b' })),
      L('Chiếu hết nhanh nhất', 'bQ',
        LINE('Cầm Đen: Trắng đi rất tệ (f3, g4). Chiếu hết chỉ trong 2 nước!', START, ['f2f3', 'e7e5', 'g2g4', 'd8h4'], { side: 'b' })),
      REVIEW('Ôn tập khai cuộc', 4),
    ],
  },
  {
    title: 'Nâng cao', desc: 'Thử thách cuối khoá', color: '#c94a3e', shade: '#97352c',
    lessons: [
      L('Hậu chiếu hết nhanh', 'wQ',
        WIN('Chiếu hết Vua Đen trong tối đa 10 nước!', '8/8/8/8/3k4/8/8/K6Q w - - 0 1', 10)),
      L('Xe chiếu hết nhanh', 'wR',
        WIN('Chiếu hết bằng Xe trong tối đa 25 nước!', '8/8/8/8/8/2k5/8/R3K3 w - - 0 1', 25)),
      // `from`: lấy thử thách từ các phần khác (số thứ tự phần, tính từ 0) hoặc 'all' = cả khoá
      { ...REVIEW('Tổng hợp chiến thuật', 6), from: [6, 7, 8] },
      { ...REVIEW('Bài kiểm tra cuối khoá', 8), from: 'all' },
    ],
  },
];
})();

// ---------------- Bộ giải nhỏ dùng cho gợi ý và kiểm tra bài ----------------

const LessonSolver = (() => {
  // Bên tới lượt chiếu hết được trong tối đa n nước không? Trả về nước đầu tiên hoặc null.
  function mateIn(g, n) {
    const moves = g.legalMoves();
    // Thử nước chiếu trước cho nhanh
    const scored = moves.map(m => { const u = g._apply(m); const c = g.inCheck(); g._undo(u); return [c ? 0 : 1, m]; });
    scored.sort((a, b) => a[0] - b[0]);
    for (const [, m] of scored) {
      const u = g._apply(m);
      const ok = forced(g, n - 1);
      g._undo(u);
      if (ok) return m;
    }
    return null;
  }

  // Bên tới lượt (bên bị tấn công) có bị chiếu hết trong tối đa n nước nữa của đối phương không
  function forced(g, n) {
    const replies = g.legalMoves();
    if (!replies.length) return g.inCheck();
    if (n <= 0) return false;
    for (const r of replies) {
      const u = g._apply(r);
      const ok = !!mateIn(g, n);
      g._undo(u);
      if (!ok) return false;
    }
    return true;
  }

  // Tìm đường ngắn nhất để quân Trắng đi tới hết các ô mục tiêu (quân Đen đứng yên).
  // Trả về danh sách nước đi hoặc null.
  function collect(g, targets, maxDepth = 14) {
    const side = g.turn;
    const t0 = [...targets].sort((a, b) => a - b);
    const start = { board: g.board.slice(), rem: t0, path: [] };
    const seen = new Set([start.board.join() + '|' + t0.join()]);
    let layer = [start];
    const saved = { board: g.board, turn: g.turn, ep: g.ep, castling: g.castling };
    try {
      for (let d = 0; d < maxDepth && layer.length; d++) {
        const next = [];
        for (const s of layer) {
          g.board = s.board.slice();
          g.turn = side;
          g.ep = -1;
          g.castling = { wK: false, wQ: false, bK: false, bQ: false };
          for (const m of g.legalMoves()) {
            const u = g._apply(m);
            const rem = s.rem.filter(x => x !== m.to);
            const path = s.path.concat([m]);
            g._undo(u);
            if (!rem.length) return path;
            const b = s.board.slice();
            b[m.to] = m.promotion ? side + m.promotion : m.piece;
            b[m.from] = null;
            const key = b.join() + '|' + rem.join();
            if (seen.has(key)) continue;
            seen.add(key);
            next.push({ board: b, rem, path });
          }
        }
        layer = next;
        if (seen.size > 200000) break;
      }
      return null;
    } finally {
      Object.assign(g, saved);
    }
  }

  return { mateIn, forced, collect };
})();

if (typeof module !== 'undefined') module.exports = { COURSE, LessonSolver };
