// ============================================
// AUTH MIDDLEWARE
// ============================================
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // API request -> return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Tidak terautentikasi. Silakan login.' });
  }
  // Web request -> redirect to login
  return res.redirect('/login');
}

module.exports = { requireAuth };
