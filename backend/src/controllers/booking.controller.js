const { query, getClient } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');
const { emitSeatUpdate } = require('../config/socket');
const { generateQRCode } = require('../services/qrcode.service');
const { sendBookingConfirmation, sendWaitlistOffer } = require('../services/email.service');

/**
 * Generate a unique booking reference
 */
const generateBookingRef = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = 'TKT-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
};

/**
 * POST /api/bookings/hold
 * Customer holds selected seats with TTL
 * Body: { event_id, seat_ids: [show_seat_id, ...] }
 */
const holdSeats = asyncHandler(async (req, res) => {
  const { event_id, seat_ids } = req.body;

  if (!event_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
    return res.status(400).json({ error: 'event_id and seat_ids array are required.' });
  }

  const numericSeatIds = seat_ids.map(id => parseInt(id)).filter(id => !isNaN(id));
  const numericEventId = parseInt(event_id);

  if (numericSeatIds.length === 0) {
    return res.status(400).json({ error: 'Valid seat_ids required.' });
  }

  if (numericSeatIds.length > 10) {
    return res.status(400).json({ error: 'Cannot hold more than 10 seats at once.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock the requested seats with FOR UPDATE to prevent concurrent holds
    const lockResult = await client.query(
      `SELECT id, status, held_by
       FROM show_seats
       WHERE id = ANY($1::int[]) AND event_id = $2
       FOR UPDATE`,
      [numericSeatIds, numericEventId]
    );

    if (lockResult.rows.length !== numericSeatIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more selected seats do not exist for this event.' });
    }

    // Check all seats are available
    const unavailable = lockResult.rows.filter(s => s.status !== 'available' && s.held_by !== req.user.id);
    if (unavailable.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'One or more seats are no longer available.',
        unavailable_seats: unavailable.map(s => ({ id: s.id, status: s.status })),
      });
    }

    // Release any previous held seats for this event that are not in the new selection
    await client.query(
      `UPDATE show_seats SET status = 'available', held_by = NULL, held_at = NULL
       WHERE event_id = $1 AND held_by = $2 AND status = 'held' AND NOT (id = ANY($3::int[]))`,
      [numericEventId, req.user.id, numericSeatIds]
    );

    // Hold the selected seats
    const holdResult = await client.query(
      `UPDATE show_seats
       SET status = 'held', held_by = $1, held_at = NOW()
       WHERE id = ANY($2::int[]) AND event_id = $3
       RETURNING id, status, held_by`,
      [req.user.id, numericSeatIds, numericEventId]
    );

    await client.query('COMMIT');

    // Emit real-time update
    emitSeatUpdate(numericEventId, holdResult.rows);

    // Get TTL for response
    const eventResult = await query('SELECT hold_ttl_minutes FROM events WHERE id = $1', [numericEventId]);
    const ttl = eventResult.rows.length > 0 ? eventResult.rows[0].hold_ttl_minutes : env.DEFAULT_HOLD_TTL_MINUTES;

    res.json({
      message: `${holdResult.rows.length} seat(s) held for ${ttl} minutes.`,
      held_seats: holdResult.rows,
      ttl_minutes: ttl,
      expires_at: new Date(Date.now() + ttl * 60 * 1000).toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/bookings/confirm
 * Customer confirms booking for their held seats
 * Body: { event_id }
 */
const confirmBooking = asyncHandler(async (req, res) => {
  const { event_id } = req.body;
  const numericEventId = parseInt(event_id);

  if (!numericEventId) {
    return res.status(400).json({ error: 'event_id is required.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock and get all seats held by this user for this event
    const heldSeats = await client.query(
      `SELECT ss.id, ss.venue_seat_id, vs.row_label, vs.seat_number,
         sc.id AS category_id, sc.name AS category_name,
         COALESCE(ep.price, 0) AS price
       FROM show_seats ss
       JOIN venue_seats vs ON ss.venue_seat_id = vs.id
       JOIN seat_categories sc ON vs.category_id = sc.id
       LEFT JOIN event_pricing ep ON ep.event_id = ss.event_id AND ep.category_id = sc.id
       WHERE ss.event_id = $1 AND ss.held_by = $2 AND ss.status = 'held'
       FOR UPDATE OF ss`,
      [numericEventId, req.user.id]
    );

    if (heldSeats.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No held seats found. They may have expired.' });
    }

    // Calculate total
    const totalAmount = heldSeats.rows.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

    // Generate booking reference
    const bookingRef = generateBookingRef();

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (event_id, user_id, booking_ref, total_amount, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING *`,
      [numericEventId, req.user.id, bookingRef, totalAmount]
    );

    const booking = bookingResult.rows[0];

    // Create booking_seats entries
    for (const seat of heldSeats.rows) {
      await client.query(
        `INSERT INTO booking_seats (booking_id, show_seat_id, price)
         VALUES ($1, $2, $3)`,
        [booking.id, seat.id, seat.price]
      );
    }

    // Update seat statuses to booked
    const seatIds = heldSeats.rows.map(s => s.id);

    const updatedSeats = await client.query(
      `UPDATE show_seats
       SET status = 'booked', booked_by = $1, held_by = NULL, held_at = NULL
       WHERE id = ANY($2::int[])
       RETURNING id, status`,
      [req.user.id, seatIds]
    );

    await client.query('COMMIT');

    // Emit real-time update
    emitSeatUpdate(numericEventId, updatedSeats.rows);

    // Generate QR code
    let qrCodeData = null;
    try {
      qrCodeData = await generateQRCode(bookingRef);
      await query('UPDATE bookings SET qr_code_data = $1 WHERE id = $2', [qrCodeData, booking.id]);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr.message);
    }

    // Send confirmation email
    try {
      const eventResult = await query(
        `SELECT e.title, e.event_date, e.event_time, v.name AS venue_name
         FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1`,
        [numericEventId]
      );
      const userResult = await query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);

      if (eventResult.rows.length > 0 && userResult.rows.length > 0) {
        await sendBookingConfirmation({
          to: userResult.rows[0].email,
          customerName: userResult.rows[0].name,
          bookingRef,
          eventTitle: eventResult.rows[0].title,
          eventDate: eventResult.rows[0].event_date,
          eventTime: eventResult.rows[0].event_time,
          venueName: eventResult.rows[0].venue_name,
          seats: heldSeats.rows.map(s => `${s.row_label}${s.seat_number} (${s.category_name})`),
          totalAmount,
          qrCodeData,
        });
      }
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Booking confirmed!',
      booking: {
        ...booking,
        qr_code_data: qrCodeData,
      },
      seats: heldSeats.rows.map(s => ({
        id: s.id,
        row_label: s.row_label,
        seat_number: s.seat_number,
        category: s.category_name,
        price: s.price,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * POST /api/bookings/release
 * Customer manually releases their held seats
 */
const releaseSeats = asyncHandler(async (req, res) => {
  const { event_id } = req.body;
  const numericEventId = parseInt(event_id);

  if (!numericEventId) {
    return res.status(400).json({ error: 'event_id is required.' });
  }

  const result = await query(
    `UPDATE show_seats
     SET status = 'available', held_by = NULL, held_at = NULL
     WHERE event_id = $1 AND held_by = $2 AND status = 'held'
     RETURNING id, status`,
    [numericEventId, req.user.id]
  );

  if (result.rows.length > 0) {
    emitSeatUpdate(numericEventId, result.rows);
  }

  res.json({
    message: `${result.rows.length} seat(s) released.`,
    released_seats: result.rows,
  });
});

/**
 * GET /api/bookings/my
 * Customer's booking history
 */
const getMyBookings = asyncHandler(async (req, res) => {
  const bookingsResult = await query(
    `SELECT b.*, e.title AS event_title, e.event_date, e.event_time, e.type AS event_type,
       v.name AS venue_name
     FROM bookings b
     JOIN events e ON b.event_id = e.id
     JOIN venues v ON e.venue_id = v.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );

  const bookings = bookingsResult.rows || [];

  for (const b of bookings) {
    const seatsRes = await query(
      `SELECT bs.show_seat_id, vs.row_label, vs.seat_number, sc.name AS category, bs.price
       FROM booking_seats bs
       JOIN show_seats ss ON bs.show_seat_id = ss.id
       JOIN venue_seats vs ON ss.venue_seat_id = vs.id
       JOIN seat_categories sc ON vs.category_id = sc.id
       WHERE bs.booking_id = $1`,
      [b.id]
    );
    b.seats = seatsRes.rows || [];
  }

  res.json({ bookings });
});

/**
 * POST /api/bookings/:id/cancel
 * Customer cancels their booking → triggers waitlist flow
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Verify booking belongs to user and is confirmed
    const bookingResult = await client.query(
      `SELECT b.*
       FROM bookings b
       WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'confirmed'`,
      [id, req.user.id]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Confirmed booking not found.' });
    }

    const booking = bookingResult.rows[0];

    const bookingSeatsRes = await client.query(
      `SELECT show_seat_id FROM booking_seats WHERE booking_id = $1`,
      [id]
    );
    const seatIds = bookingSeatsRes.rows.map(s => s.show_seat_id);

    // Cancel the booking
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
      [id]
    );

    // Release the seats
    let releasedSeats = { rows: [] };
    if (seatIds.length > 0) {
      releasedSeats = await client.query(
        `UPDATE show_seats
         SET status = 'available', booked_by = NULL
         WHERE id = ANY($1::int[])
         RETURNING id, status, venue_seat_id`,
        [seatIds]
      );
    }

    // Find category IDs of freed seats for waitlist processing
    let freedCategories = { rows: [] };
    if (seatIds.length > 0) {
      freedCategories = await client.query(
        `SELECT DISTINCT vs.category_id
         FROM venue_seats vs
         JOIN show_seats ss ON ss.venue_seat_id = vs.id
         WHERE ss.id = ANY($1::int[])`,
        [seatIds]
      );
    }

    // Process waitlist for each freed category
    const waitlistOffers = [];
    for (const cat of freedCategories.rows) {
      const nextInLine = await client.query(
        `SELECT w.*, u.name, u.email
         FROM waitlist w
         JOIN users u ON w.user_id = u.id
         WHERE w.event_id = $1 AND w.category_id = $2 AND w.status = 'waiting'
         ORDER BY w.created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [booking.event_id, cat.category_id]
      );

      if (nextInLine.rows.length > 0) {
        const waitlistEntry = nextInLine.rows[0];
        const offerToken = uuidv4();
        const offerExpiresAt = new Date(Date.now() + env.WAITLIST_OFFER_TTL_MINUTES * 60 * 1000);

        await client.query(
          `UPDATE waitlist SET status = 'offered', offer_token = $1, offered_at = NOW(), offer_expires_at = $2
           WHERE id = $3`,
          [offerToken, offerExpiresAt, waitlistEntry.id]
        );

        waitlistOffers.push({
          waitlist_id: waitlistEntry.id,
          user_name: waitlistEntry.name,
          user_email: waitlistEntry.email,
          category_id: cat.category_id,
          offer_token: offerToken,
          expires_at: offerExpiresAt,
        });
      }
    }

    await client.query('COMMIT');

    // Emit real-time seat update
    emitSeatUpdate(booking.event_id, releasedSeats.rows);

    // Send waitlist offer emails
    for (const offer of waitlistOffers) {
      try {
        const eventResult = await query(
          `SELECT e.title, e.event_date, e.event_time, v.name AS venue_name
           FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1`,
          [booking.event_id]
        );

        if (eventResult.rows.length > 0) {
          await sendWaitlistOffer({
            to: offer.user_email,
            customerName: offer.user_name,
            eventTitle: eventResult.rows[0].title,
            eventDate: eventResult.rows[0].event_date,
            eventTime: eventResult.rows[0].event_time,
            venueName: eventResult.rows[0].venue_name,
            offerToken: offer.offer_token,
            expiresAt: offer.expires_at,
          });
        }
      } catch (emailErr) {
        console.error('Waitlist offer email failed:', emailErr.message);
      }
    }

    res.json({
      message: 'Booking cancelled.',
      released_seats: releasedSeats.rows.length,
      waitlist_offers_sent: waitlistOffers.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * GET /api/bookings/event/:eventId/summary
 * Organiser views booking summary and revenue for their event
 */
const getEventBookingSummary = asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  // Verify organiser owns this event
  const eventResult = await query(
    'SELECT organiser_id, title FROM events WHERE id = $1',
    [eventId]
  );

  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  if (eventResult.rows[0].organiser_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only view summaries for your own events.' });
  }

  // Booking summary
  const summaryResult = await query(
    `SELECT
       COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmed_bookings,
       COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled_bookings,
       COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total_amount ELSE 0 END), 0) AS total_revenue
     FROM bookings
     WHERE event_id = $1`,
    [eventId]
  );

  // Revenue by category
  const categoryRevenue = await query(
    `SELECT sc.name AS category, sc.color,
       COUNT(bs.id) AS seats_booked,
       COALESCE(SUM(bs.price), 0) AS revenue
     FROM booking_seats bs
     JOIN show_seats ss ON bs.show_seat_id = ss.id
     JOIN venue_seats vs ON ss.venue_seat_id = vs.id
     JOIN seat_categories sc ON vs.category_id = sc.id
     JOIN bookings b ON bs.booking_id = b.id
     WHERE b.event_id = $1 AND b.status = 'confirmed'
     GROUP BY sc.id, sc.name, sc.color`,
    [eventId]
  );

  // Seat status summary
  const seatSummary = await query(
    `SELECT
       COUNT(id) AS total_seats,
       COUNT(CASE WHEN status = 'available' THEN 1 END) AS available,
       COUNT(CASE WHEN status = 'held' THEN 1 END) AS held,
       COUNT(CASE WHEN status = 'booked' THEN 1 END) AS booked
     FROM show_seats
     WHERE event_id = $1`,
    [eventId]
  );

  // Recent bookings
  const recentBookings = await query(
    `SELECT b.id, b.booking_ref, b.total_amount, b.status, b.created_at,
       u.name AS customer_name, u.email AS customer_email
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     WHERE b.event_id = $1
     ORDER BY b.created_at DESC
     LIMIT 20`,
    [eventId]
  );

  res.json({
    event_title: eventResult.rows[0].title,
    summary: summaryResult.rows[0] || {},
    seat_status: seatSummary.rows[0] || {},
    revenue_by_category: categoryRevenue.rows || [],
    recent_bookings: recentBookings.rows || [],
  });
});

module.exports = { holdSeats, confirmBooking, releaseSeats, getMyBookings, cancelBooking, getEventBookingSummary };
