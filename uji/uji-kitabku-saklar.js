/* Uji saklar fitur dan halaman keterlibatan Kitabku di WMS, plus grup Kitabku di menu kiri (24 Okt 2026).
 * Harapan: "30 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy menyetujui mockup WmsSwitch dan WmsEngage, lalu: "kitabku naikin diatas data
 * quality". Fitur rilis baru Kitabku (kirim kartu, ucapan, kurir, buddy, cap sayur, share, notif, dst.)
 * dinyalakan bertahap dari WMS tanpa deploy ulang: Mati, Staf saja, 10%, 50%, Semua. Yang mahal kalau salah:
 *  - tombol 10% ternyata mengirim mode lain, atau layar menulis "Live" padahal server menolak, jadi tim
 *    mengira fitur sudah jalan ke semua pemain;
 *  - tombol darurat "matikan semua" langsung jalan tanpa konfirmasi (satu salah klik mematikan rilis);
 *  - akun staf tidak benar benar ditambah atau dihapus di server;
 *  - angka keterlibatan di layar beda dengan angka server (laporan ke principal salah);
 *  - tiket WMS habis atau server galat menghasilkan halaman kosong tanpa pesan;
 *  - grup Kitabku hilang atau pindah ke bawah Data Quality waktu skrip Gudang papan lama menggambar ulang
 *    menu tiap 700 ms, atau sub menunya malah membuat papan pindah halaman alih alih membuka Kitabku;
 *  - lembar Kitabku bergeser ke samping di HP gudang (390 px).
 * Papan palsu memakai HALAMAN, gambarPanel dan pasangMenu salinan papan asli (sama dengan uji-menu-kiriman.js),
 * ditambah klik menu kiri ala papan (HAL = data-hal lalu gambar), supaya terbukti klik sub menu Kitabku tidak
 * bocor ke papan. Server Kitabku palsu disusun di bawah; angka harapan dihitung dari rumus fixture yang sama.
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const AKAR = process.env.AKAR || path.resolve(__dirname, '..');
const API = 'https://script.google.com/macros/s/AKfycbzslW9akcAS2EINjrdcllgpGpuQzz_I2jHtNyEWixS-yl2HSsqE5kfTDjDGR8H_Zcq9xA/exec';
const SUPA = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/wms';
const KITAB = /oloxoxmfbfxxibksxeug\.supabase\.co\/functions\/v1\/kitab$/;
const KODE_BENAR = 'KODE-PALSU-UJI';
const DIHARAPKAN = 30;
const jenis = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
const srv = http.createServer((q, s) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(AKAR, p);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': jenis[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});

/* ---------- server Kitabku palsu ---------- */
const FITUR = ['kirim', 'ucapan', 'minta', 'kurir', 'balas', 'bond', 'surat', 'buddy', 'slot', 'unbox', 'cap', 'elus', 'loading', 'podium', 'tenang', 'freeze', 'share', 'notif'];
let SK, modeSrv = 'normal'; /* normal | habis (perluMasuk) | galat ({ok:false,pesan}) | kosong (tabel belum ada) */
const panggilan = [];
function setel() {
  SK = { saklar: FITUR.map((f) => ({ fitur: f, mode: 'off', diubah: null, oleh: null })), log: [], staf: [{ id: 's1', nama: 'Ferdy', tag: '1001' }] };
  const pasang = (f, m, w) => { const x = SK.saklar.find((z) => z.fitur === f); x.mode = m; x.diubah = w; x.oleh = 'Ferdy'; };
  pasang('kirim', 'semua', '2026-10-24T14:40:00Z'); pasang('minta', '50', '2026-10-24T14:42:00Z');
  pasang('buddy', '10', '2026-10-24T14:45:00Z'); pasang('cap', 'staf', '2026-10-24T14:46:00Z');
  SK.log = [{ fitur: 'cap', dari: 'off', ke: 'staf', oleh: 'Ferdy', waktu: '2026-10-24T14:46:00Z' }, { fitur: 'buddy', dari: 'staf', ke: '10', oleh: 'Ferdy', waktu: '2026-10-24T14:45:00Z' }];
}
setel();
/* statistik per periode: rumus sengaja bergantung pada hari supaya ganti chip terbukti mengganti angka */
const tglMundur = (n) => new Date(Date.parse('2026-10-24T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);
function STAT(hari) {
  return {
    ok: true, hari,
    aktif: Array.from({ length: hari }, (_, i) => ({ tgl: tglMundur(hari - 1 - i), n: 100 + i * 7 })),
    kirim: hari * 13, dariMinta: hari * 4, minta: hari * 5, mintaDipenuhi: hari * 4,
    corong: { kirim: hari * 13, dibuka: hari * 12, penerimaBaru: hari * 3, scanSendiri: hari * 2 - 1 },
    buddy: [{ kartu: '4582586950512', nama: 'Shiba', n: 142 }, { kartu: '4582586966629', nama: 'Koala', n: 88 }, { kartu: '4582586966605', nama: 'Red Panda', n: 61 }],
    share: 0, notifBuka: 37, elus: 1240 + hari
  };
}
function jawabKitab(m) {
  panggilan.push(m);
  if (modeSrv === 'habis') return { ok: false, perluMasuk: true };
  if (modeSrv === 'galat' && (m.aksi === 'saklar' || m.aksi === 'statKitab')) return { ok: false, pesan: 'Server Kitabku sedang galat (uji).' };
  const a = m.aksi;
  if (a === 'saklar') return modeSrv === 'kosong' ? { ok: true, saklar: FITUR.map((f) => ({ fitur: f, mode: 'off', diubah: null, oleh: null })), log: [], staf: [] } : { ok: true, saklar: SK.saklar, log: SK.log, staf: SK.staf };
  if (a === 'ubahSaklar') {
    if (m.fitur === 'notif') return { ok: false, pesan: 'Notifikasi belum boleh dinyalakan (uji).' };
    const x = SK.saklar.find((z) => z.fitur === m.fitur); if (!x) return { ok: false, pesan: 'Fitur tidak dikenal.' };
    SK.log.unshift({ fitur: x.fitur, dari: x.mode, ke: m.mode, oleh: m.oleh, waktu: '2026-10-24T15:05:00Z' });
    x.mode = m.mode; x.diubah = '2026-10-24T15:05:00Z'; x.oleh = m.oleh; return { ok: true };
  }
  if (a === 'matikanSemua') { SK.saklar.forEach((x) => { x.mode = 'off'; x.oleh = m.oleh; x.diubah = '2026-10-24T15:10:00Z'; }); return { ok: true }; }
  if (a === 'tambahStaf') {
    const g = String(m.ke || '').match(/^(.+)#(\d{4})$/);
    if (!g || g[1] === 'Hantu') return { ok: false, pesan: 'Kitabku ID tidak ditemukan.' };
    const s = { id: 's' + (SK.staf.length + 10), nama: g[1], tag: g[2] }; SK.staf.push(s); return { ok: true, staf: s };
  }
  if (a === 'hapusStaf') { SK.staf = SK.staf.filter((s) => s.id !== m.id); return { ok: true }; }
  if (a === 'statKitab') return STAT(Number(m.hari));
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

    /* ================= menu kiri ================= */
    await jeda(1600); /* pasangMenu sudah menggambar ulang menu beberapa kali */
    const m0 = await menu(p);
    const iK = m0.atas.indexOf('kitabku'), iQ = m0.atas.indexOf('sehat');
    c('S1 grup Kitabku tepat di atas Data Quality, cuma satu, walau skrip Gudang menggambar ulang menu tiap 700 ms',
      iK >= 0 && iQ === iK + 1 && m0.nGrup === 1 && m0.atas.filter((x) => x === 'kitabku').length === 1, JSON.stringify(m0));
    await bingkai(p).click('#panel [data-l4t-kitab=grup]'); await jeda(250);
    const m1 = await menu(p);
    c('S2 klik Kitabku membuka lima sub menu berurutan: Events & rewards, QR cards, Receipt claims, Feature switches, Engagement',
      m1.kitab.join('|') === 'ringkas=Events & rewards|cetak=QR cards|struk=Receipt claims|saklar=Feature switches|libat=Engagement', JSON.stringify(m1));
    const hal0 = await fe(p, () => window.HAL + ':' + (window.__pindahPapan || 0));
    const hasilTab = [];
    for (const tab of ['ringkas', 'cetak', 'struk', 'saklar', 'libat']) {
      await bingkai(p).click('#panel [data-l4t-kitab=' + tab + ']');
      await tunggu(p, () => document.getElementById('kitabkuAdmin') && document.getElementById('kitabkuAdmin').classList.contains('buka'), null, 3000); await jeda(250);
      hasilTab.push(tab + '>' + await tabAktif(p));
      await tutupKitab(p); await jeda(100);
    }
    const hal1 = await fe(p, () => window.HAL + ':' + (window.__pindahPapan || 0));
    c('S3 tiap sub menu membuka lembar Kitabku di tab yang sesuai, dan papan tidak ikut pindah halaman',
      hasilTab.join(',') === 'ringkas>ringkas,cetak>cetak,struk>struk,saklar>saklar,libat>libat' && hal0 === hal1, hasilTab.join(',') + ' papan ' + hal0 + ' -> ' + hal1);
    await fe(p, () => { window.HAL = 'rencana'; window.gambar(); }); await jeda(900);
    const m2 = await menu(p);
    c('S4 sesudah papan menggambar ulang (pindah ke Shipments), grup Kitabku tetap di atas Data Quality dan tidak ganda',
      m2.atas.indexOf('sehat') === m2.atas.indexOf('kitabku') + 1 && m2.nGrup === 1, JSON.stringify(m2));
    await bingkai(p).click('[data-wms=alat]'); await jeda(200);
    await bingkai(p).click('#l4MenuAlat [data-wms=kitabku]');
    const lewatAlat = await tunggu(p, () => document.getElementById('kitabkuAdmin').classList.contains('buka'), null, 3000);
    c('S5 menu Alat > Kitabku tetap membuka lembar Kitabku', lewatAlat, await tabAktif(p));
    await tutupKitab(p);

    /* ================= saklar fitur ================= */
    await bukaTab(p, 'saklar', '#kbSaklar [data-sk-fitur]');
    const B0 = await baris(p);
    const harap = { kirim: ['semua', 'live'], minta: ['50', 'rollout'], buddy: ['10', 'rollout'], cap: ['staf', 'rollout'] };
    const salah0 = B0.filter((r) => { const h = harap[r.f] || ['off', 'off']; return r.mode !== h[0] || r.status !== h[1]; });
    c('K1 18 baris berurutan sesuai kontrak; tombol yang menyala dan status (Live, Rolling out, Off) sama dengan mode di server',
      B0.map((r) => r.f).join(',') === FITUR.join(',') && salah0.length === 0, JSON.stringify(salah0.length ? salah0 : B0.map((r) => r.f)));
    const rk = B0.find((r) => r.f === 'kirim') || {}, rf = B0.find((r) => r.f === 'freeze') || {};
    c('K2 terakhir diubah: nama dan jam WIB (14:40 UTC = 21:40 WIB); fitur yang belum pernah dinyalakan tidak menulis nama',
      /Ferdy/.test(rk.oleh) && /21:40/.test(rk.oleh) && rf.oleh && !/Ferdy/.test(rf.oleh), JSON.stringify([rk, rf]));
    await p.click('#kbSaklar [data-sk-fitur=ucapan] [data-kb=skMode][data-mode="10"]');
    await tunggu(p, () => { const r = document.querySelector('#kbSaklar [data-sk-fitur=ucapan] [data-kb=skMode][aria-pressed=true]'); return r && r.getAttribute('data-mode') === '10'; }, null, 4000); await jeda(300);
    const u = terakhir('ubahSaklar'), Bu = (await baris(p)).find((r) => r.f === 'ucapan') || {};
    const logU = await p.evaluate(() => Array.from(document.querySelectorAll('#kbSkLog li')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    c('K3 klik 10% di Greeting cards mengirim ubahSaklar {fitur: ucapan, mode: 10, oleh: WMS}; baris jadi 10% dan Rolling out; log terbaru dari server menyebutnya',
      u && u.fitur === 'ucapan' && u.mode === '10' && u.oleh === 'WMS' && Bu.mode === '10' && Bu.status === 'rollout' && /Greeting cards/.test(logU[0] || '') && /10%/.test(logU[0] || ''), JSON.stringify([u, Bu, logU[0]]));
    await p.click('#kbSaklar [data-sk-fitur=notif] [data-kb=skMode][data-mode=semua]'); await jeda(700);
    const Bn = (await baris(p)).find((r) => r.f === 'notif') || {};
    const pesanN = await p.evaluate(() => ((document.getElementById('kbSkPesan') || {}).textContent || '').trim());
    c('K4 server menolak (ok:false): baris Gentle notifications tetap Off, pesan server tampil', terakhir('ubahSaklar').fitur === 'notif' && Bn.mode === 'off' && Bn.status === 'off' && /belum boleh dinyalakan/.test(pesanN), JSON.stringify([Bn, pesanN]));
    const nMati0 = jumlah('matikanSemua');
    await p.click('#kbSaklar [data-kb=skMatiTanya]'); await jeda(300);
    const adaYakin = await p.evaluate(() => !!document.querySelector('#kbSaklar [data-kb=skMatiYa]'));
    const nMatiTanya = jumlah('matikanSemua');
    await p.click('#kbSaklar [data-kb=skMatiBatal]', { timeout: 3000 }).catch(() => {}); await jeda(200);
    const nMati1 = Math.max(nMatiTanya, jumlah('matikanSemua'));
    c('K5 tombol darurat tidak langsung mematikan: muncul konfirmasi, dan Batal tidak mengirim apa pun', adaYakin && nMati1 === nMati0, 'yakin ' + adaYakin + ', panggilan ' + nMati0 + ' -> ' + nMati1);
    await p.click('#kbSaklar [data-kb=skMatiTanya]'); await jeda(200);
    await p.click('#kbSaklar [data-kb=skMatiYa]');
    await tunggu(p, () => Array.from(document.querySelectorAll('#kbSaklar [data-kb=skMode][aria-pressed=true]')).every((x) => x.getAttribute('data-mode') === 'off'), null, 4000); await jeda(200);
    const Bm = await baris(p), mt = terakhir('matikanSemua');
    c('K6 sesudah konfirmasi: matikanSemua terkirim sekali dengan oleh, semua baris Off', jumlah('matikanSemua') === nMati0 + 1 && mt && mt.oleh === 'WMS' && Bm.length === 18 && Bm.every((r) => r.mode === 'off' && r.status === 'off'), JSON.stringify([mt, Bm.filter((r) => r.mode !== 'off')]));
    const nStaf0 = jumlah('tambahStaf');
    await p.fill('#kbSkStaf', 'rina tanpa tag'); await p.click('#kbSaklar [data-kb=skStafTambah]'); await jeda(300);
    const pesanS = await p.evaluate(() => ((document.getElementById('kbSkStafPesan') || {}).textContent || '').trim());
    c('K7 Kitabku ID tanpa #1234 ditolak di layar dengan pesan, tidak dikirim ke server', jumlah('tambahStaf') === nStaf0 && pesanS.length > 0, pesanS);
    await p.fill('#kbSkStaf', 'Rina#4321'); await p.click('#kbSaklar [data-kb=skStafTambah]');
    await tunggu(p, () => /Rina#4321/.test((document.querySelector('#kbSaklar [data-sk-staf-daftar]') || {}).textContent || ''), null, 4000);
    const ts = terakhir('tambahStaf'), dS = await p.evaluate(() => (document.querySelector('#kbSaklar [data-sk-staf-daftar]') || {}).textContent || '');
    c('K8 tambah staf mengirim tambahStaf {ke: Rina#4321} dan Rina#4321 muncul di daftar', ts && ts.ke === 'Rina#4321' && /Rina#4321/.test(dS), JSON.stringify(ts) + ' ' + dS);
    await p.fill('#kbSkStaf', 'Hantu#0000'); await p.click('#kbSaklar [data-kb=skStafTambah]'); await jeda(500);
    const pesanH = await p.evaluate(() => ((document.getElementById('kbSkStafPesan') || {}).textContent || '').trim());
    c('K9 ID yang tidak dikenal server: pesan server tampil', /tidak ditemukan/.test(pesanH), pesanH);
    await p.click('#kbSaklar [data-sk-staf=s1] [data-kb=skStafHapus]');
    await tunggu(p, () => !document.querySelector('#kbSaklar [data-sk-staf=s1]'), null, 4000);
    const hs = terakhir('hapusStaf'), adaFerdy = await p.evaluate(() => !!document.querySelector('#kbSaklar [data-sk-staf=s1]'));
    c('K10 hapus staf mengirim hapusStaf {id: s1} dan Ferdy#1001 hilang dari daftar', hs && hs.id === 's1' && !adaFerdy, JSON.stringify(hs));

    /* ================= keterlibatan ================= */
    setel();
    await p.click('[data-kbtab=libat]');
    await tunggu(p, () => !!document.querySelector('#kbLibat [data-lb-kpi=aktif]'), null, 5000); await jeda(200);
    const bacaLb = () => p.evaluate(() => {
      const kpi = {}; document.querySelectorAll('#kbLibat [data-lb-kpi]').forEach((x) => { kpi[x.getAttribute('data-lb-kpi')] = { b: (x.querySelector('b') || {}).textContent || '', s: (x.querySelector('small') || {}).textContent || '' }; });
      const garis = document.querySelector('#kbLbGrafik svg polyline');
      const corong = {}; document.querySelectorAll('#kbLibat [data-lb-corong]').forEach((x) => { corong[x.getAttribute('data-lb-corong')] = (x.querySelector('.kb-lb-n') || {}).textContent || ''; });
      const buddy = Array.from(document.querySelectorAll('#kbLibat [data-lb-buddy] li')).map((li) => ({ nama: (li.querySelector('b') || {}).textContent || '', n: (li.querySelector('.kb-lb-n') || {}).textContent || '', w: (li.querySelector('.kb-lb-isi') || { style: {} }).style.width }));
      const fitur = {}; document.querySelectorAll('#kbLbFitur [data-lb-fitur]').forEach((tr) => { fitur[tr.getAttribute('data-lb-fitur')] = Array.from(tr.children).map((td) => td.textContent.replace(/\s+/g, ' ').trim()); });
      const hari = (document.querySelector('#kbLibat [data-kb=lbHari][aria-pressed=true]') || { getAttribute: () => '' }).getAttribute('data-hari');
      return { kpi, titik: garis ? garis.getAttribute('points').trim().split(/\s+/).length : 0, corong, buddy, fitur, hari };
    });
    const L14 = await bacaLb(), S14 = STAT(14);
    const pctBaru = Math.round(S14.corong.scanSendiri / S14.kirim * 100);
    c('E1 bawaan 14 hari: statKitab {hari: 14}; ubin = pemain aktif hari ini, kartu dikirim + dari permintaan, pemain baru dari hadiah (% dari kiriman), share',
      terakhir('statKitab').hari === 14 && L14.hari === '14' && angka(L14.kpi.aktif && L14.kpi.aktif.b) === S14.aktif[13].n && angka(L14.kpi.kirim && L14.kpi.kirim.b) === S14.kirim &&
      angka(L14.kpi.kirim.s) === S14.dariMinta && angka(L14.kpi.baru && L14.kpi.baru.b) === S14.corong.scanSendiri && angka(L14.kpi.baru.s) === pctBaru && angka(L14.kpi.share && L14.kpi.share.b) === S14.share,
      JSON.stringify([terakhir('statKitab'), L14.kpi]));
    c('E2 grafik pemain aktif harian punya 14 titik; buddy urut Shiba 142, Koala 88, Red Panda 61, batang terpanjang 100%',
      L14.titik === 14 && L14.buddy.map((x) => x.nama + ' ' + angka(x.n)).join('|') === 'Shiba 142|Koala 88|Red Panda 61' && L14.buddy[0].w === '100%' && L14.buddy[2].w === Math.round(61 / 142 * 100) + '%', JSON.stringify(L14.buddy) + ' titik ' + L14.titik);
    const C14 = S14.corong;
    c('E3 corong: dikirim, dibuka, penerima baru, scan kotak sendiri sama dengan server',
      angka(L14.corong.kirim) === C14.kirim && angka(L14.corong.dibuka) === C14.dibuka && angka(L14.corong.penerimaBaru) === C14.penerimaBaru && angka(L14.corong.scanSendiri) === C14.scanSendiri, JSON.stringify(L14.corong));
    const fk = L14.fitur;
    c('E4 ringkasan per fitur: kirim, permintaan, elus, share, notif sesuai server dan kolom saklar mengikuti mode saklar saat ini',
      fk.kirim && angka(fk.kirim[1]) === S14.kirim && /Everyone/.test(fk.kirim[2]) && fk.minta && angka(fk.minta[1]) === S14.minta && /50%/.test(fk.minta[2]) &&
      fk.elus && angka(fk.elus[1]) === S14.elus && fk.share && /Off/.test(fk.share[2]) && fk.notif && angka(fk.notif[1]) === S14.notifBuka, JSON.stringify(fk));
    await p.click('#kbLibat [data-kb=lbHari][data-hari="7"]');
    await tunggu(p, () => { const x = document.querySelector('#kbLibat [data-lb-kpi=kirim] b'); return x && x.textContent.replace(/,/g, '') === '91'; }, null, 4000);
    const L7 = await bacaLb(), S7 = STAT(7);
    c('E5 chip 7 hari: statKitab {hari: 7}, angka dan grafik (7 titik) ikut berganti', terakhir('statKitab').hari === 7 && L7.hari === '7' && L7.titik === 7 && angka(L7.kpi.kirim.b) === S7.kirim && angka(L7.kpi.aktif.b) === S7.aktif[6].n, JSON.stringify([terakhir('statKitab'), L7.kpi, L7.titik]));
    await p.click('#kbLibat [data-kb=lbHari][data-hari="30"]');
    await tunggu(p, () => { const x = document.querySelector('#kbLibat [data-lb-kpi=kirim] b'); return x && x.textContent.replace(/,/g, '') === '390'; }, null, 4000);
    const L30 = await bacaLb();
    c('E6 chip 30 hari: statKitab {hari: 30}, 30 titik', terakhir('statKitab').hari === 30 && L30.titik === 30 && angka(L30.corong.scanSendiri) === STAT(30).corong.scanSendiri, JSON.stringify([terakhir('statKitab'), L30.titik]));

    /* ================= galat ================= */
    await tutupKitab(p);
    modeSrv = 'habis';
    await bukaTab(p, 'saklar', '#kitabkuAdmin [role=alert]');
    const gHabis = await p.evaluate(() => ((document.querySelector('#kitabkuAdmin [role=alert]') || {}).textContent || '').trim());
    c('R1 tiket WMS habis (perluMasuk): lembar Saklar menulis sesi berakhir, bukan halaman kosong', /session has ended/i.test(gHabis), gHabis);
    modeSrv = 'galat';
    await p.click('[data-kbtab=libat]'); await tunggu(p, () => /galat \(uji\)/.test(((document.querySelector('#kitabkuAdmin [role=alert]') || {}).textContent || '')), null, 4000);
    const gLb = await p.evaluate(() => ((document.querySelector('#kitabkuAdmin [role=alert]') || {}).textContent || '').trim());
    c('R2 server galat {ok:false, pesan} di Keterlibatan: pesan server tampil', /galat \(uji\)/.test(gLb), gLb);
    modeSrv = 'kosong';
    await p.click('[data-kbtab=saklar]'); await tunggu(p, () => !!document.querySelector('#kbSaklar [data-sk-fitur]'), null, 4000); await jeda(200);
    const Bk = await baris(p);
    const kosongTeks = await p.evaluate(() => ({ staf: ((document.querySelector('#kbSaklar [data-sk-staf-daftar]') || {}).textContent || '').trim(), log: document.querySelectorAll('#kbSkLog li').length, alert: !!document.querySelector('#kitabkuAdmin .tolak-alat') }));
    c('R3 tabel saklar belum ada di server (semua off, daftar kosong): tetap tampil 18 baris Off, staf dan log kosong dengan keterangan, tanpa galat',
      Bk.length === 18 && Bk.every((r) => r.mode === 'off') && kosongTeks.staf.length > 0 && kosongTeks.log === 0 && !kosongTeks.alert, JSON.stringify(kosongTeks));
    modeSrv = 'normal';
    const emas = await p.evaluate(() => /\u2014/.test(document.getElementById('kitabkuAdmin').innerText));
    await p.click('[data-kbtab=libat]'); await tunggu(p, () => !!document.querySelector('#kbLibat [data-lb-kpi=aktif]'), null, 4000); await jeda(200);
    const emas2 = await p.evaluate(() => /\u2014/.test(document.getElementById('kitabkuAdmin').innerText));
    c('R4 tanpa tanda pisah panjang di Saklar dan Keterlibatan', !emas && !emas2, emas + ' ' + emas2);
    await ctx.close();

    /* ================= malam, HP 390, bahasa Indonesia ================= */
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await pasangRute(ctx2);
    const hp = await halaman(ctx2);
    await masuk(hp, 'id', 'dark');
    await jeda(900);
    const lebar = [];
    for (const [tab, sel] of [['saklar', '#kbSaklar [data-sk-fitur]'], ['libat', '#kbLibat [data-lb-kpi=aktif]']]) {
      await bukaTab(hp, tab, sel);
      lebar.push(await hp.evaluate((t) => { const l = document.querySelector('#kitabkuAdmin .lembar'), i = document.getElementById('kbIsi'); return { t, dok: document.documentElement.scrollWidth, lembar: l.scrollWidth - l.clientWidth, isi: i.scrollWidth - i.clientWidth }; }, tab));
    }
    c('T1 HP 390 px: Saklar dan Keterlibatan tanpa geser samping (halaman maupun lembar)', lebar.every((x) => x.dok <= 390 && x.lembar <= 1 && x.isi <= 1), JSON.stringify(lebar));
    const tema = await hp.evaluate(() => { const l = document.querySelector('#kitabkuAdmin .lembar'); return { tema: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(l).backgroundColor, ink: getComputedStyle(l).color }; });
    c('T2 tema malam: lembar memakai warna malam (kartu coklat #352A22, teks terang)', tema.tema === 'dark' && tema.bg === 'rgb(53, 42, 34)', JSON.stringify(tema));
    await tutupKitab(hp);
    await bukaTab(hp, 'saklar', '#kbSaklar [data-sk-fitur]');
    const idTeks = await hp.evaluate(() => ({ tab: (document.querySelector('[data-kbtab=saklar]') || {}).textContent || '', mati: (document.querySelector('#kbSaklar [data-sk-fitur=kirim] [data-kb=skMode][data-mode=off]') || {}).textContent || '', staf: (document.querySelector('#kbSaklar [data-sk-fitur=kirim] [data-kb=skMode][data-mode=staf]') || {}).textContent || '' }));
    await tutupKitab(hp);
    /* menu kiri di HP: laci dibuka dulu */
    await bingkai(hp).click('.l4-burger').catch(() => {}); await jeda(300);
    await bingkai(hp).click('#panel [data-l4t-kitab=grup]').catch(() => {}); await jeda(300);
    const mId = await menu(hp);
    c('I1 bahasa Indonesia: tab "Saklar fitur", tombol "Mati" dan "Staf saja", sub menu "Saklar fitur" dan "Keterlibatan pemain"',
      /Saklar fitur/.test(idTeks.tab) && idTeks.mati.trim() === 'Mati' && idTeks.staf.trim() === 'Staf saja' && mId.kitab.some((x) => x === 'saklar=Saklar fitur') && mId.kitab.some((x) => x === 'libat=Keterlibatan pemain'), JSON.stringify([idTeks, mId.kitab]));
    await bingkai(hp).click('#panel [data-l4t-kitab=libat]').catch(() => {});
    await tunggu(hp, () => document.getElementById('kitabkuAdmin').classList.contains('buka'), null, 3000); await jeda(300);
    const laci = await fe(hp, () => document.body.classList.contains('l4-laci'));
    c('I2 di HP sub menu Keterlibatan membuka Kitabku dan laci menu tertutup', (await tabAktif(hp)) === 'libat' && !laci, (await tabAktif(hp)) + ' laci ' + laci);
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
