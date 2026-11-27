// ══ SERVICE WORKER · Kindle Learning Tool (faktaftbahasa) ══
// Tujuan: app boleh dipasang (download) di phone, dan masih boleh dibuka bila internet putus.
//   1) Halaman app (index.html): ambil dari internet DAHULU, jadi versi terbaru selepas Deploy terus dipakai.
//      Salinan simpanan hanya dipakai bila tiada internet, atau bila internet terlalu perlahan (lebih TUNGGU_MS).
//   2) Fail kecil dalam repo ini (manifest, ikon): guna salinan simpanan, dan kemas kini di belakang.
//   3) Skrip Firebase dari gstatic (versi tetap): simpan sekali, kemudian guna salinan itu.
//   4) Firestore, Auth dan semua alamat luar lain TIDAK disentuh. Semuanya terus ke internet seperti biasa.
// Naikkan VERSI hanya bila fail ini diubah. Simpanan lama app ini dipadam sendiri.
var APP = 'faktaftbahasa';
var VERSI = APP + '-v1';
var TUNGGU_MS = 5000;
var ASAS = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png'];
var SDK = [
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
];
var TAJUK_APP = 'Kindle Learning Tool';
var SKOP = new URL(self.registration.scope).pathname;
var UTAMA = new URL('./', self.registration.scope).href;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) {
    var kerja = ASAS.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
    });
    SDK.forEach(function (u) {
      kerja.push(fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) {
        if (r.status === 200) return c.put(u, r);
      }).catch(function () {}));
    });
    return Promise.all(kerja);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (nama) {
    return Promise.all(nama.filter(function (n) {
      return n.indexOf(APP + '-') === 0 && n !== VERSI; // padam simpanan lama app ini sahaja (app lain di domain yang sama tidak disentuh)
    }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(SKOP) !== 0) return; // fail di luar app ini
    if (req.mode === 'navigate') e.respondWith(halaman(req, e));
    else e.respondWith(fail(req, e));
    return;
  }
  if (SDK.indexOf(url.origin + url.pathname) >= 0) e.respondWith(sdk(req));
});

function kunciHalaman(u) {
  var x = new URL(u);
  return x.origin + x.pathname.replace(/index\.html$/, '');
}

function simpanan(kunci) {
  return caches.open(VERSI).then(function (c) {
    return c.match(kunci, { ignoreSearch: true }).then(function (r) { return r || c.match(UTAMA, { ignoreSearch: true }); });
  }).catch(function () { return null; });
}

// Halaman: internet dahulu (tanpa salinan lama pelayar), salinan simpanan bila tiada internet atau terlalu perlahan
function halaman(req, e) {
  var kunci = kunciHalaman(req.url);
  var jaringan = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) {
    if (r.redirected) return fetch(req);
    if (r.status === 200) {
      var salin = r.clone();
      caches.open(VERSI).then(function (c) { return c.put(kunci, salin); }).catch(function () {});
    }
    return r;
  });
  e.waitUntil(jaringan.catch(function () {}));
  return new Promise(function (lulus) {
    var habis = false;
    function beri(r) { if (!habis && r) { habis = true; lulus(r); } }
    var jam = setTimeout(function () { simpanan(kunci).then(beri); }, TUNGGU_MS);
    jaringan.then(function (r) { clearTimeout(jam); beri(r); }, function () {
      clearTimeout(jam);
      simpanan(kunci).then(function (r) { beri(r || luarTalian()); });
    });
  });
}

// Fail kecil dalam repo: salinan simpanan dahulu, kemas kini di belakang
function fail(req, e) {
  return caches.open(VERSI).then(function (c) {
    return c.match(req).then(function (ada) {
      var baru = fetch(req).then(function (r) {
        if (r.status === 200 && r.type === 'basic') c.put(req, r.clone()).catch(function () {});
        return r;
      });
      if (ada) { e.waitUntil(baru.catch(function () {})); return ada; }
      return baru;
    });
  });
}

// Skrip Firebase (versi tetap): salinan simpanan dahulu
function sdk(req) {
  return caches.open(VERSI).then(function (c) {
    return c.match(req.url, { ignoreVary: true }).then(function (ada) {
      if (ada) return ada;
      return fetch(req).then(function (r) {
        if (r.status === 200 || r.type === 'opaque') c.put(req.url, r.clone()).catch(function () {});
        return r;
      });
    });
  });
}

function luarTalian() {
  var html = '<!DOCTYPE html><html lang="ms"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + TAJUK_APP + '</title></head>' +
    '<body style="margin:0;padding:24px;font-family:Georgia,serif;background:#fff;color:#000;text-align:center;">' +
    '<h1 style="font-size:1.2rem;">' + TAJUK_APP + '</h1>' +
    '<p style="line-height:1.6;">Tiada sambungan internet. App ini belum pernah dibuka semasa ada internet pada peranti ini, jadi belum ada salinan untuk dipaparkan.</p>' +
    '<p style="line-height:1.6;">Sambungkan internet, kemudian tekan butang di bawah.</p>' +
    '<button onclick="location.reload()" style="padding:12px 20px;font-size:1rem;font-weight:bold;border:2px solid #000;border-radius:8px;background:#000;color:#fff;">CUBA LAGI</button>' +
    '</body></html>';
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
