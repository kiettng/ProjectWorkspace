# Project Dossier

Ứng dụng web cá nhân quản lý dự án và hồ sơ triển khai. Giao diện phát triển từ prototype được cung cấp; dữ liệu thật lưu trên Supabase PostgreSQL và Storage riêng tư.

Bản online: https://project-dossier-kiettuannguyenttnn-3204.vercel.app. Chọn “Lần đầu sử dụng? Kích hoạt tài khoản” để tự tạo mật khẩu cho địa chỉ email chủ sở hữu đã cấu hình. Xác nhận email rồi đăng nhập bằng chính trình duyệt đó; sau đó có thể đăng nhập từ thiết bị khác. Vercel Authentication hiện cũng bảo vệ bản hosting và có thể yêu cầu đăng nhập Vercel.

## Công nghệ

Next.js 16, React, TypeScript, Supabase Auth/PostgreSQL/Storage, Docxtemplater và Mammoth. API chạy bằng Node.js; không cần một backend NestJS riêng cho bản cá nhân.

## Chạy trên máy

Yêu cầu Node.js 24 và pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Điền URL Supabase, publishable key và OWNER_EMAIL vào .env.local.
pnpm dev
```

Mở http://127.0.0.1:3000. Trên Windows dùng `Copy-Item .env.example .env.local` thay cho `cp` nếu cần. File `.env.local` đã được bỏ qua khi quản lý mã nguồn.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

## Chức năng

- Wizard tạo dự án trong một transaction, giữ snapshot bộ quy trình, tạo 15 thư mục và 6 giai đoạn.
- Quản lý thông tin dự án, phân hệ, tích hợp, hợp đồng chính/phụ lục, nhân sự.
- Kho 14 mẫu Word Việt/Anh, thêm mẫu và phiên bản mới, từ điển biến.
- Sinh DOCX bằng mẫu thật, xử lý biến bị chia giữa nhiều XML runs, chặn thiếu dữ liệu, lưu snapshot.
- Upload trực tiếp vào kho Storage riêng tư, kiểm tra định dạng/nội dung/kích thước, checksum, lịch sử phiên bản.
- Xem trực tiếp PDF/ảnh, xem nội dung văn bản DOCX/DOTX/TXT/CSV, tải các định dạng còn lại.
- Công việc theo giai đoạn, chặn hoàn thành nếu thiếu hồ sơ hợp lệ.
- Báo cáo CSV, kiểm tra hồ sơ bàn giao và xuất ZIP có manifest/checksum.
- Nhật ký thao tác và xuất metadata JSON.

## Mẫu Word

Các file Word trong `templates/` là tài sản riêng và **không được commit lên repository công khai**. Danh mục kỹ thuật, checksum và danh sách biến nằm trong `templates/catalog.json`; metadata này không chứa nội dung Word.

Với môi trường đang có dữ liệu, khôi phục đúng các file Word từ bản sao riêng vào `templates/` để khớp checksum và storage key đã lưu trong database. Với một dự án mới, đặt bộ mẫu được phép sử dụng trong `../Template Warehouse`, chạy `pnpm templates:prepare`, rồi dùng catalog/SQL được tạo mới để khởi tạo kho mẫu. Không đưa thư mục nguồn hoặc file Word kết quả vào Git.

Các kiểm thử cần file Word riêng sẽ được đánh dấu skipped trên bản clone chưa có các file này. Các kiểm thử độc lập vẫn chạy; khôi phục đủ bộ mẫu để chạy toàn bộ 21 bài kiểm thử.

Những trường còn trống và nội dung nghiệp vụ mẫu vẫn cần được rà soát trong Word. Xem trước DOCX là bản xem nội dung, không phải bản render bố cục Word. Chuyển Office thành PDF và chỉnh sửa Office trực tuyến chưa được triển khai.

Không chạy lại bước chuẩn hóa trên môi trường đang dùng mà không tạo phiên bản template mới và cập nhật metadata tương ứng. Tệp đã lưu không tự thay đổi theo dữ liệu dự án hay mẫu mới.

## Tài khoản và quyền

- Một tài khoản chủ sở hữu, kiểm tra tại API và bằng RLS trong database.
- Trigger trên Auth chặn đăng ký email khác với địa chỉ đã được cấp quyền. Sau khi tài khoản đầu tiên được tạo, các đăng ký mới đều bị chặn.
- Chủ sở hữu tự tạo mật khẩu tại trang kích hoạt. Không có mật khẩu mặc định.
- Trong Supabase Authentication → URL Configuration, đặt Site URL thành URL ứng dụng và thêm `<URL ứng dụng>/auth/callback` vào Redirect URLs; thêm `http://127.0.0.1:3000/auth/callback` khi phát triển local.
- Khi kích hoạt, mở email xác nhận bằng cùng trình duyệt đã dùng để kích hoạt tài khoản (luồng PKCE). Sau đó đăng nhập từ các thiết bị khác bằng email/mật khẩu.
- Không đặt secret/service-role key trong biến `NEXT_PUBLIC_*`. Ứng dụng chỉ dùng publishable key; kiểm tra quyền và RLS giới hạn dữ liệu.

## Database

`supabase/schema.sql` là schema khởi tạo cho database mới. Thay địa chỉ minh họa `owner@example.com` bằng email của bạn trước khi áp dụng. `supabase/template-catalog.sql` tạo danh mục 14 mẫu. Các migration đã áp dụng trên project hiện tại được quản lý trong lịch sử Supabase; không chạy lại schema khởi tạo trên database đã có dữ liệu.

`supabase/english-template-v2.sql` là migration lịch sử bổ sung phiên bản 2 cho ba mẫu tiếng Anh. Chỉ áp dụng khi giữ nguyên danh mục và bộ mẫu tương ứng từ bản sao riêng. Bước `templates:prepare` cho dự án mới đã có cách gắn biến được sửa và không cần áp dụng lại migration lịch sử này.

`tests/database.sql` kiểm tra tạo dự án, hợp đồng chính, ràng buộc hồ sơ, idempotency, snapshot bất biến, vòng lặp thư mục và RLS. Các dữ liệu kiểm thử được rollback, bao gồm tài khoản Auth tạm nếu cần.

## Giới hạn của bản hiện tại

- Upload tối đa 20 MB/tệp; bộ hồ sơ ZIP tối đa 19 MB tổng dung lượng đầu vào.
- Trình xem Word chỉ hiển thị văn bản. Cần mở bản tải xuống để rà soát bố cục cuối cùng.
- Chưa tích hợp quét virus, chữ ký số, email thông báo nghiệp vụ, Office editor, Gantt hay AI.
- Supabase hiện cảnh báo tùy chọn kiểm tra mật khẩu bị lộ chưa bật. Tham khảo https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
- Xóa bản nháp là soft-delete. Khôi phục hiện thực hiện tại database; chưa có giao diện thùng rác.
- Xuất metadata JSON không bao gồm nội dung tệp. Cần sao lưu cả database và các đối tượng Storage.

## Triển khai

Vercel: framework Next.js, Node.js 24, install `pnpm install --frozen-lockfile`, build `pnpm build`. Khai báo ba biến từ `.env.example` (OWNER_USER_ID là tùy chọn để khóa thêm theo UUID). Mẫu Word được đóng gói cùng API phía máy chủ; không nằm trong thư mục public.

Trước khi dùng hồ sơ thật: kiểm tra đăng nhập và đồng bộ giữa hai thiết bị, rà soát một DOCX được sinh từ mỗi loại mẫu, và thiết lập quy trình sao lưu database cùng Storage.
