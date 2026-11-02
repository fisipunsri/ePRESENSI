/* ePRESENSI - bar "Pasang ePRESENSI" (Android Chrome + iPhone Safari).
   Mandiri: styles & elemen dibuat dari sini, tidak perlu mengubah CSS/HTML di index.html. */
(function () {
  'use strict';

  var HANYA_DI_LOGIN = true;      // true = bar hanya di layar login; false = di semua layar
  var TUTUP_HARI = 7;             // setelah ditutup, bar tidak muncul lagi selama 7 hari
  var KEY = 'epresensi_pwa_tutup';

  // Daftarkan service worker (diperlukan agar Chrome menawarkan pemasangan)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  // Sudah dibuka dari ikon (mode aplikasi)? Maka bar tidak pernah tampil.
  var standalone = false;
  try {
    standalone = navigator.standalone === true ||
      (window.matchMedia && (matchMedia('(display-mode: standalone)').matches ||
                             matchMedia('(display-mode: fullscreen)').matches ||
                             matchMedia('(display-mode: minimal-ui)').matches));
  } catch (e) {}
  if (standalone) return;

  var ua = navigator.userAgent || '';
  var iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var safariIOS = iOS && /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger/.test(ua);

  var mode = safariIOS ? 'ios' : null;   // 'android' diset saat beforeinstallprompt datang
  var deferred = null;
  var bar = null;

  function ditutup() {
    try {
      var t = +localStorage.getItem(KEY) || 0;
      return !!t && (Date.now() - t) < TUTUP_HARI * 864e5;
    } catch (e) { return false; }
  }
  function catatTutup() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }

  function pasangCss() {
    var s = document.createElement('style');
    s.textContent =
      '#pwaBar{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:60;' +
      'max-width:456px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px 10px 10px 12px;border-radius:18px;color:#fff;' +
      "font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;" +
      'background:linear-gradient(180deg,rgba(255,255,255,.28) 0%,rgba(255,255,255,.04) 50%,rgba(255,255,255,0) 50%),linear-gradient(160deg,#FF7DB0,#E11D74 60%,#B3145F);' +
      'box-shadow:0 16px 30px -12px rgba(190,24,93,.7),inset 0 -3px 6px rgba(120,10,60,.3);animation:pwaUp .35s ease-out both}' +
      '#pwaBar[hidden]{display:none}' +
      '#pwaBar .pwa-ic{width:40px;height:40px;border-radius:11px;background:#fff;flex-shrink:0;object-fit:cover}' +
      '#pwaBar .pwa-tx{flex:1;min-width:0;line-height:1.3}' +
      '#pwaBar .pwa-tx b{display:block;font-size:14px;font-weight:800}' +
      '#pwaBar .pwa-tx span{display:block;font-size:11.5px;color:rgba(255,255,255,.94)}' +
      '#pwaBar .pwa-tx svg{width:1.2em;height:1.2em;vertical-align:-.25em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
      '#pwaBar .pwa-go{flex-shrink:0;border:0;border-radius:99px;padding:9px 16px;background:#fff;color:#9D174D;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}' +
      '#pwaBar .pwa-go[hidden]{display:none}' +
      '#pwaBar .pwa-go:active{transform:scale(.96)}' +
      '#pwaBar .pwa-x{flex-shrink:0;width:30px;height:30px;border:0;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;font-size:14px;line-height:1;cursor:pointer}' +
      'html.pwa-bar-on #loginScreen{padding-bottom:calc(88px + env(safe-area-inset-bottom,0px))}' +
      '@keyframes pwaUp{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){#pwaBar{animation:none}}';
    document.head.appendChild(s);
  }

  var SHARE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';

  function bangun() {
    if (bar) return;
    pasangCss();
    bar = document.createElement('div');
    bar.id = 'pwaBar';
    bar.hidden = true;
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Pasang aplikasi');
    bar.innerHTML =
      '<img class="pwa-ic" src="icon-192.png" alt="" width="40" height="40">' +
      '<div class="pwa-tx"><b>Pasang ePRESENSI</b><span id="pwaSub"></span></div>' +
      '<button type="button" class="pwa-go" id="pwaGo">Pasang</button>' +
      '<button type="button" class="pwa-x" id="pwaX" aria-label="Tutup">&#10005;</button>';
    document.body.appendChild(bar);

    document.getElementById('pwaX').addEventListener('click', function () {
      catatTutup(); sinkron();
    });
    document.getElementById('pwaGo').addEventListener('click', function () {
      if (!deferred) return;
      var d = deferred;
      deferred = null;
      try {
        d.prompt();
        d.userChoice.then(function () { catatTutup(); sinkron(); }).catch(function () { sinkron(); });
      } catch (e) { sinkron(); }
    });
  }

  function isiTeks() {
    var sub = document.getElementById('pwaSub');
    var go = document.getElementById('pwaGo');
    if (!sub || !go) return;
    if (mode === 'ios') {
      go.hidden = true;
      sub.innerHTML = 'Ketuk ' + SHARE_SVG + ' <b style="display:inline;font-size:inherit">Bagikan</b>, lalu pilih <b style="display:inline;font-size:inherit">Tambah ke Layar Utama</b>';
    } else {
      go.hidden = false;
      sub.textContent = 'Buka cepat dari layar utama, seperti aplikasi biasa.';
    }
  }

  function sinkron() {
    var ada = (mode === 'ios') || (mode === 'android' && !!deferred);
    var ls = document.getElementById('loginScreen');
    var diLogin = !!ls && !ls.classList.contains('hide');
    var tampil = ada && !ditutup() && (!HANYA_DI_LOGIN || diLogin);
    if (tampil) { bangun(); isiTeks(); }
    if (bar) bar.hidden = !tampil;
    document.documentElement.classList.toggle('pwa-bar-on', !!tampil);
  }

  // Android / Chrome: tahan prompt bawaan, tampilkan bar kita sendiri
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    mode = 'android';
    sinkron();
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    catatTutup();
    sinkron();
  });

  function mulai() {
    var ls = document.getElementById('loginScreen');
    if (ls && window.MutationObserver) {
      new MutationObserver(sinkron).observe(ls, { attributes: true, attributeFilter: ['class'] });
    }
    setTimeout(sinkron, 500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();
})();
