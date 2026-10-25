/* Uji WMS: saklar fitur gemas Kitabku dan editor tanggal ulang tahun karakter (25 Okt 2026).
 * Harapan: "9 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy menyetujui mockup canvas 32 sampai 41 (adopsi, ulang tahun, kamar, kapsul, surat buddy,
 * musim, foto, wardrobe) dan memilih "Claude bikin daftarnya" untuk tanggal ulang tahun, yang bisa diubah dari WMS.
 * Yang mahal kalau salah:
 *  - saklar fitur baru tidak muncul di WMS, jadi fitur yang sudah terpasang di server tidak bisa dinyalakan;
 *  - tombol saklar fitur baru mengirim nama fitur yang beda dengan server (server menolak, layar diam);
 *  - "Vegetable Cap stamps" masih berlabel lama padahal sekarang cap coba seminggu (tim salah paham soal hadiahnya);
 *  - tanggal ulang tahun salah tulis (13-01, 31-02) terkirim, atau tersimpan tanpa kabar;
 *  - galat server saat menyimpan tanggal tidak terlihat.
 * Papan palsu, rute, dan masuk WMS sama dengan uji-kitabku-saklar.js.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const AKAR = process.env.AKAR || path.resolve(__dirname, '..');
const API = 'https://script.google.com/macros/s/AKfycbzslW9akcAS2EINjrdcllgpGpuQzz_I2jHtNyEWixS-yl2HSsqE5kfTDjDGR8H_Zcq9xA/exec';
const SUPA = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/wms';
const KITAB = /oloxoxmfbfxxibksxeug\.supabase\.co\/functions\/v1\/kitab$/;
const KODE_BENAR = 'KODE-PALSU-UJI';
const DIHARAPKAN = 15;
const jenis = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(AKAR, p);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': jenis[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});

/* ---------- server Kitabku palsu ---------- */
const FITUR = ['kirim', 'ucapan', 'minta', 'kurir', 'balas', 'bond', 'surat', 'buddy', 'slot', 'unbox', 'cap', 'elus', 'loading', 'podium', 'tenang', 'freeze', 'share', 'notif',
  'adopsi', 'ultah', 'kamar', 'kapsul', 'suratbuddy', 'musim', 'foto', 'lemari', 'kapsuledisi', 'fotokartu'];
const GEMAS = ['adopsi', 'ultah', 'kamar', 'kapsul', 'suratbuddy', 'musim', 'foto', 'lemari', 'kapsuledisi', 'fotokartu'];
let SK, ULTAH, galatUltah = false;
const panggilan = [];
function setel() {
  SK = { saklar: FITUR.map((f) => ({ fitur: f, mode: 'off', diubah: null, oleh: null })), log: [], staf: [] };
  /* daftar karakter seperti jawaban aksi admin ultah di gemas.js (nama, tanggal BB-HH, satu kartu contoh) */
  ULTAH = [['bear', 'Bear', '01-14'], ['panda', 'Panda', '02-08'], ['koala', 'Koala', '05-03'], ['shiba', 'Shiba', '11-01'], ['tiger', 'Tiger', '07-29']]
    .map(([k, n, t], i) => ({ karakter: k, nama: n, tanggal: t, kartu: null, pemilik: [12, 40, 7, 412, 3][i] }));
}
setel();
/* jawaban aksi admin cobaBeli (gemas.js): 5 pinjaman, 1 jadi beli dalam 14 hari, 1 masih berjalan */
let COBA = { ok: true, acara: { id: 'a1', nama: '11.11 Big Sale' }, total: { pinjam: 5, beli: 1, berjalan: 1 },
  jenis: { cap: { pinjam: 4, beli: 1, berjalan: 1 }, tas: { pinjam: 1, beli: 0, berjalan: 0 }, jimat: { pinjam: 0, beli: 0, berjalan: 0 }, mainan: { pinjam: 0, beli: 0, berjalan: 0 } },
  barang: [{ jenis: 'cap', kode: '4582586966360', nama: 'Tomato Cap', pinjam: 3, beli: 1, berjalan: 1 }, { jenis: 'tas', kode: '4582586968340', nama: 'Pink Mini Backpack', pinjam: 1, beli: 0, berjalan: 0 }, { jenis: 'cap', kode: '4582586964021', nama: 'Banana Cap', pinjam: 1, beli: 0, berjalan: 0 }] };
function jawabKitab(m) {
  panggilan.push(m);
  const a = m.aksi;
  if (a === 'saklar') return { ok: true, saklar: SK.saklar, log: SK.log, staf: SK.staf };
  if (a === 'ubahSaklar') { const x = SK.saklar.find((z) => z.fitur === m.fitur); if (!x) return { ok: false, pesan: 'Fitur tidak dikenal.' }; x.mode = m.mode; x.oleh = m.oleh; x.diubah = '2026-10-25T09:00:00Z'; return { ok: true }; }
  if (a === 'cobaBeli') return COBA;
  if (a === 'ultah') return { ok: true, karakter: ULTAH };
  if (a === 'ubahUltah') {
    if (galatUltah) return { ok: false, pesan: 'Server Kitabku sedang galat (uji).' };
    const x = ULTAH.find((z) => z.karakter === m.karakter); if (!x) return { ok: false, pesan: 'Karakter tidak dikenal.' };
    x.tanggal = m.tanggal; return { ok: true };
  }
  if (a === 'statKitab') return { ok: true, hari: 14, aktif: [], kirim: 0, dariMinta: 0, minta: 0, mintaDipenuhi: 0, corong: { kirim: 0, dibuka: 0, penerimaBaru: 0, scanSendiri: 0 }, buddy: [], share: 0, notifBuka: 0, elus: 0 };
  if (a === 'ringkas') return { ok: true, acara: null, angka: { kartu: 0, pemain: 0, struk: 0, klaim: 0, kode: 0, dipakai: 0 }, hadiah: [] };
  if (a === 'struk') return { ok: true, baris: [] };
  if (a === 'daftarCetak') return { ok: true, batch: [] };
  return { ok: false, pesan: 'Aksi tidak dikenal.' };
}
const terakhir = (aksi) => panggilan.filter((x) => x.aksi === aksi).slice(-1)[0] || null;
const jumlah = (aksi) => panggilan.filter((x) => x.aksi === aksi).length;

/* ---------- papan lama palsu: HALAMAN, gambarPanel, pasangMenu asli (lihat uji-menu-kiriman.js) ---------- */
const SKRIP = function () {
  window.HAL = 'ringkasan';
  var HALAMAN = [
    ['ringkasan', 'Ringkasan', '■', []],
    ['stok', 'Persediaan', '▤', [['bukubesar', 'Buku besar bulanan'], ['opname', 'Stok opname & hitung fisik', [['opname', 'Stok opname'], ['hitung', 'Hitung fisik (pindai)']]], ['kondisi', 'Kondisi persediaan', [['kondisi', 'Gudang'], ['stokgerai', 'Gerai offline']]]]],
    ['laku', 'Penjualan', '◥', [['bulanan', 'Laporan bulanan'], ['dokumen', 'Dokumen mitra']]],
    ['rencana', 'Pengiriman', '→', [['pesanan', 'Pesanan'], ['kemas', 'Surat jalan & PO', [['kemas', 'Surat jalan'], ['bacapo', 'Baca PO']]], ['kembali', 'Barang kembali']]],
    ['kinerja', 'Lapangan', '☺', [['jadwal', 'Jadwal kunjungan'], ['foto', 'Foto rak (sampai 30 Sep 2026)']]],
    ['sehat', 'Kualitas data', '✚', []]
  ];
  window.HALAMAN = HALAMAN;
  window.grupTerbuka = function (kode) {
    var H = window.HALAMAN;
    for (var i = 0; i < H.length; i++) {
      var g = H[i]; if (g[0] === kode) return g[0];
      for (var j = 0; j < g[3].length; j++) { var c = g[3][j]; if (c[0] === kode) return g[0]; if (c[2]) for (var k = 0; k < c[2].length; k++) if (c[2][k][0] === kode) return g[0]; }
    }
    return 'ringkasan';
  };
  var el = function (i) { return document.getElementById(i); };
  window.gambarPanel = function () {
    var H = window.HALAMAN, buka = window.grupTerbuka(HAL), s = '<h3><span>Papan</span></h3>';
    H.forEach(function (o) {
      var kls = HAL === o[0] ? 'on' : (buka === o[0] && o[3].length ? 'induk' : '');
      s += '<a tabindex="0" data-hal="' + o[0] + '"' + (kls ? ' class="' + kls + '"' : '') + '><span class="iknKotak"><svg class="ikn" viewBox="0 0 24 24"></svg></span><span class="pnlNama">' + o[1] + '</span></a>';
      if (buka === o[0] && o[3].length) {
        s += '<div class="anak">';
        o[3].forEach(function (c) { s += '<a tabindex="0" data-hal="' + c[0] + '"' + (HAL === c[0] ? ' class="on"' : '') + '>' + c[1] + '</a>'; });
        s += '</div>';
      }
    });
    var np = el('panel'); if (np && np.innerHTML !== s) np.innerHTML = s;
  };
  window.pasangSubJudul = function (a, b) { el('subJudul').innerHTML = '<span>' + a + '</span> · <span>' + b + '</span>'; };
  window.gambar = function () { window.gambarPanel(); el('isi').innerHTML = '<div class="k" id="hal-' + HAL + '">' + HAL + '</div>'; };
  /* klik menu kiri ala papan: pindah halaman */
  document.addEventListener('DOMContentLoaded', function () {
    el('panel').addEventListener('click', function (e) { var a = e.target.closest('a[data-hal]'); if (!a) return; e.preventDefault(); window.HAL = a.getAttribute('data-hal'); window.__pindahPapan = (window.__pindahPapan || 0) + 1; window.gambar(); });
  });
  /* skrip Gudang yang ditunda: menyisipkan grup outbound dan menggambar ulang menu */
  function pasangMenu() {
    var H = window.HALAMAN, ada = false, iKirim = -1;
    for (var i = 0; i < H.length; i++) { if (H[i][0] === 'outbound') ada = true; if (H[i][0] === 'rencana') iKirim = i; }
    var berubah = false;
    if (!ada) { H.splice(iKirim + 1, 0, ['outbound', 'Gudang', '', [['outbound', 'Offline'], ['obdShopee', 'Shopee'], ['obdIsiUlang', 'Isi ulang rak']]]); berubah = true; }
    if (berubah && typeof gambarPanel === 'function') { try { gambarPanel(); } catch (eP) {} }
    window.__pasangMenu = (window.__pasangMenu || 0) + 1;
    try { gambarPanel(); } catch (eP2) {}
  }
  setTimeout(function () { pasangMenu(); setInterval(pasangMenu, 700); }, 400);
};
const PAPAN_PALSU = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Papan</title>' +
  '<style>body{margin:0;background:#FBF8F0;font-family:Arial,sans-serif}#layarIsi{display:none}.rangka{display:flex}.panel{flex:0 0 236px}.utama{flex:1;min-width:0;padding:16px}' +
  '.panel a{display:block}.anak{padding-left:12px}@media(max-width:900px){.rangka{display:block}.panel{display:flex;flex-wrap:wrap;overflow-x:auto}}</style></head><body>' +
  '<div id="layarKode"><input id="kode"><button onclick="buka()">Masuk</button></div>' +
  '<div id="layarIsi"><header><div class="bungkus"><h1>Papan Data</h1><div id="subJudul"></div><div id="kopKanan"></div></div></header>' +
  '<div class="rangka"><nav class="panel" id="panel"></nav><div class="utama"><div id="isi" class="petak"></div></div></div></div>' +
  '<script>var KODE="";(' + SKRIP.toString() + ')();function buka(){KODE=document.getElementById("kode").value;google.script.run.withSuccessHandler(function(r){document.getElementById("layarKode").style.display="none";document.getElementById("layarIsi").style.display="block";gambar();window.__siap=1;}).dataPapan(KODE);}<\/script></body></html>';
const DATA = { ok: true, hariIni: '2026-10-24', bulanIni: '2026-10', lok: [{ k: 'HO', n: 'HO', toko: 0 }], prod: [], baris: [] };
const PALSU_AWAL = () => {
  try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__salin = t; return Promise.resolve(); } } }); } catch (e) {}
  function Ctx() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  Ctx.prototype.createOscillator = function () { return { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; };
  Ctx.prototype.createGain = function () { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; };
  Ctx.prototype.resume = function () {};
  window.AudioContext = Ctx; window.webkitAudioContext = Ctx;
};

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const URL0 = 'http://localhost:' + srv.address().port + '/wms/';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const jeda = (ms) => new Promise((x) => setTimeout(x, ms));
  const pasangRute = async (ctx) => {
    await ctx.addInitScript(PALSU_AWAL);
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route(API + '**', async (r) => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      const h = m.fn === 'panggil' && m.nama === 'dataPapan' ? { pintu: 'ok', hasil: DATA } : { pintu: 'galat', pesan: 'Fungsi "' + (m.nama || m.fn) + '" tidak dibuka untuk WMS.' };
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(h) });
    });
    await ctx.route(SUPA, async (r) => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      let h;
      if (m.fn === 'masuk') h = String(m.kode || '').trim().toUpperCase() === KODE_BENAR ? { ok: true, tiket: 'TIKET.SUPA', ingat: true } : { ok: false, pesan: 'no' };
      else if (m.fn === 'ambil') {
        const w = new Date(Date.now() - 60000).toISOString(), o = { 'dataPapan|["K"]': DATA, 'klien|papan': { ok: true, versi: 'saklar', html: PAPAN_PALSU }, 'klien|versi': { ok: true, versi: 'saklar' } };
        const isi = {}; (m.kunci || []).forEach((k) => { if (o[k]) isi[k] = { waktu: w, data: o[k] }; });
        h = { ok: true, isi };
      } else h = { ok: false };
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
    });
    await ctx.route(KITAB, async (r) => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(jawabKitab(m)) });
    });
  };
  const cek = []; const c = (n, ok, k) => cek.push([n, !!ok, k]);
  const galat = [];
  const halaman = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => galat.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) galat.push(m.text()); }); return p; };
  const bingkai = (p) => p.frames().find((f) => f !== p.mainFrame());
  const tungguBingkai = async (p, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { try { const f = bingkai(p); if (f && await f.evaluate(fn)) return true; } catch (e) {} await jeda(80); } return false; };
  const fe = (p, fn, arg) => bingkai(p).evaluate(fn, arg);
  const masuk = async (p, bhs, tema) => {
    await p.goto(URL0);
    await p.evaluate((x) => { localStorage.setItem('wms_tema', x[1]); localStorage.setItem('wms_bhs', x[0]); }, [bhs || 'en', tema || 'light']);
    await p.reload();
    await p.waitForFunction(() => document.getElementById('formMasuk'), null, { timeout: 6000 }).catch(() => {});
    await p.fill('#kode', 'kode-palsu-uji'); await p.click('#tMasuk');
    await tungguBingkai(p, () => window.__siap === 1 && window.__l4Tata === true && window.__pasangMenu >= 1, 10000);
    await jeda(300);
  };
  const menu = (p) => fe(p, () => {
    const pn = document.getElementById('panel');
    return {
      atas: Array.from(pn.children).filter((x) => x.tagName === 'A').map((a) => a.getAttribute('data-hal')),
      kitab: Array.from(pn.querySelectorAll('[data-l4t-kitab]:not([data-l4t-kitab=grup])')).map((a) => a.getAttribute('data-l4t-kitab') + '=' + a.textContent.trim()),
      nGrup: pn.querySelectorAll('[data-l4t-kitab=grup]').length
    };
  });
  const tunggu = async (p, fn, arg, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 5000)) { try { if (await p.evaluate(fn, arg)) return true; } catch (e) {} await jeda(60); } return false; };
  const tabAktif = (p) => p.evaluate(() => { const d = document.getElementById('kitabkuAdmin'); if (!d || !d.classList.contains('buka')) return 'tertutup'; const x = d.querySelector('.tab-alat [aria-selected=true]'); return x ? x.getAttribute('data-kbtab') : '(tanpa tab)'; });
  const tutupKitab = (p) => p.evaluate(() => window.WmsKitabku && window.WmsKitabku.tutup());
  const angka = (s) => { const m = String(s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const baris = (p) => p.evaluate(() => Array.from(document.querySelectorAll('#kbSaklar [data-sk-fitur]')).map((r) => ({
    f: r.getAttribute('data-sk-fitur'),
    mode: (r.querySelector('[data-kb=skMode][aria-pressed=true]') || { getAttribute: () => '' }).getAttribute('data-mode'),
    status: (r.querySelector('[data-sk-status]') || { getAttribute: () => '' }).getAttribute('data-sk-status'),
    oleh: ((r.querySelector('.kb-sk-oleh') || {}).textContent || '').trim()
  })));
  const bukaTab = async (p, tab, sel) => { await p.evaluate((t) => window.WmsKitabku.buka(t), tab); await tunggu(p, (s) => !!document.querySelector(s), sel, 5000); await jeda(150); };

  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
    await pasangRute(ctx);
    const p = await halaman(ctx);
    await masuk(p, 'en');
    await bukaTab(p, 'saklar', '#kbSaklar [data-sk-fitur]');
    const B0 = await baris(p);
    const nama = await p.evaluate((G) => G.map((f) => { const r = document.querySelector('#kbSaklar [data-sk-fitur="' + f + '"]'); return r ? f + '=' + r.querySelector('.kb-sk-nama b').textContent : f + '=(tidak ada)'; }), GEMAS);
    c('W1 sepuluh saklar gemas tampil dan Off, ringkasan menghitung 28 fitur',
      GEMAS.every((f) => B0.some((x) => x.f === f && x.mode === 'off')) && B0.length === 28 && /0 of 28/.test(await p.evaluate(() => document.querySelector('#kbSaklar h3 small').textContent)),
      JSON.stringify([B0.length, nama]));
    c('W2 nama fitur gemas dalam bahasa Inggris, termasuk Edition capsule dan Me in Kitabku',
      nama.join('|') === 'adopsi=Adoption certificate|ultah=Character birthdays|kamar=Mofmo Room|kapsul=Daily capsule|suratbuddy=Buddy letters|musim=Seasonal outfits|foto=Photo with plush|lemari=Buddy wardrobe|kapsuledisi=Edition capsule|fotokartu=Me in Kitabku', nama.join('|'));
    const capNama = await p.evaluate(() => { const r = document.querySelector('#kbSaklar [data-sk-fitur=cap]'); return r.querySelector('.kb-sk-nama b').textContent + ' / ' + r.querySelector('.kb-sk-nama small').textContent; });
    const lemNama = await p.evaluate(() => document.querySelector('#kbSaklar [data-sk-fitur=lemari] .kb-sk-nama small').textContent);
    c('W3 saklar cap berlabel coba seminggu dari streak 7 hari yang bergiliran cap, tas, charm, mainan (selama wardrobe nyala); wardrobe menyebut aksesoris',
      /Streak trial/i.test(capNama) && /week/i.test(capNama) && /bag/i.test(capNama) && /charm/i.test(capNama) && /bag/i.test(lemNama) && /toy/i.test(lemNama), capNama + ' | ' + lemNama);
    await p.click('#kbSaklar [data-sk-fitur=kamar] [data-kb=skMode][data-mode="10"]');
    await tunggu(p, () => { const r = document.querySelector('#kbSaklar [data-sk-fitur=kamar] [aria-pressed=true]'); return r && r.getAttribute('data-mode') === '10'; }, null, 3000);
    const u = terakhir('ubahSaklar');
    c('W4 Mofmo Room ke 10%: server menerima fitur "kamar" mode "10", baris jadi Rollout', u && u.fitur === 'kamar' && u.mode === '10' && SK.saklar.find((x) => x.fitur === 'kamar').mode === '10', JSON.stringify(u));
    await tunggu(p, () => document.querySelectorAll('#kbUltah [data-ul-kar]').length > 0, null, 4000);
    const ul = await p.evaluate(() => Array.from(document.querySelectorAll('#kbUltah [data-ul-kar]')).map((x) => x.getAttribute('data-ul-kar') + '=' + x.value));
    c('W5 editor ulang tahun memuat daftar dari server (karakter = tanggal BB-HH)', ul.join(',') === 'bear=01-14,panda=02-08,koala=05-03,shiba=11-01,tiger=07-29', ul.join(','));
    /* kalender ulang tahun (mockup 45): urutan dan jarak hari dihitung ulang di sini dari jam uji (WIB) */
    const hariIni = new Date(Date.now() + 7 * 3600e3), th = hariIni.getUTCFullYear();
    const jarak = (t) => { const [b, h] = t.split('-').map(Number); let d = Date.UTC(th, b - 1, h); const n0d = Date.UTC(th, hariIni.getUTCMonth(), hariIni.getUTCDate()); if (d < n0d) d = Date.UTC(th + 1, b - 1, h); return Math.round((d - n0d) / 864e5); };
    const harap90 = ULTAH.map((r) => [r.karakter, jarak(r.tanggal)]).filter((x) => x[1] <= 90).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    await p.click('#kbUltah [data-kb=ulRentang][data-n="90"]'); await jeda(200);
    const kal = await p.evaluate(() => Array.from(document.querySelectorAll('#kbUltah [data-ul-segera]')).map((x) => ({ k: x.getAttribute('data-ul-segera'), t: x.textContent.replace(/\s+/g, ' ') })));
    await p.click('#kbUltah [data-kb=ulRentang][data-n="all"]'); await jeda(200);
    const nAll = await p.evaluate(() => document.querySelectorAll('#kbUltah [data-ul-segera]').length);
    const sh = kal.find((x) => x.k === 'shiba') || { t: '' };
    c('W10 kalender 90 hari: karakter yang ulang tahun dalam 90 hari, urut dari yang terdekat, dengan jumlah pemilik dan draf caption; "All" menampilkan semua',
      kal.map((x) => x.k).join(',') === harap90.join(',') && nAll === ULTAH.length && (!harap90.includes('shiba') || (/412 owners/.test(sh.t) && /Shiba/.test(sh.t) && /#mofmofriends/.test(sh.t))), JSON.stringify([kal, harap90, nAll]));
    const k0 = kal[0] && kal[0].k;
    if (k0) { await p.click('#kbUltah [data-kb=ulRentang][data-n="90"]'); await jeda(150); await p.click('#kbUltah [data-kb=ulSalin][data-kar="' + k0 + '"]'); await jeda(200); }
    const salin = await p.evaluate(() => ({ papan: window.__salin || '', pesan: (document.querySelector('#kbUltahPesan') || {}).textContent || '' }));
    c('W11 Copy caption menyalin draf caption karakter itu ke clipboard dan memberi kabar', !k0 || (salin.papan.length > 20 && new RegExp(ULTAH.find((x) => x.karakter === k0).nama).test(salin.papan) && /copied/i.test(salin.pesan)), JSON.stringify(salin));
    const n0 = jumlah('ubahUltah');
    await p.fill('#kbUltah [data-ul-kar=shiba]', '02-29'); await p.click('#kbUltah [data-kb=ulSimpan][data-kar=shiba]'); await jeda(300);
    const salah = await p.evaluate(() => (document.querySelector('#kbUltahPesan') || {}).textContent || '');
    c('W6 tanggal 02-29 ditolak (tahun biasa tidak punya tanggal itu) di layar (tidak ke server), pesannya menjelaskan format BB-HH', jumlah('ubahUltah') === n0 && /MM-DD/.test(salah), salah);
    await p.fill('#kbUltah [data-ul-kar=shiba]', '11-02'); await p.click('#kbUltah [data-kb=ulSimpan][data-kar=shiba]');
    await tunggu(p, () => /saved/i.test((document.querySelector('#kbUltahPesan') || {}).textContent || ''), null, 3000);
    const s = terakhir('ubahUltah'), ok = await p.evaluate(() => (document.querySelector('#kbUltahPesan') || {}).textContent || '');
    c('W7 11-02 untuk Shiba: server menerima karakter "shiba" tanggal "11-02", pesan berhasil menyebut Shiba', s && s.karakter === 'shiba' && s.tanggal === '11-02' && ULTAH.find((x) => x.karakter === 'shiba').tanggal === '11-02' && /Shiba/.test(ok), JSON.stringify([s, ok]));
    galatUltah = true;
    await p.fill('#kbUltah [data-ul-kar=bear]', '01-15'); await p.click('#kbUltah [data-kb=ulSimpan][data-kar=bear]');
    await tunggu(p, () => /galat/i.test((document.querySelector('#kbUltahPesan') || {}).textContent || ''), null, 3000);
    const g = await p.evaluate(() => { const x = document.querySelector('#kbUltahPesan'); return x ? x.getAttribute('role') + ' ' + x.textContent : ''; });
    c('W8 server galat saat simpan: pesan galat server tampil sebagai alert', /^alert/.test(g) && /galat/i.test(g), g);
    galatUltah = false;
    /* panel pinjaman jadi beli di Engagement (25 Okt sore) */
    await bukaTab(p, 'libat', '#kbCobaBeli');
    await tunggu(p, () => /Tomato Cap/.test((document.querySelector('#kbCobaBeli') || {}).textContent || ''), null, 4000);
    const cb = await p.evaluate(() => { const x = document.querySelector('#kbCobaBeli'); const q = (s) => [...x.querySelectorAll(s)];
      return { kpi: Object.fromEntries(q('[data-cb-kpi]').map((y) => [y.dataset.cbKpi, y.querySelector('b').textContent.trim()])),
        jenis: Object.fromEntries(q('[data-cb-jenis]').map((y) => [y.dataset.cbJenis, y.textContent.replace(/\s+/g, ' ').trim()])),
        barang: q('[data-cb-barang]').map((y) => [...y.children].map((z) => z.textContent.trim()).join('|')), teks: x.textContent }; });
    if (process.env.FOTO) { await p.evaluate(() => document.querySelector('#kbCobaBeli').scrollIntoView()); await jeda(200); await p.screenshot({ path: process.env.FOTO }); }
    c('W10 panel "Streak trial to purchase": 5 pinjaman, 1 jadi beli, konversi 25% dari pinjaman yang jendela 14 harinya sudah lewat (1 dari 4), 1 masih berjalan',
      terakhir('cobaBeli') && cb.kpi.pinjam === '5' && cb.kpi.beli === '1' && cb.kpi.persen === '25%' && cb.kpi.berjalan === '1' && /11\.11 Big Sale/.test(cb.teks), JSON.stringify(cb));
    c('W11 per jenis (cap, bag, charm, toy) dan per barang dengan nama, urut terbanyak dipinjam',
      /1 of 4/.test(cb.jenis.cap || '') && /0 of 1/.test(cb.jenis.tas || '') && /no trials/i.test(cb.jenis.jimat || '') && cb.barang[0] === 'Tomato Cap|3|1|1' && cb.barang[1] === 'Pink Mini Backpack|1|0|0', JSON.stringify(cb));
    const coba0 = COBA; COBA = Object.assign({}, coba0, { total: { pinjam: 0, beli: 0, berjalan: 0 }, barang: [], jenis: { cap: { pinjam: 0, beli: 0, berjalan: 0 }, tas: { pinjam: 0, beli: 0, berjalan: 0 }, jimat: { pinjam: 0, beli: 0, berjalan: 0 }, mainan: { pinjam: 0, beli: 0, berjalan: 0 } } });
    await p.click('[data-kb=lbHari][data-hari="7"]');
    await tunggu(p, () => /No trials yet/i.test((document.querySelector('#kbCobaBeli') || {}).textContent || ''), null, 4000);
    const kosong = await p.evaluate(() => (document.querySelector('#kbCobaBeli') || {}).textContent || '');
    COBA = coba0;
    c('W12 belum ada pinjaman: pesan kosong yang menjelaskan kapan pinjaman pertama muncul, bukan 0% yang menakutkan', /No trials yet/i.test(kosong) && /7-day/i.test(kosong) && !/0%/.test(kosong), kosong);
    await ctx.close();
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await pasangRute(ctx2);
    const hp = await halaman(ctx2);
    await masuk(hp, 'id');
    await bukaTab(hp, 'saklar', '#kbSaklar [data-sk-fitur]');
    await tunggu(hp, () => document.querySelectorAll('#kbUltah [data-ul-kar]').length > 0, null, 4000);
    const idT = await hp.evaluate(() => ({ kamar: (document.querySelector('#kbSaklar [data-sk-fitur=kamar] .kb-sk-nama b') || {}).textContent, judul: (document.querySelector('#kbUltah h3') || {}).textContent, lebar: document.documentElement.scrollWidth }));
    c('W9 bahasa Indonesia di HP: "Kamar Mofmo", judul "Ulang tahun karakter", tidak bergeser ke samping', idT.kamar === 'Kamar Mofmo' && /Ulang tahun karakter/.test(idT.judul || '') && idT.lebar <= 392, JSON.stringify(idT));
    await ctx2.close();
  } catch (e) {
    c('MATI di tengah jalan', false, e.stack);
  }
  c('G1 tidak ada galat JavaScript selama uji', galat.length === 0, galat.join(' | ').slice(0, 600));

  await b.close(); srv.close();
  let gagal = 0;
  cek.forEach(([n, ok, k]) => { if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '  -> ' + String(k).slice(0, 600))); });
  if (cek.length !== DIHARAPKAN) { console.log('BAHAYA: ' + cek.length + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN); gagal++; }
  console.log('\n' + cek.length + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
  process.exit(gagal ? 1 : 0);
})();
