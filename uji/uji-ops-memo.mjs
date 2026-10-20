/* Uji aplikasi WMS Ops: catatan cepat di Beranda (/ops/), 20 Okt 2026.
 * Harapan: "8 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy: "apk bisa gua ngetik nambah tugas atau catatan ga?" lalu "gas". Catatan cepat
 * ditulis di Beranda, disimpan di server, bisa dicentang selesai, dan bisa dijadikan tugas ClickUp. Yang mahal
 * kalau salah: ketikan hilang waktu Beranda dimuat ulang di latar, catatan yang sudah jadi tugas masih terlihat
 * belum ditangani, atau catatan cuma tersimpan di layar (tidak sampai server) sehingga hilang di HP lain.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 8;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 800))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const KINI = T.W('2026-10-20T09:05:00');
const RAHASIA = 'rahasia-uji-ops-wa-app-0123456789abcdef', SIDIK = 'sidik-uji-ops-wa-app';
const db = T.dbPalsu(RAHASIA, SIDIK), cu = T.clickupPalsu(KINI), L = T.luarPalsu(cu);
L.kunciPublik = async () => 'BPalsu';
const DRAFT_MAA = 'Dear Bu Desy,\n\nMohon maaf, Operational PIC kami hari ini sakit sehingga kunjungan kami undur ke Kamis 22 Oktober pukul 08.30.\n\nWarm regards,\nFerdy Febrian Iskandar\nBusiness Operations\n\nOn Mon, Oct 19, 2026 Deasyana wrote:\n> RAHASIA-KUTIPAN-LAMA';
db.st.surel = { waktu: KINI - 60e3, utas: [
  { id: 'u1', subjek: 'Permohonan Izin Penarikan Stok', mitra: 'MAA', status: 'draft', tingkat: 'merah', hariKerja: 0, pesan: 'm4', pengirim: 'Deasyana Wulandari',
    cuplikan: 'SIK revisi', isiPesan: 'Mohon dibuatkan SIK revisi.', waktuPesan: KINI - 3 * 3600e3, draft: 'd1', draftT: KINI - 3600e3, draftIsi: DRAFT_MAA, url: 'https://mail.google.com/mail/u/0/#all/u1' },
  { id: 'u4', subjek: 'Listing ruparupa 11 SKU', mitra: 'TGI', status: 'lanjutan', lanjutan: true, tingkat: 'merah', hariKerja: 3, pesan: 't7', waktuPesan: KINI - 5 * 864e5,
    draft: 'ds', draftT: KINI - 3600e3, draftIsi: 'Dear Bu Novi,\n\nMenindaklanjuti email kami tanggal 15 Oktober terkait listing 11 SKU.\n\nBest regards,\nFerdy', url: 'https://mail.google.com/mail/u/0/#all/u4' }] };
const ENV = { OPS_RAHASIA: '', CLICKUP_TOKEN: 'pk_12345678_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345' };
const TOKEN = 'pk_12345678_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
L.token = TOKEN; L.pakaiToken = (t) => { L.token = t; };
{ const asli = cu.api; L.clickup = async (m, p, i) => { if (L.token !== TOKEN) throw new Error('401 Token invalid'); return asli(m, p, i); }; }

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
await ctx.addInitScript(() => { window.__dibuka = []; window.open = (u) => { window.__dibuka.push(String(u)); return null; }; });
await ctx.route('**/functions/v1/wms', (route) => {
  const m = JSON.parse(route.request().postData() || '{}');
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(m.fn === 'masuk' && m.kode === 'KODE-UJI' ? { ok: true, tiket: T.tiketDari(RAHASIA, SIDIK, KINI) } : { ok: false, pesan: 'x' }) });
});
await ctx.route('**/functions/v1/ops', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, L, ENV);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
await ctx.route('https://script.google.com/**', (route) => route.abort());
const p = await ctx.newPage();
p.setDefaultTimeout(6000);
await p.clock.setFixedTime(new Date(KINI));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const tunggu = (fn, ms) => p.waitForFunction(fn, null, { timeout: ms || 5000 });
const badge = () => p.evaluate(() => { const i = document.querySelector('[data-buka="#mitra"] i'); return i ? Number(i.innerText) : 0; });



const teksApp = () => p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
const simpanan = () => ((db.st.catatan.memo || {}).daftar || []);

await bagian('A. menulis catatan', async () => {
  await p.goto(ASAL + '/ops/');
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await p.waitForSelector('#memoBaru');
  await p.fill('#memoBaru', 'Tanya Bu Desy soal SIK revisi\nsebelum Kamis');
  await p.click('[data-memo-simpan]');
  await tunggu(() => /Tanya Bu Desy soal SIK revisi/.test(document.getElementById('app').innerText));
  const st = await p.evaluate(() => ({ isi: document.getElementById('memoBaru').value, lebar: document.documentElement.scrollWidth }));
  c('M1 catatan disimpan ke server, tampil di Beranda, kolom dikosongkan, tanpa geser ke samping',
    simpanan().length === 1 && simpanan()[0].teks === 'Tanya Bu Desy soal SIK revisi\nsebelum Kamis' && st.isi === '' && st.lebar <= 390, JSON.stringify([simpanan(), st]));
  const n0 = simpanan().length;
  await p.fill('#memoBaru', '   '); await p.click('[data-memo-simpan]');
  await tunggu(() => /kosong/i.test(document.getElementById('toastTeks').innerText));
  c('M2 catatan kosong tidak dikirim, ada kabar', simpanan().length === n0, JSON.stringify(simpanan()));
  await p.fill('#memoBaru', 'Ketikan setengah jadi');
  const sebelum = await p.evaluate(() => window.__muat = (window.__muat || 0));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(600);
  const v = await p.evaluate(() => document.getElementById('memoBaru') && document.getElementById('memoBaru').value);
  c('M3 ketikan di kolom catatan tidak hilang saat Beranda dimuat ulang di latar', v === 'Ketikan setengah jadi', JSON.stringify(v));
  await p.fill('#memoBaru', '');
});

await bagian('B. selesai, kembalikan, hapus', async () => {
  const id = simpanan()[0].id;
  await p.click('[data-memo-selesai="' + id + '"]');
  await tunggu(() => /Selesai \(1\)/.test(document.getElementById('app').innerText));
  const t1 = await teksApp();
  c('M4 dicentang: tersimpan selesai di server, pindah ke kelompok Selesai yang tertutup', !!simpanan()[0].selesai && !/Tanya Bu Desy/.test(t1), t1.slice(0, 300));
  await p.click('[data-memo-lihat-selesai]');
  await p.click('[data-memo-selesai="' + id + '"]');
  await tunggu(() => !/Selesai \(1\)/.test(document.getElementById('app').innerText));
  c('M5 dikembalikan dari kelompok Selesai: belum selesai lagi di server dan tampil di daftar', !simpanan()[0].selesai && /Tanya Bu Desy/.test(await teksApp()), JSON.stringify(simpanan()));
  await p.click('[data-memo-selesai="' + id + '"]');
  await tunggu(() => /Selesai \(1\)/.test(document.getElementById('app').innerText));
  if ((await p.getAttribute('[data-memo-lihat-selesai]', 'aria-expanded')) !== 'true') await p.click('[data-memo-lihat-selesai]');
  await p.click('[data-memo-hapus="' + id + '"]');
  await tunggu(() => !/Selesai \(1\)/.test(document.getElementById('app').innerText));
  c('M6 catatan selesai bisa dihapus dan hilang dari server', simpanan().length === 0, JSON.stringify(simpanan()));
});

await bagian('C. jadikan tugas ClickUp', async () => {
  await p.fill('#memoBaru', 'Follow up TGI soal listing\nTanya Bu Novi status 11 SKU');
  await p.click('[data-memo-simpan]');
  await p.waitForSelector('[data-memo-tugas]');
  const id = simpanan()[0].id;
  await p.click('[data-memo-tugas="' + id + '"]');
  await p.waitForSelector('#judulBaru');
  const judul = await p.$eval('#judulBaru', (x) => x.value);
  c('M7 Jadikan tugas membuka lembar Tugas baru dengan judul dari baris pertama catatan', judul === 'Follow up TGI soal listing', JSON.stringify(judul));
  await p.click('[data-simpanbaru]');
  await tunggu(() => /ClickUp/.test(document.getElementById('toastTeks').innerText));
  await p.waitForTimeout(400);
  const baru = cu.tugas.find((t) => t.name === 'Follow up TGI soal listing');
  const m = simpanan().find((x) => x.id === id);
  c('M8 tugas masuk ClickUp dengan sisa catatan sebagai deskripsi; catatannya otomatis selesai dan tertaut ke tugas',
    !!baru && /Tanya Bu Novi status 11 SKU/.test(baru.description || '') && !!m.selesai && m.tugas === String(baru.id) && !/Follow up TGI soal listing/.test((await teksApp()).split('Selesai (')[0].split('Catatan cepat')[1] || ''),
    JSON.stringify([baru && { name: baru.name, d: baru.description, id: baru.id }, m]));
});

if (errs.length) { console.log('\nGalat halaman: ' + errs.join(' | ')); gagal++; }
await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
