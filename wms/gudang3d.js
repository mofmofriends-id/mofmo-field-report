/* Warehouse condition 3D (20 Okt 2026).
 *
 * Mockup "Warehouse Condition 3D" disetujui Ferdy ("good, gas bangun"), lalu diminta lima tambahan
 * sekaligus: cari SKU yang menyala, panah isi ulang, mode panas (kecepatan laku), slider tanggal
 * (4D), dan cetak kartu dari panel.
 *
 * Denah dari Ferdy: bentuk U yang rapat. Kiri rak besi R1-R3 (4 level), depan (dinding jauh) tumpukan
 * krat S1 di atas palet, kanan meja T1-T2 (L0 di kolong meja, L1-L7 ditumpuk di atas meja). Staging
 * menempel di belakang R3, karton overflow di belakang T2. Letak ini ada di LAYOUT di bawah: rak baru
 * atau rak pindah cukup diubah di situ.
 *
 * Data: potret wmsGudang (sama dengan Warehouse racks lama, isi per lokasi) dan dataPapan (buku besar
 * Mutasi, untuk laku 30 hari dan stok HO per tanggal). Kode lokasi ditulis gaya Jubelio
 * (L{level}-{rak}-{posisi}); Location Master boleh masih kode lama atau sudah kode Jubelio.
 *
 * Gambar 3D murni CSS (transform 3D), tanpa pustaka. Tiap sisi tegak dibangun dari tepi bawahnya
 * (rotateX(-90deg) lalu rotateZ ke arah sisinya), jadi muka luarnya selalu menghadap keluar dan
 * angkanya tidak terbaca terbalik dari sudut mana pun.
 */
(function () {
  'use strict';
  var W = window;

  var TEKS = {
    en: {
      cari: 'Find SKU or location', cariPh: 'Scan or type: barcode, name, L4-R1-A', semuaZona: 'All zones',
      putar: 'Turn', miring: 'Tilt', perkecil: 'Zoom out', perbesar: 'Zoom in', reset: 'Reset view',
      modeIsi: 'Fill', modePanas: 'Sales heat', panah: 'Refill arrows',
      hariIni: 'Today', perkiraan: function (t) { return t + ' · estimated from the Mutasi ledger'; },
      tanggal: 'Date',
      kosong: 'Empty', rendah: 'Under 50%', ok: 'OK', penuh: 'Full', lebih: 'Over capacity', karton: 'Overflow carton', staging: 'Not put away',
      tanpaLaku: 'No sales in 30 days', lambat: 'Slow', cepat: 'Fast', angkaKotak: 'Number on each box = pcs now',
      kartuJudul: 'DISPLAY CARD ON THIS SLOT · 10.5 × 7 CM', cetak: 'Print this card', cetakN: function (n) { return 'Print ' + n + (n === 1 ? ' card' : ' cards'); },
      cetakKet: 'Prints the locations lit on the map: search results, the chosen zone, or all. 8 cards per A4, print at 100%.',
      dari: function (k) { return k ? 'pcs left of ' + k + ' max' : 'pcs, no max qty'; },
      ruang: 'Space left', ruangTanpa: 'No max qty', diGudang: 'This SKU in the warehouse',
      lokasiN: function (n) { return n + (n === 1 ? ' location' : ' locations'); },
      laku: 'Sold, last 30 days', bertahan: 'Lasts at this pace', cukup: function (h) { return h >= 999 ? 'no sales yet' : 'about ' + h + (h === 1 ? ' day' : ' days'); },
      semuaLokasi: 'ALL LOCATIONS OF THIS SKU', lokasiUnit: function (u) { return u === 'X' ? 'OVERFLOW AREA' : 'OTHER LOCATIONS IN ' + u; },
      isiUlang: 'REFILL SUGGESTIONS', isiUlangDari: function (a, b, n) { return 'Refill ' + a + ' from ' + b + ' (' + n + ' pcs there)'; },
      tanpaIsiUlang: 'No pick face needs a refill from the warehouse right now.',
      pilihJudul: 'Tap a box to see the location',
      pilihKet: 'Each box is one location from the Location Master, stacked by level. Drag the floor, or use Turn and Tilt, to look around.',
      ketemu: function (n) { return n + (n === 1 ? ' location found' : ' locations found'); }, takKetemu: 'Nothing found',
      diLuar: function (n) { return n === 1 ? '1 location is not on the 3D map yet: add its unit to LAYOUT in gudang3d.js.' : n + ' locations are not on the 3D map yet: add their units to LAYOUT in gudang3d.js.'; },
      labelUnit: { R1: 'R1 · Key charms', R2: 'R2 · Key rings', R3: 'R3 · Caps', S1: 'S1 · M plush', T1: 'T1 · Balls · bags', T2: 'T2 · S plush', IN: 'IN · staging', X: 'Overflow cartons' }
    },
    id: {
      cari: 'Cari SKU atau lokasi', cariPh: 'Scan atau ketik: barcode, nama, L4-R1-A', semuaZona: 'Semua zona',
      putar: 'Putar', miring: 'Miring', perkecil: 'Perkecil', perbesar: 'Perbesar', reset: 'Atur ulang',
      modeIsi: 'Isi', modePanas: 'Panas laku', panah: 'Panah isi ulang',
      hariIni: 'Hari ini', perkiraan: function (t) { return t + ' · perkiraan dari buku besar Mutasi'; },
      tanggal: 'Tanggal',
      kosong: 'Kosong', rendah: 'Di bawah 50%', ok: 'OK', penuh: 'Penuh', lebih: 'Melebihi kapasitas', karton: 'Karton overflow', staging: 'Belum di-putaway',
      tanpaLaku: 'Tidak laku 30 hari', lambat: 'Lambat', cepat: 'Cepat', angkaKotak: 'Angka di tiap kotak = pcs sekarang',
      kartuJudul: 'KARTU PERAGA DI SLOT INI · 10,5 × 7 CM', cetak: 'Cetak kartu ini', cetakN: function (n) { return 'Cetak ' + n + ' kartu'; },
      cetakKet: 'Mencetak lokasi yang menyala di peta: hasil cari, zona yang dipilih, atau semua. 8 kartu per A4, cetak skala 100%.',
      dari: function (k) { return k ? 'pcs tersisa dari maks. ' + k : 'pcs, tanpa maks. qty'; },
      ruang: 'Sisa ruang', ruangTanpa: 'Tanpa maks. qty', diGudang: 'SKU ini di gudang',
      lokasiN: function (n) { return n + ' lokasi'; },
      laku: 'Laku 30 hari terakhir', bertahan: 'Cukup untuk', cukup: function (h) { return h >= 999 ? 'belum ada penjualan' : 'sekitar ' + h + ' hari'; },
      semuaLokasi: 'SEMUA LOKASI SKU INI', lokasiUnit: function (u) { return u === 'X' ? 'AREA OVERFLOW' : 'LOKASI LAIN DI ' + u; },
      isiUlang: 'SARAN ISI ULANG', isiUlangDari: function (a, b, n) { return 'Isi ' + a + ' dari ' + b + ' (ada ' + n + ' pcs)'; },
      tanpaIsiUlang: 'Belum ada pick face yang perlu diisi ulang dari gudang.',
      pilihJudul: 'Ketuk kotak untuk melihat lokasinya',
      pilihKet: 'Tiap kotak adalah satu lokasi dari Location Master, ditumpuk per level. Geser lantainya, atau pakai Putar dan Miring, untuk melihat sekeliling.',
      ketemu: function (n) { return n + ' lokasi ketemu'; }, takKetemu: 'Tidak ketemu',
      diLuar: function (n) { return n + ' lokasi belum ada di peta 3D: tambahkan unitnya ke LAYOUT di gudang3d.js.'; },
      labelUnit: { R1: 'R1 · Key charm', R2: 'R2 · Key ring', R3: 'R3 · Topi', S1: 'S1 · Plush M', T1: 'T1 · Bola · tas', T2: 'T2 · Plush S', IN: 'IN · staging', X: 'Karton overflow' }
    }
  };

  /* Denah U. muka = sisi yang menghadap lorong: 0 +y, 1 -y, 2 +x, 3 -x. */
  var LAYOUT = {
    unit: {
      R1: { jenis: 'rak', sumbu: 'y', x: 120, y: 60, muka: 2, putar: 35 },
      R2: { jenis: 'rak', sumbu: 'y', x: 120, y: 184, muka: 2, putar: 35 },
      R3: { jenis: 'rak', sumbu: 'y', x: 120, y: 308, muka: 2, putar: 35 },
      S1: { jenis: 'tumpuk', sumbu: 'x', x: 183, y: 4, muka: 0, putar: 0 },
      T1: { jenis: 'meja', sumbu: 'y', x: 316, y: 60, muka: 3, putar: -35 },
      T2: { jenis: 'meja', sumbu: 'y', x: 316, y: 244, muka: 3, putar: -35 }
    },
    staging: { x: 120, y: 428, w: 96, d: 96, muka: 2, putar: 35 },
    overflow: { x: 320, y: 384, kolom: 3, langkah: 50, ukuran: 46, muka: 3, putar: -35 },
    label: { R1: [0, 110, 114], R2: [0, 234, 114], R3: [0, 358, 114], S1: [183, 58, 0], T1: [368, 140, 0], T2: [368, 296, 0], IN: [120, 532, 0], X: [320, 534, 0] },
    lorong: [172, 56, 138, 368],
    lantai: { w: 500, h: 560 }
  };
  var AWAL = { rot: 24, tilt: 56, zoom: 1.1 };
  var WARNA_ZONA = { RACK: '#1F5FA8', STACK: '#C0661B', TABLE: '#2E7D4F', OVERFLOW: '#B03A2E', STAGING: '#B03A2E' };
  var WARNA = { kosong: '#E9DCCB', rendah: '#F6A26B', ok: '#9BD3B6', penuh: '#4FA57E', lebih: '#E07A8B', karton: '#D9BB94', staging: '#F4B4A2', redup: '#EDE4D8' };
  var URUT_KURAS = { PICK: 0, OVERFLOW: 1, STAGING: 2, RESERVE: 3 };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function nf(n, b) { return Math.round(Number(n || 0)).toLocaleString(b === 'id' ? 'id-ID' : 'en-US'); }
  function gelap(hex, f) {
    var n = parseInt(String(hex).slice(1), 16);
    return 'rgb(' + Math.round(((n >> 16) & 255) * f) + ',' + Math.round(((n >> 8) & 255) * f) + ',' + Math.round((n & 255) * f) + ')';
  }
  function campur(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), f = function (s) { return Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t); };
    return '#' + ((1 << 24) + (f(16) << 16) + (f(8) << 8) + f(0)).toString(16).slice(1);
  }
  function geserTgl(tgl, n) { var d = new Date(String(tgl).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  var BLN = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] };
  function tglTeks(s, b) { var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + ' ' + BLN[b][Number(m[2]) - 1] + ' ' + m[1] : s; }

  /* kode lokasi gaya Jubelio; sama dengan WmsAlat.kodeJubelio, disalin supaya modul ini berdiri sendiri */
  function kodeJubelio(kode) {
    var A = W.WmsAlat; if (A && A.kodeBaku) return A.kodeBaku(kode);
    var k = String(kode || '').toUpperCase().trim();
    if (k === 'X-IN') return 'L1-IN-1-01';
    var x = k.match(/^X-(\d+)$/); if (x) return 'L1-OF-1-' + ('0' + Number(x[1])).slice(-2);
    var l = k.match(/^L1-([A-Z]\d+)-(\d+)-([A-Z]\d?)$/); if (l) return 'L' + l[2] + '-' + l[1] + '-' + l[3];
    var m = k.match(/^([A-Z]\d+)-(\d+)([A-Z])(?:-(\d+))?$/);
    return m ? 'L' + m[2] + '-' + m[1] + '-' + m[3] + (m[4] || '') : k;
  }

  /* ---------- data ---------- */
  function siapkan(G, X) {
    var prodBc = {};
    ((X && X.prod) || []).forEach(function (p) { if (p && p.b) prodBc[String(p.b)] = p; });
    var lok = [], diLuar = 0, nOf = 0, POS = { A: 0, B: 1, C: 2, D: 3 };
    ((G && G.lokasi) || []).forEach(function (r) {
      if (!r) return;
      var kode = kodeJubelio(r.kode), m = kode.match(/^L(\d+)-([A-Z]+\d+)-([A-Z])(\d)?$/);
      var l = {
        asli: String(r.kode || ''), kode: kode, zona: String(r.zona || '').toUpperCase(), peran: String(r.peran || '').toUpperCase(),
        unit: String(r.unit || (m ? m[2] : '')).toUpperCase(), level: r.level !== '' && r.level != null ? Number(r.level) : (m ? Number(m[1]) : null),
        pos: String(r.pos || (m ? m[3] : '')).toUpperCase(), comp: m && m[4] ? m[4] : ((String(r.kode || '').match(/-(\d)$/) || [])[1] || ''),
        sku: String(r.sku || ''), bc: String(r.barcode || ''), isiAsli: Number(r.isi) || 0, kap: Number(r.kap) || 0
      };
      l.prod = prodBc[l.bc] || null;
      var t = LAYOUT.unit[l.unit], sisip = 3;
      if (t && l.level != null && POS[l.pos] != null) {
        l.muka = t.muka; l.putar = t.putar; l.jenis = 'krat';
        if (t.sumbu === 'y') {
          l.x = t.x; l.w = 46; l.y = t.y + POS[l.pos] * 60; l.d = 56;
          if (l.comp) { l.w = 22; l.x = t.x + (l.comp === '2' ? 24 : 0); }
        } else {
          l.x = t.x + POS[l.pos] * 60; l.w = 56; l.y = t.y; l.d = 46;
          if (l.comp) { l.d = 22; l.y = t.y + (l.comp === '2' ? 24 : 0); }
        }
        if (t.jenis === 'rak') { l.h = 30; l.z = (l.level - 1) * 40 + 3; }
        else if (t.jenis === 'tumpuk') { l.h = 31; l.z = 8 + (l.level - 1) * 33; sisip = 2; }
        else if (l.level === 0) { l.h = 24; l.z = 0; sisip = 5; }
        else { l.h = 26; l.z = 34 + (l.level - 1) * 28; }
      } else if (l.peran === 'STAGING') {
        var s = LAYOUT.staging;
        l.x = s.x; l.y = s.y; l.w = s.w; l.d = s.d; l.h = 40; l.z = 10; sisip = 5; l.jenis = 'kardus'; l.muka = s.muka; l.putar = s.putar; l.unit = 'IN';
      } else if (l.zona === 'OVERFLOW' || l.peran === 'OVERFLOW' || l.unit === 'X') {
        var o = LAYOUT.overflow, i = nOf++;
        l.x = o.x + (i % o.kolom) * o.langkah; l.y = o.y + Math.floor(i / o.kolom) * o.langkah; l.w = o.ukuran; l.d = o.ukuran; l.h = 34; l.z = 0; sisip = 1; l.jenis = 'kardus'; l.muka = o.muka; l.putar = o.putar; l.unit = 'X';
      } else { diLuar++; return; }
      l.x += sisip; l.y += sisip; l.w -= 2 * sisip; l.d -= 2 * sisip;
      lok.push(l);
    });
    return { lok: lok, diLuar: diLuar, prodBc: prodBc, buku: siapBuku(X) };
  }
  /* buku besar: laku 30 hari per barcode dan perubahan stok HO per tanggal per barcode */
  function siapBuku(X) {
    if (!X || !Array.isArray(X.baris)) return null;
    var L = X.lok || [], P = X.prod || [], iHO = -1, iJual = -1;
    L.forEach(function (l, i) { if (l && l.k === 'HO') iHO = i; if (l && l.k === 'TERJUAL') iJual = i; });
    var hari = String(X.hariIni || new Date().toISOString()).slice(0, 10), batas = geserTgl(hari, -30);
    var laku = {}, ubah = {};
    X.baris.forEach(function (b) {
      var tg = String(b[0] || '').slice(0, 10), p = P[b[1]], q = Number(b[2]) || 0, bc = p && p.b ? String(p.b) : '';
      if (!bc || !q || tg > hari) return;
      if (b[4] === iJual && tg > batas) laku[bc] = (laku[bc] || 0) + q;
      var d = (b[4] === iHO ? q : 0) - (b[3] === iHO ? q : 0);
      if (d) { var u = ubah[tg] = ubah[tg] || {}; u[bc] = (u[bc] || 0) + d; }
    });
    return { hari: hari, laku: laku, ubah: ubah };
  }
  /* Isi tiap lokasi pada tanggal mundur k hari. Location Master hanya menyimpan petak hari ini, jadi
     ini perkiraan dengan aturan Location Master sendiri (lkgDasar_): stok HO yang lebih sedikit
     dikuras dari pick face dulu, lalu overflow, staging, cadangan paling akhir; yang lebih banyak
     berdiri di staging (belum di-putaway). */
  function isiPada(S, k) {
    var isi = {}; S.lok.forEach(function (l) { isi[l.kode] = l.isiAsli; });
    if (!k || !S.buku) return isi;
    var batas = geserTgl(S.buku.hari, -k), beda = {};
    Object.keys(S.buku.ubah).forEach(function (tg) { if (tg > batas) { var u = S.buku.ubah[tg]; Object.keys(u).forEach(function (bc) { beda[bc] = (beda[bc] || 0) - u[bc]; }); } });
    var staging = null; S.lok.forEach(function (l) { if (l.peran === 'STAGING' && !staging) staging = l; });
    Object.keys(beda).forEach(function (bc) {
      var d = beda[bc]; if (!d) return;
      if (d > 0) { if (staging) isi[staging.kode] += d; return; }
      var kuras = -d;
      S.lok.filter(function (l) { return l.bc === bc; }).sort(function (a, b) { return (URUT_KURAS[a.peran] == null ? 9 : URUT_KURAS[a.peran]) - (URUT_KURAS[b.peran] == null ? 9 : URUT_KURAS[b.peran]); })
        .forEach(function (l) { var a = Math.min(isi[l.kode], kuras); isi[l.kode] -= a; kuras -= a; });
    });
    return isi;
  }
  function status(l, q) {
    if (l.peran === 'STAGING') return 'staging';
    if (!q) return 'kosong';
    if (l.jenis === 'kardus' || !(l.kap > 0)) return 'karton';
    var p = q / l.kap;
    if (p > 1.0001) return 'lebih';
    if (p >= 0.9999) return 'penuh';
    if (p < 0.5) return 'rendah';
    return 'ok';
  }
  /* pick face di bawah 50% diisi dari cadangan atau karton overflow ber-SKU sama yang paling banyak isinya */
  function saranIsiUlang(S, isi) {
    var out = [];
    S.lok.forEach(function (l) {
      if (l.peran !== 'PICK' || !(l.kap > 0) || !l.bc || isi[l.kode] / l.kap >= 0.5) return;
      var sumber = null;
      S.lok.forEach(function (s) { if (s !== l && s.bc === l.bc && (s.peran === 'RESERVE' || s.peran === 'OVERFLOW') && isi[s.kode] > 0 && (!sumber || isi[s.kode] > isi[sumber.kode])) sumber = s; });
      if (sumber) out.push({ ke: l, dari: sumber, n: isi[sumber.kode] });
    });
    return out;
  }
  function cocok(l, q, nama) {
    q = String(q || '').trim().toLowerCase(); if (!q) return false;
    var digit = q.replace(/\s+/g, '');
    if (/^\d{4,}$/.test(digit)) return !!l.bc && l.bc.slice(-digit.length) === digit;
    var teks = [l.kode, l.asli, l.sku, nama.listing, nama.pendek, l.prod && l.prod.n, l.prod && l.prod.s].join(' ').toLowerCase();
    return teks.indexOf(q) > -1 || kodeJubelio(q) === l.kode;
  }

  /* ---------- bantuan dari alat.js (nama Shopee, barcode, cetak kartu, foto) ---------- */
  function namaShopee(l) {
    var A = W.WmsAlat, nm = (l.prod && l.prod.n) || l.sku;
    return A && A.namaShopee ? A.namaShopee(l.bc, nm) : { listing: '', pendek: nm };
  }
  function fotoUrl(l) {
    var K = W.KulitPapan; if (!K || !K.fotoSku) return '';
    var f = K.fotoSku((l.prod && l.prod.n) || '') || K.fotoSku(l.sku || ''); if (!f) return '';
    if (W.__IMG && W.__IMG['sku/' + f + '.webp']) return W.__IMG['sku/' + f + '.webp'];
    return (K.dasar || 'img/') + 'sku/' + f + '.webp';
  }
  function svgBarcode(teks, ean, tinggi, lebar) {
    var A = W.WmsAlat; if (!A) return '';
    var s = ean && A.barcodeSku ? A.barcodeSku(teks, 'g3-bc') : (A.kode128 ? A.kode128(teks) : '');
    return s.replace('<svg ', '<svg style="display:block;width:' + lebar + ';height:' + tinggi + 'px;margin:0 auto" ');
  }

  /* ---------- gambar ---------- */
  var SISI = function (w, d, h) {
    return [[0, d - h, w, 0, 0.9], [0, -h, w, 180, 0.74], [w - d / 2, d / 2 - h, d, -90, 0.84], [-d / 2, d / 2 - h, d, 90, 0.8]].map(function (q) {
      return { gaya: 'left:' + q[0] + 'px;top:' + q[1] + 'px;width:' + q[2] + 'px;height:' + h + 'px;transform-origin:50% 100%;transform:rotateZ(' + q[3] + 'deg) rotateX(-90deg);', f: q[4], lebar: q[2] };
    });
  };
  var TEPI = 'position:absolute;box-sizing:border-box;';
  function balok(x, y, z, w, d, h, warna, tambah) {
    var t = TEPI + 'border:1px solid rgba(60,45,35,.22);';
    return '<div style="position:absolute;transform-style:preserve-3d;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + d + 'px;transform:translateZ(' + z + 'px)">' +
      '<div style="' + t + 'left:0;top:0;width:100%;height:100%;background:' + warna + ';transform:translateZ(' + h + 'px);' + (tambah || '') + '"></div>' +
      SISI(w, d, h).map(function (m) { return '<div style="' + t + m.gaya + 'background:' + gelap(warna, m.f) + '"></div>'; }).join('') + '</div>';
  }
  function struktur() {
    var h = [], BESI = '#9A948D', PAPAN = '#CFC8C0', KAYU = '#C9A27A', MEJA = '#DCC3A1', bay = [];
    Object.keys(LAYOUT.unit).forEach(function (u) {
      var t = LAYOUT.unit[u], n = u.charAt(0) === 'T' ? (u === 'T1' ? 3 : 2) : 2;
      if (t.jenis === 'rak') {
        var x = t.x - 2, y = t.y - 2, w = 50, d = n * 60;
        [[x, y], [x + w - 4, y], [x, y + d - 4], [x + w - 4, y + d - 4]].forEach(function (p) { h.push(balok(p[0], p[1], 0, 4, 4, 166, BESI)); });
        for (var lv = 0; lv < 5; lv++) h.push(balok(x, y, lv * 40, w, d, 3, PAPAN));
        bay.push([x - 2, y + 4, w + 10, d + 6]);
      } else if (t.jenis === 'tumpuk') {
        h.push(balok(t.x - 2, t.y - 2, 0, n * 60, 50, 8, KAYU)); bay.push([t.x - 2, t.y + 2, n * 60 + 8, 54]);
      } else {
        var mx = t.x - 2, my = t.y - 2, mw = 50, md = n * 60;
        [[mx, my], [mx + mw - 4, my], [mx, my + md - 4], [mx + mw - 4, my + md - 4]].forEach(function (p) { h.push(balok(p[0], p[1], 0, 4, 4, 30, BESI)); });
        h.push(balok(mx, my, 30, mw, md, 4, MEJA)); bay.push([mx - 2, my + 4, mw + 10, md + 6]);
      }
    });
    var s = LAYOUT.staging;
    h.push(balok(s.x - 2, s.y - 2, 0, s.w + 4, s.d + 4, 10, KAYU, 'background-image:repeating-linear-gradient(90deg,rgba(0,0,0,0) 0 14px,rgba(90,60,30,.25) 14px 18px);'));
    bay.push([s.x - 2, s.y + 2, s.w + 12, s.d + 8]);
    var lr = LAYOUT.lorong;
    return '<div style="position:absolute;left:' + lr[0] + 'px;top:' + lr[1] + 'px;width:' + lr[2] + 'px;height:' + lr[3] + 'px;box-sizing:border-box;border:3px dashed #E2B851;border-radius:6px"></div>' +
      bay.map(function (b) { return '<div style="position:absolute;left:' + b[0] + 'px;top:' + b[1] + 'px;width:' + b[2] + 'px;height:' + b[3] + 'px;border-radius:8px;background:rgba(74,52,38,.16);filter:blur(5px)"></div>'; }).join('') + h.join('');
  }

  function Tampilan(akar, opsi) {
    this.akar = akar; this.doc = akar.ownerDocument; this.b = opsi.bahasa === 'id' ? 'id' : 'en'; this.T = TEKS[this.b];
    this.S = siapkan(opsi.gudang, opsi.data);
    this.st = { rot: AWAL.rot, tilt: AWAL.tilt, zoom: AWAL.zoom, zona: 'ALL', pilih: '', cari: '', mode: 'isi', mundur: 0, panah: true };
    this.strukturHtml = struktur();
    pasangGaya(this.doc);
    this.gambarSemua();
    this.pasangAcara();
  }
  Tampilan.prototype.isi = function () { if (this._isiK !== this.st.mundur) { this._isi = isiPada(this.S, this.st.mundur); this._isiK = this.st.mundur; } return this._isi; };
  Tampilan.prototype.lantaiGaya = function () {
    var s = this.st, L = LAYOUT.lantai;
    return 'position:absolute;left:50%;top:50%;width:' + L.w + 'px;height:' + L.h + 'px;margin-left:-' + L.w / 2 + 'px;margin-top:-' + (L.h / 2 - 30) + 'px;border-radius:18px;background-color:#EFE3D2;background-image:linear-gradient(rgba(255,255,255,.55) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.55) 1px,transparent 1px);background-size:40px 40px;border:2px solid #E2CDB2;box-sizing:border-box;transform-style:preserve-3d;transform-origin:50% 50%;transition:transform .35s ease;transform:rotateX(' + s.tilt + 'deg) rotateZ(' + s.rot + 'deg) scale(' + s.zoom + ')';
  };
  Tampilan.prototype.warnaLaku = function (bc) {
    var B = this.S.buku; if (!B || !bc) return '#C9D6E3';
    var maks = 0; Object.keys(B.laku).forEach(function (k) { if (B.laku[k] > maks) maks = B.laku[k]; });
    var n = B.laku[bc] || 0;
    if (!n || !maks) return '#C9D6E3';
    return campur('#FBE3C8', '#D9472F', Math.sqrt(n / maks));
  };
  Tampilan.prototype.gambarSemua = function () {
    var T = this.T, s = this.st, b = this.b;
    var tombol = function (atr, on, teks, warna) {
      return '<button type="button" ' + atr + ' aria-pressed="' + (on ? 'true' : 'false') + '" style="min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid ' + (on ? (warna || '#4A3426') : '#EFE1CF') + ';background:' + (on ? (warna || '#4A3426') : '#FFFFFF') + ';color:' + (on ? '#FFFFFF' : '#4A3426') + ';font:800 14px Nunito,Arial,sans-serif;cursor:pointer">' + esc(teks) + '</button>';
    };
    var zona = [['ALL', T.semuaZona], ['RACK', 'Rack'], ['STACK', 'Stack'], ['TABLE', 'Table'], ['OVERFLOW', 'Overflow']].map(function (z) { return tombol('data-g3-zona="' + z[0] + '"', s.zona === z[0], z[1], WARNA_ZONA[z[0]]); }).join('');
    var mode = tombol('data-g3-mode="isi"', s.mode === 'isi', T.modeIsi) + tombol('data-g3-mode="panas"', s.mode === 'panas', T.modePanas);
    var maxMundur = this.S.buku ? 30 : 0;
    var tglLabel = this.labelTanggal();
    var tb = 'width:44px;height:44px;border-radius:14px;border:1.5px solid #EFE1CF;background:#FCF1E4;color:#4A3426;font:800 22px Nunito,Arial,sans-serif;cursor:pointer';
    this.akar.innerHTML =
      '<div class="g3" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;color:#4A3426;font-family:Nunito,Arial,sans-serif">' +
      '<div style="flex:999 1 560px;min-width:0;background:#FFFFFF;border:1.5px solid #EFE1CF;border-radius:22px;overflow:hidden;display:flex;flex-direction:column">' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:14px 16px;border-bottom:1.5px solid #EFE1CF">' +
          '<label style="flex:1 1 260px;display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:800;color:#7E6656">' + esc(T.cari) +
            '<input type="search" data-g3-cari value="' + esc(s.cari) + '" placeholder="' + esc(T.cariPh) + '" autocomplete="off" spellcheck="false" style="height:44px;padding:0 14px;border-radius:14px;border:1.5px solid #EFE1CF;background:#FCF1E4;font:700 16px Nunito,Arial,sans-serif;color:#4A3426"></label>' +
          '<span data-g3-hasilcari style="font-size:13px;font-weight:800;color:#A9501C;min-width:120px"></span>' +
          (W.WmsAlat && W.WmsAlat.cetakKode ? '<button type="button" data-g3-cetaksemua title="' + esc(T.cetakKet) + '" style="min-height:44px;padding:0 16px;border-radius:14px;border:1.5px solid #F6A26B;background:#FFFFFF;color:#4A3426;font:800 14px Nunito,Arial,sans-serif;cursor:pointer"></button>' : '') +
          '<div role="group" aria-label="Zone" style="display:flex;flex-wrap:wrap;gap:6px;flex-basis:100%">' + zona + '</div>' +
          '<div role="group" aria-label="Color" style="display:flex;gap:6px">' + mode + '</div>' +
          '<label style="display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;font-weight:800;color:#7E6656;cursor:pointer"><input type="checkbox" data-g3-panahon ' + (s.panah ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:#F6A26B">' + esc(T.panah) + '</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin-left:auto">' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#7E6656">' + esc(T.putar) + '<input type="range" data-g3-rot min="-180" max="180" step="1" value="' + s.rot + '" style="width:110px;accent-color:#F6A26B"></label>' +
            '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#7E6656">' + esc(T.miring) + '<input type="range" data-g3-tilt min="30" max="75" step="1" value="' + s.tilt + '" style="width:90px;accent-color:#F6A26B"></label>' +
            '<button type="button" data-g3-zoom="-1" aria-label="' + esc(T.perkecil) + '" style="' + tb + '">−</button><button type="button" data-g3-zoom="1" aria-label="' + esc(T.perbesar) + '" style="' + tb + '">+</button>' +
            '<button type="button" data-g3-reset style="min-height:44px;padding:0 14px;border-radius:14px;border:1.5px solid #EFE1CF;background:#FFFFFF;color:#4A3426;font:800 14px Nunito,Arial,sans-serif;cursor:pointer">' + esc(T.reset) + '</button>' +
          '</div>' +
        '</div>' +
        '<div data-g3-panggung style="position:relative;height:clamp(380px,62vh,600px);overflow:hidden;perspective:2400px;background:#FFF8EF;touch-action:none;cursor:grab"><div data-g3-lantai style="' + this.lantaiGaya() + '"></div></div>' +
        (maxMundur ? '<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:12px 16px;border-top:1.5px solid #EFE1CF"><label style="flex:1 1 260px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:800;color:#7E6656">' + esc(T.tanggal) +
          '<input type="range" data-g3-tgl min="0" max="' + maxMundur + '" step="1" value="' + (maxMundur - s.mundur) + '" style="flex:1;accent-color:#F6A26B"></label><b data-g3-tgllabel style="font-size:14px">' + esc(tglLabel) + '</b></div>' : '') +
        '<div data-g3-legenda style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:12px 16px;border-top:1.5px solid #EFE1CF;font-size:13px;font-weight:800;color:#7E6656"></div>' +
        (this.S.diLuar ? '<p style="margin:0;padding:0 16px 12px;font-size:13px;font-weight:700;color:#A2404F">' + esc(T.diLuar(this.S.diLuar)) + '</p>' : '') +
      '</div>' +
      '<aside data-g3-panel style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:12px"></aside></div>';
    this.lantai = this.akar.querySelector('[data-g3-lantai]');
    this.gambarAdegan(); this.gambarPanel(); this.gambarLegenda();
  };
  Tampilan.prototype.labelTanggal = function () {
    if (!this.S.buku || !this.st.mundur) return this.T.hariIni;
    return this.T.perkiraan(tglTeks(geserTgl(this.S.buku.hari, -this.st.mundur), this.b));
  };
  Tampilan.prototype.gambarLegenda = function () {
    var T = this.T, kotak = function (w, t) { return '<span style="display:flex;align-items:center;gap:6px"><i style="width:14px;height:14px;border-radius:4px;background:' + w + '"></i>' + esc(t) + '</span>'; };
    var h = this.st.mode === 'panas'
      ? kotak('#C9D6E3', T.tanpaLaku) + kotak('#FBE3C8', T.lambat) + kotak(campur('#FBE3C8', '#D9472F', 0.5), '') + kotak('#D9472F', T.cepat)
      : kotak(WARNA.kosong, T.kosong) + kotak(WARNA.rendah, T.rendah) + kotak(WARNA.ok, T.ok) + kotak(WARNA.penuh, T.penuh) + kotak(WARNA.lebih, T.lebih) + kotak(WARNA.karton, T.karton) + kotak(WARNA.staging, T.staging);
    this.akar.querySelector('[data-g3-legenda]').innerHTML = h + '<span style="margin-left:auto">' + esc(T.angkaKotak) + '</span>';
  };
  Tampilan.prototype.gambarAdegan = function () {
    var self = this, s = this.st, isi = this.isi(), T = this.T, b = this.b;
    var nama = {}; this.S.lok.forEach(function (l) { nama[l.kode] = namaShopee(l); });
    var cari = String(s.cari || '').trim(), kena = {}, nKena = 0;
    if (cari) this.S.lok.forEach(function (l) { if (cocok(l, cari, nama[l.kode])) { kena[l.kode] = 1; nKena++; } });
    this._kena = kena;
    var terlihat = this._terlihat = [];
    var hc = this.akar.querySelector('[data-g3-hasilcari]'); if (hc) hc.textContent = cari ? (nKena ? T.ketemu(nKena) : T.takKetemu) : '';
    var label = Object.keys(LAYOUT.label).map(function (u) {
      var p = LAYOUT.label[u];
      return '<div style="position:absolute;left:' + p[0] + 'px;top:' + p[1] + 'px;' + (p[2] ? 'width:' + p[2] + 'px;text-align:right;' : '') + 'font:800 13px/1 Nunito,Arial,sans-serif;color:#7E6656;white-space:nowrap">' + esc(T.labelUnit[u] || u) + '</div>';
    }).join('');
    var krat = this.S.lok.map(function (l) {
      var q = isi[l.kode], st = status(l, q), mati = (s.zona !== 'ALL' && l.zona !== s.zona) || (cari && !kena[l.kode]);
      if (!mati) terlihat.push(l.kode);
      var c = mati ? WARNA.redup : (s.mode === 'panas' ? (l.peran === 'STAGING' ? WARNA.staging : self.warnaLaku(l.bc)) : WARNA[st]);
      var dipilih = s.pilih === l.kode, nyala = cari && kena[l.kode];
      var tepi = TEPI + 'border:' + (dipilih ? '2px solid #3A2A1E' : (nyala ? '2px solid #A9501C' : '1px solid rgba(60,45,35,' + (mati ? '.12' : '.3') + ')')) + ';';
      var atasPola = l.jenis === 'kardus' ? 'background-image:linear-gradient(90deg,rgba(0,0,0,0) 0 42%,rgba(255,255,255,.55) 42% 58%,rgba(0,0,0,0) 58%);' : 'box-shadow:inset 0 0 0 3px rgba(255,255,255,.35),inset 0 0 0 5px rgba(60,45,35,.18);';
      var foto = !mati && l.bc ? fotoUrl(l) : '';
      var sisi = SISI(l.w, l.d, l.h).map(function (m, ke) {
        var kecil = m.lebar < 24, lab = ke === l.muka && !kecil;
        var stiker = (mati ? 'opacity:0;' : '') + 'background:#FFFFFF;color:#3A2A1E;border-radius:3px;white-space:pre-line;text-align:center;font:800 ' + (kecil ? 9 : (lab ? 7.5 : 11)) + 'px/1.15 Nunito,Arial,sans-serif;padding:' + (kecil ? '1px' : (lab ? '1px 2px 1px 3px' : '1px 4px')) + ';' + (lab ? 'border-left:3px solid ' + (WARNA_ZONA[l.zona] || '#4A3426') + ';' : '');
        return '<div data-g3-kode="' + esc(l.kode) + '"' + (lab ? ' data-g3-label' : '') + ' style="' + tepi + m.gaya + 'background:' + gelap(c, m.f) + ';cursor:pointer;display:flex;align-items:center;justify-content:center;gap:1px">' +
          (lab && foto ? '<img src="' + esc(foto) + '" alt="" style="height:18px;width:18px;object-fit:contain;background:#FFFFFF;border-radius:3px;flex:none" draggable="false">' : '') +
          '<span style="' + stiker + '">' + esc(lab ? l.kode + '\n' + nf(q, b) : nf(q, b)) + '</span></div>';
      }).join('');
      return '<div data-g3-krat="' + esc(l.kode) + '" data-g3-st="' + st + '"' + (nyala ? ' data-g3-nyala' : '') + ' style="position:absolute;transform-style:preserve-3d;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;height:' + l.d + 'px;transform:translateZ(' + (l.z + (nyala ? 6 : 0)) + 'px)">' +
        '<div data-g3-kode="' + esc(l.kode) + '" style="' + tepi + 'left:0;top:0;width:100%;height:100%;background-color:' + c + ';transform:translateZ(' + l.h + 'px);cursor:pointer;' + atasPola + '"></div>' + sisi + '</div>';
    }).join('');
    var panah = s.panah ? saranIsiUlang(this.S, isi).map(function (r) {
      var x1 = r.dari.x + r.dari.w / 2, y1 = r.dari.y + r.dari.d / 2, x2 = r.ke.x + r.ke.w / 2, y2 = r.ke.y + r.ke.d / 2;
      var pj = Math.max(1, Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)) - 8), sudut = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      return '<div data-g3-panah="' + esc(r.dari.kode + '>' + r.ke.kode) + '" style="position:absolute;left:' + x1 + 'px;top:' + (y1 - 2) + 'px;width:' + pj + 'px;height:4px;border-radius:2px;background:#A9501C;transform-origin:0 50%;transform:translateZ(2px) rotate(' + sudut.toFixed(1) + 'deg)">' +
        '<i style="position:absolute;right:-9px;top:-5px;width:0;height:0;border-left:11px solid #A9501C;border-top:7px solid transparent;border-bottom:7px solid transparent"></i></div>';
    }).join('') : '';
    this.lantai.innerHTML = this.strukturHtml + label + panah + krat;
    var cb = this.akar.querySelector('[data-g3-cetaksemua]');
    if (cb) { cb.textContent = T.cetakN(terlihat.length); cb.disabled = !terlihat.length; cb.style.opacity = terlihat.length ? '' : '.45'; cb.style.cursor = terlihat.length ? 'pointer' : 'default'; }
  };
  Tampilan.prototype.cariLokasi = function (kode) { for (var i = 0; i < this.S.lok.length; i++) if (this.S.lok[i].kode === kode) return this.S.lok[i]; return null; };
  Tampilan.prototype.gambarPanel = function () {
    var self = this, T = this.T, b = this.b, isi = this.isi(), panel = this.akar.querySelector('[data-g3-panel]');
    var l = this.cariLokasi(this.st.pilih);
    var kartuPutih = 'background:#FFFFFF;border:1.5px solid #EFE1CF;border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:12px';
    var baris = function (x, on) {
      return '<button type="button" data-g3-pilih="' + esc(x.kode) + '" style="display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:8px;align-items:center;min-height:44px;padding:0 12px;border-radius:12px;border:1.5px solid ' + (on ? '#4A3426' : '#EFE1CF') + ';background:' + (on ? '#FFE3CC' : '#FCF1E4') + ';color:#4A3426;font:700 14px Nunito,Arial,sans-serif;text-align:left;cursor:pointer"><b>' + esc(x.kode) + '</b><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(namaShopee(x).pendek || x.sku || T.staging) + '</span><span>' + nf(isi[x.kode], b) + (x.kap ? ' / ' + nf(x.kap, b) : '') + '</span></button>';
    };
    var saran = saranIsiUlang(this.S, isi);
    if (!l) {
      panel.innerHTML = '<div style="' + kartuPutih + '"><b style="font:800 22px/1.1 \'Baloo 2\',Arial,sans-serif">' + esc(T.pilihJudul) + '</b><span style="font-size:14px;font-weight:700;color:#7E6656">' + esc(T.pilihKet) + '</span>' +
        '<span style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#7E6656;margin-top:4px">' + esc(T.isiUlang) + '</span>' +
        (saran.length ? saran.map(function (r) { return '<button type="button" data-g3-pilih="' + esc(r.ke.kode) + '" data-g3-saran style="min-height:44px;padding:8px 12px;border-radius:12px;border:1.5px solid #EFE1CF;background:#FCF1E4;color:#4A3426;font:700 14px Nunito,Arial,sans-serif;text-align:left;cursor:pointer">' + esc(T.isiUlangDari(r.ke.kode, r.dari.kode, nf(r.n, b))) + '</button>'; }).join('') : '<span style="font-size:14px;font-weight:700;color:#7E6656">' + esc(T.tanpaIsiUlang) + '</span>') + '</div>';
      return;
    }
    var q = isi[l.kode], st = status(l, q), nm = namaShopee(l), warnaZona = WARNA_ZONA[l.zona] || '#4A3426', foto = fotoUrl(l);
    var sama = l.bc ? this.S.lok.filter(function (x) { return x.bc === l.bc; }) : [];
    var total = sama.reduce(function (n, x) { return n + (isi[x.kode] || 0); }, 0);
    var lain = (sama.length > 1 ? sama : this.S.lok.filter(function (x) { return x.unit === l.unit; })).slice().sort(function (a, c) { return (isi[c.kode] || 0) - (isi[a.kode] || 0) || (a.kode < c.kode ? -1 : 1); });
    var laku = this.S.buku && l.bc ? (this.S.buku.laku[l.bc] || 0) : null;
    var hari = laku ? Math.round(total / (laku / 30)) : 999;
    var persen = l.kap ? Math.min(100, Math.round(q / l.kap * 100)) : 100;
    var meta = [l.prod && l.prod.s ? '<b style="color:#2A2118">' + esc(l.prod.s) + '</b>' : esc(l.sku), l.kap ? esc((b === 'id' ? 'maks. ' : 'max ') + nf(l.kap, b) + ' pcs') : ''].filter(Boolean).join(' · ');
    var ean = W.WmsAlat && W.WmsAlat.barcodeSku && l.bc;
    var kartu = '<div data-g3-kartu style="position:relative;box-sizing:border-box;width:100%;max-width:360px;aspect-ratio:105/70;background:#FFFFFF;color:#1B1410;border:1px solid #DDD3C8;border-radius:8px;overflow:hidden;padding:9px 12px 8px 20px;display:grid;grid-template-rows:auto minmax(0,1fr) auto;row-gap:6px;box-shadow:0 6px 18px rgba(140,96,60,.16)">' +
      '<span style="position:absolute;left:0;top:0;bottom:0;width:7px;background:' + warnaZona + '"></span>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px"><b data-g3-kartukode style="font:800 30px/.9 \'Baloo 2\',Arial,sans-serif">' + esc(l.kode) + '</b><span style="color:#FFFFFF;background:' + warnaZona + ';font:800 13px/1 \'Baloo 2\',Arial,sans-serif;letter-spacing:.06em;padding:5px 8px 3px;border-radius:5px;white-space:nowrap">' + esc(l.zona || 'STAGING') + '</span></div>' +
      '<div style="display:grid;grid-template-columns:38% minmax(0,1fr);gap:9px;align-items:center;min-height:0">' +
        (foto ? '<img src="' + esc(foto) + '" alt="" style="width:100%;aspect-ratio:1;object-fit:contain;border-radius:8px;background:#F7F1EA;padding:3px;box-sizing:border-box">' : '<div style="width:100%;aspect-ratio:1;border-radius:8px;background:#F7F1EA;display:flex;align-items:center;justify-content:center;font:800 24px \'Baloo 2\',Arial,sans-serif;color:#7E6656">IN</div>') +
        '<div style="min-width:0;display:flex;flex-direction:column;gap:2px"><span data-g3-kartulisting style="font-size:9px;font-weight:700;color:#5A4A3D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(nm.listing) + '</span>' +
        '<b data-g3-kartunama style="font:800 17px/1.05 \'Baloo 2\',Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(nm.pendek || T.staging) + '</b><span style="font-size:10px;font-weight:700;color:#7A6A5D">' + meta + '</span>' +
        (ean ? svgBarcode(l.bc, true, 32, '100%') + '<span style="font-size:9px;letter-spacing:.16em;color:#8A7B6E;text-align:center">' + esc(l.bc) + '</span>' : '') + '</div></div>' +
      '<div style="border-top:1px solid #ECE4DA;padding-top:5px">' + svgBarcode(l.kode, false, 22, '78%') + '</div></div>';
    var kotakAngka = function (j, a) { return '<div style="background:#FCF1E4;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column;gap:2px"><span style="font-size:12px;font-weight:800;color:#7E6656">' + esc(j) + '</span><b style="font:800 18px/1.15 \'Baloo 2\',Arial,sans-serif">' + esc(a) + '</b></div>'; };
    var isiUlang = saran.filter(function (r) { return r.ke === l; })[0];
    panel.innerHTML = '<div style="' + kartuPutih + '">' +
      '<span style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#7E6656">' + esc(T.kartuJudul) + '</span>' + kartu +
      (W.WmsAlat && W.WmsAlat.cetakKode ? '<button type="button" data-g3-cetak="' + esc(l.kode) + '" style="align-self:flex-start;min-height:44px;padding:0 16px;border-radius:14px;border:0;background:#F6A26B;color:#4A3426;font:800 15px Nunito,Arial,sans-serif;cursor:pointer">' + esc(T.cetak) + '</button>' : '') +
      '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><b data-g3-isi style="font:800 44px/1 \'Baloo 2\',Arial,sans-serif">' + nf(q, b) + '</b><span style="font-size:15px;font-weight:800;color:#7E6656">' + esc(T.dari(l.kap ? nf(l.kap, b) : 0)) + '</span>' +
        '<span data-g3-status="' + st + '" style="margin-left:auto;padding:5px 10px;border-radius:999px;font:800 13px/1 Nunito,Arial,sans-serif;background:' + WARNA[st] + ';color:#3A2A1E">' + esc(T[st]) + '</span></div>' +
      '<div style="height:12px;border-radius:999px;background:#EFE1CF;overflow:hidden"><div style="height:100%;width:' + persen + '%;border-radius:999px;background:' + WARNA[st] + '"></div></div>' +
      (isiUlang ? '<div data-g3-isiulang style="padding:10px 12px;border-radius:14px;background:#FFE3CC;color:#A9501C;font-size:14px;font-weight:800">' + esc(T.isiUlangDari(l.kode, isiUlang.dari.kode, nf(isiUlang.n, b))) + '</div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">' +
        kotakAngka(T.ruang, l.kap ? nf(Math.max(0, l.kap - q), b) + ' pcs' : T.ruangTanpa) +
        kotakAngka(T.diGudang, l.bc ? nf(total, b) + ' pcs · ' + T.lokasiN(sama.length) : nf(q, b) + ' pcs') +
        (laku != null ? kotakAngka(T.laku, nf(laku, b) + ' pcs') + kotakAngka(T.bertahan, T.cukup(hari)) : '') +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#7E6656">' + esc(sama.length > 1 ? T.semuaLokasi : T.lokasiUnit(l.unit)) + '</span>' +
        lain.map(function (x) { return baris(x, x.kode === l.kode); }).join('') + '</div></div>';
    /* nama Shopee panjang dikecilkan sampai muat, seperti kartu cetak, bukan dipotong titik-titik */
    var win = this.doc.defaultView;
    Array.prototype.forEach.call(panel.querySelectorAll('[data-g3-kartunama],[data-g3-kartulisting]'), function (e) {
      var f = parseFloat(win.getComputedStyle(e).fontSize) || 12, min = e.hasAttribute('data-g3-kartunama') ? 10 : 6, n = 0;
      while (e.scrollWidth > e.clientWidth + 1 && f > min && n++ < 40) { f -= 0.5; e.style.fontSize = f + 'px'; }
    });
  };
  Tampilan.prototype.aturKamera = function () {
    this.lantai.style.transform = 'rotateX(' + this.st.tilt + 'deg) rotateZ(' + this.st.rot + 'deg) scale(' + this.st.zoom + ')';
    var r = this.akar.querySelector('[data-g3-rot]'), t = this.akar.querySelector('[data-g3-tilt]');
    if (r) r.value = this.st.rot; if (t) t.value = this.st.tilt;
  };
  Tampilan.prototype.pilih = function (kode, putar) {
    this.st.pilih = kode;
    var l = this.cariLokasi(kode);
    if (l && putar) { this.st.rot = l.putar; this.aturKamera(); }
    this.gambarAdegan(); this.gambarPanel();
  };
  Tampilan.prototype.pasangAcara = function () {
    var self = this, akar = this.akar;
    akar.addEventListener('click', function (e) {
      var x = e.target.closest ? e.target.closest('[data-g3-kode],[data-g3-pilih],[data-g3-zona],[data-g3-mode],[data-g3-zoom],[data-g3-reset],[data-g3-cetak],[data-g3-cetaksemua]') : null;
      if (!x || self._seret) return;
      if (x.hasAttribute('data-g3-kode')) self.pilih(x.getAttribute('data-g3-kode'), false);
      else if (x.hasAttribute('data-g3-pilih')) self.pilih(x.getAttribute('data-g3-pilih'), true);
      else if (x.hasAttribute('data-g3-zona')) { self.st.zona = x.getAttribute('data-g3-zona'); self.gambarSemua(); }
      else if (x.hasAttribute('data-g3-mode')) { self.st.mode = x.getAttribute('data-g3-mode'); self.gambarSemua(); }
      else if (x.hasAttribute('data-g3-zoom')) { self.st.zoom = Math.max(0.6, Math.min(1.8, Math.round((self.st.zoom + 0.1 * Number(x.getAttribute('data-g3-zoom'))) * 10) / 10)); self.aturKamera(); }
      else if (x.hasAttribute('data-g3-reset')) { self.st.rot = AWAL.rot; self.st.tilt = AWAL.tilt; self.st.zoom = AWAL.zoom; self.st.zona = 'ALL'; self.st.cari = ''; self.gambarSemua(); }
      else if (x.hasAttribute('data-g3-cetak') && W.WmsAlat && W.WmsAlat.cetakKode) W.WmsAlat.cetakKode([x.getAttribute('data-g3-cetak')]);
      else if (x.hasAttribute('data-g3-cetaksemua') && !x.disabled && W.WmsAlat && W.WmsAlat.cetakKode && (self._terlihat || []).length) W.WmsAlat.cetakKode(self._terlihat.slice());
    });
    akar.addEventListener('input', function (e) {
      var x = e.target;
      if (x.hasAttribute('data-g3-rot')) { self.st.rot = Number(x.value); self.aturKamera(); }
      else if (x.hasAttribute('data-g3-tilt')) { self.st.tilt = Number(x.value); self.aturKamera(); }
      else if (x.hasAttribute('data-g3-tgl')) {
        self.st.mundur = Number(x.max) - Number(x.value);
        var lb = akar.querySelector('[data-g3-tgllabel]'); if (lb) lb.textContent = self.labelTanggal();
        self.gambarAdegan(); self.gambarPanel();
      } else if (x.hasAttribute('data-g3-cari')) { self.st.cari = x.value; self.gambarAdegan(); }
    });
    akar.addEventListener('change', function (e) { if (e.target.hasAttribute('data-g3-panahon')) { self.st.panah = e.target.checked; self.gambarAdegan(); } });
    /* Enter di kolom cari (scanner gun mengirim Enter): pilih lokasi pertama yang cocok dan putar kamera ke arahnya */
    akar.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.hasAttribute('data-g3-cari')) return;
      e.preventDefault();
      if (Object.keys(self._kena || {}).length) {
        var isi = self.isi(), urut = self.S.lok.filter(function (l) { return self._kena[l.kode]; }).sort(function (a, b) { return (b.peran === 'PICK') - (a.peran === 'PICK') || (isi[b.kode] || 0) - (isi[a.kode] || 0); });
        self.pilih(urut[0].kode, true);
      }
    });
    /* seret lantai untuk memutar dan memiringkan */
    var pg = akar.querySelector('[data-g3-panggung]'); if (!pg) return;
    var awal = null;
    akar.addEventListener('pointerdown', function (e) {
      var p = akar.querySelector('[data-g3-panggung]'); if (!p || !p.contains(e.target)) return;
      awal = { x: e.clientX, y: e.clientY, rot: self.st.rot, tilt: self.st.tilt, gerak: false };
    });
    var doc = this.doc;
    /* satu pasang pendengar per dokumen; halaman yang digambar ulang memasang Tampilan baru */
    doc.__g3 = function () { return { awal: awal, self: self, lepas: function () { awal = null; } }; };
    if (doc.__g3Pasang) return; doc.__g3Pasang = true;
    doc.addEventListener('pointermove', function (e) {
      var a = doc.__g3 && doc.__g3(); if (!a || !a.awal) return;
      var awal = a.awal, self = a.self;
      var dx = e.clientX - awal.x, dy = e.clientY - awal.y;
      if (!awal.gerak && Math.abs(dx) + Math.abs(dy) < 6) return;
      awal.gerak = true; self._seret = true;
      self.st.rot = Math.max(-180, Math.min(180, Math.round(awal.rot + dx * 0.4)));
      self.st.tilt = Math.max(30, Math.min(75, Math.round(awal.tilt - dy * 0.2)));
      self.lantai.style.transition = 'none'; self.aturKamera();
    });
    doc.addEventListener('pointerup', function () {
      var a = doc.__g3 && doc.__g3(); if (!a || !a.awal) return; a.lepas(); var self = a.self;
      if (self.lantai) self.lantai.style.transition = 'transform .35s ease';
      setTimeout(function () { self._seret = false; }, 0);
    });
  };

  function pasangGaya(doc) {
    if (doc.getElementById('g3Gaya')) return;
    var g = doc.createElement('style'); g.id = 'g3Gaya';
    g.textContent = '@keyframes g3denyut{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}' +
      '.g3 [data-g3-nyala]>div{animation:g3denyut 1.1s ease-in-out infinite}' +
      '@media (prefers-reduced-motion:reduce){.g3 [data-g3-nyala]>div{animation:none}.g3 [data-g3-lantai]{transition:none!important}}' +
      '.g3 button:focus-visible,.g3 input:focus-visible{outline:3px solid #F6A26B;outline-offset:2px}';
    doc.head.appendChild(g);
  }

  W.WmsGudang3D = {
    pasang: function (akar, opsi) { if (!akar) return null; var t = new Tampilan(akar, opsi || {}); akar.__g3 = t; return t; },
    LAYOUT: LAYOUT,
    _siapkan: siapkan, _isiPada: isiPada, _saranIsiUlang: saranIsiUlang, _kodeJubelio: kodeJubelio, _status: status
  };
})();
