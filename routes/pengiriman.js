// ============================================
// PENGIRIMAN ROUTES (MongoDB version)
// Bulk WhatsApp sending & retry
// ============================================
const express = require('express');
const { SlipGaji, Karyawan, Pengiriman } = require('../utils/models');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendWhatsApp, isValidPhone } = require('../services/fonnteService');
const {
  generateAccessToken,
  buildWhatsAppMessage
} = require('../services/slipGajiService');

const router = express.Router();

// Job store (in-memory progress tracker)
const jobStore = {};

// Helper: delay
const delay = ms => new Promise(r => setTimeout(r, ms));

// POST /api/slipgaji/kirim - Mulai pengiriman massal
router.post('/api/slipgaji/kirim', requireAuth, async (req, res) => {
  const { bulan, tahun, tanggalPembayaran } = req.body;
  if (!bulan || !tahun) {
    return res.status(400).json({ success: false, message: 'Bulan dan tahun wajib diisi.' });
  }

  try {
    const targetSlips = await SlipGaji.find({
      bulan: parseInt(bulan),
      tahun: parseInt(tahun)
    }).lean();

    if (targetSlips.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak ada slip gaji untuk periode tersebut.' });
    }

    const karyawanList = await Karyawan.find().lean();

    // Buat job ID unik
    const jobId = 'JOB' + Date.now();
    jobStore[jobId] = {
      id: jobId,
      bulan: parseInt(bulan),
      tahun: parseInt(tahun),
      tanggalPembayaran: tanggalPembayaran || null,
      total: targetSlips.length,
      berhasil: 0,
      gagal: 0,
      diproses: 0,
      menunggu: targetSlips.length,
      status: 'running',
      startedAt: new Date().toISOString(),
      details: []
    };

    // Respond langsung, proses di background
    res.json({ success: true, jobId, message: `Pengiriman dimulai untuk ${targetSlips.length} slip gaji.` });

    // Process di background
    processKirim(jobId, targetSlips, karyawanList, tanggalPembayaran);
  } catch (err) {
    console.error('Kirim error:', err);
    res.status(500).json({ success: false, message: 'Gagal memulai pengiriman.' });
  }
});

async function processKirim(jobId, targetSlips, karyawanList, tanggalPembayaran) {
  const job = jobStore[jobId];
  const delayMs = parseInt(process.env.SEND_DELAY_MS || 2000);
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  for (const slip of targetSlips) {
    job.diproses++;
    job.menunggu--;

    const detail = {
      slipId: slip.id,
      namaKaryawan: slip.namaKaryawan,
      karyawanId: slip.karyawanId,
      originalName: slip.originalName,
      startedAt: new Date().toISOString(),
      status: 'diproses',
      error: null
    };

    // Cari karyawan
    const karyawan = karyawanList.find(k => k.id === slip.karyawanId);
    if (!karyawan) {
      detail.status = 'gagal';
      detail.error = 'Karyawan tidak ditemukan di database.';
      job.gagal++;
      job.diproses--;
      job.details.push(detail);
      await updateSlipStatus(slip.id, 'gagal', detail.error);
      continue;
    }

    // Validasi nomor
    if (!isValidPhone(karyawan.nomor_whatsapp)) {
      detail.status = 'gagal';
      detail.error = `Nomor WhatsApp tidak valid: ${karyawan.nomor_whatsapp}`;
      job.gagal++;
      job.diproses--;
      job.details.push(detail);
      await updateSlipStatus(slip.id, 'gagal', detail.error);
      continue;
    }

    // Generate token PDF
    const token = generateAccessToken(slip.id);
    const pdfUrl = `${baseUrl}/file/${token}`;

    // Build pesan
    const pesan = buildWhatsAppMessage(karyawan.nama, tanggalPembayaran, pdfUrl);

    // Kirim via Fonnte
    const result = await sendWhatsApp(karyawan.nomor_whatsapp, pesan);

    detail.finishedAt = new Date().toISOString();
    detail.fonnteResponse = result.data;
    detail.pdfUrl = pdfUrl;
    detail.nomor = karyawan.nomor_whatsapp;

    if (result.success) {
      detail.status = 'berhasil';
      job.berhasil++;
    } else {
      detail.status = 'gagal';
      detail.error = result.error;
      job.gagal++;
    }
    job.diproses--;
    job.details.push(detail);

    // Update status slip
    await updateSlipStatus(slip.id, detail.status, detail.error);

    // Simpan riwayat pengiriman ke MongoDB
    try {
      await Pengiriman.create({
        id: 'LOG' + Date.now() + Math.random().toString(36).slice(2, 6),
        jobId,
        slipId: slip.id,
        karyawanId: karyawan.id,
        namaKaryawan: karyawan.nama,
        nomor: karyawan.nomor_whatsapp,
        status: detail.status,
        error: detail.error || null,
        pdfUrl: detail.pdfUrl,
        sentAt: new Date()
      });
    } catch (e) {
      console.error('Gagal simpan riwayat:', e.message);
    }

    await delay(delayMs);
  }

  job.status = 'selesai';
  job.finishedAt = new Date().toISOString();
}

async function updateSlipStatus(slipId, status, errorMsg) {
  try {
    await SlipGaji.findOneAndUpdate(
      { id: slipId },
      {
        statusPengiriman: status,
        errorPengiriman: errorMsg || null,
        lastSentAt: new Date()
      }
    );
  } catch (err) {
    console.error('Gagal update status slip:', err.message);
  }
}

// GET /api/pengiriman/:jobId - Status job pengiriman
router.get('/api/pengiriman/:jobId', requireAuth, async (req, res) => {
  const job = jobStore[req.params.jobId];
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job tidak ditemukan.' });
  }
  res.json({ success: true, data: job });
});

// GET /api/pengiriman - Riwayat pengiriman
router.get('/api/pengiriman', requireAuth, async (req, res) => {
  try {
    const data = await Pengiriman.find().sort({ sentAt: -1 }).limit(100).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca riwayat.' });
  }
});

// POST /api/pengiriman/:slipId/retry - Retry pengiriman gagal
router.post('/api/pengiriman/:slipId/retry', requireAuth, async (req, res) => {
  const { tanggalPembayaran } = req.body;
  try {
    const slip = await SlipGaji.findOne({ id: req.params.slipId }).lean();
    if (!slip) return res.status(404).json({ success: false, message: 'Slip tidak ditemukan.' });

    const karyawan = await Karyawan.findOne({ id: slip.karyawanId }).lean();
    if (!karyawan) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    if (!isValidPhone(karyawan.nomor_whatsapp)) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid.' });
    }

    await updateSlipStatus(slip.id, 'diproses', null);

    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const token = generateAccessToken(slip.id);
    const pdfUrl = `${baseUrl}/file/${token}`;
    const pesan = buildWhatsAppMessage(karyawan.nama, tanggalPembayaran, pdfUrl);

    const result = await sendWhatsApp(karyawan.nomor_whatsapp, pesan);

    const status = result.success ? 'berhasil' : 'gagal';
    await updateSlipStatus(slip.id, status, result.error);

    // Log
    await Pengiriman.create({
      id: 'LOG' + Date.now(),
      jobId: 'RETRY',
      slipId: slip.id,
      karyawanId: karyawan.id,
      namaKaryawan: karyawan.nama,
      nomor: karyawan.nomor_whatsapp,
      status,
      error: result.error || null,
      pdfUrl,
      sentAt: new Date()
    });

    res.json({
      success: result.success,
      message: result.success ? 'Pengiriman ulang berhasil.' : `Gagal: ${result.error}`,
      status
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal mengirim ulang.' });
  }
});

module.exports = router;
