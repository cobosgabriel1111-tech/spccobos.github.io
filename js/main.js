/* ==========================================================
   SPC · Portafolio tipo libro — lógica principal
   Usa la librería StPageFlip (MIT) para el efecto de pasar página.
   ========================================================== */
(function () {
  "use strict";

  var CFG = Object.assign({
    telefono: "+593996548241",
    telefonoVisible: "+593 996 548 241",
    whatsapp: "593996548241",
    mensajeWhatsApp: "Hola, vi su portafolio publicitario y me gustaría recibir información."
  }, window.SPC_CONFIG || {});

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var app = $("#app");
  var bookEl = $("#book");
  var pageEls = $$(".page", bookEl);
  var TOTAL = pageEls.length;
  var INNER = TOTAL - 2;
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pf = null;
  var soundOn = false;
  var audioCtx = null;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } return null; }

  /* ---------- 1. Datos de contacto (desde config.js) ---------- */
  function waLink(text) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text); }

  $$("[data-wa]").forEach(function (a) {
    a.href = waLink(a.getAttribute("data-wa") || CFG.mensajeWhatsApp);
    a.target = "_blank"; a.rel = "noopener";
  });
  $$("[data-tel]").forEach(function (a) { a.href = "tel:" + CFG.telefono; });
  $$("[data-phone-text]").forEach(function (el) { el.textContent = CFG.telefonoVisible; });

  var optional = {
    correo: { href: function (v) { return "mailto:" + v; }, text: function (v) { return v; } },
    direccion: { href: null, text: function (v) { return v; } },
    instagram: { href: function (v) { return v; }, text: function (v) { return "Instagram"; } },
    facebook: { href: function (v) { return v; }, text: function (v) { return "Facebook"; } },
    web: { href: function (v) { return v; }, text: function (v) { return v.replace(/^https?:\/\//, "").replace(/\/$/, ""); } }
  };
  $$("[data-opt]").forEach(function (li) {
    var key = li.getAttribute("data-opt");
    var val = CFG[key];
    if (!val) { li.parentNode && li.parentNode.removeChild(li); return; }
    var el = $("[data-opt-link]", li);
    el.textContent = optional[key].text(val);
    if (optional[key].href && el.tagName === "A") el.href = optional[key].href(val);
  });
  var contactList = $(".contact-list");
  if (contactList && !contactList.children.length) contactList.parentNode.removeChild(contactList);

  /* ---------- 2. Tamaño de la unidad "u" (1% del ancho de página) ---------- */
  function updateUnit() {
    var w = 0;
    try { w = pf.getRender().getRect().pageWidth; } catch (e) { /* ignora */ }
    if (!w) {
      var visible = pageEls.filter(function (el) { return el.offsetWidth > 0; })[0];
      if (visible) w = visible.offsetWidth;
    }
    if (w > 0) $("#stage").style.setProperty("--u", (w / 100) + "px");
  }

  /* Libro cerrado: se desplaza media página para quedar centrado */
  var shiftEl = $("#shift");
  function setShift(idx) {
    var v = 0;
    if (pf && pf.getOrientation() === "landscape") {
      if (idx === 0) v = -0.5; else if (idx >= TOTAL - 1) v = 0.5;
    }
    shiftEl.style.setProperty("--shift", v);
  }
  function targetIndex(idx, dir) { // dir: 0 = adelante, 1 = atrás
    if (pf.getOrientation() === "portrait") return dir === 0 ? Math.min(idx + 1, TOTAL - 1) : Math.max(idx - 1, 0);
    if (dir === 0) return idx === 0 ? 1 : Math.min(idx + 2, TOTAL - 1);
    return idx <= 1 ? 0 : idx - 2;
  }

  /* ---------- 3. Páginas visibles y progreso ---------- */
  var titles = pageEls.map(function (el) { return el.getAttribute("data-title") || ""; });

  function visibleIndexes(idx) {
    if (pf.getOrientation() === "portrait") return [idx];
    if (idx === 0) return [0];
    var list = [idx];
    if (idx + 1 < TOTAL) list.push(idx + 1);
    return list;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function onPageChange(idx) {
    setShift(idx);
    var vis = visibleIndexes(idx);
    pageEls.forEach(function (el, i) { el.classList.toggle("is-active", vis.indexOf(i) !== -1); });

    var first = vis[0], last = vis[vis.length - 1];
    var label;
    if (first === 0) label = "Portada";
    else if (last === TOTAL - 1 && vis.length === 1) label = "Contraportada";
    else if (vis.length === 2) label = pad(first) + " – " + pad(last) + " / " + pad(INNER);
    else label = pad(first) + " / " + pad(INNER);
    $("#count").textContent = label;
    $("#where-title").textContent = titles[first] + (vis.length === 2 && titles[last] !== titles[first] ? "  ·  " + titles[last] : "");
    $("#bar").style.transform = "scaleX(" + (last / (TOTAL - 1)) + ")";
    $("#btn-prev").disabled = first === 0;
    $("#btn-next").disabled = last === TOTAL - 1;

    $$(".sheet__item.is-current").forEach(function (el) { el.classList.remove("is-current"); });
    vis.forEach(function (i) {
      var item = $('.sheet__item[data-i="' + i + '"]');
      if (item) item.classList.add("is-current");
    });

    try { history.replaceState(null, "", first === 0 ? location.pathname + location.search : "#p" + first); } catch (e) { /* ignora */ }
  }

  /* ---------- 4. Sonido de papel (opcional) ---------- */
  function paperSound() {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      var dur = 0.45, sr = audioCtx.sampleRate;
      var buf = audioCtx.createBuffer(1, Math.floor(sr * dur), sr);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) {
        var t = i / d.length;
        d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 1.4);
      }
      var src = audioCtx.createBufferSource(); src.buffer = buf;
      var filter = audioCtx.createBiquadFilter(); filter.type = "bandpass"; filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(900, audioCtx.currentTime);
      filter.frequency.linearRampToValueAtTime(3400, audioCtx.currentTime + dur);
      var gain = audioCtx.createGain(); gain.gain.value = 0.16;
      src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* sin audio */ }
  }

  var soundBtn = $("#btn-sound");
  function setSound(on) {
    soundOn = on;
    soundBtn.setAttribute("aria-pressed", String(on));
    soundBtn.setAttribute("aria-label", on ? "Silenciar sonido de páginas" : "Activar sonido de páginas");
    $("use", soundBtn).setAttribute("href", on ? "#i-sound" : "#i-mute");
    store("spc-sound", on ? "1" : "0");
  }
  soundBtn.addEventListener("click", function () { setSound(!soundOn); if (soundOn) paperSound(); });
  setSound(store("spc-sound") === "1");

  /* ---------- 5. Libro ---------- */
  function startPageFromHash() {
    var m = /^#p(\d+)$/.exec(location.hash || "");
    var n = m ? parseInt(m[1], 10) : 0;
    return n > 0 && n < TOTAL ? n : 0;
  }

  /* Toques: un toque en el borde de la página la pasa; sobre botones, enlaces y fotos hace su acción */
  var down = null, up = { target: null, x: 0 };
  window.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; }, true);
  window.addEventListener("pointerup", function (e) { up = { target: e.target, x: e.clientX }; }, true);
  // si el dedo/mouse se movió (fue un arrastre), no se dispara el "click" del elemento
  document.addEventListener("click", function (e) {
    if (e.detail > 0 && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  function isInteractive(el) { return !!(el && el.closest && el.closest("a, button, input, textarea, label, [data-goto]")); }

  function tapFlip() {
    if (!pf || isInteractive(up.target)) return;
    var idx = pf.getCurrentPageIndex();
    var vis = visibleIndexes(idx);
    if (idx === 0) { pf.flipNext(); return; }            // portada: tocar en cualquier parte abre el libro
    var left = Infinity, right = -Infinity, pageW = 0;
    vis.forEach(function (i) {
      var r = pageEls[i].getBoundingClientRect();
      left = Math.min(left, r.left); right = Math.max(right, r.right); pageW = Math.max(pageW, r.width);
    });
    var edge = pageW * 0.37;
    if (up.x >= right - edge) pf.flipNext();
    else if (up.x <= left + edge) pf.flipPrev();
  }

  function initBook() {
    var Flip = window.St && window.St.PageFlip;
    if (!Flip) { document.body.insertAdjacentHTML("beforeend", "<p style='position:fixed;inset:auto 0 20px;text-align:center'>No se pudo cargar el visor del portafolio.</p>"); return; }

    pf = new Flip(bookEl, {
      width: 520, height: 800,            // proporción de cada página (0,65)
      size: "stretch",
      minWidth: 300, maxWidth: 560,      // con menos de 600 px de ancho se muestra una página a la vez
      minHeight: 240, maxHeight: 862,
      maxShadowOpacity: 0.5,
      showCover: true,
      usePortrait: true,                  // en celular: una página a la vez
      mobileScrollSupport: true,          // los toques en botones y fotos funcionan normal
      drawShadow: true,
      flippingTime: reduceMotion ? 350 : 900,
      swipeDistance: 24,
      clickEventForward: false,           // se puede deslizar desde cualquier parte, incluso sobre fotos
      showPageCorners: true,
      tapFlip: tapFlip,                   // toque en el borde de la página = pasar página
      startPage: startPageFromHash()
    });
    pf.loadFromHTML(pageEls);
    window.spcBook = pf; // útil para depurar desde la consola del navegador
    updateUnit();

    pf.on("flip", function (e) { updateUnit(); onPageChange(e.data); });
    pf.on("changeOrientation", function () { updateUnit(); onPageChange(pf.getCurrentPageIndex()); });
    pf.on("changeState", function (e) {
      if (e.data === "flipping") {
        paperSound();
        try { setShift(targetIndex(pf.getCurrentPageIndex(), pf.getFlipController().getCalculation().getDirection())); } catch (err) { /* ignora */ }
      } else if (e.data === "read") {
        setShift(pf.getCurrentPageIndex());
      }
    });

    onPageChange(pf.getCurrentPageIndex());
    bookEl.classList.add("is-ready");

    var raf = 0;
    var lastW = 0, lastH = 0;
    function relayout() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var w = bookEl.clientWidth, h = bookEl.clientHeight;
        if (w !== lastW || h !== lastH) { lastW = w; lastH = h; try { pf.update(); } catch (e) { /* ignora */ } }
        updateUnit();
      });
    }
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", function () { setTimeout(relayout, 250); });
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(bookEl);
  }

  /* ---------- 6. Controles ---------- */
  $("#btn-prev").addEventListener("click", function () { pf.flipPrev(); });
  $("#btn-next").addEventListener("click", function () { pf.flipNext(); });

  document.addEventListener("click", function (e) {
    var g = e.target.closest && e.target.closest("[data-goto]");
    if (g && pf) {
      e.preventDefault();
      var n = parseInt(g.getAttribute("data-goto"), 10);
      if (n === 0) { pf.flip(0); } else { pf.flip(n); }
      closeSheet();
    }
    var q = e.target.closest && e.target.closest("[data-open-quote]");
    if (q) openQuote();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeTopLayer(); return; }
    if (!pf || layerOpen()) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); pf.flipNext(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); pf.flipPrev(); }
    else if (e.key === "Home") { e.preventDefault(); pf.flip(0); }
    else if (e.key === "End") { e.preventDefault(); pf.flip(TOTAL - 1); }
  });

  /* ---------- 7. Capas (índice, visor, cotización) ---------- */
  var layers = [];
  function layerOpen() { return layers.length > 0; }
  function openLayer(el, focusEl) {
    el.hidden = false;
    app.setAttribute("inert", "");
    layers.push({ el: el, opener: document.activeElement });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-open"); }); });
    setTimeout(function () { (focusEl || el).focus && (focusEl || el).focus(); }, 60);
  }
  function closeLayer(el) {
    var i = layers.map(function (l) { return l.el; }).indexOf(el);
    if (i === -1) return;
    var info = layers.splice(i, 1)[0];
    el.classList.remove("is-open");
    if (!layers.length) app.removeAttribute("inert");
    setTimeout(function () { if (!el.classList.contains("is-open")) el.hidden = true; }, 450);
    if (info.opener && info.opener.focus) { try { info.opener.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
  }
  function closeTopLayer() { if (layers.length) closeLayer(layers[layers.length - 1].el); }
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { var l = b.closest(".sheet, .lb, .modal"); if (l) closeLayer(l); }); });

  /* Índice */
  var sheet = $("#sheet");
  var sheetList = $("#sheet-list");
  titles.forEach(function (t, i) {
    if (i === TOTAL - 1) return; // la contraportada no va en el índice
    var li = document.createElement("li");
    var b = document.createElement("button");
    b.type = "button"; b.className = "sheet__item"; b.setAttribute("data-i", i);
    b.innerHTML = "<span>" + (i === 0 ? "—" : pad(i)) + "</span>" + t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    b.addEventListener("click", function () { closeSheet(); setTimeout(function () { pf.flip(i); }, 250); });
    li.appendChild(b); sheetList.appendChild(li);
  });
  function closeSheet() { closeLayer(sheet); }
  $("#btn-index").addEventListener("click", function () { openLayer(sheet, $(".sheet__item.is-current", sheet) || $(".sheet__item", sheet)); });

  /* Visor de fotos con zoom suave desde la miniatura */
  var lb = $("#lb"), lbImg = $("#lb-img"), lbCap = $("#lb-cap");
  var lbItems = [], lbIndex = 0;

  function lbShow(i, origin) {
    var b = lbItems[i]; if (!b) return;
    lbIndex = i;
    var thumb = $("img", b);
    lbImg.alt = thumb ? thumb.alt : "";
    lbCap.textContent = b.getAttribute("data-caption") || lbImg.alt;
    $("#lb-prev").hidden = $("#lb-next").hidden = lbItems.length < 2;
    lbImg.style.transition = "none"; lbImg.style.transform = "none"; lbImg.style.opacity = origin ? "0" : "1";
    function place() {
      if (!origin || reduceMotion) { lbImg.style.opacity = "1"; return; }
      var from = origin.getBoundingClientRect(), to = lbImg.getBoundingClientRect();
      if (!to.width) { lbImg.style.opacity = "1"; return; }
      var s = from.width / to.width;
      var dx = (from.left + from.width / 2) - (to.left + to.width / 2);
      var dy = (from.top + from.height / 2) - (to.top + to.height / 2);
      lbImg.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + s + ")";
      lbImg.style.opacity = "1";
      void lbImg.offsetWidth;
      lbImg.style.transition = "transform .7s cubic-bezier(.22,.7,.2,1)";
      lbImg.style.transform = "none";
    }
    lbImg.onload = place;
    lbImg.src = b.getAttribute("data-full") || (thumb && thumb.src);
    if (lbImg.complete && lbImg.naturalWidth) place();
  }
  document.addEventListener("click", function (e) {
    var z = e.target.closest && e.target.closest(".zoomable");
    if (!z) return;
    var group = z.getAttribute("data-group");
    lbItems = $$('.zoomable[data-group="' + group + '"]');
    openLayer(lb, $(".lb__x"));
    lbShow(lbItems.indexOf(z), z);
  });
  $("#lb-prev").addEventListener("click", function () { lbShow((lbIndex - 1 + lbItems.length) % lbItems.length); });
  $("#lb-next").addEventListener("click", function () { lbShow((lbIndex + 1) % lbItems.length); });
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("is-open") || lbItems.length < 2) return;
    if (e.key === "ArrowRight") lbShow((lbIndex + 1) % lbItems.length);
    if (e.key === "ArrowLeft") lbShow((lbIndex - 1 + lbItems.length) % lbItems.length);
  });
  (function swipeLightbox() {
    var x0 = null;
    lb.addEventListener("touchstart", function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (x0 === null || lbItems.length < 2) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) lbShow((lbIndex + (dx < 0 ? 1 : lbItems.length - 1)) % lbItems.length);
    }, { passive: true });
  })();

  /* Cotización rápida → WhatsApp */
  var quote = $("#quote"), form = $("#quote-form"), err = $("#quote-err");
  function openQuote() { err.hidden = true; openLayer(quote, $("input[name=nombre]", form)); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var nombre = form.nombre.value.trim();
    if (!nombre) { err.hidden = false; form.nombre.focus(); return; }
    err.hidden = true;
    var empresa = form.empresa.value.trim();
    var interes = $$("input[name=interes]:checked", form).map(function (c) { return c.value; });
    var detalle = form.detalle.value.trim();
    var msg = "Hola, soy " + nombre + (empresa ? " de " + empresa : "") + ". Vi su portafolio y me gustaría solicitar una cotización";
    if (interes.length) msg += " de: " + interes.join(", ");
    msg += ".";
    if (detalle) msg += " Detalle: " + detalle;
    window.open(waLink(msg), "_blank", "noopener");
    closeLayer(quote);
  });

  /* ---------- 8. Arranque ---------- */
  function boot() {
    initBook();
    app.classList.add("is-ready");
    var loader = $("#loader");
    if (loader) { loader.classList.add("is-done"); setTimeout(function () { loader.parentNode && loader.parentNode.removeChild(loader); }, 800); }
  }
  var started = false;
  function go() { if (started) return; started = true; boot(); }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var imgsReady = new Promise(function (res) { if (document.readyState === "complete") res(); else window.addEventListener("load", res); });
  Promise.all([fontsReady, imgsReady]).then(go);
  setTimeout(go, 4000); // por si algo tarda demasiado
})();
