const QRCode = require('qrcode');

/**
 * Generate a QR code as a base64-encoded data URL
 * @param {string} data - The data to encode (booking reference)
 * @returns {Promise<string>} Base64 data URL of the QR code
 */
const generateQRCode = async (data) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    });

    return qrDataUrl;
  } catch (err) {
    console.error('❌ QR Code generation failed:', err.message);
    throw err;
  }
};

/**
 * Generate a QR code as a buffer (for email attachment)
 * @param {string} data - The data to encode
 * @returns {Promise<Buffer>} PNG buffer of the QR code
 */
const generateQRCodeBuffer = async (data) => {
  try {
    const buffer = await QRCode.toBuffer(data, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 300,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    });

    return buffer;
  } catch (err) {
    console.error('❌ QR Code buffer generation failed:', err.message);
    throw err;
  }
};

module.exports = { generateQRCode, generateQRCodeBuffer };
