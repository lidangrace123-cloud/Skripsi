// ============================================
// KARYAWAN ROUTES (MongoDB version)
// CRUD Data Karyawan
// ============================================
const express = require('express');
const path = require('path');
const { Karyawan } = require('../utils/models');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

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
    const data = await Karyawan.find().sort({ createdAt: 1 }).lean();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal membaca data karyawan.' });
  }
});

// GET /api/karyawan/:id - Detail karyawan
router.get('/api/karyawan/:id', requireAuth, async (req, res) => {
  try {
    const karyawan = await Karyawan.findOne({ id: req.params.id }).lean();
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
    const cleaned = req.body.nomor_whatsapp.replace(/\D/g, '');

    // Cek duplikat nomor
    const exists = await Karyawan.findOne({ nomor_whatsapp: cleaned });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Nomor WhatsApp sudah terdaftar.' });
    }

    const newKaryawan = await Karyawan.create({
      id: 'EMP' + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase(),
      nama: req.body.nama.trim(),
      nomor_whatsapp: cleaned,
      createdAt: new Date()
    });

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
    const cleaned = req.body.nomor_whatsapp.replace(/\D/g, '');

    // Cek duplikat nomor (kecuali dirinya sendiri)
    const duplicate = await Karyawan.findOne({ nomor_whatsapp: cleaned, id: { $ne: req.params.id } });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Nomor WhatsApp sudah digunakan karyawan lain.' });
    }

    const updated = await Karyawan.findOneAndUpdate(
      { id: req.params.id },
      { nama: req.body.nama.trim(), nomor_whatsapp: cleaned, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    res.json({ success: true, message: 'Data karyawan berhasil diperbarui.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui data.' });
  }
});

// DELETE /api/karyawan/:id - Hapus karyawan
router.delete('/api/karyawan/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await Karyawan.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Karyawan tidak ditemukan.' });
    res.json({ success: true, message: `Karyawan ${deleted.nama} berhasil dihapus.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data.' });
  }
});

module.exports = router;
