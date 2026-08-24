import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Film, Music, X, Compass, Calendar, Clock } from 'lucide-react';
import EventCard from '../components/events/EventCard';
import { LoadingSpinner } from '../components/shared/ProtectedRoute';
import api from '../services/api';
import { getNowPlayingMovies, getTrendingMovies, getPosterUrl } from '../services/tmdb';
import './Events.css';

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dbEvents, setDbEvents] = useState([]);
  const [movieCatalog, setMovieCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || searchParams.get('q') || '');

  const activeType = searchParams.get('type') || '';
  const activeDate = searchParams.get('date') || '';

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeType && activeType !== 'movie' && activeType !== 'concert') {
        params.append('type', activeType);
      }
      if (activeDate) params.append('date', activeDate);
      const query = searchParams.get('search') || searchParams.get('q');
      if (query) params.append('search', query);

      const [eventsRes, nowPlayingRes, trendingRes] = await Promise.allSettled([
        api.get(`/events?${params.toString()}`),
        getNowPlayingMovies(),
        getTrendingMovies(),
      ]);

      if (eventsRes.status === 'fulfilled') {
        setDbEvents(eventsRes.value.data.events || []);
      }

      // Combine and deduplicate TMDB movies
      const allMovies = [];
      const seenMovieIds = new Set();

      if (nowPlayingRes.status === 'fulfilled' && nowPlayingRes.value?.results) {
        for (const m of nowPlayingRes.value.results) {
          if (!seenMovieIds.has(m.id)) {
            seenMovieIds.add(m.id);
            allMovies.push(m);
          }
        }
      }

      if (trendingRes.status === 'fulfilled' && trendingRes.value?.results) {
        for (const m of trendingRes.value.results) {
          if (!seenMovieIds.has(m.id)) {
            seenMovieIds.add(m.id);
            allMovies.push(m);
          }
        }
      }

      setMovieCatalog(allMovies);
    } catch (err) {
      console.error('Error fetching events catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
      params.delete('q');
    } else {
      params.delete('search');
      params.delete('q');
    }
    setSearchParams(params);
  };

  const setTypeFilter = (type) => {
    const params = new URLSearchParams(searchParams);
    if (type) params.set('type', type);
    else params.delete('type');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery('');
  };

  const currentSearchTerm = (searchParams.get('search') || searchParams.get('q') || searchQuery || '').trim().toLowerCase();
  const hasFilters = activeType || activeDate || currentSearchTerm;

  // Filter items based on active tab and search
  const filteredEvents = useMemo(() => {
    if (!activeType) {
      // All Events: Include DB events + all TMDB movies
      const dbList = dbEvents.filter(e => {
        if (!currentSearchTerm) return true;
        return e.title.toLowerCase().includes(currentSearchTerm) || (e.description && e.description.toLowerCase().includes(currentSearchTerm));
      });

      const moviesList = movieCatalog.filter(m => {
        if (!currentSearchTerm) return true;
        return m.title.toLowerCase().includes(currentSearchTerm) || (m.overview && m.overview.toLowerCase().includes(currentSearchTerm));
      });

      return { dbList, moviesList };
    } else if (activeType === 'movie') {
      // Movies tab: Show DB movie events + all TMDB movies
      const dbList = dbEvents.filter(e => {
        if (e.type !== 'movie') return false;
        if (!currentSearchTerm) return true;
        return e.title.toLowerCase().includes(currentSearchTerm);
      });

      const moviesList = movieCatalog.filter(m => {
        if (!currentSearchTerm) return true;
        return m.title.toLowerCase().includes(currentSearchTerm) || (m.overview && m.overview.toLowerCase().includes(currentSearchTerm));
      });

      return { dbList, moviesList };
    } else if (activeType === 'concert') {
      // Concerts tab: Show only concerts from DB
      const dbList = dbEvents.filter(e => {
        if (e.type !== 'concert') return false;
        if (!currentSearchTerm) return true;
        return e.title.toLowerCase().includes(currentSearchTerm);
      });

      return { dbList, moviesList: [] };
    }

    return { dbList: [], moviesList: [] };
  }, [dbEvents, movieCatalog, activeType, currentSearchTerm]);

  const totalCount = filteredEvents.dbList.length + filteredEvents.moviesList.length;

  return (
    <div className="events-page">
      <div className="container">
        {/* Header */}
        <motion.div
          className="events-page__header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div>
            <h1 className="headline-lg">
              {activeType === 'movie' ? 'Movies' : activeType === 'concert' ? 'Concerts' : 'All Events'}
            </h1>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="events-page__filters">
          <form onSubmit={handleSearch} className="events-page__search">
            <Search size={18} className="events-page__search-icon" />
            <input
              type="text"
              placeholder="Search movies, concerts, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="events-page__search-input"
            />
          </form>

          <div className="events-page__filter-chips">
            <button
              className={`filter-chip ${!activeType ? 'filter-chip--active' : ''}`}
              onClick={() => setTypeFilter('')}
            >
              <Compass size={14} /> All Events
            </button>
            <button
              className={`filter-chip ${activeType === 'movie' ? 'filter-chip--active' : ''}`}
              onClick={() => setTypeFilter('movie')}
            >
              <Film size={14} /> Movies
            </button>
            <button
              className={`filter-chip ${activeType === 'concert' ? 'filter-chip--active' : ''}`}
              onClick={() => setTypeFilter('concert')}
            >
              <Music size={14} /> Concerts
            </button>
          </div>

          {hasFilters && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={14} /> Clear filters
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="events-page__loading">
            <LoadingSpinner size={48} />
          </div>
        ) : totalCount === 0 ? (
          <div className="events-page__empty">
            <Film size={48} strokeWidth={1} />
            <h3>No events found</h3>
            <p>Try adjusting your search query or filters.</p>
            {hasFilters && (
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid-4">
            {/* Database Bookable Events */}
            {filteredEvents.dbList.map((event, i) => (
              <EventCard key={`db-${event.id}`} event={event} index={i} />
            ))}

            {/* Movie Catalog Cards */}
            {filteredEvents.moviesList.map((movie, i) => (
              <motion.div
                key={`movie-${movie.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: (filteredEvents.dbList.length + i) * 0.04 }}
              >
                <Link 
                  to={`/movies/${movie.id}`} 
                  className="event-card" 
                  style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
                >
                  <div className="event-card__image cinematic-img-wrapper">
                    <img
                      src={getPosterUrl(movie.poster_path)}
                      alt={movie.title}
                      className="event-card__poster cinematic-img"
                    />
                    <div className="event-card__overlay" />
                    <div className="event-card__badges">
                      <span className="badge badge-accent">
                        <Film size={10} /> Movie
                      </span>
                      {movie.vote_average > 0 && (
                        <span className="badge badge-secondary">
                          ★ {movie.vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="event-card__body">
                    <h3 className="event-card__title">{movie.title}</h3>
                    <div className="event-card__meta">
                      <span className="event-card__meta-item">
                        <Calendar size={13} />
                        {movie.release_date ? movie.release_date.split('-')[0] : 'In Theatres'}
                      </span>
                      <span className="event-card__meta-item">
                        <Clock size={13} />
                        Live Cinema
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
