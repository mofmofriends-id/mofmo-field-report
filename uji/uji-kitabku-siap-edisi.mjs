/* Uji panel "Siap edisi" di Kitabku WMS, 18 Okt 2026.
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy menyetujui mockup panel yang mengecek kesiapan edisi 11.11 sebelum
 * mulai. Hari ini (data live) semua 12 hadiah mati, tidak ada satu kode voucher pun, tingkat papan
 * belum dibuat, dan kartu paket baru 1 dari 50. Semua itu dulu harus diingat sendiri. Yang mahal
 * kalau salah, dan diam:
 *  - panel bilang siap padahal hadiah yang menyala tidak punya kode voucher (pembeli klaim, kosong);
 *  - kartu uji (TES/UJI) ikut dihitung sehingga 50 kartu terbaca cukup;
 *  - voucher hadiah habis masa berlakunya sebelum edisi selesai;
 *  - kuota tingkat papan tidak sama dengan jumlah peringkatnya;
 *  - panel mati karena server lama belum mengirim hitungan kartu paket.
 * Lembar dibuka di Chromium dengan app.css asli; Edge Function dijawab inti.js yang sama dengan yang
 * dipasang, basis data tiruan, jam peramban dibekukan.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 10;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 600))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

const RAHASIA = 'rahasia-uji-siap-edisi-0123456789abcdef012345', SIDIK = 'sidik-uji-siap-edisi-abcdefghij';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());

/* fixture seperti live 18 Okt: papanTotal lama, dua hadiah sudah bernominal tanpa voucher, satu tanpa nominal;
   satu kartu paket asli, satu kartu uji */
const H = (o) => Object.assign({ judul: '', saluran: 'online', hadiah: 'Voucher Shopee', min_belanja: '', voucher: null, terpakai: 0, aktif: false, peringkat_dari: 1, berlaku_sampai: null }, o);
function buatDb() {
  const db = dbPalsu();
  db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
  db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
  db.st.hadiah = [
    H({ id: 'papanTotal', jenis: 'papan', angka: 10, kuota: 10, nominal: '', saluran: 'semua' }),
    H({ id: 'patok5', jenis: 'kartu', angka: 5, kuota: 12, nominal: 'Rp10.000', berlaku_sampai: '2026-11-30' }),
    H({ id: 'bab1', jenis: 'bab', angka: 0, kuota: 1, nominal: 'Rp15.000', berlaku_sampai: '2026-11-30' }),
    H({ id: 'patok3', jenis: 'kartu', angka: 3, kuota: 0, nominal: '', saluran: 'semua' })
  ];
  db.st.kode.PKTAAAAAA2 = { kode: 'PKTAAAAAA2', jenis: 'paket', pesanan: 'PSN001', pemain: null, acara: 'a1', saluran: 'shopee', voucher: 'SHOPEE11' };
  db.st.kode.TESAAAAAA2 = { kode: 'TESAAAAAA2', jenis: 'paket', pesanan: null, pemain: null, acara: 'a1', saluran: 'shopee', voucher: 'TESUJI' };
  return db;
}
let db = buatDb(), tanpaPaket = false;
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
const errs = [];
async function halaman(kini, lebar) {
  const ctx = await b.newContext({ viewport: { width: lebar || 1280, height: 900 } });
  await ctx.route('**/functions/v1/kitab', async (route) => {
    const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, Date.now(), { ip: '1.1.1.1' });
    if (tanpaPaket && h) delete h.paket;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.clock.setFixedTime(new Date(kini));
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(700);
  return { p, ctx };
}
const baca = (p) => p.evaluate(() => {
  const x = document.querySelector('#kbSiap'); if (!x) return null;
  const item = {}; x.querySelectorAll('[data-siap]').forEach((li) => { item[li.dataset.siap] = { s: li.dataset.status, t: li.innerText.replace(/\s+/g, ' ') }; });
  return { teks: x.innerText.replace(/\s+/g, ' '), item };
});

await bagian('A. keadaan seperti live 18 Okt', async () => {
  const { p, ctx } = await halaman('2026-10-18T10:00:00+07:00');
  const r = await baca(p);
  c('A1 panel ada di atas, menyebut edisi dan 14 hari lagi', r && /Siap edisi 11\.11/.test(r.teks) && /14 hari lagi/.test(r.teks), r && r.teks.slice(0, 300));
  const s = r ? Object.fromEntries(Object.entries(r.item).map(([k, v]) => [k, v.s])) : {};
  c('A2 status: tanggal ok, tingkat merah, voucher merah, nyala merah, kuota ok, berlaku ok, kartu merah, uji merah',
    JSON.stringify(s) === JSON.stringify({ tanggal: 'ok', tingkat: 'w', voucher: 'w', nyala: 'w', kuota: 'ok', berlaku: 'ok', kartu: 'w', uji: 'w' }), JSON.stringify(s));
  const v = r && r.item.voucher ? r.item.voucher.t : '', k = r && r.item.kartu ? r.item.kartu.t : '';
  c('A3 voucher menyebut patok5 dan bab1 (bernominal), bukan patok3; kartu "1 dari 50" (kartu uji tidak dihitung)', /patok5/.test(v) && /bab1/.test(v) && !/patok3/.test(v) && /1 dari 50/.test(k), v + ' || ' + k);
  c('A4 skor "3 dari 8 siap"', !!r && /3 dari 8 siap/.test(r.teks), r && r.teks.slice(0, 200));
  await p.click('#kbSiap [data-siap=tingkat] [data-kb=tingkat3]'); await p.waitForTimeout(1500);
  const r2 = await baca(p);
  c('A5 tombol di panel memasang tingkat; tingkat jadi ok, kuota tetap ok (1, 2, 7)', r2 && r2.item.tingkat.s === 'ok' && r2.item.kuota.s === 'ok' && db.st.hadiah.some((h) => h.id === 'juara410'), JSON.stringify(r2 && r2.item));
  await p.click('#kbSiap [data-siap=kartu] [data-kbtab=cetak]'); await p.waitForTimeout(500);
  const tab = await p.evaluate(() => { const x = document.querySelector('.tab-alat .on'); return x ? x.dataset.kbtab : ''; });
  c('A6 tombol Cetak kartu membuka tab Cetak kartu QR', tab === 'cetak', tab);
  await ctx.close();
});

await bagian('B. hadiah menyala tapi belum beres', async () => {
  db = buatDb();
  Object.assign(db.st.hadiah[1], { voucher: 'MOFMO5', aktif: true, berlaku_sampai: '2026-11-10' });
  db.st.hadiah.push(H({ id: 'juara1', jenis: 'papan', peringkat_dari: 1, angka: 1, kuota: 1, nominal: '', saluran: 'semua', aktif: true, berlaku_sampai: '2026-12-15' }));
  db.st.hadiah.push(H({ id: 'juara23', jenis: 'papan', peringkat_dari: 2, angka: 3, kuota: 1, nominal: 'Rp50.000', voucher: 'JUARA23', saluran: 'semua', berlaku_sampai: '2026-12-15' }));
  const { p, ctx } = await halaman('2026-10-25T10:00:00+07:00');
  const r = await baca(p);
  const it = r ? r.item : {};
  c('B1 hadiah papan yang MENYALA tanpa nominal dan tanpa voucher ikut disebut (juara1), patok5 yang sudah berkode tidak',
    it.voucher && it.voucher.s === 'w' && /juara1/.test(it.voucher.t) && !/patok5/.test(it.voucher.t), JSON.stringify(it.voucher));
  c('B2 kuota juara23 (1, padahal #2-3 ada 2 peringkat) merah; masa berlaku patok5 (10 Nov, sebelum edisi selesai 15 Nov) kuning',
    it.kuota && it.kuota.s === 'w' && /juara23/.test(it.kuota.t) && it.berlaku && it.berlaku.s === 'c' && /patok5/.test(it.berlaku.t) && !/juara1/.test(it.berlaku.t), JSON.stringify([it.kuota, it.berlaku]));
  await ctx.close();
});

await bagian('C. server lama, HP, dan sesudah edisi', async () => {
  db = buatDb(); tanpaPaket = true;
  const { p, ctx } = await halaman('2026-10-18T10:00:00+07:00', 390);
  const r = await baca(p);
  const luber = await p.evaluate(() => { const x = document.querySelector('#kbSiap'); return x ? x.scrollWidth > x.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1 : true; });
  c('C1 server tanpa hitungan kartu: baris kartu dan uji tidak ada, skor dari 6, HP 390 tanpa geser samping', r && !r.item.kartu && !r.item.uji && /dari 6 siap/.test(r.teks) && !luber, JSON.stringify(r && Object.keys(r.item)) + ' luber=' + luber);
  await ctx.close(); tanpaPaket = false;
  const s2 = await halaman('2026-11-16T10:00:00+07:00');
  const r2 = await baca(s2.p);
  c('C2 sesudah edisi selesai panel tidak tampil; tanpa galat JavaScript', r2 === null && errs.length === 0, JSON.stringify(r2 && r2.teks) + ' | ' + errs.join(' | '));
  await s2.ctx.close();
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
