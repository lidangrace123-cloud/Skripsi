// ============================================
// MONGOOSE MODELS
// Admin, Karyawan, SlipGaji, Pengiriman
// ============================================
const { mongoose } = require('./db');

// ---- ADMIN ----
const adminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// ---- KARYAWAN ----
const karyawanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nama: { type: String, required: true },
  nomor_whatsapp: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// ---- SLIP GAJI ----
const slipGajiSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  karyawanId: { type: String, required: true },
  namaKaryawan: { type: String, required: true },
  namaFile: { type: String, required: true },        // cloudinary public_id
  originalName: { type: String, required: true },
  cloudinaryUrl: { type: String },                   // URL PDF di Cloudinary
  bulan: { type: Number, required: true },
  bulanNama: { type: String },
  tahun: { type: Number, required: true },
  ukuran: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
  statusPengiriman: { type: String, default: 'belum_dikirim' },
  errorPengiriman: { type: String, default: null },
  lastSentAt: { type: Date, default: null }
});

// ---- PENGIRIMAN ----
const pengirimanSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  jobId: { type: String },
  slipId: { type: String },
  karyawanId: { type: String },
  namaKaryawan: { type: String },
  nomor: { type: String },
  status: { type: String },
  error: { type: String, default: null },
  pdfUrl: { type: String },
  sentAt: { type: Date, default: Date.now }
});

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
const Karyawan = mongoose.models.Karyawan || mongoose.model('Karyawan', karyawanSchema);
const SlipGaji = mongoose.models.SlipGaji || mongoose.model('SlipGaji', slipGajiSchema);
const Pengiriman = mongoose.models.Pengiriman || mongoose.model('Pengiriman', pengirimanSchema);

module.exports = { Admin, Karyawan, SlipGaji, Pengiriman };
