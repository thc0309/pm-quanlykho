# Spec: Hệ thống quản lý kho đa ngành

Status: draft v4 — đã chốt user metadata, avatar, granular permission và metadata CRUD; chờ duyệt task chi tiết trước khi build

## Objective

Xây dựng lại hệ thống quản lý kho web-first bằng TypeScript toàn bộ, không dùng Strapi. Backend chuyển sang Node.js + TypeScript để kiểm soát nghiệp vụ kho, phân quyền, giao dịch tồn kho và API contract rõ ràng hơn. Frontend dùng template tại `admin_template/` làm nền giao diện, nhưng phải loại bỏ dữ liệu demo/TailAdmin residue và thay bằng màn hình nghiệp vụ kho.

Người dùng chính:

- Master admin: tạo kho, tạo warehouse admin ban đầu, quản lý toàn hệ thống.
- Warehouse admin: quản lý người dùng, role, permission và dữ liệu trong kho của mình.
- Nhân viên soạn hàng: nhận phiếu, đến đúng vị trí/kệ, quét và xác nhận hàng đã soạn.
- Nhân viên kiểm/xuất: kiểm độc lập hàng đã soạn, xử lý sai lệch và xác nhận xuất kho.
- Nhân viên kho/bán hàng/mua hàng khác: thao tác danh mục, sản phẩm, đối tác, nhập/trả/kiểm kê/chuyển kho, in và quét barcode theo quyền.

## Architecture Decision

### Backend framework recommendation

Khuyến nghị dùng **Hono + TypeScript** cho backend.

Lý do: Hono gọn, ít boilerplate, chạy tốt trên Node.js/Bun/edge, dễ viết API thuần và không ép kiến trúc. So với Elysia, Hono ít phụ thuộc Bun hơn và hợp yêu cầu “chỉ cần API” hơn.

Các lựa chọn hợp lệ:

1. **Hono** — recommended. Gọn, API-first, runtime linh hoạt, ít framework magic.
2. **Fastify** — fallback nếu cần hệ sinh thái Node.js server truyền thống nhiều plugin hơn.
3. **Elysia** — tốt nếu chọn Bun-first và muốn type inference framework mạnh hơn.
4. **NestJS** — chỉ chọn nếu muốn kiến trúc enterprise/decorator/module mạnh ngay từ đầu; đổi lại nhiều boilerplate.
5. **Express** — chỉ dùng nếu đội đã quen; mặc định không chọn vì validation/type story yếu hơn Hono/Fastify.

Quyết định đã chốt: **Hono + Node.js + PostgreSQL local + SQL trực tiếp**. Không dùng Prisma/ORM. Dùng **Zod** cho request/env validation.

### Frontend template decision

Frontend dùng `admin_template/` làm nền layout/UI:

- Giữ: layout sidebar/header, component form/table/modal/button cơ bản, Tailwind setup, Vite, React.
- Bỏ/sửa: trang demo TailAdmin, fake user, console logs, route demo, metadata TailAdmin, auth demo không hoạt động.
- Tích hợp: route nghiệp vụ kho, permission-based navigation, API client typed, trạng thái loading/error/empty, tiếng Việt UI.

## Tech Stack

- Language: TypeScript toàn bộ cho frontend, backend, tests và shared contracts.
- Frontend: React + Vite + TypeScript + Tailwind CSS, khởi nguồn từ `admin_template/`.
- Backend: Node.js runtime + Hono + TypeScript.
- Database: PostgreSQL local.
- Database access: SQL trực tiếp qua PostgreSQL driver/pool. Không dùng Prisma/ORM.
- Migration: file SQL versioned trong repo, chạy bằng script tối thiểu.
- Validation: Zod cho request/response boundary và env config.
- Auth: cookie session `httpOnly`, `secure`, `sameSite`; password hash bằng Argon2 hoặc bcrypt.
- Tests: test TypeScript tối thiểu cho domain/backend; frontend component test được thêm khi bắt đầu có màn hình nghiệp vụ. Backend integration test chạy với test database riêng.
- PWA/Desktop: web/PWA trước; Tauri giữ cho giai đoạn desktop/Windows printing sau khi web workflow ổn.
- Email: provider giao dịch sẽ chọn sau; backend tự quản lý email reset/temporary password, không qua Strapi.

## Current Reality

- `server/`, frontend cũ ở root và dữ liệu Strapi đã được xóa; không có migration dữ liệu Strapi.
- `frontend/` đã được tạo từ `admin_template/`; `admin_template/` chỉ còn là bản tham chiếu và chưa được quyết định xóa.
- `backend/` đã có Hono, PostgreSQL pool, Zod env validation, migration/seed SQL và endpoint `/health`; chưa có auth hay API nghiệp vụ kho.
- PostgreSQL local `warehouse_suite` đã được tạo tại `localhost:5433`; migration đầu có 16 bảng nền tảng và seed kho `MAIN`.
- Schema hiện tại chỉ có trạng thái chứng từ `draft/confirmed/cancelled/reversed`; chưa có vị trí/kệ, reservation, phiên soạn, phiên kiểm hoặc luồng hai người.
- Backend build và health contract đã chạy được. Frontend còn lỗi lint của template và build chưa có bằng chứng pass trong môi trường hiện tại.
- Backend test hiện là file `.mjs` tối thiểu; phải chuyển sang TypeScript khi bắt đầu test nghiệp vụ để đáp ứng yêu cầu TypeScript toàn bộ.

## Commands

Các lệnh hiện có:

```text
Frontend dev:    npm run dev:frontend
Backend dev:     npm run dev:backend
Root build:      npm run build
Root lint:       npm run lint
Root test:       npm test

Frontend build:  npm run build --prefix frontend
Frontend lint:   npm run lint --prefix frontend
Frontend test:   chưa có script; thêm khi có logic nghiệp vụ đầu tiên

Backend build:   npm run build --prefix backend
Backend test:    npm test --prefix backend
Backend migrate: npm run db:migrate --prefix backend
Backend seed:    npm run db:seed --prefix backend
Create database: psql -h localhost -p 5433 -U postgres -d postgres -f backend/db/create-database.sql
```

Frontend và backend chạy dev ở hai terminal riêng; chưa cần thêm dependency để chạy đồng thời.

## Project Structure

```text
admin_template/          Template tham chiếu; không chứa logic nghiệp vụ
frontend/                React/Vite app chính, đã sao chép từ admin_template
backend/                 Hono/Node.js backend TypeScript
backend/db/migrations/   SQL migrations versioned
backend/db/seeds/        SQL seed scripts
backend/src/db/          PostgreSQL pool, migration và seed runner
backend/src/domain/      Domain rules sẽ thêm khi có nghiệp vụ đầu tiên
backend/src/modules/     Route/service theo domain sẽ thêm theo từng task
frontend/src/            UI nghiệp vụ, routes, API client, permission navigation
frontend/src/features/   Feature slices: auth, catalog, products, partners, stock, reports
tasks/                   Plan, test plan, verification evidence
```

Ponytail rule: chỉ tạo hai thư mục `frontend/` và `backend/`. Không tạo monorepo `apps/`/`packages/` cho tới khi có nhu cầu thật.

Frontend component rule: component đặc thù của một feature đặt trong `frontend/src/features/<feature>/components/`; component dùng chung từ hai feature trở lên mới đặt trong `frontend/src/components/`.

## Form Required Field Rule

- Tất cả trường bắt buộc phải hiển thị dấu `(*)` ngay trong label tiếng Việt.
- Trường được xem là bắt buộc nếu HTML input/select/textarea có `required`, backend schema yêu cầu giá trị, hoặc trường chỉ bắt buộc theo điều kiện đang hiển thị trong form.
- Trường không bắt buộc không được hiển thị `(*)`.
- Dấu `(*)` phải nằm trong text label để người dùng bàn phím và screen reader nhận biết được; không chỉ dùng màu hoặc placeholder.
- Validation message phải dùng tiếng Việt và chỉ giữ tiếng Anh cho thuật ngữ đặc thù như `SKU`, `barcode`, `API`, `FEFO`.

## Multi-Line Document Form Rule

### Objective

Các form tạo hoặc sửa chứng từ nghiệp vụ phải cho nhập nhiều sản phẩm/dòng hàng trong cùng một chứng từ, thay vì chỉ nhập một sản phẩm rồi gửi `lines` một phần tử. Người dùng chính là nhân viên mua hàng, bán hàng, kho và quản trị kho khi lập đơn mua, phiếu nhập, phiếu xuất, trả hàng, chuyển kho, báo giá và đơn bán.

### Current Reality

- Backend cho nhiều endpoint đã nhận `lines[]` tối đa 200 dòng: đơn mua, phiếu nhập, phiếu xuất, báo giá/đơn bán, trả hàng, chuyển kho và điều chỉnh tồn.
- Frontend hiện nhiều form chỉ hiển thị một dòng hàng: đơn mua, phiếu nhập, phiếu xuất, báo giá/đơn bán, trả hàng và chuyển kho.

### Required Behavior

- Mọi form chứng từ có `lines[]` phải có bảng hoặc danh sách dòng hàng.
- Người dùng thêm được nhiều dòng bằng nút `Thêm dòng`.
- Người dùng xóa được từng dòng trước khi lưu bằng nút `Xóa dòng`; không cho xóa dòng cuối cùng nếu form cần ít nhất một dòng.
- Mỗi dòng tự validate các trường bắt buộc và hiển thị dấu `(*)` theo `Form Required Field Rule`.
- Dữ liệu gửi API phải là toàn bộ `lines[]`, không chỉ dòng đang chọn.
- Khi sản phẩm có tracking theo lô, serial hoặc hạn dùng, các trường điều kiện phải nằm trên đúng dòng hàng đó.
- Với báo giá/đơn bán, mỗi dòng có sản phẩm, số lượng, đơn giá, thuế và phần tổng tiền hiển thị để người dùng kiểm tra trước khi lưu.
- Với trả hàng, mỗi dòng phải gắn với movement/chứng từ gốc tương ứng và số lượng trả.
- Với chuyển kho, mỗi dòng phải gắn với tồn nguồn và số lượng chuyển.
- Với form sửa, chỉ cho sửa dòng khi chứng từ còn ở trạng thái nháp hoặc trạng thái nghiệp vụ cho phép; chứng từ đã xác nhận/xuất/đóng phải chỉ đọc hoặc yêu cầu chứng từ điều chỉnh riêng.

### Scope

- Áp dụng cho: đơn mua, phiếu nhập, phiếu xuất, báo giá, đơn bán, trả hàng, chuyển kho, kiểm kê/điều chỉnh tồn nếu có nhập dòng thủ công.
- Không áp dụng cho thao tác quét soạn/kiểm theo từng lần scan; các màn hình scan vẫn xử lý từng lần quét.

### Testing Strategy

- Component test cho từng form chính: thêm dòng, xóa dòng, không xóa dòng cuối, submit nhiều dòng đúng payload.
- Backend test giữ giới hạn `lines[].min(1).max(200)` và reject dòng không hợp lệ.
- Browser smoke test ít nhất cho đơn mua và trả hàng với hai dòng sản phẩm.

### Boundaries

- Always: giữ giới hạn dòng từ backend, không thêm dependency bảng/form mới nếu component hiện có đủ dùng.
- Ask first: thay đổi schema database cho dòng chứng từ, gom dòng trùng tự động, hoặc cho sửa chứng từ đã xác nhận.
- Never: tự sửa stock movement/chứng từ đã xác nhận bằng cách ghi đè dòng cũ; phải dùng luồng điều chỉnh hoặc chứng từ đảo nếu cần.

## User Metadata and Granular Permission Scope

### Objective

Bổ sung hồ sơ người dùng rõ hơn và chuyển phân quyền từ quyền tổng quát theo module sang ma trận quyền chi tiết theo từng tính năng/hành động. Người dùng chính là master admin và warehouse admin khi tạo người dùng, sửa hồ sơ, tạo role và gán quyền.

### Current Reality

- Bảng `users` hiện chỉ có `email`, `password_hash`, `full_name`, `kind`, `warehouse_id`, `must_change_password`, `status`, `created_at`, `updated_at`.
- API admin hiện chỉ tạo user với `email` và `fullName`; chưa có số điện thoại, avatar hoặc metadata hồ sơ.
- Permission hiện là mã tổng như `catalog.manage`, `products.manage`, `partners.manage`, `stock.view`, `stock.receive`, `outbound.pick`.
- Role UI hiện chỉ có vài checkbox quyền outbound, chưa có ma trận tính năng x hành động và chưa có nút chọn tất cả theo từng dòng.

### User Metadata Fields

Thêm các trường hồ sơ tùy chọn:

- `avatarUrl`: đường dẫn ảnh đại diện sau khi upload và resize.
- `phone`: số điện thoại.
- `employeeCode`: mã nhân viên trong kho/công ty.
- `jobTitle`: chức danh.
- `department`: bộ phận.
- `note`: ghi chú nội bộ ngắn.

Quy tắc:

- `email`, `fullName` và `phone` bắt buộc.
- Metadata còn lại mặc định không bắt buộc.
- Avatar phải upload file hình, tự resize trước khi lưu, và chỉ lưu đường dẫn/khoá file trong database.
- Không lưu file ảnh binary trực tiếp trong database.
- Không lưu dữ liệu nhạy cảm không cần thiết như số căn cước, tài khoản ngân hàng hoặc thông tin sức khỏe.
- User list hiển thị tối thiểu avatar, họ tên, email, số điện thoại, bộ phận/chức danh và trạng thái.
- User create/edit phải có dấu `(*)` cho field bắt buộc theo `Form Required Field Rule`.
- Vì hệ thống còn ở giai đoạn development, migration user metadata được phép reset/reseed dữ liệu dev để đặt `phone` là `NOT NULL`; không sinh số điện thoại ngẫu nhiên cho dữ liệu cũ.
- Avatar chỉ nhận JPEG/PNG/WebP hợp lệ theo nội dung file, được xoay đúng orientation, crop vuông, resize 256x256, bỏ metadata và lưu WebP tối ưu. Giới hạn file đầu vào 5 MB và file sau xử lý 200 KB.

### Granular Permission Model

Permission chuyển sang dạng `<feature>.<action>`.

Action chuẩn:

- `view`: xem danh sách/chi tiết.
- `create`: thêm mới.
- `update`: sửa.
- `delete`: vô hiệu hóa theo rule an toàn dữ liệu; UI hiển thị là `Vô hiệu hóa`, không dùng `Xóa` cho dữ liệu nghiệp vụ.
- `approve`: duyệt/xác nhận nghiệp vụ.
- `print`: in.
- `export`: xuất file.

Feature tối thiểu:

- `admin.users`
- `admin.roles`
- `locations`
- `catalog.categories`
- `catalog.units`
- `products`
- `partners`
- `receipts`
- `outbounds`
- `picking`
- `checking`
- `outbound.exceptions`
- `purchasing`
- `sales`
- `returns`
- `stockCounts`
- `transfers`
- `inventory`
- `reports`
- `print`

Ví dụ quyền danh mục:

| Tính năng | Xem | Thêm | Sửa | Vô hiệu hóa | Chọn tất cả |
|---|---|---|---|---|---|
| Danh mục | `catalog.categories.view` | `catalog.categories.create` | `catalog.categories.update` | `catalog.categories.delete` | bật/tắt cả dòng |

### Role Permission UI

- Role form hiển thị quyền theo bảng: mỗi dòng là một tính năng, mỗi cột là một hành động.
- Mỗi dòng có checkbox `Chọn tất cả` để bật/tắt toàn bộ quyền của tính năng đó.
- Có checkbox `Chọn tất cả quyền` để bật/tắt toàn bộ quyền của role.
- Action không áp dụng cho tính năng nào thì cell disabled hoặc không hiển thị checkbox.
- Có thể lọc/nhóm quyền theo nhóm nghiệp vụ: Quản trị, Metadata, Kho, Xuất kho, Mua/Bán, Báo cáo/In.
- Không cho lưu role không có quyền nào.
- Khi sửa role, bảng phải phản ánh đúng quyền hiện có.

### Backend Enforcement

- API phải kiểm tra đúng action, không chỉ dựa vào UI.
- UI ẩn hoặc disable action không có quyền, nhưng backend vẫn là lớp bảo mật chính.
- Dự án còn ở giai đoạn development nên thay toàn bộ quyền cũ bằng catalog `<feature>.<action>` mới và reset/reseed role dev; không duy trì compatibility runtime cho `*.manage` hoặc tên quyền nghiệp vụ cũ.
- Master admin tiếp tục có quyền `*`.

### Testing Strategy

- Backend test cho create/update user metadata, validation phone, upload/resize avatar, warehouse scope và audit.
- Backend test cho granular permission: có `view` nhưng không có `create` thì chỉ xem được; có `delete` mới vô hiệu hóa/xóa được.
- Frontend test cho role matrix: chọn từng quyền, chọn tất cả một dòng, bỏ chọn một quyền làm row không còn full selected.
- Browser smoke test: tạo user có metadata, tạo role chỉ có quyền `catalog.categories.view/create`, xác nhận UI/API chỉ cho xem và thêm danh mục, không cho sửa/xóa.

## Metadata CRUD Completion Scope

### Objective

Hoàn thiện các màn hình metadata/master data đang có nút thêm, sửa hoặc xóa nhưng chưa sử dụng được. Người dùng chính là master admin và warehouse admin khi quản lý dữ liệu nền cho kho: vị trí, danh mục, đơn vị, sản phẩm, đối tác, người dùng và vai trò.

### Current Reality

- `frontend/src/features/catalog/CatalogPage.tsx`: danh mục và đơn vị đã có list/create, nhưng nút sửa/xóa đang disabled.
- `frontend/src/features/locations/LocationsPage.tsx`: vị trí đã có list/create/lookup, nhưng nút sửa/xóa đang disabled.
- `frontend/src/features/products/ProductsPage.tsx`: sản phẩm đã có list/create/lookup barcode, nhưng nút sửa/xóa đang disabled.
- `frontend/src/features/partners/PartnersPage.tsx`: backend đã có update/status, API client đã có method, nhưng UI list vẫn disable nút sửa/xóa.
- `frontend/src/features/admin/AccessPage.tsx`: user đã có tạo và vô hiệu hóa/kích hoạt; role đã có list/create, nhưng nút sửa/xóa role đang disabled.
- Backend hiện thiếu update/status/delete routes cho category, unit, location, product và role.

### Features To Add

1. Category metadata
   - Sửa tên danh mục.
   - Vô hiệu hóa/kích hoạt danh mục thay vì hard delete nếu đã được sản phẩm tham chiếu.
   - Chặn xóa cứng khi có ràng buộc dữ liệu.

2. Unit metadata
   - Sửa tên đơn vị.
   - Vô hiệu hóa/kích hoạt đơn vị.
   - Chặn sửa quy đổi hoặc xóa đơn vị khi đã có sản phẩm/chứng từ dùng; chỉ cho phép đổi tên/trạng thái an toàn.

3. Location metadata
   - Sửa tên, barcode và loại vị trí khi chưa có ràng buộc nguy hiểm.
   - Vô hiệu hóa/kích hoạt vị trí.
   - Chặn vô hiệu hóa/xóa khi vị trí còn tồn hoặc đang được chứng từ/picking/checking dùng.

4. Product metadata
   - Sửa tên, barcode, category/base unit và cờ FEFO/hạn dùng trong phạm vi an toàn.
   - Vô hiệu hóa/kích hoạt sản phẩm.
   - Chặn sửa tracking mode, SKU hoặc xóa cứng khi đã có tồn kho, lot/serial, barcode scan, chứng từ hoặc stock movement.

5. Partner metadata
   - Nối UI sửa đối tác vào API `PATCH /api/partners/:id`.
   - Nối UI vô hiệu hóa/kích hoạt đối tác vào API `PATCH /api/partners/:id/status`.
   - Hiển thị trạng thái trong danh sách và cập nhật row sau thao tác.

6. Role metadata
   - Sửa tên role và danh sách permission.
   - Xóa role chỉ khi chưa được gán cho user; nếu đã gán thì chặn bằng lỗi rõ ràng.
   - Không cho role mất toàn bộ permission.
   - Hard delete chỉ áp dụng khi role chưa từng được gán cho user; role đã hoặc đang được tham chiếu phải bị chặn để bảo toàn lịch sử.

7. User metadata
   - Giữ hành vi hiện có: tạo user, gán role, vô hiệu hóa/kích hoạt.
   - Bổ sung đổi tên user nếu cần trong plan; không thêm hard delete user vì audit/session cần bảo toàn lịch sử.

8. Shared UI behavior
   - Thay icon disabled bằng hành động thật hoặc ẩn nếu quyền không đủ.
   - Có confirm trước thao tác destructive/status change.
   - Có loading, success, error state theo từng row.
   - Sau khi tạo/sửa/xóa/vô hiệu hóa, danh sách cập nhật ngay không cần reload trang.
   - Tên nút dùng tiếng Việt rõ nghĩa: `Sửa`, `Vô hiệu hóa`, `Kích hoạt`, `Xóa` chỉ dùng khi thật sự xóa được.

### Testing Strategy

- Backend test cho mỗi route mới: permission, warehouse scope, duplicate, not found, active/inactive, constraint conflict.
- Frontend component test cho từng màn hình metadata: mở sửa, lưu thành công, disable/enable thành công, lỗi hiển thị.
- Browser smoke test ít nhất cho: category, unit, location, product, partner, role.

### Boundaries

- Always: dùng soft delete/status cho dữ liệu nghiệp vụ đã có ràng buộc; audit mọi thao tác create/update/status/delete.
- Ask first: hard delete dữ liệu đã từng phát sinh chứng từ, thay đổi migration lớn, thêm dependency UI mới.
- Never: xóa cứng user, stock movement, chứng từ kho hoặc dữ liệu audit.

## Production Scope

### Quản trị, tài khoản và phân quyền

- Không có đăng ký công khai.
- Master admin tạo kho và warehouse admin ban đầu.
- Warehouse admin tạo/sửa/vô hiệu hóa user trong kho của mình.
- User thường thuộc đúng một kho; master admin có quyền toàn hệ thống.
- Role theo kho, permission theo mã nghiệp vụ và hành động. Luồng xuất phải phân biệt tối thiểu `outbound.pick`, `outbound.check`, `outbound.ship`, `outbound.resolveDiscrepancy`; không gộp tất cả vào một quyền `approve`.
- API luôn kiểm tra permission; UI chỉ ẩn/hiện theo quyền, không phải lớp bảo mật chính.
- Mật khẩu tạm chỉ hiển thị/gửi một lần, lưu hash, bắt buộc đổi ở lần đăng nhập đầu tiên.

### Danh mục và sản phẩm

- Danh mục đa cấp, thương hiệu, nhà sản xuất, tag, trạng thái.
- Sản phẩm có SKU duy nhất trong kho, nhiều barcode, ảnh/tệp, đơn vị cơ sở, đơn vị mua/bán và quy đổi.
- Loại sản phẩm: hàng tồn kho, hàng không tồn kho, dịch vụ.
- Thuộc tính/biến thể theo category, có kiểu dữ liệu và validate rõ; không dùng JSON tự do cho dữ liệu cần truy vấn/kiểm soát.
- Metadata theo ngành: công nghệ, thực phẩm, thuốc.
- Chính sách sản phẩm: tracking `none`, `lot`, `serial`; quản lý hạn dùng; FEFO; tồn tối thiểu/tối đa; giá mua/bán tham chiếu; thuế suất hiển thị.

### Đối tác và chứng từ thương mại

- Quản lý nhà cung cấp/khách hàng: mã, tên, liên hệ, địa chỉ, mã số thuế, điều khoản thanh toán, trạng thái.
- Mua hàng: purchase order → phiếu nhập. Chỉ phiếu nhập đã xác nhận mới tăng tồn.
- Bán hàng: quote → sales order → phiếu xuất → soạn hàng → kiểm hàng → xác nhận xuất/giao hàng → commercial invoice. Chỉ bước xác nhận xuất cuối cùng mới giảm tồn thực tế.
- Hóa đơn thương mại lưu snapshot đối tác, dòng hàng, giá, chiết khấu, thuế, tổng tiền và trạng thái.
- Trả hàng khách/nhà cung cấp tạo chứng từ riêng và stock movement phù hợp.

### Luồng soạn → kiểm → xuất

State machine mặc định:

```text
draft → ready_to_pick → picking → picked → checking → shipped
checking → needs_repick → picking

draft/ready_to_pick/picking/picked/needs_repick → cancelled
shipped → reversal document; không sửa hoặc hủy trực tiếp
```

1. Phiếu xuất được duyệt sang `ready_to_pick`: hệ thống giữ số lượng cần xuất để phiếu khác không dùng cùng tồn. Đây là reservation, chưa tạo `StockMovement` và chưa giảm `on_hand`.
2. Nhân viên soạn nhận/được gán phiếu. Mỗi phiếu chỉ có một người soạn active trong MVP; supervisor có thể gán lại với audit. Tiến độ lưu sau mỗi lần quét để có thể mở lại, sau đó người soạn quét mã vị trí/kệ rồi quét sản phẩm, lot hoặc serial. App chỉ chấp nhận mã thuộc đúng kho, đúng vị trí, đúng phiếu và đúng chính sách FEFO/expiry.
3. Xác nhận soạn chuyển reservation từ `reserved` sang `picked`. Hàng vẫn thuộc tồn thực tế nhưng không còn khả dụng cho phiếu khác; ghi người soạn, thời gian, vị trí và số lượng thực soạn.
4. Nhân viên kiểm mở phiếu `picked`, nhận quyền kiểm active và quét lại hàng tại khu chờ kiểm/xuất. Người kiểm mặc định phải khác người soạn; override chỉ dành cho supervisor, bắt buộc lý do và audit.
5. Nếu sai sản phẩm/lot/serial hoặc thiếu/thừa, không được xuất. Phiếu chuyển `needs_repick`, hoặc supervisor phê duyệt xuất thiếu và ghi lý do; không tự sửa số lượng âm thầm.
6. Xác nhận kiểm/xuất là một transaction nguyên tử: kiểm tra version và reservation, tạo `StockMovement` bất biến, giảm `on_hand`, consume reservation, cập nhật lot/serial và chuyển phiếu sang `shipped`.
7. Request xác nhận phải idempotent. Gửi lại cùng idempotency key không được trừ tồn lần hai.
8. Hủy trước khi soạn xong phải release reservation. Hàng đã `picked` chỉ được release sau thao tác trả hàng về vị trí tồn, có người thực hiện và audit; không tự hết hạn.

Quy ước số lượng:

```text
committed = reserved + picked
available = on_hand - committed
```

`picked` không làm giảm `on_hand`; chỉ `shipped` mới làm giảm `on_hand`.

Phạm vi MVP có partial pick và xuất thiếu có phê duyệt. Split shipment/backorder nhiều đợt chỉ thêm khi có nhu cầu thực tế được xác nhận.

### Tồn kho, lot, serial và truy xuất

- Tồn theo kho, vị trí/kệ, sản phẩm, lot/serial khi áp dụng.
- Mỗi vị trí có mã và barcode; loại tối thiểu gồm `storage`, `staging`, `shipping`. Không tối ưu tuyến lấy hàng trong MVP.
- Reservation tham chiếu đúng stock key: kho + vị trí + sản phẩm + lot/serial; trạng thái tối thiểu `reserved`, `picked`, `consumed`, `released`.
- Mọi nhập/xuất/điều chỉnh/kiểm kê/chuyển kho/trả/hủy hàng vật lý tạo `StockMovement` bất biến; hủy chứng từ chưa xuất chỉ release reservation, không tạo movement giả.
- Chứng từ nháp có thể sửa/xóa; chứng từ đã xác nhận không sửa/xóa, chỉ đảo/điều chỉnh bằng chứng từ liên kết.
- Serial duy nhất theo sản phẩm và có lịch sử chuyển động.
- Lot lưu mã lô, ngày sản xuất, hạn dùng và metadata cần thiết.
- Sản phẩm có hạn dùng không được nhập lot thiếu hạn dùng.
- FEFO là mặc định khi xuất; override cần quyền `approve` và audit reason.
- Không cho xuất hàng hết hạn trừ khi role có quyền override và có audit.
- Truy xuất xuôi/ngược từ product/lot/serial đến mọi chứng từ, đối tác và người thao tác.
- Chuyển kho có phiếu gửi và phiếu nhận để tránh lệch tồn.

### Quét, in và báo cáo

- Quét barcode vị trí/kệ, sản phẩm, lot, serial và chứng từ bằng camera hoặc scanner giả lập bàn phím.
- Mã không xác định hiển thị lỗi rõ, không tự tạo dữ liệu.
- Màn hình soạn ưu tiên thao tác một tay trên điện thoại/PWA: mã vị trí, mặt hàng, số lượng còn lại, tiến độ phiếu và phản hồi âm thanh/rung khi quét đúng/sai.
- In báo giá, phiếu nhập/xuất, hóa đơn, kiểm kê, nhãn sản phẩm/lot/serial.
- Web/PWA dùng system print; silent print chỉ cam kết trên Windows/Tauri sau test thiết bị.
- Dashboard/báo cáo: tồn hiện tại, giá trị tồn tham chiếu, dưới tồn tối thiểu, sắp hết hạn/hết hạn, nhập-xuất-tồn, mua-bán, trả hàng, kiểm kê, truy xuất.
- Danh sách có filter, sort allowlist, pagination và export theo quyền.

## API and Data Rules

- Backend suy ra user, warehouse, role, permission từ session; không tin scope do client gửi.
- Mọi dữ liệu nghiệp vụ scope theo warehouse, trừ master admin.
- Mọi list API bắt buộc pagination.
- Error shape ổn định:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

- Confirm stock document là transaction nguyên tử, có idempotency key và kiểm tra version/xung đột.
- Release/pick/check/ship là action API riêng; không cho client cập nhật trực tiếp `status`, `picked_quantity`, `checked_quantity` hoặc reservation.
- PostgreSQL transaction phải khóa các stock/reservation row liên quan khi release, xác nhận soạn và xác nhận xuất để ngăn hai thiết bị giữ/xuất cùng tồn.
- Mọi scan phải được đối chiếu server-side với warehouse, document, location, product, lot/serial và trạng thái hiện tại.
- Reservation ở `reserved` có hạn giữ cấu hình được và có thể release bởi supervisor; reservation `picked` không tự hết hạn vì hàng đã rời kệ vật lý.
- Không cho tồn âm trừ adjustment có quyền `approve`.
- Snapshot dữ liệu cần giữ lịch sử phải lưu vào document lines và movements.
- Upload/import/barcode/email/print config đều validate ở boundary.
- Không log password, token, session secret hoặc lỗi nội bộ nhạy cảm.

## Code Style

- TypeScript strict.
- English code names, Vietnamese UI copy.
- Domain logic nằm trong service/domain function có test; route handler mỏng.
- Không tạo repository/service generic nếu chưa có ít nhất 2 nơi dùng.
- Validation ở API boundary bằng Zod; business service nhận input typed đã validate.
- Permission check đặt gần domain action, không dựa vào route visibility.

Ví dụ style:

```ts
const canOverrideExpiredLot =
  lot.expiresAt < today && permissions.includes("stock.overrideExpiry");

if (lot.expiresAt < today && !canOverrideExpiredLot) {
  throw new DomainError("LOT_EXPIRED", "Không được xuất lô đã hết hạn");
}
```

## Frontend Requirements

- Template phải được “rút gọn để dùng thật”: bỏ demo page/component không cần cho nghiệp vụ.
- Component đặc thù của một feature đặt trong `frontend/src/features/<feature>/components/`; component dùng chung từ hai feature trở lên mới đặt trong `frontend/src/components/`.
- Route chính: dashboard, catalog, products, partners, purchasing, sales, outbound picking, outbound checking, stock, locations, lots/serials, transfers, stock counts, returns, reports, users, roles, print settings.
- Sidebar hiển thị theo permission.
- Auth flow gồm login, đổi mật khẩu tạm, logout; không có sign-up public.
- Form phải có validation, error display, loading state, disabled state.
- Table phải có pagination, filter, empty state, error state.
- Quy chuẩn list/form áp dụng cho toàn bộ tính năng đã làm và sẽ làm.
- Mỗi screen dạng danh sách phải có toolbar action ở đầu màn hình như `Thêm`, `In`, `Export` theo quyền và nghiệp vụ.
- Màn hình danh sách chỉ hiển thị danh sách, filter/pagination và toolbar action; form tạo/sửa nằm ở route riêng mở từ action như `Thêm`.
- Với màn hình có tạo mới, nút `Thêm` trên list screen phải điều hướng sang route form riêng, không scroll tới form nhúng trong cùng trang.
- Mỗi item trong danh sách phải có cột `Action` riêng; thao tác dòng dùng icon button như sửa, xóa, kích hoạt, xem chi tiết và phải có `aria-label`.
- Icon-only button phải có `aria-label`.
- Màu trạng thái không truyền nghĩa chỉ bằng màu; luôn có label/icon.

## Visual Language

- Giao diện nghiệp vụ, sáng, dễ quét dữ liệu; không giữ phong cách demo quá trang trí.
- Dùng token màu ngữ nghĩa, không rải mã màu trực tiếp trong component.
- Token chính:
  - `canvas` `#F8FAFC`
  - `surface` `#FFFFFF`
  - `text` `#0F172A`
  - `muted` `#475569`
  - `border` `#CBD5E1`
  - `primary` `#0F4C81`
  - `info` `#0369A1`
  - `success` `#15803D`
  - `warning` `#B45309`
  - `danger` `#B91C1C`
- Icon mặc định: `react-icons/io5` nếu tiếp tục dùng icon set hiện tại của repo chính; nếu giữ SVG icon từ template thì phải thống nhất một nguồn icon, không trộn tùy tiện.

## Testing Strategy

- Unit domain: unit conversion, FEFO, lot/serial uniqueness, expiry override, totals, reservation math và document state transitions.
- Backend integration: auth/session, warehouse isolation, permission matrix, reservation/release, two-person rule, idempotent ship, concurrent stock conflict, traceability.
- Contract: request validation, response shape, pagination/filtering, authorization errors.
- Frontend unit/component: permission nav, forms, tables, status rendering.
- E2E trọng yếu: tạo phiếu xuất → reserve → người soạn quét kệ/hàng → xác nhận soạn không giảm `on_hand` → người khác kiểm → mismatch bị chặn → xác nhận xuất giảm đúng một lần.
- E2E mở rộng: master tạo warehouse/admin; admin tạo role/user; nhận hàng theo lot/serial; trả hàng; kiểm kê; trace lot; print flow.
- Device/manual evidence: barcode scanner, Android camera, Windows printer, Tauri silent print when that phase starts.

## Boundaries

- Always:
  - Viết TypeScript cho code mới.
  - Bỏ Strapi khỏi kiến trúc đích.
  - Validate input ở API boundary.
  - Enforce warehouse/permission ở backend.
  - Dùng transaction cho tồn kho.
  - Tách `on_hand`, `reserved`, `picked` và `available` theo quy tắc trong spec.
  - Chỉ giảm `on_hand` khi xác nhận xuất cuối cùng.
  - Giữ audit và immutable stock movement.
  - Verify bằng test/build trước khi báo done.

- Ask first:
  - Chọn framework khác Hono.
  - Thay PostgreSQL hoặc thêm ORM.
  - Thêm dependency lớn.
  - Đổi permission model.
  - Cho phép cùng một user vừa soạn vừa kiểm mà không cần supervisor override.
  - Tự release hàng đã `picked`.
  - Xóa dữ liệu/migration phá vỡ dữ liệu hiện có.
  - Bật silent print ngoài Windows.
  - Tích hợp email/payment/accounting bên thứ ba.

- Never:
  - Dùng lại Strapi cho backend đích.
  - Public registration.
  - Lưu/log plaintext password/token.
  - Tin warehouse/user/permission scope từ client.
  - Sửa trực tiếp chứng từ tồn kho đã xác nhận.
  - Giảm tồn khi mới xác nhận soạn.
  - Xuất khi kiểm thiếu/sai mà chưa có quyết định được phép và audit.
  - Xóa audit log hoặc stock movement history.

## Implementation Direction

Nền `frontend/`, `backend/`, PostgreSQL và migration đầu đã có. Sau khi spec được xác nhận, plan mới phải chia tiếp theo thứ tự phụ thuộc:

1. Sửa foundation còn lệch spec: test TypeScript, command/build, frontend template lint.
2. Auth/session/warehouse/permission.
3. Product/barcode/lot/serial và location/kệ.
4. Stock balance/movement/reservation với kiểm thử cạnh tranh.
5. Phiếu xuất và state machine soạn → kiểm → xuất.
6. Màn hình PWA quét cho người soạn và người kiểm.
7. Các domain mua hàng, trả hàng, chuyển kho, kiểm kê, báo cáo và in.

## Non-goals

- Không làm kế toán sổ cái, công nợ, khai thuế, hóa đơn điện tử, ngân hàng.
- Không RFID, MRP/sản xuất, wave/batch picking hoặc tối ưu tuyến lấy hàng trong MVP.
- Không cam kết offline-first.
- Không silent print web/PWA.
- Không chứng nhận quy định thuốc đặc biệt ngoài quản lý kho/truy xuất cơ bản.

## Success Criteria

1. Repo không còn phụ thuộc Strapi trong backend đích.
2. Backend Hono/Node.js TypeScript chạy được dev/build/test và có health/auth/session cơ bản.
3. PostgreSQL local schema/migration bằng SQL quản lý các domain chính: user, warehouse, role, product, partner, location, stock document, movement, reservation, lot và serial.
4. API enforce warehouse isolation và permission bằng backend tests.
5. Frontend nằm trong `frontend/`, dùng template `admin_template` cho layout nghiệp vụ, không còn route/demo auth TailAdmin gây sai hành vi.
6. Flow trọng yếu chạy thật: phiếu xuất được reserve → soạn bằng quét → kiểm bằng user khác → xác nhận xuất mới giảm tồn.
7. Khi `picked`, `on_hand` không đổi nhưng `available` giảm; khi `shipped`, `on_hand` giảm đúng một lần và reservation được consume.
8. Quét sai kệ, sai sản phẩm, sai lot/serial, thiếu/thừa hoặc request trùng đều bị xử lý theo tiêu chí trong spec.
9. Mọi task implementation có verification rõ: build/test/lint hoặc manual evidence.

## Open Questions

- Xác nhận bắt buộc người kiểm phải khác người soạn, chỉ supervisor mới được override?
- Khi bắt đầu soạn, có bắt buộc quét barcode kệ trước barcode hàng hay chỉ hiển thị kệ để hướng dẫn?
- Reservation `ready_to_pick` nên tự hết hạn sau bao lâu nếu chưa ai bắt đầu soạn?
- Khi thiếu hàng, MVP cho phép supervisor xuất thiếu ngay hay bắt buộc trả về `needs_repick`?
- Email provider nào dùng cho mật khẩu tạm/reset password?
- Xác nhận flow đầu tiên sau auth/product/location là outbound soạn → kiểm → xuất?
