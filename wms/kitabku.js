/* Kitabku di WMS (10 Okt 2026): event dan hadiah, cetak kartu QR paket Shopee, klaim struk gerai.
 *
 * Ferdy: "admin di WMS (menu baru Kitabku) ... boleh, gaskan", lalu "gas bgs
 * bangett, sekalian sama kitab dan web kitab". Server: Edge Function "kitab"
 * (aksi admin). Pintunya tiket WMS yang sama dengan Edge Function "wms";
 * tanpa tiket sah server menjawab perluMasuk. Kode voucher dibuat manual di
 * Shopee Seller Centre, sistem cuma menyimpan kode, nominal, dan kuota.
 */
(function () {
  /* ---------- QR (mode byte, koreksi M, versi 1 sampai 10) ----------
     Ditulis sendiri supaya WMS tidak memuat pustaka dari luar. Algoritma
     mengikuti ISO/IEC 18004 seperti penjelasan Project Nayuki. Diuji dengan
     dekoder sungguhan (uji/uji-kitabku-qr.js, zxing-cpp). */
  var QR_ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], QR_BLOK = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  function qrMentah(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; } return r; }
  function qrDataKata(v) { return Math.floor(qrMentah(v) / 8) - QR_ECC[v - 1] * QR_BLOK[v - 1]; }
  function gfKali(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsPembagi(d) { var r = []; for (var i = 0; i < d - 1; i++) r.push(0); r.push(1); var akar = 1; for (i = 0; i < d; i++) { for (var j = 0; j < r.length; j++) { r[j] = gfKali(r[j], akar); if (j + 1 < r.length) r[j] ^= r[j + 1]; } akar = gfKali(akar, 2); } return r; }
  function rsSisa(data, pb) { var r = pb.map(function () { return 0; }); data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); pb.forEach(function (k, i) { r[i] ^= gfKali(k, f); }); }); return r; }
  function utf8(s) { var b = []; var e = unescape(encodeURIComponent(s)); for (var i = 0; i < e.length; i++) b.push(e.charCodeAt(i)); return b; }
  function qrMatriks(teks) {
    var bytes = utf8(String(teks)), v = 0;
    for (var c = 1; c <= 10; c++) { if (4 + (c < 10 ? 8 : 16) + 8 * bytes.length <= qrDataKata(c) * 8) { v = c; break; } }
    if (!v) throw new Error('QR terlalu panjang');
    var bit = [], taruh = function (n, len) { for (var i = len - 1; i >= 0; i--) bit.push((n >>> i) & 1); };
    taruh(4, 4); taruh(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { taruh(b, 8); });
    var kap = qrDataKata(v) * 8;
    taruh(0, Math.min(4, kap - bit.length)); taruh(0, (8 - bit.length % 8) % 8);
    for (var pad = 0xEC; bit.length < kap; pad ^= 0xEC ^ 0x11) taruh(pad, 8);
    var data = []; for (var i = 0; i < bit.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bit[i + j]; data.push(x); }
    /* blok + koreksi, lalu dianyam */
    var nb = QR_BLOK[v - 1], ecc = QR_ECC[v - 1], mentah = Math.floor(qrMentah(v) / 8), nPendek = nb - mentah % nb, pjPendek = Math.floor(mentah / nb);
    var pb = rsPembagi(ecc), blok = [], k = 0;
    for (i = 0; i < nb; i++) { var dat = data.slice(k, k + pjPendek - ecc + (i < nPendek ? 0 : 1)); k += dat.length; var e = rsSisa(dat, pb); if (i < nPendek) dat.push(0); blok.push(dat.concat(e)); }
    var kata = [];
    for (i = 0; i < blok[0].length; i++) for (j = 0; j < blok.length; j++) if (i !== pjPendek - ecc || j >= nPendek) kata.push(blok[j][i]);
    /* modul */
    var n = v * 4 + 17, M = [], F = [];
    for (i = 0; i < n; i++) { M.push([]); F.push([]); for (j = 0; j < n; j++) { M[i].push(false); F[i].push(false); } }
    var set = function (x, y, d) { M[y][x] = !!d; F[y][x] = true; };
    for (i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(function (p) { for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var xx = p[0] + dx, yy = p[1] + dy, d = Math.max(Math.abs(dx), Math.abs(dy)); if (xx >= 0 && xx < n && yy >= 0 && yy < n) set(xx, yy, d !== 2 && d !== 4); } });
    if (v > 1) {
      var na = Math.floor(v / 7) + 2, langkah = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for (var ps = v * 4 + 10; pos.length < na; ps -= langkah) pos.splice(1, 0, ps);
      for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++) set(pos[i] + ax, pos[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
      }
    }
    var format = function (mask) {
      var d = mask, r = d; for (var q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var b = ((d << 10) | r) ^ 0x5412, g = function (q) { return (b >>> q) & 1; };
      for (q = 0; q <= 5; q++) set(8, q, g(q));
      set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, g(q));
      for (q = 0; q < 8; q++) set(n - 1 - q, 8, g(q));
      for (q = 8; q < 15; q++) set(8, n - 15 + q, g(q));
      set(8, n - 8, true);
    };
    format(0);
    if (v >= 7) {
      var r = v; for (i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      var vb = (v << 12) | r;
      for (i = 0; i < 18; i++) { var bb = (vb >>> i) & 1, a = n - 11 + i % 3, b2 = Math.floor(i / 3); set(a, b2, bb); set(b2, a, bb); }
    }
    var ib = 0, nbit = kata.length * 8;
    for (var kanan = n - 1; kanan >= 1; kanan -= 2) {
      if (kanan === 6) kanan = 5;
      for (var t = 0; t < n; t++) for (j = 0; j < 2; j++) {
        var cx = kanan - j, naik = ((kanan + 1) & 2) === 0, cy = naik ? n - 1 - t : t;
        if (!F[cy][cx] && ib < nbit) { M[cy][cx] = ((kata[ib >>> 3] >>> (7 - (ib & 7))) & 1) === 1; ib++; }
      }
    }
    var topeng = function (m, x, y) { switch (m) { case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0; case 3: return (x + y) % 3 === 0; case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; case 5: return x * y % 2 + x * y % 3 === 0; case 6: return (x * y % 2 + x * y % 3) % 2 === 0; default: return ((x + y) % 2 + x * y % 3) % 2 === 0; } };
    var pakai = function (m) { for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (!F[y][x] && topeng(m, x, y)) M[y][x] = !M[y][x]; };
    var denda = function () {
      var p = 0, y, x, gelap = 0;
      var garis = function (get) {
        for (var a = 0; a < n; a++) {
          var run = 1, s = '';
          for (var b = 0; b < n; b++) { var cur = get(a, b); s += cur ? '1' : '0'; if (b > 0) { if (cur === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
          var re = /(?=(10111010000|00001011101))/g; while (re.exec(s)) { p += 40; re.lastIndex++; }
        }
      };
      garis(function (a, b) { return M[a][b]; }); garis(function (a, b) { return M[b][a]; });
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var cc = M[y][x]; if (cc === M[y][x + 1] && cc === M[y + 1][x] && cc === M[y + 1][x + 1]) p += 3; }
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (M[y][x]) gelap++;
      p += Math.floor(Math.abs(gelap * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    var terbaik = 0, dMin = Infinity;
    for (var m = 0; m < 8; m++) { pakai(m); format(m); var dd = denda(); if (dd < dMin) { dMin = dd; terbaik = m; } pakai(m); }
    pakai(terbaik); format(terbaik);
    return M.map(function (row) { return row.map(function (z) { return z ? 1 : 0; }); });
  }
  function qrSvg(teks, kelas) {
    var m = qrMatriks(teks), n = m.length, w = n + 8, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
    return '<svg' + (kelas ? ' class="' + kelas + '"' : '') + ' viewBox="0 0 ' + w + ' ' + w + '" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="' + w + '" height="' + w + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  /* ---------- katalog kartu: sama dengan KARTU di Edge Function kitab ---------- */
  var KARTU = [
    ['4582586962058', 0, 'Plush Bear', 'S'], ['4582586963260', 0, 'Plush Panda', 'S'], ['4582586963291', 0, 'Plush Panda', 'M'], ['4582586966605', 0, 'Plush Red Panda', 'S'], ['4582586966636', 0, 'Plush Red Panda', 'M'],
    ['4582586966629', 0, 'Plush Koala', 'S'], ['4582586966612', 0, 'Plush Elephant', 'S'], ['4582586966643', 0, 'Plush Elephant', 'M'], ['4582586964403', 0, 'Plush Reindeer', 'S'], ['4582586962737', 0, 'Plush Sea Otter', 'S'],
    ['4582586962126', 1, 'Plush Border Collie', 'S'], ['4582586962225', 1, 'Plush Angora Rabbit', 'S'], ['4582586962133', 1, 'Plush Lamb', 'S'], ['4582586950512', 1, 'Plush Yellow Shiba', 'S'], ['4582586950536', 1, 'Plush Yellow Shiba', 'M'], ['4582586964434', 1, 'Plush Pekingese', 'S'],
    ['4582586966988', 2, 'Key Charm', 'Dwarf Rabbit'], ['4582586967015', 2, 'Key Charm', 'Bear'], ['4582586966971', 2, 'Key Charm', 'Bichon Frize'], ['4582586966995', 2, 'Key Charm', 'British Shorthair'], ['4582586966544', 2, 'Key Charm', 'Shiba Inu'], ['4582586964311', 2, 'Key Charm', 'Lamb'], ['4582586964274', 2, 'Key Charm', 'Tiger'], ['4582586964298', 2, 'Key Charm', 'Cow'],
    ['4582586966780', 3, 'Key Ring', 'Dwarf Rabbit'], ['4582586966810', 3, 'Key Ring', 'Bear'], ['4582586966773', 3, 'Key Ring', 'Bichon Frize'], ['4582586966827', 3, 'Key Ring', 'Tiger'], ['4582586966797', 3, 'Key Ring', 'British Shorthair'],
    ['4582586965714', 4, 'Mascot Ball Key Chain', 'Yellow Tiger'], ['4582586965721', 4, 'Mascot Ball Key Chain', 'Border Collie'], ['4582586965738', 4, 'Mascot Ball Key Chain', 'Lamb'], ['4582586965707', 4, 'Mascot Ball Key Chain', 'Panda'],
    ['4589715755918', 5, 'Mini Rucksack (Key Charm)', 'Dwarf Rabbit'], ['4589715755925', 5, 'Mini Rucksack (Key Charm)', 'British Shorthair'], ['4582586968333', 5, 'Mini Backpack (Key Charm)', 'Ivory'], ['4582586968357', 5, 'Mini Backpack (Key Charm)', 'Green'], ['4582586968364', 5, 'Mini Backpack (Key Charm)', 'Blue'], ['4582586968340', 5, 'Mini Backpack (Key Charm)', 'Pink'],
    ['4582586961822', 6, 'Cap', 'Dwarf Rabbit'], ['4582586964014', 6, 'Cap', 'Watermelon'], ['4582586964021', 6, 'Cap', 'Banana'], ['4582586966360', 6, 'Cap', 'Tomato']
  ];
  var BAB = ['Forest Dwellers', 'Home Friends', 'Key Charm', 'Key Ring', 'Mascot Ball', 'Backpack', 'Cap'];
  var ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  var PER = {}; KARTU.forEach(function (k) { PER[k[0]] = k; });
  /* Foto kartu cetak (wms/img/kartu, potongan dari foto Shopee resolusi penuh), dicari dari letak kitabku.js
     supaya jalan di wms.mofmofriends.id maupun di halaman uji. */
  var FOTO_KARTU = { '4582586962058': 'bear', '4582586963260': 'panda', '4582586963291': 'panda', '4582586966605': 'redpanda', '4582586966636': 'redpanda', '4582586966629': 'koala',
    '4582586966612': 'elephant', '4582586966643': 'elephant', '4582586964403': 'reindeer', '4582586962737': 'otter', '4582586962126': 'collie', '4582586962225': 'angora',
    '4582586962133': 'lamb', '4582586950512': 'shiba', '4582586950536': 'shiba', '4582586964434': 'pekingese',
    '4582586966988': 'kc_rabbit', '4582586967015': 'kc_bear', '4582586966971': 'kc_bichon', '4582586966995': 'kc_bsh', '4582586966544': 'kc_shiba', '4582586964311': 'kc_lamb', '4582586964274': 'kc_tiger', '4582586964298': 'kc_cow',
    '4582586966780': 'kr_rabbit', '4582586966810': 'kr_bear', '4582586966773': 'kr_bichon', '4582586966827': 'kr_tiger', '4582586966797': 'kr_bsh',
    '4582586965714': 'mb_tiger', '4582586965721': 'mb_collie', '4582586965738': 'mb_lamb', '4582586965707': 'mb_panda',
    '4589715755918': 'rs_rabbit', '4589715755925': 'rs_bsh', '4582586968333': 'bp_ivory', '4582586968357': 'bp_green', '4582586968364': 'bp_blue', '4582586968340': 'bp_pink',
    '4582586961822': 'cap_rabbit', '4582586964014': 'cap_melon', '4582586964021': 'cap_banana', '4582586966360': 'cap_tomato' };
  var DASAR = (function () { try { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^\/]*$/, '') : ''; } catch (e) { return ''; } })();
  function namaKartu(bc) { var k = PER[bc]; if (!k) return bc; return k[2].replace(' (Key Charm)', '') + ' · ' + k[3]; }
  var KITAB = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/kitab';
  var SITUS = 'https://mofmofriends.id/#k=';
  /* usulan hadiah dari mockup (Ferdy: "gas keduanya"); dipasang NONAKTIF karena nominal belum ditentukan.
     Judul dikosongkan: web Kitab menulis judulnya sendiri dalam bahasa pembeli. */
  /* 18 Okt (Ferdy setuju mockup): tiga tingkat papan Total sekali klik, dipasang NONAKTIF. [id, dari, sampai, kuota] */
  var TINGKAT3 = [['juara1', 1, 1, 1], ['juara23', 2, 3, 2], ['juara410', 4, 10, 7]];
  var USULAN = [
    { id: 'patok3', judul: '', jenis: 'kartu', angka: 3, saluran: 'semua', hadiah: 'Gelar Penjelajah' },
    { id: 'patok5', judul: '', jenis: 'kartu', angka: 5, saluran: 'online', hadiah: 'Voucher Shopee' },
    { id: 'patok10', judul: '', jenis: 'kartu', angka: 10, saluran: 'online', hadiah: 'Voucher Shopee' },
    { id: 'patok43', judul: '', jenis: 'kartu', angka: 43, saluran: 'semua', hadiah: 'Kartu emas + Dinding Kolektor' },
    { id: 'bab1', judul: '', jenis: 'bab', angka: 0, saluran: 'online', hadiah: 'Potongan Cap' },
    { id: 'bab2', judul: '', jenis: 'bab', angka: 1, saluran: 'online', hadiah: 'Potongan Mini Backpack' },
    { id: 'bab3', judul: '', jenis: 'bab', angka: 2, saluran: 'online', hadiah: 'Potongan plush S' },
    { id: 'bab5', judul: '', jenis: 'bab', angka: 4, saluran: 'online', hadiah: 'Potongan Key Ring' },
    { id: 'bab7', judul: '', jenis: 'bab', angka: 6, saluran: 'online', hadiah: 'Potongan plush M' },
    /* 16 Okt malam, Ferdy: hadiah game cuma lewat papan Total (akumulatif), bukan bintang per game */
    { id: 'papanTotal', judul: '', jenis: 'papan', angka: 10, saluran: 'semua', hadiah: 'Voucher Shopee' },
    { id: 'edisi', judul: '', jenis: 'edisi', angka: 3, saluran: 'semua', hadiah: 'Hadiah edisi' }
  ];

  var TEKS = {
    en: {
      sp_judul: 'Ready for {cap}?', sp_sebelum: 'Starts {t}, {d} days to go. Parcel cards go out during the edition, up to {n} orders.', sp_hariIni: 'Starts today, {t}. Parcel cards go out during the edition, up to {n} orders.', sp_jalan: 'Running, ends {t}.', sp_skor: '{a} of {b} ready', sp_kaki: 'Checked again every time this tab opens. Nothing changes by itself; the buttons only take you to where it is fixed.',
      sp_tanggal: 'Edition dates', sp_tanggalKet: '{m} to {s} ({n} days).', sp_tanpaAcara: 'No active edition', sp_tanpaAcaraKet: 'Create the edition below first.',
      sp_tingkatOk: 'Leaderboard rewards split by rank', sp_tingkatOkKet: 'Leaderboard rewards start beyond rank 1.', sp_tingkatW: 'Leaderboard reward not split by rank', sp_tingkatWKet: 'Every winner still gets the same value.',
      sp_voucherOk: 'Voucher codes filled in', sp_voucherOkKet: 'Every reward with a value or switched on has a voucher code.', sp_voucherW: 'Voucher codes missing', sp_voucherWKet: '{n} reward(s) have a value or are on but no voucher code: {d}. Create them in Seller Centre, then paste the codes.',
      sp_nyalaOk: '{n} reward(s) switched on', sp_nyalaOkKet: 'Buyers see them in the REWARDS tab.', sp_nyalaW: 'No reward switched on', sp_nyalaWKet: '0 of {n} rewards ON. Buyers see nothing in the REWARDS tab yet.',
      sp_kuotaOk: 'Quotas match', sp_kuotaOkKet: 'Leaderboard quotas equal their number of ranks; other rewards with a value have a quota above 0.', sp_kuotaW: 'Quota does not match', sp_kuotaWKet: 'Check the quota of: {d}.',
      sp_berlakuOk: 'Vouchers valid long enough', sp_berlakuOkKet: 'Every voucher in use is valid until the edition ends or later.', sp_berlakuC: 'Voucher validity too short or empty', sp_berlakuCKet: '{d}. Set it to {s} or later so vouchers do not expire before winners use them.',
      sp_kartuOk: 'Parcel QR cards ready', sp_kartuW: 'Not enough parcel QR cards', sp_kartuKet: '{a} of {b} cards printed.',
      sp_ujiOk: 'Test data cleaned up', sp_ujiOkKet: 'No cards with a TES or UJI voucher left.', sp_ujiW: 'Test cards still there', sp_ujiWKet: '{n} card(s) with a TES or UJI voucher. Delete them after testing.',
      sp_keHadiah: 'Go to rewards', sp_cetak: 'Print cards', sp_tingkat: 'Add 3 tiers', sp_hapusUji: 'Delete test data',
      judul: 'Kitabku', judulH: 'Title', tabRingkas: 'Event & rewards', tabCetak: 'Print QR cards', tabStruk: 'Receipt claims', tabPasang: 'Link card', tabTemplate: 'Templates', tabJadwal: 'Game schedule', jd_tglJudul: 'Edition dates', jd_tglKet: 'Changes the running edition in place: leaderboards, edition cards, and the printed QR stay. For the next edition use New event in Event & rewards.', jd_simpanTgl: 'Save dates', jd_tglOk: 'Edition dates saved.', jd_judul: 'Match schedule', jd_ket: 'Games never open at the same time. Ranked play only during a match of that game (10 ranked games per match); outside matches it is practice. An empty schedule means all games are open for the whole edition.', jd_kosong: 'No matches yet. Use Auto-fill or Add match.', jd_oto: 'Auto-fill', jd_urut: 'Game order', jd_hari: 'Days per game', jd_n: 'Matches per game', jd_jam1: 'Opens', jd_jam2: 'Closes', jd_buat: 'Fill schedule', jd_tambah: 'Add match', jd_simpan: 'Save schedule', jd_belum: 'Not saved yet. Press Save schedule.', jd_ok: function (n) { return n + ' match(es) saved.'; }, jd_game: 'Game', jd_tgl: 'Date', jd_mulai: 'Opens', jd_selesai: 'Closes', jd_hapus: 'Remove', jd_lewat: 'done', jd_jalan: 'running', jd_malam: 'next day', jd_ringkas: function (g, n, a, b) { return g + ': ' + n + ' match, ' + a + ' to ' + b; }, jd_otoKurang: 'The edition is too short for that many days per game.', tutup: 'Close', tp_judul: 'Design templates', tp_ket: 'Saved in Google Drive, folder Arsip Template Mofmo Collection, one folder per event. Files stay private to the Drive owner.', tp_acara: 'Event', tp_berkas: 'Files (PNG, JPG, PDF, AI, PSD, SVG, ZIP; max 15 MB each)', tp_catatan: 'Note (optional)', tp_unggah: 'Upload', tp_kirim: 'Uploading…', tp_kosong: 'No templates archived yet.', tp_final: 'FINAL', tp_jadiFinal: 'Mark final', tp_batalFinal: 'Unmark final', tp_buka: 'Open in Drive', tp_besar: function (n) { return n + ' is larger than 15 MB. Shrink it first or save it straight to Drive.'; }, tp_tanpaAcara: 'Fill in the event name first.', tp_tanpaBerkas: 'Choose a file first.', tp_ok: function (n) { return n + ' file(s) uploaded.'; }, tp_gagal: function (n, p) { return n + ' failed: ' + p; },
      muat: 'Loading…', gagal: 'The Kitabku server could not be reached. Check the signal and try again.', ulang: 'Try again', sesiHabis: 'Your WMS session has ended. Sign in again.',
      kKartu: 'Cards unlocked', kPemain: 'Collectors', kStruk: 'Receipts waiting', kKlaim: 'Rewards claimed', kKode: 'Shopee cards printed', kDipakai: 'scanned',
      acara: 'Active event', tanpaAcara: 'No event yet. Create one before printing cards.', acaraBaru: 'New event', nama: 'Name', cap: 'Stamp', mulai: 'Start', selesai: 'End',
      simpanAcara: 'Start this event', ketAcara: 'Starting a new event ends the current one. Leaderboards restart, cards keep their old stamp.',
      hadiah: 'Rewards', ketHadiah: 'Rewards switched on appear in every buyer\'s book. Voucher codes are created by hand in Shopee Seller Centre; paste the code here.',
      jenis: 'Type', angka: 'Target', saluran: 'Counts', semua: 'All cards', online: 'Shopee cards only', isi: 'Reward', nominal: 'Value', minBelanja: 'Min. spend',
      voucher: 'Voucher code', kuota: 'Quota', terpakai: 'claimed', aktif: 'On', simpan: 'Save', tersimpan: 'Saved', usulan: 'Add the mockup rewards (switched off)',
      j_kartu: 'Cards collected', j_bab: 'Chapter complete', j_bintang: 'Game stars', j_edisi: 'Edition cards', j_papan: 'Total leaderboard', pemenang: 'Rank to', peringkatDari: 'Rank from', ketPapan: 'One reward = one rank tier, each with its own voucher. Example: #1 (1 to 1), #2-3 (2 to 3), #4-10 (4 to 10), up to rank 100. Buyers in this range on the Total leaderboard can claim it after the edition ends. Set the quota to the number of ranks in the range. The voucher can be filled in later.',
      hsJudul: 'Delete all edition cards (test mode)', hsKet: 'Deletes ALL QR cards printed for the active edition (parcel and per-product cards), including their order links, whatever the voucher code. Books holding only these cards are deleted too. Only possible before the edition starts. Order contents from the warehouse upload are not touched.',
      hsCek: 'Check', hsAngka: '{n} cards of edition {e} will be deleted: {p} linked to an order, {d} opened in Kitab.', hsKetik: 'Type HAPUS SEMUA to confirm', hsHapus: 'Permanently delete {n} cards',
      hsHasil: '{k} edition cards deleted, {b} books deleted too.', hsTutup: 'Edition {e} has started, so its cards belong to real buyers. Delete all only works before the edition starts.', hsKosong: 'No cards in the active edition.',
      huJudul: 'Delete test data', huKet: 'For cleaning up cards printed for testing. Only cards whose voucher code starts with TES or UJI can be deleted, so real customer cards stay safe.', huKode: 'Test card codes (scan or type, one per line)', huCek: 'Check',
      huDaftar: 'Will be deleted', huBelum: 'not linked', huBuka: 'opened by book {n}', huTutup: 'not opened', huVoucher: 'voucher {v}', huLewat_bukan: '{k} skipped: its voucher code is {v} (not a test card).', huLewat_tidak: '{k} skipped: unknown code.', huLewat_salah: '{k} skipped: not a card code.',
      huBuku: 'Books deleted too: {d}. The order links of these cards disappear with them.', huBukuTetap: 'Books kept: {d} (they have real cards, scores, claims or receipts).', huYakin: 'I understand this cannot be undone', huHapus: 'Permanently delete {n} test cards', huKosong: 'No test cards in this list.', huHasil: '{k} test cards deleted, {b} books deleted too.',
      tingkat3: 'Add 3 leaderboard tiers: #1, #2-3, #4-10', tingkat3Ket: 'Added switched off with quotas 1, 2 and 7. Fill in the value and voucher code, then switch them on. Existing leaderboard rewards are not changed.',
      kuotaCek: 'Quota is {k}, but this range has {n} ranks. Buyers past the quota will see "quota used up".',
      tumpang: 'Active Total leaderboard rewards overlap: {d}. A buyer in the shared ranks can claim two vouchers. Change the ranges or turn one off.', hadiahBaru: 'New reward', idHadiah: 'ID (letters, no spaces)',
      tanpaHadiah: 'No rewards yet.', kosongNominal: 'value not set',
      berlakuSampai: 'Valid until', berlakuUntuk: 'Applies to', semuaProduk: 'All shop products', maksPembeli: 'Max. uses per buyer', syarat: 'Terms shown to the buyer', syaratPh: 'e.g. One use per Shopee account. Cannot be exchanged for cash.',
      cetakJudul: 'QR cards for Shopee parcels', ketCetak: 'One card per item packed. The code works once: the first book that scans it keeps it. Output: a ZIP of 300 dpi PNG files, one per card (140 x 60 mm), ready for the print vendor.',
      jumlah: 'Qty', total: 'Total', maks: 'max 500 per print', vJumlah: 'Cards with a bonus voucher', vKode: 'Voucher code', vTeks: 'Voucher text shown to the buyer',
      ketVoucher: 'Bonus vouchers are mixed randomly into the batch. The buyer only sees it after scanning.', buat: 'Create codes', buatCetak: 'Download PNG', cetakLagi: 'Download PNG again', bikinPng: 'Making PNG', gagalPng: 'Could not make the PNG files: ',
      paketJudul: 'Shopee parcel QR cards (print in-house)', ketPaket: 'One card per parcel. The card is not tied to a product: its contents are linked at packing, in the Kode Kartu QR column of the warehouse Excel or in the Link card tab. Every card carries a voucher. Print on A4, 4 cards per sheet (140 x 60 mm), then cut.',
      pJumlah: 'Number of cards', pVKode: 'Shopee voucher code (required)', pVSampai: 'Valid until (required)', pVSampaiKet: 'Same as the voucher end date on Shopee. Buyers see it with the days left.', pVTeks: 'Voucher text shown to the buyer', pVTeksPh: 'e.g. Rp15,000 off, min. spend Rp150,000', buatPaket: 'Create codes & print A4', cetakA4Lagi: 'Print A4 again', unduhPng: 'Download PNG', unduhPdf: 'Download vendor PDF (A4, bleed)', ukKartu: 'Card size', ukStandar: 'standard', ukMin: 'min. {n} pcs', rwJudul: 'Cards already printed', rwKet: 'Download the vendor PDF or PNG again per print batch. Card order is the same as the first print. Do not send batches marked test to the vendor.', rwTgl: 'Created', rwVoucher: 'Voucher', rwJml: 'Cards', rwBuka: 'Opened', rwUji: 'test', rwPdf: 'Vendor PDF', rwKosong: 'No cards printed in this edition yet.', rwMuat: 'Loading print batches…', bikinPdf: 'Making PDF', gagalPdf: 'Could not make the PDF: ', ketPdf: 'For the print shop: A4, 3 mm bleed and crop marks. Sizes follow the vendor list. The card design is scaled to fit without stretching, and the leftover space up to the cut line is filled with the card background. 15 x 7 cm is the closest to the design.', siapCetak: 'Preparing the print sheet…', edJudul: 'Edition QR card (one design for the vendor)', edKet: 'One QR for every parcel card in this edition, so the vendor prints one file as many times as needed. The warehouse does not need to scan these cards, just put one in each parcel. Buyers open them with their Shopee order number; the first orders up to the number of parcel cards below get the cards and voucher.', edSiap: 'Show edition card', edMuat: 'Preparing the edition card…', edJatah: '{a} of {n} orders opened', edTanpaJatah: 'No parcel card codes in this edition yet. Create parcel cards below first: the number of codes is how many orders can open the edition card.', edPdf: 'Download vendor PDF (1 design)', edPng: 'Download PNG (1 card)', edAlamat: 'QR address',
      dibuat: 'codes created for', dariAcara: 'event', kartuUntuk: 'Collection card for', pindai: 'Scan to unlock your card in the Mofmofriends Book', atauKetik: 'or type the code at mofmofriends.id',
      strukJudul: 'Receipt claims', tanpaStruk: 'No receipts waiting.', lihatFoto: 'Show photo', setujui: 'Approve', tolak: 'Reject', yakinTolak: 'Reject for sure?', kartuDibuka: 'Cards to unlock',
      ketStruk: 'Check the store, date, and items on the photo. Untick items that are not on the receipt.', dibeli: 'bought', diputus: 'Done', pilihKartu: 'Pick at least one card.',
      psJudul: 'Link a parcel card to a Shopee order', psKet: 'Daily work goes through the Kode Kartu QR column in the warehouse Excel. Use this tab as a backup, or to fix a card linked to the wrong order. Scan the order number, then scan the card. A card scanned without an order number is only checked.',
      psPesanan: 'Order number', psKartu: 'Card code (scan the QR)', psTombol: 'Link', psLog: 'Linked on this device', psKosong: 'Nothing linked yet.',
      ps_ok: function (k, p) { return 'Card ' + k + ' is now linked to order ' + p + '.'; }, ps_pindah: function (l) { return ' Released: ' + l + '.'; },
      ps_sudah: function (k, p) { return 'Card ' + k + ' was already linked to order ' + p + '. Nothing changed.'; },
      ps_lain: function (k, l) { return 'Card ' + k + ' is already linked to order ' + l + '. If this card really belongs in this parcel, move it.'; },
      ps_penuh: function (p, l) { return 'Order ' + p + ' already has card ' + l + '. One parcel holds one card. Replace it only if the old card is not in the parcel.'; },
      ps_bukan: 'This is a per-product card (the old kind), not a parcel card. It cannot be linked to an order.',
      ps_tidak: 'Card code not recognised. Scan again or check the letters on the card.', ps_salah: 'The order number or the card code could not be read. Order numbers use only letters and digits.',
      ps_dipakai: 'This card was already opened by a buyer, so it cannot be moved.', ps_terbuka: function (l) { return 'The old card ' + l + ' on this order was already opened by the buyer, so it cannot be replaced.'; },
      psPindah: 'Move card to this order', psGanti: 'Replace with this card', ps_cek: function (k, p) { return p ? 'Card ' + k + ' is linked to order ' + p + '.' : 'Card ' + k + ' is not linked to any order yet.'; },
      ps_cekBuka: ' The buyer has opened it.', ps_cekLama: 'This is a per-product card (the old kind).',
      kamera: 'Camera', kamTutup: 'Close camera', kamArahKartu: 'Point the camera at the card QR.', kamArahPesanan: 'Point the camera at the order number barcode on the label.', kamMuat: 'Opening the camera…',
      pt_judul: 'Game monitor {cap}', pt_ket: 'Ranked games started per WIB day. Out of plays = players who used all 10 ranked plays in that game that day.', pt_tgl: 'Date', pt_k_triv: 'Quiz', pt_k_mem: 'Match', pt_k_adv: 'Dash', pt_triv: 'Animal Quiz', pt_mem: 'Memory Match', pt_adv: 'Adventure Dash', pt_total: 'Edition total',
      pt_pemain: '{n} players', pt_habis: '{n} out of plays', pt_semua: 'Unique players across all games: {n}', pt_teratas: 'Top 5', pt_kosong: 'No scores yet.', pt_kom: 'Community Mission {n}/{t} ({p})', pt_komTanpa: 'Community Mission: {n} correct answers', pt_latihan: '{n} books played practice mode (never bought, scores stay off the leaderboard).', pt_dtk: 's',
      fn_judul: 'Campaign funnel {cap}', fn_dicetak: 'QR cards printed', fn_discan: 'Scanned in Mofmo Collection', fn_pembeli: 'Buyer books', fn_mainPembeli: 'Buyers who played a game',
      fn_dari: '{p} of the previous step', fn_latihan: '{n} books played practice mode (never bought, scores stay off the leaderboard).', fn_ket: 'Test cards and test vouchers (TES/UJI) are not counted.',
      v_judul: 'Voucher reconciliation', v_ket: 'Given = vouchers buyers received through QR cards and Kitab rewards. Used = from the Shopee report, or typed in. Typed numbers are kept on this device, per edition.',
      v_kode: 'Code', v_cetak: 'Printed', v_pasang: 'Linked', v_hadiah: 'Reward', v_dibagi: 'Given', v_dipakai: 'Used', v_laju: 'Usage rate', v_total: 'Total', v_awas: 'more than given, the code may have spread outside Kitab', v_unggah: 'Upload Shopee report (.xlsx / .csv)',
      v_kosong: 'No vouchers in this edition yet.', v_hasil: '{n} Kitab vouchers updated from {f} ({c}).', v_c_jumlah: 'usage column', v_c_pesanan: 'counted per order', v_c_baris: 'counted per row',
      v_lewat: 'Skipped, not Kitab vouchers: {d}.', v_gagal: 'No voucher code column found in {f}. Use the Shopee voucher report or an order export that lists voucher codes.', v_gagalBaca: 'The file could not be read: {e}',
      kamGagal: 'The camera could not be opened. Allow camera access for this site in the browser settings, or use the scanner or type the code.'
    },
    id: {
      sp_judul: 'Siap edisi {cap}?', sp_sebelum: 'Mulai {t}, {d} hari lagi. Kartu paket diselipin selama edisi, maksimal {n} pesanan.', sp_hariIni: 'Mulai hari ini, {t}. Kartu paket diselipin selama edisi, maksimal {n} pesanan.', sp_jalan: 'Sedang berjalan, selesai {t}.', sp_skor: '{a} dari {b} siap', sp_kaki: 'Dicek ulang tiap tab ini dibuka. Tidak ada yang diubah otomatis; tombol cuma membawa ke tempat membetulkannya.',
      sp_tanggal: 'Tanggal edisi', sp_tanggalKet: '{m} sampai {s} ({n} hari).', sp_tanpaAcara: 'Belum ada edisi aktif', sp_tanpaAcaraKet: 'Buat edisinya dulu di bawah.',
      sp_tingkatOk: 'Hadiah papan sudah per peringkat', sp_tingkatOkKet: 'Ada hadiah papan yang mulai di bawah peringkat 1.', sp_tingkatW: 'Hadiah papan belum dibagi per peringkat', sp_tingkatWKet: 'Semua pemenang masih dapat nominal yang sama.',
      sp_voucherOk: 'Kode voucher lengkap', sp_voucherOkKet: 'Semua hadiah yang bernominal atau menyala sudah punya kode voucher.', sp_voucherW: 'Kode voucher belum diisi', sp_voucherWKet: '{n} hadiah bernominal atau menyala tapi belum ada kode voucher: {d}. Buat dulu di Seller Centre, lalu tempel kodenya.',
      sp_nyalaOk: '{n} hadiah menyala', sp_nyalaOkKet: 'Pembeli melihatnya di tab HADIAH.', sp_nyalaW: 'Belum ada hadiah yang menyala', sp_nyalaWKet: '0 dari {n} hadiah ON. Pembeli belum melihat hadiah apa pun di tab HADIAH.',
      sp_kuotaOk: 'Kuota cocok', sp_kuotaOkKet: 'Kuota hadiah papan sama dengan jumlah peringkatnya; hadiah lain yang bernominal punya kuota di atas 0.', sp_kuotaW: 'Kuota belum cocok', sp_kuotaWKet: 'Cek kuota: {d}.',
      sp_berlakuOk: 'Masa berlaku voucher aman', sp_berlakuOkKet: 'Semua voucher yang dipakai berlaku sampai edisi selesai atau lebih.', sp_berlakuC: 'Masa berlaku voucher pendek atau kosong', sp_berlakuCKet: '{d}. Isi {s} atau sesudahnya supaya voucher tidak keburu habis sebelum dipakai pemenang.',
      sp_kartuOk: 'Kartu QR paket cukup', sp_kartuW: 'Kartu QR paket kurang', sp_kartuKet: '{a} dari {b} kartu sudah dicetak.',
      sp_ujiOk: 'Data uji sudah bersih', sp_ujiOkKet: 'Tidak ada kartu dengan voucher TES atau UJI yang tersisa.', sp_ujiW: 'Kartu uji masih ada', sp_ujiWKet: '{n} kartu bervoucher TES atau UJI. Hapus sesudah tes selesai.',
      sp_keHadiah: 'Ke daftar hadiah', sp_cetak: 'Cetak kartu', sp_tingkat: 'Tambah 3 tingkat', sp_hapusUji: 'Hapus data uji',
      judul: 'Kitabku', judulH: 'Judul', tabRingkas: 'Event & hadiah', tabCetak: 'Cetak kartu QR', tabStruk: 'Klaim struk', tabPasang: 'Pasang kartu', tabTemplate: 'Template', tabJadwal: 'Jadwal game', jd_tglJudul: 'Tanggal edisi', jd_tglKet: 'Mengubah edisi yang sedang jalan: leaderboard, kartu edisi, dan QR yang sudah dicetak tetap. Untuk edisi berikutnya pakai Event baru di tab Event & hadiah.', jd_simpanTgl: 'Simpan tanggal', jd_tglOk: 'Tanggal edisi tersimpan.', jd_judul: 'Jadwal match', jd_ket: 'Game tidak boleh buka barengan. Main ranked cuma saat match game itu (10 game ranked per match); di luar match jadi latihan. Jadwal kosong berarti semua game buka sepanjang edisi.', jd_kosong: 'Belum ada match. Pakai Isi otomatis atau Tambah match.', jd_oto: 'Isi otomatis', jd_urut: 'Urutan game', jd_hari: 'Hari per game', jd_n: 'Match per game', jd_jam1: 'Buka', jd_jam2: 'Tutup', jd_buat: 'Isi jadwal', jd_tambah: 'Tambah match', jd_simpan: 'Simpan jadwal', jd_belum: 'Belum disimpan. Tekan Simpan jadwal.', jd_ok: function (n) { return n + ' match tersimpan.'; }, jd_game: 'Game', jd_tgl: 'Tanggal', jd_mulai: 'Buka', jd_selesai: 'Tutup', jd_hapus: 'Hapus', jd_lewat: 'selesai', jd_jalan: 'jalan', jd_malam: 'besoknya', jd_ringkas: function (g, n, a, b) { return g + ': ' + n + ' match, ' + a + ' sampai ' + b; }, jd_otoKurang: 'Edisinya terlalu pendek untuk hari per game sebanyak itu.', tutup: 'Tutup', tp_judul: 'Template desain', tp_ket: 'Tersimpan di Google Drive, folder Arsip Template Mofmo Collection, satu folder per event. Berkas tetap privat milik pemilik Drive.', tp_acara: 'Event', tp_berkas: 'Berkas (PNG, JPG, PDF, AI, PSD, SVG, ZIP; maks 15 MB per berkas)', tp_catatan: 'Catatan (boleh kosong)', tp_unggah: 'Unggah', tp_kirim: 'Mengunggah…', tp_kosong: 'Belum ada template yang diarsipkan.', tp_final: 'FINAL', tp_jadiFinal: 'Tandai final', tp_batalFinal: 'Batal final', tp_buka: 'Buka di Drive', tp_besar: function (n) { return n + ' lebih dari 15 MB. Kecilkan dulu atau simpan langsung di Drive.'; }, tp_tanpaAcara: 'Isi nama event dulu.', tp_tanpaBerkas: 'Pilih berkasnya dulu.', tp_ok: function (n) { return n + ' berkas terunggah.'; }, tp_gagal: function (n, p) { return n + ' gagal: ' + p; },
      muat: 'Memuat…', gagal: 'Server Kitabku belum bisa dihubungi. Cek sinyal lalu coba lagi.', ulang: 'Coba lagi', sesiHabis: 'Sesi WMS sudah habis. Masuk lagi.',
      kKartu: 'Kartu terbuka', kPemain: 'Kolektor', kStruk: 'Struk menunggu', kKlaim: 'Hadiah diambil', kKode: 'Kartu Shopee dicetak', kDipakai: 'dipindai',
      acara: 'Event aktif', tanpaAcara: 'Belum ada event. Buat dulu sebelum mencetak kartu.', acaraBaru: 'Event baru', nama: 'Nama', cap: 'Cap', mulai: 'Mulai', selesai: 'Selesai',
      simpanAcara: 'Mulai event ini', ketAcara: 'Event baru menutup event yang berjalan. Papan peringkat mulai dari nol, kartu lama tetap bercap event lamanya.',
      hadiah: 'Hadiah', ketHadiah: 'Hadiah yang dinyalakan langsung tampil di buku setiap pembeli. Kode voucher dibuat manual di Shopee Seller Centre, lalu tempel kodenya di sini.',
      jenis: 'Jenis', angka: 'Target', saluran: 'Dihitung', semua: 'Semua kartu', online: 'Kartu Shopee saja', isi: 'Hadiah', nominal: 'Nilai', minBelanja: 'Min. belanja',
      voucher: 'Kode voucher', kuota: 'Kuota', terpakai: 'diambil', aktif: 'Nyala', simpan: 'Simpan', tersimpan: 'Tersimpan', usulan: 'Pasang hadiah dari mockup (nonaktif)',
      j_kartu: 'Jumlah kartu', j_bab: 'Bab lengkap', j_bintang: 'Bintang game', j_edisi: 'Kartu edisi', j_papan: 'Papan Total', pemenang: 'Peringkat sampai', peringkatDari: 'Peringkat dari', ketPapan: 'Satu hadiah = satu tingkat peringkat, masing-masing dengan voucher sendiri. Contoh: #1 (1 sampai 1), #2-3 (2 sampai 3), #4-10 (4 sampai 10), paling jauh sampai peringkat 100. Pembeli di rentang ini pada papan Total bisa klaim sesudah edisi selesai. Isi kuota sama dengan jumlah peringkat di rentang. Voucher boleh diisi belakangan.',
      hsJudul: 'Hapus semua kartu edisi (mode tes)', hsKet: 'Menghapus SEMUA kartu QR yang dicetak untuk edisi aktif (kartu paket dan kartu per produk), termasuk pasangannya ke No Pesanan, apa pun kode vouchernya. Buku yang isinya hanya kartu-kartu tersebut ikut dihapus. Hanya bisa sebelum edisi mulai. Isi pesanan dari setoran gudang tidak disentuh.',
      hsCek: 'Periksa', hsAngka: '{n} kartu edisi {e} akan dihapus: {p} sudah dipasang ke pesanan, {d} sudah dibuka di Kitab.', hsKetik: 'Ketik HAPUS SEMUA untuk konfirmasi', hsHapus: 'Hapus permanen {n} kartu',
      hsHasil: '{k} kartu edisi dihapus, {b} buku ikut dihapus.', hsTutup: 'Edisi {e} sudah mulai, jadi kartunya milik pembeli sungguhan. Hapus semua hanya bisa sebelum edisi mulai.', hsKosong: 'Tidak ada kartu di edisi aktif.',
      huJudul: 'Hapus data uji', huKet: 'Untuk membersihkan kartu yang dicetak buat tes. Cuma kartu yang kode vouchernya diawali TES atau UJI yang bisa dihapus, jadi kartu asli untuk pembeli aman.', huKode: 'Kode kartu uji (scan atau ketik, satu per baris)', huCek: 'Periksa',
      huDaftar: 'Yang akan dihapus', huBelum: 'belum dipasang', huBuka: 'dibuka buku {n}', huTutup: 'belum dibuka', huVoucher: 'voucher {v}', huLewat_bukan: '{k} dilewati: kode vouchernya {v} (bukan kartu uji).', huLewat_tidak: '{k} dilewati: kode tidak dikenal.', huLewat_salah: '{k} dilewati: bukan kode kartu.',
      huBuku: 'Buku yang ikut dihapus: {d}. Pasangan kartu ke pesanan ikut hilang bersama kartunya.', huBukuTetap: 'Buku tetap ada: {d} (punya kartu asli, skor, klaim hadiah, atau struk).', huYakin: 'Saya paham ini tidak bisa dibatalkan', huHapus: 'Hapus permanen {n} kartu uji', huKosong: 'Tidak ada kartu uji di daftar ini.', huHasil: '{k} kartu uji dihapus, {b} buku ikut dihapus.',
      tingkat3: 'Tambah 3 tingkat papan: #1, #2-3, #4-10', tingkat3Ket: 'Dipasang nonaktif dengan kuota 1, 2, dan 7. Isi nilai dan kode voucher, lalu nyalakan. Hadiah papan lama tidak diubah.',
      kuotaCek: 'Kuota {k}, padahal rentang ini ada {n} peringkat. Pembeli di luar kuota akan melihat "kuota habis".',
      tumpang: 'Rentang hadiah papan Total yang aktif tumpang tindih: {d}. Pembeli di peringkat yang sama bisa klaim dua voucher. Ubah rentangnya atau matikan salah satu.', hadiahBaru: 'Hadiah baru', idHadiah: 'ID (huruf, tanpa spasi)',
      tanpaHadiah: 'Belum ada hadiah.', kosongNominal: 'nilai belum diisi',
      berlakuSampai: 'Berlaku sampai', berlakuUntuk: 'Berlaku untuk', semuaProduk: 'Semua produk toko', maksPembeli: 'Maks. pakai per pembeli', syarat: 'Syarat dan ketentuan untuk pembeli', syaratPh: 'misal: Satu kali pakai per akun Shopee. Tidak dapat diuangkan.',
      cetakJudul: 'Kartu QR untuk paket Shopee', ketCetak: 'Satu kartu untuk setiap barang yang dikemas. Kode hanya berlaku sekali: buku pertama yang memindai yang memilikinya. Hasilnya ZIP berisi PNG 300 dpi, satu berkas per kartu (14 x 6 cm), siap dikirim ke vendor cetak.',
      jumlah: 'Jml', total: 'Total', maks: 'maks. 500 sekali cetak', vJumlah: 'Kartu dengan bonus voucher', vKode: 'Kode voucher', vTeks: 'Teks voucher untuk pembeli',
      ketVoucher: 'Bonus voucher diselipkan acak di antara kartu. Pembeli baru tahu setelah memindai.', buat: 'Buat kode', buatCetak: 'Unduh PNG', cetakLagi: 'Unduh PNG lagi', bikinPng: 'Membuat PNG', gagalPng: 'PNG gagal dibuat: ',
      paketJudul: 'Kartu QR paket Shopee (cetak sendiri)', ketPaket: 'Satu kartu untuk satu paket. Kartu tidak terikat produk: isinya diikat saat packing, lewat kolom Kode Kartu QR di Excel gudang atau tab Pasang kartu. Semua kartu membawa voucher. Cetak di kertas A4, 4 kartu per lembar (14 x 6 cm), lalu potong.',
      pJumlah: 'Jumlah kartu', pVKode: 'Kode voucher Shopee (wajib)', pVSampai: 'Berlaku sampai (wajib)', pVSampaiKet: 'Samakan dengan tanggal akhir voucher di Shopee. Pembeli melihatnya beserta sisa hari.', pVTeks: 'Teks voucher untuk pembeli', pVTeksPh: 'misal: Potongan Rp15.000, min. belanja Rp150.000', buatPaket: 'Buat kode & cetak A4', cetakA4Lagi: 'Cetak A4 lagi', unduhPng: 'Unduh PNG', unduhPdf: 'Unduh PDF vendor (A4, bleed)', ukKartu: 'Ukuran kartu', ukStandar: 'standar', ukMin: 'min. {n} pcs', rwJudul: 'Kartu yang sudah dicetak', rwKet: 'Unduh ulang PDF vendor atau PNG per cetakan. Urutan kartu sama dengan cetakan pertama. Cetakan bertanda uji jangan dikirim ke vendor.', rwTgl: 'Dibuat', rwVoucher: 'Voucher', rwJml: 'Kartu', rwBuka: 'Dibuka', rwUji: 'uji', rwPdf: 'PDF vendor', rwKosong: 'Belum ada kartu yang dicetak di edisi ini.', rwMuat: 'Memuat daftar cetakan…', bikinPdf: 'Membuat PDF', gagalPdf: 'PDF gagal dibuat: ', ketPdf: 'Untuk percetakan: A4, bleed 3 mm dan tanda potong. Ukuran mengikuti daftar vendor. Desain kartu diperbesar atau diperkecil sampai pas tanpa ditarik, sisa ruang sampai garis potong diisi latar kartu. 15 x 7 cm paling mendekati desain.', siapCetak: 'Menyiapkan lembar cetak…', edJudul: 'Kartu QR edisi (1 desain untuk vendor)', edKet: 'Satu QR untuk semua kartu paket edisi ini, jadi vendor cukup mencetak satu file sebanyak yang dibutuhkan. Gudang tidak perlu scan kartunya, cukup masukkan satu ke tiap paket. Pembeli membukanya pakai No Pesanan Shopee; pesanan pertama sampai sejumlah kode kartu paket di bawah yang dapat kartu dan voucher.', edSiap: 'Tampilkan kartu edisi', edMuat: 'Menyiapkan kartu edisi…', edJatah: '{a} dari {n} pesanan sudah dibuka', edTanpaJatah: 'Belum ada kode kartu paket di edisi ini. Buat kartu paket dulu di bawah: jumlah kodenya = jumlah pesanan yang bisa membuka kartu edisi.', edPdf: 'Unduh PDF vendor (1 desain)', edPng: 'Unduh PNG (1 kartu)', edAlamat: 'Alamat QR',
      dibuat: 'kode dibuat untuk', dariAcara: 'event', kartuUntuk: 'Kartu koleksi untuk', pindai: 'Pindai untuk membuka kartumu di Kitab Mofmofriends', atauKetik: 'atau ketik kodenya di mofmofriends.id',
      strukJudul: 'Klaim struk', tanpaStruk: 'Tidak ada struk yang menunggu.', lihatFoto: 'Lihat foto', setujui: 'Setujui', tolak: 'Tolak', yakinTolak: 'Yakin tolak?', kartuDibuka: 'Kartu yang dibuka',
      ketStruk: 'Cek gerai, tanggal, dan barang di foto. Hapus centang barang yang tidak ada di struk.', dibeli: 'dibeli', diputus: 'Selesai', pilihKartu: 'Pilih minimal satu kartu.',
      psJudul: 'Pasang kartu paket ke pesanan Shopee', psKet: 'Kerja harian lewat kolom Kode Kartu QR di Excel gudang. Tab ini untuk cadangan, atau membetulkan kartu yang salah pasang. Scan No Pesanan, lalu scan kartunya. Kartu yang discan tanpa No Pesanan hanya dicek.',
      psPesanan: 'No Pesanan', psKartu: 'Kode kartu (scan QR)', psTombol: 'Pasang', psLog: 'Terpasang dari perangkat ini', psKosong: 'Belum ada yang dipasang.',
      ps_ok: function (k, p) { return 'Kartu ' + k + ' terpasang ke pesanan ' + p + '.'; }, ps_pindah: function (l) { return ' Dilepas: ' + l + '.'; },
      ps_sudah: function (k, p) { return 'Kartu ' + k + ' memang sudah terpasang ke pesanan ' + p + '. Tidak ada yang berubah.'; },
      ps_lain: function (k, l) { return 'Kartu ' + k + ' sudah terpasang ke pesanan ' + l + '. Kalau kartu ini memang masuk paket ini, pindahkan.'; },
      ps_penuh: function (p, l) { return 'Pesanan ' + p + ' sudah punya kartu ' + l + '. Satu paket satu kartu. Ganti hanya kalau kartu lama tidak ada di paket.'; },
      ps_bukan: 'Ini kartu per produk (cara lama), bukan kartu paket. Tidak bisa dipasang ke pesanan.',
      ps_tidak: 'Kode kartu tidak dikenal. Scan ulang atau cek huruf di kartunya.', ps_salah: 'No Pesanan atau kode kartu belum terbaca. No Pesanan hanya berisi huruf dan angka.',
      ps_dipakai: 'Kartu ini sudah dibuka pembeli, jadi tidak bisa dipindah.', ps_terbuka: function (l) { return 'Kartu lama ' + l + ' di pesanan ini sudah dibuka pembeli, jadi tidak bisa diganti.'; },
      psPindah: 'Pindahkan ke pesanan ini', psGanti: 'Ganti dengan kartu ini', ps_cek: function (k, p) { return p ? 'Kartu ' + k + ' terpasang ke pesanan ' + p + '.' : 'Kartu ' + k + ' belum terpasang ke pesanan mana pun.'; },
      ps_cekBuka: ' Sudah dibuka pembeli.', ps_cekLama: 'Ini kartu per produk (cara lama).',
      kamera: 'Kamera', kamTutup: 'Tutup kamera', kamArahKartu: 'Arahkan kamera ke QR kartu.', kamArahPesanan: 'Arahkan kamera ke barcode No Pesanan di label.', kamMuat: 'Membuka kamera…',
      pt_judul: 'Pantau game {cap}', pt_ket: 'Game ranked yang dimulai per hari WIB. Habis jatah = pemain yang sudah memakai 10 main ranked di game itu hari itu.', pt_tgl: 'Tanggal', pt_k_triv: 'Quiz', pt_k_mem: 'Match', pt_k_adv: 'Dash', pt_triv: 'Animal Quiz', pt_mem: 'Memory Match', pt_adv: 'Adventure Dash', pt_total: 'Total edisi',
      pt_pemain: '{n} pemain', pt_habis: '{n} habis jatah', pt_semua: 'Pemain unik semua game: {n}', pt_teratas: '5 teratas', pt_kosong: 'Belum ada skor.', pt_kom: 'Misi Komunitas {n}/{t} ({p})', pt_komTanpa: 'Misi Komunitas: {n} jawaban benar', pt_latihan: '{n} buku main latihan (belum beli, skornya tidak masuk papan).', pt_dtk: 'dtk',
      fn_judul: 'Funnel kampanye {cap}', fn_dicetak: 'Kartu QR dicetak', fn_discan: 'Discan di Mofmo Collection', fn_pembeli: 'Buku pembeli', fn_mainPembeli: 'Pembeli yang main game',
      fn_dari: '{p} dari langkah sebelumnya', fn_latihan: '{n} buku main mode latihan (belum pernah beli, skornya tidak masuk papan).', fn_ket: 'Kartu dan voucher uji (TES/UJI) tidak dihitung.',
      v_judul: 'Rekonsiliasi voucher', v_ket: 'Dibagikan = voucher yang diterima pembeli lewat kartu QR dan hadiah Kitab. Dipakai = dari laporan Shopee, atau isi sendiri. Isian disimpan di perangkat ini, per edisi.',
      v_kode: 'Kode', v_cetak: 'Dicetak', v_pasang: 'Terpasang', v_hadiah: 'Hadiah', v_dibagi: 'Dibagikan', v_dipakai: 'Dipakai', v_laju: 'Tingkat pakai', v_total: 'Total', v_awas: 'lebih dari yang dibagikan, kode mungkin tersebar di luar Kitab', v_unggah: 'Unggah laporan Shopee (.xlsx / .csv)',
      v_kosong: 'Belum ada voucher di edisi ini.', v_hasil: '{n} voucher Kitab diperbarui dari {f} ({c}).', v_c_jumlah: 'kolom jumlah penggunaan', v_c_pesanan: 'dihitung per pesanan', v_c_baris: 'dihitung per baris',
      v_lewat: 'Dilewati, bukan voucher Kitab: {d}.', v_gagal: 'Kolom kode voucher tidak ditemukan di {f}. Pakai laporan voucher Shopee atau ekspor pesanan yang memuat kode voucher.', v_gagalBaca: 'Berkas tidak bisa dibaca: {e}',
      kamGagal: 'Kamera tidak bisa dibuka. Beri izin kamera untuk situs ini di pengaturan browser, atau pakai scanner atau ketik kodenya.'
    }
  };
  var BULAN = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] };
  var W = window;
  function M() { return W.__wms || {}; }
  function bhs() { return M().bhs && M().bhs() === 'id' ? 'id' : 'en'; }
  function t(k) { var d = TEKS[bhs()]; return d[k] != null ? d[k] : (TEKS.en[k] != null ? TEKS.en[k] : k); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function nf(n) { return Number(n || 0).toLocaleString('en-US'); }
  function el(i) { return document.getElementById(i); }
  function bunyi(n) { try { var S = M().Suara; if (S && S[n]) S[n](); } catch (e) {} }
  function tgl(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + ' ' + BULAN[bhs()][Number(m[2]) - 1] + ' ' + m[1] : esc(s); }
  function kodeTampil(k) { return String(k).replace(/^(.{4})(.{4})(.*)$/, '$1 $2 $3'); }

  var A = { tab: 'ringkas', ringkas: null, galat: '', sibuk: false, struk: null, foto: {}, pilih: {}, tolakYakin: 0, p: { jumlah: '', kode: '', teks: '', sampai: '' }, hasilPaket: null, mencetak: false, simpanOk: {}, draf: {}, pesan: '', dari: null,
    ps: { pesanan: '', kartu: '', hasil: null, tunda: null, log: [], sibuk: false }, hu: { teks: '', rencana: null, teksRencana: '', yakin: false, sibuk: false, hasil: null }, hs: { rencana: null, yakin: false, ketik: '', sibuk: false, hasil: null }, kam: { aliran: null, v: null, t: null, sasaran: '', det: null, gagal: false } };
  function panggil(aksi, isi) {
    var badan = Object.assign({ fn: 'admin', aksi: aksi, tiket: (M().S && M().S.tiket) || '' }, isi || {});
    return fetch(KITAB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(badan), credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (h) { if (h && h.perluMasuk) throw new Error(t('sesiHabis')); return h; }, function () { throw new Error(t('gagal')); });
  }
  function muatRingkas() {
    A.galat = ''; A.sibuk = true; gambar();
    return panggil('ringkas').then(function (h) { A.sibuk = false; if (!h.ok) throw new Error(h.pesan || t('gagal')); A.ringkas = h; gambar(); if (h.acara) { muatFunnel(); muatPantau(); } else A.pantau = null; }, function (e) { A.sibuk = false; A.galat = e.message; gambar(); });
  }
  /* ---------- Funnel kampanye dan rekonsiliasi voucher (19 Okt 2026, Ferdy: "semua gas") ----------
     Funnel dari aksi admin 'funnel' (server kitab v14): kartu dicetak, discan, buku pembeli, pembeli yang main.
     Server lama tanpa aksi itu: bagiannya tidak tampil, Ringkas lain tetap jalan.
     Dipakai = isian tangan atau laporan Shopee (laporan voucher berkolom jumlah penggunaan, atau ekspor pesanan
     satu baris per barang yang dihitung per nomor pesanan). Disimpan di localStorage per edisi: tidak ada tabel
     server untuk ini, dan angkanya selalu bisa diisi ulang dari laporan yang sama. */
  var KUNCI_PAKAI = 'wms-kitab-voucher-dipakai-';
  function muatFunnel() {
    return panggil('funnel').then(function (h) {
      A.funnel = h && h.ok && h.funnel && h.acara ? h : null;
      if (A.funnel) A.vpakai = bacaPakai(h.acara.id);
      if (A.tab === 'ringkas') gambar();
    }, function () { A.funnel = null; });
  }
  /* ---------- Pantau game (21 Okt 2026, Ferdy: "Pantau game di WMS") ----------
     Aksi admin 'pantauGame' (server kitab v28): per hari WIB sejak edisi mulai, per game ranked: game dimulai,
     pemain unik, pemain yang menghabiskan jatah 10. Plus total edisi, 5 teratas tiap papan, Misi Komunitas, latihan.
     Server lama tanpa aksi itu, atau tanpa edisi aktif: bagiannya tidak tampil, Ringkas lain tetap jalan. */
  var PT_GAME = ['triv', 'mem', 'adv'];
  function muatPantau() {
    return panggil('pantauGame').then(function (h) {
      A.pantau = h && h.ok && h.acara && Array.isArray(h.hari) ? h : null;
      if (A.tab === 'ringkas') gambar();
    }, function () { A.pantau = null; });
  }
  function tglPantau(tgl) {
    var d = new Date(tgl + 'T00:00:00Z');
    try { return d.toLocaleDateString(bhs() === 'id' ? 'id-ID' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (e) { return tgl; }
  }
  function selPantau(g, x) {
    x = x || { main: 0, pemain: 0, habis: 0 };
    return '<td class="num' + (x.main ? '' : ' kb-pt-nol') + '" data-g="' + g + '"><b>' + nf(x.main) + '</b>' +
      (x.pemain ? ' <small>' + esc(teksIsi('pt_pemain', { n: nf(x.pemain) })) + '</small>' : '') +
      (x.habis ? ' <small class="kb-pt-habis">' + esc(teksIsi('pt_habis', { n: nf(x.habis) })) + '</small>' : '') + '</td>';
  }
  function htmlPantau() {
    var P = A.pantau; if (!P) return '';
    var kepala = '<tr><th>' + esc(t('pt_tgl')) + '</th>' + PT_GAME.map(function (g) { return '<th class="num" title="' + esc(t('pt_' + g)) + '">' + esc(t('pt_k_' + g)) + '</th>'; }).join('') + '</tr>';
    var isi = P.hari.slice().reverse().map(function (h) {
      return '<tr data-tgl="' + esc(h.tgl) + '"><th scope="row">' + esc(tglPantau(h.tgl)) + '</th>' + PT_GAME.map(function (g) { return selPantau(g, h[g]); }).join('') + '</tr>';
    }).join('');
    var T = P.total || {}, kaki = '<tr><th scope="row">' + esc(t('pt_total')) + '</th>' + PT_GAME.map(function (g) { return selPantau(g, T[g] && { main: T[g].main, pemain: T[g].pemain, habis: 0 }); }).join('') + '</tr>';
    var papan = PT_GAME.map(function (g) {
      var L = ((P.papan || {})[g] || []).map(function (b, i) {
        return '<li><span class="kb-pt-no">' + (i + 1) + '</span><span class="kb-pt-nama">' + esc(b.nama || '') + (b.tag ? ' <small>#' + esc(b.tag) + '</small>' : '') + '</span><b>' + nf(b.nilai) + '</b>' +
          (b.detik != null ? '<small class="kb-pt-dtk">' + nf(b.detik) + ' ' + esc(t('pt_dtk')) + '</small>' : '') + '</li>';
      }).join('');
      return '<div class="kb-pt-kartu" data-papan="' + g + '"><h4>' + esc(t('pt_' + g)) + ' · ' + esc(t('pt_teratas')) + '</h4>' + (L ? '<ol>' + L + '</ol>' : '<p class="ket-alat">' + esc(t('pt_kosong')) + '</p>') + '</div>';
    }).join('');
    var K = P.komunitas, kom = '';
    if (K) {
      var tgt = Number(K.target) || 0, pr = tgt ? Math.min(100, Math.round(K.n / tgt * 100)) : 0;
      kom = '<div class="kb-pt-kom" data-pantau-kom><span>' + esc(tgt ? teksIsi('pt_kom', { n: nf(K.n), t: nf(tgt), p: persen(K.n, tgt) }) : teksIsi('pt_komTanpa', { n: nf(K.n) })) + '</span>' +
        (tgt ? '<div class="kb-fn-batang" aria-hidden="true"><i style="width:' + pr + '%"></i></div>' : '') + '</div>';
    }
    return '<section class="kb-kotak kb-pantau" id="kbPantau"><h3>' + esc(teksIsi('pt_judul', { cap: P.acara.cap || P.acara.nama || '' })) + '</h3><p class="ket-alat">' + esc(t('pt_ket')) + '</p>' +
      '<div class="hpp-gulung"><table class="kb-pt-tabel"><thead>' + kepala + '</thead><tbody>' + isi + '</tbody><tfoot>' + kaki + '</tfoot></table></div>' +
      '<p class="ket-alat" data-pantau-semua>' + esc(teksIsi('pt_semua', { n: nf(T.semua ? T.semua.pemain : 0) })) + '</p>' +
      '<div class="kb-pt-papan">' + papan + '</div>' + kom +
      '<p class="ket-alat" data-pantau-latihan>' + esc(teksIsi('pt_latihan', { n: nf(P.latihan) })) + '</p></section>';
  }
  function bacaPakai(aid) { try { var o = JSON.parse(W.localStorage.getItem(KUNCI_PAKAI + aid) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function simpanPakai() { try { W.localStorage.setItem(KUNCI_PAKAI + A.funnel.acara.id, JSON.stringify(A.vpakai || {})); } catch (e) {} }
  function persen(a, b) { return b > 0 ? Math.round(a / b * 100) + '%' : '–'; }
  function angkaPakai(k) { var v = (A.vpakai || {})[k]; return v === '' || v == null || !isFinite(Number(v)) ? null : Number(v); }
  function htmlFunnel() {
    var F = A.funnel; if (!F) return '';
    var f = F.funnel, L = [['dicetak', f.dicetak], ['discan', f.discan], ['pembeli', f.pembeli], ['mainPembeli', f.mainPembeli]], maks = Math.max(1, f.dicetak, f.discan, f.pembeli);
    var langkah = L.map(function (x, i) {
      return '<li data-funnel="' + x[0] + '"><div class="kb-fn-label"><span>' + esc(t('fn_' + x[0])) + '</span>' + (i ? '<small>' + esc(teksIsi('fn_dari', { p: persen(x[1], L[i - 1][1]) })) + '</small>' : '') + '</div>' +
        '<div class="kb-fn-batang" aria-hidden="true"><i style="width:' + Math.max(x[1] ? 2 : 0, Math.round(x[1] / maks * 100)) + '%"></i></div><b>' + nf(x[1]) + '</b></li>';
    }).join('');
    var V = F.voucher || [], baris = V.map(function (v) {
      var n = angkaPakai(v.kode), awas = n != null && n > v.dibagi;
      /* dicetak dan terpasang (19 Okt 2026): voucher hadiah tidak punya kartu; server lama belum mengirim angkanya */
      var cetak = v.hadiah ? '<span class="kb-vhadiah">' + esc(t('v_hadiah')) + '</span>' : (v.dicetak == null ? '–' : nf(v.dicetak)), pasang = v.hadiah || v.terpasang == null ? '–' : nf(v.terpasang);
      return '<tr data-voucher="' + esc(v.kode) + '"' + (awas ? ' class="awas"' : '') + '><td><code>' + esc(v.kode) + '</code><small class="kb-vawas">' + esc(t('v_awas')) + '</small></td>' +
        '<td class="num" data-k="dicetak">' + cetak + '</td><td class="num" data-k="terpasang">' + pasang + '</td><td class="num" data-k="dibagi">' + nf(v.dibagi) + '</td>' +
        '<td class="num"><input type="number" min="0" step="1" inputmode="numeric" data-vpakai="' + esc(v.kode) + '" value="' + (n == null ? '' : n) + '" aria-label="' + esc(t('v_dipakai') + ' ' + v.kode) + '"></td><td class="num" data-k="laju">' + (n == null ? '–' : persen(n, v.dibagi)) + '</td></tr>';
    }).join('');
    var tot = totalPakai(), totCetak = 0, totPasang = 0;
    V.forEach(function (v) { if (!v.hadiah) { totCetak += v.dicetak || 0; totPasang += v.terpasang || 0; } });
    var tabel = V.length ? '<div class="hpp-gulung"><table class="kb-vtabel"><thead><tr><th>' + esc(t('v_kode')) + '</th><th class="num">' + esc(t('v_cetak')) + '</th><th class="num">' + esc(t('v_pasang')) + '</th><th class="num">' + esc(t('v_dibagi')) + '</th><th class="num">' + esc(t('v_dipakai')) + '</th><th class="num">' + esc(t('v_laju')) + '</th></tr></thead><tbody>' + baris +
      '</tbody><tfoot><tr><th>' + esc(t('v_total')) + '</th><td class="num" data-k="totCetak">' + nf(totCetak) + '</td><td class="num" data-k="totPasang">' + nf(totPasang) + '</td><td class="num">' + nf(tot.dibagi) + '</td><td class="num" data-k="totPakai">' + (tot.ada ? nf(tot.pakai) : '–') + '</td><td class="num" data-k="totLaju">' + (tot.ada ? persen(tot.pakai, tot.dibagiTerisi) : '–') + '</td></tr></tfoot></table></div>' +
      '<label class="btn dua kb-vunggah">' + esc(t('v_unggah')) + '<input type="file" id="kbVoucherBerkas" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>' +
      (A.vhasil ? '<p class="ket-alat kb-vhasil' + (A.vhasil.galat ? ' tolak-alat' : '') + '" role="status">' + esc(A.vhasil.teks) + '</p>' : '')
      : '<p class="ket-alat">' + esc(t('v_kosong')) + '</p>';
    return '<section class="kb-kotak kb-funnel" id="kbFunnel"><h3>' + esc(teksIsi('fn_judul', { cap: F.acara.cap || F.acara.nama || '' })) + '</h3><ol class="kb-fn">' + langkah + '</ol>' +
      '<p class="ket-alat" data-funnel-latihan>' + esc(teksIsi('fn_latihan', { n: nf(f.mainLatihan) })) + ' ' + esc(t('fn_ket')) + '</p>' +
      '<h3>' + esc(t('v_judul')) + '</h3><p class="ket-alat">' + esc(t('v_ket')) + '</p>' + tabel + '</section>';
  }
  /* tingkat pakai total hanya dari voucher yang angka dipakainya sudah diisi, supaya baris kosong tidak menurunkan persennya */
  function totalPakai() {
    var o = { dibagi: 0, dibagiTerisi: 0, pakai: 0, ada: false };
    ((A.funnel && A.funnel.voucher) || []).forEach(function (v) { var n = angkaPakai(v.kode); o.dibagi += v.dibagi; if (n != null) { o.ada = true; o.pakai += n; o.dibagiTerisi += v.dibagi; } });
    return o;
  }
  /* mengetik tidak menggambar ulang (fokus dan kursor tetap); hanya sel tingkat pakai, tanda, dan total yang diperbarui */
  function ketikPakai(x) {
    var k = x.getAttribute('data-vpakai'), v = String(x.value).trim();
    A.vpakai = A.vpakai || {}; if (v === '') delete A.vpakai[k]; else A.vpakai[k] = String(Math.max(0, Math.floor(Number(v) || 0)));
    simpanPakai(); segarkanVoucher();
  }
  function segarkanVoucher() {
    ((A.funnel && A.funnel.voucher) || []).forEach(function (v) {
      var tr = document.querySelector('#kbFunnel tr[data-voucher="' + v.kode.replace(/"/g, '') + '"]'); if (!tr) return;
      var n = angkaPakai(v.kode), inp = tr.querySelector('input');
      if (inp && document.activeElement !== inp) inp.value = n == null ? '' : n;
      tr.querySelector('[data-k=laju]').textContent = n == null ? '–' : persen(n, v.dibagi);
      tr.classList.toggle('awas', n != null && n > v.dibagi);
    });
    var tot = totalPakai(), a = document.querySelector('#kbFunnel [data-k=totPakai]'), b = document.querySelector('#kbFunnel [data-k=totLaju]');
    if (a) a.textContent = tot.ada ? nf(tot.pakai) : '–'; if (b) b.textContent = tot.ada ? persen(tot.pakai, tot.dibagiTerisi) : '–';
  }
  function uraiCsv(s) {
    s = String(s).replace(/^﻿/, '');
    var contoh = s.split(/\r?\n/).slice(0, 10).join('\n');
    var pisah = [';', ',', '\t'].sort(function (a, b) { return contoh.split(b).length - contoh.split(a).length; })[0];
    var rows = [], row = [], sel = '', kutip = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (kutip) { if (ch === '"') { if (s[i + 1] === '"') { sel += '"'; i++; } else kutip = false; } else sel += ch; }
      else if (ch === '"') kutip = true;
      else if (ch === pisah) { row.push(sel); sel = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(sel); rows.push(row); row = []; sel = ''; }
      else sel += ch;
    }
    if (sel !== '' || row.length) { row.push(sel); rows.push(row); }
    return rows;
  }
  /* rows: larik baris sel dari satu lembar. kenal: kode voucher Kitab. Hasil: {ok, per:{KODE:n}, lain:[kode bukan Kitab], cara} */
  function uraiVoucher(rows, kenal) {
    var K = {}; (kenal || []).forEach(function (k) { K[String(k).toUpperCase()] = k; });
    var norm = function (x) { return String(x == null ? '' : x).trim().toLowerCase().replace(/\s+/g, ' '); };
    var kepala = -1, kk = -1, kp = -1, ko = -1, i, j, r;
    for (i = 0; i < Math.min(rows.length, 30) && kepala < 0; i++) {
      r = rows[i] || [];
      for (j = 0; j < r.length; j++) if (/(kode|code).*(voucher|promo)|(voucher|promo).*(kode|code)/.test(norm(r[j]))) { kk = j; break; }
      if (kk < 0) continue;
      kepala = i;
      for (j = 0; j < r.length; j++) {
        var h = norm(r[j]);
        if (kp < 0 && /penggunaan|pemakaian|dipakai|terpakai|digunakan|redeem|usage|used/.test(h) && !/\brp\b|nilai|biaya|amount|\(rp\)/.test(h)) kp = j;
        if (ko < 0 && /^(no\.?|nomor) ?pesanan$|^order ?(id|sn|no\.?)$/.test(h)) ko = j;
      }
    }
    if (kk < 0) return { ok: false };
    var per = {}, lain = {}, sudah = {}, cara = kp >= 0 ? 'jumlah' : ko >= 0 ? 'pesanan' : 'baris';
    for (i = kepala + 1; i < rows.length; i++) {
      r = rows[i] || [];
      String(r[kk] == null ? '' : r[kk]).split(/[,;\s]+/).forEach(function (kode) {
        if (!kode) return;
        var U = kode.toUpperCase(), n = 1;
        if (cara === 'jumlah') n = typeof r[kp] === 'number' ? r[kp] : Number(String(r[kp] == null ? '' : r[kp]).replace(/[^\d]/g, '')) || 0;
        else if (cara === 'pesanan') { var kunci = U + '|' + String(r[ko] == null ? '' : r[ko]).trim(); if (sudah[kunci]) return; sudah[kunci] = 1; }
        if (K[U]) per[K[U]] = (per[K[U]] || 0) + n; else lain[U] = 1;
      });
    }
    return { ok: true, per: per, lain: Object.keys(lain).sort(), cara: cara };
  }
  function lembarDari(file) {
    if (/\.(csv|txt)$/i.test(file.name) || /csv|text\/plain/.test(file.type)) return file.text().then(function (s) { return [uraiCsv(s)]; });
    if (!W.WmsLapShopee || !W.WmsLapShopee._bacaBuku) return Promise.reject(new Error('lapshopee.js'));
    return file.arrayBuffer().then(function (buf) { return muatZip().then(function (Z) { return Z.loadAsync(buf); }); }).then(function (z) {
      return W.WmsLapShopee._bacaBuku(function (n) { var f = z.file(n); return f ? f.async('string') : Promise.resolve(''); });
    }).then(function (buku) { return Object.keys(buku).map(function (k) { return buku[k]; }); });
  }
  function unggahVoucher(file) {
    var kenal = ((A.funnel && A.funnel.voucher) || []).map(function (v) { return v.kode; });
    return lembarDari(file).then(function (lembar) {
      var h = null; lembar.some(function (rows) { var x = uraiVoucher(rows || [], kenal); if (x.ok) { h = x; return true; } return false; });
      if (!h) { A.vhasil = { galat: true, teks: teksIsi('v_gagal', { f: file.name }) }; gambar(); return; }
      A.vpakai = A.vpakai || {};
      kenal.forEach(function (k) { A.vpakai[k] = String(h.per[k] || 0); });
      simpanPakai();
      A.vhasil = { teks: teksIsi('v_hasil', { n: kenal.length, f: file.name, c: t('v_c_' + h.cara) }) + (h.lain.length ? ' ' + teksIsi('v_lewat', { d: h.lain.slice(0, 12).join(', ') + (h.lain.length > 12 ? ', …' : '') }) : '') };
      gambar();
    }).catch(function (e) { A.vhasil = { galat: true, teks: teksIsi('v_gagalBaca', { e: e && e.message || String(e) }) }; gambar(); });
  }
  function muatStruk() {
    A.galat = ''; A.struk = null; gambar();
    return panggil('struk').then(function (h) {
      if (!h.ok) throw new Error(h.pesan || t('gagal'));
      A.struk = h.baris; h.baris.forEach(function (b) { if (!A.pilih[b.id]) { A.pilih[b.id] = {}; (b.produk || []).forEach(function (k) { A.pilih[b.id][k] = true; }); } });
      gambar();
    }, function (e) { A.galat = e.message; gambar(); });
  }

  /* ---------- kerangka lembar (pakai gaya .alat-latar milik alat.js) ---------- */
  function pastikanDom() {
    if (el('kitabkuAdmin')) return el('kitabkuAdmin');
    var d = document.createElement('div');
    d.id = 'kitabkuAdmin'; d.className = 'alat-latar kitabku-latar'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div class="lembar" role="dialog" aria-modal="true" aria-label="Kitabku" tabindex="-1"><div class="kepala-alat"><div class="tab-alat" role="tablist"></div><button type="button" class="tutup-alat" data-kb="tutup"></button></div><div class="isi-alat" id="kbIsi"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', klik);
    d.addEventListener('input', ketik);
    d.addEventListener('change', ketik);
    d.addEventListener('keydown', tombolScan);
    /* scan berikutnya menimpa isi lama, bukan menyambung di belakangnya */
    d.addEventListener('focusin', function (e) { var x = e.target; if (x && (x.id === 'kbPsPesanan' || x.id === 'kbPsKartu') && x.select) x.select(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.classList.contains('buka')) { e.preventDefault(); tutup(); } });
    return d;
  }
  function buka(tab) {
    var d = pastikanDom();
    if (!d.classList.contains('buka')) A.dari = document.activeElement;
    A.tab = tab || A.tab || 'ringkas';
    d.classList.add('buka'); d.setAttribute('aria-hidden', 'false'); document.body.classList.add('alat-terbuka');
    var l = d.querySelector('.lembar'); try { l.focus({ preventScroll: true }); } catch (e) { l.focus(); }
    if (A.tab === 'struk') muatStruk(); else if (A.tab === 'pasang') { A.galat = ''; gambar(); fokusPs(); } else if (A.tab === 'template') muatTemplate(); else if (A.tab === 'jadwal') muatJadwal(); else muatRingkas();
  }
  function tutup() {
    var d = el('kitabkuAdmin'); if (!d) return;
    matikanKamera();
    d.classList.remove('buka'); d.setAttribute('aria-hidden', 'true'); document.body.classList.remove('alat-terbuka');
    try { if (A.dari && A.dari.focus) A.dari.focus(); } catch (e) {}
  }
  function gambar() {
    var d = el('kitabkuAdmin'); if (!d) return;
    /* menggambar ulang membuang elemen video, jadi kamera yang masih menyala dimatikan dulu */
    if (A.kam && A.kam.aliran) matikanKamera();
    /* 17 Okt, Ferdy: pembelian offline tidak dapat kartu, tab Klaim struk dihapus (htmlStruk dibiarkan, tidak terjangkau) */
    d.querySelector('.tab-alat').innerHTML = ['ringkas', 'jadwal', 'cetak', 'pasang', 'template'].map(function (m) {
      var on = A.tab === m, n = m === 'struk' && A.ringkas && A.ringkas.angka ? A.ringkas.angka.struk : 0;
      return '<button type="button" role="tab" data-kbtab="' + m + '" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '">' + esc(t(m === 'ringkas' ? 'tabRingkas' : m === 'jadwal' ? 'tabJadwal' : m === 'cetak' ? 'tabCetak' : m === 'pasang' ? 'tabPasang' : m === 'template' ? 'tabTemplate' : 'tabStruk')) + (n ? ' <b class="kb-lencana">' + n + '</b>' : '') + '</button>';
    }).join('');
    /* tab aktif selalu kelihatan di HP (deretan tab digeser ke samping) */
    var on = d.querySelector('.tab-alat .on'); if (on && on.scrollIntoView) try { on.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    var tt = d.querySelector('.tutup-alat'); tt.setAttribute('aria-label', t('tutup')); tt.title = t('tutup');
    tt.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var isi = A.galat ? '<div class="tolak-alat" role="alert">' + esc(A.galat) + '</div><button type="button" class="btn dua" data-kb="ulang">' + esc(t('ulang')) + '</button>' : '';
    if (!A.galat) isi = A.tab === 'jadwal' ? htmlJadwal() : A.tab === 'cetak' ? htmlCetak() : A.tab === 'struk' ? htmlStruk() : A.tab === 'pasang' ? htmlPasang() : A.tab === 'template' ? htmlTemplate() : htmlRingkas();
    el('kbIsi').innerHTML = isi;
  }

  /* ---------- arsip template desain (16 Okt 2026, Ferdy: simpan di Google Drive) ----------
     Server: ArsipTemplate.gs di Apps Script (arsipTemplateDaftar, arsipTemplateUnggah, arsipTemplateFinal),
     dipanggil lewat jalan WMS dengan kata pengganti WMS-TIKET. Ukuran dicek di HP dulu supaya berkas
     besar tidak terkirim percuma lewat data seluler. */
  var TP_MAKS = 15 * 1024 * 1024;
  A.tp = { data: null, memuat: false, galat: '', acara: '', catatan: '', kirim: false, pesan: '', gagal: [] };
  function gas(nama, args) {
    var m = M(); if (!m.jalan) return Promise.reject(new Error(t('gagal')));
    return Promise.resolve(m.jalan(nama, ['WMS-TIKET'].concat(args || []))).then(function (r) { if (!r || r.ok === false) throw new Error((r && r.pesan) || t('gagal')); return r; });
  }
  function muatTemplate() {
    A.galat = ''; A.tp.memuat = true; gambar();
    if (!A.ringkas) panggil('ringkas').then(function (h) { if (h && h.ok) { A.ringkas = h; if (A.tab === 'template' && !A.tp.acara) gambar(); } }, function () {});
    return gas('arsipTemplateDaftar').then(function (r) { A.tp.memuat = false; A.tp.data = r; gambar(); }, function (e) { A.tp.memuat = false; A.galat = e.message; gambar(); });
  }
  function bacaBase64(f) {
    return new Promise(function (ok, gagal) { var r = new FileReader(); r.onload = function () { ok(String(r.result).replace(/^data:[^,]*,/, '')); }; r.onerror = function () { gagal(new Error(t('gagal'))); }; r.readAsDataURL(f); });
  }
  function unggahTemplate() {
    var inp = el('kbTpBerkas'), files = inp && inp.files ? [].slice.call(inp.files) : [];
    A.tp.acara = (el('kbTpAcara') || {}).value || ''; A.tp.catatan = (el('kbTpCatatan') || {}).value || '';
    A.tp.pesan = ''; A.tp.gagal = [];
    if (!A.tp.acara.trim()) { A.tp.gagal = [t('tp_tanpaAcara')]; bunyi('scanTolak'); gambar(); return; }
    if (!files.length) { A.tp.gagal = [t('tp_tanpaBerkas')]; bunyi('scanTolak'); gambar(); return; }
    var besar = files.filter(function (f) { return f.size > TP_MAKS; });
    if (besar.length) { A.tp.gagal = besar.map(function (f) { return t('tp_besar')(f.name); }); bunyi('scanTolak'); gambar(); return; }
    A.tp.kirim = true; gambar();
    var n = 0, i = 0;
    function lanjut() {
      if (i >= files.length) return Promise.resolve();
      var f = files[i++];
      return bacaBase64(f).then(function (data) { return gas('arsipTemplateUnggah', [{ acara: A.tp.acara, nama: f.name, mime: f.type, data: data, catatan: A.tp.catatan }]); })
        .then(function () { n++; }, function (e) { A.tp.gagal.push(t('tp_gagal')(f.name, e.message)); }).then(lanjut);
    }
    lanjut().then(function () { A.tp.kirim = false; A.tp.pesan = n ? t('tp_ok')(n) : ''; bunyi(A.tp.gagal.length ? 'scanTolak' : 'scanOk'); return muatTemplate(); });
  }
  function finalTemplate(id, final) {
    gas('arsipTemplateFinal', [id, final]).then(function () { bunyi('scanOk'); return muatTemplate(); }, function (e) { A.tp.gagal = [e.message]; gambar(); });
  }
  function ukuranTp(b) { return b >= 1048576 ? (Math.round(b / 104857.6) / 10) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function htmlTemplate() {
    var tp = A.tp, ac = A.ringkas && A.ringkas.acara ? A.ringkas.acara.nama : '';
    if (!tp.acara && ac) tp.acara = ac;
    var form = '<section class="kb-kotak"><h3>' + esc(t('tp_judul')) + '</h3><p class="ket-alat">' + esc(t('tp_ket')) + '</p>' +
      '<div class="kb-form4"><label>' + esc(t('tp_acara')) + '<input id="kbTpAcara" maxlength="60" value="' + esc(tp.acara) + '" placeholder="11.11 Big Sale"></label>' +
      '<label>' + esc(t('tp_catatan')) + '<input id="kbTpCatatan" maxlength="200" value="' + esc(tp.catatan) + '"></label></div>' +
      '<label class="kb-tp-berkas">' + esc(t('tp_berkas')) + '<input id="kbTpBerkas" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.tif,.tiff,.pdf,.ai,.eps,.psd,.zip"></label>' +
      (tp.gagal.length ? '<div class="tolak-alat" role="alert">' + tp.gagal.map(esc).join('<br>') + '</div>' : '') +
      (tp.pesan ? '<p class="ls-hasil">' + esc(tp.pesan) + '</p>' : '') +
      '<button type="button" class="btn" data-kb="tpUnggah"' + (tp.kirim ? ' disabled' : '') + '>' + esc(t(tp.kirim ? 'tp_kirim' : 'tp_unggah')) + '</button></section>';
    var daftar;
    if (tp.memuat && !tp.data) daftar = '<p class="ket-alat">' + esc(t('muat')) + '</p>';
    else if (!tp.data || !tp.data.acara || !tp.data.acara.length) daftar = '<p class="ket-alat">' + esc(t('tp_kosong')) + '</p>';
    else daftar = tp.data.acara.map(function (ev) {
      return '<section class="kb-kotak"><h3>' + esc(ev.nama) + ' <small class="kb-mut">' + ev.file.length + '</small></h3><ul class="kb-tp-daftar">' + ev.file.map(function (f) {
        return '<li data-tp-final="' + (f.final ? 1 : 0) + '"><div><a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.nama) + '</a>' +
          (f.final ? ' <span class="kb-cap">' + esc(t('tp_final')) + '</span>' : '') + '<small>' + esc(ukuranTp(f.ukuran)) + ' · ' + esc(String(f.dibuat).slice(0, 10)) + (f.catatan ? ' · ' + esc(f.catatan) : '') + '</small></div>' +
          '<button type="button" class="btn dua" data-kb="tpFinal" data-id="' + esc(f.id) + '" data-final="' + (f.final ? 0 : 1) + '">' + esc(t(f.final ? 'tp_batalFinal' : 'tp_jadiFinal')) + '</button></li>';
      }).join('') + '</ul></section>';
    }).join('');
    return form + daftar;
  }

  /* ---------- jadwal game (22 Okt 2026) ----------
     Ferdy: "Gua yg atur sendiri di wms tanggal edisi game 11.11 serta rotasi masing-masing game dan durasinya".
     Tanggal edisi diubah di tempat (aksi ubahAcara: id edisi tetap, jadi papan dan kartu edisi tidak reset).
     Jadwal match disunting di layar lalu disimpan sekaligus (aksi simpanJadwal); semua aturan (bentrok, di luar
     tanggal, match lewat) diputus server dan pesannya ditampilkan apa adanya. Jam dalam WIB; jam tutup yang lebih
     awal dari jam buka berarti lewat tengah malam. */
  var GAME_JD = [['mem', 'Memory Match'], ['triv', 'Animal Quiz'], ['adv', 'Adventure']];
  function namaGameJd(g) { var x = GAME_JD.filter(function (y) { return y[0] === g; })[0]; return x ? x[1] : g; }
  function wibJd(iso) { var w = new Date(Date.parse(iso) + 7 * 3600e3).toISOString(); return { tgl: w.slice(0, 10), jam: w.slice(11, 16) }; }
  function tambahHari(tglS, n) { return new Date(Date.parse(tglS + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  function barisJd(r) { var a = wibJd(r.mulai), b = wibJd(r.selesai); return { game: r.game, tgl: a.tgl, mulai: a.jam, selesai: b.jam, ms: Date.parse(r.mulai), me: Date.parse(r.selesai) }; }
  function muatJadwal() {
    A.jdMuat = true; gambar();
    panggil('jadwalMatch', {}).then(function (r) {
      A.jdMuat = false;
      if (!r || !r.ok) { A.jd = null; A.jdPesan = (r && r.pesan) || t('gagal'); gambar(); return; }
      var lama = A.jd || {};
      A.jd = { acara: r.acara, kini: r.kini || Date.now(), rows: (r.match || []).map(barisJd), ubah: false, pesan: lama.pesanSimpan || '', ok: !!lama.pesanSimpan, oto: lama.oto || { u1: 'mem', u2: 'triv', u3: 'adv', hari: '', n: '3', j1: '19:00', j2: '23:00' } };
      A.jdPesan = ''; gambar();
    }, function (e) { A.jdMuat = false; A.jdPesan = e.message; gambar(); });
  }
  function isoJd(r) {
    var mulai = r.tgl + 'T' + r.mulai + ':00+07:00', tglTutup = r.selesai <= r.mulai ? tambahHari(r.tgl, 1) : r.tgl;
    return { game: r.game, mulai: mulai, selesai: tglTutup + 'T' + r.selesai + ':00+07:00' };
  }
  function htmlJadwal() {
    if (A.jdPesan) return '<div class="tolak-alat" role="alert">' + esc(A.jdPesan) + '</div><button type="button" class="btn dua" data-kb="ulang">' + esc(t('ulang')) + '</button>';
    var J = A.jd; if (!J) { if (!A.jdMuat) setTimeout(muatJadwal, 0); return '<p class="ket-alat">' + esc(t('muat')) + '</p>'; }
    var ac = J.acara, kini = J.kini, o = J.oto;
    var opsiGame = function (pilih) { return GAME_JD.map(function (g) { return '<option value="' + g[0] + '"' + (g[0] === pilih ? ' selected' : '') + '>' + g[1] + '</option>'; }).join(''); };
    var tanggal = '<section class="kb-kotak"><h3>' + esc(t('jd_tglJudul')) + ' <span class="kb-cap">' + esc(ac.cap) + '</span></h3><p class="ket-alat">' + esc(t('jd_tglKet')) + '</p>' +
      '<div class="kb-form4"><label>' + esc(t('nama')) + '<input id="kbJdNama" maxlength="60" value="' + esc(ac.nama) + '"></label><label>' + esc(t('cap')) + '<input id="kbJdCap" maxlength="12" value="' + esc(ac.cap) + '"></label>' +
      '<label>' + esc(t('mulai')) + '<input id="kbJdMulai" type="date" value="' + esc(String(ac.mulai || '').slice(0, 10)) + '"></label><label>' + esc(t('selesai')) + '<input id="kbJdSelesai" type="date" value="' + esc(String(ac.selesai || '').slice(0, 10)) + '"></label></div>' +
      (J.pesanTgl ? '<div class="' + (J.okTgl ? 'kb-hasil' : 'tolak-alat') + '" role="status">' + esc(J.pesanTgl) + '</div>' : '') +
      '<button type="button" class="btn" data-kb="jdTanggal">' + esc(t('jd_simpanTgl')) + '</button></section>';
    var oto = '<details class="kb-det" id="kbJdOto"' + (J.rows.length ? '' : ' open') + '><summary>' + esc(t('jd_oto')) + '</summary><div class="kb-form4">' +
      '<label class="lebar">' + esc(t('jd_urut')) + '<span class="kb-jd-urut"><select id="kbJdUrut1">' + opsiGame(o.u1) + '</select><select id="kbJdUrut2">' + opsiGame(o.u2) + '</select><select id="kbJdUrut3">' + opsiGame(o.u3) + '</select></span></label>' +
      '<label>' + esc(t('jd_hari')) + '<input id="kbJdHari" type="number" min="1" max="31" inputmode="numeric" value="' + esc(o.hari) + '" placeholder="' + esc(String(Math.max(1, Math.floor(hariEdisiJd(ac) / 3)))) + '"></label>' +
      '<label>' + esc(t('jd_n')) + '<input id="kbJdN" type="number" min="1" max="10" inputmode="numeric" value="' + esc(o.n) + '"></label>' +
      '<label>' + esc(t('jd_jam1')) + '<input id="kbJdJam1" type="time" value="' + esc(o.j1) + '"></label><label>' + esc(t('jd_jam2')) + '<input id="kbJdJam2" type="time" value="' + esc(o.j2) + '"></label></div>' +
      '<button type="button" class="btn dua" data-kb="jdOto">' + esc(t('jd_buat')) + '</button></details>';
    var tabel = J.rows.length ? '<div class="hpp-gulung"><table class="kb-jd-tabel" id="kbJdTabel"><thead><tr><th>#</th><th>' + esc(t('jd_game')) + '</th><th>' + esc(t('jd_tgl')) + '</th><th>' + esc(t('jd_mulai')) + '</th><th>' + esc(t('jd_selesai')) + '</th><th></th></tr></thead><tbody>' +
      J.rows.map(function (r, i) {
        var lewat = r.me && r.me <= kini, jalan = r.ms && r.ms <= kini && !lewat, kunci = lewat ? ' disabled' : '', kunciMulai = lewat || jalan ? ' disabled' : '';
        return '<tr data-i="' + i + '" class="' + (lewat ? 'lewat' : jalan ? 'jalan' : '') + '"><td>' + (i + 1) + '</td><td><select data-jd="game" data-i="' + i + '"' + kunciMulai + '>' + opsiGame(r.game) + '</select></td>' +
          '<td><input type="date" data-jd="tgl" data-i="' + i + '" value="' + esc(r.tgl) + '"' + kunciMulai + '></td><td><input type="time" data-jd="mulai" data-i="' + i + '" value="' + esc(r.mulai) + '"' + kunciMulai + '></td>' +
          '<td><input type="time" data-jd="selesai" data-i="' + i + '" value="' + esc(r.selesai) + '"' + kunci + '>' + (r.selesai && r.mulai && r.selesai <= r.mulai ? '<small class="kb-jd-malam">' + esc(t('jd_malam')) + '</small>' : '') + '</td>' +
          '<td>' + (lewat ? '<span class="kb-cap">' + esc(t('jd_lewat')) + '</span>' : jalan ? '<span class="kb-cap">' + esc(t('jd_jalan')) + '</span>' : '<button type="button" class="btn dua" data-kb="jdHapus" data-i="' + i + '">' + esc(t('jd_hapus')) + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="ket-alat">' + esc(t('jd_kosong')) + '</p>';
    /* 22 Okt sore, Ferdy: ringkasan menyebut jam buka match pertama dan jam TUTUP match terakhir (match 18.00 sampai
       05.00 dulu tertulis "7 Nov to 7 Nov"). Waktu diambil dari isoJd, jadi tutup lewat tengah malam ikut tanggal besoknya. */
    var jamJd = function (iso) { var w = String(iso); return tgl(w.slice(0, 10)) + ' ' + (bhs() === 'en' ? w.slice(11, 16) : w.slice(11, 13) + '.' + w.slice(14, 16)); };
    var ringkas = GAME_JD.map(function (g) {
      var L = J.rows.filter(function (r) { return r.game === g[0] && r.tgl && r.mulai && r.selesai; }).map(isoJd);
      if (!L.length) return '';
      var buka = L.map(function (x) { return x.mulai; }).sort()[0], tutup = L.map(function (x) { return x.selesai; }).sort()[L.length - 1];
      return '<li>' + esc(t('jd_ringkas')(g[1], L.length, jamJd(buka), jamJd(tutup))) + '</li>';
    }).join('');
    var status = J.pesan ? '<div class="' + (J.ok ? 'kb-hasil' : 'tolak-alat') + '" role="' + (J.ok ? 'status' : 'alert') + '" id="kbJdPesan">' + esc(J.pesan) + '</div>' : (J.ubah ? '<div class="tolak-alat" id="kbJdPesan">' + esc(t('jd_belum')) + '</div>' : '');
    return tanggal + '<section class="kb-kotak" id="kbJadwal"><h3>' + esc(t('jd_judul')) + '</h3><p class="ket-alat">' + esc(t('jd_ket')) + '</p>' + oto + status + tabel +
      (ringkas ? '<ul class="kb-jd-ringkas">' + ringkas + '</ul>' : '') +
      '<div class="kb-rw-atur"><button type="button" class="btn dua" data-kb="jdTambah">' + esc(t('jd_tambah')) + '</button> <button type="button" class="btn" data-kb="jdSimpan">' + esc(t('jd_simpan')) + '</button></div></section>';
  }
  function hariEdisiJd(ac) { return Math.round((Date.parse(String(ac.selesai).slice(0, 10)) - Date.parse(String(ac.mulai).slice(0, 10))) / 864e5) + 1; }
  function ketikJd(x) {
    var J = A.jd, o = J.oto, id = x.id;
    if (id === 'kbJdUrut1') o.u1 = x.value; else if (id === 'kbJdUrut2') o.u2 = x.value; else if (id === 'kbJdUrut3') o.u3 = x.value;
    else if (id === 'kbJdHari') o.hari = x.value; else if (id === 'kbJdN') o.n = x.value; else if (id === 'kbJdJam1') o.j1 = x.value; else if (id === 'kbJdJam2') o.j2 = x.value;
    var f = x.getAttribute && x.getAttribute('data-jd');
    if (f) {
      var r = J.rows[Number(x.getAttribute('data-i'))]; if (!r) return;
      r[f] = x.value; J.ubah = true; J.pesan = ''; J.ok = false;
      var ps = el('kbJdPesan'); if (ps) { ps.className = 'tolak-alat'; ps.textContent = t('jd_belum'); }
      else { var tb = el('kbJdTabel'); if (tb) { var d = document.createElement('div'); d.className = 'tolak-alat'; d.id = 'kbJdPesan'; d.textContent = t('jd_belum'); tb.parentNode.parentNode.insertBefore(d, tb.parentNode); } }
    }
  }
  /* blok berurutan per game mulai hari pertama edisi; n match per blok disebar rata (hari pertama dan terakhir blok ikut) */
  function isiOtoJd() {
    var J = A.jd, o = J.oto, ac = J.acara, total = hariEdisiJd(ac);
    var hari = Math.round(Number(o.hari)) || Math.max(1, Math.floor(total / 3)), n = Math.max(1, Math.min(10, Math.round(Number(o.n)) || 3));
    if (hari * 3 > total) { J.pesan = t('jd_otoKurang'); J.ok = false; gambar(); return; }
    var urut = [o.u1, o.u2, o.u3], rows = [], awal = String(ac.mulai).slice(0, 10);
    urut.forEach(function (g, gi) {
      for (var i = 0; i < n; i++) {
        var hk = n === 1 ? 0 : Math.round(i * (hari - 1) / (n - 1));
        rows.push({ game: g, tgl: tambahHari(awal, gi * hari + hk), mulai: o.j1 || '19:00', selesai: o.j2 || '23:00' });
      }
    });
    /* match yang sudah lewat atau sedang jalan tetap dipertahankan (server menolak kalau diubah) */
    var tetap = J.rows.filter(function (r) { return r.ms && r.ms <= J.kini; });
    J.rows = tetap.concat(rows.filter(function (r) { return Date.parse(isoJd(r).mulai) > J.kini; }));
    J.ubah = true; J.pesan = ''; gambar();
  }
  function tambahJd() {
    var J = A.jd, akhir = J.rows[J.rows.length - 1];
    J.rows.push({ game: akhir ? akhir.game : 'mem', tgl: akhir ? tambahHari(akhir.tgl, 1) : String(J.acara.mulai).slice(0, 10), mulai: '19:00', selesai: '23:00' });
    J.ubah = true; J.pesan = ''; gambar();
  }
  function simpanJd() {
    var J = A.jd; J.pesan = ''; gambar();
    panggil('simpanJadwal', { match: J.rows.map(isoJd) }).then(function (r) {
      if (!r || !r.ok) { J.pesan = (r && r.pesan) || t('gagal'); J.ok = false; bunyi('scanTolak'); gambar(); return; }
      bunyi('scanOk'); J.pesanSimpan = t('jd_ok')(r.jumlah); A.jd = J; muatJadwal();
    }, function (e) { J.pesan = e.message; J.ok = false; gambar(); });
  }
  function simpanTanggalJd() {
    var J = A.jd, a = { nama: el('kbJdNama').value, cap: el('kbJdCap').value, mulai: el('kbJdMulai').value, selesai: el('kbJdSelesai').value };
    panggil('ubahAcara', { acara: a }).then(function (r) {
      if (!r || !r.ok) { J.pesanTgl = (r && r.pesan) || t('gagal'); J.okTgl = false; bunyi('scanTolak'); gambar(); return; }
      J.acara = r.acara || a; J.pesanTgl = t('jd_tglOk'); J.okTgl = true; A.ringkas = null; bunyi('scanOk'); gambar();
    }, function (e) { J.pesanTgl = e.message; J.okTgl = false; gambar(); });
  }

  /* ---------- event & hadiah ---------- */
  function htmlRingkas() {
    var r = A.ringkas; if (!r) return '<p class="ket-alat">' + esc(t('muat')) + '</p>';
    var a = r.angka || {}, ac = r.acara;
    var kpi = [['kKartu', a.kartu], ['kPemain', a.pemain], ['kKlaim', a.klaim], ['kKode', a.kode, a.dipakai]].map(function (x) {
      return '<div class="kb-kpi"><span>' + esc(t(x[0])) + '</span><b>' + nf(x[1]) + '</b>' + (x[2] != null ? '<small>' + nf(x[2]) + ' ' + esc(t('kDipakai')) + '</small>' : '') + '</div>';
    }).join('');
    var acara = '<section class="kb-kotak"><h3>' + esc(t('acara')) + '</h3>' + (ac ? '<p class="kb-acara"><b>' + esc(ac.nama) + '</b> <span class="kb-cap">' + esc(ac.cap) + '</span> ' + tgl(ac.mulai) + ' – ' + tgl(ac.selesai) + '</p>' : '<p class="ket-alat">' + esc(t('tanpaAcara')) + '</p>') +
      '<details class="kb-det"' + (ac ? '' : ' open') + '><summary>' + esc(t('acaraBaru')) + '</summary><div class="kb-form4">' +
      '<label>' + esc(t('nama')) + '<input id="kbAcNama" maxlength="60" placeholder="11.11 Big Sale"></label><label>' + esc(t('cap')) + '<input id="kbAcCap" maxlength="12" placeholder="11.11"></label>' +
      '<label>' + esc(t('mulai')) + '<input id="kbAcMulai" type="date"></label><label>' + esc(t('selesai')) + '<input id="kbAcSelesai" type="date"></label></div>' +
      '<p class="ket-alat">' + esc(t('ketAcara')) + '</p><button type="button" class="btn" data-kb="acara">' + esc(t('simpanAcara')) + '</button></details></section>';
    /* isian yang ditolak server tetap di form (18 Okt): dulu form kembali ke nilai lama dan hadiah baru kosong lagi */
    var rows = (r.hadiah || []).map(function (h) { return htmlHadiah(A.draf[h.id] ? Object.assign({}, h, A.draf[h.id]) : h); }).join(''), tp = tumpangPapan(r.hadiah);
    if (tp.length) rows = '<div class="tolak-alat kb-tumpang" role="alert">' + esc(t('tumpang').replace('{d}', tp.join(', '))) + '</div>' + rows;
    var hadiah = '<section class="kb-kotak" id="kbHadiah"><h3>' + esc(t('hadiah')) + '</h3><p class="ket-alat">' + esc(t('ketHadiah')) + '</p>' +
      (rows || '<p class="ket-alat">' + esc(t('tanpaHadiah')) + '</p>') +
      '<details class="kb-det"' + (A.draf.baru ? ' open' : '') + '><summary>' + esc(t('hadiahBaru')) + '</summary>' + htmlHadiah(A.draf.baru ? Object.assign({}, A.draf.baru, { baru: true }) : { id: '', jenis: 'kartu', angka: 3, saluran: 'semua', aktif: false, baru: true }) + '</details>' +
      (rows ? '' : '<button type="button" class="btn dua" data-kb="usulan">' + esc(t('usulan')) + '</button>') +
      /* tombol tingkat cuma muncul selama belum ada hadiah papan yang mulai di bawah peringkat 1 */
      ((r.hadiah || []).some(function (h) { return h.jenis === 'papan' && Number(h.peringkat_dari) > 1; }) ? '' :
        '<div class="kb-tingkat-usul"><button type="button" class="btn dua" data-kb="tingkat3">' + esc(t('tingkat3')) + '</button><small class="ket-alat">' + esc(t('tingkat3Ket')) + '</small></div>') + '</section>';
    return (A.pesan ? '<div class="tolak-alat" role="alert">' + esc(A.pesan) + '</div>' : '') + htmlSiap(r) + '<div class="kb-kpis">' + kpi + '</div>' + htmlFunnel() + htmlPantau() + acara + hadiah;
  }
  /* ---------- Siap edisi (18 Okt 2026, mockup disetujui Ferdy) ----------
     Cek kesiapan edisi sebelum dan selama edisi: tanggal, tingkat papan, kode voucher, hadiah menyala,
     kuota, masa berlaku, kartu paket, kartu uji. Cuma membaca A.ringkas; tidak mengubah apa pun.
     Hadiah "dipakai" = bernominal ATAU menyala: hadiah tanpa nominal yang mati dianggap belum dipakai.
     Baris kartu dan uji butuh hitungan paket dari server kitab v13; server lama tidak mengirimnya. */
  function selisihHari(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function teksIsi(k, o) { var x = t(k); Object.keys(o || {}).forEach(function (n) { x = x.split('{' + n + '}').join(o[n]); }); return x; }
  function cekSiap(r, hari) {
    var ac = r && r.acara, H = (r && r.hadiah) || [], pk = r && r.paket, L = [];
    if (ac && String(ac.selesai).slice(0, 10) < hari) return null;
    var dipakai = H.filter(function (h) { return String(h.nominal || '').trim() || h.aktif; });
    if (ac) L.push({ id: 'tanggal', s: 'ok', j: t('sp_tanggal'), k: teksIsi('sp_tanggalKet', { m: tgl(ac.mulai), s: tgl(ac.selesai), n: selisihHari(String(ac.mulai).slice(0, 10), String(ac.selesai).slice(0, 10)) + 1 }) });
    else L.push({ id: 'tanggal', s: 'w', j: t('sp_tanpaAcara'), k: t('sp_tanpaAcaraKet') });
    var bertingkat = H.some(function (h) { return h.jenis === 'papan' && Number(h.peringkat_dari) > 1; });
    L.push(bertingkat ? { id: 'tingkat', s: 'ok', j: t('sp_tingkatOk'), k: t('sp_tingkatOkKet') } : { id: 'tingkat', s: 'w', j: t('sp_tingkatW'), k: t('sp_tingkatWKet'), b: ['data-kb="tingkat3"', t('sp_tingkat'), 1] });
    var tanpaV = dipakai.filter(function (h) { return !String(h.voucher || '').trim(); }).map(function (h) { return h.id; });
    L.push(tanpaV.length ? { id: 'voucher', s: 'w', j: t('sp_voucherW'), k: teksIsi('sp_voucherWKet', { n: tanpaV.length, d: tanpaV.join(', ') }), b: ['data-kb="keHadiah"', t('sp_keHadiah')] } : { id: 'voucher', s: 'ok', j: t('sp_voucherOk'), k: t('sp_voucherOkKet') });
    var nyala = H.filter(function (h) { return h.aktif; }).length;
    L.push(nyala ? { id: 'nyala', s: 'ok', j: teksIsi('sp_nyalaOk', { n: nyala }), k: t('sp_nyalaOkKet') } : { id: 'nyala', s: 'w', j: t('sp_nyalaW'), k: teksIsi('sp_nyalaWKet', { n: H.length }), b: ['data-kb="keHadiah"', t('sp_keHadiah')] });
    var salahK = H.filter(function (h) { return h.jenis === 'papan' ? (h.aktif || String(h.nominal || '').trim() || Number(h.peringkat_dari) > 1) && teksKuota(h) : (String(h.nominal || '').trim() && !(Number(h.kuota) > 0)); }).map(function (h) { return h.id; });
    L.push(salahK.length ? { id: 'kuota', s: 'w', j: t('sp_kuotaW'), k: teksIsi('sp_kuotaWKet', { d: salahK.join(', ') }), b: ['data-kb="keHadiah"', t('sp_keHadiah')] } : { id: 'kuota', s: 'ok', j: t('sp_kuotaOk'), k: t('sp_kuotaOkKet') });
    var batas = ac ? String(ac.selesai).slice(0, 10) : '';
    var pendek = batas ? dipakai.filter(function (h) { var b = String(h.berlaku_sampai || '').slice(0, 10); return !b || b < batas; }).map(function (h) { return h.id + ' (' + (h.berlaku_sampai ? tgl(h.berlaku_sampai) : '-') + ')'; }) : [];
    L.push(pendek.length ? { id: 'berlaku', s: 'c', j: t('sp_berlakuC'), k: teksIsi('sp_berlakuCKet', { d: pendek.join(', '), s: tgl(batas) }), b: ['data-kb="keHadiah"', t('sp_keHadiah')] } : { id: 'berlaku', s: 'ok', j: t('sp_berlakuOk'), k: t('sp_berlakuOkKet') });
    if (pk) {
      L.push({ id: 'kartu', s: pk.dicetak >= pk.target ? 'ok' : 'w', j: t(pk.dicetak >= pk.target ? 'sp_kartuOk' : 'sp_kartuW'), k: teksIsi('sp_kartuKet', { a: nf(pk.dicetak), b: nf(pk.target) }), b: pk.dicetak >= pk.target ? null : ['data-kbtab="cetak"', t('sp_cetak'), 1] });
      L.push(pk.uji ? { id: 'uji', s: 'w', j: t('sp_ujiW'), k: teksIsi('sp_ujiWKet', { n: nf(pk.uji) }), b: ['data-kbtab="pasang"', t('sp_hapusUji')] } : { id: 'uji', s: 'ok', j: t('sp_ujiOk'), k: t('sp_ujiOkKet') });
    }
    var sub = '';
    if (ac) { var m = String(ac.mulai).slice(0, 10), d = selisihHari(hari, m), n = pk ? pk.target : 50; sub = d > 0 ? teksIsi('sp_sebelum', { t: tgl(m), d: d, n: n }) : d === 0 ? teksIsi('sp_hariIni', { t: tgl(m), n: n }) : teksIsi('sp_jalan', { t: tgl(ac.selesai) }); }
    return { judul: teksIsi('sp_judul', { cap: ac ? (ac.cap || ac.nama) : '' }).replace(/\s+\?/, '?'), sub: sub, item: L, siap: L.filter(function (x) { return x.s === 'ok'; }).length };
  }
  function htmlSiap(r) {
    var c = cekSiap(r, hariIniWib()); if (!c) return '';
    var ikon = { ok: '✓', w: '!', c: '?' };
    return '<section class="kb-kotak kb-siap" id="kbSiap"><div class="kb-siap-kepala"><div><h3>' + esc(c.judul) + '</h3>' + (c.sub ? '<p class="ket-alat">' + esc(c.sub) + '</p>' : '') + '</div>' +
      '<span class="kb-siap-skor' + (c.siap === c.item.length ? ' ok' : '') + '">' + esc(teksIsi('sp_skor', { a: c.siap, b: c.item.length })) + '</span></div>' +
      '<div class="kb-siap-batang" aria-hidden="true"><i style="width:' + Math.round(c.siap / c.item.length * 100) + '%"></i></div><ul class="kb-siap-daftar">' +
      c.item.map(function (x) {
        return '<li class="' + x.s + '" data-siap="' + x.id + '" data-status="' + x.s + '"><span class="kb-siap-ikon" aria-hidden="true">' + ikon[x.s] + '</span><div><b>' + esc(x.j) + '</b><small>' + esc(x.k) + '</small></div>' +
          (x.b ? '<button type="button" class="btn' + (x.b[2] ? '' : ' dua') + '" ' + x.b[0] + '>' + esc(x.b[1]) + '</button>' : '') + '</li>';
      }).join('') + '</ul><p class="ket-alat">' + esc(t('sp_kaki')) + '</p></section>';
  }
  function htmlHadiah(h) {
    var k = h.baru ? 'baru' : h.id, sel = function (nm, opsi, nilai) { return '<select data-f="' + nm + '">' + opsi.map(function (o) { return '<option value="' + o[0] + '"' + (String(nilai) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var inp = function (nm, nilai, ph, tipe) { return '<input data-f="' + nm + '"' + (tipe ? ' type="' + tipe + '"' : '') + ' value="' + esc(nilai == null ? '' : nilai) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; };
    return '<div class="kb-hadiah' + (h.aktif ? ' nyala' : '') + '" data-hadiah="' + esc(k) + '">' +
      '<div class="kb-hkepala">' + (h.baru ? '<label class="kb-id">' + esc(t('idHadiah')) + inp('id', h.id || '', 'patok5') + '</label>' : '<b>' + esc(judulAdmin(h)) + '</b><code>' + esc(h.id) + '</code>') +
      '<label class="kb-saklar"><input type="checkbox" data-f="aktif"' + (h.aktif ? ' checked' : '') + '> ' + esc(t('aktif')) + '</label></div>' +
      '<div class="kb-hgrid">' +
      '<label>' + esc(t('judulH')) + inp('judul', h.judul) + '</label>' +
      '<label>' + esc(t('jenis')) + sel('jenis', [['kartu', t('j_kartu')], ['bab', t('j_bab')], ['bintang', t('j_bintang')], ['edisi', t('j_edisi')], ['papan', t('j_papan')]], h.jenis) + '</label>' +
      /* 18 Okt 2026, Ferdy: voucher beda tiap peringkat. Hadiah papan = satu tingkat, Peringkat dari sampai Peringkat sampai. */
      (h.jenis === 'papan' ? '<label>' + esc(t('peringkatDari')) + inp('peringkat_dari', h.peringkat_dari || 1, '', 'number') + '</label>' : '') +
      '<label>' + esc(t(h.jenis === 'papan' ? 'pemenang' : 'angka')) + (h.jenis === 'bab' ? sel('angka', BAB.map(function (b, i) { return [i, ROM[i] + ' · ' + b]; }), h.angka) : inp('angka', h.angka, '', 'number')) + '</label>' +
      '<label>' + esc(t('saluran')) + sel('saluran', [['semua', t('semua')], ['online', t('online')]], h.saluran) + '</label>' +
      '<label>' + esc(t('isi')) + inp('hadiah', h.hadiah) + '</label>' +
      '<label>' + esc(t('nominal')) + inp('nominal', h.nominal, 'Rp…') + '</label>' +
      '<label>' + esc(t('minBelanja')) + inp('min_belanja', h.min_belanja, 'Rp…') + '</label>' +
      '<label>' + esc(t('voucher')) + inp('voucher', h.voucher) + '</label>' +
      '<label>' + esc(t('kuota')) + inp('kuota', h.kuota || 0, '', 'number') + (h.baru ? '' : '<small>' + nf(h.terpakai) + ' ' + esc(t('terpakai')) + '</small>') + '</label>' +
      '<label>' + esc(t('berlakuSampai')) + inp('berlaku_sampai', h.berlaku_sampai ? String(h.berlaku_sampai).slice(0, 10) : '', '', 'date') + '</label>' +
      '<label>' + esc(t('berlakuUntuk')) + inp('berlaku_untuk', h.berlaku_untuk || '', t('semuaProduk')) + '</label>' +
      '<label>' + esc(t('maksPembeli')) + inp('maks_per_pembeli', h.maks_per_pembeli || 1, '', 'number') + '</label>' +
      '<label class="kb-syarat">' + esc(t('syarat')) + '<textarea data-f="syarat" rows="2" maxlength="300" placeholder="' + esc(t('syaratPh')) + '">' + esc(h.syarat || '') + '</textarea></label>' +
      '</div>' + (h.jenis === 'papan' ? '<p class="tolak-alat kb-kuota-cek" role="status"' + (teksKuota(h) ? '' : ' hidden') + '>' + esc(teksKuota(h)) + '</p><p class="ket-alat">' + esc(t('ketPapan')) + '</p>' : '') + '<div class="kb-hbawah">' + (!h.baru && !h.nominal && h.voucher == null ? '<small class="kb-mut">' + esc(t('kosongNominal')) + '</small>' : '') +
      '<button type="button" class="btn" data-kb="hadiah" data-id="' + esc(k) + '">' + esc(A.simpanOk[k] ? t('tersimpan') : t('simpan')) + '</button></div></div>';
  }
  function judulAdmin(h) {
    if (h.judul) return h.judul;
    var n = h.jenis === 'bab' ? 'Bab ' + ROM[Number(h.angka)] + ' · ' + BAB[Number(h.angka)] : h.jenis === 'bintang' ? '★★★' : h.jenis === 'papan' ? rentangPapan(h) : h.angka;
    return t('j_' + h.jenis) + ' ' + n;
  }
  /* #1, #4-10; hadiah papan lama yang mulai dari 1 tetap "top N" */
  function rentangPapan(h) {
    var d = Number(h.peringkat_dari) || 1, s = Number(h.angka) || 0;
    return d === s ? '#' + d : d > 1 ? '#' + d + '-' + s : '· top ' + s;
  }
  /* 18 Okt pagi: kuota tingkat papan dibanding jumlah peringkat di rentangnya; '' kalau sama */
  function teksKuota(h) {
    var d = Number(h.peringkat_dari) || 1, s = Number(h.angka) || 0, n = s - d + 1, k = Number(h.kuota) || 0;
    return n >= 1 && k !== n ? t('kuotaCek').replace('{k}', k).replace('{n}', n) : '';
  }
  /* pasangan hadiah papan aktif yang rentangnya beririsan: pembeli di irisan bisa klaim dua voucher */
  function tumpangPapan(daftar) {
    var pp = (daftar || []).filter(function (h) { return h.jenis === 'papan' && h.aktif; }), hasil = [];
    for (var i = 0; i < pp.length; i++) for (var j = i + 1; j < pp.length; j++) {
      var a = pp[i], b = pp[j];
      if (Math.max(Number(a.peringkat_dari) || 1, Number(b.peringkat_dari) || 1) <= Math.min(Number(a.angka) || 0, Number(b.angka) || 0)) hasil.push(a.id + ' & ' + b.id);
    }
    return hasil;
  }
  function bacaHadiah(k) {
    var box = document.querySelector('[data-hadiah="' + k + '"]'); if (!box) return null;
    var h = { id: k === 'baru' ? '' : k };
    box.querySelectorAll('[data-f]').forEach(function (x) { var f = x.getAttribute('data-f'); h[f] = x.type === 'checkbox' ? x.checked : x.value; });
    h.angka = Number(h.angka || 0); h.kuota = Number(h.kuota || 0);
    if ('maks_per_pembeli' in h) h.maks_per_pembeli = Number(h.maks_per_pembeli);
    if ('peringkat_dari' in h) h.peringkat_dari = Number(h.peringkat_dari || 0);
    if (!h.voucher) h.voucher = null;
    return h;
  }
  function simpanHadiah(k) {
    var h = bacaHadiah(k); if (!h) return;
    A.pesan = '';
    panggil('hadiah', { hadiah: h }).then(function (r) {
      if (!r.ok) { A.pesan = r.pesan; A.draf[k] = h; bunyi('scanTolak'); gambar(); return; }
      bunyi('scanOk'); A.draf = {}; A.simpanOk = {}; A.simpanOk[h.id] = 1; return muatRingkas();
    }, function (e) { A.pesan = e.message; gambar(); });
  }
  /* ID yang sudah ada dilewati: hadiah yang sudah diisi (voucher, nominal) tidak boleh tertimpa */
  function pasangTingkat3() {
    var ada = {}; ((A.ringkas && A.ringkas.hadiah) || []).forEach(function (h) { ada[h.id] = 1; });
    var L = TINGKAT3.filter(function (x) { return !ada[x[0]]; }), i = 0;
    var lanjut = function () {
      if (i >= L.length) return muatRingkas();
      var x = L[i++];
      return panggil('hadiah', { hadiah: { id: x[0], judul: '', jenis: 'papan', peringkat_dari: x[1], angka: x[2], kuota: x[3], saluran: 'semua', hadiah: 'Voucher Shopee', nominal: '', min_belanja: '', voucher: null, aktif: false } })
        .then(function (r) { if (r && r.ok === false) { A.pesan = r.pesan; gambar(); return; } return lanjut(); }, function (e) { A.pesan = e.message; gambar(); });
    };
    lanjut();
  }
  function pasangUsulan() {
    var i = 0;
    var lanjut = function () {
      if (i >= USULAN.length) return muatRingkas();
      var u = USULAN[i++];
      return panggil('hadiah', { hadiah: Object.assign({ nominal: '', min_belanja: '', voucher: null, kuota: 0, aktif: false }, u) }).then(lanjut, function (e) { A.pesan = e.message; gambar(); });
    };
    lanjut();
  }
  function simpanAcara() {
    var a = { nama: el('kbAcNama').value, cap: el('kbAcCap').value, mulai: el('kbAcMulai').value, selesai: el('kbAcSelesai').value };
    A.pesan = '';
    panggil('acara', { acara: a }).then(function (r) { if (!r.ok) { A.pesan = r.pesan; bunyi('scanTolak'); gambar(); return; } bunyi('scanOk'); muatRingkas(); }, function (e) { A.pesan = e.message; gambar(); });
  }

  /* ---------- cetak kartu QR ---------- */
  /* 16 Okt 2026, Ferdy: kartu dicetak sendiri dan tidak terikat SKU ("alurnya gua setuju").
     Satu kartu = satu paket; isinya diikat waktu packing. Voucher di semua kartu, jadi kodenya wajib.
     Kartu per produk untuk vendor (ZIP PNG) tidak lagi ditawarkan di layar ini. */
  /* tanggal hari ini menurut WIB, batas bawah tanggal berlaku voucher */
  function hariIniWib() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function paketSiap() { var n = Number(A.p.jumlah); return Number.isInteger(n) && n >= 1 && n <= 500 && !!String(A.p.kode || '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(A.p.sampai || '') && A.p.sampai >= hariIniWib() && !A.sibuk; }
  function htmlCetak() {
    var ac = A.ringkas && A.ringkas.acara;
    if (A.ringkas && !ac) return '<div class="tolak-alat">' + esc(t('tanpaAcara')) + '</div>';
    var h = A.hasilPaket;
    var hasil = h ? '<div class="kb-hasil"><b>' + nf(h.kode.length) + '</b> ' + esc(t('dibuat')) + ' ' + esc(t('dariAcara')) + ' <span class="kb-cap">' + esc(h.acara.cap) + '</span> ' +
      (A.mencetak ? '<span class="kb-cap">' + esc(t('siapCetak')) + '</span>' : A.unduh ? '<span class="kb-cap">' + esc(t(A.unduhPdf ? 'bikinPdf' : 'bikinPng')) + ' ' + A.unduh + '</span>' :
        htmlUkuran('kbPdfUk') + ' ' +
        '<button type="button" class="btn" data-kb="pdfVendor">' + esc(t('unduhPdf')) + '</button> <button type="button" class="btn dua" data-kb="cetakPaketLagi">' + esc(t('cetakA4Lagi')) + '</button> <button type="button" class="btn dua" data-kb="pngPaket">' + esc(t('unduhPng')) + '</button>' +
        '<small class="kb-pdf-ket">' + esc(t('ketPdf')) + '</small>') + '</div>' : '';
    return (A.pesan ? '<div class="tolak-alat" role="alert">' + esc(A.pesan) + '</div>' : '') + hasil + htmlEdisi(ac) +
      '<section class="kb-kotak"><h3>' + esc(t('paketJudul')) + (ac ? ' <span class="kb-cap">' + esc(ac.cap) + '</span>' : '') + '</h3><p class="ket-alat">' + esc(t('ketPaket')) + '</p>' +
      '<div class="kb-form4"><label>' + esc(t('pJumlah')) + '<input id="kbPJml" type="number" min="1" max="500" inputmode="numeric" value="' + esc(A.p.jumlah) + '" placeholder="0"><small>' + esc(t('maks')) + '</small></label>' +
      '<label>' + esc(t('pVKode')) + '<input id="kbPVKode" value="' + esc(A.p.kode) + '" autocomplete="off"></label>' +
      '<label>' + esc(t('pVSampai')) + '<input id="kbPVSampai" type="date" min="' + hariIniWib() + '" value="' + esc(A.p.sampai) + '"><small>' + esc(t('pVSampaiKet')) + '</small></label>' +
      '<label class="lebar">' + esc(t('pVTeks')) + '<input id="kbPVTeks" value="' + esc(A.p.teks) + '" placeholder="' + esc(t('pVTeksPh')) + '"></label></div></section>' +
      '<button type="button" class="btn" data-kb="buatPaket"' + (paketSiap() ? '' : ' disabled') + '>' + esc(t('buatPaket')) + '</button>' + htmlRiwayat();
  }
  function htmlUkuran(id) {
    var pilih = kunciUk(ukuranPdf()), cm = function (v) { return String(v / 10); };
    return '<label class="kb-pdf-uk">' + esc(t('ukKartu')) + ' <select id="' + id + '">' + UKURAN.map(function (u) { return '<option value="' + kunciUk(u) + '"' + (kunciUk(u) === pilih ? ' selected' : '') + '>' + cm(u.w) + ' × ' + cm(u.h) + ' cm (' + esc(teksIsi('ukMin', { n: u.min })) + ')</option>'; }).join('') + '</select></label>';
  }
  /* Kartu yang sudah dicetak (19 Okt 2026, Ferdy): daftar cetakan edisi aktif dari server, tiap cetakan bisa diunduh ulang
     sebagai PDF vendor atau PNG. Dimuat sekali tiap tab dibuka dan sesudah batch baru dibuat. */
  function jamWib(s) { var d = new Date(s); if (!s || isNaN(d)) return '–'; var w = new Date(d.getTime() + 7 * 3600e3).toISOString(); return tgl(w.slice(0, 10)) + ' ' + w.slice(11, 16); }
  function muatRiwayat() {
    A.riwayatMuat = true;
    panggil('daftarCetak', {}).then(function (r) {
      A.riwayatMuat = false; A.riwayat = (r && r.ok && r.cetakan) || []; A.riwayatCap = r && r.acara ? r.acara.cap : ''; A.riwayatPesan = r && !r.ok ? r.pesan || t('gagal') : '';
      if (A.tab === 'cetak') gambar();
    }, function (e) { A.riwayatMuat = false; A.riwayat = []; A.riwayatPesan = e.message; if (A.tab === 'cetak') gambar(); });
  }
  function sumberRiwayat(i) { var c = (A.riwayat || [])[Number(i)]; return c ? { kode: c.kode.map(function (k) { return { kode: k }; }), acara: { cap: A.riwayatCap || 'event' } } : null; }
  function htmlRiwayat() {
    var kepala = '<section class="kb-kotak" id="kbRiwayat"><h3>' + esc(t('rwJudul')) + (A.riwayatCap ? ' <span class="kb-cap">' + esc(A.riwayatCap) + '</span>' : '') + '</h3><p class="ket-alat">' + esc(t('rwKet')) + '</p>';
    if (A.riwayat == null) { if (!A.riwayatMuat) setTimeout(muatRiwayat, 0); return kepala + '<p class="ket-alat">' + esc(t('rwMuat')) + '</p></section>'; }
    if (A.riwayatPesan) return kepala + '<div class="tolak-alat">' + esc(A.riwayatPesan) + '</div></section>';
    var L = A.riwayat, sibuk = !!(A.unduh || A.mencetak);
    if (!L.length) return kepala + '<p class="ket-alat">' + esc(t('rwKosong')) + '</p></section>';
    var baris = L.map(function (c, i) {
      return '<tr data-cetakan="' + i + '"><td>' + esc(jamWib(c.dibuat)) + '</td><td><code>' + esc(c.voucher || '–') + '</code>' + (c.uji ? ' <span class="kb-rw-uji">' + esc(t('rwUji')) + '</span>' : '') + '</td>' +
        '<td class="num">' + nf(c.jumlah) + '</td><td class="num">' + nf(c.terpasang) + '</td><td class="num">' + nf(c.dibuka) + '</td>' +
        '<td class="kb-rw-aksi"><button type="button" class="btn" data-kb="pdfUlang" data-i="' + i + '"' + (sibuk ? ' disabled' : '') + '>' + esc(t('rwPdf')) + '</button> <button type="button" class="btn dua" data-kb="pngUlang" data-i="' + i + '"' + (sibuk ? ' disabled' : '') + '>PNG</button></td></tr>';
    }).join('');
    return kepala + '<div class="kb-rw-atur">' + htmlUkuran('kbPdfUk2') + (A.unduh ? ' <span class="kb-cap kb-rw-status">' + esc(t(A.unduhPdf ? 'bikinPdf' : 'bikinPng')) + ' ' + A.unduh + '</span>' : '') + '</div>' +
      '<div class="hpp-gulung"><table class="kb-rw-tabel"><thead><tr><th>' + esc(t('rwTgl')) + '</th><th>' + esc(t('rwVoucher')) + '</th><th class="num">' + esc(t('rwJml')) + '</th><th class="num">' + esc(t('v_pasang')) + '</th><th class="num">' + esc(t('rwBuka')) + '</th><th></th></tr></thead><tbody>' + baris + '</tbody></table></div></section>';
  }
  /* Kartu umum 14 x 6 cm: kiri logo, ajakan koleksi, enam foto karakter; kanan QR satu-satunya.
     Kode voucher TIDAK dicetak; pembeli melihatnya setelah memindai. */
  var FOTO_PAKET = ['koala', 'collie', 'redpanda', 'shiba', 'pekingese', 'panda'];
  function htmlKartuPaket(r) {
    return '<div class="kartu-kitab kk-paket" data-kode="' + esc(r.kode) + '">' +
      '<div class="kk-kiri"><img class="kk-p-logo" src="' + DASAR + 'img/logo-mofmo.png" alt=""><span class="kk-p-nama">Mofmofriends</span><span class="kk-p-ajak">Kumpulin kartunya, buka hadiahnya</span>' +
      '<div class="kk-p-foto">' + FOTO_PAKET.map(function (f) { return '<img src="' + DASAR + 'img/kartu/' + f + '.webp" alt="">'; }).join('') + '</div>' +
      '<div class="kk-pita"><span class="kk-nama">' + KARTU.length + ' KARTU · MOFMO COLLECTION</span></div></div>' +
      '<div class="kk-kanan"><div class="kk-p-judul">SCAN SETELAH PAKET SAMPAI</div><div class="kk-qr">' + qrSvg(SITUS + r.kode) + '</div>' +
      '<div class="kk-teks"><span class="kk-ajak"><b>ISI PAKET MASUK BUKU</b>Jadi kartu koleksimu</span><span class="kk-ajak"><b>VOUCHER SHOPEE</b>Langsung muncul, tinggal salin</span><span class="kk-kode">' + esc(kodeTampil(r.kode)) + '</span></div>' +
      '<div class="kk-bawah vou"><b>ADA VOUCHER DI DALAM</b><span>atau ketik kodenya di mofmofriends.id</span></div></div></div>';
  }
  /* Kartu QR edisi (22 Okt 2026, Ferdy: "qr yg 50pcs ini edisi 11.11 udh lsg konek ke buku, dan ke voucher shopee").
     Vendor cuma bisa mencetak satu desain, jadi semua kartu paket edisi ini membawa QR yang sama (kode_qr edisi di
     server). Pembeli membukanya pakai No Pesanan Shopee; server memasang satu kode kartu paket dari jatah edisi ke
     pesanan itu. Tanpa kode kartu dan tanpa kode voucher di kartu. */
  function htmlKartuEdisi(e) {
    var cap = String((e && e.cap) || '');
    return '<div class="kartu-kitab kk-paket kk-edisi">' +
      '<div class="kk-kiri"><img class="kk-p-logo" src="' + DASAR + 'img/logo-mofmo.png" alt=""><span class="kk-p-nama">Mofmofriends</span><span class="kk-p-ajak">Lengkapi kartunya, klaim vouchernya</span>' +
      '<div class="kk-p-foto">' + FOTO_PAKET.map(function (f) { return '<img src="' + DASAR + 'img/kartu/' + f + '.webp" alt="">'; }).join('') + '</div>' +
      '<div class="kk-pita"><span class="kk-nama">EDISI ' + esc(cap) + ' · MOFMO COLLECTION</span></div></div>' +
      '<div class="kk-kanan"><div class="kk-p-judul">SCAN SETELAH PAKET SAMPAI</div><div class="kk-qr">' + qrSvg(SITUS + e.kode) + '</div>' +
      '<div class="kk-teks"><span class="kk-ajak"><b>1. SCAN QR</b>Buka bukumu</span><span class="kk-ajak"><b>2. NO PESANAN</b>Salin dari Shopee</span><span class="kk-ajak"><b>3. BUKA HADIAH</b>Kartu + voucher</span></div>' +
      '<div class="kk-bawah vou"><b>ADA VOUCHER DI DALAM</b><span>1 pesanan = 1 kali buka</span></div></div></div>';
  }
  function muatEdisi() {
    A.edMuat = true; A.edPesan = ''; gambar();
    panggil('kodeQrEdisi', {}).then(function (r) {
      A.edMuat = false;
      if (!r || !r.ok) { A.edPesan = (r && r.pesan) || t('gagal'); gambar(); return; }
      A.edisi = { kode: r.kode, url: r.url, cap: (r.acara && r.acara.cap) || 'event', jatah: r.jatah || { dipakai: 0, total: 0 }, pratinjau: null };
      gambar();
      var e = A.edisi;
      cssKartu().then(function (css) { return kartuKePng(htmlKartuEdisi(e), css); }).then(function (png) {
        if (A.edisi !== e) return;
        e.pratinjau = URL.createObjectURL(new Blob([png], { type: 'image/png' })); if (A.tab === 'cetak') gambar();
      }, function (x) { A.edPesan = t('gagalPng') + (x && x.message || x); gambar(); });
    }, function (x) { A.edMuat = false; A.edPesan = x.message; gambar(); });
  }
  function htmlEdisi(ac) {
    if (!ac) return '';
    var e = A.edisi, sibuk = !!(A.unduh || A.mencetak);
    var kepala = '<section class="kb-kotak" id="kbEdisi"><h3>' + esc(t('edJudul')) + ' <span class="kb-cap">' + esc(ac.cap) + '</span></h3><p class="ket-alat">' + esc(t('edKet')) + '</p>';
    if (A.edPesan) kepala += '<div class="tolak-alat" role="alert">' + esc(A.edPesan) + '</div>';
    if (!e) return kepala + (A.edMuat ? '<p class="ket-alat">' + esc(t('edMuat')) + '</p>' : '<button type="button" class="btn" data-kb="edisiSiap">' + esc(t('edSiap')) + '</button>') + '</section>';
    var j = e.jatah || { dipakai: 0, total: 0 };
    return kepala + '<div class="kb-ed-pratinjau">' + (e.pratinjau ? '<img src="' + e.pratinjau + '" alt="">' : '<p class="ket-alat">' + esc(t('edMuat')) + '</p>') + '</div>' +
      '<p class="ket-alat">' + esc(t('edAlamat')) + ': <code>' + esc(e.url) + '</code> · <b>' + esc(t('edJatah').replace('{a}', nf(j.dipakai)).replace('{n}', nf(j.total))) + '</b></p>' +
      (j.total ? '' : '<div class="tolak-alat">' + esc(t('edTanpaJatah')) + '</div>') +
      '<div class="kb-rw-atur">' + htmlUkuran('kbPdfUkEd') + ' <button type="button" class="btn" data-kb="pdfEdisi"' + (sibuk ? ' disabled' : '') + '>' + esc(t('edPdf')) + '</button> <button type="button" class="btn dua" data-kb="pngEdisi"' + (sibuk ? ' disabled' : '') + '>' + esc(t('edPng')) + '</button>' +
      (A.unduh ? ' <span class="kb-cap kb-ed-status">' + esc(t(A.unduhPdf ? 'bikinPdf' : 'bikinPng')) + ' ' + A.unduh + '</span>' : '') + '</div><small class="kb-pdf-ket">' + esc(t('ketPdf')) + '</small></section>';
  }
  function pdfEdisi() {
    var e = A.edisi; if (!e) return;
    return pdfVendor({ kode: [e], acara: { cap: e.cap } }, { buat: htmlKartuEdisi, nama: function (cap, n, uk) { return 'kartu-edisi-' + cap.replace(/[^A-Za-z0-9.]+/g, '-') + '-vendor-A4-' + uk.w + 'x' + uk.h + '.pdf'; },
      kaki: function (cap) { return 'Kartu QR edisi ' + cap + ' · 1 desain, cetak sebanyak jumlah paket'; } });
  }
  function pngEdisi() {
    var e = A.edisi; if (!e || A.unduh || A.mencetak) return;
    A.unduh = '0/1'; A.unduhPdf = false; A.pesan = ''; gambar();
    return cssKartu().then(function (css) { return kartuKePng(htmlKartuEdisi(e), css); }).then(function (png) {
      var a = document.createElement('a'), u = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
      a.href = u; a.download = 'kartu-edisi-' + String(e.cap).replace(/[^A-Za-z0-9.]+/g, '-') + '.png';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
      A.unduh = null; gambar();
    }, function (x) { A.unduh = null; A.pesan = t('gagalPng') + (x && x.message || x); gambar(); });
  }
  function siapCetak(d) {
    var gb = Array.prototype.map.call(d.querySelectorAll('img'), function (im) { return im.complete && im.naturalWidth ? Promise.resolve() : new Promise(function (ok) { im.addEventListener('load', ok); im.addEventListener('error', ok); }); });
    var hr = document.fonts && document.fonts.load ? ["900 9pt 'KK Cinzel Deco'", "700 9pt 'KK Cinzel'", "900 9pt 'KK Cinzel'", "600 9pt 'KK Cormorant'", "700 9pt 'KK Cormorant'", "italic 700 9pt 'KK Cormorant'"].map(function (f) { return document.fonts.load(f).catch(function () {}); }) : [];
    return Promise.all(gb.concat(hr));
  }
  /* Lembar A4 untuk printer kantor: 4 kartu per halaman (aturan #lembarKitab di app.css). */
  function cetakA4() {
    var h = A.hasilPaket; if (!h || A.mencetak || A.unduh) return;
    A.mencetak = true; A.pesan = ''; gambar();
    var lama = el('lembarKitab'); if (lama) lama.remove();
    var d = document.createElement('div'); d.id = 'lembarKitab';
    d.innerHTML = h.kode.map(htmlKartuPaket).join('');
    document.body.appendChild(d);
    return siapCetak(d).then(function () {
      var bersih = function () { W.removeEventListener('afterprint', bersih); document.body.classList.remove('cetak-kitab'); var x = el('lembarKitab'); if (x) x.remove(); A.mencetak = false; gambar(); };
      W.addEventListener('afterprint', bersih);
      document.body.classList.add('cetak-kitab');
      W.print();
    });
  }
  function buatPaket() {
    if (!paketSiap()) return;
    A.sibuk = true; A.pesan = ''; gambar();
    panggil('cetakPaket', { jumlah: Number(A.p.jumlah), voucherKode: String(A.p.kode).trim(), voucherTeks: A.p.teks, voucherSampai: A.p.sampai }).then(function (r) {
      A.sibuk = false;
      if (!r.ok) { A.pesan = r.pesan; bunyi('scanTolak'); gambar(); return; }
      A.hasilPaket = r; A.riwayat = null; A.p = { jumlah: '', kode: '', teks: '', sampai: '' }; bunyi('scanOk'); gambar(); cetakA4();
    }, function (e) { A.sibuk = false; A.pesan = e.message; gambar(); });
  }
  function pngPaket(sumber) {
    var h = sumber || A.hasilPaket; if (!h || A.unduh || A.mencetak) return;
    return unduhPng(h.kode, htmlKartuPaket, function (i, r) { return String(i + 1).padStart(3, '0') + '_paket_' + r.kode + '.png'; }, 'kartu-paket-' + String(h.acara.cap || 'event').replace(/[^A-Za-z0-9.]+/g, '-') + '-' + h.kode.length + '.zip');
  }
  /* PNG cadangan (dulu untuk vendor cetak, Ferdy 15 Okt malam: "cetaknya bisa png high reso (cuma png)... vendor yg
     print bukan gua"). Tiap kartu digambar dari HTML dan CSS kartu yang sama ke kanvas 300 dpi
     (140 x 60 mm = 1654 x 709 px) lewat SVG foreignObject. Foto dan huruf ditanam sebagai data URL
     dulu, karena gambar SVG tidak boleh memuat berkas luar dan kanvas jadi tidak bisa diekspor.
     Satu ZIP (JSZip dari vendor/pptxgen.bundle.js), berkas urut per produk, nama memuat kode. */
  var MM = 96 / 25.4, DPI = 300, PNG_W = Math.round(140 * DPI / 25.4), PNG_H = Math.round(60 * DPI / 25.4);
  function muatZip() {
    if (W.JSZip) return Promise.resolve(W.JSZip);
    return new Promise(function (ok, gagal) {
      var s = document.createElement('script'); s.src = DASAR + 'vendor/pptxgen.bundle.js'; s.async = true;
      s.onload = function () { if (W.JSZip) ok(W.JSZip); else gagal(new Error('JSZip')); };
      s.onerror = function () { gagal(new Error('vendor/pptxgen.bundle.js')); };
      document.head.appendChild(s);
    });
  }
  var DATA_URL = {};
  function keDataUrl(url) {
    if (!DATA_URL[url]) DATA_URL[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, gagal) { var f = new FileReader(); f.onload = function () { ok(f.result); }; f.onerror = function () { gagal(new Error(url)); }; f.readAsDataURL(b); });
    });
    return DATA_URL[url];
  }
  var CSS_KARTU = null;
  function cssKartu() {
    if (CSS_KARTU) return CSS_KARTU;
    var aturan = [], huruf = [];
    Array.prototype.forEach.call(document.styleSheets, function (sh) {
      var rs; try { rs = sh.cssRules; } catch (e) { return; }
      Array.prototype.forEach.call(rs || [], function (r) {
        if (r.type === 5 && /KK /.test(r.cssText)) huruf.push(r);
        else if (r.type === 1 && /#lembarKitab \.(kartu-kitab|kk-)/.test(r.selectorText || '')) aturan.push(r.cssText.replace(/#lembarKitab /g, ''));
      });
    });
    CSS_KARTU = Promise.all(huruf.map(function (r) {
      var m = /url\("?([^")]+)"?\)/.exec(r.cssText); if (!m) return '';
      var abs = new URL(m[1], (r.parentStyleSheet && r.parentStyleSheet.href) || location.href).href;
      return keDataUrl(abs).then(function (d) { return r.cssText.replace(m[0], 'url("' + d + '")'); }, function () { return ''; });
    })).then(function (ff) { return ff.join('\n') + '\n' + aturan.join('\n') + '\n.kartu-kitab{margin:0 !important}'; });
    return CSS_KARTU;
  }
  /* CRC32 dan potongan pHYs supaya PNG tercatat 300 dpi (vendor membaca ukuran cetak dari sini). */
  var TABEL_CRC = null;
  function crc32(b) {
    if (!TABEL_CRC) { TABEL_CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABEL_CRC[n] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) x = TABEL_CRC[(x ^ b[i]) & 255] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function pasangDpi(buf) {
    var a = new Uint8Array(buf), ppm = Math.round(DPI / 0.0254), c = new Uint8Array(21), v = new DataView(c.buffer);
    v.setUint32(0, 9); c.set([112, 72, 89, 115], 4); v.setUint32(8, ppm); v.setUint32(12, ppm); c[16] = 1;
    v.setUint32(17, crc32(c.subarray(4, 17)));
    var o = new Uint8Array(a.length + 21); o.set(a.subarray(0, 33)); o.set(c, 33); o.set(a.subarray(33), 54); return o;
  }
  function kartuKePng(html, css, ukuran) {
    var mmW = (ukuran && ukuran.w) || 140, mmH = (ukuran && ukuran.h) || 60, sk = (ukuran && ukuran.skala) || 1, pw = Math.round(mmW * sk * DPI / 25.4), ph = Math.round(mmH * sk * DPI / 25.4);
    var wadah = document.createElement('div'); wadah.innerHTML = html;
    var imgs = Array.prototype.slice.call(wadah.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) { return keDataUrl(new URL(im.getAttribute('src'), location.href).href).then(function (d) { im.setAttribute('src', d); }, function () { im.remove(); }); })).then(function () {
      var w = mmW * MM, h = mmH * MM, isi = new XMLSerializer().serializeToString(wadah.firstChild);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + pw + '" height="' + ph + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
        '<div xmlns="http://www.w3.org/1999/xhtml"><style>' + css.replace(/<\/style/gi, '') + '</style>' + isi + '</div></foreignObject></svg>';
      return new Promise(function (ok, gagal) {
        var gb = new Image();
        gb.onload = function () {
          /* gambar dua kali: huruf data URL di dalam SVG kadang baru siap sesudah gambar pertama */
          var kv = document.createElement('canvas'); kv.width = pw; kv.height = ph; var cx = kv.getContext('2d');
          cx.drawImage(gb, 0, 0, pw, ph);
          setTimeout(function () {
            cx.clearRect(0, 0, pw, ph); cx.drawImage(gb, 0, 0, pw, ph);
            kv.toBlob(function (b) { if (!b) return gagal(new Error('toBlob')); b.arrayBuffer().then(function (ab) { ok(pasangDpi(ab)); }, gagal); }, 'image/png');
          }, 60);
        };
        gb.onerror = function () { gagal(new Error('SVG kartu')); };
        gb.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    });
  }
  function unduhPng(urut, buat, nama, berkasZip) {
    var zip, css, i = 0;
    A.unduh = '0/' + urut.length; A.pesan = ''; gambar();
    return Promise.all([muatZip(), cssKartu()]).then(function (x) { zip = new x[0](); css = x[1]; }).then(function lanjut() {
      if (i >= urut.length) return zip.generateAsync({ type: 'blob' });
      var r = urut[i];
      return kartuKePng(buat(r), css).then(function (png) {
        zip.file(nama(i, r), png); i++; A.unduh = i + '/' + urut.length;
        Array.prototype.forEach.call(document.querySelectorAll('#kbIsi .kb-hasil .kb-cap:last-child, #kbRiwayat .kb-rw-status'), function (el) { el.textContent = t('bikinPng') + ' ' + A.unduh; });
        return lanjut();
      });
    }).then(function (blob) {
      var a = document.createElement('a'), u = URL.createObjectURL(blob);
      a.href = u; a.download = berkasZip;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
      A.unduh = null; gambar();
    }, function (e) { A.unduh = null; A.pesan = t('gagalPng') + (e && e.message || e); gambar(); });
  }

  /* PDF untuk percetakan (19 Okt 2026, Ferdy: kartu dicetak vendor minggu ini, desain pilihan A tanpa bingkai tepi, A4).
     Tiap kartu 140 x 60 mm digambar dengan bleed 3 mm (146 x 66 mm, latar krem dan hijau diteruskan), 4 per halaman A4,
     tanda potong hitam di luar bleed, nomor halaman di kaki. Halaman digambar ke kanvas 300 dpi lalu ditulis sendiri
     sebagai PDF berisi gambar JPEG, tanpa pustaka luar. */
  /* 19 Okt sore, Ferdy: ukuran kartu bisa dipilih. Bentuk tetap 7:3, jadi desain 140 x 60 cukup diperbesar atau diperkecil;
     bleed di desain dibagi skala supaya di kertas tetap 3 mm. Satu kolom per halaman, baris sebanyak yang muat. */
  var A4_W = 210, A4_H = 297, BL = 3, KY = 10.5, JARAK_BARIS = 4;
  /* 21 Okt, Ferdy: vendor cuma punya ukuran ini (cm, minimal pesanan). Bentuknya tidak 7:3, jadi desain 140 x 60 dipasang
     dengan skala yang pas (tidak ditarik, QR tetap persegi), di tengah, dan sisa ruang sampai garis potong diisi latar kartu. */
  var UKURAN = [{ w: 150, h: 70, min: 12 }, { w: 150, h: 50, min: 18 }, { w: 120, h: 60, min: 14 }, { w: 100, h: 50, min: 24 },
    { w: 125, h: 60, min: 14 }, { w: 130, h: 80, min: 9 }, { w: 80, h: 60, min: 25 }];
  function kunciUk(u) { return u.w + 'x' + u.h; }
  function ukuranPdf() { var k = String(A.ukuranPdf || ''); return UKURAN.filter(function (u) { return kunciUk(u) === k; })[0] || UKURAN[0]; }
  function skalaUk(uk) { return Math.min(uk.w / 140, uk.h / 60); }
  function perHalaman(uk) { return Math.max(1, Math.floor((A4_H - 2 * KY + JARAK_BARIS) / (uk.h + 2 * BL + JARAK_BARIS))); }
  /* Satuan di sini satuan desain (kartu 140 x 60); di kertas dikali f. Kotak = ukuran vendor + bleed 3 mm tiap sisi. */
  function htmlBleed(r, uk, buat) {
    var f = skalaUk(uk), mm = function (v) { return v.toFixed(3) + 'mm'; };
    var W = (uk.w + 2 * BL) / f, H = (uk.h + 2 * BL) / f, x = (W - 140) / 2, y = (H - 60) / 2;
    return '<div class="kk-bleed" style="width:' + mm(W) + ';height:' + mm(H) + '"><div class="kk-bl-kiri" style="width:' + mm(W / 2) + ';height:' + mm(H) + '"></div>' +
      '<div class="kk-bl-kanan" style="left:' + mm(W / 2) + ';width:' + mm(W / 2) + ';height:' + mm(H) + ';border-left-width:' + mm(0.5 / f) + '"></div>' +
      (buat || htmlKartuPaket)(r).replace('<div class="kartu-kitab kk-paket', '<div style="left:' + mm(x) + ';top:' + mm(y) + '" class="kartu-kitab kk-paket') + '</div>';
  }
  function gambarHalaman(gb, iHal, nHal, mulai, total, cap, uk, kaki) {
    var s = DPI / 25.4, kv = document.createElement('canvas'); kv.width = Math.round(A4_W * s); kv.height = Math.round(A4_H * s);
    var KW = uk.w, KH = uk.h, KX = (A4_W - (KW + 2 * BL)) / 2, KJ = KH + 2 * BL + JARAK_BARIS;
    var cx = kv.getContext('2d'), t0 = 0.25 * s, P = 8, J = 2;
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, kv.width, kv.height);
    gb.forEach(function (g, i) { cx.drawImage(g, KX * s, (KY + i * KJ) * s, (KW + 2 * BL) * s, (KH + 2 * BL) * s); });
    cx.fillStyle = '#000';
    gb.forEach(function (g, i) {
      [KY + i * KJ + BL, KY + i * KJ + BL + KH].forEach(function (y) {
        cx.fillRect((KX - J - P) * s, y * s - t0 / 2, P * s, t0); cx.fillRect((KX + KW + 2 * BL + J) * s, y * s - t0 / 2, P * s, t0);
      });
    });
    var akhir = KY + (gb.length - 1) * KJ + KH + 2 * BL;
    [KX + BL, KX + BL + KW].forEach(function (x) { cx.fillRect(x * s - t0 / 2, (KY - J - 6) * s, t0, 6 * s); cx.fillRect(x * s - t0 / 2, (akhir + J) * s, t0, 6 * s); });
    cx.fillStyle = '#444'; cx.textAlign = 'center'; cx.font = Math.round(2.4 * s) + 'px Arial, Helvetica, sans-serif';
    cx.fillText('Mofmofriends · ' + (kaki || ('Kartu QR paket ' + cap)) + ' · ' + KW + ' × ' + KH + ' mm + bleed 3 mm', kv.width / 2, (A4_H - 6.6) * s);
    if (!kaki) cx.fillText('Halaman ' + iHal + ' dari ' + nHal + ' · kartu ' + mulai + ' sampai ' + (mulai + gb.length - 1) + ' dari ' + total, kv.width / 2, (A4_H - 3.4) * s);
    return new Promise(function (ok, gagal) {
      kv.toBlob(function (b) { if (!b) return gagal(new Error('toBlob')); b.arrayBuffer().then(function (ab) { ok({ jpeg: new Uint8Array(ab), w: kv.width, h: kv.height }); }, gagal); }, 'image/jpeg', 0.92);
    });
  }
  function tulisPdf(hal) {
    var enc = new TextEncoder(), bagian = [], pos = 0, off = [], n = hal.length, kids = [];
    var tulis = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; bagian.push(b); pos += b.length; };
    var obj = function (no, isi) { off[no] = pos; tulis(no + ' 0 obj\n'); isi(); tulis('\nendobj\n'); };
    var PW = (A4_W / 25.4 * 72).toFixed(3), PH = (A4_H / 25.4 * 72).toFixed(3);
    for (var i = 0; i < n; i++) kids.push((3 + i * 3) + ' 0 R');
    tulis('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
    obj(1, function () { tulis('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { tulis('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
    hal.forEach(function (h, k) {
      var p = 3 + k * 3, isi = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q';
      obj(p, function () { tulis('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + (p + 1) + ' 0 R >> >> /Contents ' + (p + 2) + ' 0 R >>'); });
      obj(p + 1, function () { tulis('<< /Type /XObject /Subtype /Image /Width ' + h.w + ' /Height ' + h.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + h.jpeg.length + ' >>\nstream\n'); tulis(h.jpeg); tulis('\nendstream'); });
      obj(p + 2, function () { tulis('<< /Length ' + isi.length + ' >>\nstream\n' + isi + '\nendstream'); });
    });
    var xref = pos, jml = 3 + n * 3;
    tulis('xref\n0 ' + jml + '\n0000000000 65535 f \n');
    for (var j = 1; j < jml; j++) tulis(String(off[j]).padStart(10, '0') + ' 00000 n \n');
    tulis('trailer\n<< /Size ' + jml + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(bagian, { type: 'application/pdf' });
  }
  /* opsi (kartu edisi, 22 Okt): buat = penggambar kartu, nama = nama berkas, kaki = teks kaki halaman */
  function pdfVendor(sumber, opsi) {
    var h = sumber || A.hasilPaket; if (!h || A.unduh || A.mencetak) return;
    opsi = opsi || {};
    var urut = h.kode, css, i = 0, isi = [], hal = [], uk = ukuranPdf(), f = skalaUk(uk), per = perHalaman(uk), nHal = Math.ceil(urut.length / per), cap = String(h.acara.cap || 'event');
    A.unduh = '0/' + urut.length; A.unduhPdf = true; A.pesan = ''; gambar();
    var tampil = function () { Array.prototype.forEach.call(document.querySelectorAll('#kbIsi .kb-hasil .kb-cap:last-child, #kbRiwayat .kb-rw-status, #kbEdisi .kb-ed-status'), function (e) { e.textContent = t('bikinPdf') + ' ' + A.unduh; }); };
    return cssKartu().then(function (x) { css = x; }).then(function lanjut() {
      if (i >= urut.length) return;
      return kartuKePng(htmlBleed(urut[i], uk, opsi.buat), css, { w: (uk.w + 2 * BL) / f, h: (uk.h + 2 * BL) / f, skala: f }).then(function (png) { return createImageBitmap(new Blob([png], { type: 'image/png' })); }).then(function (g) {
        isi.push(g); i++; A.unduh = i + '/' + urut.length; tampil();
        if (isi.length === per || i === urut.length) {
          var mulai = hal.length * per + 1;
          return gambarHalaman(isi, hal.length + 1, nHal, mulai, urut.length, cap, uk, opsi.kaki && opsi.kaki(cap)).then(function (pg) { hal.push(pg); isi.forEach(function (b) { if (b.close) b.close(); }); isi = []; return lanjut(); });
        }
        return lanjut();
      });
    }).then(function () {
      var blob = tulisPdf(hal), a = document.createElement('a'), u = URL.createObjectURL(blob);
      a.href = u; a.download = opsi.nama ? opsi.nama(cap, urut.length, uk) : 'kartu-paket-' + cap.replace(/[^A-Za-z0-9.]+/g, '-') + '-' + urut.length + '-vendor-A4-' + uk.w + 'x' + uk.h + '.pdf';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
      A.unduh = null; A.unduhPdf = false; gambar();
    }, function (e) { A.unduh = null; A.unduhPdf = false; A.pesan = t('gagalPdf') + (e && e.message || e); gambar(); });
  }

  /* ---------- pasang kartu ke pesanan (tahap 2, 16 Okt 2026) ----------
     Ferdy: "dua-duanya". Kerja harian lewat kolom Kode Kartu QR di Excel gudang (lapshopee.js);
     tab ini cadangan dan tempat membetulkan salah pasang. Dipakai dengan scanner: scanner mengetik
     isi QR (https://mofmofriends.id/#k=KODE) lalu Enter. Server yang membaca kodenya (kodeDariScan)
     dan memutus aturan satu kartu satu pesanan (SQL kitab_pasang). ganti cuma dikirim lewat tombol
     yang menyebut pesanan atau kartu yang bentrok, jadi tidak pernah terjadi tanpa sengaja. */
  function fokusPs() { setTimeout(function () { var i = el('kbPsPesanan'); if (i && A.tab === 'pasang') i.focus(); }, 0); }
  function kalimatPs(h) {
    /* lama = pesanan lain (lain) atau kartu lain (penuh, terbuka); sesudah ganti, lamaKartu menandai yang mana */
    var k = kodeTampil(h.kode || ''), p = h.pesanan || '', l = h.lama ? (h.status === 'penuh' || h.status === 'terbuka' ? kodeTampil(h.lama) : h.lama) : '';
    if (h.status === 'ok') return t('ps_ok')(k, p) + (h.lama ? t('ps_pindah')(h.lamaKartu ? kodeTampil(h.lama) : h.lama) : '');
    if (h.status === 'sudah') return t('ps_sudah')(k, p);
    if (h.status === 'lain') return t('ps_lain')(k, l);
    if (h.status === 'penuh') return t('ps_penuh')(p, l);
    if (h.status === 'terbuka') return t('ps_terbuka')(l);
    if (h.status === 'cek') return h.jenis === 'kartu' ? t('ps_cekLama') : t('ps_cek')(k, h.pesanan) + (h.dibuka ? t('ps_cekBuka') : '');
    return t('ps_' + h.status) || t('gagal');
  }
  function htmlPasang() {
    var ps = A.ps, h = ps.hasil, baik = h && (h.status === 'ok' || h.status === 'sudah' || h.status === 'cek');
    var tombolGanti = h && (h.status === 'lain' || h.status === 'penuh') ? '<button type="button" class="btn" data-kb="pasangGanti">' + esc(t(h.status === 'lain' ? 'psPindah' : 'psGanti')) + '</button>' : '';
    var hasil = h ? '<div id="kbPsHasil" class="' + (baik ? 'kb-hasil' : 'tolak-alat kb-ps-tolak') + '" role="' + (baik ? 'status' : 'alert') + '" data-ps-status="' + esc(h.status) + '"><span>' + esc(kalimatPs(h)) + '</span>' + tombolGanti + '</div>' : '';
    var log = ps.log.length ? '<ol class="kb-ps-log" id="kbPsLog">' + ps.log.map(function (x) { return '<li><b>' + esc(x.pesanan) + '</b><span>' + esc(kodeTampil(x.kode)) + '</span><small>' + esc(x.jam) + '</small></li>'; }).join('') + '</ol>' : '<p class="ket-alat" id="kbPsLog">' + esc(t('psKosong')) + '</p>';
    return (A.pesan ? '<div class="tolak-alat" role="alert">' + esc(A.pesan) + '</div>' : '') +
      '<section class="kb-kotak"><h3>' + esc(t('psJudul')) + '</h3><p class="ket-alat">' + esc(t('psKet')) + '</p>' +
      '<div class="kb-ps"><label>' + esc(t('psPesanan')) + '<span class="kb-ps-isi"><input id="kbPsPesanan" value="' + esc(ps.pesanan) + '" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next">' +
        (bisaVideo() && adaDetektor() ? tombolKamera('kamPesanan') : '') + '</span></label>' +
      '<label>' + esc(t('psKartu')) + '<span class="kb-ps-isi"><input id="kbPsKartu" value="' + esc(ps.kartu) + '" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done">' +
        (bisaVideo() ? tombolKamera('kamKartu') : '') + '</span></label>' +
      '<button type="button" class="btn" data-kb="pasang"' + (ps.sibuk ? ' disabled aria-busy="true"' : '') + '>' + esc(t('psTombol')) + '</button></div><div id="kbPsKamera" aria-live="polite">' + (A.kam.gagal ? '<p class="tolak-alat">' + esc(t('kamGagal')) + '</p>' : '') + '</div>' + hasil + '</section>' +
      '<section class="kb-kotak"><h3>' + esc(t('psLog')) + '</h3>' + log + '</section>' + htmlHapusUji() + htmlHapusSemua();
  }
  /* ---------- hapus data uji (18 Okt 2026, Ferdy: tes cetak kartu QR lalu bersihkan) ----------
     Periksa dulu (server menghitung kartu dan buku yang ikut hilang), centang konfirmasi, baru hapus.
     Kalau kode diubah sesudah Periksa, rencananya dibuang supaya yang dihapus selalu yang tadi dilihat. */
  /* Hapus semua kartu edisi aktif, mode tes (19 Okt 2026, Ferdy). Server menolak sesudah edisi mulai, tanpa centang dan
     ketik HAPUS SEMUA, atau kalau jumlah kartu berubah sejak diperiksa; tombol di sini cuma lapis pertama. */
  function siapHs() { var hs = A.hs, r = hs.rencana; return !!(r && r.boleh && r.kartu && hs.yakin && String(hs.ketik || '').trim().toUpperCase() === 'HAPUS SEMUA' && !hs.sibuk); }
  function htmlHapusSemua() {
    var hs = A.hs, r = hs.rencana, isi = '';
    if (r) {
      var cap = (r.acara && r.acara.cap) || '';
      if (!r.boleh) isi = '<div class="tolak-alat">' + esc(t('hsTutup').replace('{e}', cap)) + '</div>';
      else if (!r.kartu) isi = '<p class="ket-alat">' + esc(t('hsKosong')) + '</p>';
      else {
        var hapusBuku = (r.buku || []).filter(function (b) { return b.hapus; }), tetap = (r.buku || []).filter(function (b) { return !b.hapus; });
        isi = '<div class="kb-hs-angka" id="kbHsAngka" role="alert">' + esc(t('hsAngka').replace('{n}', nf(r.kartu)).replace('{e}', cap).replace('{p}', nf(r.terpasang)).replace('{d}', nf(r.dibuka))) + '</div>' +
          (hapusBuku.length ? '<p class="ket-alat">' + esc(t('huBuku').replace('{d}', hapusBuku.map(function (b) { return b.nama; }).join(', '))) + '</p>' : '') +
          (tetap.length ? '<p class="ket-alat">' + esc(t('huBukuTetap').replace('{d}', tetap.map(function (b) { return b.nama; }).join(', '))) + '</p>' : '') +
          '<label class="kb-hu-yakin"><input type="checkbox" id="kbHsYakin"' + (hs.yakin ? ' checked' : '') + '> ' + esc(t('huYakin')) + '</label>' +
          '<label class="kb-hu-label">' + esc(t('hsKetik')) + '<input type="text" id="kbHsKetik" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(hs.ketik) + '"></label>' +
          '<button type="button" class="btn kb-hu-hapus" data-kb="hsHapus"' + (siapHs() ? '' : ' disabled') + '>' + esc(t('hsHapus').replace('{n}', nf(r.kartu))) + '</button>';
      }
    }
    return '<section class="kb-kotak" id="kbHs"><h3>' + esc(t('hsJudul')) + '</h3><p class="ket-alat">' + esc(t('hsKet')) + '</p>' +
      (hs.hasil ? '<div class="kb-hasil" role="status">' + esc(t('hsHasil').replace('{k}', nf(hs.hasil.kartu)).replace('{b}', nf(hs.hasil.buku))) + '</div>' : '') +
      '<button type="button" class="btn dua" data-kb="hsCek"' + (hs.sibuk ? ' disabled' : '') + '>' + esc(t('hsCek')) + '</button><div id="kbHsRencana">' + isi + '</div></section>';
  }
  function cekSemua() {
    var hs = A.hs; hs.sibuk = true; hs.hasil = null; A.pesan = '';
    panggil('cekSemua', {}).then(function (r) {
      hs.sibuk = false;
      if (!r || !r.ok) { A.pesan = (r && r.pesan) || t('gagal'); hs.rencana = null; gambar(); return; }
      hs.rencana = r; hs.yakin = false; hs.ketik = ''; gambar();
    }, function (e) { hs.sibuk = false; A.pesan = e.message; gambar(); });
  }
  function hapusSemua() {
    var hs = A.hs; if (!siapHs()) return;
    hs.sibuk = true; A.pesan = '';
    panggil('hapusSemua', { yakin: true, ketik: hs.ketik, jumlah: hs.rencana.kartu }).then(function (r) {
      hs.sibuk = false;
      if (!r || !r.ok) { A.pesan = (r && r.pesan) || t('gagal'); hs.rencana = null; gambar(); return; }
      bunyi('scanOk'); hs.hasil = r; hs.rencana = null; hs.yakin = false; hs.ketik = ''; gambar();
    }, function (e) { hs.sibuk = false; A.pesan = e.message; gambar(); });
  }
  function htmlHapusUji() {
    var hu = A.hu, r = hu.rencana, isi = '';
    if (r) {
      var kartu = r.kartu || [], hapusBuku = (r.buku || []).filter(function (b) { return b.hapus; }), tetap = (r.buku || []).filter(function (b) { return !b.hapus; });
      isi = '<h3 class="kb-hu-sub">' + esc(t('huDaftar')) + '</h3>' + (kartu.length ? '<ul class="kb-ps-log" id="kbHuDaftar">' + kartu.map(function (k) {
        return '<li><b>' + esc(kodeTampil(k.kode)) + '</b><span>' + esc(k.pesanan || t('huBelum')) + '</span><small>' + esc((k.buku ? t('huBuka').replace('{n}', k.buku) : t('huTutup')) + ' · ' + t('huVoucher').replace('{v}', k.voucher || '')) + '</small></li>';
      }).join('') + '</ul>' : '<p class="ket-alat">' + esc(t('huKosong')) + '</p>') +
        (r.dilewati || []).map(function (d) { return '<div class="tolak-alat kb-hu-lewat">' + esc(t('huLewat_' + d.alasan).replace('{k}', d.kode).replace('{v}', d.voucher || '')) + '</div>'; }).join('') +
        (hapusBuku.length ? '<p class="ket-alat">' + esc(t('huBuku').replace('{d}', hapusBuku.map(function (b) { return b.nama; }).join(', '))) + '</p>' : '') +
        (tetap.length ? '<p class="ket-alat">' + esc(t('huBukuTetap').replace('{d}', tetap.map(function (b) { return b.nama; }).join(', '))) + '</p>' : '') +
        (kartu.length ? '<label class="kb-hu-yakin"><input type="checkbox" id="kbHuYakin"' + (hu.yakin ? ' checked' : '') + '> ' + esc(t('huYakin')) + '</label>' +
          '<button type="button" class="btn kb-hu-hapus" data-kb="huHapus"' + (hu.yakin && !hu.sibuk ? '' : ' disabled') + '>' + esc(t('huHapus').replace('{n}', kartu.length)) + '</button>' : '');
    }
    return '<section class="kb-kotak" id="kbHu"><h3>' + esc(t('huJudul')) + '</h3><p class="ket-alat">' + esc(t('huKet')) + '</p>' +
      (hu.hasil ? '<div class="kb-hasil" role="status">' + esc(t('huHasil').replace('{k}', hu.hasil.kartu).replace('{b}', hu.hasil.buku)) + '</div>' : '') +
      '<label class="kb-hu-label">' + esc(t('huKode')) + '<textarea id="kbHuKode" rows="4" spellcheck="false" autocapitalize="characters">' + esc(hu.teks) + '</textarea></label>' +
      '<button type="button" class="btn dua" data-kb="huCek"' + (hu.sibuk ? ' disabled' : '') + '>' + esc(t('huCek')) + '</button><div id="kbHuRencana">' + isi + '</div></section>';
  }
  var barisUji = function (s) { return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); };
  function cekUji() {
    var hu = A.hu; if (!barisUji(hu.teks).length) return;
    hu.sibuk = true; hu.hasil = null; A.pesan = '';
    panggil('cekUji', { kode: barisUji(hu.teks) }).then(function (r) {
      hu.sibuk = false;
      if (!r || !r.ok) { A.pesan = (r && r.pesan) || t('gagal'); hu.rencana = null; gambar(); return; }
      hu.rencana = r; hu.teksRencana = hu.teks; hu.yakin = false; gambar();
    }, function (e) { hu.sibuk = false; A.pesan = e.message; gambar(); });
  }
  function hapusUji() {
    var hu = A.hu; if (!hu.rencana || !hu.yakin || hu.teks !== hu.teksRencana) return;
    hu.sibuk = true; A.pesan = '';
    panggil('hapusUji', { kode: barisUji(hu.teksRencana), yakin: true }).then(function (r) {
      hu.sibuk = false;
      if (!r || !r.ok) { A.pesan = (r && r.pesan) || t('gagal'); gambar(); return; }
      bunyi('scanOk'); hu.hasil = r; hu.rencana = null; hu.teks = ''; hu.teksRencana = ''; hu.yakin = false; gambar();
    }, function (e) { hu.sibuk = false; A.pesan = e.message; gambar(); });
  }
  /* ---------- kamera HP (16 Okt 2026, Ferdy minta scan pakai kamera HP) ----------
     QR kartu dibaca BarcodeDetector kalau peramban punya (Chrome Android), kalau tidak jsQR
     (Safari iPhone), yang baru diunduh saat kamera pertama kali dipakai. No Pesanan di label berupa
     barcode garis, jadi kameranya cuma ditawarkan kalau BarcodeDetector ada. QR yang bukan kartu
     Mofmofriends diabaikan, kamera terus mencari. Sesudah No Pesanan terbaca, kamera kartu menyala
     sendiri. Kamera selalu dimatikan sampai track-nya berhenti (lampu kamera HP padam). */
  var IKON_KAMERA = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  function bisaVideo() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function adaDetektor() { return typeof W.BarcodeDetector === 'function'; }
  function tombolKamera(a) { return '<button type="button" class="btn dua kb-kam" data-kb="' + a + '" aria-label="' + esc(t('kamera')) + '" title="' + esc(t('kamera')) + '">' + IKON_KAMERA + '</button>'; }
  /* aturan sama dengan kodeDariScan di Edge Function kitab: alamat lengkap QR atau kode 10 huruf */
  function kodeKartuSah(s) {
    var k = String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (k.length > 10 && /MOFMOFRIENDS/.test(k)) k = k.slice(-10);
    return k.length === 10 && k.split('').every(function (x) { return 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.indexOf(x) > -1; });
  }
  var JSQR = null;
  function muatJsqr() {
    if (W.jsQR) return Promise.resolve(W.jsQR);
    if (JSQR) return JSQR;
    JSQR = new Promise(function (ok, gagal) {
      var sc = document.createElement('script'); sc.src = DASAR + 'vendor/jsQR.min.js'; sc.async = true;
      sc.onload = function () { if (W.jsQR) ok(W.jsQR); else gagal(new Error('jsQR')); };
      sc.onerror = function () { JSQR = null; gagal(new Error('jsQR')); };
      document.head.appendChild(sc);
    });
    return JSQR;
  }
  function nyalakanKamera(sasaran) {
    matikanKamera(); A.kam.gagal = false;
    var kotak = el('kbPsKamera'); if (!kotak || !bisaVideo()) return;
    var token = A.kam.token = {};
    A.kam.sasaran = sasaran;
    kotak.innerHTML = '<p class="ket-alat">' + esc(t('kamMuat')) + '</p>';
    var pakaiDet = adaDetektor();
    var siap = pakaiDet ? Promise.resolve(W.BarcodeDetector.getSupportedFormats ? W.BarcodeDetector.getSupportedFormats() : ['qr_code', 'code_128']).then(function (ada) {
      var mau = sasaran === 'pesanan' ? ['code_128', 'code_39', 'qr_code', 'ean_13'] : ['qr_code'];
      var f = mau.filter(function (x) { return (ada || []).indexOf(x) > -1; });
      if (!f.length) { if (sasaran === 'kartu') { pakaiDet = false; return muatJsqr(); } throw new Error('format'); }
      A.kam.det = new W.BarcodeDetector({ formats: f });
    }) : muatJsqr();
    siap.then(function () { return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }).then(function (aliran) {
      if (A.kam.token !== token || A.tab !== 'pasang' || !el('kbPsKamera')) { aliran.getTracks().forEach(function (tr) { tr.stop(); }); return; }
      A.kam.aliran = aliran;
      el('kbPsKamera').innerHTML = '<div class="kamera-alat"><video playsinline muted autoplay></video><i class="bidik" aria-hidden="true"></i><p class="kb-kam-arah">' + esc(t(sasaran === 'pesanan' ? 'kamArahPesanan' : 'kamArahKartu')) + '</p><button type="button" class="btn dua" data-kb="kamTutup">' + esc(t('kamTutup')) + '</button></div>';
      var v = el('kbPsKamera').querySelector('video'); v.srcObject = aliran; var pl = v.play && v.play(); if (pl && pl.catch) pl.catch(function () {});
      A.kam.v = v; A.kam.pakaiDet = pakaiDet;
      lingkarKamera(token);
    }).catch(function () {
      if (A.kam.token !== token) return;
      matikanKamera(); A.kam.gagal = true;
      var k = el('kbPsKamera'); if (k) k.innerHTML = '<p class="tolak-alat">' + esc(t('kamGagal')) + '</p>';
      bunyi('scanTolak');
    });
  }
  function bacaBingkai() {
    var v = A.kam.v;
    if (A.kam.pakaiDet) return A.kam.det.detect(v).then(function (r) { return (r || []).map(function (x) { return String(x.rawValue || ''); }); });
    if (!v || !v.videoWidth) return Promise.resolve([]);
    var w = Math.min(640, v.videoWidth), h = Math.round(v.videoHeight * w / v.videoWidth);
    var kv = A.kam.kanvas || (A.kam.kanvas = document.createElement('canvas')); kv.width = w; kv.height = h;
    var cx = kv.getContext('2d', { willReadFrequently: true }); cx.drawImage(v, 0, 0, w, h);
    var g = cx.getImageData(0, 0, w, h), q = W.jsQR(g.data, w, h, { inversionAttempts: 'dontInvert' });
    return Promise.resolve(q && q.data ? [q.data] : []);
  }
  function lingkarKamera(token) {
    if (!A.kam.aliran || A.kam.token !== token) return;
    bacaBingkai().then(function (isi) {
      if (!A.kam.aliran || A.kam.token !== token) return;
      var sasaran = A.kam.sasaran, dapat = null;
      isi.forEach(function (x) {
        if (dapat) return; x = String(x).trim();
        if (sasaran === 'kartu' ? kodeKartuSah(x) : (/^#?\s*[A-Za-z0-9]{6,30}$/.test(x) && !kodeKartuSah(x))) dapat = x;
      });
      if (!dapat) { A.kam.t = setTimeout(function () { lingkarKamera(token); }, 200); return; }
      matikanKamera(); bunyi('scanOk');
      if (sasaran === 'pesanan') { A.ps.pesanan = dapat; var ip = el('kbPsPesanan'); if (ip) ip.value = dapat; nyalakanKamera('kartu'); return; }
      A.ps.kartu = dapat; var ik = el('kbPsKartu'); if (ik) ik.value = dapat; pasangKartu(false);
    }, function () { if (A.kam.aliran && A.kam.token === token) A.kam.t = setTimeout(function () { lingkarKamera(token); }, 400); });
  }
  function matikanKamera() {
    A.kam.token = null;
    if (A.kam.t) { clearTimeout(A.kam.t); A.kam.t = null; }
    if (A.kam.aliran) { try { A.kam.aliran.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} }); } catch (e) {} }
    if (A.kam.v) { try { A.kam.v.srcObject = null; } catch (e) {} }
    A.kam.aliran = null; A.kam.v = null; A.kam.det = null;
    var k = el('kbPsKamera'); if (k && !A.kam.gagal) k.innerHTML = '';
  }
  function tombolScan(e) {
    if (e.key !== 'Enter' || !e.target) return;
    if (e.target.id === 'kbPsPesanan') { e.preventDefault(); A.ps.pesanan = e.target.value; var k = el('kbPsKartu'); if (k) k.focus(); }
    else if (e.target.id === 'kbPsKartu') { e.preventDefault(); A.ps.kartu = e.target.value; pasangKartu(false); }
  }
  function pasangKartu(ganti) {
    var ps = A.ps; if (ps.sibuk) return;
    var tunda = ganti ? ps.tunda : null;
    if (!tunda) { var ip = el('kbPsPesanan'), ik = el('kbPsKartu'); if (ip) ps.pesanan = ip.value; if (ik) ps.kartu = ik.value; }
    var pesanan = tunda ? tunda.pesanan : String(ps.pesanan || '').trim(), kartu = tunda ? tunda.kode : String(ps.kartu || '').trim();
    if (!kartu) { var f = el(pesanan ? 'kbPsKartu' : 'kbPsPesanan'); if (f) f.focus(); return; }
    ps.sibuk = true; A.pesan = ''; gambar();
    var janji = pesanan ? panggil('pasangKartu', ganti ? { item: [{ kode: kartu, pesanan: pesanan }], ganti: true } : { item: [{ kode: kartu, pesanan: pesanan }] })
      : panggil('cekKartu', { kode: kartu });
    janji.then(function (r) {
      ps.sibuk = false;
      if (!pesanan) {
        ps.hasil = r.ok ? { status: 'cek', kode: r.kode, pesanan: r.pesanan, jenis: r.jenis, dibuka: r.dibuka } : { status: 'tidak', kode: kartu };
        bunyi(r.ok ? 'scanOk' : 'scanTolak'); ps.kartu = ''; gambar(); var ik2 = el('kbPsKartu'); if (ik2) ik2.focus(); return;
      }
      if (!r.ok || !r.hasil || !r.hasil[0]) { A.pesan = r.pesan || t('gagal'); bunyi('scanTolak'); gambar(); return; }
      var h = r.hasil[0]; h.lamaKartu = h.status === 'ok' && ganti && tunda && tunda.status === 'penuh';
      ps.hasil = h;
      if (h.status === 'ok' || h.status === 'sudah') {
        bunyi('scanOk'); ps.tunda = null; ps.pesanan = ''; ps.kartu = '';
        /* sesudah pindah/ganti, baris lama pesanan atau kartu itu tidak berlaku lagi */
        if (h.status === 'ok') { ps.log = ps.log.filter(function (x) { return x.pesanan !== h.pesanan && x.kode !== h.kode; }); var j = new Date(); ps.log.unshift({ pesanan: h.pesanan, kode: h.kode, jam: ('0' + j.getHours()).slice(-2) + ':' + ('0' + j.getMinutes()).slice(-2) }); ps.log = ps.log.slice(0, 50); }
        gambar(); fokusPs(); return;
      }
      bunyi('scanTolak'); ps.tunda = (h.status === 'lain' || h.status === 'penuh') ? { kode: h.kode, pesanan: h.pesanan, status: h.status } : null;
      ps.kartu = ''; gambar(); var ik3 = el('kbPsKartu'); if (ik3) ik3.focus();
    }, function (e) { ps.sibuk = false; A.pesan = e.message; bunyi('scanTolak'); gambar(); });
  }
  /* ---------- klaim struk ---------- */
  function htmlStruk() {
    if (!A.struk) return '<p class="ket-alat">' + esc(t('muat')) + '</p>';
    if (!A.struk.length) return '<p class="ket-alat">' + esc(t('tanpaStruk')) + '</p>';
    return (A.pesan ? '<div class="tolak-alat" role="alert">' + esc(A.pesan) + '</div>' : '') + '<p class="ket-alat">' + esc(t('ketStruk')) + '</p>' + A.struk.map(function (b) {
      var pil = A.pilih[b.id] || {};
      return '<div class="kb-struk" data-struk="' + b.id + '"><div class="kb-skepala"><b>' + esc(b.nama) + '</b><span>' + esc(b.gerai) + ' · ' + tgl(b.tanggal) + '</span><small>#' + b.id + '</small></div>' +
        (A.foto[b.id] ? '<img class="kb-foto" src="' + esc(A.foto[b.id]) + '" alt="">' : '<button type="button" class="btn dua" data-kb="foto" data-id="' + b.id + '">' + esc(t('lihatFoto')) + '</button>') +
        '<span class="lbl">' + esc(t('kartuDibuka')) + '</span><div class="kb-pilih">' + (b.produk || []).map(function (k) { return '<label class="chip-alat"><input type="checkbox" data-pilih="' + b.id + '" value="' + esc(k) + '"' + (pil[k] ? ' checked' : '') + '> ' + esc(namaKartu(k)) + '</label>'; }).join('') + '</div>' +
        '<div class="kb-hbawah"><button type="button" class="btn dua" data-kb="tolak" data-id="' + b.id + '">' + esc(A.tolakYakin === b.id ? t('yakinTolak') : t('tolak')) + '</button><button type="button" class="btn" data-kb="setujui" data-id="' + b.id + '">' + esc(t('setujui')) + '</button></div></div>';
    }).join('');
  }
  function lihatFoto(id) {
    panggil('fotoStruk', { id: id }).then(function (r) { if (r.ok && /^data:image\//.test(r.foto)) { A.foto[id] = r.foto; } else A.pesan = r.pesan || t('gagal'); gambar(); }, function (e) { A.pesan = e.message; gambar(); });
  }
  function putus(id, setuju) {
    var kartu = Object.keys(A.pilih[id] || {}).filter(function (k) { return A.pilih[id][k]; });
    if (setuju && !kartu.length) { A.pesan = t('pilihKartu'); bunyi('scanTolak'); gambar(); return; }
    A.pesan = '';
    panggil('putusStruk', { id: id, setuju: setuju, kartu: kartu }).then(function (r) {
      if (!r.ok) { A.pesan = r.pesan; gambar(); return; }
      bunyi(setuju ? 'scanOk' : 'klik'); A.tolakYakin = 0; delete A.foto[id];
      A.struk = A.struk.filter(function (b) { return b.id !== id; });
      if (A.ringkas && A.ringkas.angka) A.ringkas.angka.struk = A.struk.length;
      gambar();
    }, function (e) { A.pesan = e.message; gambar(); });
  }

  /* ---------- aksi ---------- */
  function klik(e) {
    var d = el('kitabkuAdmin');
    if (e.target === d) { tutup(); return; }
    var x = e.target.closest ? e.target.closest('[data-kb],[data-kbtab]') : null; if (!x) return;
    if (x.hasAttribute('data-kbtab')) { matikanKamera(); bunyi('klik'); A.tab = x.getAttribute('data-kbtab'); A.pesan = ''; A.tolakYakin = 0; if (A.tab === 'struk') muatStruk(); else if (A.tab === 'pasang') { A.galat = ''; gambar(); fokusPs(); } else if (A.tab === 'template') muatTemplate(); else if (A.tab === 'jadwal') muatJadwal(); else if (!A.ringkas) muatRingkas(); else gambar(); return; }
    var a = x.getAttribute('data-kb'), id = Number(x.getAttribute('data-id'));
    if (a !== 'tolak') A.tolakYakin = 0;
    if (a === 'tutup') tutup();
    else if (a === 'ulang') { if (A.tab === 'jadwal') { A.jdPesan = ''; muatJadwal(); } else if (A.tab === 'struk') muatStruk(); else if (A.tab === 'pasang') { A.galat = ''; gambar(); fokusPs(); } else if (A.tab === 'template') muatTemplate(); else muatRingkas(); }
    else if (a === 'tpUnggah') unggahTemplate();
    else if (a === 'tpFinal') finalTemplate(x.getAttribute('data-id'), x.getAttribute('data-final') === '1');
    else if (a === 'pasang') { matikanKamera(); pasangKartu(false); }
    else if (a === 'kamKartu') { bunyi('klik'); A.ps.pesanan = (el('kbPsPesanan') || {}).value || A.ps.pesanan; nyalakanKamera('kartu'); }
    else if (a === 'kamPesanan') { bunyi('klik'); nyalakanKamera('pesanan'); }
    else if (a === 'kamTutup') { bunyi('klik'); matikanKamera(); }
    else if (a === 'pasangGanti') pasangKartu(true);
    else if (a === 'huCek') cekUji();
    else if (a === 'huHapus') hapusUji();
    else if (a === 'hsCek') cekSemua();
    else if (a === 'hsHapus') hapusSemua();
    else if (a === 'acara') simpanAcara();
    else if (a === 'hadiah') simpanHadiah(x.getAttribute('data-id'));
    else if (a === 'usulan') pasangUsulan();
    else if (a === 'tingkat3') pasangTingkat3();
    else if (a === 'keHadiah') { var hd = el('kbHadiah'); if (hd && hd.scrollIntoView) hd.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (a === 'buatPaket') buatPaket();
    else if (a === 'cetakPaketLagi') cetakA4();
    else if (a === 'pdfVendor') pdfVendor();
    else if (a === 'pdfUlang') pdfVendor(sumberRiwayat(x.getAttribute('data-i')));
    else if (a === 'pngUlang') pngPaket(sumberRiwayat(x.getAttribute('data-i')));
    else if (a === 'pngPaket') pngPaket();
    else if (a === 'edisiSiap') muatEdisi();
    else if (a === 'jdTanggal') simpanTanggalJd();
    else if (a === 'jdOto') isiOtoJd();
    else if (a === 'jdSimpan') simpanJd();
    else if (a === 'jdTambah') tambahJd();
    else if (a === 'jdHapus') { A.jd.rows.splice(Number(x.getAttribute('data-i')), 1); A.jd.ubah = true; A.jd.pesan = ''; gambar(); }
    else if (a === 'pdfEdisi') pdfEdisi();
    else if (a === 'pngEdisi') pngEdisi();
    else if (a === 'foto') lihatFoto(id);
    else if (a === 'setujui') putus(id, true);
    else if (a === 'tolak') { if (A.tolakYakin === id) putus(id, false); else { A.tolakYakin = id; gambar(); } }
  }
  function ketik(e) {
    var x = e.target;
    if (x.id === 'kbPJml' || x.id === 'kbPVKode' || x.id === 'kbPVTeks' || x.id === 'kbPVSampai') {
      A.p[{ kbPJml: 'jumlah', kbPVKode: 'kode', kbPVTeks: 'teks', kbPVSampai: 'sampai' }[x.id]] = x.value;
      var bp = document.querySelector('[data-kb=buatPaket]'); if (bp) bp.disabled = !paketSiap();
    }
    if (x.getAttribute && x.getAttribute('data-vpakai') != null) ketikPakai(x);
    if (x.id === 'kbVoucherBerkas' && e.type === 'change' && x.files && x.files[0]) unggahVoucher(x.files[0]);
    if (x.id === 'kbTpAcara') A.tp.acara = x.value;
    if (x.id === 'kbTpCatatan') A.tp.catatan = x.value;
    if (x.id === 'kbPdfUk' || x.id === 'kbPdfUk2' || x.id === 'kbPdfUkEd') A.ukuranPdf = String(x.value);
    if (x.id === 'kbPsPesanan') A.ps.pesanan = x.value;
    if (A.jd && x.closest && x.closest('#kbJadwal')) ketikJd(x);
    if (x.id === 'kbPsKartu') A.ps.kartu = x.value;
    if (x.id === 'kbHuKode') {
      A.hu.teks = x.value;
      /* kode berubah sesudah Periksa: rencana dibuang, tombol hapus hilang sampai diperiksa ulang */
      if (A.hu.rencana && x.value !== A.hu.teksRencana) { A.hu.rencana = null; A.hu.yakin = false; var kr = document.getElementById('kbHuRencana'); if (kr) kr.innerHTML = ''; }
    }
    if (x.id === 'kbHsYakin' || x.id === 'kbHsKetik') {
      if (x.id === 'kbHsYakin') A.hs.yakin = x.checked; else A.hs.ketik = x.value;
      var bs = document.querySelector('[data-kb=hsHapus]'); if (bs) bs.disabled = !siapHs();
    }
    if (x.id === 'kbHuYakin') { A.hu.yakin = x.checked; var bh = document.querySelector('[data-kb=huHapus]'); if (bh) bh.disabled = !x.checked || A.hu.sibuk; }
    if (x.hasAttribute('data-pilih')) { var sid = x.getAttribute('data-pilih'); A.pilih[sid] = A.pilih[sid] || {}; A.pilih[sid][x.value] = x.checked; }
    var fk = x.getAttribute && x.getAttribute('data-f');
    if (fk === 'peringkat_dari' || fk === 'angka' || fk === 'kuota') {
      /* peringatan kuota ikut berubah saat mengetik, tanpa menggambar ulang form (kursor tidak loncat) */
      var bx = x.closest('[data-hadiah]'), pk = bx && bx.querySelector('.kb-kuota-cek');
      if (pk) { var hk = bacaHadiah(bx.getAttribute('data-hadiah')), tk = teksKuota(hk); pk.textContent = tk; pk.hidden = !tk; }
    }
    if (e.type === 'change' && x.getAttribute('data-f') === 'jenis') {
      /* ganti jenis: kolom target berubah antara angka dan pilihan bab */
      var box = x.closest('[data-hadiah]'), k = box.getAttribute('data-hadiah'), h = bacaHadiah(k); h.baru = k === 'baru';
      h.angka = h.jenis === 'bab' ? 0 : h.jenis === 'bintang' ? 3 : h.jenis === 'papan' ? 10 : h.angka || 3; box.outerHTML = htmlHadiah(h);
    }
  }
  W.WmsKitabku = { buka: buka, tutup: tutup, qrMatriks: qrMatriks, qrSvg: qrSvg, htmlKartuEdisi: htmlKartuEdisi, panggil: panggil, _uraiVoucher: uraiVoucher, _uraiCsv: uraiCsv };
})();
