# Warehouse Suite

Phan mem quan ly kho dang SaaS cho web truoc, co nen tang de mo rong sang desktop/mobile sau. Du an hien co React + Tailwind cho giao dien, Strapi cho API, PostgreSQL 18 local cho du lieu, va cac module dang xay dung theo task trong `tasks/todo.md`.

## Yeu Cau May

- Node.js 20+ va npm.
- PostgreSQL 18 da cai tai `C:\Program Files\PostgreSQL\18`.
- Windows PowerShell.
- Codex/RTK neu tiep tuc phat trien bang workflow trong repo.

## Cai Dat Lan Dau

Tai thu muc goc du an:

```powershell
npm install
cd server
npm install
cd ..
```

Tao file moi truong cho API:

```powershell
Copy-Item .env.example server/.env
```

Voi may local hien tai, `server/.env` nen dung PostgreSQL 18 local:

```env
DATABASE_CLIENT=postgres
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15433
DATABASE_NAME=warehouse
DATABASE_USERNAME=warehouse
DATABASE_PASSWORD=<mat-khau-local>
DATABASE_SSL=false
```

Khong commit `server/.env` vi file nay chua mat khau va secret.

## Chay PostgreSQL 18 Local

Database local cua du an nam trong `.local/postgres18-data` va chay cong `15433` de khong dung voi service PostgreSQL mac dinh.

Bat database:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.\.local\postgres18-data' -l '.\.local\postgres18.log' -o '-p 15433' start
```

Dung database khi can:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe' -D '.\.local\postgres18-data' stop
```

Kiem tra database:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 15433 -U warehouse -d warehouse -c 'select version();'
```

## Chay API Strapi

Mo mot terminal rieng:

```powershell
cd server
npm run develop
```

API mac dinh chay tai:

```text
http://127.0.0.1:1337
```

Kiem tra API:

```powershell
Invoke-RestMethod http://127.0.0.1:1337/api/health
```

## Chay Web

Mo terminal thu hai tai thu muc goc:

```powershell
npm run dev
```

Web mac dinh chay tai:

```text
http://127.0.0.1:5173
```

Neu API khong chay cong mac dinh, tao file `.env` o thu muc goc:

```env
VITE_API_URL=http://127.0.0.1:1337
```

## Tai Khoan Va Dang Nhap

Hien tai khong mo dang ky cong khai. Tai khoan duoc tao boi master admin hoac admin kho theo phan quyen.

Gia tri master admin nam trong `server/.env`:

```env
MASTER_ADMIN_EMAIL=master@example.com
MASTER_ADMIN_PASSWORD=<mat-khau-tam>
```

Sau khi dang nhap bang mat khau tam, nguoi dung nen doi mat khau theo luong trong app.

## Lenh Thuong Dung

| Thu muc | Lenh | Muc dich |
|---|---|---|
| `.` | `npm run dev` | Chay web Vite |
| `.` | `npm run build` | Build web production |
| `.` | `npm run lint` | Kiem tra TypeScript web |
| `.` | `npm run test` | Chay test frontend |
| `server` | `npm run develop` | Chay Strapi dev |
| `server` | `npm run build` | Build Strapi admin/API |
| `server` | `npm run test` | Chay test backend |

## Kiem Tra Truoc Khi Lam Tiep

Chay nhanh cac lenh nay sau khi sua code:

```powershell
npm run test
npm run build
cd server
npm run test
npm run build
```

## In An Va Silent Print

Web/PWA se dung luong in qua trinh duyet cho cac phieu thong thuong.

Silent print tren Windows/macOS se duoc xu ly bang Tauri trong task T14. Hien repo chua co `src-tauri`, nen chua co lenh desktop build. Khi T14 hoan thanh, README nay can bo sung:

- cach cai Rust va Tauri CLI;
- cach cau hinh may in mac dinh;
- quyen silent print theo tung may tram;
- lenh build app Windows/macOS.

## Cau Truc Chinh

```text
.
|-- src/                 # React web app
|-- server/              # Strapi API
|-- tasks/               # Plan, todo, test plan
|-- SPEC.md              # Yeu cau san pham
|-- .env.example         # Mau env cho API
`-- README.md            # Huong dan chay du an
```

## Trang Thai Hien Tai

Da hoan thanh cac phan nen tang den engine ton kho, lo/serial, FEFO va truy xuat. Cac module mua hang, ban hang, tra hang, bao cao, barcode, in an va Tauri van dang nam trong checklist `tasks/todo.md`.
