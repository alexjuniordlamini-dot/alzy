/* ALZY — coupon video unlock engine (YouTube IFrame API + simulated fallback) */
(() => {
  'use strict';
  const playerEl = document.getElementById('player');
  if (!playerEl) return;

  const videoId = playerEl.dataset.youtubeId;
  const duration = Number(playerEl.dataset.duration) || 0;
  const couponId = playerEl.dataset.couponId;
  const claimStatus = playerEl.dataset.claimStatus;
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  const hint = document.getElementById('progressHint');
  const claimBtn = document.getElementById('claimBtn');
  const stepWatch = document.getElementById('stepWatch');
  const stepLike = document.getElementById('stepLike');
  const stepClaim = document.getElementById('stepClaim');
  const fallback = document.getElementById('playerFallback');

  if (claimStatus !== 'watching') return; // already earned — static page

  let state = { watched: 0, liked: false, completed: false, mode: null, player: null, saveTimer: null, simTimer: null };

  const pct = () => Math.min(100, Math.round((state.watched / Math.max(1, duration)) * 100));
  function paint() {
    if (fill) fill.style.width = pct() + '%';
    if (label) label.textContent = `${pct()}% of the video watched · ${Math.floor(state.watched)}s / ${duration}s`;
    if (stepWatch) {
      stepWatch.classList.toggle('done', state.completed);
      stepWatch.classList.toggle('active', !state.completed);
      const remaining = Math.max(0, Math.ceil(duration - state.watched));
      stepWatch.innerHTML = `<span class="dot">1</span> ${state.completed ? 'Video watched to the end' : `Watch to the end (${remaining}s to go)`}`;
    }
    if (stepLike) {
      stepLike.classList.toggle('locked', !state.completed);
      stepLike.classList.toggle('done', state.liked);
      stepLike.classList.toggle('active', state.completed && !state.liked);
    }
    if (stepClaim) {
      stepClaim.classList.toggle('locked', !(state.completed && state.liked));
      stepClaim.classList.toggle('active', state.completed && state.liked);
    }
    if (claimBtn) claimBtn.disabled = !(state.completed && state.liked);
    if (hint) {
      hint.textContent = state.completed
        ? (state.liked ? 'Ready — generate your coupon.' : 'Now tap the like button to finish.')
        : 'The coupon unlocks only when the video reaches the end.';
    }
  }

  function save(force) {
    const payload = { watched: Math.floor(state.watched), liked: state.liked };
    const req = fetch(`/api/coupons/${couponId}/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), credentials: 'same-origin', keepalive: !!force
    }).catch(() => {});
    return req;
  }
  function scheduleSave() {
    if (state.saveTimer) return;
    state.saveTimer = setTimeout(() => { state.saveTimer = null; save(); }, 4000);
  }

  function setWatched(seconds, fromVideoEnd) {
    const next = Math.max(state.watched, Math.min(duration, seconds));
    if (next > state.watched || fromVideoEnd) {
      state.watched = fromVideoEnd ? duration : next;
      if (state.watched >= duration - 1.5) state.completed = true;
      paint(); scheduleSave();
    }
  }

  /* ---------- like button (rendered into the player chrome) ---------- */
  function ensureLikeBar() {
    if (document.getElementById('likeBar')) return;
    const bar = document.createElement('div');
    bar.id = 'likeBar';
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:#fff';
    bar.innerHTML = `
      <button type="button" id="likeBtn" class="btn btn-ghost btn-sm" aria-pressed="false" style="min-width:118px">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4.2-7.4A1.6 1.6 0 0 1 14 4.4V9h4.6a2 2 0 0 1 2 2.4l-1.2 6.4A2.4 2.4 0 0 1 17 20H7"/></svg>
        <span>Like video</span>
      </button>
      <span class="tiny muted" id="likeHint">Like the video to finish unlocking your coupon.</span>`;
    const host = document.getElementById('watchProgress');
    host.insertAdjacentElement('afterend', bar);
    document.getElementById('likeBtn').addEventListener('click', () => {
      state.liked = !state.liked;
      const btn = document.getElementById('likeBtn');
      btn.setAttribute('aria-pressed', String(state.liked));
      btn.style.background = state.liked ? '#eef8dc' : '';
      btn.style.borderColor = state.liked ? 'var(--leaf)' : '';
      btn.querySelector('span').textContent = state.liked ? 'Liked' : 'Like video';
      btn.querySelector('svg').setAttribute('fill', state.liked ? 'currentColor' : 'none');
      document.getElementById('likeHint').textContent = state.liked ? 'Liked — you can generate your coupon now.' : 'Like the video to finish unlocking your coupon.';
      paint(); save(true);
    });
  }
  ensureLikeBar();

  /* ---------- simulated player ---------- */
  function startSimulated() {
    if (state.mode === 'sim') return;
    state.mode = 'sim';
    if (fallback) fallback.remove();
    playerEl.innerHTML = `
      <div style="position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%, #1b4a30, #08170f);color:#e7f0e8;text-align:center;padding:24px">
        <div>
          <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:10px">ALZY Academy · supplier video</div>
          <b id="simTitle" style="font-size:19px;display:block;max-width:36ch;margin:0 auto">Watching…</b>
          <p class="small" id="simClock" style="opacity:.75;margin-top:8px">0:00 / ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}</p>
          <div style="width:min(420px,80vw);height:6px;border-radius:99px;background:rgba(255,255,255,.16);margin:18px auto 0;overflow:hidden">
            <div id="simBar" style="height:100%;width:0%;background:var(--lime);transition:width .5s linear"></div>
          </div>
          <button class="btn btn-white btn-sm" id="simPause" style="margin-top:18px">Pause</button>
        </div>
      </div>`;
    const simBar = document.getElementById('simBar');
    const clock = document.getElementById('simClock');
    const pause = document.getElementById('simPause');
    let paused = false;
    const tick = () => {
      if (paused) return;
      const next = Math.min(duration, state.watched + 1);
      state.watched = next;
      simBar.style.width = (next / duration * 100) + '%';
      clock.textContent = `${fmt(next)} / ${fmt(duration)}`;
      paint();
      if (next >= duration) { clearInterval(state.simTimer); setWatched(duration, true); save(true); document.getElementById('simTitle').textContent = 'Video complete — like it to unlock'; pause.remove(); return; }
      if (next % 5 === 0) save();
    };
    state.simTimer = setInterval(tick, 1000);
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Pause'; });
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------- YouTube IFrame API ---------- */
  let ytFailTimer = setTimeout(() => { if (state.mode !== 'yt') startSimulated(); }, 9000);

  window.onYouTubeIframeAPIReady = function () {
    if (!videoId) { startSimulated(); return; }
    clearTimeout(ytFailTimer);
    try {
      state.player = new YT.Player('player', {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, origin: location.origin },
        events: {
          onReady: () => {
            state.mode = 'yt';
            if (fallback) fallback.remove();
            state.player.playVideo && state.player.playVideo();
            state.pollTimer = setInterval(() => {
              if (!state.player || !state.player.getCurrentTime) return;
              const t = state.player.getCurrentTime();
              if (t > 0) setWatched(t);
              const p = state.player.getPlayerState && state.player.getPlayerState();
              if (p === 0) { setWatched(duration, true); save(true); }
            }, 900);
          },
          onStateChange: (e) => {
            if (e.data === 0) { setWatched(duration, true); save(true); }
          },
          onError: () => { clearTimeout(ytFailTimer); startSimulated(); }
        }
      });
    } catch { startSimulated(); }
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = () => startSimulated();
  document.head.appendChild(tag);
  document.getElementById('simulatePlayer')?.addEventListener('click', startSimulated);

  /* ---------- claim ---------- */
  claimBtn?.addEventListener('click', async () => {
    claimBtn.disabled = true;
    claimBtn.textContent = 'Generating…';
    try {
      const res = await fetch(`/api/coupons/${couponId}/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched: Math.floor(state.watched), liked: state.liked }), credentials: 'same-origin'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate coupon');
      window.location.reload();
    } catch (err) {
      window.ALZY && window.ALZY.toast(err.message, { error: true });
      claimBtn.disabled = false;
      claimBtn.textContent = 'Generate my coupon';
    }
  });

  window.addEventListener('beforeunload', () => save(true));
  paint();
})();
