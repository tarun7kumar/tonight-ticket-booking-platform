import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, Film, Music, Users, AlertCircle, ArrowLeft, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import SeatMap from '../components/seatmap/SeatMap';
import HoldTimer from '../components/shared/HoldTimer';
import TicketModal from '../components/shared/TicketModal';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { getPosterUrl, getBackdropUrl } from '../services/tmdb';
import './EventDetail.css';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isCustomer } = useAuth();
  const { joinEvent, leaveEvent, onSeatUpdate } = useSocket() || {};

  const [event, setEvent] = useState(null);
  const [pricing, setPricing] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [seats, setSeats] = useState([]);
  const [layout, setLayout] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [holdExpiry, setHoldExpiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [selectedWaitlistCategory, setSelectedWaitlistCategory] = useState(null);

  // Fetch event data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, seatsRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/events/${id}/seats`),
        ]);
        setEvent(eventRes.data.event);
        setPricing(eventRes.data.pricing || []);
        setAvailability(eventRes.data.availability || []);
        setSeats(seatsRes.data.seats || []);
        setLayout(seatsRes.data.layout);
      } catch (err) {
        console.error('Error fetching event:', err);
        toast.error('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Socket.IO: join event room for real-time updates
  useEffect(() => {
    if (joinEvent && id) {
      joinEvent(id);
      return () => leaveEvent?.(id);
    }
  }, [id, joinEvent, leaveEvent]);

  // Socket.IO: handle seat updates from other users
  useEffect(() => {
    if (!onSeatUpdate) return;
    const unsubscribe = onSeatUpdate((data) => {
      if (String(data.eventId) === String(id)) {
        setSeats((prev) =>
          prev.map((seat) => {
            const updated = data.seats.find((s) => s.id === seat.id);
            return updated ? { ...seat, ...updated } : seat;
          })
        );
      }
    });
    return unsubscribe;
  }, [id, onSeatUpdate]);

  // Handle seat selection
  const handleSeatSelect = useCallback((seat) => {
    setSelectedSeats((prev) => {
      const exists = prev.find((s) => s.id === seat.id);
      if (exists) return prev.filter((s) => s.id !== seat.id);
      if (prev.length >= 10) {
        toast.error('Maximum 10 seats per booking');
        return prev;
      }
      return [...prev, seat];
    });
  }, []);

  // Hold seats
  const handleHold = async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to book seats');
      navigate('/login');
      return;
    }
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }

    setHolding(true);
    try {
      const { data } = await api.post('/bookings/hold', {
        event_id: parseInt(id),
        seat_ids: selectedSeats.map((s) => s.id),
      });

      toast.success(data.message);
      setHoldExpiry(data.expires_at);

      // Update seat statuses locally
      setSeats((prev) =>
        prev.map((seat) => {
          const held = data.held_seats?.find((h) => h.id === seat.id);
          return held ? { ...seat, status: 'held', held_by: user.id } : seat;
        })
      );
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to hold seats';
      toast.error(msg);
      // Refresh seats in case of conflict
      try {
        const { data } = await api.get(`/events/${id}/seats`);
        setSeats(data.seats || []);
      } catch {}
      setSelectedSeats([]);
    } finally {
      setHolding(false);
    }
  };

  // Confirm booking
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const { data } = await api.post('/bookings/confirm', {
        event_id: parseInt(id),
      });

      toast.success('🎫 Booking confirmed!');
      setHoldExpiry(null);
      setSelectedSeats([]);
      setConfirmedBooking(data);

      // Refresh seats
      const seatsRes = await api.get(`/events/${id}/seats`);
      setSeats(seatsRes.data.seats || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking failed');
    } finally {
      setConfirming(false);
    }
  };

  // Release seats
  const handleRelease = async () => {
    try {
      await api.post('/bookings/release', { event_id: parseInt(id) });
      toast.success('Seats released');
      setHoldExpiry(null);
      setSelectedSeats([]);
      const { data } = await api.get(`/events/${id}/seats`);
      setSeats(data.seats || []);
    } catch (err) {
      toast.error('Failed to release seats');
    }
  };

  // Join waitlist
  const handleJoinWaitlist = async (categoryId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      const { data } = await api.post('/waitlist/join', {
        event_id: parseInt(id),
        category_id: categoryId,
      });
      toast.success(data.message);
      setShowWaitlistModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join waitlist');
    }
  };

  // Hold expired
  const handleHoldExpired = () => {
    toast.error('Your seat hold has expired');
    setHoldExpiry(null);
    setSelectedSeats([]);
    // Refresh
    api.get(`/events/${id}/seats`).then(({ data }) => setSeats(data.seats || []));
  };

  // Helpers
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const totalPrice = selectedSeats.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner size={48} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <h2>Event not found</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/events')} style={{ marginTop: 16 }}>
          <ArrowLeft size={16} /> Back to Events
        </button>
      </div>
    );
  }

  const posterSrc = event.poster_url?.startsWith('http') ? event.poster_url : getPosterUrl(event.poster_url);
  const backdropSrc = event.poster_url?.startsWith('http') ? null : getBackdropUrl(event.poster_url);

  return (
    <div className="event-detail">
      {/* Hero Banner */}
      <div className="event-detail__hero">
        {backdropSrc && (
          <div className="event-detail__backdrop">
            <img src={backdropSrc} alt="" className="event-detail__backdrop-img" />
            <div className="event-detail__backdrop-overlay" />
          </div>
        )}

        <div className="container">
          <motion.div
            className="event-detail__hero-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/events')} style={{ marginBottom: 16 }}>
              <ArrowLeft size={14} /> Back
            </button>

            <div className="event-detail__hero-info">
              {posterSrc && (
                <div className="event-detail__poster cinematic-img-wrapper">
                  <img src={posterSrc} alt={event.title} className="cinematic-img" />
                </div>
              )}

              <div className="event-detail__info">
                <div className="event-detail__badges">
                  <span className="badge badge-accent">
                    {event.type === 'movie' ? <Film size={10} /> : <Music size={10} />}
                    {event.type}
                  </span>
                  <span className="badge">{event.status}</span>
                </div>

                <h1 className="headline-md">{event.title}</h1>

                <div className="event-detail__meta">
                  <span className="event-detail__meta-item">
                    <Calendar size={16} />
                    {formatDate(event.event_date)}
                  </span>
                  <span className="event-detail__meta-item">
                    <Clock size={16} />
                    {formatTime(event.event_time)}
                  </span>
                  <span className="event-detail__meta-item">
                    <MapPin size={16} />
                    {event.venue_name}
                  </span>
                </div>

                {event.description && (
                  <p className="event-detail__desc">{event.description}</p>
                )}

                {/* Pricing */}
                {pricing.length > 0 && (
                  <div className="event-detail__pricing">
                    {pricing.map((p) => (
                      <div key={p.id} className="event-detail__price-tag" style={{ borderLeftColor: p.category_color }}>
                        <span className="event-detail__price-cat">{p.category_name}</span>
                        <span className="event-detail__price-val">₹{parseFloat(p.price).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Seat Map Section */}
      <div className="container">
        <div className="event-detail__seatmap-section">
          <div className="event-detail__seatmap-header">
            <h2 className="headline-sm">Select Your Seats</h2>
            <p className="text-sm">Click on available seats to select them. Maximum 10 seats per booking.</p>
          </div>

          <div className="event-detail__seatmap-layout">
            <div className="event-detail__seatmap-main">
              <SeatMap
                seats={seats}
                selectedSeats={selectedSeats}
                onSeatSelect={handleSeatSelect}
                currentUserId={user?.id}
                layout={layout}
              />
            </div>

            {/* Booking Sidebar */}
            <div className="event-detail__sidebar">
              <div className="event-detail__sidebar-card">
                <h3 className="headline-sm">Your Selection</h3>

                {holdExpiry && (
                  <HoldTimer expiresAt={holdExpiry} onExpired={handleHoldExpired} />
                )}

                {selectedSeats.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)', padding: '20px 0' }}>
                    No seats selected. Click on available seats in the map.
                  </p>
                ) : (
                  <div className="event-detail__selected-list">
                    {selectedSeats.map((seat) => (
                      <div key={seat.id} className="event-detail__selected-item">
                        <div>
                          <span className="event-detail__selected-seat">
                            {seat.row_label}{seat.seat_number}
                          </span>
                          <span className="text-xs">{seat.category_name}</span>
                        </div>
                        <span className="event-detail__selected-price">₹{parseFloat(seat.price || 0).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedSeats.length > 0 && (
                  <>
                    <div className="event-detail__total">
                      <span>Total ({selectedSeats.length} seats)</span>
                      <span className="event-detail__total-price">₹{totalPrice.toFixed(0)}</span>
                    </div>

                    {!holdExpiry ? (
                      <button
                        className="btn btn-primary w-full"
                        onClick={handleHold}
                        disabled={holding}
                      >
                        {holding ? <><Loader size={16} className="spin" /> Holding...</> : 'Hold Seats'}
                      </button>
                    ) : (
                      <div className="flex flex-col gap-sm">
                        <button
                          className="btn btn-primary w-full"
                          onClick={handleConfirm}
                          disabled={confirming}
                        >
                          {confirming ? <><Loader size={16} className="spin" /> Confirming...</> : '🎫 Confirm Booking'}
                        </button>
                        <button className="btn btn-ghost btn-sm w-full" onClick={handleRelease}>
                          Release Seats
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Availability Summary */}
              {availability.length > 0 && (
                <div className="event-detail__sidebar-card">
                  <h4 className="text-xs" style={{ marginBottom: 12 }}>Availability</h4>
                  {availability.map((a) => {
                    const isSoldOut = parseInt(a.available) === 0;
                    return (
                      <div key={a.category_id} className="event-detail__avail-row">
                        <div className="event-detail__avail-info">
                          <span className="event-detail__avail-dot" style={{ background: a.category_color }} />
                          <span>{a.category_name}</span>
                        </div>
                        <div className="event-detail__avail-right">
                          <span className="text-xs">{a.available}/{a.total_seats}</span>
                          {isSoldOut && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                              onClick={() => handleJoinWaitlist(a.category_id)}
                            >
                              Waitlist
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket & QR Code Modal */}
      <TicketModal
        isOpen={!!confirmedBooking}
        onClose={() => setConfirmedBooking(null)}
        bookingData={confirmedBooking}
        event={event}
      />
    </div>
  );
}
