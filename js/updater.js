/**
 * Azota Quiz Master - In-App Auto-Updater
 * Kiểm tra phiên bản mới từ GitHub Releases và cho phép
 * người dùng tải APK cập nhật trực tiếp ngay trong app.
 *
 * Cơ chế:
 *  1. Đọc version.json cục bộ (đi kèm trong APK) để lấy phiên bản hiện tại.
 *  2. Gọi GitHub API /repos/:owner/:repo/releases/latest để lấy phiên bản mới nhất.
 *  3. So sánh semver: nếu remote > local → hiển thị modal Liquid Glass thông báo.
 *  4. Khi người dùng bấm "Cập nhật ngay" → mở URL tải APK từ GitHub Release.
 */

class AppUpdater {
  constructor() {
    // ─── Cấu hình GitHub repo ───
    this.GITHUB_OWNER = 'Anyabloxtraicay';
    this.GITHUB_REPO = 'azota-quiz-app';
    this.RELEASES_API = `https://api.github.com/repos/${this.GITHUB_OWNER}/${this.GITHUB_REPO}/releases/latest`;

    // ─── Phiên bản hiện tại (sẽ được nạp từ version.json local) ───
    this.currentVersion = '0.0.0';
    this.latestVersion = null;
    this.releaseNotes = '';
    this.downloadUrl = '';

    // ─── Tránh hỏi lại trong cùng phiên ───
    this.dismissed = false;
  }

  /**
   * Khởi chạy kiểm tra cập nhật.
   * Gọi hàm này từ App.init() sau khi giao diện đã sẵn sàng.
   */
  async checkForUpdates() {
    try {
      // Bước 1: Đọc phiên bản hiện tại từ version.json đi kèm APK
      await this._loadLocalVersion();

      // Bước 2: Gọi GitHub Releases API
      const release = await this._fetchLatestRelease();
      if (!release) return;

      this.latestVersion = release.tag_name.replace(/^v/, '');
      this.releaseNotes = release.body || '';

      // Tìm file .apk trong danh sách assets
      const apkAsset = (release.assets || []).find(a =>
        a.name.toLowerCase().endsWith('.apk')
      );
      this.downloadUrl = apkAsset
        ? apkAsset.browser_download_url
        : release.html_url; // fallback về trang release

      // Bước 3: So sánh phiên bản
      if (this._isNewerVersion(this.latestVersion, this.currentVersion)) {
        this._showUpdateModal();
      }
    } catch (err) {
      // Lỗi mạng / offline → im lặng, không ảnh hưởng UX
      console.warn('[Updater] Không thể kiểm tra cập nhật:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Đọc phiên bản cục bộ
  // ─────────────────────────────────────────────────────────────

  async _loadLocalVersion() {
    try {
      const res = await fetch('version.json?_=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        this.currentVersion = data.version || '0.0.0';
      }
    } catch {
      // Nếu không đọc được → giữ 0.0.0, luôn hiện update nếu có release
      console.warn('[Updater] Không đọc được version.json cục bộ');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Gọi GitHub API
  // ─────────────────────────────────────────────────────────────

  async _fetchLatestRelease() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // timeout 8s

    try {
      const res = await fetch(this.RELEASES_API, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        // 404 = chưa có release nào → bình thường
        if (res.status === 404) return null;
        throw new Error(`GitHub API trả về ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: So sánh Semver đơn giản (a > b ?)
  // ─────────────────────────────────────────────────────────────

  _isNewerVersion(remote, local) {
    const parse = v => v.split('.').map(n => parseInt(n, 10) || 0);
    const r = parse(remote);
    const l = parse(local);

    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0;
      const lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Hiển thị Modal Cập Nhật (Liquid Glass)
  // ─────────────────────────────────────────────────────────────

  _showUpdateModal() {
    if (this.dismissed) return;

    const modal = document.getElementById('update-modal');
    const overlay = document.getElementById('update-modal-overlay');

    if (!modal || !overlay) return;

    // Cập nhật nội dung
    const versionEl = document.getElementById('update-version-text');
    const notesEl = document.getElementById('update-notes-text');
    const currentEl = document.getElementById('update-current-version');

    if (versionEl) versionEl.textContent = `v${this.latestVersion}`;
    if (currentEl) currentEl.textContent = `Phiên bản hiện tại: v${this.currentVersion}`;

    if (notesEl) {
      // Chuyển markdown cơ bản sang HTML
      const html = this._formatReleaseNotes(this.releaseNotes);
      notesEl.innerHTML = html;
    }

    // Hiển thị modal với animation
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('update-modal-visible');
    });

    // Gắn sự kiện nút
    this._bindModalEvents();
  }

  _hideUpdateModal() {
    const overlay = document.getElementById('update-modal-overlay');
    if (!overlay) return;

    overlay.classList.remove('update-modal-visible');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 300);
  }

  _bindModalEvents() {
    const btnUpdate = document.getElementById('btn-update-now');
    const btnLater = document.getElementById('btn-update-later');

    if (btnUpdate) {
      btnUpdate.onclick = () => {
        this._hideUpdateModal();
        // Mở link tải APK an toàn (hỗ trợ cả Capacitor Native và trình duyệt thông thường)
        try {
          const a = document.createElement('a');
          a.href = this.downloadUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
        } catch {
          window.open(this.downloadUrl, '_system');
        }
      };
    }

    if (btnLater) {
      btnLater.onclick = () => {
        this.dismissed = true;
        this._hideUpdateModal();
      };
    }
  }

  _formatReleaseNotes(md) {
    if (!md) return '<p class="text-on-surface-variant text-xs">Cập nhật mới với nhiều cải tiến.</p>';

    // Escape HTML cơ bản để chống XSS
    let safe = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Chuyển markdown cơ bản
    safe = safe
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^[•\-]\s*(.+)$/gm, '<li class="ml-3 text-xs text-on-surface-variant leading-relaxed">$1</li>')
      .replace(/\n/g, '<br/>');

    // Bọc li vào ul nếu có danh sách
    if (safe.includes('<li')) {
      safe = '<ul class="space-y-1 list-disc list-inside">' + safe + '</ul>';
    }

    return safe;
  }
}

// Export global instance
window.AppUpdater = AppUpdater;
