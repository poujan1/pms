# 🌾 Paddy Management System (PMS) - Backend API

Production-ready Node.js, Express, TypeScript, and Prisma ORM 7 backend tailored for paddy mediators/aggregators connecting farmers to rice mills in Nepal.

---

## 🏗️ Architecture & Features

- **Strict TypeScript & Layered Architecture**: Routes $\to$ Middleware $\to$ Controllers $\to$ Services $\to$ Prisma ORM.
- **Double-Entry Ledger Integrity**: Every purchase, advance, harvester offset, dispatch, and settlement generates balanced, immutable audit trail entries in `LedgerEntry`.
- **First-Class Farmer & Mill Ledgers**:
  - Period Opening & Closing balance calculations (`fromDate` / `toDate`).
  - Line-by-line running balances with transaction references.
  - Master summary sheets for all farmers (purchases, advances, harvester cuts, net payable) and mills (dispatches, accepted weight, side cuts, net receivable).
  - Controlled manual journal adjustments (`/ledgers/adjustments`).
- **Lot-Level Inventory Traceability**: Automatic generation of `PaddyLot` upon procurement; validates and tracks exact remaining kilograms when allocated to `TruckDispatch`.
- **Configurable Side-Cut Engine**: Supports `WEIGHT_CUT`, `SACK_TARE_CUT`, `PERCENTAGE_CUT`, `PER_UNIT_RATE_CUT`, and `FIXED_MONEY_CUT`.
- **Truck P&L Calculation**: Real-time calculation of weighted procurement cost, logistics expenses, transit shortage, mill revenue, and net profit per trip.
- **Precision Numeric Types**: High-precision `DECIMAL(12, 3)` for kilograms and `DECIMAL(14, 2)` for currency (NPR).

---

## 🚀 Quick Start

### 1. Start PostgreSQL
Using Docker:
```bash
docker compose up -d
```
Or use an existing PostgreSQL instance and configure `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pms_db?schema=public"
```

### 2. Run Database Migrations & Seeds
From the `backend` directory:
```bash
npm run prisma:migrate -- --name init
npm run prisma:seed
```
*Default Seed User:* `username: admin`, `password: admin123`

### 3. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000` (or `PORT` specified in `.env`).

---

## 📡 API Endpoints Reference

All endpoints are prefixed with `/api/v1`.

### 🔐 Authentication (`/api/v1/auth`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Login with username & password | Public |
| `GET` | `/auth/me` | Get logged-in user profile | Authenticated |
| `POST` | `/auth/register` | Register an employee account | `OWNER` |

### 📖 Dedicated Farmer & Mill Ledgers (`/api/v1/ledgers`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/ledgers/farmers/summary` | Summary table of all farmers (paddy kg, amount, advances, harvester cuts, net balance) | Authenticated |
| `GET` | `/ledgers/farmers/:farmerId/statement` | Detailed date-wise Farmer Statement with period opening/closing & running balance | Authenticated |
| `GET` | `/ledgers/mills/summary` | Summary table of all mills (dispatched, accepted, shortage, billed, net receivable) | Authenticated |
| `GET` | `/ledgers/mills/:millId/statement` | Detailed date-wise Mill Statement with period opening/closing & running balance | Authenticated |
| `POST` | `/ledgers/adjustments` | Post manual journal adjustment with audit description | `MANAGER` |

### 👨‍🌾 Farmers (`/api/v1/farmers`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/farmers` | List all farmers (with search) | Authenticated |
| `POST` | `/farmers` | Register new farmer with opening balance | `MANAGER` |
| `GET` | `/farmers/:id` | Get farmer details and recent activities | Authenticated |
| `PUT` | `/farmers/:id` | Update farmer information | `MANAGER` |
| `POST` | `/farmers/:id/advances`| Record pre-harvest advance & post to ledger | `MANAGER` |

### 🏭 Rice Mills (`/api/v1/mills`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/mills` | List rice mills | Authenticated |
| `POST` | `/mills` | Register mill with opening balance | `MANAGER` |
| `GET` | `/mills/:id` | Get mill details & contracts | Authenticated |
| `PUT` | `/mills/:id` | Update mill details | `MANAGER` |
| `POST` | `/mills/:id/contracts`| Record mill procurement contract | `MANAGER` |

### 🚜 Harvester Machinery (`/api/v1/harvester`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/harvester/machines` | List harvester machines | Authenticated |
| `POST` | `/harvester/machines` | Register harvester machine/operator | `MANAGER` |
| `GET` | `/harvester/work` | List harvester work logs | Authenticated |
| `POST` | `/harvester/work` | Record work & post (Farmer Cut vs. Co. Expense)| `MANAGER` |

### 🌾 Paddy Procurement (`/api/v1/purchases`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/purchases` | List purchases with filter & search | Authenticated |
| `POST` | `/purchases` | Create purchase, initialize lot & post ledger | `EMPLOYEE` |
| `GET` | `/purchases/:id` | Get purchase & lot traceability details | Authenticated |

### 🚚 Truck Dispatches (`/api/v1/dispatches`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/dispatches/available-lots` | List all unexhausted lots available for dispatch | Authenticated |
| `GET` | `/dispatches` | List dispatches | Authenticated |
| `POST` | `/dispatches` | Dispatch truck, allocate lot weights, set in-transit | `EMPLOYEE` |
| `GET` | `/dispatches/:id` | Full truck details & lot allocation tree | Authenticated |

### ⚖️ Mill Settlements (`/api/v1/settlements`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/settlements` | List all settlements | Authenticated |
| `POST` | `/settlements` | Record mill weighment, side cuts & post receivable | `MANAGER` |
| `GET` | `/settlements/:id` | Settlement breakdown with shortage and cuts | Authenticated |

### 💰 Payments & Vouchers (`/api/v1/payments`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/payments` | List payment vouchers | Authenticated |
| `POST` | `/payments` | Record payment to farmer or receipt from mill | `MANAGER` |

### 📊 Reports & P&L (`/api/v1/reports`)
| Method | Route | Description | Min Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/reports/dashboard-summary` | Aggregated stock, transit, liabilities & receivables | Authenticated |
| `GET` | `/reports/dispatch-pnl/:dispatchId`| Full trip P&L (weighted purchase cost vs. mill net)| `MANAGER` |
