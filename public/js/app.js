// ============================================
// GLOBAL APP UTILITIES
// Toast, API helper, Sidebar, etc.
// Minimalist Vector Icons (1-Color)
// ============================================

// ============ TOAST NOTIFICATIONS ============
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg class="icon" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
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
  const iconSuccess = '<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  const iconDanger = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  const iconWaiting = '<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const iconProcess = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';

  const map = {
    berhasil: ['badge-success', `${iconSuccess} Terkirim`],
    gagal: ['badge-danger', `${iconDanger} Gagal`],
    belum_dikirim: ['badge-secondary', `${iconWaiting} Belum Dikirim`],
    diproses: ['badge-warning', `${iconProcess} Diproses`]
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
        <span class="modal-title">
          <svg class="icon" viewBox="0 0 24 24" style="color:var(--warning)"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          ${title}
        </span>
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
