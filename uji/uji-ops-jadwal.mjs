/* Uji tab Jadwal di aplikasi WMS Ops (/ops/), 19 Okt 2026.
 * Harapan: "9 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt 22.03): "boleh ga ke link ke [jadwal] PIC Operasional yang visit schedule.
 * Biar gampang ubah jadwal? Dan kirim jadwal baru ke indra". Tab Jadwal memakai ulang jalur WMS yang sudah ada
 * (ambilJadwalPic, terbitkanJadwalPic, PDF dan gambar staf dari jadwal.js). Lembar Jadwal Kunjungan adalah kunci
 * check-in Indra, jadi yang mahal kalau salah, dan diam:
 *  - geser satu kunjungan ikut menghapus atau menggandakan kunjungan lain di bulan itu;
 *  - terbit tanpa PDF untuk penerima, server menolak semuanya, atau PDF berisi susunan lama;
 *  - pesan ke Indra menyebut tanggal yang salah, atau ke nomor yang salah;
 *  - hari dengan 3 gerai lolos tanpa peringatan.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 9;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 700))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const W = (s) => Date.parse(s + '+07:00');
const KINI = W('2026-10-19T20:00:00');                     // Senin
const TIKET = (KINI + 3600e3) + '.tiket-uji';
const GERAI = [
  ['T305', 'TOYS KINGDOM LIVING WORLD ALAM SUTERA', 'TGI', 'Selasa'], ['T390', 'TOYS KINGDOM LIVING WORLD KOTA WISATA CIBUBUR', 'TGI', 'Kamis'],
  ['T317', 'TOYS KINGDOM MALL ARTHA GADING', 'TGI', 'Jumat'], ['T311', 'TOYS KINGDOM MARGO CITY DEPOK', 'TGI', 'Kamis'],
  ['KIY-GI', 'KINOKUNIYA GRAND INDONESIA', 'KIY', 'Senin'], ['KIY-PIK', 'KINOKUNIYA PIK', 'KIY', 'Jumat'],
  ['MAA-SGI', 'BABYZ STATION SEIBU GRAND INDONESIA', 'MAA', 'Senin'], ['MAA-PIM2', 'BABYZ STATION SEIBU PIM 2', 'MAA', 'Rabu']].map((g) => ({ kode: g[0], nama: g[1], retailer: g[2], hari: g[3] }));
const ISI = {};
const pasang = (tgl, kode) => tgl.forEach((d) => { const t = '2026-10-' + String(d).padStart(2, '0'); (ISI[t] = ISI[t] || []).push(kode); });
pasang([12, 19, 26], 'KIY-GI'); pasang([12, 19, 26], 'MAA-SGI'); pasang([13, 20, 27], 'T305'); pasang([14, 21, 28], 'MAA-PIM2');
pasang([15, 22, 29], 'T311'); pasang([15, 22, 29], 'T390'); pasang([16, 23, 30], 'T317'); pasang([16, 23, 30], 'KIY-PIK');
const KONTAK = [
  { kunci: 'KIY', penerima: 'Kinokuniya GI dan PIK', gerai: ['KIY-GI', 'KIY-PIK'], kepada: 'Suryadi@kinokuniya.co.id', cc: 'ratih@onelogisticssolutions.com', sapaan: 'Pak Suryadi', namaSurat: 'Kinokuniya' },
  { kunci: 'MAA', penerima: 'Babyz Station Seibu', gerai: ['MAA-SGI', 'MAA-PIM2'], kepada: 'deasyana.wulandari@mapactive.id', cc: '', sapaan: 'Ibu Desy', namaSurat: 'Babyz Station' },
  { kunci: 'T305', penerima: 'Living World Alam Sutera', gerai: ['T305'], kepada: 'mgrtoys.alamsutera@toyskingdom.co.id', cc: '', sapaan: 'Pak/Bu', namaSurat: 'Toys Kingdom Living World Alam Sutera' },
  { kunci: 'T311', penerima: 'Margo City Depok', gerai: ['T311'], kepada: 'mgrtoys.margocity@toyskingdom.co.id', cc: '', sapaan: 'Pak/Bu', namaSurat: 'Toys Kingdom Margo City' },
  { kunci: 'T390', penerima: 'Living World Kota Wisata Cibubur', gerai: ['T390'], kepada: 'mgrtoys.livingkotawisata@toyskingdom.co.id', cc: '', sapaan: 'Pak/Bu', namaSurat: 'Toys Kingdom Kota Wisata' },
  { kunci: 'T317', penerima: 'Mall Artha Gading', gerai: ['T317'], kepada: 'mgrtoys.arthagading@toyskingdom.co.id', cc: '', sapaan: 'Pak/Bu', namaSurat: 'Toys Kingdom Artha Gading' }];
const D = { ok: true, bulan: '2026-10', gerai: GERAI, jadwal: ISI, bulanLalu: { bulan: '2026-09', jadwal: {} }, terbit: { versi: 1, waktu: '2026-10-11 20:00', isi: ISI },
  draf: null, libur: [], liburTercatat: true, geser: [], kontak: KONTAK,
  pic: { nama: 'Indra Jaya', kontak: '085772583698', penanda: 'Ferdy Febrian Iskandar', jabatan: 'Business Operations', email: 'ferdy.febrian@onelogisticssolutions.com' } };

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JENIS = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/ops/') u = '/ops/index.html';
  const f = path.join(AKAR, 'wms', u);
  if (!f.startsWith(path.join(AKAR, 'wms')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': JENIS[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const ASAL = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((t) => {
  localStorage.setItem('wms_tiket', t); localStorage.setItem('wms_ingat', '1');
  window.__dibagi = []; window.__dibuka = [];
  window.__bisaBagi = true;
  navigator.canShare = (x) => window.__bisaBagi && !!(x && x.files);
  navigator.share = async (x) => { window.__dibagi.push({ teks: x.text, berkas: (x.files || []).map((f) => ({ nama: f.name, jenis: f.type, besar: f.size })) }); };
  window.open = (u) => { window.__dibuka.push(String(u)); return null; };
}, TIKET);
const GAS = [];
await ctx.route('**/macros/s/**', async (route) => {
  const m = JSON.parse(route.request().postData() || '{}'); GAS.push(m);
  let hasil;
  if (m.nama === 'ambilJadwalPic') hasil = D;
  else if (m.nama === 'terbitkanJadwalPic') hasil = { ok: true, versi: 2, waktu: '2026-10-19 20:05', kunjungan: 24, draf: [{ kunci: 'T305', penerima: 'Living World Alam Sutera', mode: 'ubah', balasan: true, draftId: 'r1' }], pesan: 'Oktober 2026 versi 2 terbit: 24 kunjungan, 1 draf Gmail siap.' };
  else if (m.nama === 'simpanDrafJadwalPic') hasil = { ok: true, waktu: '2026-10-19 20:03' };
  else hasil = { ok: false, pesan: 'tidak dikenal' };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ pintu: 'ok', hasil }) });
});
const JANJI = [{ id: 1, utas: 'u1', pesan: 'm4', mitra: 'MAA', judul: 'Opname dan penarikan stok', mulai: W('2026-10-22T08:30:00'), selesai: null, lokasi: 'Babyz Station Seibu Grand Indonesia', catatan: '', status: 'usul', dikabari: true, berjam: true, pic: 'Indra' }];
await ctx.route('**/functions/v1/ops', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, surel: { utas: [] }, janji: JANJI, hariIni: [], minggu: [], nanti: [], timTelat: [] }) }));
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date(KINI));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const tunggu = (fn, ms) => p.waitForFunction(fn, null, { timeout: ms || 8000 });
const hari = async (t) => p.$$eval('[data-jd-hari="' + t + '"] [data-jd-gerai]', (a) => a.map((x) => x.getAttribute('data-jd-gerai').split('|')[1]));

await bagian('A. lihat dan geser', async () => {
  await p.goto(ASAL + '/ops/#jadwal');
  await p.waitForSelector('[data-jd-hari="2026-10-20"]');
  const a = GAS.find((x) => x.nama === 'ambilJadwalPic');
  c('A1 jadwal Oktober dibaca lewat Apps Script dengan tiket WMS; Selasa 20 berisi Alam Sutera, Sabtu dan Minggu tidak ditampilkan',
    a && a.aksi === 'wms' && a.fn === 'panggil' && a.tiket === TIKET && a.args.join() === 'WMS-TIKET,2026-10' && (await hari('2026-10-20')).join() === 'T305' && !(await p.$('[data-jd-hari="2026-10-24"]')),
    JSON.stringify(a));
  await p.click('[data-jd-gerai="2026-10-22|T311"]'); await p.click('[data-jd-ke="2026-10-21"]');
  await p.waitForSelector('[data-jd-cek]');
  const cek = await p.innerText('[data-jd-cek]');
  c('A2 geser Margo City ke Rabu 21 membuat hari itu 2 gerai: belum diperingatkan; geser Alam Sutera juga ke 21 jadi 3 gerai: muncul peringatan lebih dari 2 gerai',
    /Paling banyak 2/.test(cek) || !/lebih dari 2/.test(cek), cek);
  await p.click('[data-jd-gerai="2026-10-20|T305"]'); await p.click('[data-jd-ke="2026-10-21"]');
  await tunggu(() => /lebih dari 2 gerai/.test((document.querySelector('[data-jd-cek]') || {}).innerText || ''));
  await p.click('[data-jd-kembali]');
  await tunggu(() => !document.querySelector('[data-jd-cek]'));
  await p.click('[data-jd-gerai="2026-10-20|T305"]'); await p.click('[data-jd-ke="2026-10-21"]');
  await p.waitForSelector('[data-jd-terbit]');
  const bar = await p.innerText('[data-jd-bar]');
  c('A3 Kembalikan membatalkan semua geseran; geser Alam Sutera ke Rabu 21 saja: 20 kosong, 21 berisi Seibu PIM 2 dan Alam Sutera, 22 tetap Margo City dan Kota Wisata, bar menyebut 1 perubahan',
    (await hari('2026-10-20')).length === 0 && (await hari('2026-10-21')).join() === 'MAA-PIM2,T305' && (await hari('2026-10-22')).sort().join() === 'T311,T390' && /1 perubahan/.test(bar), bar);
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/ops-jadwal-geser.png' });
});

await bagian('B. terbitkan dan kirim ke Indra', async () => {
  await p.click('[data-jd-terbit]');
  await p.waitForSelector('[data-jd-indra]', { timeout: 30000 });
  const t = GAS.find((x) => x.nama === 'terbitkanJadwalPic');
  const paket = t && t.args[2] || {};
  const pdfOk = Object.keys(paket.berkas || {}).sort().join() === KONTAK.map((k) => k.kunci).sort().join() && Object.values(paket.berkas).every((f) => Buffer.from(f.b64, 'base64').slice(0, 4).toString() === '%PDF' && /\.pdf$/.test(f.nama));
  c('B1 terbit mengirim susunan baru (T305 pindah 20 ke 21, bulan lain tidak ada) dan satu PDF sah untuk tiap penerima Kontak Mitra; hasil server tampil',
    t && t.args[1] === '2026-10' && !(paket.isi['2026-10-20'] || []).includes('T305') && paket.isi['2026-10-21'].includes('T305') && paket.isi['2026-10-13'].includes('T305') && pdfOk && /versi 2 terbit/.test(await p.innerText('#app')),
    JSON.stringify({ arg: t && t.args.slice(0, 2), kunci: Object.keys(paket.berkas || {}) }));
  await p.click('[data-jd-indra]');
  await tunggu(() => window.__dibagi.length > 0, 15000);
  const g = (await p.evaluate(() => window.__dibagi))[0];
  c('B2 Kirim ke Indra membagikan gambar jadwal PNG dan pesan yang menyebut perubahannya (Alam Sutera Selasa 20 Okt jadi Rabu 21 Okt)',
    g.berkas.length === 1 && g.berkas[0].jenis === 'image/png' && g.berkas[0].besar > 20000 && /Alam Sutera: Selasa 20 Okt jadi Rabu 21 Okt/.test(g.teks) && /Pak Indra/.test(g.teks), JSON.stringify(g));
  await p.evaluate(() => { window.__bisaBagi = false; });
  await p.click('[data-jd-indra]');
  await tunggu(() => window.__dibuka.length > 0, 15000);
  const u = (await p.evaluate(() => window.__dibuka))[0];
  c('B3 HP yang tidak bisa membagikan berkas: gambar diunduh dan WhatsApp dibuka ke nomor Indra (62857...) dengan pesan perubahan', /^https:\/\/wa\.me\/6285772583698\?text=/.test(u) && /Alam%20Sutera/.test(u), u);
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth);
  c('B4 tanpa galat halaman dan tanpa geser ke samping di lebar 390', errs.length === 0 && lebar <= 390, JSON.stringify({ errs, lebar }));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/ops-jadwal.png' });
});

await bagian('C. agenda mitra dan jadwal Indra', async () => {
  D.terbit.isi = JSON.parse(JSON.stringify(ISI)); D.jadwal = D.terbit.isi;
  const sebelum = GAS.filter((x) => x.nama === 'ambilJadwalPic').length;
  await p.goto(ASAL + '/ops/#beranda'); await p.reload();
  await p.waitForSelector('[data-janji="1"] [data-jd-ke-tgl]', { timeout: 10000 });
  const kartu = await p.innerText('[data-janji="1"]');
  c('C1 kartu agenda MAA Kamis 22 08.30 menyebut jadwal Indra hari itu (Margo City, Kota Wisata) dari lembar Jadwal Kunjungan yang dibaca ulang',
    /Indra hari itu: Margo City, Kota Wisata/.test(kartu) && GAS.filter((x) => x.nama === 'ambilJadwalPic').length > sebelum, kartu + ' sebelum=' + sebelum + ' sesudah=' + GAS.filter((x) => x.nama === 'ambilJadwalPic').length);
  await p.click('[data-janji="1"] [data-jd-ke-tgl]');
  await p.waitForSelector('[data-jd-hari="2026-10-22"]');
  c('C2 tombol Atur jadwal membuka tab Jadwal bulan itu dan hari itu ditandai', /#jadwal/.test(p.url()) && !!(await p.$('[data-jd-hari="2026-10-22"].sorot')), p.url());
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
