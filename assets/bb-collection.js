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
