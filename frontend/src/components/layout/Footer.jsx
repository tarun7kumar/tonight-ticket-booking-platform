import { Link } from 'react-router-dom';
import { Ticket, Github, Twitter, Instagram } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              <img src="/logo.png" alt="TONIGHT" className="footer__logo-img" />
              <span className="footer__logo-text">TONIGHT</span>
            </Link>
            <p className="footer__tagline">
              The cinematic way to experience live events.<br />
              Movies. Concerts. Culture. Tonight.
            </p>
          </div>

          <div className="footer__links-grid">
            <div className="footer__links-col">
              <h4 className="footer__links-title">Platform</h4>
              <Link to="/events" className="footer__link">Browse Events</Link>
              <Link to="/events?type=movie" className="footer__link">Movies</Link>
              <Link to="/events?type=concert" className="footer__link">Concerts</Link>
            </div>
            <div className="footer__links-col">
              <h4 className="footer__links-title">Account</h4>
              <Link to="/login" className="footer__link">Sign In</Link>
              <Link to="/register" className="footer__link">Create Account</Link>
              <Link to="/dashboard" className="footer__link">My Bookings</Link>
            </div>
            <div className="footer__links-col">
              <h4 className="footer__links-title">For Organisers</h4>
              <Link to="/register" className="footer__link">List Your Event</Link>
              <Link to="/organiser" className="footer__link">Organiser Dashboard</Link>
            </div>
          </div>
        </div>

        <div className="footer__divider" />

        <div className="footer__bottom">
          <p className="footer__copyright">
            © {new Date().getFullYear()} Tonight. All rights reserved.
          </p>
          <div className="footer__socials">
            <a href="#" className="footer__social-link"><Twitter size={16} /></a>
            <a href="#" className="footer__social-link"><Instagram size={16} /></a>
            <a href="#" className="footer__social-link"><Github size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
