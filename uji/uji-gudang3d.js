/* Uji Warehouse condition 3D (wms/gudang3d.js, dipasang di atas halaman Kondisi persediaan › Gudang, HAL kondisi, oleh wms/tata.js), 20 Okt 2026.
 * Harapan: "18 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy menyetujui mockup Warehouse condition 3D ("Good, gas bangun") lalu minta
 * semua tambahan sekaligus ("2 dan 4 sekalian bang dan 3"): cari SKU yang menyala dan kamera berputar
 * ke arahnya, panah isi ulang, mode panas laku, slider tanggal, dan cetak kartu dari panel.
 * Yang mahal kalau salah:
 *  - angka di kotak beda dari Location Master, atau kotak dari kode lama dan kode Jubelio dobel;
 *  - label laci menghadap ke dinding atau terbaca terbalik (sudah pernah terjadi di mockup pertama);
 *    di sini arah muka label dihitung dari matriks transform sungguhan, bukan dari string gaya;
 *  - level rak tertukar (Ferdy: "penomoran nya ad yg kebalik");
 *  - panah isi ulang menyuruh orang mengambil dari lokasi yang kosong atau SKU lain;
 *  - mode panas menghitung penjualan di luar 30 hari, slider tanggal membuat stok negatif;
 *  - tombol cetak mencetak kartu lokasi lain.
 * Papan palsu (HALAMAN, gambarPanel, pasangMenu) disalin dari uji-ringkas-stok.js. Angka harapan
 * dihitung tangan dari fixture di bawah.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const AKAR = process.env.AKAR || path.resolve(__dirname, '..');
const API = 'https://script.google.com/macros/s/AKfycbzslW9akcAS2EINjrdcllgpGpuQzz_I2jHtNyEWixS-yl2HSsqE5kfTDjDGR8H_Zcq9xA/exec';
const SUPA = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/wms';
const KODE_BENAR = 'KODE-PALSU-UJI';
const DIHARAPKAN = 18;
const jenis = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(AKAR, p);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': jenis[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});

/* ---------- buku besar, disusun di sini ----------
   Lokasi: 0 HO, 1 TERJUAL, 2 OPENING, 3 T305 (gerai). Hari ini 2026-10-15.
   Produk: 0 KC Bear, 1 KC Tiger, 2 Ball Lamb, 3 Cap Tomato.
   Laku 30 hari (sesudah 2026-09-15): Tiger 5 (10-05) + 3 (10-13) = 8, Bear 2 (10-11, dari T305).
   Lamb laku 4 pada 09-01, di luar 30 hari, jadi 0. Tomato 0.
   Perubahan HO sesudah 2026-10-08 (mundur 7 hari): Bear -6 (10-10 ke T305), Lamb +4 (10-12 masuk),
   Tiger -3 (10-13). Jadi 7 hari lalu HO punya Bear +6 dan Tiger +3 lebih banyak (berdiri di staging,
   9 pcs) dan Lamb 4 lebih sedikit (dikuras dari pick face T1-0A: 5 - 4 = 1).
   Mundur 12 hari (sesudah 10-03): ditambah Tiger -5 pada 10-05, staging 9 + 5 = 14. */
const L = { HO: 0, TERJUAL: 1, OPENING: 2, T305: 3 };
const DATA = { ok: true, hariIni: '2026-10-15', bulanIni: '2026-10',
  lok: [{ k: 'HO', n: 'HO', toko: 0 }, { k: 'TERJUAL', n: 'TERJUAL', toko: 0 }, { k: 'OPENING', n: 'OPENING', toko: 0 }, { k: 'T305', n: 'TOYS KINGDOM LIVING WORLD ALAM SUTERA', toko: 1 }],
  prod: [{ b: '4582586967015', n: 'MofmoFriends Key Charm - Bear', s: 'MF-KC-001' }, { b: '4582586964274', n: 'MofmoFriends Key Charm - Tiger', s: 'MF-KC-008' },
    { b: '4582586965738', n: 'MofmoFriends Mascot Ball - Lamb', s: 'MF-BL-003' }, { b: '4582586966360', n: 'Cap for MofmoFriends - S Tomato', s: 'MF-CP-004' }],
  baris: [['2026-08-01', 0, 30, L.OPENING, L.HO], ['2026-08-01', 1, 20, L.OPENING, L.HO], ['2026-08-01', 2, 10, L.OPENING, L.HO], ['2026-08-01', 3, 30, L.OPENING, L.HO],
    ['2026-09-01', 2, 4, L.HO, L.TERJUAL], ['2026-10-05', 1, 5, L.HO, L.TERJUAL], ['2026-10-10', 0, 6, L.HO, L.T305], ['2026-10-11', 0, 2, L.T305, L.TERJUAL],
    ['2026-10-12', 2, 4, L.OPENING, L.HO], ['2026-10-13', 1, 3, L.HO, L.TERJUAL]] };
/* ---------- Location Master ----------
   Campuran kode WMS lama dan satu kode yang sudah kode Jubelio (L2-R3-A), seperti sesudah Location Master
   diganti sebagian. Q9-1A unit tak dikenal: tidak digambar, disebut di catatan.
   Status: L4-R1-A 20/40 ok, L3-R1-B 3/30 rendah, L1-R2-A 0 kosong, L2-R3-A 30/30 penuh, L2-S1-B 50/40 lebih,
   L0-T1-A 5/16 rendah, L3-T2-A 8/16 ok, overflow karton, IN staging.
   Isi ulang: L3-R1-B (Tiger, 10%) dari L1-OF-1-01 (Tiger 12). L0-T1-A (Lamb) tidak punya sumber.
   Bear di gudang: 20 + 4 = 24 pcs di 2 lokasi; laku 2 per 30 hari, cukup 24 / (2/30) = 360 hari. */
const GUDANG = { ok: true, lokasi: [
  { kode: 'R1-4A', sku: 'KC Bear', barcode: '4582586967015', isi: 20, kap: 40, zona: 'RACK', unit: 'R1', level: 4, pos: 'A', peran: 'PICK' },
  { kode: 'R1-3B', sku: 'KC Tiger', barcode: '4582586964274', isi: 3, kap: 30, zona: 'RACK', unit: 'R1', level: 3, pos: 'B', peran: 'PICK' },
  { kode: 'R2-1A', sku: '', barcode: '', isi: 0, kap: 30, zona: 'RACK', unit: 'R2', level: 1, pos: 'A', peran: 'PICK' },
  { kode: 'L2-R3-A', sku: 'Cap Tomato', barcode: '4582586966360', isi: 30, kap: 30, zona: 'RACK', unit: 'R3', level: 2, pos: 'A', peran: 'PICK' },
  { kode: 'S1-2B', sku: 'M Panda', barcode: '4582586963291', isi: 50, kap: 40, zona: 'STACK', unit: 'S1', level: 2, pos: 'B', peran: 'PICK' },
  { kode: 'T1-0A', sku: 'Ball Lamb', barcode: '4582586965738', isi: 5, kap: 16, zona: 'TABLE', unit: 'T1', level: 0, pos: 'A', peran: 'PICK' },
  { kode: 'T2-3A', sku: 'S Panda', barcode: '4582586963260', isi: 8, kap: 16, zona: 'TABLE', unit: 'T2', level: 3, pos: 'A', peran: 'PICK' },
  { kode: 'X-01', sku: 'KC Tiger', barcode: '4582586964274', isi: 12, kap: 40, zona: 'OVERFLOW', unit: 'X', level: '', pos: '', peran: 'OVERFLOW' },
  { kode: 'X-02', sku: 'KC Bear', barcode: '4582586967015', isi: 4, kap: 40, zona: 'OVERFLOW', unit: 'X', level: '', pos: '', peran: 'OVERFLOW' },
  { kode: 'X-IN', sku: '', barcode: '', isi: 0, kap: 0, zona: 'OVERFLOW', unit: 'X', level: '', pos: '', peran: 'STAGING' },
  { kode: 'Q9-1A', sku: 'KC Bear', barcode: '4582586967015', isi: 1, kap: 10, zona: 'RACK', unit: 'Q9', level: 1, pos: 'A', peran: 'PICK' }] };
const KODE3D = ['L4-R1-A', 'L3-R1-B', 'L1-R2-A', 'L2-R3-A', 'L2-S1-B', 'L0-T1-A', 'L3-T2-A', 'L1-OF-1-01', 'L1-OF-1-02', 'L1-IN-1-01'];
const OBD = { ok: true, waktu: '2026-10-15T12:00:00+07:00', daftar: [] };
const KERJA = { ok: true, html: '<p id="kerjaIsi">Work log</p>' };
const panggilApi = [];

/* ---------- papan lama palsu: HALAMAN dan gambarPanel asli ---------- */
const SKRIP = function () {
  window.HAL = 'ringkasan';
  var HALAMAN = [
    ['ringkasan', 'Ringkasan', '■', []],
    ['stok', 'Persediaan', '▤', [['bukubesar', 'Buku besar bulanan'], ['kesehatan', 'Kesehatan & umur', [['kesehatan', 'Kesehatan persediaan'], ['umur', 'Umur & retur']]],
      ['opname', 'Stok opname & hitung fisik', [['opname', 'Stok opname'], ['hitung', 'Hitung fisik (pindai)']]], ['gerakstok', 'Pergerakan stok'],
      ['kondisi', 'Kondisi persediaan', [['kondisi', 'Gudang'], ['stokgerai', 'Gerai offline']]]]],
    ['laku', 'Penjualan', '◥', [['bulanan', 'Laporan bulanan'], ['dokumen', 'Dokumen mitra'], ['saluran', 'Penjualan saluran'], ['performasku', 'Performa tiap SKU'], ['mitra2', 'Permintaan & tagihan']]],
    ['rencana', 'Pengiriman', '→', [['pesanan', 'Pesanan'], ['kemas', 'Surat jalan & PO', [['kemas', 'Surat jalan'], ['bacapo', 'Baca PO']]], ['mintagerai', 'Permintaan gerai'],
      ['poharian', 'Cek PO & alokasi', [['poharian', 'Cek PO & pick list'], ['alokasi', 'Alokasi & pengganti']]], ['kembali', 'Barang kembali']]],
    ['kinerja', 'Lapangan', '☺', [['jadwal', 'Jadwal kunjungan'], ['absenlokasi', 'Operational PIC', [['absenlokasi', 'Kerja & tugas lapangan'], ['perbaikan', 'Perbaikan kantor (sampai 30 Sep 2026)']]], ['foto', 'Foto rak (sampai 30 Sep 2026)']]],
    ['sehat', 'Kualitas data', '✚', []]
  ];
  window.HALAMAN = HALAMAN;
  window.grupTerbuka = function (kode) {
    for (var i = 0; i < HALAMAN.length; i++) {
      var g = HALAMAN[i];
      if (g[0] === kode) return g[0];
      for (var j = 0; j < g[3].length; j++) {
        var c = g[3][j];
        if (c[0] === kode) return g[0];
        if (c[2]) for (var k = 0; k < c[2].length; k++) if (c[2][k][0] === kode) return g[0];
      }
    }
    return 'ringkasan';
  };
  var el = function (i) { return document.getElementById(i); };
  window.gambarPanel = function () {
    var HALAMAN = window.HALAMAN;
    var buka = window.grupTerbuka.call(null, HAL);
    var s = '<h3><span>Papan</span></h3>';
    HALAMAN.forEach(function (o) {
      var aktif = (HAL === o[0]);
      var kls = aktif ? 'on' : (buka === o[0] && o[3].length ? 'induk' : '');
      s += '<a tabindex="0" data-hal="' + o[0] + '"' + (kls ? (' class="' + kls + '"') : '') + '><span class="pnlNama">' + o[1] + '</span></a>';
      if (buka === o[0] && o[3].length) {
        s += '<div class="anak">';
        o[3].forEach(function (c) {
          var nyala = (HAL === c[0]);
          if (!nyala && c[2]) for (var q = 0; q < c[2].length; q++) if (c[2][q][0] === HAL) nyala = true;
          s += '<a tabindex="0" data-hal="' + c[0] + '"' + (nyala ? ' class="on"' : '') + '>' + c[1] + '</a>';
        });
        s += '</div>';
      }
    });
    var np = el('panel'); if (np && np.innerHTML !== s) np.innerHTML = s;
  };
  /* grupTerbuka asli juga membaca nama global; samakan */
  var gt = window.grupTerbuka;
  window.grupTerbuka = function (kode) { HALAMAN = window.HALAMAN; return gt(kode); };
  window.pasangSubJudul = function (a, b) { window.__subKali = (window.__subKali || 0) + 1; el('subJudul').innerHTML = '<span>' + a + '</span>\u00a0·\u00a0<span>' + b + '</span>'; };
  window.gambar = function () {
    window.gambarPanel();
    var I = el('isi');
    if (HAL === 'rencana') I.innerHTML = '<div class="k" id="glance">Shipments at a glance</div>';
    else if (HAL === 'kemas') I.innerHTML = '<div class="k" id="sjLama">Delivery orders</div>';
    else if (HAL === 'outbound' || HAL === 'obdShopee' || HAL === 'obdIsiUlang') { I.innerHTML = '<div id="obdKotak"></div>'; el('obdKotak').attachShadow({ mode: 'open' }).innerHTML = '<div class="o"><div class="kep"><div><h2>Warehouse · Outbound</h2></div></div></div>'; }
    else if (HAL === 'absenlokasi') { I.innerHTML = '<div id="krj">memuat</div>'; google.script.run.withSuccessHandler(function (h) { el('krj').innerHTML = h.html; window.__kerjaMs = Date.now() - window.__kerjaMulai; }).papanKerja(KODE, ''); window.__kerjaMulai = Date.now(); }
    else I.innerHTML = '<div class="k s12" id="ringkasanLama">Summary</div>';
    if (HAL === 'outbound' || HAL === 'obdShopee' || HAL === 'obdIsiUlang') window.pasangSubGudang();
  };
  /* ---- skrip Gudang yang ditunda: pasangMenu dan subjudul, logika asli ---- */
  var HAL_SHP = 'obdShopee', HAL_IU = 'obdIsiUlang', EN = function () { return document.documentElement.lang !== 'id'; };
  var B = function (i, e) { return EN() ? e : i; };
  function pasangMenu() {
    var H = window.HALAMAN;
    var ada = false, iKirim = -1;
    for (var i = 0; i < H.length; i++) { if (H[i][0] === 'outbound') ada = true; if (H[i][0] === 'rencana') iKirim = i; }
    if (!ada) H.splice(iKirim >= 0 ? iKirim + 1 : H.length, 0, ['outbound', 'Gudang', '', []]);
    var gAnak = false;
    for (var gi = 0; gi < H.length; gi++) {
      var gg = H[gi]; if (gg[0] !== 'outbound') continue; if (!gg[3]) gg[3] = [];
      var punyaIu = false; for (var gj = 0; gj < gg[3].length; gj++) if (gg[3][gj][0] === HAL_IU) punyaIu = true;
      if (!punyaIu) { gg[3] = [['outbound', 'Offline'], [HAL_SHP, 'Shopee'], [HAL_IU, 'Isi ulang rak']]; gAnak = true; }
    }
    var buang = { perbaikan: 1, foto: 1, selfie: 1, kartu: 1, hitung: 1, poharian: 1, petabox: 1 }, LABEL = { opname: 'Stok opname' }, berubah = false;
    H.forEach(function (g) {
      if (!g[3] || !g[3].length) return;
      for (var j = g[3].length - 1; j >= 0; j--) {
        var c = g[3][j];
        if (buang[c[0]] && !(c[2] && c[2].length)) { g[3].splice(j, 1); berubah = true; continue; }
        if (c[2] && c[2].length) {
          for (var k = c[2].length - 1; k >= 0; k--) if (buang[c[2][k][0]]) { c[2].splice(k, 1); berubah = true; }
          if (!c[2].length) { g[3].splice(j, 1); berubah = true; continue; }
          if (c[2].length === 1) { var s0 = c[2][0]; g[3][j] = [s0[0], LABEL[s0[0]] || (s0[0] === c[0] ? c[1] : s0[1])]; berubah = true; }
        }
      }
    });
    if ((berubah || gAnak) && el('isi') && typeof gambarPanel === 'function') { try { gambarPanel(); } catch (eP) {} }
    window.__pasangMenu = (window.__pasangMenu || 0) + 1;
  }
  function subJudulGudang() { return HAL === HAL_SHP ? B('Gudang · Shopee', 'Warehouse · Shopee') : (HAL === HAL_IU ? B('Gudang · Isi ulang rak', 'Warehouse · Rack replenishment') : B('Gudang · outbound', 'Warehouse · outbound')); }
  window.pasangSubGudang = function () { var sj = el('subJudul'); var tj = subJudulGudang(), p = tj.split(' · '); if (sj.textContent.replace(/\u00a0/g, ' ') === tj) return; pasangSubJudul(p[0], p[1]); };
  function jaga() { pasangMenu(); if (HAL === 'outbound' || HAL === HAL_SHP || HAL === HAL_IU) window.pasangSubGudang(); }
  setTimeout(function () { pasangMenu(); setInterval(jaga, 700); }, 400);
};
const PAPAN_PALSU = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Papan</title>' +
  '<style>body{margin:0;background:#FBF8F0;font-family:Arial,sans-serif}#layarIsi{display:none}.rangka{display:flex}.panel{flex:0 0 236px}.utama{flex:1;min-width:0;padding:16px}' +
  '.petak{display:grid;gap:16px;grid-template-columns:repeat(12,1fr);min-width:0}.petak>:not(.k){grid-column:span 12;min-width:0}.k{grid-column:span 12;background:#fff;padding:16px;min-width:0}' +
  '.panel a{display:block}.anak{padding-left:12px}@media(max-width:900px){.rangka{display:block}.panel{display:flex;flex-wrap:wrap;overflow-x:auto}}</style></head><body>' +
  '<div id="layarKode"><input id="kode"><button onclick="buka()">Masuk</button></div>' +
  '<div id="layarIsi"><header><h1>Papan Data</h1><div id="subJudul"></div></header>' +
  '<div class="rangka"><nav class="panel" id="panel"></nav>' +
  '<div class="utama"><div id="isi" class="petak"></div></div></div></div>' +
  '<script>var KODE="";(' + SKRIP.toString() + ')();function buka(){KODE=document.getElementById("kode").value;google.script.run.withSuccessHandler(function(r){document.getElementById("layarKode").style.display="none";document.getElementById("layarIsi").style.display="block";gambar();window.__siap=1;}).dataPapan(KODE);}<\/script></body></html>';

const PALSU_AWAL = () => {
  function Ctx() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  Ctx.prototype.createOscillator = function () { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; };
  Ctx.prototype.createGain = function () { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; };
  Ctx.prototype.resume = function () {};
  window.AudioContext = Ctx; window.webkitAudioContext = Ctx;
};

(async () => {
  await new Promise(r => srv.listen(8781, r));
  const URL0 = 'http://localhost:8781/wms/';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const jeda = ms => new Promise(x => setTimeout(x, ms));
  const pasangRute = async ctx => {
    await ctx.addInitScript(PALSU_AWAL);
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route(API + '**', async r => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      if (m.fn === 'panggil') panggilApi.push(m.nama);
      let h;
      if (m.fn === 'panggil' && m.nama === 'dataPapan') h = { pintu: 'ok', hasil: DATA };
      else if (m.fn === 'panggil' && m.nama === 'obdDaftar') h = { pintu: 'ok', hasil: OBD };
      else if (m.fn === 'panggil' && m.nama === 'papanKerja') h = { pintu: 'ok', hasil: KERJA };
      else h = { pintu: 'galat', pesan: 'Fungsi "' + (m.nama || m.fn) + '" tidak dibuka untuk WMS.' };
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(h) });
    });
    await ctx.route(SUPA, async r => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      let h;
      if (m.fn === 'masuk') h = String(m.kode || '').trim().toUpperCase() === KODE_BENAR ? { ok: true, tiket: 'TIKET.SUPA', ingat: true } : { ok: false, pesan: 'no' };
      else if (m.fn === 'ambil') {
        const w = new Date(Date.now() - 60000).toISOString();
        const o = { 'dataPapan|["K"]': DATA, 'obdDaftar|["K"]': OBD, 'wmsGudang|["K"]': GUDANG, 'papanKerja|["K",""]': KERJA, 'klien|papan': { ok: true, versi: 'ringkas', html: PAPAN_PALSU }, 'klien|versi': { ok: true, versi: 'ringkas' } };
        const isi = {}; (m.kunci || []).forEach(k => { if (o[k]) isi[k] = { waktu: w, data: o[k] }; });
        h = { ok: true, isi };
      } else h = { ok: false };
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
    });
  };
  const cek = []; const c = (n, ok, k) => cek.push([n, !!ok, k]);
  const galat = [];
  const halaman = async ctx => { const p = await ctx.newPage(); p.on('pageerror', e => galat.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) galat.push(m.text()); }); return p; };
  const bingkai = p => p.frames().find(f => f !== p.mainFrame());
  const tungguBingkai = async (p, fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { try { const f = bingkai(p); if (f && await f.evaluate(fn, arg)) return true; } catch (e) {} await jeda(80); } return false; };
  const fe = (p, fn, arg) => bingkai(p).evaluate(fn, arg);
  const masuk = async (p, bhs) => {
    await p.goto(URL0);
    await p.evaluate(b => { localStorage.setItem('wms_tema', 'light'); localStorage.setItem('wms_bhs', b); }, bhs || 'en');
    await p.reload();
    await p.waitForFunction(() => document.getElementById('formMasuk'), null, { timeout: 6000 }).catch(() => {});
    await p.fill('#kode', 'kode-palsu-uji'); await p.click('#tMasuk');
    await tungguBingkai(p, () => window.__siap === 1 && window.__l4Tata === true && window.__pasangMenu >= 1, 10000);
    await jeda(300);
  };
  const ke = async (p, hal, tunggu) => { await fe(p, h => { window.HAL = h; window.gambar(); }, hal); if (tunggu) await tungguBingkai(p, tunggu, 6000); await jeda(200); };
  const bacaMenu = p => fe(p, () => {
    const pn = document.getElementById('panel');
    const atas = Array.from(pn.children).filter(x => x.tagName === 'A').map(a => a.getAttribute('data-hal'));
    const anak = Array.from(pn.querySelectorAll('.anak a')).map(a => a.getAttribute('data-hal') + '=' + a.textContent);
    const induk = pn.querySelector(':scope > a.induk, :scope > a.on'); const nyala = pn.querySelector('.anak a.on');
    return { atas: atas.join(','), anak: anak.join('|'), induk: induk ? induk.getAttribute('data-hal') : '', nyala: nyala ? nyala.getAttribute('data-hal') : '' };
  });
  const teksAngka = s => String(s || '').replace(/[^0-9]/g, '');

  /* ---------- pembantu khusus 3D, dijalankan di bingkai papan ---------- */
  const S3 = '[data-l4t-hal-ini=kondisi] ';
  const g3 = (p, fn, arg) => fe(p, fn, arg);
  const isiInput = (p, sel, nilai) => fe(p, a => { const x = document.querySelector(a[0]); x.value = a[1]; x.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, nilai]);
  const klik = (p, sel) => fe(p, s => { const x = document.querySelector(s); if (!x) return false; x.click(); return true; }, sel);
  const warnaAtas = (p, kode) => fe(p, k => { const x = document.querySelector('[data-g3-krat="' + k + '"] > div'); return x ? getComputedStyle(x).backgroundColor : ''; }, kode);

  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await pasangRute(ctx);
    const p = await halaman(ctx);
    await masuk(p, 'en');
    await jeda(1200);
    await ke(p, 'kondisi', () => !!document.querySelector('[data-l4t-hal-ini=kondisi] [data-g3-krat]'));
    await jeda(400);

    /* ================= peta ================= */
    const peta = await g3(p, s => {
      const kode = Array.from(document.querySelectorAll(s + '[data-g3-krat]')).map(x => x.getAttribute('data-g3-krat'));
      return { kode, catatan: (document.querySelector(s + '.g3') || {}).innerText || '' };
    }, S3);
    c('G1 3D jadi tampilan awal: 10 lokasi digambar sekali masing-masing dengan kode Jubelio (kode lama dan L2-R3-A yang sudah Jubelio sama-sama dikenali), Q9-1A yang unitnya belum ada di denah disebut di catatan',
      JSON.stringify(peta.kode.slice().sort()) === JSON.stringify(KODE3D.slice().sort()) && /1 location is not on the 3D map yet/.test(peta.catatan), JSON.stringify(peta.kode) + ' ' + peta.catatan.slice(-200));

    const tinggi = await g3(p, () => {
      const z = k => { const x = document.querySelector('[data-g3-krat="' + k + '"]'); return x ? Math.round(new DOMMatrix(getComputedStyle(x).transform).m43) : null; };
      const st = k => { const x = document.querySelector('[data-g3-krat="' + k + '"] [data-g3-label] span'); return x ? x.textContent : ''; };
      return { r4: z('L4-R1-A'), r3: z('L3-R1-B'), r1: z('L1-R2-A'), t0: z('L0-T1-A'), t3: z('L3-T2-A'), label: st('L4-R1-A'), labelT: st('L0-T1-A') };
    });
    c('G2 level naik ke atas: L4 di atas L3 di atas L1, L0 meja di lantai (kolong) dan L3 meja di atas daun meja; stiker laci menulis kode Jubelio dan pcs ("L4-R1-A" 20, "L0-T1-A" 5)',
      tinggi.r4 > tinggi.r3 && tinggi.r3 > tinggi.r1 && tinggi.r1 >= 0 && tinggi.t0 === 0 && tinggi.t3 > 34 && tinggi.label === 'L4-R1-A\n20' && tinggi.labelT === 'L0-T1-A\n5', JSON.stringify(tinggi));

    /* arah muka label dihitung dari rantai matriks transform (kotak lalu sisinya), terhadap lantai */
    const arah = await g3(p, () => {
      const lt = document.querySelector('[data-g3-lantai]');
      const n = k => {
        const f = document.querySelector('[data-g3-krat="' + k + '"] [data-g3-label]'); if (!f) return 'tanpa label';
        const rantai = []; for (let x = f; x && x !== lt; x = x.parentElement) rantai.unshift(x);
        let m = new DOMMatrix(); rantai.forEach(x => { const tr = getComputedStyle(x).transform; if (tr && tr !== 'none') m = m.multiply(new DOMMatrix(tr)); });
        const a = m.transformPoint(new DOMPoint(0, 0, 0)), b = m.transformPoint(new DOMPoint(0, 0, 1));
        return [b.x - a.x, b.y - a.y, b.z - a.z].map(v => String(Math.round(v) || 0)).join(',');
      };
      const o = {}; ['L4-R1-A', 'L2-R3-A', 'L2-S1-B', 'L0-T1-A', 'L3-T2-A', 'L1-OF-1-01', 'L1-IN-1-01'].forEach(k => { o[k] = n(k); });
      o.jumlah = Array.from(document.querySelectorAll('[data-g3-krat="L4-R1-A"] [data-g3-label]')).length;
      return o;
    });
    c('G3 label laci menghadap lorong U dan tidak terbalik: rak R (kiri) ke +x, meja T (kanan) ke -x, tumpukan S1 (depan) ke +y, staging di belakang R3 ke +x, karton overflow di belakang T2 ke -x; satu label per kotak',
      arah['L4-R1-A'] === '1,0,0' && arah['L2-R3-A'] === '1,0,0' && arah['L0-T1-A'] === '-1,0,0' && arah['L3-T2-A'] === '-1,0,0' && arah['L2-S1-B'] === '0,1,0' && arah['L1-IN-1-01'] === '1,0,0' && arah['L1-OF-1-01'] === '-1,0,0' && arah.jumlah === 1, JSON.stringify(arah));

    const status = await g3(p, () => Array.from(document.querySelectorAll('[data-g3-krat]')).map(x => x.getAttribute('data-g3-krat') + '=' + x.getAttribute('data-g3-st')).sort().join(' '));
    c('G4 warna status per lokasi: ok, di bawah 50%, kosong, penuh, melebihi kapasitas; karton overflow dan staging punya warna sendiri (bukan peringatan pick face)',
      status === 'L0-T1-A=rendah L1-IN-1-01=staging L1-OF-1-01=karton L1-OF-1-02=karton L1-R2-A=kosong L2-R3-A=penuh L2-S1-B=lebih L3-R1-B=rendah L3-T2-A=ok L4-R1-A=ok', status);

    await tungguBingkai(p, () => { const i = document.querySelector('[data-g3-krat="L4-R1-A"] [data-g3-label] img'); return i && i.complete; }, 4000);
    const foto = await g3(p, () => { const i = document.querySelector('[data-g3-krat="L4-R1-A"] [data-g3-label] img'); const k = document.querySelector('[data-g3-krat="L1-R2-A"] [data-g3-label] img'); return { src: i ? i.getAttribute('src') : '', lebar: i ? i.naturalWidth : 0, kosong: !!k }; });
    c('G5 foto SKU menempel di label laci (KC Bear memuat gambar kc_bear sungguhan), slot tanpa SKU tanpa foto',
      /sku\/kc_bear\.webp$/.test(foto.src) && foto.lebar > 0 && !foto.kosong, JSON.stringify(foto));

    /* ================= panel ================= */
    await klik(p, '[data-g3-krat="L4-R1-A"] [data-g3-label]'); await jeda(200);
    const panel = await g3(p, () => {
      const pn = document.querySelector('[data-g3-panel]'); if (!pn) return { teks: 'tanpa panel' }; const q = s => (pn.querySelector(s) || {}).textContent || '';
      return { kode: q('[data-g3-kartukode]'), nama: q('[data-g3-kartunama]'), isi: q('[data-g3-isi]'), st: (pn.querySelector('[data-g3-status]') || { getAttribute() { return ''; } }).getAttribute('data-g3-status'), ean: !!pn.querySelector('[data-g3-kartu] svg.ean13'), c128: !!pn.querySelector('[data-g3-kartu] svg.kode128'), pas: Array.from(pn.querySelectorAll('[data-g3-kartunama],[data-g3-kartulisting]')).map(e => e.scrollWidth <= e.clientWidth + 1).join(','), teks: pn.innerText };
    });
    c('G6 klik laci L4-R1-A: kartu peraga v11 (kode, Key Charm · Bear, barcode EAN-13 dan Code 128), 20 dari maks. 40 OK, SKU ini 24 pcs di 2 lokasi, laku 30 hari 2 pcs cukup sekitar 360 hari, nama dan listing di kartu muat utuh tanpa titik-titik, daftar lokasi SKU memuat L1-OF-1-02',
      panel.kode === 'L4-R1-A' && panel.nama === 'Key Charm · Bear' && panel.isi === '20' && panel.st === 'ok' && panel.ean && panel.c128 && /24 pcs · 2 locations/.test(panel.teks) && /Sold, last 30 days\s*2 pcs/.test(panel.teks) && /Lasts at this pace\s*about 360 days/.test(panel.teks) && panel.pas === 'true,true' && /L1-OF-1-02/.test(panel.teks) && /pcs left of 40 max/.test(panel.teks),
      JSON.stringify(panel).slice(0, 600));

    await p.evaluate(() => { window.__cetak3d = null; if (window.WmsAlat) window.WmsAlat.cetakKode = k => { window.__cetak3d = k; }; });
    const adaTombol = await klik(p, '[data-g3-panel] [data-g3-cetak]'); await jeda(150);
    c('G7 tombol "Print this card" di panel mencetak kartu lokasi yang sedang dibuka saja (L4-R1-A)',
      adaTombol && JSON.stringify(await p.evaluate(() => window.__cetak3d)) === '["L4-R1-A"]', String(adaTombol) + ' ' + JSON.stringify(await p.evaluate(() => window.__cetak3d)));

    /* ================= panah isi ulang ================= */
    const panah1 = await g3(p, () => Array.from(document.querySelectorAll('div[data-g3-panah]')).map(x => x.getAttribute('data-g3-panah')).join(','));
    await fe(p, () => { document.querySelector('input[data-g3-panahon]').click(); }); await jeda(150);
    const panah0 = await g3(p, () => document.querySelectorAll('div[data-g3-panah]').length);
    await fe(p, () => document.querySelector('input[data-g3-panahon]').click()); await jeda(150);
    c('G8 panah isi ulang cuma satu: dari karton overflow L1-OF-1-01 (Tiger 12) ke pick face L3-R1-B (Tiger 10%); Lamb di L0-T1-A tanpa sumber tidak diberi panah; kotak centang menyembunyikan panah',
      panah1 === 'L1-OF-1-01>L3-R1-B' && panah0 === 0, JSON.stringify({ panah1, panah0 }));

    /* ================= cari ================= */
    await isiInput(p, '[data-g3-cari]', 'tiger'); await jeda(150);
    const cari1 = await g3(p, () => ({ nyala: Array.from(document.querySelectorAll('[data-g3-nyala]')).map(x => x.getAttribute('data-g3-krat')).sort().join(','), hasil: document.querySelector('[data-g3-hasilcari]').textContent }));
    await fe(p, () => document.querySelector('[data-g3-cari]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); await jeda(450);
    const cari2 = await g3(p, () => ({ pilih: (document.querySelector('[data-g3-kartukode]') || {}).textContent, rot: document.querySelector('[data-g3-rot]').value, kamera: document.querySelector('[data-g3-lantai]').style.transform }));
    await isiInput(p, '[data-g3-cari]', '6360'); await jeda(150);
    const cari3 = await g3(p, () => Array.from(document.querySelectorAll('[data-g3-nyala]')).map(x => x.getAttribute('data-g3-krat')).join(','));
    await isiInput(p, '[data-g3-cari]', 't1-0a'); await jeda(150);
    const cari4 = await g3(p, () => Array.from(document.querySelectorAll('[data-g3-nyala]')).map(x => x.getAttribute('data-g3-krat')).join(','));
    await isiInput(p, '[data-g3-cari]', ''); await jeda(150);
    c('G9 cari "tiger" menyalakan L1-OF-1-01 dan L3-R1-B (2 ketemu); Enter membuka pick face L3-R1-B dulu dan kamera berputar ke sisi rak (Turn 35); ekor barcode 6360 = L2-R3-A; kode lama t1-0a = L0-T1-A',
      cari1.nyala === 'L1-OF-1-01,L3-R1-B' && /2 locations found/.test(cari1.hasil) && cari2.pilih === 'L3-R1-B' && cari2.rot === '35' && /rotateZ\(35deg\)/.test(cari2.kamera) && cari3 === 'L2-R3-A' && cari4 === 'L0-T1-A',
      JSON.stringify({ cari1, cari2, cari3, cari4 }));

    /* ================= zona ================= */
    await klik(p, '[data-g3-zona=TABLE]'); await jeda(150);
    const zona = await g3(p, () => {
      const terlihat = k => { const s = document.querySelector('[data-g3-krat="' + k + '"] [data-g3-label] span'); return s ? getComputedStyle(s).opacity : 'x'; };
      return { t: terlihat('L0-T1-A'), r: terlihat('L4-R1-A'), pilihan: document.querySelector('[data-g3-zona=TABLE]').getAttribute('aria-pressed') };
    });
    await klik(p, '[data-g3-zona=ALL]'); await jeda(150);
    c('G10 saring zona Table: stiker meja tetap terbaca, stiker rak disembunyikan dan kotaknya diredupkan; tombol menyala',
      zona.t === '1' && zona.r === '0' && zona.pilihan === 'true', JSON.stringify(zona));

    /* ================= cetak banyak ================= */
    /* 20 Okt, Ferdy: "bs print semua label apa 1. 1?" lalu "oke gas": tombol cetak di peta mencetak yang
       sedang terlihat: hasil cari, kalau tidak ada cari zona yang dipilih, kalau tidak ada keduanya semua lokasi.
       Urutannya urutan Location Master. */
    const cetakBanyak = async () => {
      await p.evaluate(() => { window.__cetak3d = null; });
      const ada = await klik(p, '[data-g3-cetaksemua]'); await jeda(150);
      return { ada, teks: await g3(p, () => (document.querySelector('[data-g3-cetaksemua]') || {}).textContent || ''), kode: await p.evaluate(() => window.__cetak3d) };
    };
    const cbSemua = await cetakBanyak();
    await klik(p, '[data-g3-zona=TABLE]'); await jeda(150);
    const cbMeja = await cetakBanyak();
    await isiInput(p, '[data-g3-cari]', 'tiger'); await jeda(150);
    const cbNol = await g3(p, () => { const x = document.querySelector('[data-g3-cetaksemua]'); return x ? x.disabled + ' ' + x.textContent : 'tidak ada'; });
    await klik(p, '[data-g3-zona=ALL]'); await jeda(150);
    await isiInput(p, '[data-g3-cari]', 'tiger'); await jeda(150);
    const cbCari = await cetakBanyak();
    await isiInput(p, '[data-g3-cari]', ''); await jeda(150);
    c('G18 cetak banyak dari peta: tanpa saringan 10 kartu (semua lokasi, urut Location Master); zona Table 2 kartu L0-T1-A, L3-T2-A; zona Table + cari "tiger" tidak ada yang menyala jadi tombolnya mati; semua zona + cari "tiger" 2 kartu L3-R1-B, L1-OF-1-01',
      cbSemua.ada && JSON.stringify(cbSemua.kode) === JSON.stringify(KODE3D) && /Print 10 cards/.test(cbSemua.teks) &&
      JSON.stringify(cbMeja.kode) === '["L0-T1-A","L3-T2-A"]' && /Print 2 cards/.test(cbMeja.teks) &&
      JSON.stringify(cbCari.kode) === '["L3-R1-B","L1-OF-1-01"]' && /^true /.test(cbNol),
      JSON.stringify({ cbSemua, cbMeja, cbCari, cbNol }));

    /* ================= panas laku ================= */
    await klik(p, '[data-g3-mode=panas]'); await jeda(150);
    const panas = { tiger: await warnaAtas(p, 'L3-R1-B'), tigerOf: await warnaAtas(p, 'L1-OF-1-01'), bear: await warnaAtas(p, 'L4-R1-A'), lamb: await warnaAtas(p, 'L0-T1-A'), staging: await warnaAtas(p, 'L1-IN-1-01') };
    await klik(p, '[data-g3-mode=isi]'); await jeda(150);
    c('G11 mode panas laku: Tiger (8 pcs 30 hari, tercepat) paling merah di kedua lokasinya, Bear (2 pcs) lebih pucat, Lamb (laku terakhir 1 Sep, di luar 30 hari) biru abu "tidak laku"',
      panas.tiger === 'rgb(217, 71, 47)' && panas.tigerOf === panas.tiger && panas.bear !== panas.tiger && panas.bear !== 'rgb(201, 214, 227)' && panas.lamb === 'rgb(201, 214, 227)', JSON.stringify(panas));

    /* ================= slider tanggal ================= */
    const angkaDi = (p, k) => fe(p, k => { const s = document.querySelector('[data-g3-krat="' + k + '"] [data-g3-label] span'); return s ? s.textContent.split('\n').pop() : ''; }, k);
    await isiInput(p, '[data-g3-tgl]', '23'); await jeda(200);
    const m7 = { staging: await angkaDi(p, 'L1-IN-1-01'), lamb: await angkaDi(p, 'L0-T1-A'), bear: await angkaDi(p, 'L4-R1-A'), label: await g3(p, () => document.querySelector('[data-g3-tgllabel]').textContent) };
    await isiInput(p, '[data-g3-tgl]', '18'); await jeda(200);
    const m12 = { staging: await angkaDi(p, 'L1-IN-1-01') };
    await isiInput(p, '[data-g3-tgl]', '30'); await jeda(200);
    const m0 = { staging: await angkaDi(p, 'L1-IN-1-01'), lamb: await angkaDi(p, 'L0-T1-A'), label: await g3(p, () => document.querySelector('[data-g3-tgllabel]').textContent) };
    c('G12 slider tanggal: 8 Oct (mundur 7 hari) staging 9 (Bear 6 + Tiger 3 belum keluar), Lamb di L0-T1-A 1 (4 pcs belum masuk), Bear di rak tetap 20, diberi tanda perkiraan; 3 Oct staging 14; kembali ke Today',
      m7.staging === '9' && m7.lamb === '1' && m7.bear === '20' && /8 Oct 2026/.test(m7.label) && /estimated/.test(m7.label) && m12.staging === '14' && m0.staging === '0' && m0.lamb === '5' && m0.label === 'Today',
      JSON.stringify({ m7, m12, m0 }));

    /* ================= seret ================= */
    await klik(p, '[data-g3-reset]'); await jeda(450);
    await bingkai(p).locator(S3 + '[data-g3-panggung]').scrollIntoViewIfNeeded(); await jeda(150);
    const kotak = await bingkai(p).locator(S3 + '[data-g3-panggung]').boundingBox();
    const sebelum = await g3(p, () => ({ rot: document.querySelector('[data-g3-rot]').value, tilt: document.querySelector('[data-g3-tilt]').value, pilih: (document.querySelector('[data-g3-kartukode]') || {}).textContent || '' }));
    await p.mouse.move(kotak.x + 40, kotak.y + 90); await p.mouse.down();
    await p.mouse.move(kotak.x + 140, kotak.y + 90, { steps: 6 }); await p.mouse.move(kotak.x + 140, kotak.y + 40, { steps: 4 });
    await p.mouse.up(); await jeda(200);
    const sesudah = await g3(p, () => ({ rot: document.querySelector('[data-g3-rot]').value, tilt: document.querySelector('[data-g3-tilt]').value, pilih: (document.querySelector('[data-g3-kartukode]') || {}).textContent || '' }));
    c('G13 seret lantai: geser kanan 100 px memutar +40 derajat, geser atas 50 px memiringkan +10 derajat, dan seretan tidak dianggap klik pilih',
      sebelum.rot === '24' && sesudah.rot === '64' && Number(sesudah.tilt) === Number(sebelum.tilt) + 10 && sesudah.pilih === sebelum.pilih, JSON.stringify({ sebelum, sesudah }));

    /* ================= 2D ================= */
    await klik(p, S3 + '[data-l4t-tampil="2d"]'); await jeda(250);
    const dua = await g3(p, s => ({ slot: document.querySelectorAll(s + '[data-l4t-slot]').length, krat: document.querySelectorAll(s + '[data-g3-krat]').length }), S3);
    await klik(p, S3 + '[data-l4t-tampil="3d"]'); await jeda(250);
    const tiga = await g3(p, s => {
      /* isi halaman Gudang papan lama (unggah dan unduh Location Master) tetap tampil di bawah peta */
      const sek = document.querySelector(s.trim()), lama = document.getElementById('ringkasanLama'), nav = document.querySelector('#panel .anak a.on');
      return { slot: document.querySelectorAll(s + '[data-l4t-slot]').length, krat: document.querySelectorAll(s + '[data-g3-krat]').length, judul: (document.querySelector(s + 'h1') || {}).textContent,
        lama: !!lama && getComputedStyle(lama).display !== 'none' && !!(sek.compareDocumentPosition(lama) & Node.DOCUMENT_POSITION_FOLLOWING), menu: nav ? nav.getAttribute('data-hal') + '=' + nav.textContent : '' };
    }, S3);
    c('G14 peta ada di Kondisi persediaan › Gudang (menu kondisi menyala), isi halaman Gudang lama tetap di bawahnya; tombol 2D membuka grid per level (11 slot), 3D kembali ke peta; judul Warehouse condition',
      dua.slot === 11 && dua.krat === 0 && tiga.slot === 0 && tiga.krat === 10 && tiga.judul === 'Warehouse condition' && tiga.lama && tiga.menu === 'kondisi=Kondisi persediaan', JSON.stringify({ dua, tiga }));
    await ctx.close();

    /* ================= HP, bahasa Indonesia ================= */
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await pasangRute(ctx2);
    const hp = await halaman(ctx2);
    await masuk(hp, 'id');
    await fe(hp, () => { document.documentElement.lang = 'id'; });
    await ke(hp, 'kondisi', () => !!document.querySelector('[data-l4t-hal-ini=kondisi] [data-g3-krat]'));
    await jeda(400);
    await klik(hp, '[data-g3-krat="L3-T2-A"] [data-g3-label]'); await jeda(200);
    const hpx = await g3(hp, s => {
      const pg = document.querySelector(s + '[data-g3-panggung]').getBoundingClientRect(), pn = document.querySelector(s + '[data-g3-panel]').getBoundingClientRect();
      return { lebar: document.documentElement.scrollWidth, panelBawah: Math.round(pn.top) >= Math.round(pg.bottom), pgLebar: Math.round(pg.width), judul: (document.querySelector(s + 'h1') || {}).textContent, teks: document.querySelector(s + '.g3').innerText, em: /—/.test(document.getElementById('isi').innerText) };
    }, S3);
    c('G15 HP 390 px: tanpa geser samping, peta selebar layar, panel lokasi di bawah peta, tanpa tanda pisah panjang',
      hpx.lebar <= 392 && hpx.pgLebar <= 392 && hpx.panelBawah && !hpx.em, JSON.stringify(Object.assign({}, hpx, { teks: '' })));
    c('G16 bahasa Indonesia: judul Kondisi gudang, legenda Kosong / Di bawah 50%, panel "Cetak kartu ini" dan "Sisa ruang"',
      hpx.judul === 'Kondisi gudang' && /Kosong/.test(hpx.teks) && /Di bawah 50%/.test(hpx.teks) && /Cetak kartu ini/.test(hpx.teks) && /Sisa ruang/.test(hpx.teks), hpx.judul + ' ' + hpx.teks.slice(0, 400));
    await ctx2.close();
  } catch (e) {
    c('MATI di tengah jalan', false, e.stack);
  }
  c('G17 tidak ada galat JavaScript selama uji', galat.length === 0, galat.join(' | ').slice(0, 500));

  await b.close(); srv.close();
  let gagal = 0;
  cek.forEach(([n, ok, k]) => { if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '  -> ' + String(k).slice(0, 700))); });
  if (cek.length !== DIHARAPKAN) { console.log('BAHAYA: ' + cek.length + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN); gagal++; }
  console.log('\n' + cek.length + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
  process.exit(gagal ? 1 : 0);
})();
