# 🎫 TONIGHT — Cinematic Ticket Booking Platform

> **Experience it Tonight.** A high-performance, concurrency-safe ticket booking platform for movies and concerts featuring real-time visual seat selection, automated TTL hold expiration, waitlist auto-assignment on cancellations, and instant QR code ticket delivery.

---

## 🌟 Key Features

### 🎬 Visual Seat Selection & Real-Time Sync
- **Interactive Visual Seat Grid**: Custom SVG-like seat map rendered per event, displaying exact row/column positions, seat categories (VIP, Premium, Standard), and real-time status.
- **WebSocket Broadcast**: Powered by **Socket.IO** rooms (`event:<id>`). Seat state transitions (`available`, `held`, `booked`) reflect immediately on all active browsers without page reload.

### ⏱️ Seat Hold & TTL Auto-Release
- **Configurable TTL**: When a customer selects seats, a temporary hold is placed with an event-level configurable TTL (default 10 minutes).
- **Client-Side Countdown Timer**: Visual hold timer bar with urgent state warning (< 60s).
- **Automated Sweeper**: Background cron worker checks every 30 seconds for expired holds, resets them to `available`, and broadcasts updates to all active sessions.

### 🛡️ Concurrency Protection (Zero Double-Booking)
- **Pessimistic Row-Level Locking**: Implemented with PostgreSQL `SELECT ... FOR UPDATE` inside atomic transactions.
- **Simultaneous Race Handling**: If multiple customers select the same seat simultaneously, only one transaction commits; subsequent transactions are rejected with HTTP 409 and detailed conflict reporting.

### 📋 FIFO Waitlist with Auto-Assignment
- **Category-Based Waitlists**: When a seat category is sold out, users can join the waitlist.
- **Cancellation Cascade**: When a booking is cancelled, the system automatically allocates the freed seat to the next user in line, generates a secure time-limited offer token, and emails them.
- **Cascading Expiry**: If the customer fails to claim within the offer window (default 15 minutes), the scheduler cascades the offer to the next in line.

### 🎟️ Instant QR Code Tickets & Transactional Emails
- **Unique Booking Reference**: Cryptographically generated alphanumeric codes (e.g. `TKT-8X9A21B4`).
- **QR Code Encoding**: QR codes generated dynamically as base64 data URLs & PNG buffers using the `qrcode` engine.
- **HTML Email Dispatch**: Transactional emails delivered via **Resend API** (with fallback development mocking).

### 🎭 Role-Based Access Control (RBAC)
- **Admin**: Create and manage venues, configure row/column layouts, define seat categories with custom HEX colors, and auto-generate seat maps.
- **Organiser**: Create movie or concert listings, set venue, date, time, hold TTL, and per-category pricing. Access live event revenue analytics and booking summaries.
- **Customer**: Browse and filter events, select seats, complete bookings, view past tickets, join waitlists, and cancel bookings.

---

## 🎨 Design Style: Cinematic Editorial

- **Palette**: Deep charcoal and near-black surfaces (`#0a0a0a`, `#111111`) accented with electric purple (`#8b5cf6`) and glowing neon highlights.
- **Visual Signature — Black & White → Full Color on Hover**: Event cards and photography sit in a high-contrast desaturated state at rest, transitioning smoothly to vivid full-color with purple glow borders upon hover (`0.6s cubic-bezier`).
- **Typography**: Editorial headline sizing using **Outfit** paired with crisp body typography in **Inter**.
- **Real Movie Imagery**: Direct integration with the **TMDB (The Movie Database) API** for movie backdrops, posters, ratings, and release data.

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 6, React Router v7, Framer Motion, Lucide Icons, React Hot Toast |
| **Backend** | Node.js, Express, Socket.IO, node-cron, bcryptjs, jsonwebtoken, UUID |
| **Database** | PostgreSQL with native `pg` driver (Raw SQL transactions, `SELECT FOR UPDATE`) |
| **Email Service** | Resend API (HTML email templates + inline QR ticket) |
| **QR Generation** | `qrcode` engine |
| **Movie Metadata** | TMDB REST API |

---

## 🗄️ Database Schema

```sql
-- Core Tables
users            (id, name, email UNIQUE, password_hash, role: admin|organiser|customer, created_at)
venues           (id, name, address, total_rows, total_columns, created_by, created_at)
seat_categories  (id, venue_id, name, color, created_at)
venue_seats      (id, venue_id, category_id, row_label, seat_number, x_pos, y_pos)
events           (id, organiser_id, venue_id, title, type: movie|concert, description, poster_url, event_date, event_time, status, hold_ttl_minutes, created_at)
event_pricing    (id, event_id, category_id, price)
show_seats       (id, event_id, venue_seat_id, status: available|held|booked, held_by, held_at, booked_by)
bookings         (id, event_id, user_id, booking_ref UNIQUE, total_amount, status: confirmed|cancelled, qr_code_data, created_at, cancelled_at)
booking_seats    (id, booking_id, show_seat_id, price)
waitlist         (id, event_id, category_id, user_id, status: waiting|offered|fulfilled|expired, offer_token, offered_at, offer_expires_at, created_at)
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- PostgreSQL database instance (local or hosted on Neon / Render / Supabase)

### 1. Clone & Install
```bash
# Clone the repository
git clone <repo-url>
cd ticket-booking

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticket_booking
JWT_SECRET=tonight-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
DEFAULT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15
RESEND_API_KEY=re_your_key_or_leave_empty_for_dev_mock
FROM_EMAIL=tickets@yourdomain.com
FRONTEND_URL=http://localhost:5173
SCHEDULER_INTERVAL_SECONDS=30
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:5000/api
VITE_TMDB_API_KEY=your_optional_tmdb_api_key
```

### 3. Initialize & Seed Database
```bash
# From backend directory
npm run db:init   # Creates all tables, enums, and indexes
npm run db:seed   # Seeds venues, seat categories, events, and test accounts
```

### 4. Run Development Servers
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 👥 Demo Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| **Admin** | `admin@ticketbooking.com` | `admin123` | Venue & Seat Grid Creation (`/admin`) |
| **Organiser** | `organiser@tonight.com` | `organiser123` | Event Creation & Revenue Analytics (`/organiser`) |
| **Customer 1** | `customer@tonight.com` | `customer123` | Seat Booking, QR Tickets, Waitlist (`/dashboard`) |
| **Customer 2** | `marcus@tonight.com` | `customer123` | Concurrency & Waitlist Testing (`/dashboard`) |

---

## 📡 API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register customer or organiser account
- `POST /api/auth/login` — Sign in and receive JWT token
- `GET /api/auth/me` — Retrieve current authenticated user profile

### Venues (`/api/venues`)
- `GET /api/venues` — List all venues
- `GET /api/venues/:id` — Get venue details and physical seat grid
- `POST /api/venues` — Create venue *(Admin)*
- `PUT /api/venues/:id` — Update venue *(Admin)*
- `POST /api/venues/:id/categories` — Add seat category *(Admin)*
- `POST /api/venues/:id/seats` — Bulk insert seats *(Admin)*
- `POST /api/venues/:id/generate-seats` — Auto-generate row-ranged seat grid *(Admin)*

### Events (`/api/events`)
- `GET /api/events` — Browse & filter events by date, category, search query
- `GET /api/events/:id` — Event details, category pricing & availability counters
- `GET /api/events/:id/seats` — Live seat map status (`available`/`held`/`booked`)
- `POST /api/events` — Create event & generate show seats *(Organiser)*
- `PUT /api/events/:id` — Update event details *(Organiser/Admin)*

### Bookings (`/api/bookings`)
- `POST /api/bookings/hold` — Place time-limited hold on seats (`SELECT FOR UPDATE`)
- `POST /api/bookings/confirm` — Finalize held seats → generates QR code & email
- `POST /api/bookings/release` — Manually release held seats
- `GET /api/bookings/my` — Customer booking history & tickets
- `POST /api/bookings/:id/cancel` — Cancel booking → triggers automatic waitlist offer
- `GET /api/bookings/event/:eventId/summary` — Event revenue & booking analytics *(Organiser)*

### Waitlist (`/api/waitlist`)
- `POST /api/waitlist/join` — Join category waitlist on sold-out event
- `GET /api/waitlist/my` — View active waitlist entries
- `POST /api/waitlist/accept/:token` — Claim time-limited waitlist offer
- `DELETE /api/waitlist/:id` — Leave waitlist

---

## 🚢 Deployment Guide

### Deploying on Render (Full Stack)
1. **PostgreSQL**: Create a new free PostgreSQL database on [Render](https://render.com) or [Neon](https://neon.tech) and copy the `DATABASE_URL`.
2. **Backend Web Service**:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Set environment variables (`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `RESEND_API_KEY`).
3. **Frontend Static Site (Vercel / Render)**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Set `VITE_API_URL` to your hosted backend URL (e.g. `https://tonight-api.onrender.com/api`).

---

## 📄 License
MIT License. Developed for the Ticket Booking System specification.
