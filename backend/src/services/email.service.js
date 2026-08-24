const { Resend } = require('resend');
const env = require('../config/env');

// Initialize Resend client
const resend = new Resend(env.RESEND_API_KEY);

/**
 * Send booking confirmation email with QR code
 */
const sendBookingConfirmation = async ({ to, customerName, bookingRef, eventTitle, eventDate, eventTime, venueName, seats, totalAmount, qrCodeData }) => {
  // If using mock key, just log
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_mock_key') {
    console.log(`📧 [MOCK EMAIL] Booking confirmation to ${to} for ${bookingRef}`);
    return { id: 'mock-email-id' };
  }

  const seatList = seats.map(s => `<li style="padding:4px 0;color:#c4c4d4;">${s}</li>`).join('');

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#0f0f23;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a4a;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;">🎫 Booking Confirmed!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:16px;">Your tickets are ready</p>
      </div>
      
      <!-- Body -->
      <div style="padding:32px;">
        <p style="color:#e4e4e7;font-size:16px;margin:0 0 24px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color:#c4c4d4;font-size:14px;margin:0 0 24px;">Your booking has been confirmed. Here are the details:</p>
        
        <!-- Booking Details -->
        <div style="background:#16162a;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #2a2a4a;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Booking Ref</td><td style="color:#667eea;font-weight:bold;font-size:16px;text-align:right;">${bookingRef}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Event</td><td style="color:#e4e4e7;text-align:right;">${eventTitle}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Date</td><td style="color:#e4e4e7;text-align:right;">${eventDate}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Time</td><td style="color:#e4e4e7;text-align:right;">${eventTime}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Venue</td><td style="color:#e4e4e7;text-align:right;">${venueName}</td></tr>
          </table>
        </div>
        
        <!-- Seats -->
        <div style="background:#16162a;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #2a2a4a;">
          <h3 style="color:#e4e4e7;margin:0 0 12px;font-size:14px;">🎟️ Your Seats</h3>
          <ul style="list-style:none;padding:0;margin:0;">${seatList}</ul>
          <hr style="border:1px solid #2a2a4a;margin:16px 0;">
          <table style="width:100%;">
            <tr><td style="color:#9ca3af;font-size:14px;">Total Amount</td><td style="color:#10b981;font-weight:bold;font-size:20px;text-align:right;">₹${totalAmount.toFixed(2)}</td></tr>
          </table>
        </div>
        
        <!-- QR Code -->
        ${qrCodeData ? `
        <div style="text-align:center;background:#fff;border-radius:12px;padding:24px;margin:0 0 24px;">
          <img src="${qrCodeData}" alt="QR Code" style="width:200px;height:200px;">
          <p style="color:#374151;font-size:12px;margin:12px 0 0;">Scan this QR code at the venue</p>
        </div>
        ` : ''}
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;">
          This email was sent by Ticket Booking Platform. Please do not reply.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    const response = await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: `🎫 Booking Confirmed — ${eventTitle} (${bookingRef})`,
      html: htmlContent,
    });

    console.log(`📧 Booking email sent to ${to}: ${response.id}`);
    return response;
  } catch (err) {
    console.error(`❌ Failed to send booking email to ${to}:`, err.message);
    throw err;
  }
};

/**
 * Send waitlist offer email with time-limited accept link
 */
const sendWaitlistOffer = async ({ to, customerName, eventTitle, eventDate, eventTime, venueName, offerToken, expiresAt }) => {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_mock_key') {
    console.log(`📧 [MOCK EMAIL] Waitlist offer to ${to}, token: ${offerToken}`);
    return { id: 'mock-email-id' };
  }

  const acceptLink = `${env.FRONTEND_URL}/waitlist/accept/${offerToken}`;
  const expiryTime = new Date(expiresAt).toLocaleString();

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#0f0f23;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2a2a4a;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);padding:32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:28px;">🎉 Seat Available!</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:16px;">A seat opened up from the waitlist</p>
      </div>
      
      <!-- Body -->
      <div style="padding:32px;">
        <p style="color:#e4e4e7;font-size:16px;margin:0 0 16px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color:#c4c4d4;font-size:14px;margin:0 0 24px;">Great news! A seat has become available for the event you were waiting for:</p>
        
        <div style="background:#16162a;border-radius:12px;padding:24px;margin:0 0 24px;border:1px solid #2a2a4a;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Event</td><td style="color:#e4e4e7;text-align:right;">${eventTitle}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Date</td><td style="color:#e4e4e7;text-align:right;">${eventDate}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Time</td><td style="color:#e4e4e7;text-align:right;">${eventTime}</td></tr>
            <tr><td style="color:#9ca3af;padding:8px 0;font-size:13px;">Venue</td><td style="color:#e4e4e7;text-align:right;">${venueName}</td></tr>
          </table>
        </div>
        
        <!-- CTA -->
        <div style="text-align:center;margin:0 0 24px;">
          <a href="${acceptLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;text-decoration:none;padding:16px 48px;border-radius:12px;font-weight:bold;font-size:16px;">
            Accept & Book Now
          </a>
        </div>
        
        <!-- Warning -->
        <div style="background:#1c1c0f;border:1px solid #854d0e;border-radius:12px;padding:16px;margin:0 0 24px;">
          <p style="color:#fbbf24;font-size:13px;margin:0;">⚠️ <strong>This offer expires at ${expiryTime}.</strong> If you don't accept in time, the seat will be offered to the next person in line.</p>
        </div>
        
        <p style="color:#9ca3af;font-size:12px;text-align:center;margin:24px 0 0;">
          This email was sent by Ticket Booking Platform.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    const response = await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: `🎉 Seat Available — ${eventTitle} (Act Fast!)`,
      html: htmlContent,
    });

    console.log(`📧 Waitlist offer email sent to ${to}: ${response.id}`);
    return response;
  } catch (err) {
    console.error(`❌ Failed to send waitlist offer email to ${to}:`, err.message);
    throw err;
  }
};

module.exports = { sendBookingConfirmation, sendWaitlistOffer };
