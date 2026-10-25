// ============================================
// SLIP GAJI SERVICE
// PDF token generation and validation
// ============================================
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON } = require('../utils/dataStore');

const SLIP_DATA_PATH = path.join(__dirname, '../data/slipgaji.json');
const UPLOAD_DIR = path.join(__dirname, '../uploads/slipgaji');

// In-memory token store: { token -> { fileId, expiresAt } }
const tokenStore = {};

/**
 * Buat token akses aman untuk preview/download PDF
 * @param {string} fileId - ID file slip gaji
 * @param {number} expirySeconds - Waktu kadaluarsa dalam detik
 * @returns {string} token
 */
function generateAccessToken(fileId, expirySeconds) {
  const expiry = parseInt(expirySeconds || process.env.PDF_TOKEN_EXPIRY || 604800);
  const token = crypto.randomBytes(32).toString('hex');
  tokenStore[token] = {
    fileId: fileId,
    expiresAt: Date.now() + expiry * 1000
  };
  return token;
}

/**
 * Validasi token dan kembalikan fileId jika valid
 * @param {string} token
 * @returns {string|null} fileId atau null jika tidak valid
 */
function validateToken(token) {
  const entry = tokenStore[token];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete tokenStore[token];
    return null;
  }
  return entry.fileId;
}

/**
 * Ambil path file PDF berdasarkan fileId dengan proteksi path traversal
 * @param {string} fileId
 * @returns {Promise<string|null>}
 */
async function getPDFPath(fileId) {
  const slipList = await readJSON(SLIP_DATA_PATH);
  const slip = slipList.find(s => s.id === fileId);
  if (!slip) return null;

  // Path traversal protection
  const filePath = path.resolve(UPLOAD_DIR, slip.namaFile);
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
    return null;
  }
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

/**
 * Build pesan WhatsApp dari template
 */
function buildWhatsAppMessage(namaKaryawan, tanggalPembayaran, pdfUrl) {
  const tanggalFormatted = tanggalPembayaran || 'belum ditentukan';
  return `Yth. Bapak/Ibu ${namaKaryawan},

Dengan hormat,

Kami informasikan bahwa pembayaran gaji untuk tanggal ${tanggalFormatted} telah diproses. Mohon memeriksa informasi slip gaji yang disampaikan melalui pesan ini.

Apabila terdapat pertanyaan atau ketidaksesuaian terkait informasi gaji, silakan menghubungi bagian administrasi.

Demikian informasi ini kami sampaikan. Terima kasih atas perhatian dan kerja sama Anda.

Hormat kami,
Bagian Administrasi

Tautan Slip Gaji: ${pdfUrl}`;
}

/**
 * Daftar nama bulan Indonesia
 */
const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Parse nama file ke metadata karyawan, bulan, tahun
 * Format: NamaKaryawan_Bulan_Tahun.pdf
 * @param {string} fileName
 * @returns {{ nama: string, bulan: number, tahun: number } | null}
 */
function parseFileName(fileName) {
  const base = path.basename(fileName, '.pdf');
  const parts = base.split('_');
  if (parts.length < 3) return null;

  const tahun = parseInt(parts[parts.length - 1]);
  const bulanStr = parts[parts.length - 2];
  const nama = parts.slice(0, parts.length - 2).join(' ');

  const bulan = BULAN_NAMES.findIndex(b => b.toLowerCase() === bulanStr.toLowerCase());
  if (!nama || bulan <= 0 || isNaN(tahun) || tahun < 2000 || tahun > 2100) return null;

  return { nama, bulan, tahun };
}

module.exports = {
  generateAccessToken,
  validateToken,
  getPDFPath,
  buildWhatsAppMessage,
  parseFileName,
  BULAN_NAMES,
  UPLOAD_DIR,
  SLIP_DATA_PATH
};
