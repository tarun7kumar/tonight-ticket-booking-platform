import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, MapPin, Grid3X3, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import api from '../services/api';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateVenue, setShowCreateVenue] = useState(false);
  const [venueForm, setVenueForm] = useState({ name: '', address: '', total_rows: 10, total_columns: 15 });
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#8b5cf6' });
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [generatingSeats, setGeneratingSeats] = useState(false);
  const [seatGenForm, setSeatGenForm] = useState([]);

  useEffect(() => { fetchVenues(); }, []);

  const fetchVenues = async () => {
    try {
      const { data } = await api.get('/venues');
      setVenues(data.venues || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVenue = async (e) => {
    e.preventDefault();
    if (!venueForm.name) { toast.error('Venue name is required'); return; }
    try {
      const { data } = await api.post('/venues', venueForm);
      toast.success('Venue created!');
      setShowCreateVenue(false);
      setVenueForm({ name: '', address: '', total_rows: 10, total_columns: 15 });
      fetchVenues();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create venue');
    }
  };

  const handleAddCategory = async (venueId) => {
    if (!categoryForm.name) { toast.error('Category name is required'); return; }
    try {
      await api.post(`/venues/${venueId}/categories`, categoryForm);
      toast.success('Category added!');
      setCategoryForm({ name: '', color: '#8b5cf6' });
      loadVenueDetails(venueId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const loadVenueDetails = async (venueId) => {
    try {
      const { data } = await api.get(`/venues/${venueId}`);
      setSelectedVenue(data);
      setSeatGenForm(
        (data.categories || []).map(c => ({ category_id: c.id, name: c.name, from_row: '', to_row: '' }))
      );
    } catch (err) {
      toast.error('Failed to load venue');
    }
  };

  const handleGenerateSeats = async () => {
    if (!selectedVenue) return;
    const validCats = seatGenForm.filter(c => c.from_row && c.to_row);
    if (validCats.length === 0) { toast.error('Specify row ranges for at least one category'); return; }
    setGeneratingSeats(true);
    try {
      const { data } = await api.post(`/venues/${selectedVenue.venue.id}/generate-seats`, {
        categories: validCats.map(c => ({ category_id: c.category_id, from_row: c.from_row.toUpperCase(), to_row: c.to_row.toUpperCase() })),
      });
      toast.success(data.message);
      loadVenueDetails(selectedVenue.venue.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate seats');
    } finally {
      setGeneratingSeats(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}><LoadingSpinner size={48} /></div>;

  return (
    <div className="admin-dash">
      <div className="container">
        <motion.div className="dashboard__header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <h1 className="headline-lg">Admin Console</h1>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateVenue(!showCreateVenue)}>
            <Plus size={16} /> Create Venue
          </button>
        </motion.div>

        {showCreateVenue && (
          <motion.div className="org-dash__create-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <form onSubmit={handleCreateVenue}>
              <h3 className="headline-sm" style={{ marginBottom: 16 }}>New Venue</h3>
              <div className="org-form-grid">
                <div className="input-group"><label>Name *</label><input className="input" value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="input-group"><label>Address</label><input className="input" value={venueForm.address} onChange={e => setVenueForm(p => ({ ...p, address: e.target.value }))} /></div>
                <div className="input-group"><label>Rows</label><input type="number" className="input" value={venueForm.total_rows} onChange={e => setVenueForm(p => ({ ...p, total_rows: parseInt(e.target.value) || 10 }))} /></div>
                <div className="input-group"><label>Seats per Row</label><input type="number" className="input" value={venueForm.total_columns} onChange={e => setVenueForm(p => ({ ...p, total_columns: parseInt(e.target.value) || 15 }))} /></div>
              </div>
              <div className="flex gap-sm" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">Create</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateVenue(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        )}

        <div className="dashboard__list">
          {venues.map((venue, i) => (
            <motion.div key={venue.id} className="admin-venue-card" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="admin-venue-card__info">
                <div className="org-event-card__icon"><MapPin size={20} /></div>
                <div>
                  <h3>{venue.name}</h3>
                  <div className="booking-card__meta">
                    <span><Grid3X3 size={13} /> {venue.total_rows} rows × {venue.total_columns} cols</span>
                    <span>{venue.total_seats || 0} seats</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => loadVenueDetails(venue.id)}>Manage</button>
            </motion.div>
          ))}
        </div>

        {/* Venue Detail Modal */}
        {selectedVenue && (
          <div className="org-modal-overlay" onClick={() => setSelectedVenue(null)}>
            <motion.div className="org-modal" onClick={e => e.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ maxWidth: 700 }}>
              <div className="org-modal__header">
                <h3 className="headline-sm">{selectedVenue.venue.name}</h3>
                <button className="btn btn-icon" onClick={() => setSelectedVenue(null)}><X size={18} /></button>
              </div>

              {/* Add Category */}
              <div style={{ marginBottom: 24 }}>
                <h4 className="text-xs" style={{ marginBottom: 12 }}>Add Seat Category</h4>
                <div className="flex gap-sm items-center">
                  <input className="input" placeholder="Category name (e.g. Premium)" value={categoryForm.name} onChange={e => setCategoryForm(p => ({ ...p, name: e.target.value }))} style={{ flex: 1 }} />
                  <input type="color" value={categoryForm.color} onChange={e => setCategoryForm(p => ({ ...p, color: e.target.value }))} style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => handleAddCategory(selectedVenue.venue.id)}>Add</button>
                </div>
              </div>

              {/* Categories */}
              {selectedVenue.categories?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 className="text-xs" style={{ marginBottom: 12 }}>Categories</h4>
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    {selectedVenue.categories.map(c => (
                      <span key={c.id} className="badge" style={{ borderColor: c.color, color: c.color }}>{c.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Seats */}
              {seatGenForm.length > 0 && (
                <div>
                  <h4 className="text-xs" style={{ marginBottom: 12 }}>Generate Seat Grid</h4>
                  <p className="text-sm" style={{ marginBottom: 12, color: 'var(--text-tertiary)' }}>
                    Assign row ranges to each category. E.g., A to C for Premium, D to J for Standard.
                  </p>
                  {seatGenForm.map((cat, i) => (
                    <div key={cat.category_id} className="flex gap-sm items-center" style={{ marginBottom: 8 }}>
                      <span className="text-sm" style={{ width: 100 }}>{cat.name}</span>
                      <input className="input" placeholder="From (e.g. A)" value={cat.from_row} onChange={e => {
                        const n = [...seatGenForm]; n[i].from_row = e.target.value; setSeatGenForm(n);
                      }} style={{ width: 80 }} />
                      <span className="text-sm">to</span>
                      <input className="input" placeholder="To (e.g. C)" value={cat.to_row} onChange={e => {
                        const n = [...seatGenForm]; n[i].to_row = e.target.value; setSeatGenForm(n);
                      }} style={{ width: 80 }} />
                    </div>
                  ))}
                  <button className="btn btn-primary" onClick={handleGenerateSeats} disabled={generatingSeats} style={{ marginTop: 12 }}>
                    {generatingSeats ? 'Generating...' : 'Generate Seats'}
                  </button>
                </div>
              )}

              {/* Existing seats count */}
              {selectedVenue.seats?.length > 0 && (
                <p className="text-sm" style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
                  {selectedVenue.seats.length} seats configured
                </p>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
