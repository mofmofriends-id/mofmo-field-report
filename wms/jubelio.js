/* Saklar Jubelio WMS Mofmofriends (1 Nov 2026): tab "Jubelio" di Kontrol.
 *
 * Saklar setoran pesanan Shopee ke Kitab (jubelio_atur.pesanan_kitab, dibaca Edge Function jubelio waktu webhook
 * pesanan masuk):
 *  - manual (bawaan): isi pesanan Kitab tetap dari upload Excel Shopee di WMS;
 *  - otomatis: pesanan Shopee (SP-...) yang lunas dan tidak batal di Jubelio langsung mengisi Kitab; isi yang sudah
 *    ada dari Excel tidak ditimpa.
 * Laporan penjualan event tidak dibuat di WMS: Ferdy 1 Nov, laporan Keuangan Jubelio sudah cukup.
 * Server: Edge Function jubelio jalur /jubelio/wms, tiket WMS yang sama dengan Edge Function wms dan kitab. */
(function () {
  var W = window;
  var URL_JUB = 'https://oloxoxmfbfxxibksxeug.supabase.co/functions/v1/jubelio/wms';
  function M() { return W.__wms || {}; }
  function id() { return !!(M().bhs && M().bhs() === 'id'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function el(i) { return W.document ? W.document.getElementById(i) : null; }
  function bunyi(n) { try { var S0 = M().Suara; if (S0 && S0[n]) S0[n](); } catch (e) {} }
  function panggil(aksi, isi) {
    var badan = Object.assign({ aksi: aksi, tiket: (M().S && M().S.tiket) || '' }, isi || {});
    return fetch(URL_JUB, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(badan), credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.json(); });
  }
  var TS = {
    id: { judul: 'Setoran pesanan Shopee ke Kitab', ket: 'Manual: isi pesanan Kitab tetap dari upload Excel Shopee di WMS. Otomatis: pesanan Shopee yang lunas di Jubelio langsung mengisi Kitab; yang sudah ada dari Excel tidak ditimpa.',
      manual: 'Manual', otomatis: 'Otomatis', memuat: 'Memuat pengaturan Jubelio…', gagal: 'Server Jubelio belum bisa dihubungi. Cek sinyal lalu coba lagi.', sesi: 'Sesi WMS habis. Keluar lalu masuk lagi.', muat: 'Coba lagi',
      ok: function (v) { return 'Setoran pesanan Kitab sekarang ' + v + '.'; }, galat: 'Belum tersimpan: ' },
    en: { judul: 'Shopee orders into Kitab', ket: 'Manual: Kitab order contents still come from the Shopee Excel upload in WMS. Automatic: paid Shopee orders in Jubelio fill Kitab directly; orders already loaded from Excel are not overwritten.',
      manual: 'Manual', otomatis: 'Automatic', memuat: 'Loading Jubelio settings…', gagal: 'The Jubelio server could not be reached. Check the signal and try again.', sesi: 'Your WMS session has ended. Sign out and sign in again.', muat: 'Try again',
      ok: function (v) { return 'Kitab order feed is now ' + v + '.'; }, galat: 'Not saved: ' }
  };
  function T(k) { var d = TS[id() ? 'id' : 'en']; return d[k] != null ? d[k] : TS.en[k]; }
  var S = { nilai: null, sibuk: false, pasang: false, status: '', ke: 0 };
  function wadah() { return el('kontrolIsi'); }
  function pesan(p) { return '<div class="jb-pesan tolak-alat" role="alert">' + esc(p) + ' <button type="button" class="btn dua" data-jb="muat">' + esc(T('muat')) + '</button></div>'; }
  function gambar(w) {
    pasangKejadian();
    if (S.nilai) { tampil(w); return; }
    var ke = ++S.ke;
    w.innerHTML = '<p class="ket-alat">' + esc(T('memuat')) + '</p>';
    panggil('event').then(function (h) {
      if (ke !== S.ke) return; var w2 = wadah(); if (!w2) return;
      if (!h || h.perluMasuk) { w2.innerHTML = pesan(T('sesi')); return; }
      if (!h.ok) { w2.innerHTML = pesan(h.pesan || T('gagal')); return; }
      S.nilai = h.atur && h.atur.pesanan_kitab === 'otomatis' ? 'otomatis' : 'manual'; tampil(w2);
    }, function () { if (ke !== S.ke) return; var w2 = wadah(); if (w2) w2.innerHTML = pesan(T('gagal')); });
  }
  function tampil(w) {
    w.innerHTML = '<h3 class="kn-bulan">' + esc(T('judul')) + '</h3><p class="ket-alat">' + esc(T('ket')) + '</p><div class="lp-atur jb-saklar">' +
      ['manual', 'otomatis'].map(function (x) { return '<button type="button" class="chip-alat' + (S.nilai === x ? ' on' : '') + '" data-jb-saklar="' + x + '" aria-pressed="' + (S.nilai === x) + '">' + esc(T(x)) + '</button>'; }).join('') +
      '</div><p class="lp-status jb-status" id="jbStatus" role="status" aria-live="polite">' + esc(S.status) + '</p>';
  }
  function ubah(v) {
    if (S.sibuk || S.nilai === v) return; S.sibuk = true; bunyi('klik');
    panggil('atur', { kunci: 'pesanan_kitab', nilai: v }).then(function (h) {
      S.sibuk = false;
      if (h && h.perluMasuk) S.status = T('sesi');
      else if (!h || !h.ok) S.status = T('galat') + ((h && h.pesan) || T('gagal'));
      else { S.nilai = v; S.status = T('ok')(T(v).toLowerCase()); bunyi('sukses'); }
      var w = wadah(); if (w) tampil(w);
    }, function () { S.sibuk = false; S.status = T('galat') + T('gagal'); var w = wadah(); if (w) tampil(w); });
  }
  function pasangKejadian() {
    if (S.pasang || !W.document) return; S.pasang = true;
    W.document.addEventListener('click', function (e) {
      var x = e.target && e.target.closest ? e.target.closest('#kontrol [data-jb-saklar],#kontrol [data-jb]') : null;
      if (!x) return;
      if (x.hasAttribute('data-jb-saklar')) { ubah(x.getAttribute('data-jb-saklar')); return; }
      if (x.getAttribute('data-jb') === 'muat') { S.nilai = null; S.status = ''; var w = wadah(); if (w) gambar(w); }
    });
  }
  W.WmsJubelio = { gambar: gambar };
})();
