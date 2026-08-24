import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Film, Music } from 'lucide-react';
import { getPosterUrl } from '../../services/tmdb';
import './EventCard.css';

export default function EventCard({ event, index = 0 }) {
  const posterSrc = event.poster_url
    ? (event.poster_url.startsWith('http') ? event.poster_url : getPosterUrl(event.poster_url))
    : null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const availablePercent = event.total_seats > 0
    ? Math.round((event.available_seats / event.total_seats) * 100)
    : 0;

  const isSoldOut = event.available_seats === 0 && event.total_seats > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link to={`/events/${event.id}`} className="event-card">
        <div className="event-card__image cinematic-img-wrapper">
          {posterSrc ? (
            <img src={posterSrc} alt={event.title} className="event-card__poster cinematic-img" />
          ) : (
            <div className="event-card__placeholder">
              {event.type === 'movie' ? <Film size={40} /> : <Music size={40} />}
            </div>
          )}

          {/* Overlay gradient */}
          <div className="event-card__overlay" />

          {/* Badges */}
          <div className="event-card__badges">
            <span className="badge badge-accent">
              {event.type === 'movie' ? <Film size={10} /> : <Music size={10} />}
              {event.type}
            </span>
            {isSoldOut && <span className="badge badge-danger">Sold Out</span>}
          </div>

          {/* Date overlay */}
          <div className="event-card__date-overlay">
            <span className="event-card__date-day">{formatDate(event.event_date)}</span>
          </div>
        </div>

        <div className="event-card__body">
          <h3 className="event-card__title">{event.title}</h3>
          <div className="event-card__meta">
            <span className="event-card__meta-item">
              <Calendar size={13} />
              {formatDate(event.event_date)}
            </span>
            <span className="event-card__meta-item">
              <Clock size={13} />
              {formatTime(event.event_time)}
            </span>
          </div>
          {event.venue_name && (
            <span className="event-card__venue">
              <MapPin size={12} />
              {event.venue_name}
            </span>
          )}

          {/* Availability bar */}
          {event.total_seats > 0 && (
            <div className="event-card__availability">
              <div className="event-card__availability-bar">
                <div
                  className="event-card__availability-fill"
                  style={{ width: `${availablePercent}%` }}
                />
              </div>
              <span className="event-card__availability-text">
                {isSoldOut ? 'Sold out' : `${event.available_seats} seats left`}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
