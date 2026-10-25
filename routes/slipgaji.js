// ============================================
// SLIP GAJI ROUTES
// Upload, List, Preview, Download, Delete PDF
// ============================================
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { readJSON, writeJSON } = require('../utils/dataStore');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  generateAccessToken,
  validateToken,
  getPDFPath,
  parseFileName,
  BULAN_NAMES,
  UPLOAD_DIR,
  SLIP_DATA_PATH
} = require('../services/slipGajiService');

const router = express.Router();
const KARYAWAN_PATH = path.join(__dirname, '../data/karyawan.json');

// Pastikan folder upload ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer config - simpan ke memory dulu untuk validasi
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 10485760) },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF yang diizinkan.'));
    }
  }
});

// Halaman slip gaji
router.get('/slipgaji', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/slipgaji.html'));
});

// GET /api/slipgaji - List dengan filter
router.get('/api/slipgaji', requireAuth, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    let data = await readJSON(SLIP_DATA_PATH);

    if (bulan) data = data.filter(s => s.bulan === parseInt(bulan));
    if (tahun) data = data.filter(s => s.tahun === parseInt(tahun));

    // Urutkan terbaru
    data.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca data slip gaji.' });
  }
});

// POST /api/slipgaji/upload - Upload PDF
router.post('/api/slipgaji/upload', requireAuth, upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
  }

  const { bulan, tahun, karyawanId } = req.body;
  if (!bulan || !tahun) {
    return res.status(400).json({ success: false, message: 'Bulan dan tahun wajib dipilih.' });
  }

  const bulanInt = parseInt(bulan);
  const tahunInt = parseInt(tahun);
  if (bulanInt < 1 || bulanInt > 12 || tahunInt < 2000 || tahunInt > 2100) {
    return res.status(400).json({ success: false, message: 'Bulan atau tahun tidak valid.' });
  }

  const karyawanList = await readJSON(KARYAWAN_PATH);
  const slipList = await readJSON(SLIP_DATA_PATH);

  const results = [];

  for (const file of req.files) {
    // Validasi isi file (cek magic bytes PDF)
    if (!file.buffer.slice(0, 4).equals(Buffer.from('%PDF'))) {
      results.push({ name: file.originalname, success: false, error: 'File bukan PDF yang valid.' });
      continue;
    }

    let matchedKaryawan = null;

    // Coba parse nama file
    const parsed = parseFileName(file.originalname);
    if (parsed) {
      matchedKaryawan = karyawanList.find(
        k => k.nama.toLowerCase() === parsed.nama.toLowerCase()
      );
    }

    // Jika tidak ditemukan dari nama file, gunakan karyawanId dari form
    if (!matchedKaryawan && karyawanId) {
      matchedKaryawan = karyawanList.find(k => k.id === karyawanId);
    }

    if (!matchedKaryawan) {
      results.push({
        name: file.originalname,
        success: false,
        error: 'Karyawan tidak ditemukan. Format nama file: NamaKaryawan_Bulan_Tahun.pdf'
      });
      continue;
    }

    // Generate nama file aman
    const safeId = require('crypto').randomBytes(16).toString('hex');
    const bulanNama = BULAN_NAMES[bulanInt];
    const safeFileName = `${safeId}.pdf`;
    const destPath = path.join(UPLOAD_DIR, safeFileName);

    try {
      fs.writeFileSync(destPath, file.buffer);
    } catch (writeErr) {
      results.push({ name: file.originalname, success: false, error: 'Gagal menyimpan file.' });
      continue;
    }

    const newSlip = {
      id: safeId,
      karyawanId: matchedKaryawan.id,
      namaKaryawan: matchedKaryawan.nama,
      namaFile: safeFileName,
      originalName: file.originalname,
      bulan: bulanInt,
      bulanNama,
      tahun: tahunInt,
      ukuran: file.size,
      uploadedAt: new Date().toISOString(),
      statusPengiriman: 'belum_dikirim'
    };

    slipList.push(newSlip);
    results.push({ name: file.originalname, success: true, data: newSlip });
  }

  await writeJSON(SLIP_DATA_PATH, slipList);
  const berhasil = results.filter(r => r.success).length;
  const gagal = results.filter(r => !r.success).length;

  res.json({
    success: true,
    message: `Upload selesai: ${berhasil} berhasil, ${gagal} gagal.`,
    results
  });
});

// GET /api/slipgaji/:id/preview - Preview PDF inline (requires auth OR valid token)
router.get('/api/slipgaji/:id/preview', requireAuth, async (req, res) => {
  try {
    const filePath = await getPDFPath(req.params.id);
    if (!filePath) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat PDF.' });
  }
});

// GET /api/slipgaji/:id/download - Download PDF (admin)
router.get('/api/slipgaji/:id/download', requireAuth, async (req, res) => {
  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const slip = slipList.find(s => s.id === req.params.id);
    if (!slip) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

    const filePath = await getPDFPath(req.params.id);
    if (!filePath) return res.status(404).json({ success: false, message: 'File tidak ditemukan di server.' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slip.originalName}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengunduh file.' });
  }
});

// GET /file/:token - Akses PDF via token (untuk link WhatsApp)
router.get('/file/:token', async (req, res) => {
  const fileId = validateToken(req.params.token);
  if (!fileId) {
    return res.status(403).send('<h2>Tautan tidak valid atau telah kadaluarsa.</h2>');
  }

  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const slip = slipList.find(s => s.id === fileId);
    if (!slip) return res.status(404).send('<h2>File tidak ditemukan.</h2>');

    const filePath = await getPDFPath(fileId);
    if (!filePath) return res.status(404).send('<h2>File tidak ditemukan di server.</h2>');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${slip.originalName}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send('<h2>Terjadi kesalahan server.</h2>');
  }
});

// DELETE /api/slipgaji/:id - Hapus file dan metadata
router.delete('/api/slipgaji/:id', requireAuth, async (req, res) => {
  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const idx = slipList.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

    const slip = slipList[idx];
    const filePath = path.join(UPLOAD_DIR, slip.namaFile);

    // Hapus file fisik
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    slipList.splice(idx, 1);
    await writeJSON(SLIP_DATA_PATH, slipList);
    res.json({ success: true, message: `File ${slip.originalName} berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus file.' });
  }
});

// GET /api/slipgaji/stats - Statistik untuk dashboard
router.get('/api/slipgaji/stats', requireAuth, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const slipList = await readJSON(SLIP_DATA_PATH);
    const karyawanList = await readJSON(KARYAWAN_PATH);

    let filtered = slipList;
    if (bulan) filtered = filtered.filter(s => s.bulan === parseInt(bulan));
    if (tahun) filtered = filtered.filter(s => s.tahun === parseInt(tahun));

    const stats = {
      totalKaryawan: karyawanList.length,
      totalSlip: slipList.length,
      slipPeriodeIni: filtered.length,
      berhasil: filtered.filter(s => s.statusPengiriman === 'berhasil').length,
      gagal: filtered.filter(s => s.statusPengiriman === 'gagal').length,
      menunggu: filtered.filter(s => s.statusPengiriman === 'belum_dikirim').length,
      diproses: filtered.filter(s => s.statusPengiriman === 'diproses').length
    };

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengambil statistik.' });
  }
});

// POST /api/slipgaji/:id/generate-token - Buat token akses sementara
router.post('/api/slipgaji/:id/generate-token', requireAuth, async (req, res) => {
  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const slip = slipList.find(s => s.id === req.params.id);
    if (!slip) return res.status(404).json({ success: false, message: 'Slip tidak ditemukan.' });

    const token = generateAccessToken(req.params.id);
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/file/${token}`;

    res.json({ success: true, token, url });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membuat token.' });
  }
});

module.exports = router;
