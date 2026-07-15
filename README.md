# Warehouse Suite

Hệ thống quản lý kho đa ngành, ưu tiên web/PWA. Repo hiện có nền tảng xác thực phiên, đổi mật khẩu tạm, phân quyền theo kho, quản lý người dùng/role và audit; các lát cắt tồn kho, nhập/xuất và truy xuất đang được triển khai theo [kế hoạch](tasks/plan.md).

## Stack

- Backend: Node.js, TypeScript strict, Hono, Zod, PostgreSQL và SQL migration cộng dồn.
- Frontend: React 19, Vite 6, Tailwind CSS 4, React Router và Vitest/Testing Library.
- Bảo mật: mật khẩu `scrypt`, session cookie `httpOnly`/`sameSite`, RBAC theo permission code và warehouse scope.

## Yêu cầu

- Node.js 20+ và npm.
- PostgreSQL có extension `pgcrypto`.
- Hai cổng local mặc định còn trống: API `4000`, web `5173`.

## Khởi động nhanh

```powershell
git clone https://github.com/thc0309/pm-quanlykho.git
cd pm-quanlykho
npm install --prefix backend
npm install --prefix frontend
Copy-Item backend/.env.example backend/.env
```

Sửa `backend/.env` theo PostgreSQL local. Không dùng các giá trị mẫu cho production:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://postgres:<password>@localhost:5433/warehouse_suite
SESSION_SECRET=<chuoi-ngau-nhien-toi-thieu-32-ky-tu>
MASTER_EMAIL=master@example.com
MASTER_PASSWORD=<mat-khau-tam-toi-thieu-12-ky-tu>
WAREHOUSE_ADMIN_EMAIL=admin@example.com
WAREHOUSE_ADMIN_PASSWORD=<mat-khau-tam-toi-thieu-12-ky-tu>
```

Tạo database nếu chưa có, sau đó chạy migration và seed:

```powershell
psql -h localhost -p 5433 -U postgres -d postgres -f backend/db/create-database.sql
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

Seed tạo kho `MAIN`, master admin và—khi khai báo đủ hai biến tương ứng—warehouse admin. Mật khẩu tạm chỉ lấy từ biến môi trường, được lưu dạng hash và phải đổi sau lần đăng nhập đầu tiên.

Chạy hai tiến trình phát triển:

```powershell
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

- Web: <http://127.0.0.1:5173>
- API health: <http://127.0.0.1:4000/health>

Vite proxy `/api` sang API local tại cổng `4000`, nên frontend không cần `VITE_API_URL` trong cấu hình mặc định.

## Lệnh thường dùng

| Lệnh tại thư mục gốc | Mục đích |
|---|---|
| `npm run dev:backend` | Chạy Hono API với reload |
| `npm run dev:frontend` | Chạy Vite dev server |
| `npm test` | Refresh bộ nhớ công việc rồi chạy toàn bộ backend/frontend test |
| `npm run lint` | Type-check backend và lint frontend |
| `npm run build` | Kiểm tra TypeScript và build frontend production |
| `npm run memory:update` | Đồng bộ bộ nhớ ngắn hạn/dài hạn từ task evidence |
| `npm run memory:check` | Báo lỗi nếu bộ nhớ công việc đã cũ |

Lệnh database:

```powershell
npm run db:migrate --prefix backend
npm run db:seed --prefix backend
```

## Kiến trúc

```text
backend/
├── db/migrations/       # SQL migration bất biến, chạy theo thứ tự tên file
├── src/http/            # Error envelope, validation, pagination, request ID
├── src/modules/         # Auth, access control và business routes
└── test/                # Node test cho contract/API/security

frontend/
├── src/features/        # UI theo lát cắt nghiệp vụ và component test
├── src/lib/api.ts       # Client HTTP có kiểu
└── src/App.tsx          # Session bootstrap, navigation và route guards

tasks/
├── todo.md              # Checklist nguồn sự thật
├── plan.md              # Acceptance, dependency và evidence
└── memory/              # Tóm tắt tự sinh để tiếp tục giữa các phiên
```

API là lớp bảo mật có thẩm quyền; việc ẩn menu trên UI chỉ hỗ trợ trải nghiệm. Người dùng kho không được truy cập dữ liệu kho khác. Master admin phải chọn warehouse hợp lệ cho thao tác có scope.

## Trạng thái

Đã hoàn tất và kiểm thử:

- HTTP contract ổn định, validation và pagination có giới hạn.
- Login/logout, session revoke/expiry, rate limit và đổi mật khẩu tạm.
- Permission theo kho, audit thay đổi và chống truy cập xuyên kho.
- Quản lý người dùng, role, permission, gán role và vị trí kho qua API/UI.
- Test hiện tại: 20 backend + 8 frontend; build production và lint không có lỗi.

Task đang làm và hàng đợi kế tiếp luôn nằm trong [short-term memory](tasks/memory/short-term.md); bằng chứng đã xác minh nằm trong [long-term memory](tasks/memory/long-term.md). Phạm vi đầy đủ và quy tắc tồn kho xem tại [SPEC.md](SPEC.md).

## Quy tắc an toàn

- Không commit `.env`, token, mật khẩu thật hoặc database dump.
- Production phải dùng `NODE_ENV=production`, HTTPS và `SESSION_SECRET` ngẫu nhiên riêng.
- Chạy `npm test`, `npm run lint` và `npm run build` trước khi đẩy thay đổi.
- Không sửa migration đã áp dụng; thêm migration mới theo số thứ tự.
