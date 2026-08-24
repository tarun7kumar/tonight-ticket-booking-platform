const cron = require('node-cron');
const { query } = require('../config/db');
const env = require('../config/env');
const { emitSeatUpdate } = require('../config/socket');
const { sendWaitlistOffer } = require('./email.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Release expired seat holds
 * Runs every SCHEDULER_INTERVAL_SECONDS
 */
const releaseExpiredHolds = async () => {
  try {
    // 1. Fetch currently held seats with their event hold TTL
    const heldResult = await query(
      `SELECT ss.id, ss.event_id, ss.held_at, COALESCE(e.hold_ttl_minutes, $1) AS hold_ttl_minutes
       FROM show_seats ss
       JOIN events e ON ss.event_id = e.id
       WHERE ss.status = 'held' AND ss.held_at IS NOT NULL`,
      [env.DEFAULT_HOLD_TTL_MINUTES]
    );

    if (!heldResult.rows || heldResult.rows.length === 0) return;

    const now = Date.now();
    const expiredSeatIds = [];

    for (const seat of heldResult.rows) {
      const heldTime = new Date(seat.held_at).getTime();
      const ttlMs = (parseInt(seat.hold_ttl_minutes) || 10) * 60 * 1000;
      if (heldTime + ttlMs <= now) {
        expiredSeatIds.push(seat.id);
      }
    }

    if (expiredSeatIds.length === 0) return;

    // 2. Release expired seats
    const result = await query(
      `UPDATE show_seats
       SET status = 'available', held_by = NULL, held_at = NULL
       WHERE id = ANY($1)
       RETURNING id, event_id, status`,
      [expiredSeatIds]
    );

    if (result.rows && result.rows.length > 0) {
      console.log(`🔓 Released ${result.rows.length} expired seat hold(s).`);

      // Group by event and emit updates
      const byEvent = {};
      for (const seat of result.rows) {
        if (!byEvent[seat.event_id]) byEvent[seat.event_id] = [];
        byEvent[seat.event_id].push({ id: seat.id, status: seat.status });
      }

      for (const [eventId, seats] of Object.entries(byEvent)) {
        emitSeatUpdate(parseInt(eventId), seats);
      }
    }
  } catch (err) {
    console.error('❌ Error releasing expired holds:', err.message);
  }
};

/**
 * Process expired waitlist offers
 * When an offer expires, mark it expired and offer to the next person
 */
const processExpiredOffers = async () => {
  try {
    // 1. Fetch currently offered waitlist entries
    const offeredResult = await query(
      `SELECT id, event_id, category_id, offer_expires_at
       FROM waitlist
       WHERE status = 'offered' AND offer_expires_at IS NOT NULL`
    );

    if (!offeredResult.rows || offeredResult.rows.length === 0) return;

    const now = Date.now();
    const expiredOffers = [];

    for (const offer of offeredResult.rows) {
      const expiresTime = new Date(offer.offer_expires_at).getTime();
      if (expiresTime <= now) {
        expiredOffers.push(offer);
      }
    }

    if (expiredOffers.length === 0) return;

    const expiredIds = expiredOffers.map(o => o.id);

    // 2. Mark as expired
    const expiredResult = await query(
      `UPDATE waitlist
       SET status = 'expired'
       WHERE id = ANY($1)
       RETURNING id, event_id, category_id`,
      [expiredIds]
    );

    if (expiredResult.rows && expiredResult.rows.length > 0) {
      console.log(`⏰ Expired ${expiredResult.rows.length} waitlist offer(s).`);

      // For each expired offer, cascade to next in line
      for (const expired of expiredResult.rows) {
        try {
          const nextInLine = await query(
            `SELECT w.*, u.name, u.email
             FROM waitlist w
             JOIN users u ON w.user_id = u.id
             WHERE w.event_id = $1 AND w.category_id = $2 AND w.status = 'waiting'
             ORDER BY w.created_at ASC
             LIMIT 1`,
            [expired.event_id, expired.category_id]
          );

          if (nextInLine.rows && nextInLine.rows.length > 0) {
            const entry = nextInLine.rows[0];
            const offerToken = uuidv4();
            const offerExpiresAt = new Date(Date.now() + env.WAITLIST_OFFER_TTL_MINUTES * 60 * 1000);

            await query(
              `UPDATE waitlist
               SET status = 'offered', offer_token = $1, offered_at = NOW(), offer_expires_at = $2
               WHERE id = $3`,
              [offerToken, offerExpiresAt, entry.id]
            );

            // Send offer email
            try {
              const eventResult = await query(
                `SELECT e.title, e.event_date, e.event_time, v.name AS venue_name
                 FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1`,
                [expired.event_id]
              );

              if (eventResult.rows && eventResult.rows.length > 0) {
                await sendWaitlistOffer({
                  to: entry.email,
                  customerName: entry.name,
                  eventTitle: eventResult.rows[0].title,
                  eventDate: eventResult.rows[0].event_date,
                  eventTime: eventResult.rows[0].event_time,
                  venueName: eventResult.rows[0].venue_name,
                  offerToken,
                  expiresAt: offerExpiresAt,
                });
              }
            } catch (emailErr) {
              console.error('Failed to send waitlist offer email:', emailErr.message);
            }

            console.log(`📩 Waitlist offer sent to next in line (${entry.email}) for event ${expired.event_id}`);
          }
        } catch (innerErr) {
          console.error('Error processing next waitlist entry:', innerErr.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing expired offers:', err.message);
  }
};

/**
 * Start all scheduled jobs
 */
const startScheduler = () => {
  const intervalSeconds = env.SCHEDULER_INTERVAL_SECONDS;

  if (intervalSeconds < 60) {
    setInterval(async () => {
      await releaseExpiredHolds();
      await processExpiredOffers();
    }, intervalSeconds * 1000);
    console.log(`⏱️  Scheduler running every ${intervalSeconds} seconds`);
  } else {
    const minutes = Math.floor(intervalSeconds / 60);
    const cronExpr = `*/${minutes} * * * *`;
    
    cron.schedule(cronExpr, async () => {
      await releaseExpiredHolds();
      await processExpiredOffers();
    });
    console.log(`⏱️  Scheduler running on cron: ${cronExpr}`);
  }

  // Run once after initial DB boot
  setTimeout(async () => {
    await releaseExpiredHolds();
    await processExpiredOffers();
  }, 2000);
};

module.exports = { startScheduler, releaseExpiredHolds, processExpiredOffers };
