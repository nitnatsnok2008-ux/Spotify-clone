/* =========================================================
   Spotify Clone – App-Logik
   ========================================================= */
(function () {
  'use strict';
  const DB = window.DB;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  /* ---------- Cover-Generierung (deterministische Verläufe) ---------- */
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i), h |= 0;
    return Math.abs(h);
  }
  function gradientFor(id, name) {
    const h = hashStr(id + name);
    const h1 = h % 360;
    const h2 = (h1 + 40 + (h % 80)) % 360;
    const l1 = 38 + (h % 18);
    return `linear-gradient(135deg, hsl(${h1} 62% ${l1}%) 0%, hsl(${h2} 55% ${Math.max(18, l1 - 22)}%) 100%)`;
  }
  function dominantColor(id, name) {
    const h = hashStr(id + name) % 360;
    return `hsl(${h} 45% 28%)`;
  }
  const NOTE_SVG = `<svg class="cover-note" viewBox="0 0 24 24"><path fill="rgba(255,255,255,.85)" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`;
  // Erzeugt das HTML/Style für ein Cover-Element
  function coverStyle(item) {
    const name = item.title || item.name || '';
    return `background-image:${gradientFor(item.id, name)}`;
  }
  function coverInner(item, isArtist) {
    const name = item.title || item.name || '?';
    if (isArtist || item.type === 'artist') {
      return `<span class="cover-letter">${name.charAt(0).toUpperCase()}</span>`;
    }
    if (item.type === 'track' || item.type === 'album') {
      return `<span class="cover-letter">${name.charAt(0).toUpperCase()}</span>`;
    }
    return NOTE_SVG;
  }
  function coverHTML(item, cls) {
    const isArtist = item && item.type === 'artist';
    const round = isArtist ? ' round' : '';
    return `<div class="cover ${cls}${round}" style="${coverStyle(item)}">${coverInner(item, isArtist)}</div>`;
  }

  /* ---------- Persistenter Zustand ---------- */
  const SAVE_KEY = 'spotify_clone_state_v1';
  function loadState() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  const saved = loadState();
  const state = {
    liked: new Set(saved.liked || []),
    customPlaylists: saved.customPlaylists || [],
    recent: saved.recent || [],
    volume: saved.volume != null ? saved.volume : 0.7,
    theme: saved.theme || 'dark',
    shuffle: false,
    repeat: 'off', // off | all | one
    queue: [],
    queueOrigin: [],
    current: -1,
    libFilter: 'all',
  };
  function persist() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      liked: [...state.liked],
      customPlaylists: state.customPlaylists,
      recent: state.recent.slice(0, 12),
      volume: state.volume,
      theme: state.theme,
    }));
  }

  /* ---------- Theme ---------- */
  const SUN_SVG = `<path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zM3 11h1a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2zm17 0h1a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM5.6 4.2l.7.7A1 1 0 0 1 4.9 6.3l-.7-.7A1 1 0 0 1 5.6 4.2zm12.1 12.1.7.7a1 1 0 0 1-1.4 1.4l-.7-.7a1 1 0 0 1 1.4-1.4zM18.4 4.2a1 1 0 0 1 1.4 1.4l-.7.7A1 1 0 0 1 17.7 4.9zM6.3 16.3a1 1 0 0 1 1.4 1.4l-.7.7a1 1 0 0 1-1.4-1.4z"/>`;
  const MOON_SVG = `<path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-5.4-5.4c0-1.81.89-3.41 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>`;
  function applyTheme() {
    document.body.classList.toggle('light', state.theme === 'light');
    const icon = $('#theme-icon');
    if (icon) icon.innerHTML = state.theme === 'light' ? SUN_SVG : MOON_SVG;
    const btn = $('#theme-toggle');
    if (btn) btn.title = state.theme === 'light' ? 'Zu dunklem Design wechseln' : 'Zu hellem Design wechseln';
  }
  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    applyTheme();
    persist();
  }

  // Liked Songs als virtuelle Playlist
  function likedPlaylist() {
    return {
      id: 'liked', title: 'Lieblingssongs', type: 'playlist', isLiked: true,
      owner: 'Du', desc: '', editable: false,
      trackIds: [...state.liked],
    };
  }
  function allPlaylists() {
    return [likedPlaylist(), ...state.customPlaylists, ...DB.PLAYLISTS];
  }
  function findCollection(id) {
    if (id === 'liked') return likedPlaylist();
    return state.customPlaylists.find(p => p.id === id)
      || DB.playlistById(id) || DB.albumById(id) || DB.artistById(id);
  }

  /* ---------- Audio / Player ---------- */
  const audio = $('#audio');
  audio.volume = state.volume;

  function currentTrack() {
    if (state.current < 0 || state.current >= state.queue.length) return null;
    return DB.trackById(state.queue[state.current]);
  }

  function playCollection(collection, startIndex = 0) {
    const ids = (collection.trackIds || []).slice();
    if (!ids.length) { toast('Keine Songs vorhanden'); return; }
    state.queueOrigin = ids.slice();
    if (state.shuffle) {
      const startId = ids[startIndex];
      const rest = ids.filter((_, i) => i !== startIndex);
      shuffleArr(rest);
      state.queue = [startId, ...rest];
      state.current = 0;
    } else {
      state.queue = ids;
      state.current = startIndex;
    }
    loadCurrent(true);
  }

  function playTrackList(ids, startIndex) {
    playCollection({ trackIds: ids }, startIndex);
  }

  function loadCurrent(autoplay) {
    const t = currentTrack();
    if (!t) return;
    audio.src = t.src;
    if (autoplay) audio.play().catch(() => {});
    addRecent(t.albumId || t.id);
    renderNowPlaying();
    updateQueuePanel();
    refreshTrackRows();
  }

  function togglePlay() {
    if (!currentTrack()) {
      // Nichts geladen -> erste Home-Empfehlung starten
      const first = DB.PLAYLISTS[0];
      playCollection(first, 0);
      return;
    }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  function next(auto) {
    if (!state.queue.length) return;
    if (state.repeat === 'one' && auto) { audio.currentTime = 0; audio.play(); return; }
    if (state.current < state.queue.length - 1) {
      state.current++;
    } else if (state.repeat === 'all' || !auto) {
      state.current = 0;
    } else {
      audio.pause(); audio.currentTime = 0; updatePlayIcon(); return;
    }
    loadCurrent(true);
  }
  function prev() {
    if (!state.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    state.current = state.current > 0 ? state.current - 1 : 0;
    loadCurrent(true);
  }

  function shuffleArr(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    $('#btn-shuffle').classList.toggle('active', state.shuffle);
    if (!state.queue.length) return;
    const curId = state.queue[state.current];
    if (state.shuffle) {
      const rest = state.queueOrigin.filter(id => id !== curId);
      shuffleArr(rest);
      state.queue = [curId, ...rest];
    } else {
      state.queue = state.queueOrigin.slice();
    }
    state.current = state.queue.indexOf(curId);
    updateQueuePanel();
    syncFullscreen();
  }
  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    const btn = $('#btn-repeat');
    btn.classList.toggle('active', state.repeat !== 'off');
    btn.title = state.repeat === 'one' ? 'Titel wiederholen' : state.repeat === 'all' ? 'Alle wiederholen' : 'Wiederholen';
    btn.innerHTML = state.repeat === 'one'
      ? `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/><path fill="currentColor" d="M9 5.5h-.75A.75.75 0 0 0 7.5 6.25v3.5a.75.75 0 0 0 1.5 0V7h.75a.75.75 0 0 0 0-1.5z"/></svg>`
      : `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"/></svg>`;
    syncFullscreen();
  }

  function updatePlayIcon() {
    const playing = !audio.paused && currentTrack();
    $('#play-icon').style.display = playing ? 'none' : 'block';
    $('#pause-icon').style.display = playing ? 'block' : 'none';
    $('#np-cover').classList.toggle('playing', !!playing);
    refreshTrackRows();
    updateQueuePanel();
    syncFullscreen();
  }

  /* ---------- Fullscreen Now Playing ---------- */
  function syncFullscreen() {
    const t = currentTrack();
    const cover = $('#fs-cover');
    if (!cover) return;
    if (t) {
      $('#fs-title').textContent = t.title;
      $('#fs-artist').textContent = t.artist;
      cover.style.backgroundImage = gradientFor(t.id, t.title);
      cover.innerHTML = coverInner(t);
      $('#fs-bg').style.setProperty('--fs-color', dominantColor(t.id, t.title));
    } else {
      $('#fs-title').textContent = '—';
      $('#fs-artist').textContent = '';
      cover.style.backgroundImage = '';
      cover.innerHTML = '';
    }
    const playing = !audio.paused && t;
    $('#fs-play-icon').style.display = playing ? 'none' : 'block';
    $('#fs-pause-icon').style.display = playing ? 'block' : 'none';
    $('#fs-shuffle').classList.toggle('active', state.shuffle);
    $('#fs-repeat').classList.toggle('active', state.repeat !== 'off');
  }
  function openFullscreen() {
    if (!currentTrack()) { toast('Es wird gerade nichts abgespielt'); return; }
    syncFullscreen();
    $('#fullscreen').classList.add('open');
  }
  function closeFullscreen() { $('#fullscreen').classList.remove('open'); }

  /* ---------- Recent ---------- */
  function addRecent(id) {
    state.recent = [id, ...state.recent.filter(x => x !== id)].slice(0, 12);
    persist();
  }

  /* ---------- Like ---------- */
  function toggleLike(trackId) {
    if (state.liked.has(trackId)) { state.liked.delete(trackId); toast('Aus Lieblingssongs entfernt'); }
    else { state.liked.add(trackId); toast('Zu Lieblingssongs hinzugefügt'); }
    persist();
    renderNowPlaying();
    refreshTrackRows();
    renderLibrary();
    if (currentRoute().name === 'collection' && currentRoute().id === 'liked') route();
  }

  /* ---------- Helpers ---------- */
  function fmt(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function totalDuration(tracks) {
    const t = tracks.reduce((a, x) => a + x.duration, 0);
    const h = Math.floor(t / 3600), m = Math.round((t % 3600) / 60);
    return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`;
  }
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Now Playing Bar ---------- */
  function renderNowPlaying() {
    const t = currentTrack();
    const cover = $('#np-cover');
    if (!t) {
      $('#np-title').textContent = '—';
      $('#np-artist').textContent = '';
      cover.style.backgroundImage = '';
      cover.querySelectorAll(':scope > :not(.np-eq)').forEach(n => n.remove());
      return;
    }
    $('#np-title').textContent = t.title;
    $('#np-title').onclick = () => navigate('#/album/' + t.albumId);
    $('#np-artist').textContent = t.artist;
    $('#np-artist').onclick = () => navigate('#/artist/' + t.artistId);
    cover.style.backgroundImage = gradientFor(t.id, t.title);
    // Equalizer-Overlay erhalten, Cover-Innenhalt sonst neu setzen
    cover.querySelectorAll(':scope > :not(.np-eq)').forEach(n => n.remove());
    cover.insertAdjacentHTML('afterbegin', coverInner(t));
    const likeBtn = $('#np-like');
    likeBtn.classList.toggle('liked', state.liked.has(t.id));
    likeBtn.onclick = () => toggleLike(t.id);
    document.title = `${t.title} • ${t.artist}`;
    syncFullscreen();
  }

  /* ---------- Router ---------- */
  function currentRoute() {
    const hash = location.hash || '#/home';
    const parts = hash.slice(2).split('/');
    if (parts[0] === 'album') return { name: 'album', id: parts[1] };
    if (parts[0] === 'artist') return { name: 'artist', id: parts[1] };
    if (parts[0] === 'playlist' || parts[0] === 'collection') return { name: 'collection', id: parts[1] };
    if (parts[0] === 'liked') return { name: 'collection', id: 'liked' };
    if (parts[0] === 'search') return { name: 'search', q: decodeURIComponent(parts[1] || '') };
    if (parts[0] === 'library') return { name: 'library' };
    return { name: 'home' };
  }

  const history = { stack: [], idx: -1 };
  function navigate(hash) {
    if (location.hash === hash) return;
    location.hash = hash;
  }
  window.addEventListener('hashchange', () => {
    if (history.idx < 0 || history.stack[history.idx] !== location.hash) {
      history.stack = history.stack.slice(0, history.idx + 1);
      history.stack.push(location.hash);
      history.idx = history.stack.length - 1;
    }
    route();
    updateNavButtons();
  });

  function updateNavButtons() {
    $('#nav-back').disabled = history.idx <= 0;
    $('#nav-forward').disabled = history.idx >= history.stack.length - 1;
  }

  /* ---------- Views ---------- */
  function route() {
    const r = currentRoute();
    const c = $('#content');
    c.scrollTop = 0;
    // Topbar-Suche nur auf Suchseite
    $('#topbar-search').classList.toggle('visible', r.name === 'search');
    setActiveNav(r.name);
    if (r.name === 'home') c.innerHTML = renderHome();
    else if (r.name === 'search') { c.innerHTML = renderSearch(r.q); if (r.q) $('#search-input').value = r.q; }
    else if (r.name === 'album') c.innerHTML = renderAlbum(r.id);
    else if (r.name === 'artist') c.innerHTML = renderArtist(r.id);
    else if (r.name === 'collection') c.innerHTML = renderCollection(r.id);
    else if (r.name === 'library') c.innerHTML = renderLibraryPage();
    else c.innerHTML = renderHome();
    bindContent();
    refreshTrackRows();
    renderLibrary();
  }

  function setActiveNav(name) {
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === name));
  }

  function cardHTML(item, subOverride) {
    const sub = subOverride != null ? subOverride
      : item.type === 'artist' ? 'Künstler:in'
      : item.type === 'album' ? `${item.year} • ${item.artist}`
      : item.type === 'playlist' ? (item.desc || (item.owner ? 'Von ' + item.owner : ''))
      : item.artist || '';
    const link = item.type === 'album' ? '#/album/' + item.id
      : item.type === 'artist' ? '#/artist/' + item.id
      : '#/playlist/' + item.id;
    return `<div class="card" data-link="${link}" data-play="${item.id}">
      <div class="card-cover-wrap">
        ${coverHTML(item, 'card-cover')}
        <button class="card-play" data-playbtn="${item.id}" title="Abspielen">
          <svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>
        </button>
      </div>
      <div class="card-title">${esc(item.title || item.name)}</div>
      <div class="card-sub">${esc(sub)}</div>
    </div>`;
  }

  function gridSection(title, items, sub) {
    if (!items.length) return '';
    return `<section class="section">
      <div class="section-head"><h2 class="section-title">${esc(title)}</h2><span class="section-all">Alle anzeigen</span></div>
      <div class="card-grid">${items.map(i => cardHTML(i, sub)).join('')}</div>
    </section>`;
  }

  function renderHome() {
    const hour = new Date().getHours();
    const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
    const quick = [likedPlaylist(), ...DB.PLAYLISTS].slice(0, 6);
    const tiles = quick.map(p => `<div class="tile" data-link="#/playlist/${p.id}">
        ${coverHTML(p, 'tile-cover')}
        <span class="tile-name">${esc(p.title)}</span>
        <button class="tile-play" data-playbtn="${p.id}"><svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg></button>
      </div>`).join('');

    const recentItems = state.recent.map(findCollection).filter(Boolean).slice(0, 6);
    const recentSection = recentItems.length
      ? gridSection('Zuletzt gespielt', recentItems) : '';

    return `<div class="page-gradient" style="--header-color:#3a3a3a">
      <h1 class="greeting">${greeting}</h1>
      <div class="tiles">${tiles}</div>
    </div>
    ${recentSection}
    ${gridSection('Für dich erstellt', DB.PLAYLISTS.slice(0, 6))}
    ${gridSection('Beliebte Künstler:innen', DB.ARTISTS)}
    ${gridSection('Neue Alben', DB.ALBUMS)}
    ${gridSection('Zum Stöbern', DB.PLAYLISTS.slice(4))}
    <div style="height:24px"></div>`;
  }

  function renderSearch(q) {
    if (!q) {
      const genres = DB.GENRES.map((g, i) => {
        const fake = { id: 'g' + i, title: g.name, type: 'playlist' };
        return `<div class="genre-card" style="background:${g.color}" data-link="#/search/${encodeURIComponent(g.name)}">
          <h3>${esc(g.name)}</h3>
          <div class="cover genre-img" style="${coverStyle(fake)}">${NOTE_SVG}</div>
        </div>`;
      }).join('');
      return `<section class="section"><h2 class="section-title">Alles durchsuchen</h2></section>
        <div class="search-genres">${genres}</div><div style="height:24px"></div>`;
    }
    const ql = q.toLowerCase();
    const tracks = DB.TRACKS.filter(t => t.title.toLowerCase().includes(ql) || t.artist.toLowerCase().includes(ql)).slice(0, 8);
    const artists = DB.ARTISTS.filter(a => a.name.toLowerCase().includes(ql));
    const albums = DB.ALBUMS.filter(a => a.title.toLowerCase().includes(ql) || a.artist.toLowerCase().includes(ql));
    const playlists = [...DB.PLAYLISTS, ...state.customPlaylists].filter(p =>
      p.title.toLowerCase().includes(ql) || (p.desc || '').toLowerCase().includes(ql));

    if (!tracks.length && !artists.length && !albums.length && !playlists.length) {
      return `<div class="empty-state"><h2>Keine Ergebnisse für „${esc(q)}"</h2><p>Überprüfe die Schreibweise oder verwende andere Stichwörter.</p></div>`;
    }
    const topResult = artists[0] || albums[0] || (tracks[0] && { ...tracks[0], type: 'track' });
    const trackRows = tracks.map((t, i) => trackRowHTML(t, i, tracks.map(x => x.id), { compact: true })).join('');

    return `<div style="display:grid;grid-template-columns:2fr 3fr;gap:24px;padding:24px" class="search-results-top">
      ${topResult ? `<section><h2 class="section-title" style="margin-bottom:16px">Top-Ergebnis</h2>
        <div class="card" style="padding:20px" data-link="${topResult.type === 'artist' ? '#/artist/' + topResult.id : topResult.type === 'album' ? '#/album/' + topResult.id : '#/album/' + topResult.albumId}" data-play="${topResult.id}">
          <div style="width:92px;height:92px;margin-bottom:16px;border-radius:${topResult.type === 'artist' ? '50%' : '6px'};box-shadow:0 8px 24px rgba(0,0,0,.5);background-image:${gradientFor(topResult.id, topResult.title || topResult.name)};display:flex;align-items:center;justify-content:center" class="cover">${coverInner(topResult)}</div>
          <div class="header-title" style="font-size:32px;margin:0 0 8px">${esc(topResult.title || topResult.name)}</div>
          <div class="card-sub">${topResult.type === 'artist' ? 'Künstler:in' : topResult.type === 'album' ? 'Album • ' + topResult.artist : 'Song • ' + topResult.artist}</div>
        </div></section>` : ''}
      ${tracks.length ? `<section><h2 class="section-title" style="margin-bottom:16px">Songs</h2><div class="tracklist" style="padding:0">${trackRows}</div></section>` : ''}
    </div>
    ${gridSection('Künstler:innen', artists)}
    ${gridSection('Alben', albums)}
    ${gridSection('Playlists', playlists)}
    <div style="height:24px"></div>`;
  }

  function headerHTML(item, typeLabel, metaHTML, color) {
    const isArtist = item.type === 'artist';
    return `<div class="page-header">
      ${coverHTML(item, 'header-cover')}
      <div class="header-text">
        <div class="header-type">${typeLabel}</div>
        <h1 class="header-title">${esc(item.title || item.name)}</h1>
        ${item.desc ? `<div class="header-desc">${esc(item.desc)}</div>` : ''}
        <div class="header-meta">${metaHTML}</div>
      </div>
    </div>`;
  }

  function actionBarHTML(playId, likeable, isLiked) {
    return `<div class="action-bar">
      <button class="play-big" data-bigplay="${playId}" title="Abspielen">
        <svg id="bigplay-icon" viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>
      </button>
      ${likeable ? `<button class="action-icon ${isLiked ? 'liked' : ''}" title="Folgen">
        <svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm11.748-1.97a.75.75 0 0 1 .101 1.056l-3.197 3.857a.75.75 0 0 1-1.081.04L5.6 8.146a.75.75 0 0 1 1.06-1.06l1.392 1.39 2.64-3.183a.75.75 0 0 1 1.056-.063z"/></svg>
      </button>` : ''}
    </div>`;
  }

  function trackRowHTML(t, idx, listIds, opts) {
    opts = opts || {};
    const liked = state.liked.has(t.id);
    const cur = currentTrack();
    const isCur = cur && cur.id === t.id;
    const playing = isCur && !audio.paused;
    const cols = opts.compact
      ? `<div class="track-dur"><button class="track-like ${liked ? 'liked' : ''}" data-like="${t.id}" title="Gefällt mir">${heartSVG(liked)}</button><span>${fmt(t.duration)}</span></div>`
      : `<div class="track-album"><a data-link="#/album/${t.albumId}">${esc((DB.albumById(t.albumId) || {}).title || '')}</a></div>
         <div class="track-dur">
           <button class="track-like ${liked ? 'liked' : ''}" data-like="${t.id}" title="Gefällt mir">${heartSVG(liked)}</button>
           <span>${fmt(t.duration)}</span>
           <button class="track-more" data-more="${t.id}" title="Mehr">${moreSVG()}</button>
         </div>`;
    const gridCols = opts.compact ? '16px 4fr 1fr' : '';
    return `<div class="track-row ${isCur ? 'playing' : ''}" data-track="${t.id}" data-list="${listIds.join(',')}" data-idx="${idx}" ${gridCols ? `style="grid-template-columns:${gridCols}"` : ''}>
      <div class="track-index">
        <span class="idx">${idx + 1}</span>
        <span class="play-ico"><svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg></span>
        <span class="bars"><span></span><span></span><span></span></span>
      </div>
      <div class="track-main">
        ${coverHTML(t, 'track-cover')}
        <div class="track-text">
          <div class="track-title">${esc(t.title)}</div>
          <div class="track-artist"><a data-link="#/artist/${t.artistId}">${esc(t.artist)}</a></div>
        </div>
      </div>
      ${cols}
    </div>`;
  }

  function heartSVG(filled) {
    return filled
      ? `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.578z"/></svg>`
      : `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.78 3.815v.013a4.617 4.617 0 0 1-1.345 4.063l-.014.013-6.778 6.022a.78.78 0 0 1-1.04-.001L3.5 13.6 1.398 11.7l-.014-.013A4.617 4.617 0 0 1 .04 7.65v-.013A4.618 4.618 0 0 1 1.69 2zm6.31.81.6.79.6-.79.001-.002a3.082 3.082 0 1 1 4.79 3.864l-6.18 5.49-6.18-5.49a3.082 3.082 0 1 1 4.79-3.864L8 2.81z"/></svg>`;
  }
  function moreSVG() {
    return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM14.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`;
  }

  function tracklistHTML(tracks, listIds) {
    const rows = tracks.map((t, i) => trackRowHTML(t, i, listIds, {})).join('');
    return `<div class="tracklist">
      <div class="tracklist-head">
        <div>#</div>
        <div>Titel</div>
        <div class="col-album">Album</div>
        <div></div>
        <div class="col-dur"><svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/><path fill="currentColor" d="M8 3.25a.75.75 0 0 1 .75.75v3.25H11a.75.75 0 0 1 0 1.5H7.25V4A.75.75 0 0 1 8 3.25z"/></svg></div>
      </div>
      ${rows}
    </div>`;
  }

  function renderCollection(id) {
    const p = findCollection(id);
    if (!p) return `<div class="empty-state"><h2>Nicht gefunden</h2></div>`;
    const tracks = DB.tracksOf(p);
    const color = dominantColor(p.id, p.title);
    const meta = `<span>${esc(p.owner || 'Du')}</span><span class="dot">•</span><span>${tracks.length} Songs</span>${tracks.length ? `<span class="dot">•</span><span class="sub">${totalDuration(tracks)}</span>` : ''}`;
    const header = `<div class="page-gradient" style="--header-color:${color}">
      ${headerHTML({ ...p, type: 'playlist' }, p.isLiked ? 'Playlist' : 'Öffentliche Playlist', meta)}
      ${actionBarHTML(p.id)}
      ${tracks.length ? tracklistHTML(tracks, p.trackIds) : emptyCollection(p)}
    </div>`;
    return header;
  }

  function emptyCollection(p) {
    return `<div class="empty-state" style="padding:40px 24px">
      <h2>${p.isLiked ? 'Songs, die dir gefallen' : 'Diese Playlist ist leer'}</h2>
      <p>${p.isLiked ? 'Tippe auf das Herz neben einem Song, um ihn hier zu speichern.' : 'Füge Songs über das Menü „…" hinzu.'}</p>
    </div>`;
  }

  function renderAlbum(id) {
    const al = DB.albumById(id);
    if (!al) return `<div class="empty-state"><h2>Album nicht gefunden</h2></div>`;
    const tracks = DB.tracksOf(al);
    const color = dominantColor(al.id, al.title);
    const meta = `<a data-link="#/artist/${al.artistId}" style="font-weight:700">${esc(al.artist)}</a><span class="dot">•</span><span>${al.year}</span><span class="dot">•</span><span>${tracks.length} Songs</span>`;
    return `<div class="page-gradient" style="--header-color:${color}">
      ${headerHTML(al, 'Album', meta)}
      ${actionBarHTML(al.id)}
      ${tracklistHTML(tracks, al.trackIds)}
    </div>`;
  }

  function renderArtist(id) {
    const ar = DB.artistById(id);
    if (!ar) return `<div class="empty-state"><h2>Künstler:in nicht gefunden</h2></div>`;
    const tracks = DB.TRACKS.filter(t => t.artistId === id);
    const albums = DB.ALBUMS.filter(a => a.artistId === id);
    const topIds = tracks.slice(0, 5).map(t => t.id);
    const color = dominantColor(ar.id, ar.name);
    const popular = tracks.slice(0, 5).map((t, i) => trackRowHTML(t, i, topIds, { compact: true })).join('');
    return `<div class="page-gradient" style="--header-color:${color}">
      <div class="page-header" style="padding-top:120px">
        ${coverHTML(ar, 'header-cover')}
        <div class="header-text">
          <div class="header-type">Verifizierte:r Künstler:in</div>
          <h1 class="header-title">${esc(ar.name)}</h1>
          <div class="header-meta"><span>${ar.monthly} monatliche Hörer:innen</span></div>
        </div>
      </div>
      ${actionBarHTML(albums[0] ? albums[0].id : '', true)}
      <section class="section"><h2 class="section-title" style="margin-bottom:8px">Beliebt</h2>
        <div class="tracklist" style="padding:0 8px">${popular}</div>
      </section>
      ${gridSection('Diskografie', albums)}
      <section class="section"><h2 class="section-title">Über</h2><p class="header-desc" style="max-width:600px">${esc(ar.bio)}</p></section>
      <div style="height:24px"></div>
    </div>`;
  }

  function renderLibraryPage() {
    const items = libraryItems();
    return `<section class="section"><h2 class="section-title">Deine Bibliothek</h2>
      <div class="card-grid" style="margin-top:16px">${items.map(i => cardHTML(i)).join('')}</div></section>`;
  }

  /* ---------- Sidebar Library ---------- */
  function libraryItems() {
    let items = [likedPlaylist(), ...state.customPlaylists, ...DB.PLAYLISTS, ...DB.ALBUMS, ...DB.ARTISTS];
    if (state.libFilter === 'playlist') items = items.filter(i => i.type === 'playlist');
    else if (state.libFilter === 'album') items = items.filter(i => i.type === 'album');
    else if (state.libFilter === 'artist') items = items.filter(i => i.type === 'artist');
    return items;
  }
  function renderLibrary() {
    const list = $('#library-list');
    const cur = currentTrack();
    const playingColId = cur ? (cur.albumId) : null;
    list.innerHTML = libraryItems().map(item => {
      const link = item.type === 'album' ? '#/album/' + item.id
        : item.type === 'artist' ? '#/artist/' + item.id
        : '#/playlist/' + item.id;
      const sub = item.type === 'artist' ? 'Künstler:in'
        : item.type === 'album' ? 'Album • ' + item.artist
        : item.isLiked ? 'Playlist • ' + item.trackIds.length + ' Songs'
        : 'Playlist • ' + (item.owner || 'Du');
      const round = item.type === 'artist' ? ' round' : '';
      const isActive = currentRoute().id === item.id;
      return `<div class="lib-item ${isActive ? 'active' : ''}" data-link="${link}">
        <div class="cover lib-cover${round}" style="${coverStyle(item)}">${coverInner(item, item.type === 'artist')}</div>
        <div class="lib-info">
          <div class="lib-name">${esc(item.title || item.name)}</div>
          <div class="lib-sub">${esc(sub)}</div>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('[data-link]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.link));
    });
  }

  /* ---------- Track row state refresh ---------- */
  function refreshTrackRows() {
    const cur = currentTrack();
    $$('.track-row').forEach(row => {
      const isCur = cur && row.dataset.track === cur.id;
      row.classList.toggle('playing', isCur);
    });
  }

  /* ---------- Bind events in content ---------- */
  function bindContent() {
    const c = $('#content');
    c.querySelectorAll('[data-link]').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('[data-playbtn],[data-like],[data-more],[data-bigplay]')) return;
        e.stopPropagation();
        navigate(el.dataset.link);
      });
    });
    // Karten-Play
    c.querySelectorAll('[data-playbtn]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); playEntity(btn.dataset.playbtn); });
    });
    c.querySelectorAll('[data-bigplay]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); playEntity(btn.dataset.bigplay); });
    });
    // Track-Zeilen
    c.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-like],[data-more],[data-link]')) return;
        const ids = row.dataset.list.split(',');
        const idx = parseInt(row.dataset.idx, 10);
        const tid = row.dataset.track;
        const cur = currentTrack();
        if (cur && cur.id === tid) { togglePlay(); return; }
        playTrackList(ids, idx);
      });
    });
    // Like-Buttons
    c.querySelectorAll('[data-like]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); toggleLike(btn.dataset.like); });
    });
    // More / Kontextmenü
    c.querySelectorAll('[data-more]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openTrackMenu(e, btn.dataset.more); });
    });
    // Rechtsklick auf Track-Zeile
    c.querySelectorAll('.track-row').forEach(row => {
      row.addEventListener('contextmenu', e => { e.preventDefault(); openTrackMenu(e, row.dataset.track); });
    });
    // Sektionstitel
    updatePlayIcon();
  }

  function playEntity(id) {
    const col = findCollection(id);
    if (col) {
      const cur = currentTrack();
      const colTracks = col.trackIds || [];
      if (cur && colTracks.includes(cur.id) && state.queueOrigin.join() === colTracks.join()) {
        togglePlay(); return;
      }
      playCollection(col, 0);
      return;
    }
    const t = DB.trackById(id);
    if (t) playTrackList([t.id], 0);
  }

  /* ---------- Kontextmenü ---------- */
  const ctx = $('#context-menu');
  function openTrackMenu(e, trackId) {
    const t = DB.trackById(trackId);
    if (!t) return;
    const liked = state.liked.has(trackId);
    const playlistsSub = state.customPlaylists.map(p =>
      `<button class="ctx-item" data-addto="${p.id}">${esc(p.title)}</button>`).join('') || `<div class="ctx-item" style="color:#888">Keine eigenen Playlists</div>`;
    ctx.innerHTML = `
      <button class="ctx-item" data-ctx="play">${playSmallSVG()} Abspielen</button>
      <button class="ctx-item" data-ctx="queue">${queueSVG()} Zur Warteschlange hinzufügen</button>
      <div class="ctx-divider"></div>
      <button class="ctx-item" data-ctx="like">${heartSVG(liked)} ${liked ? 'Aus Lieblingssongs entfernen' : 'Zu Lieblingssongs'}</button>
      <div class="ctx-item ctx-sub">${plusSVG()} Zur Playlist hinzufügen ▸
        <div class="ctx-submenu">
          <button class="ctx-item" data-newpl="1">${plusSVG()} Neue Playlist</button>
          <div class="ctx-divider"></div>
          ${playlistsSub}
        </div>
      </div>
      <div class="ctx-divider"></div>
      <button class="ctx-item" data-ctx="artist">${artistSVG()} Zu Künstler:in</button>
      <button class="ctx-item" data-ctx="album">${albumSVG()} Zu Album</button>`;
    ctx.classList.add('open');
    const x = Math.min(e.clientX, window.innerWidth - 230);
    const y = Math.min(e.clientY, window.innerHeight - ctx.offsetHeight - 20);
    ctx.style.left = x + 'px';
    ctx.style.top = y + 'px';

    ctx.querySelector('[data-ctx="play"]').onclick = () => { playTrackList([trackId], 0); closeCtx(); };
    ctx.querySelector('[data-ctx="queue"]').onclick = () => { addToQueue(trackId); closeCtx(); };
    ctx.querySelector('[data-ctx="like"]').onclick = () => { toggleLike(trackId); closeCtx(); };
    ctx.querySelector('[data-ctx="artist"]').onclick = () => { navigate('#/artist/' + t.artistId); closeCtx(); };
    ctx.querySelector('[data-ctx="album"]').onclick = () => { navigate('#/album/' + t.albumId); closeCtx(); };
    const np = ctx.querySelector('[data-newpl]');
    if (np) np.onclick = () => { const pl = createPlaylist(); addTrackToPlaylist(pl.id, trackId); closeCtx(); };
    ctx.querySelectorAll('[data-addto]').forEach(b => {
      b.onclick = () => { addTrackToPlaylist(b.dataset.addto, trackId); closeCtx(); };
    });
  }
  function closeCtx() { ctx.classList.remove('open'); }
  document.addEventListener('click', e => { if (!ctx.contains(e.target)) closeCtx(); });
  document.addEventListener('scroll', closeCtx, true);

  function playSmallSVG() { return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"/></svg>`; }
  function queueSVG() { return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 0 1 3.5 1h9a2.5 2.5 0 0 1 0 5h-9A2.5 2.5 0 0 1 1 3.5z"/></svg>`; }
  function plusSVG() { return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>`; }
  function artistSVG() { return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M10 7.732a2.5 2.5 0 1 0-4 0V16h4V7.732zM8 1a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 8 6a2.5 2.5 0 0 1 0-5z"/></svg>`; }
  function albumSVG() { return `<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8 2a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>`; }

  /* ---------- Playlists ---------- */
  function createPlaylist(name) {
    const n = state.customPlaylists.length + 1;
    const pl = {
      id: 'cpl' + Date.now(),
      title: name || `Meine Playlist Nr. ${n}`,
      type: 'playlist', editable: true, owner: 'Du', desc: '', trackIds: [],
    };
    state.customPlaylists.unshift(pl);
    persist();
    renderLibrary();
    return pl;
  }
  function addTrackToPlaylist(plId, trackId) {
    const pl = state.customPlaylists.find(p => p.id === plId);
    if (!pl) return;
    if (pl.trackIds.includes(trackId)) { toast('Bereits in „' + pl.title + '"'); return; }
    pl.trackIds.push(trackId);
    persist();
    toast('Zu „' + pl.title + '" hinzugefügt');
    if (currentRoute().id === plId) route();
  }

  /* ---------- Queue ---------- */
  function addToQueue(trackId) {
    if (!state.queue.length) { playTrackList([trackId], 0); return; }
    state.queue.splice(state.current + 1, 0, trackId);
    state.queueOrigin.push(trackId);
    toast('Zur Warteschlange hinzugefügt');
    updateQueuePanel();
  }
  function updateQueuePanel() {
    const body = $('#queue-body');
    const cur = currentTrack();
    let html = '';
    if (cur) {
      html += `<div class="queue-section-title">Wird gerade abgespielt</div>`;
      html += queueItemHTML(cur, true);
    }
    const upcoming = state.queue.slice(state.current + 1);
    if (upcoming.length) {
      html += `<div class="queue-section-title">Als Nächstes</div>`;
      html += upcoming.map((id, i) => {
        const t = DB.trackById(id);
        return t ? queueItemHTML(t, false, state.current + 1 + i) : '';
      }).join('');
    }
    if (!cur) html = `<div class="empty-state" style="padding:40px 16px"><p>Die Warteschlange ist leer.</p></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-qidx]').forEach(el => {
      el.addEventListener('click', () => { state.current = parseInt(el.dataset.qidx, 10); loadCurrent(true); });
    });
  }
  function queueItemHTML(t, playing, qidx) {
    return `<div class="queue-item" ${qidx != null ? `data-qidx="${qidx}"` : ''}>
      ${coverHTML(t, 'qi-cover')}
      <div class="qi-text">
        <div class="qi-title ${playing ? 'playing' : ''}">${esc(t.title)}</div>
        <div class="qi-artist">${esc(t.artist)}</div>
      </div>
    </div>`;
  }

  /* ---------- Progress / Volume bars (drag-fähig) ---------- */
  function setupBar(barEl, fillEl, handleEl, onSeek) {
    let dragging = false;
    function pct(e) {
      const rect = barEl.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    }
    function move(e) { if (!dragging) return; const p = pct(e); fillEl.style.width = p * 100 + '%'; handleEl.style.left = p * 100 + '%'; onSeek(p, false); }
    function up(e) { if (!dragging) return; dragging = false; onSeek(pct(e), true); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
    barEl.addEventListener('mousedown', e => { dragging = true; const p = pct(e); fillEl.style.width = p * 100 + '%'; handleEl.style.left = p * 100 + '%'; onSeek(p, false); document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); });
    barEl.addEventListener('click', e => { onSeek(pct(e), true); });
  }

  /* ---------- Audio events ---------- */
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const p = audio.currentTime / audio.duration;
    $('#progress-fill').style.width = p * 100 + '%';
    $('#progress-handle').style.left = p * 100 + '%';
    $('#time-current').textContent = fmt(audio.currentTime);
    $('#fs-progress-fill').style.width = p * 100 + '%';
    $('#fs-progress-handle').style.left = p * 100 + '%';
    $('#fs-time-current').textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('loadedmetadata', () => {
    $('#time-total').textContent = fmt(audio.duration);
    $('#fs-time-total').textContent = fmt(audio.duration);
  });
  audio.addEventListener('play', updatePlayIcon);
  audio.addEventListener('pause', updatePlayIcon);
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('error', () => {
    if (currentTrack()) toast('Audio konnte nicht geladen werden (Netzwerk?)');
  });

  /* ---------- Volume ---------- */
  function setVolume(v) {
    state.volume = Math.max(0, Math.min(1, v));
    audio.volume = state.volume;
    audio.muted = false;
    $('#volume-fill').style.width = state.volume * 100 + '%';
    $('#volume-handle').style.left = state.volume * 100 + '%';
    updateVolIcon();
    persist();
  }
  function updateVolIcon() {
    const v = audio.muted ? 0 : state.volume;
    const icon = $('#vol-icon');
    let path;
    if (v === 0) path = `<path fill="currentColor" d="M13.86 5.47a.75.75 0 0 0-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 0 0 8.8 6.53L10.269 8l-1.47 1.47a.75.75 0 1 0 1.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 0 0 1.06-1.06L12.39 8l1.47-1.47a.75.75 0 0 0 0-1.06z"/><path fill="currentColor" d="M10.116 1.5A.75.75 0 0 0 8.991.85l-6.925 4a3.642 3.642 0 0 0-1.33 4.967 3.639 3.639 0 0 0 1.33 1.332l6.925 4a.75.75 0 0 0 1.125-.649v-1.906a4.73 4.73 0 0 1-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 0 1-.781-2.92c.187-.324.456-.594.78-.78l5.8-3.35v1.3c.45-.318.956-.55 1.5-.694V1.5z"/>`;
    else if (v < 0.5) path = `<path fill="currentColor" d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"/>`;
    else path = `<path fill="currentColor" d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"/><path fill="currentColor" d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127v1.55z"/>`;
    icon.innerHTML = path;
  }

  /* ---------- Init bindings ---------- */
  function init() {
    // Player controls
    $('#btn-play').onclick = togglePlay;
    $('#btn-next').onclick = () => next(false);
    $('#btn-prev').onclick = prev;
    $('#btn-shuffle').onclick = toggleShuffle;
    $('#btn-repeat').onclick = cycleRepeat;
    $('#btn-queue').onclick = () => $('#queue-panel').classList.toggle('open');
    $('#queue-close').onclick = () => $('#queue-panel').classList.remove('open');

    // Theme
    $('#theme-toggle').onclick = toggleTheme;
    applyTheme();

    // Fullscreen
    $('#btn-fullscreen').onclick = openFullscreen;
    $('#np-cover').onclick = openFullscreen;
    $('#fs-close').onclick = closeFullscreen;
    $('#fs-play').onclick = togglePlay;
    $('#fs-next').onclick = () => next(false);
    $('#fs-prev').onclick = prev;
    $('#fs-shuffle').onclick = toggleShuffle;
    $('#fs-repeat').onclick = cycleRepeat;
    $('#fs-artist').onclick = () => { const t = currentTrack(); if (t) { closeFullscreen(); navigate('#/artist/' + t.artistId); } };
    setupBar($('#fs-progress-bar'), $('#fs-progress-fill'), $('#fs-progress-handle'), (p, commit) => {
      if (audio.duration) { if (commit) audio.currentTime = p * audio.duration; $('#fs-time-current').textContent = fmt(p * audio.duration); }
    });
    $('#btn-mute').onclick = () => { audio.muted = !audio.muted; if (audio.muted) { $('#volume-fill').style.width = '0%'; } else { $('#volume-fill').style.width = state.volume * 100 + '%'; } updateVolIcon(); };

    // Progress + Volume bars
    setupBar($('#progress-bar'), $('#progress-fill'), $('#progress-handle'), (p, commit) => {
      if (audio.duration) { if (commit) audio.currentTime = p * audio.duration; $('#time-current').textContent = fmt(p * audio.duration); }
    });
    setupBar($('#volume-bar'), $('#volume-fill'), $('#volume-handle'), (p) => setVolume(p));
    setVolume(state.volume);

    // Nav buttons
    $('#nav-back').onclick = () => { if (history.idx > 0) { history.idx--; location.hash = history.stack[history.idx]; } };
    $('#nav-forward').onclick = () => { if (history.idx < history.stack.length - 1) { history.idx++; location.hash = history.stack[history.idx]; } };

    // Library
    $('#create-playlist-btn').onclick = () => { const pl = createPlaylist(); navigate('#/playlist/' + pl.id); };
    $('#open-library').onclick = () => navigate('#/library');
    $$('.filter-chip').forEach(chip => {
      chip.onclick = () => {
        state.libFilter = chip.dataset.filter;
        $$('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
        renderLibrary();
      };
    });

    // Search input
    const si = $('#search-input');
    si.addEventListener('input', () => {
      const q = si.value.trim();
      if (currentRoute().name !== 'search') { navigate('#/search'); }
      const c = $('#content');
      c.innerHTML = renderSearch(q);
      bindContent();
      const newHash = q ? '#/search/' + encodeURIComponent(q) : '#/search';
      if (location.hash !== newHash) {
        // hash leise aktualisieren ohne erneutes Rendern
        window.history.replaceState(null, '', newHash);
      }
    });

    // Topbar scroll shadow
    $('#content').addEventListener('scroll', e => {
      $('.topbar').classList.toggle('scrolled', e.target.scrollTop > 16);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight' && e.shiftKey) next(false);
      else if (e.code === 'ArrowLeft' && e.shiftKey) prev();
      else if (e.code === 'Escape') { closeFullscreen(); closeCtx(); }
    });

    // Initiale Route
    if (!location.hash) location.hash = '#/home';
    history.stack = [location.hash]; history.idx = 0;
    route();
    updateNavButtons();
    renderNowPlaying();
    updateQueuePanel();
    $('#btn-shuffle').classList.remove('active');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
