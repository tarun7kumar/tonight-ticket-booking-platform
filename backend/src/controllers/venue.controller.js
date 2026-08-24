const { query } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * POST /api/venues
 * Admin creates a new venue
 */
const createVenue = asyncHandler(async (req, res) => {
  const { name, address, total_rows, total_columns } = req.body;

  if (!name || !total_rows || !total_columns) {
    return res.status(400).json({ error: 'Name, total_rows, and total_columns are required.' });
  }

  const result = await query(
    `INSERT INTO venues (name, address, total_rows, total_columns, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name.trim(), address || '', total_rows, total_columns, req.user.id]
  );

  res.status(201).json({ message: 'Venue created.', venue: result.rows[0] });
});

/**
 * GET /api/venues
 * List all venues
 */
const getVenues = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT v.*, u.name AS created_by_name,
      (SELECT COUNT(*) FROM venue_seats vs WHERE vs.venue_id = v.id) AS total_seats
     FROM venues v
     JOIN users u ON v.created_by = u.id
     ORDER BY v.created_at DESC`
  );

  res.json({ venues: result.rows });
});

/**
 * GET /api/venues/:id
 * Get venue details with seat categories and seats
 */
const getVenueById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const venueResult = await query('SELECT * FROM venues WHERE id = $1', [id]);
  if (venueResult.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  const categoriesResult = await query(
    'SELECT * FROM seat_categories WHERE venue_id = $1 ORDER BY name',
    [id]
  );

  const seatsResult = await query(
    `SELECT vs.*, sc.name AS category_name, sc.color AS category_color
     FROM venue_seats vs
     JOIN seat_categories sc ON vs.category_id = sc.id
     WHERE vs.venue_id = $1
     ORDER BY vs.row_label, vs.seat_number`,
    [id]
  );

  res.json({
    venue: venueResult.rows[0],
    categories: categoriesResult.rows,
    seats: seatsResult.rows,
  });
});

/**
 * PUT /api/venues/:id
 * Admin updates a venue
 */
const updateVenue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, address, total_rows, total_columns } = req.body;

  const result = await query(
    `UPDATE venues SET
       name = COALESCE($1, name),
       address = COALESCE($2, address),
       total_rows = COALESCE($3, total_rows),
       total_columns = COALESCE($4, total_columns)
     WHERE id = $5
     RETURNING *`,
    [name, address, total_rows, total_columns, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  res.json({ message: 'Venue updated.', venue: result.rows[0] });
});

/**
 * POST /api/venues/:id/categories
 * Admin adds a seat category to a venue
 */
const addCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  // Verify venue exists
  const venue = await query('SELECT id FROM venues WHERE id = $1', [id]);
  if (venue.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  const result = await query(
    `INSERT INTO seat_categories (venue_id, name, color)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, name.trim(), color || '#4A90D9']
  );

  res.status(201).json({ message: 'Category added.', category: result.rows[0] });
});

/**
 * POST /api/venues/:id/seats
 * Admin adds seats in bulk to a venue
 * Body: { seats: [{ category_id, row_label, seat_number, x_pos, y_pos }, ...] }
 */
const addSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { seats } = req.body;

  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'Seats array is required.' });
  }

  // Verify venue exists
  const venue = await query('SELECT id FROM venues WHERE id = $1', [id]);
  if (venue.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  // Build bulk insert
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const seat of seats) {
    if (!seat.category_id || !seat.row_label || seat.seat_number === undefined) {
      return res.status(400).json({ error: 'Each seat must have category_id, row_label, and seat_number.' });
    }
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
    );
    values.push(id, seat.category_id, seat.row_label, seat.seat_number, seat.x_pos || 0, seat.y_pos || 0);
    paramIndex += 6;
  }

  const result = await query(
    `INSERT INTO venue_seats (venue_id, category_id, row_label, seat_number, x_pos, y_pos)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (venue_id, row_label, seat_number) DO NOTHING
     RETURNING *`,
    values
  );

  res.status(201).json({
    message: `${result.rows.length} seat(s) added.`,
    seats: result.rows,
  });
});

/**
 * POST /api/venues/:id/generate-seats
 * Admin auto-generates a grid of seats for a venue based on rows, columns, and categories
 * Body: { categories: [{ category_id, from_row, to_row }] }
 * Example: categories: [{ category_id: 1, from_row: "A", to_row: "C" }, { category_id: 2, from_row: "D", to_row: "J" }]
 */
const generateSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { categories } = req.body;

  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: 'Categories array with row ranges is required.' });
  }

  // Verify venue exists
  const venueResult = await query('SELECT * FROM venues WHERE id = $1', [id]);
  if (venueResult.rows.length === 0) {
    return res.status(404).json({ error: 'Venue not found.' });
  }

  const venue = venueResult.rows[0];
  const seats = [];

  for (const cat of categories) {
    const fromCharCode = cat.from_row.toUpperCase().charCodeAt(0);
    const toCharCode = cat.to_row.toUpperCase().charCodeAt(0);

    for (let rowCode = fromCharCode; rowCode <= toCharCode; rowCode++) {
      const rowLabel = String.fromCharCode(rowCode);
      const rowIndex = rowCode - 'A'.charCodeAt(0);

      for (let seatNum = 1; seatNum <= venue.total_columns; seatNum++) {
        seats.push({
          category_id: cat.category_id,
          row_label: rowLabel,
          seat_number: seatNum,
          x_pos: seatNum - 1,
          y_pos: rowIndex,
        });
      }
    }
  }

  if (seats.length === 0) {
    return res.status(400).json({ error: 'No seats generated from the provided row ranges.' });
  }

  // Bulk insert
  const values = [];
  const placeholders = [];
  let paramIndex = 1;

  for (const seat of seats) {
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
    );
    values.push(id, seat.category_id, seat.row_label, seat.seat_number, seat.x_pos, seat.y_pos);
    paramIndex += 6;
  }

  const result = await query(
    `INSERT INTO venue_seats (venue_id, category_id, row_label, seat_number, x_pos, y_pos)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (venue_id, row_label, seat_number) DO NOTHING
     RETURNING *`,
    values
  );

  res.status(201).json({
    message: `${result.rows.length} seat(s) generated.`,
    total: result.rows.length,
  });
});

module.exports = { createVenue, getVenues, getVenueById, updateVenue, addCategory, addSeats, generateSeats };
