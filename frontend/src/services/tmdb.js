const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
// Clean any quotes or leading/trailing whitespace
const TMDB_API_KEY = (import.meta.env.VITE_TMDB_API_KEY || '').replace(/['"]/g, '').trim();

/**
 * Get image URL from TMDB
 */
export const getImageUrl = (path, size = 'w500') => {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
};

export const getBackdropUrl = (path) => getImageUrl(path, 'original');
export const getPosterUrl = (path) => getImageUrl(path, 'w500');
export const getProfileUrl = (path) => getImageUrl(path, 'w185');

/**
 * Make a TMDB API request
 */
const tmdbFetch = async (endpoint, params = {}) => {
  if (!TMDB_API_KEY) {
    console.warn('⚠️ TMDB API key not configured in frontend/.env (VITE_TMDB_API_KEY)');
    return null;
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  const headers = { 'Accept': 'application/json' };

  if (TMDB_API_KEY.startsWith('eyJ') || TMDB_API_KEY.length > 45) {
    headers['Authorization'] = `Bearer ${TMDB_API_KEY}`;
  } else {
    url.searchParams.append('api_key', TMDB_API_KEY);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TMDB API error ${response.status}: ${errText || response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('TMDB fetch error:', err.message);
    return null;
  }
};

/**
 * Get popular movies
 */
export const getPopularMovies = (page = 1) => {
  return tmdbFetch('/movie/popular', { page, language: 'en-US' });
};

/**
 * Get trending movies (week)
 */
export const getTrendingMovies = () => {
  return tmdbFetch('/trending/movie/week');
};

/**
 * Search movies
 */
export const searchMovies = (query, page = 1) => {
  return tmdbFetch('/search/movie', { query, page, language: 'en-US' });
};

/**
 * Get movie details with credits, videos, recommendations, similar, and release dates
 */
export const getMovieDetails = (movieId) => {
  return tmdbFetch(`/movie/${movieId}`, { 
    append_to_response: 'credits,videos,recommendations,similar,release_dates' 
  });
};

/**
 * Get movie recommendations
 */
export const getMovieRecommendations = (movieId, page = 1) => {
  return tmdbFetch(`/movie/${movieId}/recommendations`, { page, language: 'en-US' });
};

/**
 * Get similar movies
 */
export const getSimilarMovies = (movieId, page = 1) => {
  return tmdbFetch(`/movie/${movieId}/similar`, { page, language: 'en-US' });
};

/**
 * Get now playing movies
 */
export const getNowPlayingMovies = (page = 1) => {
  return tmdbFetch('/movie/now_playing', { page, language: 'en-US' });
};

/**
 * Get upcoming movies
 */
export const getUpcomingMovies = (page = 1) => {
  return tmdbFetch('/movie/upcoming', { page, language: 'en-US' });
};



