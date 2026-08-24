const { query, getClient } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const { asyncHandler } = require('../middleware/errorHandler');
const { emitSeatUpdate } = require('../config/socket');
const { generateQRCode } = require('../services/qrcode.service');
const { sendBookingConfirmation, sendWaitlistOffer } = require('../services/email.service');

/**
 * POST /api/waitlist/join
 * Customer joins waitlist for a specific seat category on a sold-out event
 * Body: { event_id, category_id }
 */
const joinWaitlist = asyncHandler(async (req, res) => {
  const { event_id, category_id } = req.body;

  if (!event_id || !category_id) {
    return res.status(400).json({ error: 'event_id and category_id are required.' });
  }

  // Check if event exists
  const eventResult = await query('SELECT id, title FROM events WHERE id = $1', [event_id]);
  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  // Check if category exists
  const catResult = await query('SELECT id, name FROM seat_categories WHERE id = $1', [category_id]);
  if (catResult.rows.length === 0) {
    return res.status(404).json({ error: 'Seat category not found.' });
  }

  // Check if there are truly no available seats in this category
  const available = await query(
    `SELECT COUNT(*) AS count
     FROM show_seats ss
     JOIN venue_seats vs ON ss.venue_seat_id = vs.id
     WHERE ss.event_id = $1 AND vs.category_id = $2 AND ss.status = 'available'`,
    [event_id, category_id]
  );

  if (parseInt(available.rows[0].count) > 0) {
    return res.status(400).json({
      error: 'Seats are still available in this category. Please book directly.',
      available_count: parseInt(available.rows[0].count),
    });
  }

  // Add to waitlist
  const result = await query(
    `INSERT INTO waitlist (event_id, category_id, user_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [event_id, category_id, req.user.id]
  );

  // Get position in queue
  const positionResult = await query(
    `SELECT COUNT(*) AS position
     FROM waitlist
     WHERE event_id = $1 AND category_id = $2 AND status = 'waiting' AND created_at <= $3`,
    [event_id, category_id, result.rows[0].created_at]
  );

  res.status(201).json({
    message: `Added to waitlist for ${catResult.rows[0].name}.`,
    waitlist_entry: result.rows[0],
    position: parseInt(positionResult.rows[0].position),
  });
});

/**
 * GET /api/waitlist/my
 * Customer's waitlist entries
 */
const getMyWaitlist = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT w.*, e.title AS event_title, e.event_date, e.event_time,
       sc.name AS category_name, sc.color AS category_color,
       v.name AS venue_name
     FROM waitlist w
     JOIN events e ON w.event_id = e.id
     JOIN seat_categories sc ON w.category_id = sc.id
     JOIN venues v ON e.venue_id = v.id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );

  res.json({ waitlist: result.rows });
});

/**
 * POST /api/waitlist/accept/:token
 * Customer accepts a waitlist offer and books an available seat
 */
const acceptWaitlistOffer = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Find the waitlist offer by token
    const waitlistResult = await client.query(
      `SELECT w.*, u.name AS user_name, u.email AS user_email
       FROM waitlist w
       JOIN users u ON w.user_id = u.id
       WHERE w.offer_token = $1 AND w.status = 'offered'
       FOR UPDATE OF w`,
      [token]
    );

    if (waitlistResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Offer not found or already used/expired.' });
    }

    const entry = waitlistResult.rows[0];

    // Check if offer has expired
    if (new Date(entry.offer_expires_at) < new Date()) {
      await client.query(
        `UPDATE waitlist SET status = 'expired' WHERE id = $1`,
        [entry.id]
      );
      await client.query('COMMIT');
      return res.status(410).json({ error: 'This offer has expired.' });
    }

    // Find an available seat in the category
    const seatResult = await client.query(
      `SELECT ss.id, vs.row_label, vs.seat_number, sc.name AS category_name,
         COALESCE(ep.price, 0) AS price
       FROM show_seats ss
       JOIN venue_seats vs ON ss.venue_seat_id = vs.id
       JOIN seat_categories sc ON vs.category_id = sc.id
       LEFT JOIN event_pricing ep ON ep.event_id = ss.event_id AND ep.category_id = sc.id
       WHERE ss.event_id = $1
         AND vs.category_id = $2
         AND ss.status = 'available'
       ORDER BY vs.row_label, vs.seat_number
       LIMIT 1
       FOR UPDATE OF ss`,
      [entry.event_id, entry.category_id]
    );

    if (seatResult.rows.length === 0) {
      // No seat available — keep in waitlist as waiting
      await client.query(
        `UPDATE waitlist SET status = 'waiting', offer_token = NULL, offered_at = NULL, offer_expires_at = NULL WHERE id = $1`,
        [entry.id]
      );
      await client.query('COMMIT');
      return res.status(409).json({ error: 'No available seats at this moment. You have been re-added to the waitlist.' });
    }

    const seat = seatResult.rows[0];

    // Generate booking
    const bookingRef = 'TKT-' + uuidv4().substring(0, 8).toUpperCase();
    const totalAmount = parseFloat(seat.price);

    const bookingResult = await client.query(
      `INSERT INTO bookings (event_id, user_id, booking_ref, total_amount, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING *`,
      [entry.event_id, entry.user_id, bookingRef, totalAmount]
    );

    const booking = bookingResult.rows[0];

    // Create booking_seat
    await client.query(
      `INSERT INTO booking_seats (booking_id, show_seat_id, price) VALUES ($1, $2, $3)`,
      [booking.id, seat.id, seat.price]
    );

    // Mark seat as booked
    const updatedSeat = await client.query(
      `UPDATE show_seats SET status = 'booked', booked_by = $1
       WHERE id = $2
       RETURNING id, status`,
      [entry.user_id, seat.id]
    );

    // Mark waitlist entry as fulfilled
    await client.query(
      `UPDATE waitlist SET status = 'fulfilled' WHERE id = $1`,
      [entry.id]
    );

    await client.query('COMMIT');

    // Emit seat update
    emitSeatUpdate(entry.event_id, updatedSeat.rows);

    // Generate QR and send email
    let qrCodeData = null;
    try {
      qrCodeData = await generateQRCode(bookingRef);
      await query('UPDATE bookings SET qr_code_data = $1 WHERE id = $2', [qrCodeData, booking.id]);
    } catch (qrErr) {
      console.error('QR generation failed:', qrErr.message);
    }

    try {
      const eventResult = await query(
        `SELECT e.title, e.event_date, e.event_time, v.name AS venue_name
         FROM events e JOIN venues v ON e.venue_id = v.id WHERE e.id = $1`,
        [entry.event_id]
      );

      if (eventResult.rows.length > 0) {
        await sendBookingConfirmation({
          to: entry.user_email,
          customerName: entry.user_name,
          bookingRef,
          eventTitle: eventResult.rows[0].title,
          eventDate: eventResult.rows[0].event_date,
          eventTime: eventResult.rows[0].event_time,
          venueName: eventResult.rows[0].venue_name,
          seats: [`${seat.row_label}${seat.seat_number} (${seat.category_name})`],
          totalAmount,
          qrCodeData,
        });
      }
    } catch (emailErr) {
      console.error('Booking email failed:', emailErr.message);
    }

    res.status(201).json({
      message: 'Booking confirmed from waitlist!',
      booking: { ...booking, qr_code_data: qrCodeData },
      seat: {
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        category: seat.category_name,
        price: seat.price,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/waitlist/:id
 * Customer removes themselves from waitlist
 */
const leaveWaitlist = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `DELETE FROM waitlist WHERE id = $1 AND user_id = $2 AND status IN ('waiting', 'offered')
     RETURNING *`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Waitlist entry not found or cannot be removed.' });
  }

  res.json({ message: 'Removed from waitlist.', removed: result.rows[0] });
});

module.exports = { joinWaitlist, getMyWaitlist, acceptWaitlistOffer, leaveWaitlist };
