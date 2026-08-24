import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import './HoldTimer.css';

export default function HoldTimer({ expiresAt, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0 && onExpired) {
        onExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60;
  const progress = expiresAt
    ? Math.max(0, timeLeft / (Math.floor((new Date(expiresAt).getTime() - Date.now() + timeLeft * 1000) / 1000)) * 100)
    : 0;

  if (!expiresAt) return null;

  return (
    <div className={`hold-timer ${isUrgent ? 'hold-timer--urgent' : ''}`}>
      <div className="hold-timer__icon">
        <Clock size={16} />
      </div>
      <div className="hold-timer__info">
        <span className="hold-timer__label">Seats held for</span>
        <span className="hold-timer__time">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="hold-timer__bar">
        <div
          className="hold-timer__bar-fill"
          style={{ width: `${Math.min(100, (timeLeft / 600) * 100)}%` }}
        />
      </div>
    </div>
  );
}
