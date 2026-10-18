/* Uji peringatan kuota hadiah Papan Total dan batas peringkat 100 di Kitabku WMS, 18 Okt 2026 pagi.
 * Harapan: "DIHARAPKAN pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy memilih: WMS mengingatkan kalau kuota tingkat papan tidak sama dengan
 * jumlah peringkat di rentangnya, dan hadiah papan boleh sampai peringkat 100 (rentangnya dia pilih).
 * Yang mahal kalau salah, dan diam: tingkat #2-3 dengan kuota 1 membuat juara 3 melihat "kuota habis"
 * padahal dia berhak; peringatan yang baru muncul sesudah disimpan (admin sudah pindah halaman);
 * atau WMS masih memberi kesan hadiah cuma sampai 43.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 6;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: tingkat #2-3 dengan kuota salah (1) dan tingkat #1 yang benar ---------- */
const RAHASIA = 'rahasia-uji-kuota-papan-0123456789abcdef0123', SIDIK = 'sidik-uji-kuota-papan-abcdefgh';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Date.now() + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-06', selesai: '2026-11-14' };
const papan = (id, dari, sampai, kuota) => ({ id, judul: '', jenis: 'papan', peringkat_dari: dari, angka: sampai, saluran: 'semua', hadiah: 'Voucher Shopee', nominal: 'Rp10.000', min_belanja: '', voucher: null, kuota, terpakai: 0, aktif: true });
db.st.hadiah = [papan('juara1', 1, 1, 1), papan('juara23', 2, 3, 1)];
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

const cek = (k) => p.evaluate((k) => { const x = document.querySelector('[data-hadiah="' + k + '"] .kb-kuota-cek'); /* kotak merah kosong yang tetap terlihat juga dihitung gagal */ return x && x.offsetParent !== null ? (x.textContent || '(kotak peringatan kosong terlihat)') : ''; }, k);

await bagian('K. peringatan kuota', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html'); await buka();
  const w = await cek('juara23');
  c('K1 tingkat #2-3 berkuota 1 diperingatkan: rentangnya 2 peringkat', /2 peringkat/.test(w) && /kuota/i.test(w), w || '(tidak ada peringatan)');
  c('K2 tingkat #1 berkuota 1 tidak diperingatkan', (await cek('juara1')) === '', await cek('juara1'));
  await p.click('.kb-det:has([data-hadiah=baru]) summary');
  await p.fill(B + '[data-f=id]', 'juara21');
  await p.selectOption(B + '[data-f=jenis]', 'papan'); await p.waitForTimeout(150);
  await p.fill(B + '[data-f=peringkat_dari]', '21'); await p.fill(B + '[data-f=angka]', '100'); await p.fill(B + '[data-f=kuota]', '10');
  const w1 = await cek('baru');
  await p.fill(B + '[data-f=kuota]', '80');
  const w2 = await cek('baru');
  c('K3 peringatan ikut berubah saat mengetik (21 sampai 100 = 80 peringkat), hilang saat kuota 80', /80 peringkat/.test(w1) && w2 === '', JSON.stringify([w1, w2]));
});

await bagian('S. sampai peringkat 100', async () => {
  const ket = await p.evaluate(() => document.querySelector('[data-hadiah=baru]').textContent);
  c('S1 keterangan form menyebut hadiah papan boleh sampai peringkat 100', /100/.test(ket), ket.slice(-400));
  await p.fill(B + '[data-f=hadiah]', 'Voucher Shopee');
  await p.click(B + '[data-kb=hadiah]'); await p.waitForTimeout(700);
  const h = db.st.hadiah.find((x) => x.id === 'juara21');
  c('S2 tingkat #21-100 berkuota 80 tersimpan', h && h.peringkat_dari === 21 && h.angka === 100 && h.kuota === 80, JSON.stringify(h) + ' ' + (await p.evaluate(() => { const x = document.querySelector('.tolak-alat'); return x ? x.textContent : ''; })));
  c('S3 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-kuota-papan.png', fullPage: true });
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
