# System Design Document — Tonight Ticket Booking Platform

## 1. Executive Architecture Overview
**Tonight** is a real-time, concurrency-safe ticketing platform for cinema and live concert events. The system is architected as a decoupled client-server platform:
- **Frontend**: React + Vite single-page application utilizing WebSocket subscriptions, client-side hold countdown timers, and an editorial cinematic UI with real TMDB movie integration.
- **Backend API**: Node.js and Express RESTful service paired with a Socket.IO real-time broadcast engine.
- **Data Persistence**: PostgreSQL relational database acting as the single source of truth, enforcing ACID transactions and pessimistic row-level locking (`SELECT ... FOR UPDATE`).
- **Background Worker**: In-process high-precision scheduler running periodic evaluations for TTL expiration and waitlist cascading.
- **Notification Services**: Transactional email dispatch via Resend API and QR code generation encoding cryptographic booking references.

---

## 2. Seat Hold and TTL Auto-Release Mechanism
When a customer selects seats on the interactive map:
1. **Pessimistic State Acquisition**: A transaction locks candidate rows in `show_seats`. If all requested seats are `status = 'available'`, their state transitions to `status = 'held'`, attaching `held_by = customer_id` and setting `held_at = NOW()`.
2. **Dynamic TTL Configuration**: Hold durations are governed dynamically per event via `events.hold_ttl_minutes` (defaulting to 10 minutes).
3. **Automated Sweep Worker**: A background scheduler executes an atomic release query every 30 seconds:
   ```sql
   UPDATE show_seats ss
   SET status = 'available', held_by = NULL, held_at = NULL
   FROM events e
   WHERE ss.event_id = e.id
     AND ss.status = 'held'
     AND ss.held_at + (e.hold_ttl_minutes * INTERVAL '1 minute') < NOW()
   RETURNING ss.id, ss.event_id, ss.status;
   ```
4. **Real-Time Map Synchronization**: Every released seat automatically dispatches a `seats-updated` payload over the Socket.IO room corresponding to that event ID, immediately toggling the seat back to available on all connected viewports without requiring manual page refresh.

---

## 3. Concurrency Protection & Zero Double-Booking Guarantee
High-demand event releases inherently suffer from race conditions when hundreds of users attempt to hold the exact same seat within milliseconds.

Tonight addresses this with strict database-level concurrency control:
1. **Serializable Row Locking**: The hold handler opens a database transaction and executes:
   ```sql
   SELECT id, status, held_by
   FROM show_seats
   WHERE id = ANY($1) AND event_id = $2
   FOR UPDATE;
   ```
2. **Atomic Verification**: PostgreSQL forces concurrent transactions attempting to acquire the same rows into a strict queue. The first transaction acquires the lock and marks the seats as `held`.
3. **Conflict Rejection**: When subsequent queued transactions acquire the lock, they inspect the updated row status, detect `status != 'available'`, roll back the transaction, and return an HTTP `409 Conflict` response with the list of unavailable seat identifiers.
4. **Booking Isolation**: When finalizing checkout, a secondary `FOR UPDATE` query confirms that the seats are still actively held by that specific customer before committing the final `status = 'booked'` transition.

---

## 4. Waitlist Auto-Assignment & Cancellation Flow
When all seats in a given seat category (e.g., VIP Recliner, Tier 1 Seated) sell out, customers can join a FIFO waitlist queue per event and category.

```
┌─────────────────┐
│ Event Sold Out  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Customer Joins  │ ──▶ INSERT INTO waitlist (status = 'waiting', created_at = NOW())
│  FIFO Waitlist  │
└─────────────────┘
         │ (Booking Cancelled)
         ▼
┌─────────────────┐     Locks next waitlist entry (ORDER BY created_at ASC FOR UPDATE)
│ Cancellation Tx │ ──▶ Transitions seat to 'available'
└────────┬────────┘     Sets waitlist: status = 'offered', offer_token = UUID, offer_expires_at = NOW() + 15m
         │
         ▼
┌─────────────────┐
│  Email Worker   │ ──▶ Sends transactional email with secure time-limited booking link
└────────┬────────┘
         │
    ┌────┴─────────────────────────────┐
    ▼                                  ▼
[Accepts Before Expiry]      [Offer Times Out (15 min)]
    │                                  │
    ▼                                  ▼
Locks seat + waitlist entry;   Scheduler marks status = 'expired';
Marks seat = 'booked';         Cascades offer to NEXT user in FIFO queue;
Dispatches QR ticket email.    Repeats until seat is claimed.
```

---

## 5. Time-Limited Offer Handling
1. **Cryptographic Tokens**: Each waitlist offer generates an immutable UUID token stored in `waitlist.offer_token` with an expiration timestamp (`offer_expires_at`).
2. **Idempotent Claim Processing**: When the customer clicks the link in their email:
   - The system checks `offer_expires_at > NOW()`.
   - It reserves an available seat in that specific category within a single atomic transaction.
   - It issues the booking reference, marks the waitlist record as `fulfilled`, and generates an email ticket with an embedded QR code.
3. **Graceful Cascading**: If the user abandons the offer, the 30-second scheduler marks the token `expired` and immediately triggers the assignment algorithm for the subsequent candidate in line.
