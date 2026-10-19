/* Uji foto S Angora Rabbit dan S Netherland Dwarf di WMS (19 Okt 2026).
 * Harapan: "8 pemeriksaan, SEMUA LULUS".
 *
 * KENAPA UJI INI ADA. Ferdy melihat di Inventory (kondisi stok offline) baris "S Angora Rabbit"
 * bergambar boneka yang di Rupa2 disebut Netherland Dwarf Rabbit, lalu mengirim foto listing
 * Angora yang asli (kelinci krem, telinga panjang turun dengan dalaman pink): "yang ini angora,
 * brti yg skrg di wms itu ndr". Foto dari zip Shopee 9 Okt dipasangkan ke SKU dengan tebakan, dan
 * tebakan Angora salah. Yang mahal kalau salah, dan diam: gudang memetik barang berdasarkan
 * foto, mitra membandingkan foto WMS dengan rak, kartu koleksi dicetak dengan foto yang keliru.
 * Yang diperiksa:
 *  - ISI gambarnya: foto Angora memuat telinga pink (piksel pink), foto NDR tidak. Mengganti
 *    nama berkas tanpa menukar isinya tetap merah.
 *  - nama SKU (panjang dan pendek gudang) mengarah ke foto yang benar, dan aksesori Netherland
 *    Dwarf (key charm, key ring, rucksack, cap) TIDAK tertelan aturan plush NDR.
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), vm = require('vm');
const AKAR = process.env.AKAR || path.resolve(__dirname, '..');
const WMS = path.join(AKAR, 'wms');

let gagal = 0, jalan = 0; const DIHARAPKAN = 8;
const c = (n, ok, k) => { jalan++; if (!ok) gagal++; console.log((ok ? 'LULUS ' : 'GAGAL ') + n + (ok ? '' : '\n   -> ' + String(k).slice(0, 500))); };
async function bagian(nama, fn) { console.log('\n=== ' + nama + ' ==='); try { await fn(); } catch (e) { gagal++; console.log('GAGAL ' + nama + ' MATI -> ' + (e && e.stack || e)); } }

/* kulit.js dijalankan seperti di peramban: ia memasang window.KulitPapan */
const W = {}; vm.runInNewContext(fs.readFileSync(path.join(WMS, 'kulit.js'), 'utf8'), { window: W, document: undefined, navigator: {}, console });
const K = W.KulitPapan;

(async () => {
  await bagian('A. nama SKU ke foto', async () => {
    const f = (n) => K.fotoSku(n);
    c('A1 Angora (nama panjang dan pendek) ke foto angora', f('MofmoFriends S - Angora Rabbit') === 'angora' && f('S Angora Rabbit') === 'angora', [f('MofmoFriends S - Angora Rabbit'), f('S Angora Rabbit')]);
    const nd = ['MofmoFriends S - netherland dwarf', 'MofmoFriends S - Netherland Dwarf', 'S Netherland Dwarf', 'S Netherland Dwarf Rabbit', 'S NDR'].map(f);
    c('A2 plush S Netherland Dwarf (semua ejaan yang ada di sheet) ke foto ndr_s, tidak lagi tanpa foto', nd.every((x) => x === 'ndr_s'), JSON.stringify(nd));
    const aks = [f('MOFMOFRIENDS key charm - Netherland Dwarf Rabbit'), f('MOFMOFRIENDS Key Ring - Netherland Dwarf Rabbit'), f('MofmoFriends - Mini Rucksck - Netherland Dwarf Rabbit (Key Charm)'), f('Cap for MofmoFriends S - Netherland Dwarf Rabbit'), f('KC NDR'), f('KR NDR'), f('Ruck NDR')];
    c('A3 aksesori Netherland Dwarf tetap ke fotonya sendiri, tidak tertelan aturan plush', JSON.stringify(aks) === JSON.stringify(['kc_rabbit', 'kr_rabbit', 'rs_rabbit', 'cap_rabbit', 'kc_rabbit', 'kr_rabbit', 'rs_rabbit']), JSON.stringify(aks));
    c('A4 teks yang bukan nama produk tetap tanpa foto (nama gerai)', f('TK Alam Sutera') === '' && f('Netherland') === '', JSON.stringify([f('TK Alam Sutera'), f('Netherland')]));
  });

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.setContent('<body></body>');
  /* porsi piksel pink (dalaman telinga Angora) di antara piksel yang tidak transparan */
  const pink = async (rel) => {
    const f = path.join(WMS, rel);
    if (!fs.existsSync(f)) return { ada: false };
    const u = 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
    return p.evaluate(async (u) => {
      const i = new Image(); i.src = u; await i.decode();
      const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight;
      const g = cv.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data;
      let isi = 0, pk = 0;
      for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 128) continue; isi++; const r = d[k], gg = d[k + 1], bb = d[k + 2]; if (r > 180 && r - gg > 35 && r - bb > 25 && gg < 200) pk++; }
      return { ada: true, w: cv.width, h: cv.height, pink: pk / isi };
    }, u);
  };

  await bagian('B. isi gambar', async () => {
    const ang = { besar: await pink('img/angora.webp'), sku: await pink('img/sku/angora.webp'), kartu: await pink('img/kartu/angora.webp') };
    c('B1 ketiga foto Angora (boneka, thumbnail SKU, kartu cetak) memuat telinga pink (lebih dari 1,5% piksel)', Object.values(ang).every((x) => x.ada && x.pink > 0.015), JSON.stringify(ang));
    const nd = { besar: await pink('img/ndr_s.webp'), sku: await pink('img/sku/ndr_s.webp'), kartu: await pink('img/kartu/ndr_s.webp') };
    c('B2 ketiga foto NDR ada dan tanpa telinga pink (di bawah 0,5% piksel), yaitu foto yang dulu salah dipasang sebagai Angora', Object.values(nd).every((x) => x.ada && x.pink < 0.005), JSON.stringify(nd));
    c('B3 thumbnail SKU tetap 96x96 seperti thumbnail lain', ang.sku.w === 96 && ang.sku.h === 96 && nd.sku.w === 96 && nd.sku.h === 96, JSON.stringify([ang.sku, nd.sku]));
  });

  await bagian('C. boneka pesan memuat tetap boneka yang sama', async () => {
    const app = fs.readFileSync(path.join(WMS, 'app.js'), 'utf8');
    const m = app.match(/class="l4-boneka" src="' \+ K\.dasar \+ '([a-z_]+)\.webp"/);
    /* boneka yang menemani pesan memuat sejak 10 Okt adalah foto yang ternyata NDR; tampilannya tidak diubah */
    c('C1 boneka pesan memuat menunjuk foto NDR (gambarnya sama seperti sebelumnya), bukan Angora yang baru', m && m[1] === 'ndr_s' && fs.existsSync(path.join(WMS, 'img', m[1] + '.webp')), m && m[1]);
  });

  await b.close();
  if (jalan !== DIHARAPKAN) { console.log('\nBAHAYA: ' + jalan + ' pemeriksaan berjalan, seharusnya ' + DIHARAPKAN + '. Uji mati di tengah jalan.'); gagal++; }
  console.log('\n' + jalan + ' pemeriksaan, ' + (gagal ? gagal + ' GAGAL' : 'SEMUA LULUS'));
  process.exit(gagal ? 1 : 0);
})();
