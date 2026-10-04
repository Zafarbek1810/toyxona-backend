# To'yxona Backend API

Node.js (Express) + Prisma + PostgreSQL marketplace backend for all customer, seller, and admin pages.

## Quick start

```bash
cd backend
npm install
npm run db:setup
npm run dev
```

API: `http://localhost:5050/api`  
Health: `http://localhost:5050/api/health`

## Demo accounts

Password for all: `Password123!`

| Role | Phone | Email |
|------|-------|-------|
| Admin | `901111111` | admin@toyxona.uz |
| Customer | `901234567` | jasur@example.com |
| Seller (TechPlus) | `933456789` | techplus@toyxona.uz |

## Auth

Send JWT in header:

```
Authorization: Bearer <token>
```

Login:

```http
POST /api/auth/login
{ "phone": "901234567", "password": "Password123!" }
```

## Main endpoints

### Public
- `GET /api/home` — homepage feeds
- `GET /api/products` — catalog (`q`, `category`, `minPrice`, `maxPrice`, `sort`, `onSale`…)
- `GET /api/products/:id` — product detail
- `GET /api/products/:id/reviews`
- `GET /api/categories`
- `GET /api/sellers`
- `GET /api/stores/:slug`
- `GET /api/subscription-plans`
- `GET /api/promotions`
- `GET /api/regions`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

### Customer
- `GET|PATCH /api/users/me`
- `GET|PATCH /api/users/me/settings`
- `CRUD /api/addresses`
- `GET|POST|PATCH|DELETE /api/cart…`
- `GET|POST|DELETE /api/favorites…`
- `POST /api/orders` — checkout
- `GET /api/orders`
- `POST /api/orders/:id/reviews`
- `GET /api/notifications`

### Seller (`role=seller`)
- `CRUD /api/seller/products` (multipart `images`)
- `GET /api/seller/orders` · `PATCH /api/seller/orders/:id/status`
- `GET /api/seller/payments` · `POST /api/seller/payments/checkout`
- `GET|POST /api/seller/subscription`
- `GET /api/seller/reviews` · `POST /api/seller/reviews/:id/reply`
- `GET /api/seller/analytics`
- `GET|PATCH /api/seller/settings`
- `GET /api/seller/overview`

### Admin (`role=admin`)
- `GET|PATCH|DELETE /api/admin/users`
- `CRUD /api/admin/sellers`
- `GET /api/admin/products` · `POST /api/admin/products/:id/approve|reject`
- `CRUD /api/admin/categories` (+ subcategories)
- `GET /api/admin/orders`
- `GET /api/admin/payments`
- `CRUD /api/admin/promotions`
- `GET|POST /api/admin/subscription-plans`
- `GET /api/admin/analytics`
- `GET|PATCH /api/admin/settings`

## Env

Copy `.env.example` → `.env`:

| Variable | Default |
|----------|---------|
| `PORT` | `5050` |
| `DATABASE_URL` | `postgresql://fourcade7@localhost:5432/toyxona?schema=public` |
| `JWT_SECRET` | change in production |
| `CORS_ORIGIN` | `http://localhost:8443` |

## Scripts

- `npm run dev` — watch mode
- `npm run start` — production
- `npm run db:setup` — generate + push schema + seed
- `npm run db:seed` — re-seed demo data
- `npm run db:studio` — Prisma Studio UI
