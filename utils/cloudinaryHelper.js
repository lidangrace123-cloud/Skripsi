// ============================================
// CLOUDINARY CONFIG & HELPER
// Upload PDF ke Cloudinary (cloud storage)
// ============================================
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload buffer PDF ke Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {string} publicId - Nama file di Cloudinary
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadPDF(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'raw',   // 'raw' untuk non-image (PDF)
        folder: 'wasender-slipgaji',
        format: 'pdf'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Hapus file dari Cloudinary
 * @param {string} publicId
 */
async function deletePDF(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (err) {
    console.error('Gagal hapus dari Cloudinary:', err.message);
  }
}

module.exports = { uploadPDF, deletePDF, cloudinary };
