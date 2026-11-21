# ProjectWorkspace

[![CI](https://github.com/kiettng/ProjectWorkspace/actions/workflows/ci.yml/badge.svg)](https://github.com/kiettng/ProjectWorkspace/actions/workflows/ci.yml)

Mã nguồn Project Dossier — ứng dụng web cá nhân quản lý dự án, biểu mẫu Word và hồ sơ triển khai.

Ứng dụng nằm trong [`project-dossier/`](project-dossier/). Xem [hướng dẫn chạy, cấu hình Supabase và triển khai](project-dossier/README.md).

## Công nghệ

Next.js, React, TypeScript, Supabase Auth/PostgreSQL/Storage, Docxtemplater và Mammoth.

## Bắt đầu

```sh
cd project-dossier
pnpm install --frozen-lockfile
cp .env.example .env.local
# Điền cấu hình Supabase và email chủ sở hữu vào .env.local.
pnpm dev
```

Yêu cầu Node.js 24 và pnpm 11.25.0. Trên Windows có thể dùng `Copy-Item .env.example .env.local`.

## Dữ liệu riêng tư

Repository chỉ chứa mã nguồn, cấu hình mẫu, metadata biểu mẫu và hướng dẫn. File môi trường thực tế, template Word, hồ sơ, tài liệu tham chiếu và dữ liệu tạm không được đưa lên GitHub.

Các mẫu Word cần được khôi phục từ bản sao riêng hoặc chuẩn bị từ nguồn bạn có quyền sử dụng theo [hướng dẫn biểu mẫu](project-dossier/README.md#mẫu-word). File gốc và bản web đang triển khai được quản lý riêng với repository này.

## CI/CD

- GitHub Actions kiểm tra TypeScript, chạy test và build khi push hoặc tạo pull request vào `main`.
- Vercel theo dõi nhánh `main`, chạy `pnpm verify` trong `project-dossier/` và chỉ phát hành nếu toàn bộ kiểm tra trong build thành công.
- Bộ Word được lưu trong Supabase Storage private, được ứng dụng đọc sau khi xác thực; không có trong GitHub, log CI hay bản build.
- CI không giữ khóa Supabase/Vercel. Các bài test độc lập chạy với dữ liệu giả lập; các bài cần Word riêng được chạy trong môi trường có bộ mẫu.

Xem [workflow CI](.github/workflows/ci.yml) và [hướng dẫn triển khai](project-dossier/README.md#cicd).
