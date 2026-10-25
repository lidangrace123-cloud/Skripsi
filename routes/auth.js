// ============================================
// AUTH ROUTES
// Login, Logout, Change Password
// ============================================
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const { readJSON, writeJSON } = require('../utils/dataStore');

const router = express.Router();
const ADMIN_DATA_PATH = path.join(__dirname, '../data/admin.json');

// Inisialisasi admin default jika belum ada
async function initAdmin() {
  const admins = await readJSON(ADMIN_DATA_PATH);
  if (!admins || admins.length === 0) {
    const hashed = await bcrypt.hash('admin123', 12);
    await writeJSON(ADMIN_DATA_PATH, [{
      id: 'admin001',
      username: 'admin',
      passwordHash: hashed,
      createdAt: new Date().toISOString()
    }]);
    console.log('✅ Admin default dibuat: username=admin, password=admin123');
  }
}
initAdmin();

// GET /login
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

// POST /api/auth/login
router.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }

  try {
    const admins = await readJSON(ADMIN_DATA_PATH);
    const admin = admins.find(a => a.username === username.trim());
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Username atau password salah.' });
    }

    // Buat session
    req.session.userId = admin.id;
    req.session.username = admin.username;
    return res.json({ success: true, message: 'Login berhasil.', redirect: '/dashboard' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// POST /api/auth/logout
router.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/login' });
  });
});

// POST /api/auth/change-password
router.post('/api/auth/change-password', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Tidak terautentikasi.' });
  }
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
  }

  try {
    const admins = await readJSON(ADMIN_DATA_PATH);
    const idx = admins.findIndex(a => a.id === req.session.userId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' });

    const valid = await bcrypt.compare(currentPassword, admins[idx].passwordHash);
    if (!valid) return res.status(401).json({ success: false, message: 'Password saat ini salah.' });

    admins[idx].passwordHash = await bcrypt.hash(newPassword, 12);
    admins[idx].updatedAt = new Date().toISOString();
    await writeJSON(ADMIN_DATA_PATH, admins);
    return res.json({ success: true, message: 'Password berhasil diperbarui.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
  }
});

// GET /api/auth/me
router.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  return res.json({ loggedIn: false });
});

module.exports = router;
