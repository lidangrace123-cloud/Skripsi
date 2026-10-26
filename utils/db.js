// ============================================
// DATABASE CONNECTION - MongoDB Atlas
// ============================================
const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI tidak ditemukan di environment variables!');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log('✅ MongoDB Atlas terhubung');
  } catch (err) {
    console.error('❌ Gagal koneksi MongoDB:', err.message);
    throw err;
  }
}

module.exports = { connectDB, mongoose };
