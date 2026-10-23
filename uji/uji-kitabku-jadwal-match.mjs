/* Uji tab Jadwal game di WMS Kitabku: ubah tanggal edisi dan jadwal match (22 Okt 2026).
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy: "Gua yg atur sendiri di wms tanggal edisi game 11.11 serta rotasi masing-masing game
 * dan durasinya". Dulu satu-satunya tombol tanggal di WMS membuat edisi BARU (papan reset, QR kartu edisi berganti),
 * dan jadwal match belum ada. Yang mahal kalau salah: tombol ubah tanggal ternyata membuat edisi baru; isi otomatis
 * menghasilkan match bentrok atau di luar tanggal; jadwal tersimpan sebagian; jam tutup lewat tengah malam tersimpan
 * di hari yang salah; pesan bentrok dari server tidak sampai ke layar. Web dan server sungguhan (inti.js + tiruan).
 */
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const SRV = process.env.KITAB_SERVER || '/home/claude/wms-supabase';
const { tangani } = await import(SRV + '/kitab/inti.js');
const { dbPalsu } = await import(SRV + '/kitab-tiruan.mjs');
const require = createRequire('/home/claude/fieldreport/uji/uji-wms-alat.js');
const { chromium } = require('playwright');

let gagal = 0, jalan = 0; const DIHARAPKAN = 16;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 600))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: edisi 11.11 aktif 1-15 Nov, belum ada jadwal; jam server 25 Okt ---------- */
const RAHASIA = 'rahasia-uji-jadwal-wms-0123456789abcdef0123', SIDIK = 'sidik-uji-jadwal-wms-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const KINI = Date.parse('2026-10-25T10:00:00+07:00');
const exp = KINI + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'acara-uji-1111', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/uji.html') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end('<!doctype html><html lang="id" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/wms/app.css"></head><body><script>window.__wms = { S: { tiket: ' + JSON.stringify(TIKET) + ' }, bhs: function () { return "id"; }, Suara: {} };</script><script src="/wms/kitabku.js"></script></body></html>'); }
  const f = path.join(AKAR, u);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 860 } });
await ctx.route('**/functions/v1/kitab', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const teks = () => p.evaluate(() => (document.getElementById('kbIsi') || {}).innerText || '');
const baris = () => p.evaluate(() => [...document.querySelectorAll('#kbJdTabel tbody tr')].map((tr) => [tr.querySelector('select').value, ...[...tr.querySelectorAll('input')].map((i) => i.value)].join(' ')));
const isiNilai = (sel, v) => p.evaluate(([s, x]) => { const i = document.querySelector(s); i.value = x; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
const SS = '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/mock-edisi/';

await bagian('A. tab Jadwal game dan ubah tanggal edisi', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(500);
  await p.click('[data-kbtab=jadwal]'); await p.waitForSelector('#kbJdMulai', { timeout: 10000 }); await p.waitForTimeout(300);
  const awal = [await p.$eval('#kbJdMulai', (x) => x.value), await p.$eval('#kbJdSelesai', (x) => x.value)];
  c('A1 tab Jadwal game: tanggal edisi aktif terisi, jadwal masih kosong', awal.join() === '2026-11-01,2026-11-15' && (await baris()).length === 0 && /belum ada match/i.test(await teks()), JSON.stringify(awal) + ' | ' + (await teks()).slice(0, 300));
  await isiNilai('#kbJdSelesai', '2026-11-12'); await p.click('[data-kb=jdTanggal]'); await p.waitForTimeout(500);
  c('A2 Simpan tanggal: edisi yang sama (id tetap) berubah tanggal selesainya, tanpa edisi baru', db.st.acara.id === 'acara-uji-1111' && db.st.acara.selesai === '2026-11-12' && /tersimpan/i.test(await teks()), JSON.stringify(db.st.acara) + ' | ' + (await teks()).slice(0, 200));
});

await bagian('B. isi otomatis lalu simpan', async () => {
  await p.evaluate(() => { document.getElementById('kbJdOto').open = true; }); await p.waitForTimeout(150);
  await p.selectOption('#kbJdUrut1', 'mem'); await p.selectOption('#kbJdUrut2', 'triv'); await p.selectOption('#kbJdUrut3', 'adv');
  await isiNilai('#kbJdHari', '4'); await isiNilai('#kbJdN', '3'); await isiNilai('#kbJdJam1', '19:00'); await isiNilai('#kbJdJam2', '23:00');
  await p.click('[data-kb=jdOto]'); await p.waitForTimeout(300);
  const r = await baris();
  const harap = ['mem 2026-11-01 19:00 2026-11-01 23:00 5', 'mem 2026-11-03 19:00 2026-11-03 23:00 5', 'mem 2026-11-04 19:00 2026-11-04 23:00 5', 'triv 2026-11-05 19:00 2026-11-05 23:00 5', 'triv 2026-11-07 19:00 2026-11-07 23:00 5', 'triv 2026-11-08 19:00 2026-11-08 23:00 5', 'adv 2026-11-09 19:00 2026-11-09 23:00 5', 'adv 2026-11-11 19:00 2026-11-11 23:00 5', 'adv 2026-11-12 19:00 2026-11-12 23:00 5'];
  c('B1 isi otomatis (Match, Quiz, Adventure; 4 hari, 3 match, 19.00-23.00): 9 match tersebar di blok tiap game, belum tersimpan', JSON.stringify(r) === JSON.stringify(harap) && !(db.st.match['acara-uji-1111'] || []).length && /belum disimpan/i.test(await teks()), JSON.stringify(r));
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const s = (db.st.match['acara-uji-1111'] || []).map((x) => x.game + ' ' + x.mulai + ' ' + x.selesai);
  c('B2 Simpan jadwal: 9 match tersimpan di server dengan jam WIB yang benar', s.length === 9 && s[0] === 'mem 2026-11-01T12:00:00.000Z 2026-11-01T16:00:00.000Z' && s[8] === 'adv 2026-11-12T12:00:00.000Z 2026-11-12T16:00:00.000Z' && /tersimpan/i.test(await teks()), JSON.stringify(s));
  await p.screenshot({ path: SS + 'wms-jadwal-match.png', fullPage: true });
});

await bagian('C. ubah, bentrok, tengah malam', async () => {
  await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[type=date]', '2026-11-01'); await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[data-jd=mulai]', '20:00');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const t = await teks();
  c('C1 match dibuat bentrok: pesan server tampil (menyebut bentrok dan Memory Match), jadwal server tetap 9 match lama', /bentrok/i.test(t) && /Memory Match/.test(t) && db.st.match['acara-uji-1111'].length === 9 && db.st.match['acara-uji-1111'][1].mulai === '2026-11-03T12:00:00.000Z', t.slice(0, 400));
  await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[type=date]', '2026-11-03'); await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[data-jd=mulai]', '19:00');
  await p.click('[data-kb=jdTambah]'); await p.waitForTimeout(150);
  const n = (await baris()).length;
  await isiNilai('#kbJdTabel tbody tr:last-child select', 'triv'); await isiNilai('#kbJdTabel tbody tr:last-child input[type=date]', '2026-11-10');
  await isiNilai('#kbJdTabel tbody tr:last-child input[data-jd=mulai]', '22:00'); await isiNilai('#kbJdTabel tbody tr:last-child input[data-jd=selesai]', '02:00');
  /* dibaca SEBELUM simpan: sesudah simpan tabel dimuat ulang terurut jam buka, jadi baris terakhir bukan baris ini lagi */
  const tutupTerisi = await p.$eval('#kbJdTabel tbody tr:last-child input[data-jd=tglTutup]', (x) => x.value).catch(() => '');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const ada = db.st.match['acara-uji-1111'].find((x) => x.mulai === '2026-11-10T15:00:00.000Z');
  c('C2 Tambah match: 22.00 sampai 02.00 tersimpan sebagai lewat tengah malam (tutup 11 Nov 02.00), tanggal selesai di tabel otomatis 11 Nov', tutupTerisi === '2026-11-11' && n === 10 && db.st.match['acara-uji-1111'].length === 10 && ada && ada.game === 'triv' && ada.selesai === '2026-11-10T19:00:00.000Z', JSON.stringify([n, ada, (await teks()).slice(0, 200)]));
  await p.click('#kbJdTabel tbody tr:nth-child(3) [data-kb=jdHapus]'); await p.waitForTimeout(150); await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  c('C3 Hapus satu match lalu simpan: tinggal 9, match 4 Nov hilang', db.st.match['acara-uji-1111'].length === 9 && !db.st.match['acara-uji-1111'].some((x) => x.mulai === '2026-11-04T12:00:00.000Z'), JSON.stringify(db.st.match['acara-uji-1111'].map((x) => x.mulai)));
  /* 22 Okt sore, Ferdy (tangkapan layar "Adventure: 1 match, 7 Nov 2026 to 7 Nov 2026" untuk match 7 Nov 18.00 sampai
     8 Nov 05.00): "soalnya notes dibwh nulisnya". Ringkasan harus menyebut jam buka match pertama dan jam TUTUP match
     terakhir, termasuk tanggal besoknya kalau lewat tengah malam. */
  const rk = await p.evaluate(() => [...document.querySelectorAll('.kb-jd-ringkas li')].map((li) => li.textContent));
  c('D1 ringkasan di bawah tabel: Animal Quiz 4 match, 5 Nov 2026 19.00 sampai 11 Nov 2026 02.00 (tutup lewat tengah malam ikut tanggal besoknya)', rk.some((x) => x === 'Animal Quiz: 4 match, 5 Nov 2026 19.00 sampai 11 Nov 2026 02.00'), JSON.stringify(rk));
  /* 22 Okt sore, Ferdy: "tambahin dong date start date end biar lebih enak". Tanggal selesai jadi kolom sendiri, bukan
     ditebak dari jam tutup yang lebih kecil dari jam buka. Ganti tanggal mulai menggeser tanggal selesai sejauh yang sama. */
  const th = await p.evaluate(() => [...document.querySelectorAll('#kbJdTabel thead th')].map((x) => x.textContent.trim()));
  c('E1 kolom tabel: Game, Tanggal mulai, Buka, Tanggal selesai, Tutup', JSON.stringify(th.slice(1, 6)) === JSON.stringify(['Game', 'Tanggal mulai', 'Buka', 'Tanggal selesai', 'Tutup']), JSON.stringify(th));
  await isiNilai('#kbJdTabel tbody tr:nth-child(1) input[data-jd=tgl]', '2026-11-02');
  const geser = await p.$eval('#kbJdTabel tbody tr:nth-child(1) input[data-jd=tglTutup]', (x) => x.value).catch(() => '');
  c('E2 tanggal mulai match 1 diganti 1 Nov jadi 2 Nov: tanggal selesainya ikut jadi 2 Nov', geser === '2026-11-02', geser);
  await isiNilai('#kbJdTabel tbody tr:nth-child(1) input[data-jd=tglTutup]', '2026-11-03'); await isiNilai('#kbJdTabel tbody tr:nth-child(1) input[data-jd=selesai]', '01:00');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const m1 = db.st.match['acara-uji-1111'].find((x) => x.mulai === '2026-11-02T12:00:00.000Z');
  c('E3 tanggal selesai diisi sendiri (2 Nov 19.00 sampai 3 Nov 01.00): tersimpan tepat di server', m1 && m1.game === 'mem' && m1.selesai === '2026-11-02T18:00:00.000Z', JSON.stringify(m1) + ' | ' + (await teks()).slice(0, 300));
  /* Tanggal selesai yang diisi orang dipakai apa adanya. Kalau dibuat sama dengan tanggal mulai padahal jam tutupnya lebih
     awal, server menolak; layar tidak diam-diam menggesernya ke besok (itu menyimpan sesuatu yang tidak diketik). */
  await isiNilai('#kbJdTabel tbody tr:nth-child(1) input[data-jd=tglTutup]', '2026-11-02');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const m1b = db.st.match['acara-uji-1111'].find((x) => x.mulai === '2026-11-02T12:00:00.000Z');
  c('E4 tanggal selesai dibuat 2 Nov (01.00 sebelum 19.00): ditolak dengan pesan, jadwal server tetap 3 Nov 01.00', m1b && m1b.selesai === '2026-11-02T18:00:00.000Z' && !/match tersimpan/i.test(await teks()), JSON.stringify(m1b) + ' | ' + (await teks()).slice(0, 300));
  /* 22 Okt sore, Ferdy: "bisa ga diatur dari kita untuk batasan entry masing2 games per match?", per baris match,
     1 sampai 5. Kolom Batas entry; isi otomatis dan Tambah match memakai 5. */
  const th2 = await p.evaluate(() => [...document.querySelectorAll('#kbJdTabel thead th')].map((x) => x.textContent.trim()));
  const nilaiEntry = await p.evaluate(() => [...document.querySelectorAll('#kbJdTabel input[data-jd=jatah]')].map((x) => x.value));
  c('F1 kolom Batas entry sesudah Tutup, tiap baris dari server membawa angkanya (bawaan 5)', th2[6] === 'Batas entry' && nilaiEntry.length >= 9 && nilaiEntry.every((v) => v === '5'), JSON.stringify([th2, nilaiEntry]));
  /* E4 meninggalkan baris 1 yang ditolak server (tanggal selesai 2 Nov); dikembalikan dulu supaya simpan berikut sah */
  await isiNilai('#kbJdTabel tbody tr:nth-child(1) input[data-jd=tglTutup]', '2026-11-03');
  await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[data-jd=jatah]', '3');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const m2 = db.st.match['acara-uji-1111'].filter((x) => x.game === 'mem').map((x) => x.jatah);
  c('F2 batas entry match ke-2 diganti 3 lalu simpan: tersimpan di server (match lain tetap 5)', JSON.stringify(m2) === JSON.stringify([5, 3]) || JSON.stringify(m2.slice(0, 2)) === JSON.stringify([5, 3]), JSON.stringify(db.st.match['acara-uji-1111'].map((x) => x.game + '=' + x.jatah)));
  await isiNilai('#kbJdTabel tbody tr:nth-child(2) input[data-jd=jatah]', '7');
  await p.click('[data-kb=jdSimpan]'); await p.waitForTimeout(500);
  const t7 = await teks();
  c('F3 batas entry 7: ditolak dengan pesan "1 sampai 5", server tetap 3', /1 sampai 5/.test(t7) && db.st.match['acara-uji-1111'].filter((x) => x.game === 'mem')[1].jatah === 3, t7.slice(0, 400));
  c('C4 HP 390 tanpa geser samping halaman dan tanpa galat JavaScript', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) && errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
