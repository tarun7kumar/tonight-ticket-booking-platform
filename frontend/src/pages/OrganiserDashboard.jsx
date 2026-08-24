import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, BarChart3, Calendar, Users, DollarSign, Film, Music, Eye, X, Sparkles, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { getTrendingMovies, getPosterUrl } from '../services/tmdb';
import './OrganiserDashboard.css';

export default function OrganiserDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEventSummary, setSelectedEventSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [tmdbSuggestions, setTmdbSuggestions] = useState([]);

  const [form, setForm] = useState({
    venue_id: '', title: '', type: 'movie', description: '',
    event_date: '', event_time: '', hold_ttl_minutes: 10, poster_url: '',
    pricing: [],
  });


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, venuesRes, tmdbRes] = await Promise.allSettled([
        api.get('/events'),
        api.get('/venues'),
        getTrendingMovies(),
      ]);
      if (eventsRes.status === 'fulfilled') {
        const myEvents = eventsRes.value.data.events?.filter(e => e.organiser_name === user?.name) || eventsRes.value.data.events || [];
        setEvents(myEvents);
      }
      if (venuesRes.status === 'fulfilled') setVenues(venuesRes.value.data.venues || []);
      if (tmdbRes.status === 'fulfilled' && tmdbRes.value?.results) {
        setTmdbSuggestions(tmdbRes.value.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMovie = (movie) => {
    setForm(prev => ({
      ...prev,
      title: movie.title,
      description: movie.overview,
      poster_url: movie.poster_path,
      type: 'movie',
    }));
    toast.success(`Loaded "${movie.title}" details from TMDB!`);
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!form.venue_id || !form.title || !form.event_date || !form.event_time) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const { data } = await api.post('/events', {
        ...form,
        venue_id: parseInt(form.venue_id),
        pricing: form.pricing.filter(p => p.category_id && p.price),
      });
      toast.success(`Event created! ${data.seats_generated} seats generated.`);
      setShowCreateForm(false);
      setForm({ venue_id: '', title: '', type: 'movie', description: '', event_date: '', event_time: '', hold_ttl_minutes: 10, poster_url: '', pricing: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create event');
    }
  };

  const viewSummary = async (eventId) => {
    setSummaryLoading(true);
    try {
      const { data } = await api.get(`/bookings/event/${eventId}/summary`);
      setSelectedEventSummary(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleVenueChange = async (venueId) => {
    setForm(prev => ({ ...prev, venue_id: venueId, pricing: [] }));
    if (venueId) {
      try {
        const { data } = await api.get(`/venues/${venueId}`);
        const categories = data.categories || [];
        setForm(prev => ({
          ...prev,
          pricing: categories.map(c => ({ category_id: c.id, category_name: c.name, price: '' })),
        }));
      } catch {}
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}><LoadingSpinner size={48} /></div>;
  }

  return (
    <div className="org-dash">
      <div className="container">
        <motion.div className="dashboard__header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="headline-lg">My Events</h1>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus size={16} /> Create Event
          </button>
        </motion.div>

        {/* Create Event Form */}
        {showCreateForm && (
          <motion.div className="org-dash__create-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <form onSubmit={handleCreateEvent}>
              <h3 className="headline-sm" style={{ marginBottom: 16 }}>New Event</h3>

              {/* TMDB Quick-Fill for Movies */}
              {form.type === 'movie' && tmdbSuggestions.length > 0 && (
                <div style={{ marginBottom: 20, padding: 12, background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-xs" style={{ marginBottom: 8, color: 'var(--accent-primary)' }}>
                    <Sparkles size={14} />
                    <span className="text-xs" style={{ fontWeight: 600 }}>Quick Auto-Fill from TMDB:</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tmdbSuggestions.slice(0, 6).map(movie => (
                      <button
                        key={movie.id}
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', height: 'auto', background: form.title === movie.title ? 'var(--accent-glow)' : undefined }}
                        onClick={() => handleSelectMovie(movie)}
                      >
                        🎬 {movie.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="org-form-grid">
                <div className="input-group">
                  <label>Title *</label>
                  <input className="input" placeholder="Event title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label>Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="movie">Movie</option>
                    <option value="concert">Concert</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Venue *</label>
                  <select className="input" value={form.venue_id} onChange={e => handleVenueChange(e.target.value)}>
                    <option value="">Select venue...</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label>Date *</label>
                  <input type="date" className="input" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label>Time *</label>
                  <input type="time" className="input" value={form.event_time} onChange={e => setForm(p => ({ ...p, event_time: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label>Hold TTL (min)</label>
                  <input type="number" className="input" value={form.hold_ttl_minutes} onChange={e => setForm(p => ({ ...p, hold_ttl_minutes: parseInt(e.target.value) || 10 }))} />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Poster URL</label>
                  <input className="input" placeholder="https://... or TMDB poster path" value={form.poster_url} onChange={e => setForm(p => ({ ...p, poster_url: e.target.value }))} />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea className="input" rows={3} placeholder="Event description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>

              {form.pricing.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <label className="text-xs" style={{ marginBottom: 8, display: 'block' }}>Pricing per Category</label>
                  <div className="org-pricing-grid">
                    {form.pricing.map((p, i) => (
                      <div key={p.category_id} className="org-pricing-row">
                        <span className="text-sm">{p.category_name}</span>
                        <input
                          type="number"
                          className="input"
                          placeholder="Price ₹"
                          value={p.price}
                          onChange={e => {
                            const newPricing = [...form.pricing];
                            newPricing[i].price = e.target.value;
                            setForm(prev => ({ ...prev, pricing: newPricing }));
                          }}
                          style={{ width: 120 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-sm" style={{ marginTop: 20 }}>
                <button type="submit" className="btn btn-primary">Create Event</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Events List */}
        <div className="dashboard__list">
          {events.length === 0 ? (
            <div className="dashboard__empty">
              <Calendar size={48} strokeWidth={1} />
              <h3>No events created yet</h3>
              <p>Create your first event to start selling tickets.</p>
            </div>
          ) : (
            events.map((event, i) => (
              <motion.div
                key={event.id}
                className="org-event-card"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="org-event-card__info">
                  <div className="org-event-card__icon">
                    {event.type === 'movie' ? <Film size={20} /> : <Music size={20} />}
                  </div>
                  <div>
                    <h3>{event.title}</h3>
                    <div className="booking-card__meta">
                      <span><Calendar size={13} /> {new Date(event.event_date).toLocaleDateString()}</span>
                      <span><Users size={13} /> {event.available_seats || 0}/{event.total_seats || 0} available</span>
                    </div>
                  </div>
                </div>
                <div className="org-event-card__actions">
                  <span className={`badge ${event.status === 'upcoming' ? 'badge-accent' : 'badge-success'}`}>
                    {event.status}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => viewSummary(event.id)}>
                    <BarChart3 size={14} /> Summary
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Summary Modal */}
        {selectedEventSummary && (
          <div className="org-modal-overlay" onClick={() => setSelectedEventSummary(null)}>
            <motion.div
              className="org-modal"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="org-modal__header">
                <h3 className="headline-sm">{selectedEventSummary.event_title} — Summary</h3>
                <button className="btn btn-icon" onClick={() => setSelectedEventSummary(null)}><X size={18} /></button>
              </div>

              <div className="org-summary-stats">
                <div className="org-summary-stat">
                  <span className="org-summary-stat__value">{selectedEventSummary.summary?.confirmed_bookings || 0}</span>
                  <span className="org-summary-stat__label">Confirmed</span>
                </div>
                <div className="org-summary-stat">
                  <span className="org-summary-stat__value">{selectedEventSummary.summary?.cancelled_bookings || 0}</span>
                  <span className="org-summary-stat__label">Cancelled</span>
                </div>
                <div className="org-summary-stat">
                  <span className="org-summary-stat__value text-gradient">₹{parseFloat(selectedEventSummary.summary?.total_revenue || 0).toFixed(0)}</span>
                  <span className="org-summary-stat__label">Revenue</span>
                </div>
              </div>

              {selectedEventSummary.seat_status && (
                <div className="org-seats-summary">
                  <span>Available: {selectedEventSummary.seat_status.available}</span>
                  <span>Held: {selectedEventSummary.seat_status.held}</span>
                  <span>Booked: {selectedEventSummary.seat_status.booked}</span>
                </div>
              )}

              {selectedEventSummary.recent_bookings?.length > 0 && (
                <div className="org-recent">
                  <h4 className="text-xs" style={{ marginBottom: 12 }}>Recent Bookings</h4>
                  {selectedEventSummary.recent_bookings.map(b => (
                    <div key={b.id} className="org-recent-item">
                      <span>{b.customer_name}</span>
                      <span className="text-sm">{b.booking_ref}</span>
                      <span className="text-sm">₹{parseFloat(b.total_amount).toFixed(0)}</span>
                      <span className={`badge badge-sm ${b.status === 'confirmed' ? 'badge-success' : 'badge-danger'}`}>{b.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
