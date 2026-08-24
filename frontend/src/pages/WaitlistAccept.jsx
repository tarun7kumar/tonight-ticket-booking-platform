import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import api from '../services/api';
import './WaitlistAccept.css';

export default function WaitlistAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, accepting, success, error, expired
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    handleAccept();
  }, [token]);

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      const { data } = await api.post(`/waitlist/accept/${token}`);
      setBooking(data);
      setStatus('success');
      toast.success('🎫 Booking confirmed from waitlist!');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to accept offer';
      setError(errMsg);
      if (err.response?.status === 410) {
        setStatus('expired');
      } else {
        setStatus('error');
      }
    }
  };

  return (
    <div className="waitlist-accept">
      <motion.div
        className="waitlist-accept__card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {status === 'loading' || status === 'accepting' ? (
          <div className="waitlist-accept__loading">
            <LoadingSpinner size={48} />
            <h2 className="headline-sm">Accepting your offer...</h2>
            <p className="text-sm">We're booking your seat. Please wait.</p>
          </div>
        ) : status === 'success' ? (
          <div className="waitlist-accept__success">
            <div className="waitlist-accept__icon waitlist-accept__icon--success">
              <CheckCircle size={48} />
            </div>
            <h2 className="headline-md">Booking Confirmed!</h2>
            <p className="text-body">Your seat has been booked from the waitlist.</p>

            {booking?.booking && (
              <div className="waitlist-accept__details">
                <div className="waitlist-accept__ref">
                  <span className="text-xs">Booking Reference</span>
                  <span className="waitlist-accept__ref-code">{booking.booking.booking_ref}</span>
                </div>
                {booking.seat && (
                  <div className="waitlist-accept__seat">
                    <span className="text-xs">Your Seat</span>
                    <span className="waitlist-accept__seat-label">
                      {booking.seat.row_label}{booking.seat.seat_number}
                    </span>
                    <span className="text-sm">{booking.seat.category} — ₹{parseFloat(booking.seat.price).toFixed(0)}</span>
                  </div>
                )}
                {booking.booking.qr_code_data && (
                  <div className="waitlist-accept__qr">
                    <img src={booking.booking.qr_code_data} alt="QR Ticket" />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-md" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                <Ticket size={16} /> View My Bookings
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/events')}>
                Browse Events
              </button>
            </div>
          </div>
        ) : status === 'expired' ? (
          <div className="waitlist-accept__error">
            <div className="waitlist-accept__icon waitlist-accept__icon--warning">
              <Clock size={48} />
            </div>
            <h2 className="headline-md">Offer Expired</h2>
            <p className="text-body">{error}</p>
            <p className="text-sm">The seat has been offered to the next person in line.</p>
            <button className="btn btn-secondary" onClick={() => navigate('/events')} style={{ marginTop: 20 }}>
              Browse Events
            </button>
          </div>
        ) : (
          <div className="waitlist-accept__error">
            <div className="waitlist-accept__icon waitlist-accept__icon--error">
              <XCircle size={48} />
            </div>
            <h2 className="headline-md">Something Went Wrong</h2>
            <p className="text-body">{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/events')} style={{ marginTop: 20 }}>
              Browse Events
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
