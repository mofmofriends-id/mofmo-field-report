/* Uji tombol "Tambah 3 tingkat papan" di Kitabku WMS, 18 Okt 2026.
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Tombol "Pasang hadiah dari mockup" cuma muncul kalau daftar hadiah kosong,
 * padahal production sudah punya 12 hadiah, jadi tingkat papan baru (#1, #2-3, #4-10) tidak pernah
 * bisa dipasang sekali klik. Ferdy setuju mockup tombol baru (18 Okt). Yang mahal kalau salah:
 * tingkat dipasang langsung NYALA dengan voucher kosong; kuota tidak sesuai rentang; hadiah papan
 * lama (papanTotal) ikut diubah; atau hadiah yang kebetulan sudah ber-ID juara1 tertimpa (voucher
 * dan nominal yang sudah diisi hilang tanpa jejak).
 * Lembar dibuka di peramban sungguhan dengan app.css asli; Edge Function dijawab inti.js yang
 * sama dengan yang dipasang, basis data tiruan, tiket WMS buatan crypto node.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 7;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: papanTotal lama (mati) dan juara1 yang sudah diisi Ferdy ---------- */
const RAHASIA = 'rahasia-uji-tombol-tingkat-0123456789abcdef', SIDIK = 'sidik-uji-tombol-tingkat-abcdefg';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-14' };
db.st.hadiah = [
  { id: 'papanTotal', judul: '', jenis: 'papan', peringkat_dari: 1, angka: 10, saluran: 'semua', hadiah: 'Voucher Shopee', nominal: '', min_belanja: '', voucher: null, kuota: 10, terpakai: 0, aktif: false },
  { id: 'juara1', judul: '', jenis: 'papan', peringkat_dari: 1, angka: 1, saluran: 'semua', hadiah: 'Voucher Shopee', nominal: 'Rp100.000', min_belanja: '', voucher: 'SUDAHDIISI', kuota: 1, terpakai: 0, aktif: true }
];
const salinan = (id) => JSON.stringify(db.st.hadiah.find((x) => x.id === id));
const LAMA = { papanTotal: salinan('papanTotal'), juara1: salinan('juara1') };
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
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route('**/functions/v1/kitab', async (route) => {
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, Date.now(), { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const B = '[data-hadiah=baru] ';
const buka = async () => { await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(700); };
const judul = (id) => p.evaluate((id) => { const x = document.querySelector('[data-hadiah=' + id + '] .kb-hkepala b'); return x ? x.textContent : ''; }, id);
const peringatan = () => p.evaluate(() => { const x = document.querySelector('.kb-tumpang'); return x ? x.textContent : ''; });

const tombol = () => p.evaluate(() => { const x = document.querySelector('#kbHadiah [data-kb=tingkat3]'); return x && x.offsetParent !== null ? x.textContent : ''; });

await bagian('A. tombol tingkat di daftar hadiah yang sudah berisi', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html'); await buka();
  const t0 = await tombol();
  c('A1 tombol terlihat walau daftar hadiah tidak kosong, menyebut #1, #2-3, #4-10', /#1/.test(t0) && /#2-3/.test(t0) && /#4-10/.test(t0), t0 || '(tidak ada tombol)');
  await p.click('#kbHadiah [data-kb=tingkat3]'); await p.waitForTimeout(1200);
  const h = (id) => db.st.hadiah.find((x) => x.id === id) || {};
  const ok = (x, d, s, k) => x.jenis === 'papan' && x.peringkat_dari === d && x.angka === s && x.kuota === k && x.aktif === false && !x.voucher;
  c('A2 tingkat #2-3 dan #4-10 dipasang MATI, kuota 2 dan 7, voucher kosong', ok(h('juara23'), 2, 3, 2) && ok(h('juara410'), 4, 10, 7), JSON.stringify([h('juara23'), h('juara410')]));
  c('A3 juara1 yang sudah diisi tidak tertimpa (voucher, nominal, nyala tetap)', salinan('juara1') === LAMA.juara1, salinan('juara1'));
  c('A4 papanTotal lama tidak diubah', salinan('papanTotal') === LAMA.papanTotal, salinan('papanTotal'));
});

await bagian('B. sesudah dipasang', async () => {
  const j = await p.evaluate(() => ['juara23', 'juara410'].map((id) => { const x = document.querySelector('[data-hadiah=' + id + '] .kb-hkepala b'); return x ? x.textContent : '-'; }).join(' | '));
  c('B1 baris baru langsung tampil berjudul #2-3 dan #4-10', /#2-3$/.test(j.split(' | ')[0]) && /#4-10$/.test(j.split(' | ')[1]), j);
  c('B2 tombolnya hilang karena tingkat sudah ada', (await tombol()) === '', await tombol());
  c('B3 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-tombol-tingkat.png', fullPage: true });
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
