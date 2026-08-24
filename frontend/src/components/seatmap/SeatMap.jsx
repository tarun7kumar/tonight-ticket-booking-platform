import { memo } from 'react';
import './SeatMap.css';

const Seat = memo(function Seat({ seat, isSelected, onSelect, currentUserId }) {
  const isAvailable = seat.status === 'available';
  const isHeld = seat.status === 'held';
  const isBooked = seat.status === 'booked';
  const isMyHold = isHeld && seat.held_by === currentUserId;

  let statusClass = 'seat--available';
  if (isSelected) statusClass = 'seat--selected';
  else if (isMyHold) statusClass = 'seat--my-hold';
  else if (isHeld) statusClass = 'seat--held';
  else if (isBooked) statusClass = 'seat--booked';

  const canSelect = isAvailable || isMyHold;

  const handleClick = () => {
    if (canSelect && onSelect) {
      onSelect(seat);
    }
  };

  return (
    <button
      className={`seat ${statusClass}`}
      onClick={handleClick}
      disabled={!canSelect && !isSelected}
      title={`${seat.row_label}${seat.seat_number} — ${seat.category_name} — ₹${seat.price || 0}`}
      style={{
        '--seat-color': seat.category_color || 'var(--accent)',
      }}
    >
      <span className="seat__number">{seat.seat_number}</span>
    </button>
  );
});

export default function SeatMap({ seats, selectedSeats, onSeatSelect, currentUserId, layout }) {
  if (!seats || seats.length === 0) {
    return (
      <div className="seatmap__empty">
        <p>No seats available for this event.</p>
      </div>
    );
  }

  // Group seats by row
  const rows = {};
  seats.forEach((seat) => {
    if (!rows[seat.row_label]) rows[seat.row_label] = [];
    rows[seat.row_label].push(seat);
  });

  // Sort rows and seats within each row
  const sortedRows = Object.entries(rows)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rowLabel, rowSeats]) => ({
      label: rowLabel,
      seats: rowSeats.sort((a, b) => a.seat_number - b.seat_number),
    }));

  const selectedIds = new Set(selectedSeats.map((s) => s.id));

  return (
    <div className="seatmap">
      {/* Screen indicator */}
      <div className="seatmap__screen-wrapper">
        <div className="seatmap__screen">
          <span className="seatmap__screen-label">SCREEN</span>
        </div>
        <div className="seatmap__screen-glow" />
      </div>

      {/* Seat grid */}
      <div className="seatmap__grid">
        {sortedRows.map((row) => (
          <div key={row.label} className="seatmap__row">
            <span className="seatmap__row-label">{row.label}</span>
            <div className="seatmap__row-seats">
              {row.seats.map((seat) => (
                <Seat
                  key={seat.id}
                  seat={seat}
                  isSelected={selectedIds.has(seat.id)}
                  onSelect={onSeatSelect}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
            <span className="seatmap__row-label">{row.label}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <SeatLegend seats={seats} />
    </div>
  );
}

function SeatLegend({ seats }) {
  // Get unique categories
  const categories = [];
  const seen = new Set();
  seats.forEach((s) => {
    if (!seen.has(s.category_name)) {
      seen.add(s.category_name);
      categories.push({ name: s.category_name, color: s.category_color, price: s.price });
    }
  });

  return (
    <div className="seatmap__legend">
      <div className="seatmap__legend-statuses">
        <div className="seatmap__legend-item">
          <span className="seatmap__legend-dot seat-dot--available" />
          Available
        </div>
        <div className="seatmap__legend-item">
          <span className="seatmap__legend-dot seat-dot--selected" />
          Selected
        </div>
        <div className="seatmap__legend-item">
          <span className="seatmap__legend-dot seat-dot--held" />
          Held
        </div>
        <div className="seatmap__legend-item">
          <span className="seatmap__legend-dot seat-dot--booked" />
          Booked
        </div>
      </div>
      <div className="seatmap__legend-categories">
        {categories.map((cat) => (
          <div key={cat.name} className="seatmap__legend-item">
            <span
              className="seatmap__legend-dot"
              style={{ background: cat.color }}
            />
            {cat.name} {cat.price ? `— ₹${cat.price}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
