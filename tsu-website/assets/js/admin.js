/* ==========================================================================
   TSU — Admin Dashboard  (admin.js)
   Requires: session token in sessionStorage under 'tsu-session'
   API endpoints: /api/content, /api/cloudinary-sign
   ========================================================================== */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     Auth guard — redirect to home if no valid session token
     ----------------------------------------------------------------------- */
  var SESSION_KEY = 'tsu-session';
  var token = sessionStorage.getItem(SESSION_KEY);
  if (!token) {
    location.href = 'index.html';
    return;
  }

  /* -----------------------------------------------------------------------
     Tiny helpers
     ----------------------------------------------------------------------- */
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.from((c || document).querySelectorAll(s)); };

  var toastEl = $('#admin-toast'), toastTimer;
  function toast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className   = 'toast is-on' + (type ? ' toast--' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3200);
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  }

  async function apiFetch(url, opts) {
    try {
      var r = await fetch(url, opts);
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      return data;
    } catch (e) {
      throw e;
    }
  }

  /* -----------------------------------------------------------------------
     State
     ----------------------------------------------------------------------- */
  var activities = [];   // array of activity objects
  var services   = [];   // array of service objects

  // Photos staged for upload (activity editor)
  var stagedActivityPhotos  = [];   // [{ file, previewUrl }]  — new files
  var existingActivityPhotos = [];  // [url]                   — already saved
  var stagedActivityIcon    = null; // { file, previewUrl }    — new icon
  var existingActivityIcon  = '';   // url                     — saved icon
  var stagedServicePhoto    = null; // { file, previewUrl }
  var existingServicePhoto  = '';   // url

  var editingActivityId = null;
  var editingServiceId  = null;

  /* -----------------------------------------------------------------------
     Sidebar navigation
     ----------------------------------------------------------------------- */
  $$('.admin-sidenav__item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.admin-sidenav__item').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var panel = btn.dataset.panel;
      $$('.admin-panel').forEach(function (p) { p.classList.remove('is-active'); });
      $('#panel-' + panel).classList.add('is-active');
    });
  });

  /* -----------------------------------------------------------------------
     Logout
     ----------------------------------------------------------------------- */
  $('#admin-logout').addEventListener('click', function () {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = 'index.html';
  });

  /* -----------------------------------------------------------------------
     Load data
     ----------------------------------------------------------------------- */
  async function loadActivities() {
    var list = $('#activities-list');
    list.innerHTML = '<div class="admin-loading" id="activities-loading"><div class="spinner"></div><p>Loading activities…</p></div>';
    try {
      var res  = await apiFetch('/api/content?type=activities');
      activities = res.data || [];
      renderActivities();
    } catch (e) {
      list.innerHTML = '<div class="admin-empty"><p>Failed to load: ' + e.message + '</p></div>';
    }
  }

  async function loadServices() {
    var list = $('#services-list');
    list.innerHTML = '<div class="admin-loading"><div class="spinner"></div><p>Loading services…</p></div>';
    try {
      var res = await apiFetch('/api/content?type=services');
      services = res.data || [];
      renderServices();
    } catch (e) {
      list.innerHTML = '<div class="admin-empty"><p>Failed to load: ' + e.message + '</p></div>';
    }
  }

  /* -----------------------------------------------------------------------
     Render: Activities
     ----------------------------------------------------------------------- */
  function renderActivities() {
    var list = $('#activities-list');
    if (!activities.length) {
      list.innerHTML = '<div class="admin-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/></svg><p>No activities yet. Click "Add Activity" to create one.</p></div>';
      return;
    }

    // icon map matching the public site
    var iconMap = {
      education:   '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
      food:        '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
      medical:     '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
      environment: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
      youth:       '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    };
    var colorMap = {
      'var(--purple)': '#61367F', 'var(--magenta)': '#CE2A7A',
      'var(--sky)': '#0A7FC8',   'var(--green)': '#089C6C', 'var(--teal)': '#0E6B63',
    };

    list.innerHTML = activities.map(function (act) {
      var photos   = act.photos || [];
      var iconPath = iconMap[act.key] || iconMap[act.id] || iconMap['education'];
      var hex      = colorMap[act.color] || '#61367F';
      var bgHex    = hex + '1a'; // 10% opacity bg

      return '<div class="admin-card" data-id="' + esc(act.id) + '">' +
        // Icon header — show uploaded image if set, otherwise coloured SVG icon
        '<div class="admin-card__icon-header" style="background:' + bgHex + '">' +
          (act.iconImage
            ? '<img src="' + esc(act.iconImage) + '" alt="" class="admin-card__act-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'">' +
              '<div class="admin-card__act-icon" style="background:' + hex + ';display:none"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg></div>'
            : '<div class="admin-card__act-icon" style="background:' + hex + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + iconPath + '</svg>' +
              '</div>'
          ) +
        '</div>' +
        '<div class="admin-card__body">' +
          '<span class="admin-card__key">' + esc(act.key || act.id) + '</span>' +
          '<p class="admin-card__title">' + esc(act.title) + '</p>' +
          '<p class="admin-card__desc">' + esc(act.description) + '</p>' +
          '<p class="admin-card__photos">🖼 ' + photos.length + ' photo' + (photos.length !== 1 ? 's' : '') + '</p>' +
        '</div>' +
        '<div class="admin-card__actions">' +
          '<button type="button" class="admin-card__btn admin-card__btn--edit" data-action="edit-activity" data-id="' + esc(act.id) + '">✏ Edit / Manage Photos</button>' +
          '<button type="button" class="admin-card__btn admin-card__btn--delete" data-action="delete-activity" data-id="' + esc(act.id) + '">🗑 Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* -----------------------------------------------------------------------
     Render: Services
     ----------------------------------------------------------------------- */
  function renderServices() {
    var list = $('#services-list');
    if (!services.length) {
      list.innerHTML = '<div class="admin-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/></svg><p>No services yet. Click "Add Service" to create one.</p></div>';
      return;
    }
    list.innerHTML = services.map(function (svc) {
      var tagClass = { upcoming: 'upcoming', done: 'done', ongoing: 'ongoing' }[svc.status] || 'upcoming';
      var tagLabel = { upcoming: 'Upcoming', done: 'Completed', ongoing: 'Ongoing' }[svc.status] || 'Upcoming';
      return '<div class="admin-card" data-id="' + esc(svc.id) + '">' +
        (svc.cover
          ? '<img class="admin-card__cover" src="' + esc(svc.cover) + '" alt="" loading="lazy">'
          : '<div class="admin-card__cover-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 14h2a2 2 0 1 0 0-4h-3"/></svg></div>') +
        '<div class="admin-card__body">' +
          '<span class="admin-card__tag admin-card__tag--' + tagClass + '">' + tagLabel + '</span>' +
          '<p class="admin-card__title">' + esc(svc.title) + '</p>' +
          '<p class="admin-card__desc">' + esc(svc.description) + '</p>' +
          (svc.location ? '<p class="admin-card__photos">📍 ' + esc(svc.location) + '</p>' : '') +
        '</div>' +
        '<div class="admin-card__actions">' +
          '<button type="button" class="admin-card__btn admin-card__btn--edit" data-action="edit-service" data-id="' + esc(svc.id) + '">✏ Edit</button>' +
          '<button type="button" class="admin-card__btn admin-card__btn--delete" data-action="delete-service" data-id="' + esc(svc.id) + '">🗑 Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* -----------------------------------------------------------------------
     Event delegation for card buttons
     ----------------------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var id     = btn.dataset.id;
    if (action === 'edit-activity')   openActivityEditor(id);
    if (action === 'delete-activity') confirmDelete('activity', id);
    if (action === 'edit-service')    openServiceEditor(id);
    if (action === 'delete-service')  confirmDelete('service', id);
  });

  /* -----------------------------------------------------------------------
     Activity editor
     ----------------------------------------------------------------------- */
  var actModal  = $('#activity-modal');
  var actForm   = $('#activity-form');

  $('#add-activity-btn').addEventListener('click', function () { openActivityEditor(null); });
  $('#activity-modal-close, #activity-cancel-btn').forEach
    ? $$('#activity-modal-close, #activity-cancel-btn').forEach(function (b) { b.addEventListener('click', closeActivityModal); })
    : ['#activity-modal-close', '#activity-cancel-btn'].forEach(function (sel) {
        var el = $(sel); if (el) el.addEventListener('click', closeActivityModal);
      });

  function openActivityEditor(id) {
    editingActivityId = id;
    stagedActivityPhotos   = [];
    existingActivityPhotos = [];
    stagedActivityIcon     = null;
    existingActivityIcon   = '';

    if (id) {
      var act = activities.find(function (a) { return a.id === id; });
      if (!act) return;
      $('#activity-id').value    = act.id;
      $('#activity-key').value   = act.key || act.id;
      $('#activity-title').value = act.title || '';
      $('#activity-desc').value  = act.description || '';
      $('#activity-color').value = act.color || 'var(--purple)';
      existingActivityPhotos     = (act.photos || []).slice();
      existingActivityIcon       = act.iconImage || '';
      $('#activity-modal-title').textContent = 'Edit Activity – ' + (act.title || act.id);
    } else {
      actForm.reset();
      $('#activity-id').value = '';
      $('#activity-modal-title').textContent = 'Add Activity';
    }

    renderActivityPhotos();
    renderActivityIcon();
    clearErrors(actForm);
    if (typeof actModal.showModal === 'function') actModal.showModal(); else actModal.setAttribute('open', '');
    setTimeout(function () { actModal.scrollTop = 0; }, 50);
  }

  function closeActivityModal() {
    actModal.close ? actModal.close() : actModal.removeAttribute('open');
    stagedActivityPhotos = [];
    stagedActivityIcon   = null;
  }

  actModal.addEventListener('click', function (e) { if (e.target === actModal) closeActivityModal(); });

  /* Icon preview for activity */
  function renderActivityIcon() {
    var wrap = $('#activity-icon-preview');
    if (!wrap) return;
    wrap.innerHTML = '';
    var url = (stagedActivityIcon ? stagedActivityIcon.previewUrl : existingActivityIcon) || '';
    if (url) {
      var thumb = makeThumb(url, function () {
        if (stagedActivityIcon) { URL.revokeObjectURL(stagedActivityIcon.previewUrl); stagedActivityIcon = null; }
        else existingActivityIcon = '';
        renderActivityIcon();
      });
      thumb.style.width  = '80px';
      thumb.style.height = '80px';
      thumb.style.borderRadius = '16px';
      wrap.appendChild(thumb);
      var note = document.createElement('p');
      note.style.cssText = 'font-size:.8rem;color:var(--teal);font-weight:600;margin:6px 0 0;';
      note.textContent = '✓ Icon set — will show on the public activity card';
      wrap.appendChild(note);
    }
  }

  var iconUploadInput = $('#activity-icon-upload');
  if (iconUploadInput) {
    iconUploadInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (stagedActivityIcon) URL.revokeObjectURL(stagedActivityIcon.previewUrl);
      stagedActivityIcon = { file: file, previewUrl: URL.createObjectURL(file) };
      e.target.value = '';
      renderActivityIcon();
    });
  }

  /* Photo preview for activity */
  function renderActivityPhotos() {
    var grid = $('#activity-photos-preview');
    grid.innerHTML = '';

    var total = existingActivityPhotos.length + stagedActivityPhotos.length;

    // Count badge
    var badge = document.createElement('p');
    badge.style.cssText = 'width:100%;font-size:.85rem;color:var(--text-muted);margin:0 0 8px;font-weight:600;';
    badge.textContent = total + ' photo' + (total !== 1 ? 's' : '') + ' total' +
      (stagedActivityPhotos.length ? ' (' + stagedActivityPhotos.length + ' pending upload)' : '');
    if (total > 0) grid.appendChild(badge);

    // Existing saved photos
    existingActivityPhotos.forEach(function (url, i) {
      var thumb = makeThumb(url, function () {
        existingActivityPhotos.splice(i, 1);
        renderActivityPhotos();
      });
      grid.appendChild(thumb);
    });

    // New staged (not yet uploaded)
    stagedActivityPhotos.forEach(function (item, i) {
      var thumb = makeThumb(item.previewUrl, function () {
        URL.revokeObjectURL(item.previewUrl);
        stagedActivityPhotos.splice(i, 1);
        renderActivityPhotos();
      });
      // Mark staged photos with a visual indicator
      thumb.style.outline = '2px dashed var(--sky)';
      thumb.title = 'Pending upload: ' + item.file.name;
      grid.appendChild(thumb);
    });
  }

  $('#activity-photo-upload').addEventListener('change', function (e) {
    var files = Array.from(e.target.files || []);
    files.forEach(function (f) {
      stagedActivityPhotos.push({ file: f, previewUrl: URL.createObjectURL(f) });
    });
    e.target.value = '';
    renderActivityPhotos();
  });

  actForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateActivityForm()) return;

    var btn = $('#activity-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      // 1. Upload icon image to Cloudinary (if staged)
      var iconUrl = existingActivityIcon;
      if (stagedActivityIcon) {
        var iconSign = await apiFetch('/api/cloudinary-sign', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ folder: 'tsu-activity-icons' }),
        });
        showProgress('activity-icon', 0);
        iconUrl = await uploadToCloudinary(stagedActivityIcon.file, iconSign, 'activity-icon');
        updateProgress('activity-icon', 100);
        hideProgress('activity-icon');
      }

      // 2. Upload staged gallery photos to Cloudinary
      var uploadedUrls = [];
      if (stagedActivityPhotos.length) {
        var sign = await apiFetch('/api/cloudinary-sign', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ folder: 'tsu-activities' }),
        });

        var total = stagedActivityPhotos.length, done = 0;
        showProgress('activity', 0);

        for (var i = 0; i < stagedActivityPhotos.length; i++) {
          var url = await uploadToCloudinary(stagedActivityPhotos[i].file, sign, 'activity');
          uploadedUrls.push(url);
          done++;
          updateProgress('activity', Math.round((done / total) * 100));
        }
        hideProgress('activity');
      }

      var allPhotos = existingActivityPhotos.concat(uploadedUrls);

      var item = {
        id:          $('#activity-id').value || $('#activity-key').value || ('act-' + Date.now()),
        key:         $('#activity-key').value.trim(),
        title:       $('#activity-title').value.trim(),
        description: $('#activity-desc').value.trim(),
        color:       $('#activity-color').value,
        iconImage:   iconUrl,
        photos:      allPhotos,
      };

      await apiFetch('/api/content', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'activities', item }),
      });

      toast('Activity saved ✓', 'success');
      closeActivityModal();
      loadActivities();
    } catch (err) {
      toast('Save failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Save Activity';
    }
  });

  function validateActivityForm() {
    var ok = true;
    if (!$('#activity-key').value.trim()) { showErr('e-activity-key', 'Key is required'); ok = false; }
    else clearErr('e-activity-key');
    if (!$('#activity-title').value.trim()) { showErr('e-activity-title', 'Title is required'); ok = false; }
    else clearErr('e-activity-title');
    if (!$('#activity-desc').value.trim()) { showErr('e-activity-desc', 'Description is required'); ok = false; }
    else clearErr('e-activity-desc');
    return ok;
  }

  /* -----------------------------------------------------------------------
     Service editor
     ----------------------------------------------------------------------- */
  var svcModal = $('#service-modal');
  var svcForm  = $('#service-form');

  $('#add-service-btn').addEventListener('click', function () { openServiceEditor(null); });
  ['#service-modal-close', '#service-cancel-btn'].forEach(function (sel) {
    var el = $(sel); if (el) el.addEventListener('click', closeServiceModal);
  });

  function openServiceEditor(id) {
    editingServiceId    = id;
    stagedServicePhoto  = null;
    existingServicePhoto = '';

    if (id) {
      var svc = services.find(function (s) { return s.id === id; });
      if (!svc) return;
      $('#service-id').value           = svc.id;
      $('#service-title').value        = svc.title        || '';
      $('#service-status').value       = svc.status       || 'upcoming';
      $('#service-location').value     = svc.location     || '';
      $('#service-desc').value         = svc.description  || '';
      $('#service-link').value         = svc.link         || '';
      $('#service-link-label').value   = svc.linkLabel    || '';
      existingServicePhoto             = svc.cover        || '';
      $('#service-modal-title').textContent = 'Edit Service';
    } else {
      svcForm.reset();
      $('#service-id').value = '';
      $('#service-modal-title').textContent = 'Add Service';
    }

    renderServicePhoto();
    clearErrors(svcForm);
    if (typeof svcModal.showModal === 'function') svcModal.showModal(); else svcModal.setAttribute('open', '');
  }

  function closeServiceModal() {
    svcModal.close ? svcModal.close() : svcModal.removeAttribute('open');
    stagedServicePhoto = null;
  }

  svcModal.addEventListener('click', function (e) { if (e.target === svcModal) closeServiceModal(); });

  function renderServicePhoto() {
    var grid = $('#service-photo-preview');
    grid.innerHTML = '';
    var url = (stagedServicePhoto ? stagedServicePhoto.previewUrl : existingServicePhoto) || '';
    if (url) {
      var thumb = makeThumb(url, function () {
        if (stagedServicePhoto) { URL.revokeObjectURL(stagedServicePhoto.previewUrl); stagedServicePhoto = null; }
        else existingServicePhoto = '';
        renderServicePhoto();
      });
      grid.appendChild(thumb);
    }
  }

  $('#service-photo-upload').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (stagedServicePhoto) URL.revokeObjectURL(stagedServicePhoto.previewUrl);
    stagedServicePhoto = { file: file, previewUrl: URL.createObjectURL(file) };
    e.target.value = '';
    renderServicePhoto();
  });

  svcForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validateServiceForm()) return;

    var btn = $('#service-save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      var coverUrl = existingServicePhoto;

      if (stagedServicePhoto) {
        var sign = await apiFetch('/api/cloudinary-sign', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ folder: 'tsu-services' }),
        });
        showProgress('service', 0);
        coverUrl = await uploadToCloudinary(stagedServicePhoto.file, sign, 'service');
        updateProgress('service', 100);
        hideProgress('service');
      }

      var item = {
        id:          $('#service-id').value || ('svc-' + Date.now()),
        title:       $('#service-title').value.trim(),
        status:      $('#service-status').value,
        location:    $('#service-location').value.trim(),
        description: $('#service-desc').value.trim(),
        link:        $('#service-link').value.trim(),
        linkLabel:   $('#service-link-label').value.trim(),
        cover:       coverUrl,
      };

      await apiFetch('/api/content', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'services', item }),
      });

      toast('Service saved ✓', 'success');
      closeServiceModal();
      loadServices();
    } catch (err) {
      toast('Save failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Save Service';
    }
  });

  function validateServiceForm() {
    var ok = true;
    if (!$('#service-title').value.trim()) { showErr('e-service-title', 'Title is required'); ok = false; }
    else clearErr('e-service-title');
    if (!$('#service-desc').value.trim()) { showErr('e-service-desc', 'Description is required'); ok = false; }
    else clearErr('e-service-desc');
    return ok;
  }

  /* -----------------------------------------------------------------------
     Confirm delete
     ----------------------------------------------------------------------- */
  var confirmModal  = $('#confirm-modal');
  var pendingDelete = null;  // { type, id }

  function confirmDelete(type, id) {
    var name = type === 'activity'
      ? ((activities.find(function (a) { return a.id === id; }) || {}).title || id)
      : ((services.find(function (s) { return s.id === id; }) || {}).title  || id);

    $('#confirm-msg').textContent = '"' + name + '" will be permanently deleted.';
    pendingDelete = { type, id };
    if (typeof confirmModal.showModal === 'function') confirmModal.showModal(); else confirmModal.setAttribute('open', '');
  }

  $('#confirm-cancel').addEventListener('click', function () {
    confirmModal.close ? confirmModal.close() : confirmModal.removeAttribute('open');
    pendingDelete = null;
  });

  $('#confirm-ok').addEventListener('click', async function () {
    if (!pendingDelete) return;
    confirmModal.close ? confirmModal.close() : confirmModal.removeAttribute('open');

    var { type, id } = pendingDelete;
    pendingDelete = null;

    try {
      await apiFetch('/api/content?type=' + type + 's&id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      toast('Deleted ✓', 'success');
      if (type === 'activity') loadActivities(); else loadServices();
    } catch (err) {
      toast('Delete failed: ' + err.message, 'error');
    }
  });

  /* -----------------------------------------------------------------------
     Cloudinary direct upload
     ----------------------------------------------------------------------- */
  async function uploadToCloudinary(file, signData, context) {
    var fd = new FormData();
    fd.append('file',      file);
    fd.append('api_key',   signData.apiKey);
    fd.append('timestamp', signData.timestamp);
    fd.append('folder',    signData.folder);
    fd.append('signature', signData.signature);

    var r = await fetch(
      'https://api.cloudinary.com/v1_1/' + signData.cloudName + '/image/upload',
      { method: 'POST', body: fd }
    );
    if (!r.ok) throw new Error('Cloudinary upload failed (' + r.status + ')');
    var data = await r.json();
    return data.secure_url;
  }

  /* -----------------------------------------------------------------------
     Upload progress helpers
     ----------------------------------------------------------------------- */
  function showProgress(ctx, pct) {
    var el = $('#' + ctx + '-upload-progress');
    if (el) { el.hidden = false; updateProgress(ctx, pct); }
  }
  function updateProgress(ctx, pct) {
    var fill   = $('#' + ctx + '-upload-fill');
    var status = $('#' + ctx + '-upload-status');
    if (fill)   fill.style.width   = pct + '%';
    if (status) status.textContent = pct < 100 ? 'Uploading… ' + pct + '%' : 'Upload complete ✓';
  }
  function hideProgress(ctx) {
    setTimeout(function () {
      var el = $('#' + ctx + '-upload-progress');
      if (el) el.hidden = true;
    }, 1200);
  }

  /* -----------------------------------------------------------------------
     Photo thumbnail factory
     ----------------------------------------------------------------------- */
  function makeThumb(src, onRemove) {
    var wrap   = document.createElement('div');
    wrap.className = 'admin-photo-thumb';
    var img    = document.createElement('img');
    img.src    = src;
    img.alt    = '';
    img.loading = 'lazy';
    var btn    = document.createElement('button');
    btn.type   = 'button';
    btn.className = 'admin-photo-remove';
    btn.setAttribute('aria-label', 'Remove photo');
    btn.textContent = '✕';
    btn.addEventListener('click', onRemove);
    wrap.appendChild(img);
    wrap.appendChild(btn);
    return wrap;
  }

  /* -----------------------------------------------------------------------
     Validation helpers
     ----------------------------------------------------------------------- */
  function showErr(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg; }
  function clearErr(id)      { var el = document.getElementById(id); if (el) el.textContent = ''; }
  function clearErrors(form) {
    $$('.field__err', form).forEach(function (el) { el.textContent = ''; });
    $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  /* -----------------------------------------------------------------------
     HTML escape
     ----------------------------------------------------------------------- */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* -----------------------------------------------------------------------
     Init
     ----------------------------------------------------------------------- */
  loadActivities();
  loadServices();
})();
