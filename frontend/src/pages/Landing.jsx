import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Users, Calendar, MapPin, Film, Music, ChevronRight } from 'lucide-react';
import EventCard from '../components/events/EventCard';
import api from '../services/api';
import { getTrendingMovies, getPosterUrl, getBackdropUrl } from '../services/tmdb';
import './Landing.css';

export default function Landing() {
  const [events, setEvents] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, tmdbRes] = await Promise.allSettled([
          api.get('/events?status=upcoming'),
          getTrendingMovies(),
        ]);

        if (eventsRes.status === 'fulfilled') {
          setEvents(eventsRes.value.data.events || []);
        }
        if (tmdbRes.status === 'fulfilled' && tmdbRes.value?.results) {
          setTrendingMovies(tmdbRes.value.results.slice(0, 6));
        }
      } catch (err) {
        console.error('Landing fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const heroMovie = trendingMovies[0];
  const heroBg = heroMovie ? getBackdropUrl(heroMovie.backdrop_path) : null;

  return (
    <div className="landing">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="hero">
        {heroBg && (
          <div className="hero__bg">
            <img src={heroBg} alt="" className="hero__bg-img" />
            <div className="hero__bg-overlay" />
          </div>
        )}

        <div className="hero__content container">
          <motion.div
            className="hero__text"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="hero__title headline-xl">
              EXPERIENCE IT<br />
              <span className="text-gradient">TONIGHT</span>
            </h1>
            <p className="hero__subtitle">
              Book your seats for the most anticipated movies and live performances.
              Immersive seat selection. Real-time availability. Instant QR tickets.
            </p>
            <div className="hero__actions">
              <Link to="/events" className="btn btn-primary btn-lg">
                Browse Events <ArrowRight size={18} />
              </Link>
              <Link to="/register" className="btn btn-secondary btn-lg">
                Get Started
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <div className="hero__scroll-indicator">
          <div className="hero__scroll-line" />
        </div>
      </section>

      {/* ── FEATURED EVENTS ────────────────────────── */}
      {events.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <div>
                <h2 className="headline-lg">Upcoming Events</h2>
              </div>
              <Link to="/events" className="btn btn-ghost">
                View All <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid-4">
              {events.slice(0, 8).map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TRENDING FROM TMDB ─────────────────────── */}
      {trendingMovies.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div className="section-header">
              <div>
                <h2 className="headline-lg">What's Hot</h2>
              </div>
            </div>
            <div className="trending-grid">
              {trendingMovies.map((movie, i) => (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link to={`/movies/${movie.id}`} className="trending-card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                    <div className="trending-card__image cinematic-img-wrapper">
                      <img
                        src={getPosterUrl(movie.poster_path)}
                        alt={movie.title}
                        className="trending-card__poster cinematic-img"
                      />
                      <div className="trending-card__overlay" />
                      <div className="trending-card__rating">
                        <span>★ {movie.vote_average?.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="trending-card__info">
                      <h3 className="trending-card__title">{movie.title}</h3>
                      <span className="trending-card__year">
                        {movie.release_date?.split('-')[0]}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section className="section">
        <div className="container">
          <div className="section-header" style={{ justifyContent: 'center' }}>
            <div className="text-center">
              <h2 className="headline-lg">Book In Three Steps</h2>
            </div>
          </div>

          <div className="steps-grid">
            {[
              { icon: <Calendar size={28} />, num: '01', title: 'Choose Event', desc: 'Browse movies and concerts. Filter by type, date, or search.' },
              { icon: <MapPin size={28} />, num: '02', title: 'Pick Your Seats', desc: 'Interactive seat map with real-time availability. Select your perfect spot.' },
              { icon: <Sparkles size={28} />, num: '03', title: 'Get Your Ticket', desc: 'Confirm booking instantly. Receive QR code ticket via email.' },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                className="step-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <span className="step-card__num">{step.num}</span>
                <div className="step-card__icon">{step.icon}</div>
                <h3 className="step-card__title">{step.title}</h3>
                <p className="step-card__desc">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────── */}
      <section className="cta-section">
        <div className="container">
          <motion.div
            className="cta-box"
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="headline-md">Ready for Tonight?</h2>
            <p className="text-body">
              Join thousands of entertainment lovers. Book your next experience now.
            </p>
            <div className="cta-box__actions">
              <Link to="/events" className="btn btn-primary btn-lg">
                Explore Events <ArrowRight size={18} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
