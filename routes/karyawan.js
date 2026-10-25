// ============================================
// KARYAWAN ROUTES
// CRUD Data Karyawan
// ============================================
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/dataStore');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const KARYAWAN_PATH = path.join(__dirname, '../data/karyawan.json');

// Validasi data karyawan
function validateKaryawan(data) {
  const errors = [];
  if (!data.nama || data.nama.trim().length < 2) {
    errors.push('Nama karyawan minimal 2 karakter.');
  }
  if (!data.nomor_whatsapp) {
    errors.push('Nomor WhatsApp wajib diisi.');
  } else {
    const cleaned = data.nomor_whatsapp.replace(/\D/g, '');
    if (!/^62\d{8,14}$/.test(cleaned)) {
      errors.push('Nomor WhatsApp harus format internasional (misal: 6281234567890).');
    }
  }
  return errors;
}

// Halaman karyawan
router.get('/karyawan', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/karyawan.html'));
});

// GET /api/karyawan - Ambil semua karyawan
router.get('/api/karyawan', requireAuth, async (req, res) => {
  try {
    const data = await readJSON(KARYAWAN_PATH);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca data karyawan.' });
  }
});

// GET /api/karyawan/:id - Detail karyawan
router.get('/api/karyawan/:id', requireAuth, async (req, res) => {
  try {
    const data = await readJSON(KARYAWAN_PATH);
    const karyawan = data.find(k => k.id === req.params.id);
    if (!karyawan) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    res.json({ success: true, data: karyawan });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca data.' });
  }
});

// POST /api/karyawan - Tambah karyawan
router.post('/api/karyawan', requireAuth, async (req, res) => {
  const errors = validateKaryawan(req.body);
  if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(' ') });

  try {
    const data = await readJSON(KARYAWAN_PATH);
    const cleaned = req.body.nomor_whatsapp.replace(/\D/g, '');

    // Cek duplikat nomor
    if (data.some(k => k.nomor_whatsapp === cleaned)) {
      return res.status(409).json({ success: false, message: 'Nomor WhatsApp sudah terdaftar.' });
    }

    const newKaryawan = {
      id: 'EMP' + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
      nama: req.body.nama.trim(),
      nomor_whatsapp: cleaned,
      createdAt: new Date().toISOString()
    };

    data.push(newKaryawan);
    await writeJSON(KARYAWAN_PATH, data);
    res.status(201).json({ success: true, message: 'Karyawan berhasil ditambahkan.', data: newKaryawan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan data.' });
  }
});

// PUT /api/karyawan/:id - Update karyawan
router.put('/api/karyawan/:id', requireAuth, async (req, res) => {
  const errors = validateKaryawan(req.body);
  if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(' ') });

  try {
    const data = await readJSON(KARYAWAN_PATH);
    const idx = data.findIndex(k => k.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const cleaned = req.body.nomor_whatsapp.replace(/\D/g, '');

    // Cek duplikat nomor (kecuali dirinya sendiri)
    if (data.some((k, i) => i !== idx && k.nomor_whatsapp === cleaned)) {
      return res.status(409).json({ success: false, message: 'Nomor WhatsApp sudah digunakan karyawan lain.' });
    }

    data[idx] = {
      ...data[idx],
      nama: req.body.nama.trim(),
      nomor_whatsapp: cleaned,
      updatedAt: new Date().toISOString()
    };

    await writeJSON(KARYAWAN_PATH, data);
    res.json({ success: true, message: 'Data karyawan berhasil diperbarui.', data: data[idx] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui data.' });
  }
});

// DELETE /api/karyawan/:id - Hapus karyawan
router.delete('/api/karyawan/:id', requireAuth, async (req, res) => {
  try {
    const data = await readJSON(KARYAWAN_PATH);
    const idx = data.findIndex(k => k.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });

    const deleted = data.splice(idx, 1)[0];
    await writeJSON(KARYAWAN_PATH, data);
    // Catatan: riwayat pengiriman TIDAK dihapus untuk audit
    res.json({ success: true, message: `Karyawan ${deleted.nama} berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data.' });
  }
});

module.exports = router;
