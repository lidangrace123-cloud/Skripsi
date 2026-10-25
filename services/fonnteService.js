// ============================================
// FONNTE SERVICE
// WhatsApp message sending via Fonnte API
// ============================================
const axios = require('axios');

const FONNTE_API_URL = 'https://api.fonnte.com/send';

/**
 * Kirim pesan WhatsApp via Fonnte API
 * @param {string} target - Nomor WhatsApp tujuan (format internasional, misal: 6281234567890)
 * @param {string} message - Isi pesan
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
async function sendWhatsApp(target, message) {
  const token = process.env.FONNTE_TOKEN;
  if (!token || token === 'ISI_TOKEN_FONNTE_ANDA_DI_SINI') {
    return {
      success: false,
      data: null,
      error: 'FONNTE_TOKEN belum dikonfigurasi. Silakan isi token Fonnte di file .env'
    };
  }

  try {
    const response = await axios.post(
      FONNTE_API_URL,
      {
        target: target,
        message: message,
        countryCode: '62'
      },
      {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const data = response.data;
    // Fonnte returns {status: true/false, ...}
    if (data && data.status === true) {
      return { success: true, data: data, error: null };
    } else {
      return {
        success: false,
        data: data,
        error: data?.message || data?.reason || 'Fonnte API mengembalikan status gagal'
      };
    }
  } catch (err) {
    if (err.response) {
      // HTTP error response from Fonnte
      return {
        success: false,
        data: err.response.data,
        error: `HTTP ${err.response.status}: ${err.response.data?.message || err.message}`
      };
    } else if (err.code === 'ECONNABORTED') {
      return { success: false, data: null, error: 'Timeout: Fonnte API tidak merespons' };
    } else {
      return { success: false, data: null, error: err.message };
    }
  }
}

/**
 * Validasi format nomor WhatsApp
 * @param {string} nomor
 * @returns {boolean}
 */
function isValidPhone(nomor) {
  // Harus diawali 62 (Indonesia) dan total 10-15 digit
  const cleaned = nomor.replace(/\D/g, '');
  return /^62\d{8,14}$/.test(cleaned);
}

/**
 * Format nomor ke internasional (tambah 62 jika diawali 0)
 * @param {string} nomor
 * @returns {string}
 */
function formatPhone(nomor) {
  let cleaned = nomor.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

module.exports = { sendWhatsApp, isValidPhone, formatPhone };
