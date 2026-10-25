// ============================================
// PENGIRIMAN ROUTES
// Bulk WhatsApp sending & retry
// ============================================
const express = require('express');
const path = require('path');
const { readJSON, writeJSON } = require('../utils/dataStore');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendWhatsApp, isValidPhone } = require('../services/fonnteService');
const {
  generateAccessToken,
  buildWhatsAppMessage,
  SLIP_DATA_PATH
} = require('../services/slipGajiService');

const router = express.Router();
const KARYAWAN_PATH = path.join(__dirname, '../data/karyawan.json');
const PENGIRIMAN_PATH = path.join(__dirname, '../data/pengiriman.json');

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
    const slipList = await readJSON(SLIP_DATA_PATH);
    const karyawanList = await readJSON(KARYAWAN_PATH);

    const targetSlips = slipList.filter(
      s => s.bulan === parseInt(bulan) && s.tahun === parseInt(tahun)
    );

    if (targetSlips.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak ada slip gaji untuk periode tersebut.' });
    }

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
  const pengirimanList = await readJSON(PENGIRIMAN_PATH);

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

    // Simpan riwayat pengiriman
    pengirimanList.push({
      id: 'LOG' + Date.now() + Math.random().toString(36).slice(2, 6),
      jobId,
      slipId: slip.id,
      karyawanId: karyawan.id,
      namaKaryawan: karyawan.nama,
      nomor: karyawan.nomor_whatsapp,
      status: detail.status,
      error: detail.error || null,
      pdfUrl: detail.pdfUrl,
      sentAt: detail.finishedAt || new Date().toISOString()
    });

    await delay(delayMs);
  }

  job.status = 'selesai';
  job.finishedAt = new Date().toISOString();

  // Simpan riwayat
  try {
    await writeJSON(PENGIRIMAN_PATH, pengirimanList);
  } catch (e) {
    console.error('Gagal menyimpan riwayat pengiriman:', e.message);
  }
}

async function updateSlipStatus(slipId, status, errorMsg) {
  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const idx = slipList.findIndex(s => s.id === slipId);
    if (idx !== -1) {
      slipList[idx].statusPengiriman = status;
      slipList[idx].errorPengiriman = errorMsg || null;
      slipList[idx].lastSentAt = new Date().toISOString();
      await writeJSON(SLIP_DATA_PATH, slipList);
    }
  } catch (err) {
    console.error('Gagal update status slip:', err.message);
  }
}

// GET /api/pengiriman/:jobId - Status job pengiriman
router.get('/api/pengiriman/:jobId', requireAuth, async (req, res) => {
  const job = jobStore[req.params.jobId];
  if (!job) {
    // Cari dari riwayat
    return res.status(404).json({ success: false, message: 'Job tidak ditemukan.' });
  }
  res.json({ success: true, data: job });
});

// GET /api/pengiriman - Riwayat pengiriman
router.get('/api/pengiriman', requireAuth, async (req, res) => {
  try {
    const data = await readJSON(PENGIRIMAN_PATH);
    data.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    res.json({ success: true, data: data.slice(0, 100) }); // limit 100
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca riwayat.' });
  }
});

// POST /api/pengiriman/:slipId/retry - Retry pengiriman gagal
router.post('/api/pengiriman/:slipId/retry', requireAuth, async (req, res) => {
  const { tanggalPembayaran } = req.body;
  try {
    const slipList = await readJSON(SLIP_DATA_PATH);
    const karyawanList = await readJSON(KARYAWAN_PATH);

    const slip = slipList.find(s => s.id === req.params.slipId);
    if (!slip) return res.status(404).json({ success: false, message: 'Slip tidak ditemukan.' });

    const karyawan = karyawanList.find(k => k.id === slip.karyawanId);
    if (!karyawan) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    if (!isValidPhone(karyawan.nomor_whatsapp)) {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp tidak valid.' });
    }

    // Update status to diproses
    await updateSlipStatus(slip.id, 'diproses', null);

    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const token = generateAccessToken(slip.id);
    const pdfUrl = `${baseUrl}/file/${token}`;
    const pesan = buildWhatsAppMessage(karyawan.nama, tanggalPembayaran, pdfUrl);

    const result = await sendWhatsApp(karyawan.nomor_whatsapp, pesan);

    const status = result.success ? 'berhasil' : 'gagal';
    await updateSlipStatus(slip.id, status, result.error);

    // Log
    const pengirimanList = await readJSON(PENGIRIMAN_PATH);
    pengirimanList.push({
      id: 'LOG' + Date.now(),
      jobId: 'RETRY',
      slipId: slip.id,
      karyawanId: karyawan.id,
      namaKaryawan: karyawan.nama,
      nomor: karyawan.nomor_whatsapp,
      status,
      error: result.error || null,
      pdfUrl,
      sentAt: new Date().toISOString()
    });
    await writeJSON(PENGIRIMAN_PATH, pengirimanList);

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
