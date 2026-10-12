# ♞ Royal Gambit

Web chơi cờ vua viết bằng HTML, CSS và JavaScript thuần: không cần build. Thư viện duy nhất là [PeerJS](https://peerjs.com/), chỉ được tải khi bạn dùng chế độ Online.

## Tính năng

- Đủ luật cờ vua: nhập thành, bắt tốt qua đường, phong cấp (chọn Hậu/Xe/Tượng/Mã)
- Nhận biết chiếu, chiếu hết, hết nước đi (pat), luật 50 nước, lặp lại 3 lần, không đủ quân
- Chơi 2 người trên cùng máy, hoặc đấu với máy ở 3 mức độ (Dễ / Trung bình / Khó), có nút **Gợi ý** nước đi
- **Online**: bấm **Tìm trận** để tự ghép với người khác đang tìm trận, hoặc tạo phòng và gửi mã / link mời cho bạn bè; có chat, xin hòa, xin thua, chơi ván mới (đổi màu)
- **Contest**: tab **Contest** cạnh tab Online. Chỉ **admin** tạo được contest. Người chơi **đăng ký trước giờ bắt đầu**; đến giờ web **tự ghép cặp** những người đã đăng ký, ván xong tự ghép ván tiếp. Thắng +2 điểm, hòa +1, thua 0. Kết thúc contest, hạng 1 / 2 / 3 nhận **huy chương Vàng / Bạc / Đồng** hiện trong Hồ sơ và bảng xếp hạng
- **Học cờ kiểu Duolingo**: 106 bài trong 12 phần, từ làm quen bàn cờ tới chiếu hết 2 nước, tàn cuộc, khai cuộc và ván đấu với máy. Có lộ trình zig-zag, 3 tim mỗi bài, sao, XP, chuỗi ngày học, mục tiêu hằng ngày và bài kiểm tra **Nhảy cóc**
- Giao diện mới: quân cờ SVG, **kéo thả** hoặc bấm để đi, hiệu ứng trượt quân, âm thanh, chuột phải để đánh dấu ô, 5 màu bàn cờ
- Gợi ý các nước đi hợp lệ, tô sáng nước vừa đi và vua đang bị chiếu
- **Tài khoản**: phải đăng nhập hoặc đăng ký (tên đăng nhập + mật khẩu) mới vào chơi được; có ảnh đại diện, đăng xuất trong hộp Hồ sơ
- **Bảng xếp hạng toàn thế giới**: tab **Xếp hạng** cạnh tab Online, xếp theo exp rank, có thêm cột Elo
- **Admin**: tài khoản tên **ADMIN** (chủ web) có thêm tab **Admin** cạnh tab Online để cấp / thu hồi quyền admin cho người khác. Admin được dùng nút **Gợi ý** trong ván Online, và dùng Gợi ý vẫn được tính Elo và rank. Tên đăng nhập không được trùng nhau (không phân biệt hoa thường)
- **Rank kiểu Free Fire** (chỉ tính ván Online): thắng +15 exp, hòa +5 exp, thua -10 exp. Cứ 30 exp được 1 sao, đủ 3 sao thì lên rank tiếp theo: Đồng → Bạc → Vàng → Bạch Kim → Kim Cương → Cao Thủ → Thách Đấu. Ván Online dưới 4 nước không tính; rời ván giữa chừng bị tính thua
- **Elo kiểu chess.com** (hệ thống riêng, không ảnh hưởng rank): lần đầu đăng nhập phải chọn trình độ (ví dụ Expert = 1200 Elo). Cả ván Online lẫn ván đấu với máy đều tính Elo; thắng đối thủ mạnh hơn được nhiều hơn
- Biên bản ván đấu theo ký hiệu đại số (SAN), hiện quân đã ăn và chênh lệch lực lượng
- Đi lại, xoay bàn cờ, dùng tốt trên điện thoại

## Chạy thử

Mở file `index.html` bằng trình duyệt là chơi được.

Chế độ Online cần mạng Internet. Hai trình duyệt kết nối trực tiếp với nhau qua WebRTC; máy chủ công cộng miễn phí của PeerJS chỉ dùng để hai bên tìm thấy nhau. Link mời có dạng `…/index.html?room=MÃPHÒNG`, nên nên đăng trang lên GitHub Pages để gửi link cho bạn bè.

## Cấu trúc

| File | Nội dung |
|------|----------|
| `index.html` | Khung trang |
| `style.css` | Giao diện |
| `chess.js` | Engine luật cờ: sinh nước đi, kiểm tra chiếu, kết thúc ván |
| `ai.js` | AI: tìm kiếm negamax, cắt tỉa alpha-beta, đánh giá thế cờ |
| `lessons.js` | Nội dung 106 bài học và bộ giải nhỏ (gợi ý, kiểm tra bài) |
| `learn.js` | Chế độ học cờ kiểu Duolingo |
| `tools/check-lessons.js` | Kiểm tra mọi bài học giải được: `node tools/check-lessons.js` |
| `online.js` | Chế độ chơi online (PeerJS / WebRTC), gồm tìm trận tự động |
| `contest.js` | Contest: tạo (admin), đăng ký, cộng điểm, bảng điểm, huy chương |
| `profile.js` | Tài khoản, hồ sơ, rank (exp và sao), Elo, ảnh đại diện, bảng xếp hạng |
| `config.js` | Cấu hình Firebase cho tài khoản và bảng xếp hạng toàn thế giới |
| `firebase-rules.json` | Luật bảo mật dán vào Firebase |
| `sound.js` | Âm thanh nước đi (Web Audio) |
| `pieces/` | Bộ quân cờ SVG |
| `app.js` | Vẽ bàn cờ, xử lý thao tác, chuyển chế độ |

## Tìm trận tự động

Không cần máy chủ riêng. Mọi người bấm **Tìm trận** (tab Online) cùng tranh một "phòng chờ" có ID cố định trên PeerJS: ai giành được thì ngồi chờ, người đến sau thấy phòng chờ đã có người thì nối vào, thế là hai người được ghép và vào ván ngay (màu quân ngẫu nhiên). Ghép xong, người chờ nhả phòng chờ ra để cặp tiếp theo dùng, nên nhiều cặp có thể ghép liên tiếp.

- Ván ghép tự động tính **rank và Elo** như mọi ván Online khác.
- Tìm tối đa 3 phút; không có ai thì báo và bạn bấm tìm lại. Bấm **Hủy tìm trận** bất cứ lúc nào.
- Hiện tại ghép với **bất kỳ ai** đang tìm, chưa lọc theo Elo (cần máy chủ riêng mới lọc được chính xác).
- Hằng số `SEARCH_LIMIT` (thời gian tìm tối đa) và tên phòng chờ nằm đầu `online.js`.

## Contest

Tab **Contest** nằm cạnh tab Online.

- **Tạo contest: chỉ admin** (chủ web `ADMIN` hoặc tài khoản được cấp quyền admin). Nút "Tạo contest" chỉ hiện với admin; luật Firebase chặn ở máy chủ nên sửa code trình duyệt cũng không tạo được. Muốn chỉ chủ web mới tạo được thì đổi `Profile.isAdmin()` thành `Profile.isOwner()` trong `contest.js` và `app.js`, đồng thời bỏ vế `root.child('admins')...` trong mục `contests` của `firebase-rules.json`.
- Admin đặt tên, mô tả (tuỳ chọn), giờ bắt đầu và thời lượng (30 phút đến 7 ngày). Xóa contest cũng xóa luôn bảng điểm.
- **Đăng ký trước**: chỉ đăng ký (hoặc hủy đăng ký) được trước giờ bắt đầu. Contest đã bắt đầu thì đóng đăng ký. Admin phải đặt giờ bắt đầu ở tương lai để mọi người kịp đăng ký.
- **Tự ghép cặp**: đến giờ, ai đã đăng ký và đang mở web sẽ tự được chuyển sang Online và vào phòng chờ riêng của contest, ghép với người đã đăng ký khác. Ván xong, sau 8 giây web tự tìm ván tiếp theo cho tới hết giờ. Thanh thông báo dưới thanh trên cùng cho biết contest sắp / đang diễn ra, có nút **Tạm dừng** / **Tiếp tục thi đấu**.
- Không cắt ngang việc đang làm: đang chơi với máy hoặc đang làm bài học thì web đợi xong mới ghép. Bấm Hủy tìm trận, Rời phòng hoặc chuyển khỏi tab Online thì tạm dừng tự ghép.
- Trong contest không có "Chơi lại ván mới" với cùng đối thủ (chống hai người quen cày điểm cho nhau); mỗi ván mới đều ghép lại.
- Điểm contest: **thắng +2, hòa +1, thua 0**. Xếp hạng theo điểm, rồi số ván thắng, rồi ít ván hơn. Bằng cả ba thì cùng hạng.
- **Huy chương**: khi contest kết thúc hẳn (30 phút sau giờ kết thúc), hạng 1, 2, 3 nhận huy chương **Vàng, Bạc, Đồng** (phải chơi ít nhất 1 ván). Huy chương hiện trong hộp **Hồ sơ**, cạnh tên trên **bảng xếp hạng**, và web báo ngay khi bạn vừa giành huy chương. Không lọt top 3 thì không có huy chương.
- Ván contest vẫn tính **rank và Elo** như ván Online thường, và theo cùng luật: ván dưới 4 nước không tính điểm gì cả. Chỉ ván bắt đầu trong giờ contest mới được tính.
- Ván bắt đầu trước giờ kết thúc vẫn được tính tới 30 phút sau đó (hằng số `GRACE` trong `contest.js`, và con số `1800000` trong `firebase-rules.json`).
- Dữ liệu Firebase: `/contests/<id>` (chỉ admin ghi) và `/contestScores/<id>/<uid>` (mỗi người chỉ ghi dòng của mình, mỗi lần chỉ +1 ván và đúng số điểm). **Nếu bạn đã dán luật cũ thì phải dán lại toàn bộ `firebase-rules.json` mới rồi bấm Publish.**
- Mỗi người chỉ được ghi điểm cách nhau ít nhất 20 giây (luật Firebase kiểm tra bằng giờ máy chủ), chặn kiểu gửi điểm liên tục.
- Không có máy chủ riêng nên việc ghép chạy trên trình duyệt: người đã đăng ký phải **mở web** trong giờ contest thì mới được ghép.
- Chế độ cục bộ (chưa cấu hình Firebase): contest chỉ có trong trình duyệt này, nên chỉ hợp để chạy thử.
- Giống phần rank, điểm contest do trình duyệt gửi lên nên người rành kỹ thuật vẫn có thể gian lận dần; luật server chỉ chặn được kiểu cộng điểm khống.

## Học cờ

Tab **Học cờ** có lộ trình kiểu Duolingo: **12 phần, 106 bài**, đi từ cơ bản tới nâng cao: làm quen bàn cờ → cách đi từng quân → luật đặc biệt → chiếu và thoát chiếu → chiếu hết 1 nước → chiến thuật (chĩa đôi, ghim, xiên, chiếu đôi, phát hiện…) → chiếu hết 2 nước → tàn cuộc → khai cuộc → nâng cao (đấu với máy, bài kiểm tra cuối khoá).

- Mỗi bài có vài thử thách: trắc nghiệm, bấm vào ô, đi quân ăn sao, đi đúng chuỗi nước, giải thế cờ chiếu hết (máy chống đỡ), đấu với máy để chiếu hết hoặc phong cấp.
- Mỗi bài có **3 tim**, sai mất 1 tim, hết tim thì làm lại. Câu trắc nghiệm trả lời sai sẽ được hỏi lại ở cuối bài. Không sai và không dùng gợi ý thì được 3 sao.
- Bài mới +10 XP (+5 nếu 3 sao), ôn lại +5 XP. Mục tiêu hằng ngày 30 XP, học mỗi ngày để giữ chuỗi ngày học.
- Bài được mở lần lượt. Đã biết chơi thì bấm **Nhảy cóc** ở một phần đang khoá để làm bài kiểm tra 6 câu và mở khoá luôn phần đó.
- Tiến độ lưu trong trình duyệt theo từng tài khoản. Có thể dùng phím 1–4 để chọn đáp án và Enter để kiểm tra / tiếp tục.
- Thêm hoặc sửa bài trong `lessons.js` (đầu file có mô tả các loại thử thách), rồi chạy `node tools/check-lessons.js` để kiểm tra: thế cờ đúng luật, mọi ngôi sao ăn được, chuỗi nước hợp lệ, bài chiếu hết thật sự có lời giải đúng số nước.

## Hệ thống rank

Các hằng số (exp thắng/hòa/thua, exp mỗi sao, số sao mỗi rank, tên và màu rank) nằm ở đầu file `profile.js` nên dễ chỉnh. Nếu đổi exp thắng/hòa/thua thì nhớ sửa luôn `firebase-rules.json` (con số 15, 5, 10) cho khớp.

## Hệ thống Elo

Elo là hệ thống riêng, **không ảnh hưởng đến rank** ở trên (rank vẫn chỉ tính ván Online theo exp và sao). Công thức giống chess.com / FIDE:

```
Elo kỳ vọng  E = 1 / (1 + 10^((Elo đối thủ − Elo của bạn) / 400))
Elo mới        = Elo cũ + K × (kết quả − E)      (thắng 1, hòa 0.5, thua 0)
```

- **K** = 40 trong 20 ván Elo đầu, 24 khi Elo dưới 2000, 16 khi từ 2000 trở lên. Thắng luôn được ít nhất +1, thua luôn mất ít nhất −1. Elo thấp nhất là 100.
- **Elo khởi điểm**: lần đầu đăng nhập web hỏi bạn là ai: Người mới 400, Cơ bản 700, Trung cấp 1000, Expert 1200, Cao thủ 1500.
- **Elo của máy**: Dễ 800, Trung bình 1200, Khó 1600 (hằng số `BOT_ELO` trong `profile.js`; ô "Độ khó" trong `index.html` ghi cùng số này).
- **Ván Online**: đổi cả rank (exp) lẫn Elo, dùng Elo của đối thủ (hai bên gửi Elo cho nhau lúc vào phòng). **Ván đấu máy**: chỉ đổi Elo.
- **Không tính Elo** nếu: ván dưới 4 nước, 2 người cùng máy, hoặc ván đấu máy có dùng **Gợi ý** / **Đi lại**. Bỏ ván đấu máy giữa chừng (bấm Ván mới, đổi chế độ) bị tính thua.

Các hằng số Elo (K, Elo khởi điểm, các mức trình độ, Elo của máy) nằm ở đầu `profile.js`. Nếu đổi mức trình độ hay K lớn nhất thì sửa luôn `firebase-rules.json` (con số 400, 1500 và 40) cho khớp.

## Admin

- **ADMIN** là tên đăng nhập của chủ web (so sánh không phân biệt hoa thường). Chỉ tài khoản này thấy tab **Admin**, và chỉ tài khoản này cấp / thu hồi được quyền admin cho người khác.
- Người được cấp quyền là **admin**: có nút **Gợi ý** trong ván Online (hiện ở hàng nút dưới bàn cờ). Admin dùng Gợi ý vẫn được tính Elo và rank, cả ở ván Online lẫn ván đấu máy. **Đi lại** khi đấu máy thì vẫn làm ván đó không tính Elo như bình thường. Admin mới được cấp quyền chỉ cần vào lại tab Online (hoặc tải lại trang) là thấy nút.
- **Hãy tự đăng ký tài khoản `ADMIN` trước khi gửi link web cho ai**, vì ai đăng ký tên này trước sẽ là chủ web. Tên bắt đầu bằng `admin` (ví dụ `admin2`, `Admin_VN`) bị chặn với mọi người khác để không ai mạo danh.
- Tên đăng nhập luôn duy nhất: `ADMIN`, `Admin` và `admin` là cùng một tên.
- Chế độ Firebase: quyền admin lưu ở `/admins/<uid>`, luật server chỉ cho tài khoản có email `admin@rg-user.app` đọc cả danh sách và ghi vào đó, nên không ai tự cấp quyền cho mình được. **Nếu bạn đã dán luật cũ thì phải dán lại toàn bộ `firebase-rules.json` mới rồi bấm Publish.** Nếu đổi tên chủ web (hằng số `OWNER` trong `profile.js`) thì sửa luôn email `admin@rg-user.app` trong `firebase-rules.json` cho khớp.
- Nút Gợi ý của admin chạy ngay trên máy admin, server không chặn được ai sửa code để tự bật nút này; đây cũng là giới hạn chung của cả hệ thống điểm (xem phần bên dưới).

## Tài khoản và bảng xếp hạng toàn thế giới

Web có 2 chế độ, tự chọn theo `config.js`:

- **Chế độ cục bộ** (mặc định, `config.js` để trống): tài khoản, rank và bảng xếp hạng chỉ có trong trình duyệt này. Dùng để chạy thử.
- **Toàn thế giới**: mọi người đăng ký trên web của bạn dùng chung một bảng xếp hạng. Cần cấu hình Firebase một lần (miễn phí, khoảng 5 phút):

1. Vào <https://console.firebase.google.com>, tạo project mới.
2. **Build → Authentication → Get started → Sign-in method**: bật **Email/Password** (chỉ cần bật mục đầu, không cần bật "Email link").
3. **Build → Realtime Database → Create database** (chọn khu vực Singapore), rồi sang tab **Rules**, dán toàn bộ nội dung file `firebase-rules.json` và bấm **Publish**. (Tài khoản và exp rank đã có vẫn giữ nguyên, người chơi cũ chỉ cần chọn trình độ một lần để có Elo. Luật này đã gồm cả phần Contest.)
4. **Project settings → General**: tạo một Web app nếu chưa có, chép **Web API Key**; chép địa chỉ database ở trang Realtime Database.
5. Điền 2 giá trị đó vào `config.js`, rồi đăng web lên mạng (mục dưới).

Cách hoạt động: tên đăng nhập được đổi thành email giả `tên@rg-user.app` để dùng đăng nhập email/mật khẩu của Firebase, nên **không có chức năng quên mật khẩu**. Luật server chặn tạo điểm khống: tài khoản mới bắt đầu từ 0 exp và 800 Elo, chỉ được chọn trình độ một lần (400–1500), mỗi ván chỉ được +15 / +5 / −10 exp, Elo mỗi ván đổi tối đa 40, hai ván cách nhau ít nhất 10 giây, và mỗi người chỉ sửa được dữ liệu của chính mình. Tuy vậy điểm vẫn do trình duyệt tự gửi lên, nên người rành kỹ thuật vẫn có thể gian lận dần; đây là bảng xếp hạng cho vui, không phải giải đấu.

## Đăng lên GitHub Pages

1. Đẩy code lên một repository GitHub.
2. Vào **Settings → Pages**.
3. Ở mục **Source** chọn **Deploy from a branch**, branch `main`, thư mục `/ (root)`, rồi bấm **Save**.
4. Sau khoảng 1 phút, trang có địa chỉ `https://<tên-tài-khoản>.github.io/<tên-repo>/`.

## Bản quyền

Bộ quân cờ `pieces/` là bộ *cburnett* của Colin M.L. Burnett, phát hành theo giấy phép GPLv2+ (lấy từ [lichess-org/lila](https://github.com/lichess-org/lila)).
