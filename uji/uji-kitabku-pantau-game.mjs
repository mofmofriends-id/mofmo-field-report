/* Uji Pantau game di tab Ringkas, Kitabku WMS (21 Okt 2026).
 * Harapan: "10 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy memilih "Pantau game di WMS": selama 11.11 tim harus bisa melihat tiap hari berapa game
 * ranked dimainkan per game (Animal Quiz, Memory Match, Adventure Dash), berapa pemain unik, berapa yang menghabiskan
 * jatah 10, siapa teratas, dan progres Misi Komunitas, tanpa membuka Supabase. Yang mahal kalau salah, dan diam:
 *  - angka per hari tertukar kolom (Match terbaca sebagai Dash) sehingga laporan ke principal salah;
 *  - hari tanpa main hilang dari tabel sehingga terlihat seperti edisi baru mulai;
 *  - tabel sembilan kolom membuat halaman bergeser ke samping di HP gudang;
 *  - server kitab lama (belum kenal aksi pantauGame) membuat seluruh Ringkas galat, padahal funnel dan hadiah
 *    tetap dibutuhkan.
 * Lembar dibuka di peramban sungguhan; Edge Function dijawab inti.js yang sama dengan yang akan dipasang.
 * Jam server dikunci ke 5 Nov 2026 15.00 WIB (hari ke-5 edisi) supaya tabelnya punya isi.
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

/* ---------- fixture ----------
   Edisi a1, 1 sampai 15 Nov. Empat pemain.
   3 Nov: Ana 3 Quiz, Budi 10 Quiz (jatah habis).  4 Nov: Ana 2 Dash jam 23.30 WIB, Cici 1 Match.  5 Nov 00.10: Ana 1 Dash.
   31 Okt (sebelum edisi): Dodo 4 Quiz, tidak boleh terhitung.  Misi Komunitas 12 dari 40.  Dodo main latihan.
   Skor Dash: Cici 520, Ana 410, Budi 200; skor edisi lain 999 tidak ikut. Quiz: Budi 230. Match: belum ada. */
const W = (tgl, jam) => Date.parse('2026-' + tgl + 'T' + jam + '+07:00');
const KINI = W('11-05', '15:00:00');
const RAHASIA = 'rahasia-uji-web-pantau-0123456789abcdef', SIDIK = 'sidik-uji-web-pantau';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = KINI + 3600e3, TIKET = exp + '.' + b64url(createHmac('sha256', RAHASIA).update('wms|' + exp + '|' + SIDIK).digest());
const db = dbPalsu();
db.st.akses = { rahasia: RAHASIA, sidik: SIDIK };
db.st.acara = { id: 'a1', nama: '11.11 Big Sale', cap: '11.11', mulai: '2026-11-01', selesai: '2026-11-15', target_komunitas: 40 };
['Ana', 'Budi', 'Cici', 'Dodo'].forEach((n, i) => db.st.pemain.push({ id: 'p' + i, nama: n, tag: '100' + i, sidik: 's' + i }));
const catat = (k, t, n) => { for (let i = 0; i < (n || 1); i++) db.st.catat.push({ k, t: t + i * 1000 }); };
catat('trivR|p0', W('11-03', '09:00:00'), 3); catat('trivR|p1', W('11-03', '10:00:00'), 10);
catat('dashR|p0', W('11-04', '23:30:00'), 2); catat('dashR|p0', W('11-05', '00:10:00'), 1);
catat('memR|p2', W('11-04', '12:00:00'), 1);
catat('trivR|p3', W('10-31', '12:00:00'), 4);
catat('kom|a1', W('11-03', '09:30:00'), 12); catat('demo|a1|p3', W('11-04', '08:00:00'), 2);
db.st.skor.push({ pemain: 'p0', game: 'adv', acara: 'a1', nilai: 410, detik: 30, bintang: 3 }, { pemain: 'p2', game: 'adv', acara: 'a1', nilai: 520, detik: 25, bintang: 3 },
  { pemain: 'p1', game: 'adv', acara: 'a1', nilai: 200, detik: 45, bintang: 1 }, { pemain: 'p1', game: 'triv', acara: 'a1', nilai: 230, detik: 40, bintang: 3 },
  { pemain: 'p3', game: 'adv', acara: 'lama', nilai: 999, detik: 20, bintang: 3 });

const AKAR = process.env.WMS_AKAR || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/uji.html') { s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return s.end('<!doctype html><html lang="id" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/wms/app.css"></head><body><script>window.__wms = { S: { tiket: ' + JSON.stringify(TIKET) + ' }, bhs: function () { return "id"; }, Suara: {} };</script><script src="/wms/hpp.js"></script><script src="/wms/lapshopee.js"></script><script src="/wms/kitabku.js"></script></body></html>'); }
  const f = path.join(AKAR, u);
  if (!f.startsWith(AKAR) || !fs.existsSync(f)) { s.writeHead(404); return s.end('x'); }
  s.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css' })[path.extname(f)] || 'application/octet-stream' }); s.end(fs.readFileSync(f));
});
await new Promise((ok) => srv.listen(0, ok));
const URL0 = 'http://localhost:' + srv.address().port + '/uji.html';
const b = await chromium.launch();
let mode = 'baru';   /* 'baru' | 'lama' (server tanpa aksi pantauGame) | 'kosong' (tanpa edisi aktif) */
const dbKosong = dbPalsu(); dbKosong.st.akses = db.st.akses; dbKosong.st.acara = null;
const errs = [];
async function halaman(lebar) {
  const ctx = await b.newContext({ viewport: { width: lebar, height: 900 } });
  await ctx.route('**/functions/v1/kitab', async (route) => {
    const m = JSON.parse(route.request().postData() || 'null');
    const h = mode === 'lama' && m.aksi === 'pantauGame' ? { ok: false, pesan: 'Aksi tidak dikenal.' } : await tangani(m, mode === 'kosong' ? dbKosong : db, KINI, { ip: '1.1.1.1' });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(h) });
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL0); await p.evaluate(() => WmsKitabku.buka('ringkas')); await p.waitForTimeout(1200);
  return { ctx, p };
}
const teks = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const baris = (p) => p.evaluate(() => [...document.querySelectorAll('#kbPantau tbody tr[data-tgl]')].map((tr) => ({
  tgl: tr.getAttribute('data-tgl'),
  triv: (tr.querySelector('[data-g=triv]') || {}).textContent || '', mem: (tr.querySelector('[data-g=mem]') || {}).textContent || '', adv: (tr.querySelector('[data-g=adv]') || {}).textContent || ''
})));
/* angka pertama di sel = jumlah game; "n pemain"; "n habis jatah" */
const sel = (s) => { s = teks(s); const m = s.match(/^(\d+)/), pm = s.match(/(\d+)\s*pemain/), hb = s.match(/(\d+)\s*habis/); return { main: m ? +m[1] : null, pemain: pm ? +pm[1] : 0, habis: hb ? +hb[1] : 0 }; };

let H;
await bagian('A. tabel per hari', async () => {
  H = await halaman(1280);
  const judul = await H.p.evaluate(() => { const x = document.querySelector('#kbPantau h3'); return x ? x.textContent : ''; });
  c('A1 bagian "Pantau game 11.11" tampil di Ringkas', /Pantau game 11\.11/.test(judul), judul || '(tidak ada #kbPantau)');
  const B = await baris(H.p);
  c('A2 satu baris per hari 1 sampai 5 Nov, hari terbaru paling atas, hari tanpa main tetap tampil dengan 0',
    B.map((x) => x.tgl).join(',') === '2026-11-05,2026-11-04,2026-11-03,2026-11-02,2026-11-01' && sel(B[4].triv).main === 0 && sel(B[4].adv).main === 0, JSON.stringify(B));
  const d3 = B.find((x) => x.tgl === '2026-11-03') || {};
  c('A3 3 Nov Quiz: 13 game, 2 pemain, 1 habis jatah (kolom Quiz, bukan Match/Dash)',
    JSON.stringify(sel(d3.triv)) === JSON.stringify({ main: 13, pemain: 2, habis: 1 }) && sel(d3.mem).main === 0 && sel(d3.adv).main === 0, JSON.stringify(d3));
  const d4 = B.find((x) => x.tgl === '2026-11-04') || {}, d5 = B.find((x) => x.tgl === '2026-11-05') || {};
  c('A4 4 Nov: Dash 2 game 1 pemain, Match 1 game 1 pemain; 5 Nov: Dash 1 game (jam WIB)',
    sel(d4.adv).main === 2 && sel(d4.adv).pemain === 1 && sel(d4.mem).main === 1 && sel(d4.mem).pemain === 1 && sel(d5.adv).main === 1 && sel(d5.triv).main === 0, JSON.stringify([d4, d5]));
  const T = await H.p.evaluate(() => { const tr = document.querySelector('#kbPantau tfoot tr'); if (!tr) return null; return { triv: tr.querySelector('[data-g=triv]').textContent, mem: tr.querySelector('[data-g=mem]').textContent, adv: tr.querySelector('[data-g=adv]').textContent, semua: (document.querySelector('#kbPantau [data-pantau-semua]') || {}).textContent || '' }; });
  c('A5 total edisi: Quiz 13/2 pemain, Match 1/1, Dash 3/1; pemain unik semua game 3 (main 31 Okt tidak ikut)',
    T && sel(T.triv).main === 13 && sel(T.triv).pemain === 2 && sel(T.mem).main === 1 && sel(T.adv).main === 3 && sel(T.adv).pemain === 1 && /\b3\b/.test(T.semua), JSON.stringify(T));
});

await bagian('B. teratas, Misi Komunitas, latihan', async () => {
  const P = await H.p.evaluate(() => Object.fromEntries(['triv', 'mem', 'adv'].map((g) => {
    const x = document.querySelector('#kbPantau [data-papan=' + g + ']');
    return [g, x ? { li: [...x.querySelectorAll('li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), teks: x.textContent.replace(/\s+/g, ' ').trim() } : null];
  })));
  const adv = (P.adv && P.adv.li) || [];
  c('B1 teratas Dash urut Cici 520, Ana 410, Budi 200 (skor edisi lain 999 tidak tampil); Quiz Budi 230; Match tertulis belum ada skor',
    adv.length === 3 && /Cici/.test(adv[0]) && /520/.test(adv[0]) && /Ana/.test(adv[1]) && /410/.test(adv[1]) && /Budi/.test(adv[2]) && !JSON.stringify(P).includes('999') &&
    P.triv && /Budi/.test(P.triv.li[0] || '') && /230/.test(P.triv.li[0] || '') && P.mem && P.mem.li.length === 0 && /belum ada/i.test(P.mem.teks), JSON.stringify(P));
  const K = await H.p.evaluate(() => [(document.querySelector('#kbPantau [data-pantau-kom]') || {}).textContent || '', (document.querySelector('#kbPantau [data-pantau-latihan]') || {}).textContent || '']);
  c('B2 Misi Komunitas 12/40 (30%) dan 1 buku main latihan', /12\s*\/\s*40/.test(K[0]) && /30%/.test(K[0]) && /\b1\b/.test(K[1]) && /latihan/i.test(K[1]), JSON.stringify(K));
  await H.ctx.close();
});

await bagian('C. HP, server lama, tanpa edisi', async () => {
  /* 390 = HP gudang; 340 = HP kecil. Isi yang lebih lebar dari kotaknya wajib tergulung DI DALAM kotak (tabel
     bisa digeser jari), bukan terpotong atau keluar kotak: lembar Kitabku memotong isi yang meluber tanpa
     menggeser halaman, jadi "halaman tidak bergeser" saja tidak cukup. */
  const G = [];
  for (const lebar of [390, 340]) {
    const hp = await halaman(lebar);
    G.push(await hp.p.evaluate((lebar) => {
      const s = document.querySelector('#kbPantau'); if (!s) return { lebar, ada: false };
      const kanan = s.getBoundingClientRect().right, luber = [];
      for (const el of s.querySelectorAll('*')) {
        if (el.getBoundingClientRect().right <= kanan + 1) continue;
        let a = el.parentElement, tergulung = false;
        for (; a && a !== s; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === 'auto' || o === 'scroll') && a.getBoundingClientRect().right <= kanan + 1) { tergulung = true; break; } }
        if (!tergulung) luber.push(el.tagName + '.' + el.className);
      }
      return { lebar, ada: true, geser: document.documentElement.scrollWidth - window.innerWidth, kanan: Math.round(kanan), luber: luber.slice(0, 5) };
    }, lebar));
    await hp.ctx.close();
  }
  c('C1 HP 390 dan 340: bagian Pantau tampil, halaman tidak bergeser, isi yang lebar tergulung di dalam kotak',
    G.every((g) => g.ada && g.geser <= 0 && g.kanan <= g.lebar && g.luber.length === 0), JSON.stringify(G));
  mode = 'lama';
  const lm = await halaman(1280);
  const L = await lm.p.evaluate(() => ({ pantau: !!document.querySelector('#kbPantau'), funnel: !!document.querySelector('#kbFunnel'), hadiah: !!document.querySelector('#kbHadiah'), galat: (document.querySelector('.kb-galat, [role=alert]') || {}).textContent || '' }));
  await lm.ctx.close();
  mode = 'kosong';
  const ks = await halaman(1280);
  const K = await ks.p.evaluate(() => ({ pantau: !!document.querySelector('#kbPantau') }));
  await ks.ctx.close();
  c('C2 server lama tanpa aksi pantauGame: bagian Pantau tidak tampil, funnel dan hadiah tetap ada; tanpa edisi aktif: tidak tampil',
    !L.pantau && L.funnel && L.hadiah && !K.pantau, JSON.stringify([L, K]));
  c('C3 tanpa galat JavaScript', errs.length === 0, JSON.stringify(errs));
});

await b.close(); srv.close();
if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '.'); gagal++; }
console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
process.exit(gagal ? 1 : 0);
