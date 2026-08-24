const { Resend } = require('resend');
const env = require('../config/env');

/**
 * Get configured Resend client instance
 */
const getResendClient = () => {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === 're_mock_key') {
    return null;
  }
  return new Resend(env.RESEND_API_KEY);
};

/**
 * Format date for email
 */
const formatEventDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time for email
 */
const formatEventTime = (t) => {
  if (!t) return '';
  const parts = String(t).split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

/**
 * Send booking confirmation email with QR code and ticket details
 */
const sendBookingConfirmation = async ({
  to,
  customerName,
  bookingRef,
  eventTitle,
  eventDate,
  eventTime,
  venueName,
  seats = [],
  totalAmount = 0,
  qrCodeData,
}) => {
  const client = getResendClient();

  const formattedDate = formatEventDate(eventDate);
  const formattedTime = formatEventTime(eventTime);
  const seatListHtml = seats
    .map(
      (s) =>
        `<li style="padding: 6px 12px; margin-bottom: 6px; background: #22222e; border: 1px solid #333346; border-radius: 6px; color: #ffffff; font-size: 14px; font-weight: 600; display: inline-block; margin-right: 6px;">🎟️ ${s}</li>`
    )
    .join('');

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmed — ${eventTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0b0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
    <div style="max-width: 580px; margin: 30px auto; background: #13131a; border-radius: 18px; overflow: hidden; border: 1px solid #272738; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 32px 24px; text-align: center;">
        <p style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.85); margin: 0 0 6px;">TONIGHT CINEMATIC TICKETS</p>
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">Booking Confirmed!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Your entrance pass is ready</p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 28px 24px;">
        <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 20px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Thank you for booking with <strong>Tonight</strong>. Your reservation for <strong style="color: #ffffff;">${eventTitle}</strong> is secured.
        </p>
        
        <!-- Event Card Details -->
        <div style="background: #181824; border-radius: 12px; padding: 20px; margin: 0 0 20px; border: 1px solid #2b2b3d;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #71717a; padding: 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Booking Reference</td>
              <td style="color: #a78bfa; font-weight: 800; font-family: monospace; font-size: 16px; text-align: right; letter-spacing: 0.05em;">${bookingRef}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Event</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Date & Time</td>
              <td style="color: #ffffff; text-align: right;">${formattedDate} at ${formattedTime}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Venue</td>
              <td style="color: #ffffff; text-align: right;">${venueName}</td>
            </tr>
          </table>
        </div>
        
        <!-- Seats & Amount -->
        <div style="background: #181824; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid #2b2b3d;">
          <div style="color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 10px;">Confirmed Seats</div>
          <div style="margin: 0 0 16px;">
            ${seatListHtml}
          </div>
          <div style="border-top: 1px dashed #2b2b3d; padding-top: 14px; display: flex; justify-content: space-between; align-items: center;">
            <table style="width: 100%;">
              <tr>
                <td style="color: #a1a1aa; font-size: 14px;">Total Paid</td>
                <td style="color: #34d399; font-weight: 800; font-size: 20px; text-align: right;">₹${parseFloat(totalAmount).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- QR Code Ticket -->
        ${
          qrCodeData
            ? `
        <div style="text-align: center; background: #ffffff; border-radius: 14px; padding: 24px 16px; margin: 0 0 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
          <img src="${qrCodeData}" alt="QR Ticket for ${bookingRef}" style="width: 200px; height: 200px; display: block; margin: 0 auto; image-rendering: pixelated;">
          <p style="color: #18181b; font-size: 13px; font-weight: 700; margin: 12px 0 2px; text-transform: uppercase; letter-spacing: 0.05em;">Gate Entrance QR Code</p>
          <p style="color: #71717a; font-size: 12px; margin: 0;">Present this barcode on your phone at venue entry</p>
        </div>
        `
            : ''
        }
        
        <p style="color: #71717a; font-size: 12px; text-align: center; margin: 28px 0 0; line-height: 1.5;">
          This is an automated ticket confirmation from <strong>Tonight</strong>.<br>
          Need assistance? Visit your <a href="${env.FRONTEND_URL}/dashboard" style="color: #8b5cf6; text-decoration: none;">customer dashboard</a>.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  // If no Resend API key or in mock mode, log output
  if (!client) {
    console.log(`📧 [MOCK EMAIL DISPATCH]`);
    console.log(`   To:           ${to}`);
    console.log(`   Subject:      🎫 Booking Confirmed — ${eventTitle} (${bookingRef})`);
    console.log(`   Booking Ref:  ${bookingRef}`);
    console.log(`   Total Amount: ₹${parseFloat(totalAmount).toFixed(2)}`);
    console.log(`   ℹ️ Note: Set RESEND_API_KEY in backend/.env to deliver live emails.`);
    return { id: 'mock-booking-email-id', mock: true };
  }

  try {
    const payload = {
      from: env.FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `🎫 Booking Confirmed — ${eventTitle} (${bookingRef})`,
      html: htmlContent,
    };

    // Attach QR code as PNG image attachment if available
    if (qrCodeData && qrCodeData.includes('base64,')) {
      const base64Data = qrCodeData.split('base64,')[1];
      payload.attachments = [
        {
          filename: `ticket-${bookingRef}.png`,
          content: Buffer.from(base64Data, 'base64'),
        },
      ];
    }

    const response = await client.emails.send(payload);
    console.log(`✅ Live email sent via Resend to ${to} (ID: ${response.data?.id || response.id})`);
    return response;
  } catch (err) {
    console.error(`❌ Resend email dispatch failed for ${to}:`, err.message);
    // Don't crash the booking flow if email fails
    return { error: err.message };
  }
};

/**
 * Send waitlist offer email with time-limited claim link
 */
const sendWaitlistOffer = async ({
  to,
  customerName,
  eventTitle,
  eventDate,
  eventTime,
  venueName,
  offerToken,
  expiresAt,
}) => {
  const client = getResendClient();

  const formattedDate = formatEventDate(eventDate);
  const formattedTime = formatEventTime(eventTime);
  const acceptLink = `${env.FRONTEND_URL}/waitlist/accept/${offerToken}`;
  const expiryTime = new Date(expiresAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seat Available — ${eventTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #0b0b0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e4e4e7;">
    <div style="max-width: 580px; margin: 30px auto; background: #13131a; border-radius: 18px; overflow: hidden; border: 1px solid #272738; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
      
      <!-- Brand Header -->
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 32px 24px; text-align: center;">
        <p style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.9); margin: 0 0 6px;">WAITLIST AUTO-ASSIGNMENT</p>
        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800;">🎉 A Seat Opened Up!</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">Claim your priority reservation before time runs out</p>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 28px 24px;">
        <p style="color: #e4e4e7; font-size: 16px; margin: 0 0 16px;">Hi <strong>${customerName}</strong>,</p>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Good news! A previously booked seat has become available for <strong style="color: #ffffff;">${eventTitle}</strong>. As next in line on the waitlist, you have priority access to claim it.
        </p>
        
        <!-- Details Card -->
        <div style="background: #181824; border-radius: 12px; padding: 20px; margin: 0 0 24px; border: 1px solid #2b2b3d;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Event</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right;">${eventTitle}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Date & Time</td>
              <td style="color: #ffffff; text-align: right;">${formattedDate} at ${formattedTime}</td>
            </tr>
            <tr>
              <td style="color: #71717a; padding: 8px 0;">Venue</td>
              <td style="color: #ffffff; text-align: right;">${venueName}</td>
            </tr>
          </table>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 28px 0;">
          <a href="${acceptLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);">
            ⚡ Claim & Book Seat Now
          </a>
        </div>
        
        <!-- Expiry Warning -->
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 14px 16px; margin: 0 0 20px;">
          <p style="color: #fbbf24; font-size: 13px; margin: 0; line-height: 1.5;">
            ⏱️ <strong>Time Sensitive:</strong> This offer expires at <strong>${expiryTime}</strong>. If unclaimed, the seat will automatically cascade to the next person in line.
          </p>
        </div>
        
        <p style="color: #71717a; font-size: 12px; text-align: center; margin: 24px 0 0;">
          This email was sent by Ticket Booking Platform.
        </p>
      </div>
    </div>
  </body>
  </html>
  `;

  if (!client) {
    console.log(`📧 [MOCK EMAIL DISPATCH]`);
    console.log(`   To:           ${to}`);
    console.log(`   Subject:      🎉 Seat Available — ${eventTitle}`);
    console.log(`   Claim URL:    ${acceptLink}`);
    console.log(`   Expires At:   ${expiresAt}`);
    console.log(`   ℹ️ Note: Set RESEND_API_KEY in backend/.env to deliver live emails.`);
    return { id: 'mock-waitlist-email-id', mock: true };
  }

  try {
    const payload = {
      from: env.FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `🎉 Seat Available — ${eventTitle} (Act Fast!)`,
      html: htmlContent,
    };

    const response = await client.emails.send(payload);
    console.log(`✅ Waitlist offer email sent via Resend to ${to} (ID: ${response.data?.id || response.id})`);
    return response;
  } catch (err) {
    console.error(`❌ Resend waitlist email failed for ${to}:`, err.message);
    return { error: err.message };
  }
};

module.exports = {
  sendBookingConfirmation,
  sendWaitlistOffer,
};
