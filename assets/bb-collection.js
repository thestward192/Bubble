/* Bubble Beads — turns Dawn's two price text inputs into a single visual
   slider (like the reference design) while still using Dawn's real
   filtering engine underneath (facets.js listens for input/change events
   on the same fields, so we just drive them programmatically). */
(function () {
  function currencySymbol(scope) {
    var el = scope.querySelector('.field-currency');
    return el ? el.textContent.trim() : '€';
  }

  function formatWhole(amount, symbol) {
    return Math.round(amount) + ' ' + symbol;
  }

  function enhance(priceRange) {
    var inputs = priceRange.querySelectorAll('input.field__input');
    if (inputs.length < 2 || priceRange.classList.contains('bb-price-enhanced')) return;

    var minInput = inputs[0];
    var maxInput = inputs[1];
    var rangeMax = parseFloat(maxInput.getAttribute('data-max')) || 100;
    var rangeMin = 0;
    var currentMax = parseFloat(maxInput.value) || rangeMax;
    var symbol = currencySymbol(priceRange);

    priceRange.classList.add('bb-price-enhanced');

    var wrap = document.createElement('div');
    wrap.className = 'bb-price-slider';

    var range = document.createElement('input');
    range.type = 'range';
    range.className = 'bb-price-slider__range';
    range.min = rangeMin;
    range.max = rangeMax;
    range.step = rangeMax > 200 ? 1 : 0.5;
    range.value = currentMax;

    var labels = document.createElement('div');
    labels.className = 'bb-price-slider__labels';
    labels.innerHTML =
      '<span>' + formatWhole(rangeMin, symbol) + '</span><span>' + formatWhole(rangeMax, symbol) + '</span>';

    var bubble = document.createElement('span');
    bubble.className = 'bb-price-slider__bubble';

    wrap.appendChild(bubble);
    wrap.appendChild(range);
    wrap.appendChild(labels);
    priceRange.appendChild(wrap);

    function paint() {
      var pct = ((range.value - rangeMin) / (rangeMax - rangeMin)) * 100;
      // set on the wrapper (not the range input) so the sibling bubble
      // element can read the same custom property via inheritance
      wrap.style.setProperty('--bb-range-pct', pct + '%');
      bubble.textContent = formatWhole(range.value, symbol);
    }
    paint();

    range.addEventListener('input', paint);
    range.addEventListener('change', function () {
      maxInput.value = range.value;
      maxInput.dispatchEvent(new Event('change', { bubbles: true }));
      maxInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function hideRedundantPricePill() {
    // Dawn shows the active price range as a removable pill among the
    // other active-filter pills; now that the value lives on the slider
    // itself, hide just that one (it has no distinguishing class, so we
    // detect it by shape: "123 - 456" with no label/colon, unlike
    // "Category: Bracelets").
    document.querySelectorAll('.bb-shop-grid__aside .active-facets__button-inner').forEach(function (el) {
      var text = el.querySelector('.svg-wrapper')
        ? el.textContent.replace(el.querySelector('.svg-wrapper').textContent, '').trim()
        : el.textContent.trim();
      if (!text.includes(':') && /-/.test(text) && /\d/.test(text)) {
        var chip = el.closest('facet-remove') || el;
        chip.style.display = 'none';
      }
    });
  }

  function init() {
    document.querySelectorAll('.bb-shop-grid__aside price-range').forEach(enhance);
    hideRedundantPricePill();
  }

  document.addEventListener('DOMContentLoaded', function () {
    init();
    // Dawn re-renders the filters' innerHTML via AJAX after any change
    // (facets.js), which wipes our injected slider — watch for that and
    // rebuild it instead of relying on a specific event.
    var aside = document.querySelector('.bb-shop-grid__aside');
    if (aside && window.MutationObserver) {
      new MutationObserver(init).observe(aside, { childList: true, subtree: true });
    }
  });
})();

/* Filter drawer: [data-bb-filter-open] slides the vertical filter form in
   from the right. Delegated listeners, so it survives facets.js re-renders
   and theme-editor section reloads. Filters still apply live on change;
   the drawer's button only closes it. */
(function () {
  if (window.__bbFilterDrawer) return;
  window.__bbFilterDrawer = true;

  var lastTrigger = null;

  function openDrawer(drawer, trigger) {
    lastTrigger = trigger || null;
    drawer.classList.add('is-open');
    document.documentElement.classList.add('bb-filter-lock');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    var panel = drawer.querySelector('.bb-filter-drawer__panel');
    if (panel) window.setTimeout(function () { panel.focus({ preventScroll: true }); }, 50);
  }

  function closeDrawer(drawer) {
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    document.documentElement.classList.remove('bb-filter-lock');
    document.querySelectorAll('[data-bb-filter-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    lastTrigger = null;
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-bb-filter-open]');
    if (opener) {
      var drawer = document.getElementById(opener.getAttribute('aria-controls'));
      if (drawer) { e.preventDefault(); openDrawer(drawer, opener); }
      return;
    }
    var closer = e.target.closest('[data-bb-filter-close]');
    if (closer) {
      e.preventDefault();
      closeDrawer(closer.closest('[data-bb-filter-drawer]'));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer(document.querySelector('[data-bb-filter-drawer].is-open'));
  });
})();

/* Sparkles: little gold light glints that pop at random spots of the
   visible part of the collection page — mostly on product photos (like
   light catching the jewelry), sometimes on the banner or between cards.
   Enabled by data-bb-sparkles="low|medium|high" on .bb-shop-grid.
   Only transform/opacity animate; skipped while the tab is hidden, the
   filter drawer is open, or the visitor prefers reduced motion. */
(function () {
  if (window.__bbSparkles) return;
  window.__bbSparkles = true;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var PACE = { low: [1500, 2800], medium: [650, 1400], high: [320, 780] };
  var MAX_LIVE = 6;
  var live = 0;
  var running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function layerFor(host) {
    var layer = host.querySelector(':scope > .bb-sparkle-layer');
    if (!layer) {
      // a <span>, not a <div>: Dawn hides div:empty, which zeroes the layer's
      // rect between sparkles and puts new ones in the wrong place
      layer = document.createElement('span');
      layer.className = 'bb-sparkle-layer';
      layer.setAttribute('aria-hidden', 'true');
      host.appendChild(layer);
    }
    return layer;
  }

  function inView(r, vw, vh) {
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0;
  }

  function spark(host, clientX, clientY, size, delay) {
    if (live >= MAX_LIVE) return;
    var layer = layerFor(host);
    var lr = layer.getBoundingClientRect();
    var el = document.createElement('span');
    el.className = 'bb-spark';
    el.appendChild(document.createElement('i'));
    el.appendChild(document.createElement('i'));
    el.style.left = (clientX - lr.left) + 'px';
    el.style.top = (clientY - lr.top) + 'px';
    el.style.setProperty('--s', size.toFixed(1) + 'px');
    el.style.setProperty('--d', rand(1.5, 2.3).toFixed(2) + 's');
    el.style.setProperty('--r', Math.round(rand(0, 45)) + 'deg');
    if (delay) el.style.animationDelay = delay + 'ms';
    live++;
    var done = false;
    function remove() {
      if (done) return;
      done = true;
      live--;
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    el.addEventListener('animationend', remove);
    window.setTimeout(remove, 3000 + (delay || 0));
    layer.appendChild(el);
  }

  function tick() {
    var grid = document.querySelector('.bb-shop-grid[data-bb-sparkles]');
    if (!grid) { running = false; return; } // section removed / disabled: stop
    var pace = PACE[grid.getAttribute('data-bb-sparkles')] || PACE.medium;
    window.setTimeout(tick, rand(pace[0], pace[1]));

    if (document.hidden || document.documentElement.classList.contains('bb-filter-lock')) return;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var gridRect = grid.getBoundingClientRect();
    var banner = document.querySelector('.bb-shop-hero__banner');
    var bannerRect = banner ? banner.getBoundingClientRect() : null;

    var photos = Array.prototype.filter.call(grid.querySelectorAll('.bb-pcard__media'), function (m) {
      return inView(m.getBoundingClientRect(), vw, vh);
    });

    var host, x, y, size;
    var roll = Math.random();
    if (photos.length && roll < 0.65) {
      // on a product photo, upper/middle part where the jewelry usually is
      var r = pick(photos).getBoundingClientRect();
      host = grid;
      x = rand(r.left + r.width * 0.15, r.right - r.width * 0.15);
      y = rand(r.top + r.height * 0.12, r.top + r.height * 0.78);
      size = rand(56, 96);
    } else if (bannerRect && inView(bannerRect, vw, vh) && roll < 0.85) {
      host = banner;
      x = rand(bannerRect.left + bannerRect.width * 0.4, bannerRect.right - 20);
      y = rand(Math.max(bannerRect.top, 0) + 16, Math.min(bannerRect.bottom, vh) - 16);
      size = rand(50, 86);
    } else if (inView(gridRect, vw, vh)) {
      host = grid;
      x = rand(Math.max(gridRect.left, 0) + 10, Math.min(gridRect.right, vw) - 10);
      y = rand(Math.max(gridRect.top, 0) + 10, Math.min(gridRect.bottom, vh) - 10);
      size = rand(36, 62);
    } else {
      return;
    }
    if (y < 0 || y > vh) return;

    spark(host, x, y, size, 0);
    // now and then a tiny cluster, like light hitting several facets
    if (Math.random() < 0.3) {
      var extra = Math.random() < 0.5 ? 1 : 2;
      for (var k = 0; k < extra; k++) {
        spark(host, x + rand(-28, 28), y + rand(-24, 24), rand(24, 38), Math.round(rand(120, 380)));
      }
    }
  }

  function start() {
    if (running || !document.querySelector('.bb-shop-grid[data-bb-sparkles]')) return;
    running = true;
    window.setTimeout(tick, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // theme editor: section re-rendered or toggled back on
  document.addEventListener('shopify:section:load', start);
})();
