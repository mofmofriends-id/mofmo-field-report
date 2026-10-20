/* Uji aplikasi WMS Ops: kirim kabar ke mitra lewat WhatsApp (/ops/), 20 Okt 2026.
 * Harapan: "8 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. 20 Okt pagi Indra sakit dan kunjungan MAA 08.30 harus diundur; Ferdy memilih WA karena
 * mendesak, lalu minta aplikasinya punya opsi email dan WA. Yang mahal kalau salah:
 *  - teks WA masih berbau email ("Dear", "Warm regards", tanda tangan, kutipan surel lama);
 *  - tautan wa.me memakai nomor 08xx atau teks yang belum diedit;
 *  - sesudah dikabari lewat WA utasnya tetap ditagih sebagai giliran kita, atau sebaliknya balasan mitra
 *    berikutnya tidak lagi muncul sebagai giliran;
 *  - tombol email hilang (email tetap dibutuhkan untuk catatan resmi dan SIK).
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

await bagian('A. kirim kabar MAA lewat WA', async () => {
  await p.goto(ASAL + '/ops/');
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await tunggu(() => document.querySelectorAll('#app .c').length > 1);
  const b0 = await badge();
  await p.click('[data-buka="#surel/u1"]'); await p.waitForSelector('[data-wa="u1"]');
  const duaJalur = await p.evaluate(() => !!document.querySelector('[data-kirim="u1"]') && !!document.querySelector('[data-wa="u1"]') && document.documentElement.scrollWidth <= 390);
  await p.click('[data-wa="u1"]'); await p.waitForSelector('#teksWa');
  const t = await p.inputValue('#teksWa');
  c('W1 teks WA dari draft: "Selamat pagi Bu Desy," (jam 09.05), isi draft utuh, tanpa Dear, Warm regards, tanda tangan, maupun kutipan surel lama, ditutup Terima kasih',
    /^Selamat pagi Bu Desy,\n\n/.test(t) && /Kamis 22 Oktober pukul 08\.30/.test(t) && !/Dear|Warm regards|Ferdy|Business Operations|RAHASIA|wrote/.test(t) && /Terima kasih 🙏$/.test(t), JSON.stringify(t));
  c('W2 halaman surel tetap punya tombol email (Kirim balasan) di samping Kirim lewat WA, tanpa geser ke samping', duaJalur, String(duaJalur));
  await p.fill('#waNama', 'Bu Desy'); await p.fill('#waNomor', '12345'); await p.click('[data-wa-simpan]');
  await tunggu(() => /tidak sah/i.test(document.getElementById('sheet').innerText));
  const salahTersimpan = !!(db.st.catatan.kontakWa && (db.st.catatan.kontakWa.MAA || []).length);
  await p.fill('#teksWa', t + '\nSIK menyusul ya Bu.');
  await p.fill('#waNama', 'Bu Desy'); await p.fill('#waNomor', '0812-3456-7890'); await p.click('[data-wa-simpan]');
  await p.waitForSelector('[data-wa-ke="6281234567890"].on');
  const teksTetap = await p.inputValue('#teksWa');
  c('W3 nomor salah ditolak dengan pesan; 0812-3456-7890 tersimpan sebagai 6281234567890 dan langsung terpilih; teks yang sudah diedit tidak hilang',
    !salahTersimpan && db.st.catatan.kontakWa.MAA[0].nomor === '6281234567890' && /SIK menyusul ya Bu\.$/.test(teksTetap), JSON.stringify([db.st.catatan.kontakWa, teksTetap.slice(-30)]));
  const akhir = teksTetap + '\nKabari ya Bu kalau tanggalnya kurang pas.';
  await p.fill('#teksWa', akhir);
  await p.click('[data-wa-buka]');
  await tunggu(() => /lewat WA/.test(document.getElementById('toastTeks').innerText));
  const buka = await p.evaluate(() => window.__dibuka.slice());
  c('W4 Buka WhatsApp memakai wa.me/6281234567890 dengan teks hasil edit terakhir (diedit lagi sesudah simpan nomor), dan utas ditandai untuk pesan m4',
    buka.length === 1 && buka[0] === 'https://wa.me/6281234567890?text=' + encodeURIComponent(akhir) && db.st.catatan.wa && db.st.catatan.wa.u1.pesan === 'm4', JSON.stringify([buka, db.st.catatan.wa]));
  await p.evaluate(() => { location.hash = '#beranda'; }); await p.waitForTimeout(400);
  const ber = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  const b1 = await badge();
  await p.evaluate(() => { location.hash = '#mitra'; }); await p.waitForTimeout(400);
  const mitra = await p.evaluate(() => { const s = [...document.querySelectorAll('.sec')]; const g = s.find((x) => /giliran/i.test(x.innerText)), m = s.find((x) => /menunggu/i.test(x.innerText)); const isi = (x) => { let o = '', n = x && x.nextElementSibling; while (n && !n.classList.contains('sec')) { o += n.innerText + ' | '; n = n.nextElementSibling; } return o.replace(/\s+/g, ' '); }; return { g: isi(g), m: isi(m) }; });
  c('W5 sesudah dikabari lewat WA: tidak lagi "Segera balas MAA" di Beranda, lencana Mitra turun satu, di tab Mitra pindah ke Menunggu mitra bertuliskan lewat WA',
    !/Segera balas MAA/.test(ber) && b1 === b0 - 1 && !/MAA/.test(mitra.g) && /MAA/.test(mitra.m) && /lewat WA/i.test(mitra.m), JSON.stringify([b0, b1, mitra]));
});

await bagian('B. tanpa nomor tersimpan', async () => {
  await p.evaluate(() => { location.hash = '#surel/u4'; }); await p.waitForSelector('[data-wa="u4"]');
  await p.click('[data-wa="u4"]'); await p.waitForSelector('#teksWa');
  const t = await p.inputValue('#teksWa');
  const pilih = await p.evaluate(() => !!document.querySelector('[data-wa-ke=""].on'));
  await p.click('[data-wa-buka]');
  await tunggu(() => window.__dibuka.length === 2);
  const u = await p.evaluate(() => window.__dibuka[1]);
  c('W6 TGI belum punya nomor: pilihan "Pilih kontak di WhatsApp" aktif, tautan wa.me tanpa nomor; teks "Selamat pagi Bu Novi," tanpa Best regards',
    pilih && u === 'https://wa.me/?text=' + encodeURIComponent(t) && /^Selamat pagi Bu Novi,/.test(t) && !/Best regards|Ferdy/.test(t), JSON.stringify([pilih, u.slice(0, 80), t]));
});

await bagian('C. balasan mitra berikutnya', async () => {
  db.st.surel.utas[0] = Object.assign({}, db.st.surel.utas[0], { pesan: 'm5', waktuPesan: KINI - 60e3, draft: 'd2', draftIsi: 'Dear Bu Desy,\n\nBaik, Kamis kami hadir.\n\nWarm regards,\nFerdy' });
  await p.evaluate(() => { location.hash = '#beranda'; }); await p.reload();
  await tunggu(() => document.querySelectorAll('#app .c').length > 0); await p.waitForTimeout(400);
  const ber = await p.evaluate(() => document.getElementById('app').innerText.replace(/\s+/g, ' '));
  c('W7 balasan baru MAA (pesan m5) kembali jadi "Segera balas MAA" walaupun pesan sebelumnya sudah dikabari lewat WA', /Segera balas MAA/.test(ber), ber.slice(0, 300));
  await p.click('[data-buka="#surel/u1"]'); await p.waitForSelector('[data-wa="u1"]');
  await p.click('[data-wa="u1"]'); await p.waitForSelector('#teksWa');
  const pilih = await p.evaluate(() => !!document.querySelector('[data-wa-ke="6281234567890"].on'));
  c('W8 nomor Bu Desy yang sudah tersimpan langsung terpilih di kabar berikutnya', pilih, String(pilih));
});

if (errs.length) { console.log('\nGalat halaman: ' + errs.join(' | ')); gagal++; }
await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
