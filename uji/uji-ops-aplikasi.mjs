/* Uji aplikasi WMS Ops di /ops/ (HP Ferdy), 19 Okt 2026.
 * Harapan: "13 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt): mau bentuk "kayak apk": notif balasan mitra dengan draft yang bisa
 * direvisi atau dikirim, tugas ClickUp yang dicentang jadi Done di ClickUp, tambah tugas dan isi progres untuk
 * diri sendiri dan tim. Server asli (ops/inti.js) dijalankan di belakang halaman dengan basis data dan ClickUp
 * tiruan, jadi yang diuji perjalanan utuh dari ketukan sampai ke ClickUp. Yang mahal kalau salah:
 *  - draft yang terkirim berbeda dengan yang dibaca (isi kutipan surel lama ikut tampil sebagai isi draft);
 *  - centang Done tidak sampai ke ClickUp tapi hilang dari layar, atau urungkan tidak mengembalikan status;
 *  - tugas tim yang belum telat ditagih;
 *  - tugas baru masuk ke orang atau list yang salah;
 *  - layar melebar di HP (geser ke samping).
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
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 600))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const KINI = T.W('2026-10-20T07:40:00');
const RAHASIA = 'rahasia-uji-ops-aplikasi-0123456789abcdef', SIDIK = 'sidik-uji-ops-aplikasi';
const db = T.dbPalsu(RAHASIA, SIDIK), cu = T.clickupPalsu(KINI), L = T.luarPalsu(cu);
L.kunciPublik = async () => 'BPalsu';
db.st.surel = { waktu: KINI - 4 * 60e3, utas: [
  { id: 'u1', subjek: 'Permohonan Izin Penarikan Stok Tidak Terpajang', mitra: 'MAA', status: 'draft', tingkat: 'merah', hariKerja: 0, pesan: 'm4', pengirim: 'Deasyana Wulandari',
    cuplikan: 'Mohon dibuatkan SIK revisi Selasa 20 Oktober', isiPesan: 'Mohon dibuatkan SIK revisi hari Selasa 20 Oktober 2026, Seibu GI pukul 08.30 WIB.', waktuPesan: KINI - 18 * 3600e3,
    draft: 'd1', draftT: KINI - 17 * 3600e3, draftIsi: 'Dear Bu Desy,\n\nBaik, Operational PIC kami hadir Selasa pukul 08.30.\n\nWarm regards,\nFerdy\n\nOn Mon, Oct 19, 2026 Deasyana wrote:\n> RAHASIA-KUTIPAN-LAMA', url: 'https://mail.google.com/mail/u/0/#all/u1', urlDraft: 'https://mail.google.com/mail/u/0/#drafts?compose=d1' },
  { id: 'u2', subjek: 'Evaluasi Gerai Margo City', mitra: 'TGI', status: 'menunggu', tingkat: 'kuning', hariKerja: 4, url: 'https://mail.google.com/mail/u/0/#all/u2' },
  { id: 'u4', subjek: 'Listing ruparupa 11 SKU', mitra: 'TGI', status: 'lanjutan', lanjutan: true, tingkat: 'merah', hariKerja: 3, pesan: 't7', waktuPesan: KINI - 5 * 864e5,
    draft: 'ds', draftT: KINI - 3600e3, draftIsi: 'Dear Bu Novi,\n\nMenindaklanjuti email kami tanggal 15 Oktober terkait listing 11 SKU.\n\nWarm regards', url: 'https://mail.google.com/mail/u/0/#all/u4', urlDraft: 'x' }] };
const ENV = { OPS_RAHASIA: 'x', CLICKUP_TOKEN: 'pk_palsu' };
db.st.janji.push({ id: 1, utas: 'u1', pesan: 'm4', mitra: 'MAA', judul: 'Opname dan penarikan stok', mulai: T.W('2026-10-20T08:30:00'), selesai: null, lokasi: 'Babyz Station Seibu Grand Indonesia', catatan: '', status: 'usul', dikabari: true, berjam: true, pic: 'Indra' },
  { id: 3, utas: 'u2', pesan: 't9', mitra: 'TGI', judul: 'Kirim daftar stok Margo untuk dipindah', mulai: null, selesai: null, lokasi: '', catatan: '', status: 'usul', dikabari: true, berjam: false, pic: null },
  { id: 2, utas: 'u3', pesan: 'k1', mitra: 'KIY', judul: 'Pasang fixture', mulai: T.W('2026-10-21T10:00:00'), selesai: null, lokasi: 'Kinokuniya GI', catatan: '', status: 'usul', dikabari: true, berjam: true, pic: null });

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/ops/') u = '/ops/index.html';
  const f = path.join(AKAR, 'wms', u);
  if (!f.startsWith(path.join(AKAR, 'wms')) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' })[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const ASAL = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let masukKode = null;
await ctx.route('**/functions/v1/wms', async (route) => {
  const m = JSON.parse(route.request().postData() || '{}'); masukKode = m;
  const ok = m.fn === 'masuk' && m.kode === 'KODE-UJI';
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(ok ? { ok: true, tiket: T.tiketDari(RAHASIA, SIDIK, KINI) } : { ok: false, pesan: 'That access code is not right.' }) });
});
await ctx.route('**/functions/v1/ops', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, L, ENV);
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
await p.clock.setFixedTime(new Date(KINI));
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
p.on('dialog', (d) => d.accept());
const teks = (sel) => p.$$eval(sel, (a) => a.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
const tunggu = (fn, ms) => p.waitForFunction(fn, null, { timeout: ms || 5000 });

await bagian('A. masuk dan beranda', async () => {
  await p.goto(ASAL + '/ops/');
  await p.fill('#kode', 'KODE-UJI'); await p.click('#tMasuk');
  await tunggu(() => document.querySelectorAll('.c').length > 3);
  c('A1 masuk dengan kode akses WMS (ingat 7 hari), tiket tersimpan dengan kunci yang sama dengan WMS', masukKode && masukKode.ingat === true && (await p.evaluate(() => localStorage.getItem('wms_tiket'))) === T.tiketDari(RAHASIA, SIDIK, KINI), JSON.stringify(masukKode));
  const sec = await p.$$eval('.sec', (a) => a.map((s) => { const out = []; let n = s.nextElementSibling; while (n && !n.classList.contains('sec')) { out.push(n.innerText.replace(/\s+/g, ' ')); n = n.nextElementSibling; } return s.innerText + ' => ' + out.join(' ## '); }));
  const hari = sec.find((x) => /^HARI INI/i.test(x)) || '', minggu = sec.find((x) => /^MINGGU INI/i.test(x)) || '';
  c('A2 Hari ini: Segera balas MAA (draft siap) dan Rekap HPP; Minggu ini: TGI belum membalas, Final listing, Desain banner bertanda TAGIH; Jadwal posting (belum telat) tidak ditagih',
    /Segera balas MAA/.test(hari) && /Rekap HPP/.test(hari) && /TGI belum membalas/.test(minggu) && /Final listing/.test(minggu) && /Desain banner.*TAGIH/.test(minggu) && !/Jadwal posting/.test(hari + minggu), sec.join(' || '));
});

await bagian('A2. agenda dari surel', async () => {
  const kart = await teks('[data-janji]');
  await p.click('[data-janji="1"]'); await p.waitForSelector('[data-janjilist="L1"]');
  await p.click('[data-janjilist="L1"]'); await p.click('[data-janjiok="1"]');
  await tunggu(() => /Masuk ClickUp/.test(document.getElementById('toastTeks').innerText));
  const post = cu.panggil.filter((x) => x[0] === 'POST' && x[1] === '/list/L1/task');
  const sisa = await p.$$eval('[data-janji]', (a) => a.length);
  c('A3 kartu agenda MAA Selasa 20 Okt 08.30 tampil di Beranda; Jadikan agenda (pilih list Konten) membuat tugas ClickUp dan antrean kalender, kartunya hilang',
    kart.some((t) => /MAA.*Opname/.test(t) && /Selasa 20 Okt 08\.30/.test(t)) && post.length === 1 && post[0][2].due_date === T.W('2026-10-20T08:30:00') && db.st.antrean.some((x) => x.jenis === 'agenda' && x.janji === 1) && sisa === 2,
    JSON.stringify({ kart, post, sisa }));
  await p.click('[data-abaikan="2"]');
  await tunggu(() => !document.querySelector('[data-janji="2"]'));
  const j2 = db.st.janji.find((x) => x.id === 2);
  c('A4 Abaikan menandai janji KIY diabaikan dan kartunya hilang', j2.status === 'diabaikan' && !(await p.$('[data-janji="2"]')), JSON.stringify(j2));
  const kk = await teks('[data-janji="3"]');
  await p.click('[data-janji="3"]'); await p.waitForSelector('[data-janjiok="3"]');
  const tombol = await p.innerText('[data-janjiok="3"]');
  await p.click('[data-janjiok="3"]');
  await tunggu(() => /sebagai tugas/.test(document.getElementById('toastTeks').innerText));
  const pt = cu.panggil.filter((x) => x[0] === 'POST' && /Margo/.test((x[2] || {}).name || ''));
  c('A5 kesepakatan TGI tanpa tanggal: kartu bertulis "Jadikan tugas" dan "tanpa tenggat", jadi satu tugas ClickUp tanpa tenggat, tanpa antrean kalender',
    /Jadikan tugas/.test(kk.join()) && /tanpa tenggat/.test(kk.join()) && /Jadikan tugas/.test(tombol) && pt.length === 1 && pt[0][2].due_date === undefined && !db.st.antrean.some((x) => x.jenis === 'agenda' && x.janji === 3), JSON.stringify({ kk, tombol, pt }));
  db.st.antrean.length = 0;
});

await bagian('B. centang Done dan urungkan', async () => {
  await p.click('[data-selesai="a1"]');
  await tunggu(() => /Urungkan/.test(document.getElementById('toast').innerText) && document.getElementById('toast').classList.contains('on'));
  const s1 = cu.tugas.find((x) => x.id === 'a1').status.status;
  await p.click('#toastAksi');
  await tunggu(() => /kembali ke open/.test(document.getElementById('toastTeks').innerText));
  c('B1 centang: status ClickUp jadi "selesai" (status closed list Finance); urungkan mengembalikan ke "open" dan tugasnya muncul lagi',
    s1 === 'selesai' && cu.tugas.find((x) => x.id === 'a1').status.status === 'open' && (await p.waitForSelector('[data-selesai="a1"]', { timeout: 4000 }).then(() => true, () => false)), s1);
});

await bagian('C. surel mitra', async () => {
  await p.click('[data-buka="#surel/u1"]');
  await p.waitForSelector('.bub.dr');
  const dr = await p.$eval('.bub.dr', (x) => x.innerText);
  c('C1 draft tampil tanpa kutipan surel lama, pesan mitra lengkap tampil di atasnya', /hadir Selasa pukul 08.30/.test(dr) && !/RAHASIA-KUTIPAN-LAMA/.test(dr) && /Seibu GI pukul 08.30/.test(await p.$eval('.bub', (x) => x.innerText)), dr);
  await p.fill('#catRevisi', 'jangan sebut jam, tanya SIK dulu'); await p.click('[data-revisi="u1"]');
  await tunggu(() => /diteruskan/.test(document.getElementById('toastTeks').innerText));
  c('C2 minta revisi masuk antrean dengan catatannya, layar berubah jadi "sedang direvisi"', db.st.antrean.length === 1 && db.st.antrean[0].jenis === 'revisi' && /tanya SIK/.test(db.st.antrean[0].catatan) && /sedang direvisi/.test(await p.innerText('#app')), JSON.stringify(db.st.antrean));
  db.st.antrean.length = 0;
  await p.evaluate(() => { window.__ops.S.surel.utas[0].status = 'draft'; window.__ops.gambar(); });
  await p.click('[data-kirim="u1"]');
  await tunggu(() => /satu menit/.test(document.getElementById('toastTeks').innerText));
  c('C3 kirim (sesudah konfirmasi) masuk antrean kirim untuk draft d1 utas u1', db.st.antrean.length === 1 && db.st.antrean[0].jenis === 'kirim' && db.st.antrean[0].draft === 'd1', JSON.stringify(db.st.antrean));
});

await bagian('D. tugas', async () => {
  await p.click('.nav [data-buka="#tugas"]'); await p.waitForSelector('[data-tambah]');
  await p.click('[data-tambah]'); await p.waitForSelector('#judulBaru');
  await p.fill('#judulBaru', 'Foto ulang 10 SKU untuk ruparupa');
  await p.click('[data-opsi="untuk|3"]'); await p.click('[data-opsi="untuk|1"]');
  await p.click('[data-opsi="daftar|L1"]');
  await p.click('[data-opsi^="tenggat|2026-10-23"]'); await p.click('[data-opsi="prioritas|penting"]');
  await p.click('[data-simpanbaru]');
  await tunggu(() => /Masuk ke ClickUp/.test(document.getElementById('toastTeks').innerText));
  const post = cu.panggil.find((x) => x[0] === 'POST' && x[1] === '/list/L1/task' && /Foto ulang/.test(x[2].name));
  c('D1 tugas baru: judul dari kotak, untuk Rina saja (Aku dilepas), list Konten, tenggat Jumat 23 Okt, prioritas penting',
    post && post[2].name === 'Foto ulang 10 SKU untuk ruparupa' && post[2].assignees.join() === '3' && post[2].due_date === T.W('2026-10-23T17:00:00') && post[2].priority === 2, JSON.stringify(post));
  await p.click('[data-buka="#tugas/a1"]'); await p.waitForSelector('[data-status]');
  const st = await teks('[data-status]');
  await p.click('[data-langkah^="C1|i2|"]');
  await p.fill('#catProgres', 'MAA belum kirim rekap, pakai SO dulu'); await p.click('[data-komentar="a1"]');
  await tunggu(() => /Catatan tersimpan/.test(document.getElementById('toastTeks').innerText));
  await p.waitForSelector('.tl');
  c('D2 detail: tombol status sesuai list Finance (open, selesai), centang langkah sampai ke ClickUp, catatan progres tersimpan dan tampil',
    st.join().toLowerCase() === 'open,selesai' && cu.tugas.find((x) => x.id === 'a1').checklists[0].items[1].resolved === true && /pakai SO dulu/.test(await p.innerText('.tl')), st.join());
});

await bagian('D2. susulan', async () => {
  await p.click('.nav [data-buka="#beranda"]'); await p.waitForSelector('.sum');
  const sec = await p.$$eval('.sec', (a) => a.map((s) => { const out = []; let n = s.nextElementSibling; while (n && !n.classList.contains('sec')) { out.push(n.innerText.replace(/\s+/g, ' ')); n = n.nextElementSibling; } return s.innerText + ' => ' + out.join(' ## '); }));
  const hari = sec.find((x) => /^HARI INI/i.test(x)) || '';
  await p.click('[data-buka="#surel/u4"]'); await p.waitForSelector('[data-kirim="u4"]');
  const isi = await p.innerText('#app');
  db.st.antrean.length = 0;
  await p.click('[data-kirim="u4"]');
  await tunggu(() => /satu menit/.test(document.getElementById('toastTeks').innerText));
  c('D3 susulan 3 hari kerja tampil di Hari ini sebagai "Kirim susulan ke TGI", layar surel menyebut surel terakhir dari kamu dan draftnya, Kirim masuk antrean',
    /Kirim susulan ke TGI/.test(hari) && /3 hari kerja/.test(hari) && /Surel terakhir dari kamu/.test(isi) && /Menindaklanjuti email kami/.test(isi) && db.st.antrean.some((x) => x.jenis === 'kirim' && x.draft === 'ds'), JSON.stringify({ hari, isi: isi.slice(0, 300) }));
});

await bagian('E. layar HP', async () => {
  const lebar = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.click('.nav [data-buka="#beranda"]'); await p.waitForSelector('.sum');
  const lebar2 = await p.evaluate(() => document.documentElement.scrollWidth);
  c('E1 tidak ada galat halaman dan tidak ada geser ke samping di lebar 390', errs.length === 0 && lebar <= 390 && lebar2 <= 390, JSON.stringify({ errs, lebar, lebar2 }));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/ops-beranda.png' });
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
