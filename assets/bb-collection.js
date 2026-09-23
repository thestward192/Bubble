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
