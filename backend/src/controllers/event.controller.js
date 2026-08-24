const { query, getClient } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * POST /api/events
 * Organiser creates a new event and generates show_seats rows
 */
const createEvent = asyncHandler(async (req, res) => {
  const { venue_id, title, type, description, poster_url, event_date, event_time, hold_ttl_minutes, pricing } = req.body;

  if (!venue_id || !title || !type || !event_date || !event_time) {
    return res.status(400).json({ error: 'venue_id, title, type, event_date, and event_time are required.' });
  }

  if (!['movie', 'concert'].includes(type)) {
    return res.status(400).json({ error: 'Event type must be "movie" or "concert".' });
  }

  // Verify venue exists
  const venueResult = await query('SELECT id FROM venues WHERE id = $1', [venue_id]);
  if (venueResult.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Create event
    const eventResult = await client.query(
      `INSERT INTO events (organiser_id, venue_id, title, type, description, poster_url, event_date, event_time, hold_ttl_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, venue_id, title.trim(), type, description || '', poster_url || '', event_date, event_time, hold_ttl_minutes || 10]
    );

    const event = eventResult.rows[0];

    // Insert pricing per category if provided
    if (pricing && Array.isArray(pricing)) {
      for (const p of pricing) {
        if (p.category_id && p.price !== undefined) {
          await client.query(
            `INSERT INTO event_pricing (event_id, category_id, price)
             VALUES ($1, $2, $3)`,
            [event.id, p.category_id, p.price]
          );
        }
      }
    }

    // Generate show_seats from venue_seats
    await client.query(
      `INSERT INTO show_seats (event_id, venue_seat_id)
       SELECT $1::int, id FROM venue_seats WHERE venue_id = $2::int`,
      [event.id, venue_id]
    );

    // Count generated seats
    const seatCountResult = await client.query(
      'SELECT COUNT(id) AS count FROM show_seats WHERE event_id = $1',
      [event.id]
    );

    await client.query('COMMIT');

    // Fetch pricing
    const pricingResult = await query(
      `SELECT ep.*, sc.name AS category_name
       FROM event_pricing ep
       JOIN seat_categories sc ON ep.category_id = sc.id
       WHERE ep.event_id = $1`,
      [event.id]
    );

    res.status(201).json({
      message: 'Event created.',
      event,
      pricing: pricingResult.rows,
      seats_generated: parseInt(seatCountResult.rows[0].count),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

/**
 * GET /api/events
 * List/filter events
 */
const getEvents = asyncHandler(async (req, res) => {
  const { type, date, search, status } = req.query;

  let sql = `
    SELECT 
      e.id, e.organiser_id, e.venue_id, e.title, e.type, e.description, e.poster_url,
      e.event_date, e.event_time, e.status, e.hold_ttl_minutes, e.created_at,
      v.name AS venue_name, v.address AS venue_address,
      u.name AS organiser_name
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    JOIN users u ON e.organiser_id = u.id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (type) {
    sql += ` AND e.type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  if (date) {
    sql += ` AND e.event_date = $${paramIndex}`;
    params.push(date);
    paramIndex++;
  }

  if (search) {
    sql += ` AND (e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (status) {
    sql += ` AND e.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  sql += ' ORDER BY e.event_date ASC, e.event_time ASC';

  const result = await query(sql, params);
  const events = result.rows || [];

  // Populate seat counts for each event
  for (const ev of events) {
    const seatCounts = await query(
      `SELECT 
         COUNT(id) AS total,
         COUNT(CASE WHEN status = 'available' THEN 1 END) AS available
       FROM show_seats
       WHERE event_id = $1`,
      [ev.id]
    );
    ev.total_seats = seatCounts.rows[0] ? parseInt(seatCounts.rows[0].total) : 0;
    ev.available_seats = seatCounts.rows[0] ? parseInt(seatCounts.rows[0].available) : 0;
  }

  res.json({ events });
});

/**
 * GET /api/events/:id
 * Get event details with pricing and seat availability summary
 */
const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const eventResult = await query(
    `SELECT e.*, v.name AS venue_name, v.address AS venue_address,
       v.total_rows, v.total_columns,
       u.name AS organiser_name
     FROM events e
     JOIN venues v ON e.venue_id = v.id
     JOIN users u ON e.organiser_id = u.id
     WHERE e.id = $1`,
    [id]
  );

  if (eventResult.rows.length === 0) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  // Get pricing by category
  const pricingResult = await query(
    `SELECT ep.*, sc.name AS category_name, sc.color AS category_color
     FROM event_pricing ep
     JOIN seat_categories sc ON ep.category_id = sc.id
     WHERE ep.event_id = $1`,
    [id]
  );

  // Get seat availability by category
  const availabilityResult = await query(
    `SELECT sc.id AS category_id, sc.name AS category_name, sc.color AS category_color,
       COUNT(ss.id) AS total_seats,
       COUNT(CASE WHEN ss.status = 'available' THEN 1 END) AS available,
       COUNT(CASE WHEN ss.status = 'held' THEN 1 END) AS held,
       COUNT(CASE WHEN ss.status = 'booked' THEN 1 END) AS booked
     FROM show_seats ss
     JOIN venue_seats vs ON ss.venue_seat_id = vs.id
     JOIN seat_categories sc ON vs.category_id = sc.id
     WHERE ss.event_id = $1
     GROUP BY sc.id, sc.name, sc.color`,
    [id]
  );

  res.json({
    event: eventResult.rows[0],
    pricing: pricingResult.rows,
    availability: availabilityResult.rows,
  });
});

/**
 * PUT /api/events/:id
 * Organiser updates their event
 */
const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, type, description, poster_url, event_date, event_time, status, hold_ttl_minutes, pricing } = req.body;

  // Verify ownership
  const existing = await query('SELECT organiser_id FROM events WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Event not found.' });
  }
  if (existing.rows[0].organiser_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'You can only update your own events.' });
  }

  const result = await query(
    `UPDATE events SET
       title = COALESCE($1, title),
       type = COALESCE($2, type),
       description = COALESCE($3, description),
       poster_url = COALESCE($4, poster_url),
       event_date = COALESCE($5, event_date),
       event_time = COALESCE($6, event_time),
       status = COALESCE($7, status),
       hold_ttl_minutes = COALESCE($8, hold_ttl_minutes)
     WHERE id = $9
     RETURNING *`,
    [title, type, description, poster_url, event_date, event_time, status, hold_ttl_minutes, id]
  );

  if (Array.isArray(pricing) && pricing.length > 0) {
    for (const p of pricing) {
      if (p.category_id && p.price !== undefined) {
        await query(
          `INSERT INTO event_pricing (event_id, category_id, price)
           VALUES ($1, $2, $3)
           ON CONFLICT (event_id, category_id)
           DO UPDATE SET price = EXCLUDED.price`,
          [id, p.category_id, p.price]
        );
      }
    }
  }

  res.json({ message: 'Event updated.', event: result.rows[0] });
});

/**
 * GET /api/events/:id/seats
 * Get full seat map with real-time status for an event
 */
const getEventSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await query(
    `SELECT ss.id, ss.status, ss.held_by,
       vs.row_label, vs.seat_number, vs.x_pos, vs.y_pos, vs.is_aisle,
       sc.id AS category_id, sc.name AS category_name, sc.color AS category_color,
       ep.price
     FROM show_seats ss
     JOIN venue_seats vs ON ss.venue_seat_id = vs.id
     JOIN seat_categories sc ON vs.category_id = sc.id
     LEFT JOIN event_pricing ep ON ep.event_id = ss.event_id AND ep.category_id = sc.id
     WHERE ss.event_id = $1
     ORDER BY vs.row_label, vs.seat_number`,
    [id]
  );

  // Get event info for layout dimensions
  const eventResult = await query(
    `SELECT e.hold_ttl_minutes, v.total_rows, v.total_columns
     FROM events e
     JOIN venues v ON e.venue_id = v.id
     WHERE e.id = $1`,
    [id]
  );

  res.json({
    seats: result.rows,
    layout: eventResult.rows.length > 0 ? eventResult.rows[0] : null,
  });
});

/**
 * Ensure default cinema venue with VIP, Premium, Standard seating exists
 */
async function ensureDefaultCinemaVenue(client) {
  let venueRes = await client.query("SELECT * FROM venues WHERE name LIKE '%The Grand Dolby Cinema%' LIMIT 1");
  if (venueRes.rows.length > 0) {
    return venueRes.rows[0];
  }

  // Get admin or organiser user to be the creator
  const userRes = await client.query("SELECT id FROM users WHERE role IN ('admin', 'organiser') ORDER BY id ASC LIMIT 1");
  const creatorId = userRes.rows[0]?.id || 1;

  // 1. Create Cinema Venue (8 rows x 12 columns = 96 seats)
  const newVenueRes = await client.query(
    `INSERT INTO venues (name, address, total_rows, total_columns, created_by)
     VALUES ('The Grand Dolby Cinema — Screen 1 (IMAX)', 'PVR INOX Luxe, 4th Floor, City Center', 8, 12, $1)
     RETURNING *`,
    [creatorId]
  );
  const venue = newVenueRes.rows[0];

  // 2. Create Categories: VIP ($24 / #8B5CF6), Premium ($18 / #3B82F6), Standard ($12 / #10B981)
  const vipCat = (await client.query(
    `INSERT INTO seat_categories (venue_id, name, color) VALUES ($1, 'VIP Recliner', '#8B5CF6') RETURNING *`,
    [venue.id]
  )).rows[0];

  const premCat = (await client.query(
    `INSERT INTO seat_categories (venue_id, name, color) VALUES ($1, 'Prime Plus', '#3B82F6') RETURNING *`,
    [venue.id]
  )).rows[0];

  const stdCat = (await client.query(
    `INSERT INTO seat_categories (venue_id, name, color) VALUES ($1, 'Classic 2D', '#10B981') RETURNING *`,
    [venue.id]
  )).rows[0];

  // 3. Generate Seat Grid (Rows A-B: VIP, Rows C-F: Premium, Rows G-H: Standard)
  const rows = [
    { label: 'A', cat: vipCat.id },
    { label: 'B', cat: vipCat.id },
    { label: 'C', cat: premCat.id },
    { label: 'D', cat: premCat.id },
    { label: 'E', cat: premCat.id },
    { label: 'F', cat: premCat.id },
    { label: 'G', cat: stdCat.id },
    { label: 'H', cat: stdCat.id },
  ];

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const { label, cat } = rows[rIdx];
    for (let c = 1; c <= 12; c++) {
      const isAisle = c === 4 || c === 9;
      await client.query(
        `INSERT INTO venue_seats (venue_id, category_id, row_label, seat_number, x_pos, y_pos, is_aisle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [venue.id, cat, label, c, c * 40, rIdx * 40, isAisle]
      );
    }
  }

  return venue;
}

/**
 * POST /api/events/movie-session
 * Automatically provisions or retrieves a bookable session for any TMDB movie
 */
const getOrCreateMovieSession = asyncHandler(async (req, res) => {
  const { title, poster_url, description, format, date, time } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Movie title is required.' });
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if an event already exists matching title
    const existing = await client.query(
      `SELECT e.*, v.name AS venue_name
       FROM events e
       JOIN venues v ON e.venue_id = v.id
       WHERE LOWER(e.title) = LOWER($1) AND e.status = 'upcoming'
       ORDER BY e.created_at DESC
       LIMIT 1`,
      [title.trim()]
    );

    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({ event: existing.rows[0] });
    }

    // Ensure venue exists
    const venue = await ensureDefaultCinemaVenue(client);

    // Get organiser user
    const userRes = await client.query("SELECT id FROM users WHERE role IN ('organiser', 'admin') ORDER BY id ASC LIMIT 1");
    const organiserId = userRes.rows[0]?.id || 1;

    const eventDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const eventTime = time || '19:30:00';
    const displayTitle = format ? `${title.trim()} (${format})` : title.trim();

    // Create event
    const eventRes = await client.query(
      `INSERT INTO events (organiser_id, venue_id, title, type, description, poster_url, event_date, event_time, hold_ttl_minutes)
       VALUES ($1, $2, $3, 'movie', $4, $5, $6, $7, 10)
       RETURNING *`,
      [organiserId, venue.id, displayTitle, description || '', poster_url || '', eventDate, eventTime]
    );
    const event = eventRes.rows[0];

    // Add pricing per category (Realistic Indian Cinema Market: ₹180 Classic / ₹320 Prime / ₹550 VIP Recliner)
    const categories = await client.query('SELECT id, name FROM seat_categories WHERE venue_id = $1', [venue.id]);
    for (const cat of categories.rows) {
      let price = 180.00;
      if (cat.name.includes('VIP')) price = 550.00;
      else if (cat.name.includes('Prime') || cat.name.includes('Premium')) price = 320.00;

      await client.query(
        `INSERT INTO event_pricing (event_id, category_id, price)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, category_id) DO UPDATE SET price = EXCLUDED.price`,
        [event.id, cat.id, price]
      );
    }

    // Generate show_seats
    await client.query(
      `INSERT INTO show_seats (event_id, venue_seat_id, status)
       SELECT $1::int, id, 'available' FROM venue_seats WHERE venue_id = $2::int`,
      [event.id, venue.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      event: { ...event, venue_name: venue.name },
      message: 'Movie session ready for booking.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = { 
  createEvent, 
  getEvents, 
  getEventById, 
  updateEvent, 
  getEventSeats, 
  getOrCreateMovieSession 
};
