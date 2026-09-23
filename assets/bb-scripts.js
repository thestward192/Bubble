/* Bubble Beads — custom theme scripts (vanilla, no libraries) */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- scroll reveal ---------------------------------------------------- */
  var revealIO = null;
  function initReveal() {
    var els = document.querySelectorAll('.bb-reveal:not(.bb-visible)');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('bb-visible'); });
      return;
    }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var sibs = Array.prototype.slice.call(el.parentNode.querySelectorAll(':scope > .bb-reveal'));
          var idx = sibs.indexOf(el);
          el.style.setProperty('--bb-delay', (idx > -1 ? Math.min(idx, 6) * 0.08 : 0) + 's');
          el.classList.add('bb-visible');
          revealIO.unobserve(el);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    els.forEach(function (el) { revealIO.observe(el); });
  }

  /* Re-run reveal whenever product cards are swapped in without a full page
     load (filter/sort AJAX from Dawn's facets.js, pagination, etc.) — those
     new .bb-reveal elements would otherwise never receive .bb-visible and
     stay invisible even though they're in the DOM and clickable. */
  function watchDynamicGrids() {
    var targets = document.querySelectorAll('#ProductGridContainer, .bb-shop-grid, [data-bb-gallery]');
    if (!targets.length || !('MutationObserver' in window)) return;
    var scheduled = false;
    var mo = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        initReveal();
      });
    });
    targets.forEach(function (t) {
      mo.observe(t, { childList: true, subtree: true });
    });
  }

  /* ---- product gallery ----------------------------------------------- */
  function initGallery() {
    var gallery = document.querySelector('[data-bb-gallery]');
    if (!gallery) return;
    var main = gallery.querySelector('[data-bb-gallery-main]');
    var thumbs = gallery.querySelectorAll('[data-bb-gallery-thumb]');
    if (!main || !thumbs.length) return;
    thumbs.forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        var full = thumb.getAttribute('data-full');
        if (full) main.src = full;
        thumbs.forEach(function (t) { t.classList.remove('is-active'); });
        thumb.classList.add('is-active');
      });
    });
  }

  /* ---- product variants -------------------------------------------- */
  function initVariants() {
    var root = document.querySelector('[data-bb-variants]');
    if (!root) return;
    var dataEl = document.getElementById('bb-variant-data');
    if (!dataEl) return;
    var variants;
    try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var idInput = root.querySelector('input[name="id"]');
    var priceEl = root.querySelector('[data-bb-price]');
    var addBtn = root.querySelector('[data-bb-add]');
    var addLabel = addBtn ? addBtn.querySelector('[data-bb-add-label]') : null;
    var moneyFormat = root.getAttribute('data-money') || '${{amount}}';
    var soldOutText = root.getAttribute('data-soldout') || 'Sold out';
    var addText = root.getAttribute('data-addtext') || 'Add to cart';

    function money(cents) {
      var value = (cents / 100).toFixed(2);
      return moneyFormat.replace(/\{\{\s*amount\s*\}\}/, value);
    }
    function currentOptions() {
      return Array.prototype.map.call(
        root.querySelectorAll('[data-bb-option]'),
        function (group) {
          var checked = group.querySelector('input:checked');
          return checked ? checked.value : null;
        }
      );
    }
    function update() {
      var opts = currentOptions();
      var match = variants.find(function (v) {
        return v.options.every(function (o, i) { return o === opts[i]; });
      });
      if (!match) return;
      if (idInput) idInput.value = match.id;
      if (priceEl) {
        var html = money(match.price);
        if (match.compare_at_price && match.compare_at_price > match.price) {
          html = '<s>' + money(match.compare_at_price) + '</s>' + money(match.price);
        }
        priceEl.innerHTML = html;
      }
      if (addBtn) {
        addBtn.disabled = !match.available;
        if (addLabel) addLabel.textContent = match.available ? addText : soldOutText;
      }
    }
    root.querySelectorAll('[data-bb-option] input').forEach(function (input) {
      input.addEventListener('change', update);
    });
    update();
  }

  /* ---- announcement rotator (optional multi-message) ---------------- */
  function initAnnounce() {
    var bar = document.querySelector('.bb-announce');
    if (!bar) return;
    var items = bar.querySelectorAll('.bb-announce-row > span');
    if (items.length < 2 || reduce) return;

    var forceRotate = bar.hasAttribute('data-bb-announce-rotate');
    var mq = window.matchMedia('(max-width: 640px)');
    var i = 0;
    var timer = null;

    function showAll() {
      if (timer) { clearInterval(timer); timer = null; }
      bar.classList.remove('is-rotating');
      items.forEach(function (s) { s.style.display = ''; });
    }
    function startRotate() {
      if (timer) return;
      bar.classList.add('is-rotating');
      i = 0;
      items.forEach(function (s, n) { s.style.display = n === 0 ? '' : 'none'; });
      timer = setInterval(function () {
        items[i].style.display = 'none';
        i = (i + 1) % items.length;
        items[i].style.display = '';
      }, 4000);
    }
    // Merchant can force rotation at any size; otherwise it only kicks in on
    // phone, where showing every message in a row wraps into a cramped block.
    function apply() {
      if (forceRotate || mq.matches) startRotate();
      else showAll();
    }
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else mq.addListener(apply);
  }

  /* ---- product card: dots follow the touch swipe between the 2 photos ---
     One delegated capture listener, so cards injected later (filters,
     pagination, theme editor) work without re-init. */
  function initCardSwipe() {
    if (window.__bbCardSwipe) return;
    window.__bbCardSwipe = true;
    document.addEventListener('scroll', function (e) {
      var el = e.target;
      if (!el.classList || !el.classList.contains('bb-pcard__slides')) return;
      var dots = el.parentNode.querySelectorAll('.bb-pcard__dots i');
      if (!dots.length || !el.clientWidth) return;
      var idx = Math.round(el.scrollLeft / el.clientWidth);
      for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('is-active', i === idx);
    }, { capture: true, passive: true });
  }
  initCardSwipe();

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    initReveal();
    watchDynamicGrids();
    initGallery();
    initVariants();
    initAnnounce();
    document.addEventListener('shopify:section:load', function () {
      initReveal();
      watchDynamicGrids();
      initGallery();
      initVariants();
    });
  });
})();
