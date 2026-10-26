const app = require('../server');
const { connectDB } = require('../utils/db');
const authRoutes = require('../routes/auth');

let initialized = false;

module.exports = async (req, res) => {
  try {
    await connectDB();
    if (!initialized) {
      if (authRoutes.initAdmin) {
        await authRoutes.initAdmin();
      }
      initialized = true;
    }
    return app(req, res);
  } catch (err) {
    console.error('Vercel handler error:', err);
    res.status(500).send('Database connection error: ' + err.message);
  }
};
