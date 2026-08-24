import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  X, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  MapPin, 
  Ticket as TicketIcon, 
  Sparkles,
  ExternalLink 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './TicketModal.css';

export default function TicketModal({ isOpen, onClose, bookingData, event }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !bookingData) return null;

  const booking = bookingData.booking || bookingData;
  const seats = bookingData.seats || booking.seats || [];
  const bookingRef = booking.booking_ref || 'N/A';
  const qrCode = booking.qr_code_data;
  const totalAmount = booking.total_amount || 0;

  const eventTitle = event?.title || booking.event_title || 'Tonight Event';
  const eventDate = event?.event_date || booking.event_date;
  const eventTime = event?.event_time || booking.event_time;
  const venueName = event?.venue_name || booking.venue_name || 'Tonight Venue';

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const handleCopyRef = () => {
    navigator.clipboard.writeText(bookingRef);
    setCopied(true);
    toast.success('Booking reference copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrCode) return;
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `ticket-${bookingRef}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Ticket downloaded!');
  };

  return (
    <AnimatePresence>
      <div className="ticket-modal-overlay" onClick={onClose}>
        <motion.div
          className="ticket-modal-card"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Close button */}
          <button className="ticket-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>

          {/* Top Success Banner */}
          <div className="ticket-modal-header">
            <div className="ticket-modal-success-badge">
              <CheckCircle2 size={18} className="ticket-modal-success-icon" />
              <span>Booking Confirmed</span>
            </div>
            <h2 className="ticket-modal-title">{eventTitle}</h2>
            <div className="ticket-modal-meta">
              <span><Calendar size={13} /> {formatDate(eventDate)}</span>
              <span><Clock size={13} /> {formatTime(eventTime)}</span>
              <span><MapPin size={13} /> {venueName}</span>
            </div>
          </div>

          {/* Perforated Divider */}
          <div className="ticket-stub-divider">
            <div className="ticket-stub-notch ticket-stub-notch-left" />
            <div className="ticket-stub-line" />
            <div className="ticket-stub-notch ticket-stub-notch-right" />
          </div>

          {/* Ticket Body / QR Section */}
          <div className="ticket-modal-body">
            {/* Booking Ref & Seats info */}
            <div className="ticket-details-grid">
              <div className="ticket-detail-item">
                <span className="ticket-detail-label">Booking Reference</span>
                <div className="ticket-ref-box" onClick={handleCopyRef} title="Click to copy">
                  <span className="ticket-ref-text">{bookingRef}</span>
                  <button className="ticket-copy-btn">
                    {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="ticket-detail-item">
                <span className="ticket-detail-label">Total Amount</span>
                <span className="ticket-total-val">₹{parseFloat(totalAmount).toFixed(0)}</span>
              </div>
            </div>

            {/* Allocated Seats */}
            <div className="ticket-seats-wrapper">
              <span className="ticket-detail-label">Seats ({seats.length})</span>
              <div className="ticket-seats-list">
                {seats.map((s, idx) => (
                  <span key={idx} className="ticket-seat-pill">
                    <TicketIcon size={12} />
                    <strong>{s.row_label}{s.seat_number}</strong>
                    {s.category && <span className="ticket-seat-cat">{s.category}</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* QR Code Presentation */}
            {qrCode ? (
              <div className="ticket-qr-container">
                <div className="ticket-qr-frame">
                  <img src={qrCode} alt={`QR Code for ${bookingRef}`} className="ticket-qr-img" />
                </div>
                <div className="ticket-qr-info">
                  <span className="ticket-qr-instruction">
                    <Sparkles size={13} /> Scan this QR code at the venue gate for instant entry
                  </span>
                </div>
              </div>
            ) : (
              <div className="ticket-qr-placeholder">
                <span>Generating QR code...</span>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="ticket-modal-actions">
            {qrCode && (
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadQR}>
                <Download size={15} /> Download QR
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose();
                navigate('/dashboard');
              }}
            >
              <ExternalLink size={15} /> View My Bookings
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
