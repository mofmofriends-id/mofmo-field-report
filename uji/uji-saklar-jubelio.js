/* Uji saklar Jubelio di Kontrol WMS (wms/jubelio.js, tab "Jubelio"), 1 Nov 2026.
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Webhook pesanan Jubelio menyetor isi pesanan Shopee (SP-...) ke Kitab hanya kalau
 * jubelio_atur.pesanan_kitab = 'otomatis'; bawaannya 'manual' (isi pesanan tetap dari upload Excel Shopee).
 * Ferdy butuh saklarnya di WMS, bukan lewat SQL. Yang mahal kalau salah: saklar berubah tanpa sengaja (klik ulang
 * mengirim ulang, atau tampilan tidak sesuai nilai di server sehingga Ferdy salah mengira mode yang jalan), dan tiket
 * WMS yang habis terbaca sebagai mode manual. Laporan penjualan event sengaja tidak dibuat (Ferdy 1 Nov: laporan
 * Keuangan Jubelio sudah cukup).
 * Ditulis sesudah kodenya (jubelio.js menggantikan laporan event yang dibatalkan), jadi kekuatannya dibuktikan uji balik.
 */
const fs = require('fs'), path = require('path'), http = require('http');
const AKAR = process.env.AKAR || path.resolve(__dirname, '..');
const DIHARAPKAN = 6;
const cek = []; const c = (n, ok, k) => cek.push([n, !!ok, k]);

const DATA = { ok: true, hariIni: '2026-11-01', bulanIni: '2026-11', tarif: 0.1, diperbarui: '1 Nov 2026 12:00',
  lok: [{ k: 'HO', n: 'HO - HAERY OFFICE', toko: 0 }, { k: 'TERJUAL', toko: 0 }, { k: 'OPENING', toko: 0 }],
  prod: [{ b: '4582586950512', n: 'MofmoFriends S - Yellow Shiba', s: 'MF-PLU-031', hs: 175000 }], baris: [['2026-10-01', 0, 10, 2, 0]], invoiceMitra: [] };

async function jalan() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { c('B0 playwright', false, e.message); return; }
  const API = 'https://script.google.com/macros/s/AKfycbzslW9akcAS2EINjrdcllgpGpuQzz_I2jHtNyEWixS-yl2HSsqE5kfTDjDGR8H_Zcq9xA/exec';
  const SUPA = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/wms';
  const JUBELIO = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/jubelio/wms';
  const jenis = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
  const srv = http.createServer((q, s) => {
    let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(AKAR, p);
    if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
    s.writeHead(200, { 'Content-Type': jenis[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
  });
  const PAPAN = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Papan</title><style>#layarIsi{display:none}</style></head><body>' +
    '<div id="layarKode"><input id="kode"><button onclick="buka()">Masuk</button></div>' +
    '<div id="layarIsi"><header><div class="bungkus"><div class="gbrLogo"></div><div><h1>Papan Data</h1></div><div id="kopKanan"></div></div></header><nav id="panel"></nav><div id="isi"></div></div>' +
    '<script>function buka(){google.script.run.withSuccessHandler(function(){document.getElementById("layarKode").style.display="none";document.getElementById("layarIsi").style.display="block";}).dataPapan(document.getElementById("kode").value);}<\/script></body></html>';
  await new Promise(r => srv.listen(8792, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  const galat = [], KIRIM = [];
  const st = { atur: { pesanan_kitab: 'manual' }, habis: false };
  const pasang = async ctx => {
    ctx.setDefaultTimeout(6000);
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route(/cdn\.|unpkg|cdnjs/, r => { galat.push('pustaka luar: ' + r.request().url()); r.abort(); });
    await ctx.route(API + '**', async r => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      const h = m.nama === 'dataPapan' ? { pintu: 'ok', hasil: DATA } : { pintu: 'galat', pesan: 'Fungsi "' + m.nama + '" tidak dibuka untuk WMS.' };
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(h) });
    });
    await ctx.route(SUPA, async r => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      let h;
      if (m.fn === 'masuk') h = { ok: true, tiket: 'TIKET.SUPA', ingat: true };
      else if (m.fn === 'ambil') {
        const w = new Date(Date.now() - 60000).toISOString();
        const o = { 'dataPapan|["K"]': DATA, 'klien|papan': { ok: true, versi: 'jubelio', html: PAPAN }, 'klien|versi': { ok: true, versi: 'jubelio' } };
        const isi = {}; (m.kunci || []).forEach(k => { if (o[k]) isi[k] = { waktu: w, data: o[k] }; });
        h = { ok: true, isi };
      } else h = { ok: false };
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
    });
    await ctx.route(JUBELIO, async r => {
      let m = {}; try { m = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      KIRIM.push(m);
      let h;
      if (st.habis || m.tiket !== 'TIKET.SUPA') h = { ok: false, perluMasuk: true };
      else if (m.aksi === 'event') h = { ok: true, lokasi: [], pesanan: [], atur: st.atur };
      else if (m.aksi === 'atur') { st.atur[m.kunci] = m.nilai; h = { ok: true }; }
      else h = { ok: false, pesan: 'Aksi tidak dikenal.' };
      await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
    });
  };
  const jeda = ms => new Promise(x => setTimeout(x, ms));
  const masuk = async p => {
    p.on('pageerror', e => galat.push(e.message));
    await p.goto('http://localhost:8792/wms/');
    await p.evaluate(() => { localStorage.setItem('wms_tema', 'light'); localStorage.setItem('wms_bhs', 'id'); localStorage.setItem('wms_maskot', 'off'); });
    await p.reload();
    await p.waitForSelector('#kode', { timeout: 8000 });
    await p.fill('#kode', 'kode-palsu'); await p.click('#tMasuk');
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) { const f = p.frames().find(x => x !== p.mainFrame()); try { if (f && await f.evaluate(() => !!document.querySelector('[data-wms=kontrol]'))) return f; } catch (e) {} await jeda(100); }
    return null;
  };
  const buka = async (p, fr) => {
    await fr.evaluate(() => document.querySelector('[data-wms=kontrol]').click());
    await p.waitForSelector('#kontrol [data-kontrol-tab=jubelio]', { timeout: 8000 }).catch(() => {});
    await p.click('#kontrol [data-kontrol-tab=jubelio]').catch(() => {});
    await p.waitForSelector('#kontrol .jb-saklar, #kontrol .jb-pesan', { timeout: 8000 }).catch(() => {});
  };
  const tekan = p => p.evaluate(() => Array.from(document.querySelectorAll('#kontrol [data-jb-saklar]')).map(x => x.getAttribute('data-jb-saklar') + '=' + x.getAttribute('aria-pressed')).join(','));
  try {
    const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
    await pasang(ctx);
    const p = await ctx.newPage();
    const fr = await masuk(p);
    let tab = '', t1 = '';
    if (fr) { await buka(p, fr); tab = await p.evaluate(() => (document.querySelector('#kontrol [data-kontrol-tab=jubelio]') || {}).innerText || ''); t1 = await tekan(p); }
    c('B1 tab Jubelio di Kontrol membaca saklar dari server dengan tiket WMS; server manual, tombol Manual yang aktif',
      tab === 'Jubelio' && KIRIM.some(m => m.aksi === 'event' && m.tiket === 'TIKET.SUPA') && t1 === 'manual=true,otomatis=false', JSON.stringify([tab, t1, KIRIM]));
    await p.click('#kontrol [data-jb-saklar=otomatis]').catch(() => {}); await jeda(500);
    const a1 = KIRIM.filter(m => m.aksi === 'atur'), t2 = await tekan(p), s2 = await p.evaluate(() => (document.querySelector('#kontrol .jb-status') || {}).innerText || '');
    c('B2 klik Otomatis: aksi atur pesanan_kitab=otomatis terkirim sekali, tombol Otomatis aktif, status menyebut otomatis',
      a1.length === 1 && a1[0].kunci === 'pesanan_kitab' && a1[0].nilai === 'otomatis' && t2 === 'manual=false,otomatis=true' && /otomatis/i.test(s2) && st.atur.pesanan_kitab === 'otomatis', JSON.stringify([a1, t2, s2]));
    await p.click('#kontrol [data-jb-saklar=otomatis]').catch(() => {}); await jeda(400);
    c('B3 klik Otomatis lagi saat sudah otomatis: tidak mengirim apa pun', KIRIM.filter(m => m.aksi === 'atur').length === 1, JSON.stringify(KIRIM));
    st.habis = true;
    await p.click('#kontrol [data-kontrol=tutup]').catch(() => {}); await jeda(150);
    const ctx3 = await b.newContext({ viewport: { width: 1360, height: 900 } }); await pasang(ctx3);
    const p3 = await ctx3.newPage(); const fr3 = await masuk(p3); let ph = '', t3 = '';
    if (fr3) { await buka(p3, fr3); ph = await p3.evaluate(() => (document.querySelector('#kontrol .jb-pesan') || {}).innerText || ''); t3 = await tekan(p3); }
    c('B4 tiket WMS habis: pesan masuk lagi, tombol saklar tidak ditampilkan (tidak terbaca sebagai manual)', /masuk lagi/i.test(ph) && t3 === '', JSON.stringify([ph, t3]));
    st.habis = false;
    await ctx3.close(); await ctx.close();
    const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await pasang(ctx2);
    const hp = await ctx2.newPage();
    const fr2 = await masuk(hp);
    let lebar = 9999, dash = true; if (fr2) { await buka(hp, fr2); await jeda(300); lebar = await hp.evaluate(() => Math.max(document.documentElement.scrollWidth, document.getElementById('kontrol').scrollWidth)); dash = await hp.evaluate(() => /—/.test(document.getElementById('kontrol').innerText)); }
    c('B5 HP 390 px: halaman tidak geser samping, tanpa tanda pisah panjang', lebar <= 392 && !dash, String(lebar) + ' ' + dash);
    await ctx2.close();
  } catch (e) { c('B MATI di tengah jalan', false, e.stack); }
  c('B6 tidak ada galat JavaScript dan tidak ada pustaka dari CDN', galat.length === 0, galat.join(' | ').slice(0, 400));
  await b.close(); srv.close();
}

jalan().then(() => {
  let gagal = 0;
  cek.forEach(([n, ok, k]) => { if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '  -> ' + String(k).slice(0, 700))); });
  if (cek.length !== DIHARAPKAN) { console.log('BAHAYA: ' + cek.length + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN); gagal++; }
  console.log('\n' + cek.length + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
  process.exit(gagal ? 1 : 0);
});
