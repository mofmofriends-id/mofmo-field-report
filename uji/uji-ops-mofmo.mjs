/* Uji wajah Mofmo di aplikasi WMS Ops (/ops/), 20 Okt 2026.
 * Harapan: "13 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (20 Okt 03.30): "Kasih logo dan ramein pake sku mofmo kasih motion efek dan sfx".
 * Hiasan yang salah pasang lebih mahal dari tanpa hiasan:
 *  - gambar SKU rusak (jalur salah) tampil sebagai ikon patah di HP;
 *  - animasi masuk diputar ulang tiap muat ulang latar 90 detik, layar berkedip terus;
 *  - konfeti menutupi tombol atau tertinggal di layar;
 *  - suara tetap bunyi padahal sudah dibisukan, atau bisunya lupa sesudah aplikasi dibuka lagi;
 *  - HP dengan setelan kurangi gerak tetap dihujani animasi;
 *  - angka ringkasan berhenti di angka hitung yang salah;
 *  - sesudah masuk, aplikasi menggambar dua kali berturut turut (data lalu cache jadwal): gambar kedua sempat
 *    memutus hitung naik dan animasi kartu di tengah jalan, jadi gerakannya tidak pernah kelihatan;
 *  - offline: boneka dan logo hilang karena tidak ikut disimpan service worker.
 * Yang diuji perilaku di peramban (gambar benar benar termuat, animasi benar benar berjalan, oscillator benar
 * benar dinyalakan), bukan keberadaan string di HTML.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const SRV = process.env.OPS_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/ops/inti.js');
const T = await import(SRV + '/ops-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 13;
/* Gambar yang tidak pernah termuat (misal loading=lazy di luar layar) dihitung gagal, bukan membuat uji macet. */
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 700))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const KINI = T.W('2026-10-20T07:40:00');
const RAHASIA = 'rahasia-uji-ops-mofmo-0123456789abcdef', SIDIK = 'sidik-uji-ops-mofmo';
const db = T.dbPalsu(RAHASIA, SIDIK), cu = T.clickupPalsu(KINI), L = T.luarPalsu(cu);
L.kunciPublik = async () => 'BPalsu';
db.st.surel = { waktu: KINI - 4 * 60e3, utas: [
  { id: 'u1', subjek: 'Permohonan Izin Penarikan Stok', mitra: 'MAA', status: 'draft', tingkat: 'merah', hariKerja: 0, pesan: 'm4', pengirim: 'Deasyana Wulandari',
    cuplikan: 'Mohon dibuatkan SIK revisi', isiPesan: 'Mohon dibuatkan SIK revisi.', waktuPesan: KINI - 18 * 3600e3, draft: 'd1', draftT: KINI - 17 * 3600e3, draftIsi: 'Dear Bu Desy,\n\nBaik.', url: 'https://mail.google.com/mail/u/0/#all/u1' },
  { id: 'u2', subjek: 'Evaluasi Gerai Margo City', mitra: 'TGI', status: 'menunggu', tingkat: 'kuning', hariKerja: 4, url: 'https://mail.google.com/mail/u/0/#all/u2' }] };
const ENV = { OPS_RAHASIA: 'x', CLICKUP_TOKEN: 'pk_palsu' };

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JENIS = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/ops/') u = '/ops/index.html';
  const f = path.join(AKAR, 'wms', u);
  if (!f.startsWith(path.join(AKAR, 'wms')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': JENIS[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const ASAL = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

/* Hitung bunyi yang benar benar dinyalakan: setiap OscillatorNode/AudioBufferSourceNode yang di-start. */
const PANTAU_SUARA = () => {
  window.__bunyi = 0;
  for (const K of [window.OscillatorNode, window.AudioBufferSourceNode]) {
    if (!K) continue; const asli = K.prototype.start;
    K.prototype.start = function () { window.__bunyi++; return asli.apply(this, arguments); };
  }
};
async function konteks(opsi) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, opsi || {}));
  await ctx.addInitScript(PANTAU_SUARA);
  await ctx.route('**/functions/v1/wms', (route) => {
    const m = JSON.parse(route.request().postData() || '{}');
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(m.fn === 'masuk' && m.kode === 'KODE-UJI' ? { ok: true, tiket: T.tiketDari(RAHASIA, SIDIK, KINI) } : { ok: false, pesan: 'x' }) });
  });
  await ctx.route('**/functions/v1/ops', async (route) => {
    const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, L, ENV);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
  });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date(KINI));
  p.on('dialog', (d) => d.accept());
  return { ctx, p };
}
/* Semua <img> di dalam pemilih benar benar termuat (bukan ikon patah). */
const gambarMuat = (p, sel) => p.$$eval(sel, (a) => Promise.all(a.map((im) => im.complete ? im : new Promise((ok) => { im.onload = im.onerror = () => ok(im); setTimeout(() => ok(im), 4000); })))
  .then(() => a.map((im) => ({ src: im.getAttribute('src'), ok: im.naturalWidth > 0 }))));
const semuaMuat = (x, min) => x.length >= (min || 1) && x.every((i) => i.ok);
const tunggu = (p, fn, ms) => p.waitForFunction(fn, null, { timeout: ms || 5000 });
const animasiKartu = (p) => p.$$eval('#app .c', (a) => a.slice(0, 4).map((x) => x.getAnimations().length));

const { ctx, p } = await konteks();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));

await bagian('A. layar masuk', async () => {
  await p.goto(ASAL + '/ops/');
  const logo = await gambarMuat(p, '.masuk img.logo');
  const parade = await gambarMuat(p, '.parade img');
  c('S1 layar masuk: logo Mofmo dan barisan boneka SKU (minimal 6) termuat semua', semuaMuat(logo) && semuaMuat(parade, 6), JSON.stringify({ logo, parade: parade.filter((x) => !x.ok).slice(0, 3), n: parade.length }));
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await tunggu(p, () => document.querySelectorAll('#app .c').length > 2);
  const lebar2 = await p.evaluate(() => document.documentElement.scrollWidth);
  c('S2 tidak ada geser ke samping di layar masuk maupun Beranda (lebar 390)', lebar <= 390 && lebar2 <= 390, lebar + ' / ' + lebar2);
});

await bagian('B. Beranda', async () => {
  const hd = await gambarMuat(p, '.hd img.logo');
  const sum = await gambarMuat(p, '.sum img');
  c('S3 kepala halaman memuat logo; tiga kotak ringkasan masing masing berboneka SKU yang termuat', semuaMuat(hd) && semuaMuat(sum, 3), JSON.stringify({ hd, sum }));
  await p.waitForTimeout(1200);
  const angka = await p.$$eval('.sum b', (a) => a.map((x) => x.innerText.trim()));
  const nHari = await p.$$eval('.sec', (a) => { const s = a.find((x) => /^hari ini/i.test(x.innerText)); let n = 0, e = s && s.nextElementSibling; while (e && !e.classList.contains('sec')) { if (e.classList.contains('c')) n++; e = e.nextElementSibling; } return n; });
  c('S4 angka ringkasan berhenti di jumlah sebenarnya sesudah animasi hitung (Hari ini = jumlah kartu Hari ini)', angka[0] === String(nHari) && nHari > 0, JSON.stringify({ angka, nHari }));
  await p.click('[data-buka="#mitra"]');
  const a1 = await animasiKartu(p);
  await p.waitForTimeout(150);
  const lanjut = await p.evaluate(() => { window.__ops.gambar(); const a = document.querySelector('#app > *').getAnimations()[0]; return a ? a.effect.getComputedTiming().progress : null; });
  c('S13 gambar ulang di tengah animasi (misal data lalu cache jadwal) melanjutkan gerakannya, tidak memutus dan tidak mengulang dari nol', lanjut !== null && lanjut > 0.15 && lanjut < 1, String(lanjut));
  await p.waitForTimeout(900);
  await p.evaluate(() => window.__ops.gambar());
  const a2 = await animasiKartu(p);
  c('S5 pindah tab memutar animasi masuk kartu; gambar ulang dari muat latar tidak memutarnya lagi', a1.length > 0 && a1.every((n) => n > 0) && a2.every((n) => n === 0), JSON.stringify({ a1, a2 }));
  await p.click('[data-buka="#tugas"]'); await p.waitForSelector('[data-selesai="a1"]');
});

await bagian('C. centang Done', async () => {
  const s0 = await p.evaluate(() => window.__bunyi);
  await p.click('[data-selesai="a1"]');
  const pesta = await p.$$eval('.pesta img', (a) => a.length);
  const s1 = await p.evaluate(() => window.__bunyi);
  await tunggu(p, () => document.getElementById('toast').classList.contains('on') && /Urungkan/.test(document.getElementById('toast').innerText));
  c('S6 centang Done: konfeti boneka SKU muncul, bunyi pop menyala, dan status ClickUp tetap jadi selesai',
    pesta >= 5 && s1 > s0 && cu.tugas.find((x) => x.id === 'a1').status.status === 'selesai', JSON.stringify({ pesta, s0, s1, st: cu.tugas.find((x) => x.id === 'a1').status }));
  const tb = await gambarMuat(p, '#toast img');
  await p.waitForTimeout(400);
  const tumpuk = await p.evaluate(() => { const f = document.querySelector('.fab'), t = document.getElementById('toast'); if (!f) return 'tanpa fab'; const a = f.getBoundingClientRect(), b = t.getBoundingClientRect();
    const kena = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; return kena && getComputedStyle(f).opacity !== '0' ? 'menumpuk' : ''; });
  await p.waitForTimeout(1600);
  const sisa = await p.$$eval('.pesta img', (a) => a.length);
  const tutup = await p.evaluate(() => { const r = document.querySelector('[data-buka="#beranda"]').getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!(el && el.closest('[data-buka="#beranda"]')); });
  c('S7 kabar bawah berboneka termuat dan tidak menumpuk dengan tombol +; konfeti bersih sesudah 1,6 detik dan tidak menghalangi ketukan', semuaMuat(tb) && tumpuk === '' && sisa === 0 && tutup, JSON.stringify({ tb, tumpuk, sisa, tutup }));
  const kos = await gambarMuat(p, '.kosong img');
  const srcA = kos.map((x) => x.src).join();
  await p.evaluate(() => window.__ops.gambar());
  const srcB = (await gambarMuat(p, '.kosong img')).map((x) => x.src).join();
  c('S8 bagian kosong (Hari ini sesudah Rekap HPP selesai) berboneka yang termuat, dan bonekanya tidak berganti saat gambar ulang', semuaMuat(kos) && srcA === srcB, JSON.stringify({ kos, srcB }));
});

await bagian('D. bisukan suara', async () => {
  await p.click('[data-suara]');
  const simpan = await p.evaluate(() => localStorage.getItem('ops_suara'));
  const s0 = await p.evaluate(() => window.__bunyi);
  await p.click('[data-selesai="a2"]'); await p.waitForTimeout(300);
  await p.click('[data-buka="#beranda"]'); await p.waitForTimeout(200);
  const s1 = await p.evaluate(() => window.__bunyi);
  await p.reload(); await tunggu(p, () => !!document.querySelector('[data-suara]'));
  const tekan = await p.getAttribute('[data-suara]', 'aria-pressed');
  c('S9 bisukan: tersimpan, centang dan pindah tab tidak berbunyi, tetap bisu sesudah aplikasi dibuka ulang', simpan === '0' && s1 === s0 && tekan === 'true', JSON.stringify({ simpan, s0, s1, tekan }));
  const t0 = await p.evaluate(() => window.__bunyi);
  await p.click('[data-suara]'); await p.waitForTimeout(150);
  const t1 = await p.evaluate(() => window.__bunyi);
  c('S10 suara dinyalakan lagi: langsung berbunyi sebagai tanda dan tersimpan', t1 > t0 && (await p.evaluate(() => localStorage.getItem('ops_suara'))) === '1', JSON.stringify({ t0, t1 }));
});

await bagian('E. offline', async () => {
  await p.reload(); await tunggu(p, () => !!navigator.serviceWorker.controller && document.querySelectorAll('.sum img').length === 3, 8000);
  await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.reload(); await p.waitForSelector('.hd img.logo', { timeout: 8000 });
  const hd = await gambarMuat(p, '.hd img.logo, .sum img');
  await ctx.setOffline(false);
  c('S11 tanpa sinyal: logo dan boneka ringkasan tetap tampil dari simpanan service worker', semuaMuat(hd, 4), JSON.stringify(hd));
});

await bagian('F. kurangi gerak', async () => {
  const k = await konteks({ reducedMotion: 'reduce' });
  await k.p.goto(ASAL + '/ops/'); await k.p.fill('#kode', 'KODE-UJI'); await k.p.click('#tMasuk');
  await k.p.waitForFunction(() => document.querySelectorAll('#app .c').length > 2);
  await k.p.click('[data-buka="#mitra"]');
  const an = await animasiKartu(k.p);
  await k.p.click('[data-buka="#tugas"]'); await k.p.waitForSelector('[data-selesai="a3"]');
  await k.p.click('[data-selesai="a3"]');
  const pesta = await k.p.$$eval('.pesta img', (a) => a.length);
  c('S12 setelan kurangi gerak: kartu tanpa animasi masuk dan centang tanpa konfeti', an.every((n) => n === 0) && pesta === 0, JSON.stringify({ an, pesta }));
  await k.ctx.close();
});

if (errs.length) { console.log('\nGalat halaman: ' + errs.join(' | ')); gagal++; }
await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
