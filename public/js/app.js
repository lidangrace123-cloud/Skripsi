// ============================================
// GLOBAL APP UTILITIES
// Toast, API helper, Sidebar, etc.
// ============================================

// ============ TOAST NOTIFICATIONS ============
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============ API HELPER ============
async function apiRequest(method, url, body = null) {
  const options = {
    method: method.toUpperCase(),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  };

  if (body && method.toUpperCase() !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }

  return res.json();
}

async function apiUpload(url, formData) {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'same-origin'
  });

  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }

  return res.json();
}

// ============ SIDEBAR TOGGLE ============
function initSidebar() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  });

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// ============ LOGOUT ============
async function logout() {
  const result = await apiRequest('POST', '/api/auth/logout');
  if (result) window.location.href = '/login';
}

// ============ FORMAT DATE ============
function formatDate(isoStr) {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ============ FORMAT FILE SIZE ============
function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============ STATUS BADGE ============
function statusBadge(status) {
  const map = {
    berhasil: ['badge-success', '✅ Terkirim'],
    gagal: ['badge-danger', '❌ Gagal'],
    belum_dikirim: ['badge-secondary', '⏳ Belum Dikirim'],
    diproses: ['badge-warning', '🔄 Diproses']
  };
  const [cls, label] = map[status] || ['badge-secondary', status || '-'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ============ CONFIRM MODAL ============
function showConfirm(title, message, onConfirm) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirm-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <span class="modal-title">⚠️ ${title}</span>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary);font-size:14px;line-height:1.7">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-cancel">Batal</button>
        <button class="btn btn-danger" id="confirm-ok">Ya, Hapus</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('confirm-cancel').addEventListener('click', () => modal.remove());
  document.getElementById('confirm-ok').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });
}

// ============ BULAN NAMES ============
const BULAN_NAMES = [
  '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  // Set active nav
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item[data-href]').forEach(item => {
    if (item.dataset.href === currentPath) {
      item.classList.add('active');
    }
  });
});
