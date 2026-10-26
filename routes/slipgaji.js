// ============================================
// SLIP GAJI ROUTES (MongoDB + Cloudinary version)
// Upload, List, Preview, Download, Delete PDF
// ============================================
const express = require('express');
const path = require('path');
const multer = require('multer');
const { SlipGaji, Karyawan } = require('../utils/models');
const { requireAuth } = require('../middleware/authMiddleware');
const { uploadPDF, deletePDF } = require('../utils/cloudinaryHelper');
const {
  generateAccessToken,
  validateToken,
  BULAN_NAMES,
  parseFileName
} = require('../services/slipGajiService');

const router = express.Router();

// Multer config - simpan ke memory untuk validasi & upload ke Cloudinary
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
    const filter = {};
    if (bulan) filter.bulan = parseInt(bulan);
    if (tahun) filter.tahun = parseInt(tahun);

    const data = await SlipGaji.find(filter).sort({ uploadedAt: -1 }).lean();
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca data slip gaji.' });
  }
});

// POST /api/slipgaji/upload - Upload PDF ke Cloudinary
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

  const karyawanList = await Karyawan.find().lean();
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

    // Generate ID unik
    const safeId = require('crypto').randomBytes(16).toString('hex');
    const bulanNama = BULAN_NAMES[bulanInt];

    try {
      // Upload ke Cloudinary
      const { url, publicId } = await uploadPDF(file.buffer, safeId);

      const newSlip = await SlipGaji.create({
        id: safeId,
        karyawanId: matchedKaryawan.id,
        namaKaryawan: matchedKaryawan.nama,
        namaFile: publicId,         // cloudinary public_id untuk delete
        originalName: file.originalname,
        cloudinaryUrl: url,         // URL langsung ke Cloudinary
        bulan: bulanInt,
        bulanNama,
        tahun: tahunInt,
        ukuran: file.size,
        uploadedAt: new Date(),
        statusPengiriman: 'belum_dikirim'
      });

      results.push({ name: file.originalname, success: true, data: newSlip });
    } catch (uploadErr) {
      console.error('Upload error:', uploadErr);
      results.push({ name: file.originalname, success: false, error: 'Gagal upload ke cloud storage.' });
    }
  }

  const berhasil = results.filter(r => r.success).length;
  const gagal = results.filter(r => !r.success).length;

  res.json({
    success: true,
    message: `Upload selesai: ${berhasil} berhasil, ${gagal} gagal.`,
    results
  });
});

// GET /api/slipgaji/:id/preview - Preview PDF inline (redirect ke Cloudinary URL)
router.get('/api/slipgaji/:id/preview', requireAuth, async (req, res) => {
  try {
    const slip = await SlipGaji.findOne({ id: req.params.id });
    if (!slip || !slip.cloudinaryUrl) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    }
    // Redirect ke URL Cloudinary
    res.redirect(slip.cloudinaryUrl);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memuat PDF.' });
  }
});

// GET /api/slipgaji/:id/download - Download PDF
router.get('/api/slipgaji/:id/download', requireAuth, async (req, res) => {
  try {
    const slip = await SlipGaji.findOne({ id: req.params.id });
    if (!slip || !slip.cloudinaryUrl) {
      return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });
    }
    res.redirect(slip.cloudinaryUrl);
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
    const slip = await SlipGaji.findOne({ id: fileId });
    if (!slip || !slip.cloudinaryUrl) {
      return res.status(404).send('<h2>File tidak ditemukan.</h2>');
    }
    res.redirect(slip.cloudinaryUrl);
  } catch (err) {
    res.status(500).send('<h2>Terjadi kesalahan server.</h2>');
  }
});

// DELETE /api/slipgaji/:id - Hapus file dan metadata
router.delete('/api/slipgaji/:id', requireAuth, async (req, res) => {
  try {
    const slip = await SlipGaji.findOne({ id: req.params.id });
    if (!slip) return res.status(404).json({ success: false, message: 'File tidak ditemukan.' });

    // Hapus dari Cloudinary
    if (slip.namaFile) {
      await deletePDF(slip.namaFile);
    }

    await SlipGaji.deleteOne({ id: req.params.id });
    res.json({ success: true, message: `File ${slip.originalName} berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus file.' });
  }
});

// GET /api/slipgaji/stats - Statistik untuk dashboard
router.get('/api/slipgaji/stats', requireAuth, async (req, res) => {
  try {
    const { bulan, tahun } = req.query;
    const filter = {};
    if (bulan) filter.bulan = parseInt(bulan);
    if (tahun) filter.tahun = parseInt(tahun);

    const [totalKaryawan, totalSlip, filtered] = await Promise.all([
      Karyawan.countDocuments(),
      SlipGaji.countDocuments(),
      SlipGaji.find(filter).lean()
    ]);

    const stats = {
      totalKaryawan,
      totalSlip,
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
    const slip = await SlipGaji.findOne({ id: req.params.id });
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
