/* Uji aplikasi WMS Ops tahap 2 (/ops/), 20 Okt 2026.
 * Harapan: "13 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (20 Okt 03.53): "gas semuanya" atas lima saran. Server asli (ops/inti.js)
 * dijalankan di belakang halaman dengan potret WMS tiruan (ops-tiruan-wms.mjs), jadi yang diuji perjalanan
 * utuh dari data WMS sampai ke layar. Yang mahal kalau salah:
 *  - ketikan revisi draft atau catatan progres hilang saat aplikasi menyegarkan diri tiap 90 detik,
 *    atau malah terbawa ke surel mitra lain, atau muncul lagi sesudah terkirim;
 *  - Beranda menampilkan angka WMS yang berbeda dengan hitungan server, atau rusak total saat data WMS
 *    belum tersalin;
 *  - SKU yang habis di gerai tidak kelihatan di daftar stok menipis;
 *  - kolom cek SKU kehilangan fokus tiap hasil datang (keyboard HP tertutup);
 *  - boneka baru tidak pernah kelihatan, atau koleksinya salah hitung;
 *  - gaya layar "boneka baru" bocor ke chip jadwal bertanda .baru (pernah terjadi 20 Okt: chip geseran memenuhi layar; tertangkap uji-ops-jadwal).
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const SRV = process.env.OPS_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/ops/inti.js');
const T = await import(SRV + '/ops-tiruan.mjs');
const TW = await import(SRV + '/ops-tiruan-wms.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 13;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 800))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const KINI = T.W('2026-10-20T07:40:00');
const RAHASIA = 'rahasia-uji-ops-tahap2-app-0123456789abcdef', SIDIK = 'sidik-uji-ops-tahap2-app';
const db = T.dbPalsu(RAHASIA, SIDIK), cu = T.clickupPalsu(KINI), L = T.luarPalsu(cu);
L.kunciPublik = async () => 'BPalsu';
db.st.surel = { waktu: KINI - 4 * 60e3, utas: [
  { id: 'u1', subjek: 'Permohonan Izin Penarikan Stok', mitra: 'MAA', status: 'draft', tingkat: 'merah', hariKerja: 0, pesan: 'm4', pengirim: 'Deasyana Wulandari',
    cuplikan: 'SIK revisi', isiPesan: 'Mohon dibuatkan SIK revisi.', waktuPesan: KINI - 18 * 3600e3, draft: 'd1', draftT: KINI - 17 * 3600e3, draftIsi: 'Dear Bu Desy,\n\nBaik.', url: 'https://mail.google.com/mail/u/0/#all/u1' },
  { id: 'u4', subjek: 'Listing ruparupa 11 SKU', mitra: 'TGI', status: 'lanjutan', lanjutan: true, tingkat: 'merah', hariKerja: 3, pesan: 't7', waktuPesan: KINI - 5 * 864e5,
    draft: 'ds', draftT: KINI - 3600e3, draftIsi: 'Dear Bu Novi,\n\nMenindaklanjuti.', url: 'https://mail.google.com/mail/u/0/#all/u4' }] };
TW.pasangPotret(db, KINI - 6 * 60e3);
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
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.route('**/functions/v1/wms', (route) => {
  const m = JSON.parse(route.request().postData() || '{}');
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(m.fn === 'masuk' && m.kode === 'KODE-UJI' ? { ok: true, tiket: T.tiketDari(RAHASIA, SIDIK, KINI) } : { ok: false, pesan: 'x' }) });
});
let ANEH = false;
await ctx.route('**/functions/v1/ops', async (route) => {
  const mm = JSON.parse(route.request().postData() || 'null');
  if (ANEH && mm && mm.aksi === 'wms') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, terjual: {}, menipis: {}, shopee: {}, diam: {} }) });
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, L, ENV);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
await ctx.route('https://script.google.com/**', (route) => route.abort());
const p = await ctx.newPage();
p.setDefaultTimeout(6000);
await p.clock.setFixedTime(new Date(KINI));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const tunggu = (fn, ms, arg) => p.waitForFunction(fn, arg === undefined ? null : arg, { timeout: ms || 5000 });
const teks = (sel) => p.$$eval(sel, (a) => a.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
const lebar = () => p.evaluate(() => document.documentElement.scrollWidth);

await bagian('A. ketikan tidak hilang', async () => {
  await p.goto(ASAL + '/ops/');
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await tunggu(() => document.querySelectorAll('#app .c').length > 2);
  await p.click('[data-buka="#surel/u1"]'); await p.waitForSelector('#catRevisi');
  await p.click('#catRevisi'); await p.keyboard.type('jangan sebut jam');
  await p.evaluate(() => window.__ops.gambar());
  const v1 = await p.evaluate(() => ({ v: document.getElementById('catRevisi').value, f: document.activeElement && document.activeElement.id }));
  await p.evaluate(() => { location.hash = '#surel/u4'; });
  await p.waitForFunction(() => /Listing ruparupa/.test(document.body.innerText));
  const v2 = await p.evaluate(() => (document.getElementById('catRevisi') || {}).value);
  c('T1 ketikan revisi bertahan saat aplikasi menyegarkan diri (dan kursor tetap di kolom), tapi tidak terbawa ke utas TGI', v1.v === 'jangan sebut jam' && v1.f === 'catRevisi' && v2 === '', JSON.stringify([v1, v2]));
  await p.evaluate(() => { location.hash = '#tugas/a1'; });
  await p.waitForSelector('#catProgres');
  await p.fill('#catProgres', 'invoice sudah ditarik'); await p.click('[data-komentar="a1"]');
  await tunggu(() => /Catatan tersimpan/.test(document.getElementById('toastTeks').innerText));
  await p.waitForTimeout(400);
  const v3 = await p.evaluate(() => (document.getElementById('catProgres') || {}).value);
  c('T2 catatan progres yang sudah terkirim tidak muncul lagi di kolom sesudah layar digambar ulang', v3 === '' && (cu.komentar.a1 || []).length === 1, JSON.stringify([v3, cu.komentar.a1]));
});

await bagian('B. Beranda data WMS', async () => {
  await p.evaluate(() => { location.hash = '#beranda'; });
  await p.waitForSelector('[data-wms="menipis"]');
  const t = await p.$$eval('[data-wms]', (a) => Object.fromEntries(a.map((x) => [x.dataset.wms, x.innerText.replace(/\s+/g, ' ').trim()])));
  c('T3 petak WMS: terjual 3 pcs (pekan lalu 5), Shopee 2 belum kirim 1 telat, stok menipis 2 (1 habis), barang diam 1, laporan mitra KIY 16 hari, 11.11 tinggal 22 hari',
    /\b3\b/.test(t.terjual) && /pekan lalu 5/.test(t.terjual) && /\b2\b/.test(t.shopee) && /1 telat/.test(t.shopee) && /\b2\b/.test(t.menipis) && /1 habis/.test(t.menipis) &&
    /\b1\b/.test(t.diam) && /KIY/.test(t.mitra) && /16 hari/.test(t.mitra) && /22/.test(t['1111'] || ''), JSON.stringify(t));
  const ind = (await teks('[data-indra]')).join(' ');
  c('T4 baris Indra hari ini: Alam Sutera, belum lapor (data laporan lapangan WMS); ketuk membuka tab Jadwal', /Alam Sutera/i.test(ind) && /belum lapor/i.test(ind), ind);
  await p.click('[data-wms="menipis"]'); await p.waitForSelector('.sheet.on .wrow');
  const rows = await teks('.sheet.on .wrow');
  c('T5 rincian stok menipis: NDR di Seibu GI paling atas dan bertanda habis, Bishon di Alam Sutera sisa 12 hari', rows.length === 2 && /Netherland/i.test(rows[0]) && /habis/i.test(rows[0]) && /Seibu/i.test(rows[0]) && /Bishon/i.test(rows[1]) && /12 hari/.test(rows[1]), JSON.stringify(rows));
  const imgOk = await p.$$eval('.sheet.on .wrow img', (a) => a.length > 0 && a.every((i) => i.complete && i.naturalWidth > 0));
  await p.click('#dim', { position: { x: 20, y: 20 } }); await p.waitForTimeout(350);
  await p.click('[data-indra]'); await p.waitForTimeout(300);
  const rute = await p.evaluate(() => location.hash);
  c('T6 rincian berboneka sesuai SKU yang termuat; ketuk baris Indra menuju Jadwal; tidak ada geser ke samping', imgOk && rute === '#jadwal' && (await lebar()) <= 390, JSON.stringify([imgOk, rute]));
});

await bagian('C. cek SKU', async () => {
  await p.evaluate(() => { location.hash = '#beranda'; }); await p.waitForSelector('[data-cari]');
  await p.click('[data-cari]'); await p.waitForSelector('#cariSku');
  await p.type('#cariSku', '6988');
  await tunggu(() => /Netherland/i.test((document.getElementById('hasilSku') || {}).innerText || ''));
  const h1 = await p.evaluate(() => ({ t: document.getElementById('hasilSku').innerText.replace(/\s+/g, ' '), f: document.activeElement && document.activeElement.id }));
  c('T7 ketik 6988: NDR 14 pcs di gudang HO, Seibu GI tertulis habis dengan jual terakhir 19 Okt; kolom tetap fokus', /14/.test(h1.t) && /HO/.test(h1.t) && /Seibu/i.test(h1.t) && /habis/i.test(h1.t) && /19 Okt/.test(h1.t) && h1.f === 'cariSku', JSON.stringify(h1));
  await p.fill('#cariSku', ''); await p.type('#cariSku', 'otter');
  await tunggu(() => /sea otter/i.test(document.getElementById('hasilSku').innerText) && !/Netherland/i.test(document.getElementById('hasilSku').innerText));
  const h2 = await p.evaluate(() => document.getElementById('hasilSku').innerText.replace(/\s+/g, ' '));
  await p.fill('#cariSku', 'x');
  await tunggu(() => /minimal/i.test(document.getElementById('hasilSku').innerText));
  c('T8 ganti ke "otter": hasil lama diganti, total 29; satu huruf memberi petunjuk, bukan galat', /29/.test(h2) && /minimal/i.test(await p.innerText('#hasilSku')), h2);
  await p.click('#dim', { position: { x: 20, y: 20 } }); await p.waitForTimeout(350);
});

await bagian('D. koleksi boneka', async () => {
  await p.evaluate(() => { location.hash = '#tugas'; }); await p.waitForSelector('[data-selesai="a1"]');
  for (const id of ['a1', 'a2', 'a3']) { await p.waitForSelector('[data-selesai="' + id + '"]'); await p.click('[data-selesai="' + id + '"]'); await tunggu((x) => document.getElementById('toast').classList.contains('on') && /ClickUp/.test(document.getElementById('toastTeks').innerText), 5000); await p.waitForTimeout(450); }
  await p.waitForSelector('.bonekabaru', { timeout: 4000 });
  const baru = await p.evaluate(() => { const d = document.querySelector('.bonekabaru'), im = d.querySelector('img'); return { t: d.innerText.replace(/\s+/g, ' '), ok: im.complete && im.naturalWidth > 0 }; });
  c('T9 tugas ketiga selesai memunculkan "Boneka baru" dengan gambar yang termuat', /Boneka baru/i.test(baru.t) && baru.ok, JSON.stringify(baru));
  await p.click('.bonekabaru'); await p.waitForTimeout(300);
  const kol = (await teks('[data-koleksi]')).join(' ');
  await p.click('[data-koleksi]'); await p.waitForSelector('.sheet.on .kgrid');
  const g = await p.$$eval('.sheet.on .kgrid > div', (a) => ({ n: a.length, punya: a.filter((x) => x.classList.contains('punya')).length }));
  c('T10 strip koleksi di tab Tugas menulis 1/32 dan 3 tugas lagi; lembar koleksi berisi 32 boneka, 1 sudah dimiliki', /1\s*\/\s*32/.test(kol) && /3 tugas lagi/.test(kol) && g.n === 32 && g.punya === 1, JSON.stringify([kol, g]));
  await p.click('#dim', { position: { x: 20, y: 20 } }); await p.waitForTimeout(350);
});

await bagian('E. data WMS belum ada', async () => {
  db.st.potret = {};
  await p.evaluate(() => { location.hash = '#beranda'; });
  await p.reload(); await tunggu(() => document.querySelectorAll('#app .c').length > 0);
  await p.waitForTimeout(500);
  const t = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  c('T11 tanpa salinan WMS: Beranda tetap tampil dengan kalimat penjelasan, tanpa petak kosong', /belum tersalin/i.test(t) && (await p.$$('[data-wms]')).length === 0, t.slice(0, 300));
  TW.pasangPotret(db, KINI - 3 * 3600e3);
  await p.reload(); await p.waitForSelector('[data-wms="terjual"]');
  const cat = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  c('T12 salinan WMS 3 jam lalu ditandai belum diperbarui', /belum diperbarui/i.test(cat), cat.slice(-200));
  ANEH = true;
  await p.reload(); await tunggu(() => document.querySelectorAll('#app .c').length > 0);
  await p.waitForTimeout(500);
  const t2 = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  ANEH = false;
  c('T13 jawaban wms berbentuk asing (server ops lama) tidak merusak Beranda: kartu surel dan tugas tetap tampil', /Segera balas MAA/.test(t2) && /Hari ini/i.test(t2) && (await p.$$('[data-wms]')).length === 0, t2.slice(0, 300));
});

if (errs.length) { console.log('\nGalat halaman: ' + errs.join(' | ')); gagal++; }
await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
