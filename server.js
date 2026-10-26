// ============================================
// SERVER.JS - Main Application Entry Point
// PayRoll WhatsApp Manager
// ============================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./utils/db');

const authRoutes = require('./routes/auth');
const karyawanRoutes = require('./routes/karyawan');
const slipgajiRoutes = require('./routes/slipgaji');
const pengirimanRoutes = require('./routes/pengiriman');
const { requireAuth } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Ensure public directories exist
// ============================================
['public/css', 'public/js'].forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// ============================================
// Security Middleware
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

// ============================================
// Core Middleware
// ============================================
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// Session Configuration
// ============================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_please_change',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 jam
  }
}));

// ============================================
// Static Files (CSS, JS, public assets only)
// ============================================
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================
// Routes
// ============================================
// Auth routes (login, logout)
app.use('/', authRoutes);

// Protected page routes
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/dashboard.html'));
});

// API and page routes
app.use('/', karyawanRoutes);
app.use('/', slipgajiRoutes);
app.use('/', pengirimanRoutes);

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Ukuran file melebihi batas maksimal.' });
  }
  res.status(500).json({ success: false, message: 'Terjadi kesalahan server.' });
});

// ============================================
// Start Server (connect DB first)
// ============================================
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║      PayRoll WhatsApp Manager - AKTIF        ║');
      console.log('╠══════════════════════════════════════════════╣');
      console.log(`║  URL: http://localhost:${PORT}                 ║`);
      console.log(`║  Mode: ${process.env.NODE_ENV || 'development'}                        ║`);
      console.log('╠══════════════════════════════════════════════╣');
      console.log('║  Login: admin / admin123                     ║');
      console.log('╚══════════════════════════════════════════════╝');
      console.log('');
      if (!process.env.FONNTE_TOKEN || process.env.FONNTE_TOKEN === 'ISI_TOKEN_FONNTE_ANDA_DI_SINI') {
        console.warn('⚠️  PERINGATAN: FONNTE_TOKEN belum dikonfigurasi di .env');
      }
      if (process.env.APP_BASE_URL === 'http://localhost:3000') {
        console.warn('⚠️  PERINGATAN: APP_BASE_URL masih localhost. Gunakan URL HTTPS untuk pengiriman WhatsApp.');
      }
    });
  })
  .catch(err => {
    console.error('❌ Gagal koneksi database, server tidak jalan:', err.message);
    process.exit(1);
  });
