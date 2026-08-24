import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ticket, Calendar, MapPin, Clock, X, QrCode, AlertCircle, Film, Music } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import TicketModal from '../components/shared/TicketModal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bookings');
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bookingsRes, waitlistRes] = await Promise.allSettled([
        api.get('/bookings/my'),
        api.get('/waitlist/my'),
      ]);
      if (bookingsRes.status === 'fulfilled') setBookings(bookingsRes.value.data.bookings || []);
      if (waitlistRes.status === 'fulfilled') setWaitlist(waitlistRes.value.data.waitlist || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await api.post(`/bookings/${bookingId}/cancel`);
      toast.success('Booking cancelled');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancellation failed');
    }
  };

  const handleLeaveWaitlist = async (waitlistId) => {
    try {
      await api.delete(`/waitlist/${waitlistId}`);
      toast.success('Removed from waitlist');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to leave waitlist');
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <LoadingSpinner size={48} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="container">
        <motion.div
          className="dashboard__header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="headline-lg">Hi, {user?.name?.split(' ')[0]}</h1>
          </div>
          <Link to="/events" className="btn btn-primary btn-sm">Browse Events</Link>
        </motion.div>

        {/* Tabs */}
        <div className="dashboard__tabs">
          <button
            className={`dashboard__tab ${activeTab === 'bookings' ? 'dashboard__tab--active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <Ticket size={16} /> My Bookings ({bookings.length})
          </button>
          <button
            className={`dashboard__tab ${activeTab === 'waitlist' ? 'dashboard__tab--active' : ''}`}
            onClick={() => setActiveTab('waitlist')}
          >
            <Clock size={16} /> Waitlist ({waitlist.length})
          </button>
        </div>

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="dashboard__content">
            {bookings.length === 0 ? (
              <div className="dashboard__empty">
                <Ticket size={48} strokeWidth={1} />
                <h3>No bookings yet</h3>
                <p>Start by exploring events and booking your seats!</p>
                <Link to="/events" className="btn btn-secondary">Explore Events</Link>
              </div>
            ) : (
              <div className="dashboard__list">
                {bookings.map((booking, i) => (
                  <motion.div
                    key={booking.id}
                    className="booking-card"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="booking-card__left">
                      <div className="booking-card__event-icon">
                        {booking.event_type === 'movie' ? <Film size={20} /> : <Music size={20} />}
                      </div>
                      <div className="booking-card__info">
                        <h3 className="booking-card__title">
                          <Link to={`/events/${booking.event_id}`}>{booking.event_title}</Link>
                        </h3>
                        <div className="booking-card__meta">
                          <span><Calendar size={13} /> {formatDate(booking.event_date)}</span>
                          <span><Clock size={13} /> {formatTime(booking.event_time)}</span>
                          <span><MapPin size={13} /> {booking.venue_name}</span>
                        </div>
                        <div className="booking-card__seats">
                          {booking.seats?.map((s, idx) => (
                            <span key={idx} className="booking-card__seat-badge">
                              {s.row_label}{s.seat_number}
                              <span className="text-xs" style={{ opacity: 0.6 }}>{s.category}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="booking-card__right">
                      <div className="booking-card__ref">
                        <span className="text-xs">Booking Ref</span>
                        <span className="booking-card__ref-code">{booking.booking_ref}</span>
                      </div>
                      <span className={`badge ${booking.status === 'confirmed' ? 'badge-success' : 'badge-danger'}`}>
                        {booking.status}
                      </span>
                      <span className="booking-card__amount">₹{parseFloat(booking.total_amount).toFixed(0)}</span>

                      {booking.qr_code_data && (
                        <div
                          className="booking-card__qr"
                          onClick={() => setSelectedTicket(booking)}
                          title="Click to expand QR Ticket"
                          style={{ cursor: 'pointer' }}
                        >
                          <img src={booking.qr_code_data} alt="QR Code" />
                        </div>
                      )}

                      <div className="flex gap-xs" style={{ marginTop: 4 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                          onClick={() => setSelectedTicket(booking)}
                        >
                          <QrCode size={13} /> QR Ticket
                        </button>
                        {booking.status === 'confirmed' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '5px 8px' }}
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            <X size={13} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Waitlist Tab */}
        {activeTab === 'waitlist' && (
          <div className="dashboard__content">
            {waitlist.length === 0 ? (
              <div className="dashboard__empty">
                <AlertCircle size={48} strokeWidth={1} />
                <h3>No waitlist entries</h3>
                <p>When an event is sold out, you can join the waitlist to be notified.</p>
              </div>
            ) : (
              <div className="dashboard__list">
                {waitlist.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    className="waitlist-card"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="waitlist-card__info">
                      <h3>{entry.event_title}</h3>
                      <div className="booking-card__meta">
                        <span><Calendar size={13} /> {formatDate(entry.event_date)}</span>
                        <span><MapPin size={13} /> {entry.venue_name}</span>
                      </div>
                      <span className="text-sm">Category: <strong style={{ color: entry.category_color }}>{entry.category_name}</strong></span>
                    </div>
                    <div className="waitlist-card__right">
                      <span className={`badge ${
                        entry.status === 'waiting' ? 'badge-warning' :
                        entry.status === 'offered' ? 'badge-accent' :
                        entry.status === 'fulfilled' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {entry.status}
                      </span>
                      {entry.status === 'waiting' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleLeaveWaitlist(entry.id)}>
                          Leave
                        </button>
                      )}
                      {entry.status === 'offered' && entry.offer_token && (
                        <Link to={`/waitlist/accept/${entry.offer_token}`} className="btn btn-primary btn-sm">
                          Accept Offer
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Ticket Modal */}
      <TicketModal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        bookingData={selectedTicket}
      />
    </div>
  );
}
