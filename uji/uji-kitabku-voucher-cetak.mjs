/* Uji kolom Dicetak dan Terpasang per kode voucher di tabel rekonsiliasi voucher, tab Ringkas Kitabku WMS (19 Okt 2026).
 * Harapan: "4 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy (19 Okt) minta bisa memantau berapa kartu QR yang sudah dicetak per voucher. Dulu tabel
 * cuma memuat voucher yang sudah dibagikan, jadi SHP11111 (sudah dicetak, belum discan) tidak muncul sama sekali.
 * Yang mahal kalau salah: voucher yang baru dicetak tetap tidak kelihatan; voucher hadiah (tanpa kartu) terbaca
 * "dicetak 0" lalu dikira ada yang salah; total dicetak di kaki tabel tidak cocok dengan barisnya.
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

let gagal = 0, jalan = 0; const DIHARAPKAN = 4;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).replace(/\s*\n\s*/g, ' | ').slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* ---------- fixture: SHP11111 dicetak 3 kartu (1 terpasang ke pesanan, belum ada yang dibuka); hadiah k3v (voucher MOFUJI15) diklaim Rina ---------- */
const RAHASIA = 'rahasia-uji-voucher-cetak-wms-0123456789abcdef', SIDIK = 'sidik-uji-voucher-cetak-wms-ab';
const KINI = Date.parse('2026-10-25T10:00:00+07:00');
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = KINI + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15' };
db.st.pemain.push({ id: 'pRina', nama: 'Rina', sidik: 'x2' });
const kode = (k, o) => { db.st.kode[k] = Object.assign({ kode: k, kartu: null, jenis: 'paket', pesanan: null, pemain: null, acara: 'a1', saluran: 'shopee', voucher: null, voucher_teks: '' }, o); };
kode('PVR7DVJUPE', { voucher: 'SHP11111', pesanan: 'UJI19OKTPVR7' }); kode('QQQQQQQQQ2', { voucher: 'SHP11111' }); kode('RRRRRRRRR3', { voucher: 'SHP11111' });
db.st.hadiah = [{ id: 'k3v', judul: '', jenis: 'kartu', angka: 3, saluran: 'semua', hadiah: 'Voucher', nominal: 'Rp15.000', min_belanja: '', voucher: 'MOFUJI15', kuota: 10, terpakai: 1, aktif: true, acara: null }];
db.st.klaim.push({ pemain: 'pRina', hadiah: 'k3v' });
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
  const h = await tangani(JSON.parse(route.request().postData() || 'null'), db, KINI, { ip: '1.1.1.1' });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const baris = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#kbFunnel tr[data-voucher]')].map((x) => {
  const k = (n) => { const y = x.querySelector('[data-k=' + n + ']'); return y ? y.textContent.trim() : null; };
  return [x.getAttribute('data-voucher'), { dicetak: k('dicetak'), terpasang: k('terpasang'), dibagi: k('dibagi') }];
})));

await bagian('A. tabel voucher', async () => {
  await p.goto('http://localhost:' + srv.address().port + '/uji.html');
  await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(900);
  const V = await baris(), s = V.SHP11111 || {};
  c('A1 SHP11111 muncul walau belum ada yang scan: dicetak 3, terpasang 1, dibagikan 0', s.dicetak === '3' && s.terpasang === '1' && s.dibagi === '0', JSON.stringify(V));
  const h = V.MOFUJI15 || {};
  c('A2 voucher hadiah MOFUJI15: kolom dicetak bertuliskan Hadiah (bukan 0), dibagikan 1', /hadiah/i.test(h.dicetak || '') && h.dibagi === '1', JSON.stringify(h));
  const kaki = await p.evaluate(() => { const k = (n) => { const y = document.querySelector('#kbFunnel tfoot [data-k=' + n + ']'); return y ? y.textContent.trim() : null; }; return { dicetak: k('totCetak'), terpasang: k('totPasang') }; });
  c('A3 kaki tabel: total dicetak 3 dan terpasang 1', kaki.dicetak === '3' && kaki.terpasang === '1', JSON.stringify(kaki));
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/734637d7-4ef4-5392-8862-4843ea5b65c8/scratchpad/wms-voucher-cetak.png', fullPage: true });
  c('A4 tanpa galat JavaScript', errs.length === 0, errs.join(' | '));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
