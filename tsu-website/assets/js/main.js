/* ==========================================================================
   The Sound of Universe Trust — Site behaviour
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.TSU_CONFIG || {};
  var LANGS = { ta: window.TSU_TA || {}, hi: window.TSU_HI || {}, kn: window.TSU_KN || {}, te: window.TSU_TE || {} };
  var EN_EXTRA = window.TSU_EN_EXTRA || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------------------------
     Language (English / தமிழ் / हिन्दी / ಕನ್ನಡ / తెలుగు) — switcher is in the footer
     English text is read from the HTML the first time, the others from i18n.js
     ------------------------------------------------------------------ */
  var EN = {};
  var lang = 'en';

  $$('[data-i18n]').forEach(function (el) {
    var k = el.getAttribute('data-i18n');
    if (!(k in EN)) EN[k] = el.textContent;
  });
  $$('[data-i18n-html]').forEach(function (el) {
    var k = el.getAttribute('data-i18n-html');
    if (!(k in EN)) EN[k] = el.innerHTML;
  });
  $$('[data-i18n-attr]').forEach(function (el) {
    el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
      var p = pair.split(':');
      if (!(p[1] in EN)) EN[p[1]] = el.getAttribute(p[0]);
    });
  });
  Object.keys(EN_EXTRA).forEach(function (k) { if (!(k in EN)) EN[k] = EN_EXTRA[k]; });

  function t(key) {
    if (LANGS[lang] && LANGS[lang][key] != null) return LANGS[lang][key];
    return EN[key] != null ? EN[key] : key;
  }

  function applyLang(next) {
    lang = LANGS[next] ? next : 'en';
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var p = pair.split(':');
        el.setAttribute(p[0], t(p[1]));
      });
    });
    $$('.lang__btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
    renderBank();
    store.set('tsu-lang', lang);
  }

  $$('.lang__btn').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.dataset.lang); });
  });

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3000);
  }

  function copyText(text, btn) {
    function done() {
      toast(t('toast.copied'));
      if (btn) {
        btn.classList.add('is-done');
        setTimeout(function () { btn.classList.remove('is-done'); }, 1500);
      }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy-from]');
    if (!btn) return;
    var src = document.getElementById(btn.getAttribute('data-copy-from'));
    if (src && src.textContent.trim() && src.textContent.trim() !== '—') copyText(src.textContent.trim(), btn);
  });

  /* ------------------------------------------------------------------
     Apply site settings from config.js
     ------------------------------------------------------------------ */
  (function applyConfig() {
    (CFG.phones || []).forEach(function (p, i) {
      $$('[data-cfg-tel="' + i + '"]').forEach(function (a) { a.href = 'tel:' + p.number; });
      $$('[data-cfg-display="' + i + '"]').forEach(function (s) { s.textContent = p.display; });
    });
    if (CFG.address) {
      EN['addr.full'] = CFG.address;
      $$('[data-cfg="address"]').forEach(function (el) { el.textContent = CFG.address; });
    }

    if (CFG.whatsapp) $('#fab-wa').href = 'https://wa.me/' + CFG.whatsapp;

    if (CFG.email) {
      var row = $('#email-row'), link = $('#email-link');
      link.href = 'mailto:' + CFG.email; link.textContent = CFG.email; row.hidden = false;
    }

    if (CFG.mapQuery) $('#map-frame').src = 'https://www.google.com/maps?q=' + encodeURIComponent(CFG.mapQuery) + '&output=embed';

    if (CFG.volunteerForm) $$('[data-volunteer]').forEach(function (a) { a.href = CFG.volunteerForm; });

    var soc = CFG.social || {}, html = '';
    var icons = { instagram: ['i-ig', 'Instagram'], youtube: ['i-yt', 'YouTube'], x: ['i-x-brand', 'X (Twitter)'], facebook: ['i-fb', 'Facebook'] };
    Object.keys(icons).forEach(function (k) {
      if (soc[k]) html += '<a href="' + encodeURI(soc[k]) + '" target="_blank" rel="noopener" aria-label="' + icons[k][1] + '"><svg class="ic" aria-hidden="true"><use href="#' + icons[k][0] + '"/></svg></a>';
    });
    $$('[data-social]').forEach(function (el) { el.innerHTML = html; el.hidden = !html; });

    var stats = CFG.stats || {};
    $$('[data-count]').forEach(function (el) {
      var v = stats[el.getAttribute('data-count')];
      if (v != null) { el.dataset.target = v; el.textContent = el.hasAttribute('data-nocount') ? String(v) : Number(v).toLocaleString('en-IN'); }
    });

    // UPI
    var upi = CFG.upi || {};
    if (upi.id) {
      $('#upi-id').textContent = upi.id;
      var open = $('#upi-open');
      open.hidden = false;
      open.href = 'upi://pay?pa=' + encodeURIComponent(upi.id) + '&pn=' + encodeURIComponent(upi.payeeName || '') + '&cu=INR&tn=' + encodeURIComponent('Donation');
    } else {
      $('#upi-row').hidden = true;
    }
    if (upi.qrImage) {
      var qr = $('#upi-qr-img');
      qr.onload = function () { $('#upi-qr').classList.add('has-qr'); };
      qr.src = upi.qrImage;
    }
  })();

  function renderBank() {
    var bank = CFG.bank || {}, list = $('#bank-list');
    if (!list) return;
    var fields = [['accountName', 'bank.name'], ['accountNumber', 'bank.number'], ['ifsc', 'bank.ifsc'], ['bankName', 'bank.bank'], ['branch', 'bank.branch'], ['micr', 'bank.micr']];
    var hasCore = bank.accountNumber && bank.ifsc;
    $('#bank-soon').hidden = !!hasCore;
    if (!hasCore) { list.innerHTML = ''; return; }
    list.innerHTML = fields.filter(function (f) { return bank[f[0]]; }).map(function (f) {
      var id = 'bank-' + f[0];
      return '<div class="bankrow"><dt>' + t(f[1]) + '</dt><dd><strong id="' + id + '"></strong>' +
        '<button type="button" class="copybtn" data-copy-from="' + id + '" aria-label="Copy ' + EN[f[1]] + '"><svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg></button></dd></div>';
    }).join('');
    fields.forEach(function (f) { var el = document.getElementById('bank-' + f[0]); if (el) el.textContent = bank[f[0]]; });
  }

  /* ------------------------------------------------------------------
     Navbar: scrolled state, mobile menu, active link
     ------------------------------------------------------------------ */
  var nav = $('.nav'), menu = $('#nav-menu'), toggle = $('.nav__toggle'), topBtn = $('.fab--top');

  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 10);
    topBtn.classList.toggle('is-visible', y > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    if (open) menu.style.setProperty('--nav-top', nav.getBoundingClientRect().bottom + 'px');
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('use').setAttribute('href', open ? '#i-x' : '#i-menu');
  }
  toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (menu.classList.contains('is-open') && !e.target.closest('.nav')) setMenu(false);
  });
  window.addEventListener('resize', function () { if (getComputedStyle(toggle).display === 'none') setMenu(false); });

  var links = $$('.nav__menu a[href^="#"]:not(.btn)');
  if ('IntersectionObserver' in window) {
    var sectionIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id === 'donate' ? 'donate' : en.target.id;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { sectionIO.observe(s); });
  }

  /* ------------------------------------------------------------------
     Scroll reveal + counters
     ------------------------------------------------------------------ */
  function countUp(el) {
    var target = Number(el.dataset.target || el.textContent.replace(/\D/g, ''));
    if (reduceMotion || el.hasAttribute('data-nocount') || !target) return;
    var start = performance.now(), dur = 1600;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }

  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        $$('[data-count]', en.target).forEach(countUp);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('[data-reveal]').forEach(function (el) { io.observe(el); });
  } else {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ------------------------------------------------------------------
     Gallery lightbox
     ------------------------------------------------------------------ */
  var lb = $('#lightbox'), lbImg = $('#lb-img'), lbCap = $('#lb-cap');
  var items = $$('.gal__btn'), idx = 0, opener = null;

  // "View more photos" toggle
  var moreBtn = $('#gal-more-btn'), moreItems = $$('[data-more]');
  if (!moreItems.length) moreBtn.parentNode.hidden = true;
  moreBtn.addEventListener('click', function () {
    var open = moreBtn.getAttribute('aria-expanded') !== 'true';
    moreItems.forEach(function (li) {
      li.hidden = !open;
      if (open) requestAnimationFrame(function () { li.classList.add('is-visible'); });
    });
    moreBtn.setAttribute('aria-expanded', String(open));
    var label = $('span', moreBtn);
    label.setAttribute('data-i18n', open ? 'gal.less' : 'gal.more');
    label.textContent = t(open ? 'gal.less' : 'gal.more');
    if (open) $('.gal__btn', moreItems[0]).focus({ preventScroll: true });
    else document.getElementById('gallery').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  function show(i) {
    idx = (i + items.length) % items.length;
    var b = items[idx], img = $('img', b);
    lbImg.src = b.dataset.full || img.src;
    lbImg.alt = img.alt;
    lbCap.textContent = $('.gal__cap span', b).textContent + '  ·  ' + (idx + 1) + ' / ' + items.length;
  }
  items.forEach(function (b, i) {
    b.addEventListener('click', function () {
      opener = b; show(i);
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
    });
  });
  function closeLb() { if (lb.open) lb.close(); }
  lb.addEventListener('close', function () { if (opener) opener.focus(); });
  $('.lightbox__close').addEventListener('click', closeLb);
  $('.lightbox__prev').addEventListener('click', function () { show(idx - 1); });
  $('.lightbox__next').addEventListener('click', function () { show(idx + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.tagName === 'FIGURE') closeLb(); });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });

  /* ------------------------------------------------------------------
     Activity photos — clicking a card in "Our Activities" shows its photos
     (the photo list for each card is in config.js → activityPhotos)
     ------------------------------------------------------------------ */
  var av = $('#actview'), avGrid = $('#actview-grid'), avOpener = null;
  var actPhotos = CFG.activityPhotos || {};

  $$('.act[data-act]').forEach(function (card) {
    var photos = actPhotos[card.dataset.act] || [];
    var btn = $('.act__more', card);
    if (!photos.length) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      avOpener = btn;
      var title = $('h3', card).textContent;
      $('#actview-title').textContent = title;
      $('#actview-desc').textContent = $('p', card).textContent;
      avGrid.innerHTML = '';
      photos.forEach(function (src, i) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = title + ' – ' + (i + 1);
        img.loading = 'lazy';
        avGrid.appendChild(img);
      });
      if (typeof av.showModal === 'function') av.showModal(); else av.setAttribute('open', '');
    });
  });
  $('.actview__close').addEventListener('click', function () { av.close(); });
  av.addEventListener('click', function (e) { if (e.target === av) av.close(); });
  av.addEventListener('close', function () { if (avOpener) avOpener.focus(); });

  /* ------------------------------------------------------------------
     Donation tabs
     ------------------------------------------------------------------ */
  var tabs = $$('[role="tab"]');
  function selectTab(tab, focus) {
    tabs.forEach(function (t2) {
      var on = t2 === tab;
      t2.setAttribute('aria-selected', String(on));
      t2.tabIndex = on ? 0 : -1;
      document.getElementById(t2.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') n = tabs[0];
      if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    });
  });

  /* ------------------------------------------------------------------
     Donation amount + Razorpay
     ------------------------------------------------------------------ */
  var custom = $('#amt-custom'), amtLabel = $('#rzp-amt'), rzpBtn = $('#rzp-btn');
  var rzp = CFG.razorpay || {};
  var rzpReady = !!(rzp.keyId || rzp.paymentLink);

  function currentAmount() {
    var c = parseInt(custom.value, 10);
    if (custom.value !== '') return c;
    var r = $('input[name="amt"]:checked');
    return r ? parseInt(r.value, 10) : 0;
  }
  function updateAmount() {
    var a = currentAmount();
    amtLabel.textContent = a > 0 ? '₹' + a.toLocaleString('en-IN') : '';
  }
  $$('input[name="amt"]').forEach(function (r) {
    r.addEventListener('change', function () { custom.value = ''; updateAmount(); });
  });
  custom.addEventListener('input', function () {
    if (custom.value !== '') $$('input[name="amt"]').forEach(function (r) { r.checked = false; });
    updateAmount();
  });

  if (!rzpReady) {
    rzpBtn.setAttribute('aria-disabled', 'true');
    $('#rzp-note').hidden = false;
  } else if (!rzp.keyId) {
    // A Payment Page sets its own amount, so hide the amount label on the button.
    amtLabel.hidden = true;
  }

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  rzpBtn.addEventListener('click', function () {
    if (!rzpReady) { toast(t('don.rzp.soon')); return; }
    if (!rzp.keyId) { window.open(rzp.paymentLink, '_blank', 'noopener'); return; }
    var amount = currentAmount();
    if (!(amount >= 10)) { toast(t('toast.amount')); custom.focus(); return; }
    rzpBtn.disabled = true;
    loadScript('https://checkout.razorpay.com/v1/checkout.js').then(function () {
      rzpBtn.disabled = false;
      new window.Razorpay({
        key: rzp.keyId,
        amount: amount * 100,
        currency: 'INR',
        name: 'The Sound of Universe Trust',
        description: 'Donation',
        image: new URL('assets/img/logo.png', location.href).href,
        theme: { color: '#CE2A7A' },
        handler: function () { toast(t('msg.thanks')); }
      }).open();
    }).catch(function () {
      rzpBtn.disabled = false;
      toast('Could not load payment window. Please check your connection and try again.');
    });
  });

  /* ------------------------------------------------------------------
     Pre-select interest when a "Volunteer / Partner" link is used
     ------------------------------------------------------------------ */
  $$('[data-interest]').forEach(function (a) {
    a.addEventListener('click', function () { $('#f-interest').value = a.dataset.interest; });
  });

  /* ------------------------------------------------------------------
     Share
     ------------------------------------------------------------------ */
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var data = { title: document.title, text: 'The Sound of Universe Trust – பிரபஞ்சத்தின் ஒலி அறக்கட்டளை', url: location.href.split('#')[0] };
      if (navigator.share) navigator.share(data).catch(function () {});
      else { copyText(data.url); toast(t('toast.linkcopied')); }
    });
  });

  /* ------------------------------------------------------------------
     Contact form → WhatsApp
     ------------------------------------------------------------------ */
  var form = $('#cform');
  function setErr(input, errId, msgKey) {
    var err = document.getElementById(errId);
    if (msgKey) { input.setAttribute('aria-invalid', 'true'); err.textContent = t(msgKey); }
    else { input.removeAttribute('aria-invalid'); err.textContent = ''; }
    return !msgKey;
  }
  function validName() { var el = $('#f-name'); return setErr(el, 'e-name', el.value.trim().length < 2 ? 'err.name' : null); }
  function validPhone() {
    var el = $('#f-phone'), d = el.value.replace(/\D/g, '');
    var ok = /^[6-9]\d{9}$/.test(d) || /^91[6-9]\d{9}$/.test(d) || /^0[6-9]\d{9}$/.test(d);
    return setErr(el, 'e-phone', ok ? null : 'err.phone');
  }
  function validMsg() { var el = $('#f-msg'); return setErr(el, 'e-msg', el.value.trim().length < 3 ? 'err.msg' : null); }
  $('#f-name').addEventListener('blur', validName);
  $('#f-phone').addEventListener('blur', validPhone);
  $('#f-msg').addEventListener('blur', validMsg);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = [validName(), validPhone(), validMsg()];
    if (ok.indexOf(false) !== -1) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }
    var sel = $('#f-interest');
    var lines = [
      'Hello, The Sound of Universe Trust 🙏',
      '',
      'Name: ' + $('#f-name').value.trim(),
      'Phone: ' + $('#f-phone').value.trim()
    ];
    if ($('#f-email').value.trim()) lines.push('Email: ' + $('#f-email').value.trim());
    lines.push('Interest: ' + sel.options[sel.selectedIndex].text);
    lines.push('', $('#f-msg').value.trim());
    window.open('https://wa.me/' + (CFG.whatsapp || '919080625284') + '?text=' + encodeURIComponent(lines.join('\n')), '_blank', 'noopener');
  });

  /* ------------------------------------------------------------------
     Init language last (so bank labels render in the right language)
     ------------------------------------------------------------------ */
  var saved = store.get('tsu-lang');
  applyLang(saved);
  updateAmount();

  /* ------------------------------------------------------------------
     Load activity data from API → update icons + photos on public site
     ------------------------------------------------------------------ */
  (function loadActivitiesFromAPI() {
    fetch('/api/content?type=activities')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !res.data) return;
        var apiData = res.data;

        apiData.forEach(function (act) {
          var key = act.key || act.id;

          // 1. Swap icon image if one is uploaded via admin
          if (act.iconImage) {
            var icEl = document.getElementById('act-ic-' + key);
            if (icEl) {
              var img = document.createElement('img');
              img.src     = act.iconImage;
              img.alt     = act.title || '';
              img.loading = 'lazy';
              icEl.innerHTML = '';
              icEl.appendChild(img);
            }
          }

          // 2. Merge API photos into CFG so "View photos" always uses latest
          if (act.photos && act.photos.length) {
            if (!CFG.activityPhotos) CFG.activityPhotos = {};
            CFG.activityPhotos[key] = act.photos;
          }
        });

        // Re-bind "View photos" buttons with updated photo data
        var actPhotos = CFG.activityPhotos || {};
        $$('.act[data-act]').forEach(function (card) {
          var photos = actPhotos[card.dataset.act] || [];
          var btn    = $('.act__more', card);
          if (!btn) return;
          // Clone to remove old listener
          var newBtn = btn.cloneNode(true);
          btn.parentNode.replaceChild(newBtn, btn);
          if (!photos.length) { newBtn.hidden = true; return; }
          newBtn.hidden = false;
          newBtn.addEventListener('click', function () {
            var av     = $('#actview');
            var avGrid = $('#actview-grid');
            if (!av || !avGrid) return;
            var title = $('h3', card).textContent;
            $('#actview-title').textContent = title;
            $('#actview-desc').textContent  = $('p', card).textContent;
            avGrid.innerHTML = '';
            photos.forEach(function (src, i) {
              var img     = document.createElement('img');
              img.src     = src;
              img.alt     = title + ' – ' + (i + 1);
              img.loading = 'lazy';
              avGrid.appendChild(img);
            });
            if (typeof av.showModal === 'function') av.showModal();
            else av.setAttribute('open', '');
          });
        });
      })
      .catch(function () { /* silently fall back to config.js */ });
  })();

  /* ==================================================================
     OWNER LOGIN  (3-dot menu  →  modal  →  email+pw  →  OTP  →  admin)
     ================================================================== */
  (function ownerLogin() {
    var SESSION_KEY = 'tsu-session';

    /* ---- 3-dot menu toggle ---- */
    var menuBtn      = $('#owner-menu-btn');
    var dropdown     = $('#owner-dropdown');
    var loginTrigger = $('#owner-login-trigger');

    if (!menuBtn || !dropdown) return; // guard

    function openDropdown() {
      dropdown.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
    }
    function closeDropdown() {
      dropdown.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
    }

    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.hidden ? openDropdown() : closeDropdown();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#owner-menu')) closeDropdown();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDropdown();
    });

    /* ---- Open login modal ---- */
    var modal      = $('#owner-modal');
    var modalClose = $('#owner-modal-close');

    if (!modal) return;

    loginTrigger && loginTrigger.addEventListener('click', function () {
      closeDropdown();
      clearLoginForm();
      showStep(1);
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });

    modalClose && modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.open) closeModal();
    });

    function closeModal() {
      if (modal.close) modal.close(); else modal.removeAttribute('open');
    }
    function showStep(n) {
      $('#owner-step-1').hidden = (n !== 1);
      $('#owner-step-2').hidden = (n !== 2);
    }
    function clearLoginForm() {
      var f1 = $('#owner-login-form'), f2 = $('#owner-otp-form');
      if (f1) f1.reset();
      if (f2) f2.reset();
      ['e-owner-email','e-owner-password','e-owner-login','e-owner-otp','e-owner-otp-global']
        .forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = ''; });
    }

    /* ---- Step 1: email + password ---- */
    var loginForm = $('#owner-login-form');
    var otpToken  = '';  // opaque token from server

    loginForm && loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var email    = $('#owner-email').value.trim();
      var password = $('#owner-password').value;
      var errEl    = $('#e-owner-login');
      var btn      = $('#owner-login-btn');

      // Client-side validation
      var ok = true;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('e-owner-email').textContent = 'Enter a valid email';
        ok = false;
      } else { document.getElementById('e-owner-email').textContent = ''; }

      if (!password) {
        document.getElementById('e-owner-password').textContent = 'Password is required';
        ok = false;
      } else { document.getElementById('e-owner-password').textContent = ''; }

      if (!ok) return;

      btn.disabled    = true;
      btn.textContent = 'Verifying…';
      errEl.textContent = '';

      try {
        var res = await fetch('/api/auth', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        otpToken = data.token;
        var hint = $('#owner-otp-hint');
        if (hint) hint.textContent = 'We\'ve sent a 6-digit code to ' + (data.maskedEmail || email);
        showStep(2);
        var otpInput = $('#owner-otp');
        if (otpInput) setTimeout(function () { otpInput.focus(); }, 80);
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Continue';
      }
    });

    /* ---- Step 2: OTP ---- */
    var otpForm = $('#owner-otp-form');
    var otpBack = $('#owner-otp-back');

    otpBack && otpBack.addEventListener('click', function () { showStep(1); });

    otpForm && otpForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var otp    = ($('#owner-otp').value || '').replace(/\s/g, '');
      var errEl  = $('#e-owner-otp-global');
      var btn    = $('#owner-otp-btn');

      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        document.getElementById('e-owner-otp').textContent = 'Enter the 6-digit code';
        return;
      }
      document.getElementById('e-owner-otp').textContent = '';
      errEl.textContent = '';

      btn.disabled    = true;
      btn.textContent = 'Verifying…';

      try {
        var res = await fetch('/api/verify-otp', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token: otpToken, otp: otp }),
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'OTP verification failed');

        // Store session and redirect
        sessionStorage.setItem(SESSION_KEY, data.sessionToken);
        closeModal();
        location.href = 'admin.html';
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled    = false;
        btn.innerHTML   = '<svg class="ic" aria-hidden="true"><use href="#i-shield"/></svg> Verify &amp; Enter Dashboard';
      }
    });

    /* ---- Password show/hide toggle ---- */
    document.addEventListener('click', function (e) {
      var toggle = e.target.closest('[data-pw-toggle]');
      if (!toggle) return;
      var input = document.getElementById(toggle.dataset.pwToggle);
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  })();
  /* ================================================================== end owner login */

})();
