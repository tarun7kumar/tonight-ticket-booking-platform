import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Clock, Calendar, Globe, Play, X, ArrowLeft, 
  ChevronRight, Film, Users, Sparkles, AlertCircle, Share2, 
  Ticket, Check, MapPin 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getMovieDetails, getBackdropUrl, getPosterUrl, getProfileUrl } from '../services/tmdb';
import api from '../services/api';
import './MovieDetail.css';

export default function MovieDetail() {
  const { movieId } = useParams();
  const navigate = useNavigate();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTrailer, setActiveTrailer] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('IMAX 2D');
  const [selectedDate, setSelectedDate] = useState('Today');
  const [matchingEvents, setMatchingEvents] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchMovie();
  }, [movieId]);

  const fetchMovie = async () => {
    setLoading(true);
    setError(null);
    try {
      const [movieData, eventsRes] = await Promise.allSettled([
        getMovieDetails(movieId),
        api.get('/events?status=upcoming'),
      ]);

      if (movieData.status === 'fulfilled' && movieData.value && (movieData.value.id || movieData.value.title)) {
        setMovie(movieData.value);
      } else {
        throw new Error('Failed to load movie from TMDB');
      }

      if (eventsRes.status === 'fulfilled' && eventsRes.value?.data?.events) {
        const titleLower = movieData.value?.title?.toLowerCase() || '';
        const matched = eventsRes.value.data.events.filter(e => 
          e.title?.toLowerCase().includes(titleLower) || titleLower.includes(e.title?.toLowerCase())
        );
        setMatchingEvents(matched);
      }
    } catch (err) {
      console.error('Error loading movie details:', err);
      setError('We couldn’t load this movie right now.');
    } finally {
      setLoading(false);
    }
  };

  const [bookingLoading, setBookingLoading] = useState(false);

  // Convert "10:45 AM" -> "10:45:00"
  const convertTo24Hour = (timeStr) => {
    if (!timeStr) return '19:30:00';
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${String(hours).padStart(2, '0')}:${minutes}:00`;
  };

  // Launch interactive seat selection
  const handleBookShowtime = async (time = '07:30 PM') => {
    if (!movie) return;
    setBookingLoading(true);
    setShowBookingModal(false);
    toast.loading('Opening cinema seat selection...', { id: 'booking-init' });

    try {
      const formattedTime = time.includes('AM') || time.includes('PM')
        ? convertTo24Hour(time)
        : time;

      const dateVal = selectedDate === 'Tomorrow' 
        ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
        : selectedDate === 'This Weekend'
        ? new Date(Date.now() + 172800000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const res = await api.post('/events/movie-session', {
        title: movie.title,
        poster_url: movie.poster_path ? getPosterUrl(movie.poster_path) : '',
        description: movie.overview || '',
        format: selectedFormat,
        date: dateVal,
        time: formattedTime,
      });

      if (res.data?.event?.id) {
        toast.success('Select your preferred seats!', { id: 'booking-init' });
        navigate(`/events/${res.data.event.id}`);
      } else {
        throw new Error('Failed to initialize cinema session');
      }
    } catch (err) {
      console.error('Seat selection launch error:', err);
      toast.error('Could not start seat booking. Please try again.', { id: 'booking-init' });
    } finally {
      setBookingLoading(false);
    }
  };

  // Format runtime to e.g. "2h 35m"
  const formatRuntime = (mins) => {
    if (!mins) return 'N/A';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // Extract certification (PG-13, U/A 16+, A, etc.)
  const getCertification = (movieData) => {
    if (!movieData?.release_dates?.results) return 'U/A';
    const inRelease = movieData.release_dates.results.find(r => r.iso_3166_1 === 'IN') ||
                      movieData.release_dates.results.find(r => r.iso_3166_1 === 'US') ||
                      movieData.release_dates.results[0];
    const cert = inRelease?.release_dates?.find(d => d.certification)?.certification;
    return cert || 'U/A 16+';
  };

  // Extract official trailer from videos
  const getOfficialTrailer = (movieData) => {
    if (!movieData?.videos?.results?.length) return null;
    const trailers = movieData.videos.results.filter(v => v.site === 'YouTube');
    return trailers.find(v => v.type === 'Trailer' && v.official) ||
           trailers.find(v => v.type === 'Trailer') ||
           trailers[0] || null;
  };

  // Filter prioritized crew
  const getPrioritizedCrew = (movieData) => {
    if (!movieData?.credits?.crew?.length) return [];
    const targetRoles = [
      'Director', 'Screenplay', 'Writer', 'Producer', 
      'Director of Photography', 'Cinematographer', 
      'Original Music Composer', 'Music', 'Editor'
    ];
    const seen = new Set();
    const result = [];

    for (const member of movieData.credits.crew) {
      if (targetRoles.includes(member.job) && !seen.has(member.id + member.job)) {
        seen.add(member.id + member.job);
        result.push(member);
        if (result.length >= 10) break;
      }
    }
    return result;
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: movie?.title,
        text: `Book tickets for ${movie?.title} on TONIGHT.`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Movie link copied to clipboard!');
    }
  };

  // ─── ERROR STATE ───────────────────────────────────────────
  if (error && !loading) {
    return (
      <div className="movie-detail flex items-center justify-center" style={{ minHeight: '80vh', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 520 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 'var(--space-3xl)' }}>
            <AlertCircle size={48} className="text-accent" style={{ margin: '0 auto 16px' }} />
            <h2 className="headline-md" style={{ marginBottom: 8 }}>Something went wrong</h2>
            <p className="text-secondary" style={{ marginBottom: 24 }}>{error}</p>
            <div className="flex gap-md justify-center">
              <button className="btn btn-primary" onClick={fetchMovie}>
                Try Again
              </button>
              <Link to="/events" className="btn btn-secondary">
                Explore Events
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── LOADING SKELETON STATE ────────────────────────────────
  if (loading || !movie) {
    return (
      <div className="movie-detail">
        <div className="skeleton-hero">
          <div className="container" style={{ width: '100%' }}>
            <div className="movie-hero__content">
              <div className="skeleton-box" style={{ width: 320, aspectRatio: '2 / 3', borderRadius: 'var(--radius-md)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="skeleton-box" style={{ width: 140, height: 24 }} />
                <div className="skeleton-box" style={{ width: '80%', height: 54 }} />
                <div className="skeleton-box" style={{ width: '50%', height: 28 }} />
                <div className="skeleton-box" style={{ width: '100%', height: 80 }} />
                <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                  <div className="skeleton-box" style={{ width: 180, height: 48, borderRadius: 'var(--radius-sm)' }} />
                  <div className="skeleton-box" style={{ width: 160, height: 48, borderRadius: 'var(--radius-sm)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="container" style={{ marginTop: 'var(--space-3xl)' }}>
          <div className="skeleton-box" style={{ width: 220, height: 32, marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="skeleton-box" style={{ height: 220, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const trailer = getOfficialTrailer(movie);
  const castList = movie.credits?.cast?.slice(0, 18) || [];
  const crewList = getPrioritizedCrew(movie);
  const recommendations = (movie.recommendations?.results?.length 
    ? movie.recommendations.results 
    : movie.similar?.results || []).filter(m => m.poster_path).slice(0, 8);

  const backdropSrc = getBackdropUrl(movie.backdrop_path);
  const posterSrc = getPosterUrl(movie.poster_path);
  const certification = getCertification(movie);
  const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : '2026';

  return (
    <div className="movie-detail">
      {/* ── CINEMATIC HERO ────────────────────────────────────── */}
      <section className="movie-hero">
        {backdropSrc && (
          <div className="movie-hero__backdrop">
            <img src={backdropSrc} alt="" className="movie-hero__backdrop-img" />
            <div className="movie-hero__backdrop-overlay" />
          </div>
        )}

        <div className="container movie-hero__content">
          {/* Left: Large Poster with Monochrome-to-Color hover */}
          <motion.div
            className="movie-poster-card cinematic-img-wrapper"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <img src={posterSrc} alt={movie.title} className="movie-poster-card__img cinematic-img" />
            
            <div className="movie-poster-card__badge">
              {movie.status === 'Released' ? 'Now Showing' : 'Releasing Soon'}
            </div>
          </motion.div>

          {/* Right: Movie Information */}
          <motion.div
            className="movie-hero__info"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="movie-hero__eyebrow">
              <span className="movie-hero__cert">{certification}</span>
            </div>

            <h1 className="movie-hero__title">{movie.title}</h1>

            {movie.tagline && (
              <p className="movie-hero__tagline">“{movie.tagline}”</p>
            )}

            {/* Meta Bar */}
            <div className="movie-hero__meta-bar">
              {movie.vote_average > 0 && (
                <div className="movie-hero__rating">
                  <Star size={15} fill="#f59e0b" stroke="#f59e0b" />
                  <span>{movie.vote_average.toFixed(1)}</span>
                  {movie.vote_count > 0 && (
                    <span className="movie-hero__rating-votes">({movie.vote_count.toLocaleString()})</span>
                  )}
                </div>
              )}

              <span>{releaseYear}</span>
              <span className="movie-hero__meta-divider" />
              <span><Clock size={14} style={{ display: 'inline', marginRight: 4 }} />{formatRuntime(movie.runtime)}</span>
              <span className="movie-hero__meta-divider" />
              <span><Globe size={14} style={{ display: 'inline', marginRight: 4 }} />{movie.original_language?.toUpperCase() || 'EN'}</span>
            </div>

            {/* Genres */}
            {movie.genres?.length > 0 && (
              <div className="movie-hero__genres">
                {movie.genres.map(g => (
                  <span key={g.id} className="movie-genre-pill">{g.name}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="movie-hero__actions">
              <button 
                className="btn btn-primary btn-lg movie-hero__btn-book"
                onClick={() => {
                  if (matchingEvents.length > 0) {
                    navigate(`/events/${matchingEvents[0].id}`);
                  } else {
                    setShowBookingModal(true);
                  }
                }}
              >
                <Ticket size={18} /> Book Tickets
              </button>

              {trailer && (
                <button 
                  className="btn btn-secondary btn-lg"
                  onClick={() => setActiveTrailer(trailer)}
                >
                  <Play size={18} /> Watch Trailer
                </button>
              )}

              <button className="btn btn-ghost btn-icon" onClick={handleShare} title="Share movie">
                <Share2 size={18} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ABOUT THE MOVIE ───────────────────────────────────── */}
      <section className="movie-section container">
        <div className="movie-section__header">
          <h2 className="movie-section__title">About the Movie</h2>
        </div>

        <div className="movie-about-content">
          <div className="movie-about__synopsis">
            <p>{movie.overview || 'No synopsis available for this title.'}</p>
          </div>

          <div className="movie-meta-grid">
            <div className="movie-meta-item">
              <span className="movie-meta-label">Release Date</span>
              <span className="movie-meta-value">
                {movie.release_date ? new Date(movie.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBA'}
              </span>
            </div>
            <div className="movie-meta-item">
              <span className="movie-meta-label">Runtime</span>
              <span className="movie-meta-value">{formatRuntime(movie.runtime)}</span>
            </div>
            <div className="movie-meta-item">
              <span className="movie-meta-label">Original Language</span>
              <span className="movie-meta-value">{movie.spoken_languages?.[0]?.english_name || movie.original_language?.toUpperCase() || 'English'}</span>
            </div>
            <div className="movie-meta-item">
              <span className="movie-meta-label">Genres</span>
              <span className="movie-meta-value">{movie.genres?.map(g => g.name).join(', ') || 'N/A'}</span>
            </div>
            {movie.budget > 0 && (
              <div className="movie-meta-item">
                <span className="movie-meta-label">Budget</span>
                <span className="movie-meta-value">${(movie.budget / 1000000).toFixed(1)} Million</span>
              </div>
            )}
            {movie.revenue > 0 && (
              <div className="movie-meta-item">
                <span className="movie-meta-label">Box Office</span>
                <span className="movie-meta-value">${(movie.revenue / 1000000).toFixed(1)} Million</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── CAST SECTION ──────────────────────────────────────── */}
      {castList.length > 0 && (
        <section className="movie-section container">
          <div className="movie-section__header">
            <div>
              <h2 className="movie-section__title">Cast</h2>
            </div>
          </div>

          <div className="movie-carousel-wrapper">
            <div className="movie-cast-grid">
              {castList.map((actor) => {
                const profileImg = getProfileUrl(actor.profile_path);
                return (
                  <div key={actor.id} className="movie-cast-card cinematic-img-wrapper">
                    <div className="movie-cast-card__img-box">
                      {profileImg ? (
                        <img src={profileImg} alt={actor.name} className="movie-cast-card__img cinematic-img" />
                      ) : (
                        <div className="movie-cast-card__placeholder">
                          {actor.name?.charAt(0) || '🎭'}
                        </div>
                      )}
                    </div>
                    <div className="movie-cast-card__info">
                      <h4 className="movie-cast-card__name" title={actor.name}>{actor.name}</h4>
                      <span className="movie-cast-card__role" title={actor.character}>
                        as {actor.character || 'Cast'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CREW SECTION ──────────────────────────────────────── */}
      {crewList.length > 0 && (
        <section className="movie-section container">
          <div className="movie-section__header">
            <div>
              <h2 className="movie-section__title">Crew</h2>
            </div>
          </div>

          <div className="movie-carousel-wrapper">
            <div className="movie-cast-grid">
              {crewList.map((person, idx) => {
                const profileImg = getProfileUrl(person.profile_path);
                return (
                  <div key={`${person.id}-${person.job}-${idx}`} className="movie-cast-card cinematic-img-wrapper">
                    <div className="movie-cast-card__img-box">
                      {profileImg ? (
                        <img src={profileImg} alt={person.name} className="movie-cast-card__img cinematic-img" />
                      ) : (
                        <div className="movie-cast-card__placeholder">
                          {person.name?.charAt(0) || '🎬'}
                        </div>
                      )}
                    </div>
                    <div className="movie-cast-card__info">
                      <h4 className="movie-cast-card__name" title={person.name}>{person.name}</h4>
                      <span className="movie-cast-card__role" title={person.job}>{person.job}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TRAILER / MEDIA SECTION ───────────────────── */}
      {trailer && backdropSrc && (
        <section className="movie-section container">
          <div className="movie-section__header">
            <div>
              <h2 className="movie-section__title">Official Trailer</h2>
            </div>
          </div>

          <div 
            className="movie-trailer-card cinematic-img-wrapper"
            onClick={() => setActiveTrailer(trailer)}
          >
            <img src={backdropSrc} alt="" className="movie-trailer-card__bg cinematic-img" />
            <div className="movie-trailer-card__overlay">
              <div className="movie-trailer-play-btn">
                <Play size={28} fill="currentColor" style={{ marginLeft: 4 }} />
              </div>
              <h3 className="movie-trailer-card__title">{trailer.name || `${movie.title} — Official Trailer`}</h3>
            </div>
          </div>
        </section>
      )}

      {/* ── RECOMMENDATIONS ("YOU MIGHT ALSO LIKE") ────────────── */}
      {recommendations.length > 0 && (
        <section className="movie-section container">
          <div className="movie-section__header">
            <div>
              <h2 className="movie-section__title">You Might Also Like</h2>
            </div>
          </div>

          <div className="movie-rec-grid">
            {recommendations.map((rec) => (
              <Link 
                key={rec.id} 
                to={`/movies/${rec.id}`} 
                className="movie-rec-card cinematic-img-wrapper"
              >
                <div className="movie-rec-card__img-box">
                  <img 
                    src={getPosterUrl(rec.poster_path)} 
                    alt={rec.title} 
                    className="movie-rec-card__img cinematic-img" 
                  />
                  {rec.vote_average > 0 && (
                    <div className="movie-rec-card__rating">
                      <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                      <span>{rec.vote_average.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <div className="movie-rec-card__body">
                  <h4 className="movie-rec-card__title">{rec.title}</h4>
                  <span className="movie-rec-card__year">
                    {rec.release_date ? rec.release_date.split('-')[0] : 'Movie'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── TRAILER VIDEO MODAL ───────────────────────────────── */}
      <AnimatePresence>
        {activeTrailer && (
          <div className="trailer-modal-overlay" onClick={() => setActiveTrailer(null)}>
            <motion.div 
              className="trailer-modal" 
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.3 }}
            >
              <div className="trailer-modal__header">
                <span className="trailer-modal__title">{activeTrailer.name || movie.title}</span>
                <button className="trailer-modal__close" onClick={() => setActiveTrailer(null)}>
                  <X size={20} />
                </button>
              </div>
              <div className="trailer-modal__video-container">
                <iframe
                  src={`https://www.youtube.com/embed/${activeTrailer.key}?autoplay=1`}
                  title={activeTrailer.name}
                  className="trailer-modal__iframe"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SHOWTIMES & BOOKING DRAWER / MODAL ────────────────── */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="booking-modal-overlay" onClick={() => setShowBookingModal(false)}>
            <motion.div 
              className="booking-modal"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
            >
              <div className="booking-modal__header">
                <div>
                  <h3 className="headline-sm">{movie.title}</h3>
                </div>
                <button className="btn btn-icon" onClick={() => setShowBookingModal(false)}>
                  <X size={20} />
                </button>
              </div>

              {/* Format selection */}
              <div style={{ marginBottom: 12 }}>
                <span className="text-xs" style={{ display: 'block', marginBottom: 8 }}>Cinema Experience</span>
                <div className="booking-format-chips">
                  {['IMAX 2D', 'Dolby Cinema 2D', '4DX 3D', 'Standard 2D'].map(fmt => (
                    <button
                      key={fmt}
                      className={`booking-format-chip ${selectedFormat === fmt ? 'booking-format-chip--active' : ''}`}
                      onClick={() => setSelectedFormat(fmt)}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date selection */}
              <div style={{ marginBottom: 20 }}>
                <span className="text-xs" style={{ display: 'block', marginBottom: 8 }}>Select Date</span>
                <div className="booking-format-chips">
                  {['Today', 'Tomorrow', 'This Weekend'].map(d => (
                    <button
                      key={d}
                      className={`booking-format-chip ${selectedDate === d ? 'booking-format-chip--active' : ''}`}
                      onClick={() => setSelectedDate(d)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cinema & Showtimes */}
              <div style={{ marginBottom: 24 }}>
                <div className="flex items-center gap-xs" style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <MapPin size={14} className="text-accent" />
                  <span className="text-sm font-medium">The Grand Dolby Cinema — Screen 1 ({selectedFormat})</span>
                </div>
                <div className="booking-showtimes-grid">
                  {['10:45 AM', '02:15 PM', '06:00 PM', '09:30 PM', '11:45 PM'].map(time => (
                    <button
                      key={time}
                      className="booking-time-btn"
                      disabled={bookingLoading}
                      onClick={() => handleBookShowtime(time)}
                    >
                      <span>{time}</span>
                      <span className="booking-time-btn__format">{selectedFormat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-sm">
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }} 
                  disabled={bookingLoading}
                  onClick={() => handleBookShowtime('07:30 PM')}
                >
                  <Ticket size={18} /> Select Seats for Evening Show (07:30 PM) <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MOBILE STICKY BOOKING BAR ─────────────────────────── */}
      <div className="movie-sticky-bar">
        <div className="movie-sticky-bar__info">
          <span className="movie-sticky-bar__title">{movie.title}</span>
          <span className="movie-sticky-bar__meta">
            ★ {movie.vote_average?.toFixed(1) || '8.0'} • {formatRuntime(movie.runtime)}
          </span>
        </div>
        <button 
          className="btn btn-primary btn-sm"
          disabled={bookingLoading}
          onClick={() => {
            if (matchingEvents.length > 0) {
              navigate(`/events/${matchingEvents[0].id}`);
            } else {
              setShowBookingModal(true);
            }
          }}
        >
          <Ticket size={16} /> Book Tickets
        </button>
      </div>
    </div>
  );
}
