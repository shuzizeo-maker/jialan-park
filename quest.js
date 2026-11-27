// 嘉蘭遊樂場・闖關系統
// 負責：點擊/觸控設施（Raycaster）、設施名牌、園區快速導覽（相機飛行）、
//       闖關視窗、計分與徽章（localStorage）、音效（WebAudio）、英語發音（speechSynthesis）、
//       五大園區全破後的煙火秀。
import { LANDS, RIDES, landById, rideById } from './lands.js';
import { QUESTIONS, makeSpeedMath, bandOf } from './questions.js';

const ROUND_SIZE = 5;      // 每回合題數
const PASS_SCORE = 4;      // 答對幾題算過關
const STORE_KEY = 'jialan-park-progress-v1';
const $ = sel => document.querySelector(sel);
const show = (el, mode = 'block') => { el.style.display = mode; };
const hide = el => { el.style.display = 'none'; };

export function setupQuests({ THREE: T, camera, controls, canvas, fireworksShow, themed }) {
  // ───────── 進度存檔 ─────────
  let state = { grade: 4, rides: {}, sound: true, celebrated: false };
  try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch { /* 存檔壞掉就重新開始 */ }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* 無痕模式可能無法存檔 */ } };
  const cleared = id => !!state.rides[id]?.cleared;
  const landRides = landId => RIDES.filter(r => r.land === landId);
  const landDone = landId => landRides(landId).every(r => cleared(r.id));
  const allDone = () => LANDS.every(l => landDone(l.id));

  // ───────── 音效（WebAudio 即時合成，不需要音檔）─────────
  let ac = null;
  function audio() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, at, dur, type = 'sine', vol = .16, slideTo = 0) {
    const a = audio(); if (!a || !state.sound) return;
    const t0 = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .015);
    g.gain.exponentialRampToValueAtTime(.0008, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + .05);
  }
  const sfx = {
    click: () => tone(880, 0, .07, 'triangle', .07),
    correct: () => { tone(660, 0, .14, 'triangle'); tone(880, .1, .14, 'triangle'); tone(1320, .2, .28, 'triangle', .14); },
    wrong: () => { tone(240, 0, .32, 'sawtooth', .07, 140); tone(120, 0, .35, 'square', .04); },
    tick: () => tone(1200, 0, .05, 'square', .04),
    pass: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .12, .3, 'triangle', .13)),
    badge: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, .35, 'triangle', .14)); tone(262, 0, .9, 'sine', .08); },
  };

  // ───────── 英語發音 ─────────
  let voices = [];
  const loadVoices = () => { voices = window.speechSynthesis?.getVoices() || []; };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.addEventListener?.('voiceschanged', loadVoices); }
  function speak(text) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = .82; u.pitch = 1.05;
    const v = voices.find(v => /en[-_]US/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
    return true;
  }

  // ───────── 文字格式：{3/8} → 直式分數 ─────────
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = s => esc(s).replace(/\{(?:(\d+) )?(\d+)\/(\d+)\}/g, (_, w, n, d) =>
    `${w ? `<span class="whole">${w}</span>` : ''}<span class="frac"><span>${n}</span><span>${d}</span></span>`);

  // ───────── 相機飛行（園區快速導覽）─────────
  const home = { pos: camera.position.clone(), target: controls.target.clone() };
  let flight = null;
  function flyTo(pos, target, duration = 1.5) {
    flight = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos, target, t: 0, duration };
  }
  controls.addEventListener('start', () => { flight = null; }); // 使用者一拖曳就停止自動飛行
  const hitHeight = r => r.hit.box ? r.hit.box[1] : r.hit.cyl[1];
  // 設施視角：從 dir 指定的水平方向、距離 view、俯角 elev 看向設施
  function rideView(r) {
    const target = new T.Vector3(r.pos[0], hitHeight(r) * .4, r.pos[2]);
    const [dx, dz] = r.dir || [0, 1], d = new T.Vector3(dx, 0, dz).normalize();
    const pos = target.clone().addScaledVector(d, r.view).add(new T.Vector3(0, r.view * (r.elev || .55), 0));
    return { pos, target };
  }
  const landView = landId => ({ pos: new T.Vector3(...landById[landId].view.pos), target: new T.Vector3(...landById[landId].view.target) });

  // ───────── 點擊判定（隱形外框，不加入場景，不會被畫出來）─────────
  const proxyMat = new T.MeshBasicMaterial();
  const proxies = [];
  for (const r of RIDES) {
    const geo = r.hit.box ? new T.BoxGeometry(...r.hit.box) : new T.CylinderGeometry(r.hit.cyl[0], r.hit.cyl[0], r.hit.cyl[1], 12);
    const m = new T.Mesh(geo, proxyMat);
    m.position.set(r.pos[0], hitHeight(r) / 2, r.pos[2]);
    m.userData.ride = r.id; m.updateMatrixWorld(true);
    proxies.push(m);
  }
  // 行駛中的小火車頭也可以點
  const trainProxy = new T.Mesh(new T.BoxGeometry(2.4, 3, 9), proxyMat);
  trainProxy.userData.ride = 'train'; proxies.push(trainProxy);
  const raycaster = new T.Raycaster(), ndc = new T.Vector2();
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.ride : null;
  }
  // 區分「點一下」與「拖曳視角」：移動小於 10px、按住少於 0.6 秒才算點擊
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  canvas.addEventListener('pointerup', e => {
    if (!down || !e.isPrimary) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
    down = null;
    if (moved < 10 && held < 600) { const id = pick(e.clientX, e.clientY); if (id) openQuest(id); }
  });
  // 觸控結束時取消瀏覽器補發的「點擊」，否則它會落在剛打開的闖關視窗按鈕上（例如誤按「回到樂園」）
  canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  let hoverAt = 0;
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons || performance.now() - hoverAt < 80) return;
    hoverAt = performance.now();
    canvas.style.cursor = pick(e.clientX, e.clientY) ? 'pointer' : 'grab';
  });

  // ───────── 設施名牌（HTML，跟著 3D 位置移動，可直接點）─────────
  const tagLayer = $('#ride-tags'), tags = {};
  for (const r of RIDES) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ride-tag';
    b.style.setProperty('--c', landById[r.land].color);
    b.innerHTML = `<span class="ic">${r.icon}</span><span class="nm">${r.name}</span><span class="st"></span>`;
    b.title = `${r.name}｜${landById[r.land].subject}・${r.topic}`;
    b.addEventListener('click', () => openQuest(r.id));
    tagLayer.appendChild(b);
    tags[r.id] = { el: b, ride: r, p: new T.Vector3(r.pos[0], r.label, r.pos[2]), on: true };
  }
  const tmp = new T.Vector3();
  function updateTags() {
    if (themed.anchors.train) tags.train.p.copy(themed.anchors.train).setY(4.2);
    const w = innerWidth, h = innerHeight;
    for (const id in tags) {
      const tg = tags[id];
      tmp.copy(tg.p).project(camera);
      const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
      if (visible !== tg.on) { tg.el.style.display = visible ? 'flex' : 'none'; tg.on = visible; }
      if (visible) {
        const d = camera.position.distanceTo(tg.p), s = Math.max(.72, Math.min(1.1, 38 / d));
        tg.el.style.transform = `translate(${(tmp.x * .5 + .5) * w}px,${(-tmp.y * .5 + .5) * h}px) translate(-50%,-100%) scale(${s.toFixed(3)})`;
        tg.el.style.zIndex = String(1000 - Math.round(d));
      }
    }
  }
  function refreshTags() {
    for (const id in tags) {
      tags[id].el.querySelector('.st').textContent = cleared(id) ? '⭐' : '';
      tags[id].el.classList.toggle('done', cleared(id));
    }
  }

  // ───────── HUD：年級、徽章、進度 ─────────
  const gradeSel = $('#grade-select');
  gradeSel.value = String(state.grade);
  gradeSel.addEventListener('change', () => { state.grade = +gradeSel.value; save(); toast(`已切換為 ${gradeSel.selectedOptions[0].textContent} 題目`); });
  const soundBtn = $('#sfx-toggle');
  const paintSound = () => { soundBtn.setAttribute('aria-pressed', String(state.sound)); soundBtn.textContent = state.sound ? '🔔 音效開' : '🔕 音效關'; };
  soundBtn.addEventListener('click', () => { state.sound = !state.sound; save(); paintSound(); sfx.click(); });
  paintSound();
  const badgeBox = $('#badges');
  for (const l of LANDS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'badge'; b.dataset.land = l.id;
    b.style.setProperty('--c', l.color);
    b.innerHTML = `<span>${l.icon}</span>`;
    b.title = `${l.name}（${l.subject}）徽章`;
    b.addEventListener('click', () => openLand(l.id));
    badgeBox.appendChild(b);
  }
  function refreshHud() {
    const n = RIDES.filter(r => cleared(r.id)).length;
    $('#progress-text').textContent = `${n} / ${RIDES.length}`;
    $('#progress-bar').style.width = `${n / RIDES.length * 100}%`;
    for (const b of badgeBox.children) b.classList.toggle('earned', landDone(b.dataset.land));
    $('#show-btn').style.display = allDone() ? 'flex' : 'none';
    refreshTags();
  }

  // ───────── 園區快速導覽列 ─────────
  const nav = $('#land-nav');
  const homeBtn = document.createElement('button');
  homeBtn.type = 'button'; homeBtn.className = 'nav-btn'; homeBtn.innerHTML = '<span>🗺️</span><b>全景</b>';
  homeBtn.addEventListener('click', () => { sfx.click(); hide($('#land-sheet')); flyTo(home.pos.clone(), home.target.clone()); });
  nav.appendChild(homeBtn);
  for (const l of LANDS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'nav-btn'; b.style.setProperty('--c', l.color);
    b.innerHTML = `<span>${l.icon}</span><b>${l.name}</b>`;
    b.addEventListener('click', () => openLand(l.id));
    nav.appendChild(b);
  }

  // ───────── 園區介紹面板（列出設施）─────────
  const sheet = $('#land-sheet');
  function openLand(landId) {
    sfx.click();
    const l = landById[landId], v = landView(landId);
    flyTo(v.pos, v.target);
    sheet.style.setProperty('--c', l.color);
    sheet.innerHTML = `
      <div class="sheet-head"><div><b>${l.icon} ${l.name}</b><small>${l.subject}・${l.desc}</small></div>
        <button type="button" class="x" aria-label="關閉">✕</button></div>
      <div class="sheet-list">${landRides(landId).map(r => `
        <button type="button" class="sheet-ride${cleared(r.id) ? ' done' : ''}" data-ride="${r.id}">
          <span class="ic">${r.icon}</span><span class="tx"><b>${r.name}</b><small>${r.topic}</small></span>
          <span class="go">${cleared(r.id) ? '⭐ 已過關' : '開始闖關 ▶'}</span></button>`).join('')}
      </div>`;
    sheet.querySelector('.x').addEventListener('click', () => hide(sheet));
    sheet.querySelectorAll('[data-ride]').forEach(b => b.addEventListener('click', () => openQuest(b.dataset.ride)));
    show(sheet);
  }

  // ───────── 闖關視窗 ─────────
  const modal = $('#quest-modal'), body = $('#quest-body'), head = $('#quest-head');
  let round = null, timer = null;
  const isOpen = () => modal.style.display !== 'none';
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function closeQuest() {
    stopTimer(); window.speechSynthesis?.cancel();
    hide(modal); show(tagLayer); round = null;
    document.dispatchEvent(new CustomEvent('jialan:quest', { detail: { open: false } })); // 背景音樂恢復音量
  }
  // 點視窗外的暗色背景可關閉。必須「按下」與「放開」都在背景上才算，
  // 避免平板觸控點設施時，延遲送達的點擊事件把剛打開的視窗立刻關掉。
  let openedAt = 0, downOnBackdrop = false;
  modal.addEventListener('pointerdown', e => { downOnBackdrop = e.target === modal; });
  modal.addEventListener('click', e => { if (performance.now() - openedAt < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  modal.addEventListener('click', e => { if (e.target === modal && downOnBackdrop && performance.now() - openedAt > 300) closeQuest(); downOnBackdrop = false; });
  $('#quest-close').addEventListener('click', closeQuest);
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') closeQuest();
    const n = '1234'.indexOf(e.key);
    if (n >= 0) body.querySelectorAll('.opt')[n]?.click();
    if (e.key === 'Enter') body.querySelector('.primary')?.click();
  });

  function openQuest(rideId) {
    const r = rideById[rideId], l = landById[r.land];
    sfx.click(); hide(sheet); hide(tagLayer);
    const v = rideView(r); flyTo(v.pos, v.target, 1.3);
    modal.style.setProperty('--c', l.color);
    head.innerHTML = `<span class="ic">${r.icon}</span><div><b>${r.name}</b><small>${l.icon} ${l.name}・${l.subject}｜${r.topic}</small></div>`;
    const best = state.rides[rideId]?.best;
    const grade = gradeSel.selectedOptions[0].textContent;
    const special = rideId === 'coaster' ? '<p class="note">⏱️ 速算挑戰：每題限時，越快越好！</p>'
      : rideId === 'swinger' ? '<p class="note">🎧 請打開聲音，按喇叭聽英語再作答。</p>' : '';
    body.innerHTML = `
      <div class="intro">
        <p>歡迎來到 <b>${r.name}</b>！回答 ${ROUND_SIZE} 題「${r.topic}」，答對 ${PASS_SCORE} 題就能點亮⭐，集滿一個園區的星星就能拿到 ${l.icon} 徽章。</p>
        ${special}
        <p class="meta">題目年級：<b>${grade}</b>${best != null ? `　最佳紀錄：<b>${best} / ${ROUND_SIZE}</b>` : ''}${cleared(rideId) ? '　⭐ 已過關' : ''}</p>
        <div class="actions"><button type="button" class="btn primary" id="start-round">開始闖關 ▶</button>
        <button type="button" class="btn" id="back-park">回到樂園</button></div>
      </div>`;
    $('#start-round').addEventListener('click', () => startRound(rideId));
    $('#back-park').addEventListener('click', closeQuest);
    show(modal, 'flex'); openedAt = performance.now(); downOnBackdrop = false;
    document.dispatchEvent(new CustomEvent('jialan:quest', { detail: { open: true } }));  // 背景音樂調小聲
    $('#start-round').focus({ preventScroll: true });
  }

  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startRound(rideId) {
    sfx.click();
    const band = bandOf(state.grade), bank = QUESTIONS[rideId]?.[band] || [];
    let qs = shuffle(bank).slice(0, ROUND_SIZE);
    if (rideId === 'coaster') { qs = []; const seen = new Set(); while (qs.length < ROUND_SIZE) { const q = makeSpeedMath(state.grade); if (!seen.has(q.q)) { seen.add(q.q); qs.push(q); } } }
    round = { rideId, qs: qs.map(q => ({ ...q, answer: q.options[0], shuffled: shuffle(q.options) })), i: 0, score: 0 };
    renderQuestion();
  }

  function renderQuestion() {
    stopTimer();
    const q = round.qs[round.i], r = rideById[round.rideId];
    const dots = round.qs.map((_, k) => `<i class="${k < round.i ? (round.qs[k].ok ? 'ok' : 'no') : k === round.i ? 'now' : ''}"></i>`).join('');
    // 英語題：題目「」中有英文時，提供發音按鈕
    const enWord = r.land === 'english' && !q.say ? (q.q.match(/「([A-Za-z][A-Za-z !?'.,]*)」/) || [])[1] : null;
    const sayText = q.say || enWord;
    body.innerHTML = `
      <div class="qtop"><div class="dots">${dots}</div><span>第 ${round.i + 1} / ${round.qs.length} 題</span></div>
      ${q.timed ? '<div class="timer"><i id="timer-bar"></i></div>' : ''}
      <div class="question">${fmt(q.q)}</div>
      ${sayText ? `<button type="button" class="btn speak" id="speak">🔊 ${q.say ? '再聽一次' : '聽發音'}</button><p class="note" id="speak-note" style="display:none"></p>` : ''}
      <div class="opts">${q.shuffled.map((o, k) => `<button type="button" class="opt" data-k="${k}"><em>${k + 1}</em><span>${fmt(o)}</span></button>`).join('')}</div>
      <div class="feedback" id="feedback" style="display:none"></div>`;
    body.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => answer(q.shuffled[+b.dataset.k], b)));
    if (sayText) {
      const doSpeak = () => {
        if (!speak(sayText)) { const n = $('#speak-note'); n.textContent = `（這台裝置不支援語音朗讀，請老師念出：${sayText}）`; show(n); }
      };
      $('#speak').addEventListener('click', doSpeak);
      if (q.say) setTimeout(doSpeak, 250);
    }
    if (q.timed) {
      const limit = { 3: 20, 4: 18, 5: 18, 6: 16 }[state.grade] || 18, t0 = performance.now();
      let lastSec = limit;
      timer = setInterval(() => {
        const left = limit - (performance.now() - t0) / 1000, bar = $('#timer-bar');
        if (bar) bar.style.width = `${Math.max(0, left / limit * 100)}%`;
        if (left <= 3 && Math.ceil(left) < lastSec) { lastSec = Math.ceil(left); sfx.tick(); }
        if (left <= 0) { stopTimer(); answer(null, null); }
      }, 100);
    }
  }

  function answer(choice, btn) {
    if (!round) return;
    stopTimer();
    const q = round.qs[round.i], ok = choice === q.answer;
    q.ok = ok; if (ok) round.score++;
    body.querySelectorAll('.opt').forEach(b => {
      b.disabled = true;
      if (q.shuffled[+b.dataset.k] === q.answer) b.classList.add('right');
    });
    if (btn && !ok) btn.classList.add('wrong');
    ok ? sfx.correct() : sfx.wrong();
    const fb = $('#feedback');
    const last = round.i === round.qs.length - 1;
    fb.className = 'feedback ' + (ok ? 'ok' : 'no');
    fb.innerHTML = `<b>${ok ? choose(['答對了！🎉', '太棒了！✨', '好厲害！👍', '完全正確！🌟']) : choice === null ? '時間到！⏰' : '再想想看！💪'}</b>
      ${ok ? '' : `<span>正確答案：${fmt(q.answer)}</span>`}
      ${q.explain ? `<p>${fmt(q.explain)}</p>` : ''}
      <button type="button" class="btn primary" id="next-q">${last ? '看結果 🏁' : '下一題 ▶'}</button>`;
    show(fb);
    $('#next-q').addEventListener('click', () => { sfx.click(); round.i++; last ? finishRound() : renderQuestion(); });
    $('#next-q').focus({ preventScroll: true });
    fb.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  const choose = a => a[Math.floor(Math.random() * a.length)];

  function finishRound() {
    const { rideId, score } = round, r = rideById[rideId], l = landById[r.land];
    const pass = score >= PASS_SCORE;
    const wasLand = landDone(r.land), wasAll = allDone();
    const rec = state.rides[rideId] || {};
    rec.best = Math.max(rec.best ?? 0, score);
    if (pass) rec.cleared = true;
    state.rides[rideId] = rec; save();
    const newBadge = pass && !wasLand && landDone(r.land);
    const newAll = pass && !wasAll && allDone();
    refreshHud();
    const next = RIDES.find(x => x.land === r.land && !cleared(x.id)) || RIDES.find(x => !cleared(x.id));
    body.innerHTML = `
      <div class="result ${pass ? 'pass' : ''}">
        <div class="big">${pass ? '⭐' : '💪'}</div>
        <h3>${pass ? '闖關成功！' : '差一點點，再挑戰一次！'}</h3>
        <p>答對 <b>${score}</b> / ${round.qs.length} 題${pass ? '' : `（需要答對 ${PASS_SCORE} 題）`}</p>
        ${newBadge ? `<div class="new-badge" style="--c:${l.color}"><span>${l.icon}</span>獲得「${l.name}」徽章！</div>` : ''}
        <div class="actions">
          <button type="button" class="btn ${pass ? '' : 'primary'}" id="again">再玩一次 🔁</button>
          ${next && next.id !== rideId ? `<button type="button" class="btn ${pass ? 'primary' : ''}" id="next-ride">下一站：${next.icon} ${next.name} ▶</button>` : ''}
          <button type="button" class="btn" id="to-park">回到樂園</button>
        </div>
      </div>`;
    $('#again').addEventListener('click', () => startRound(rideId));
    $('#next-ride')?.addEventListener('click', () => openQuest(next.id));
    $('#to-park').addEventListener('click', closeQuest);
    if (newBadge) sfx.badge(); else if (pass) sfx.pass(); else sfx.wrong();
    round = null;
    if (newAll) setTimeout(() => { closeQuest(); celebrate(); }, 1600);
  }

  // ───────── 全部過關：慶祝畫面＋煙火秀 ─────────
  const party = $('#celebrate');
  function startShow() {
    fireworksShow.active = true; fireworksShow.start = null;
    flyTo(home.pos.clone(), home.target.clone(), 2);
  }
  function celebrate() {
    state.celebrated = true; save();
    sfx.badge();
    party.querySelector('.party-badges').innerHTML = LANDS.map(l => `<span style="--c:${l.color}">${l.icon}</span>`).join('');
    show(party, 'flex');
    startShow();
  }
  party.querySelector('#party-close').addEventListener('click', () => hide(party));
  party.querySelector('#party-night').addEventListener('click', () => {
    const night = $('#night-mode');
    if (night.getAttribute('aria-pressed') !== 'true') night.click();
    hide(party); startShow();
  });
  $('#show-btn').addEventListener('click', () => { sfx.click(); startShow(); toast('🎆 煙火秀開始！'); });
  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('確定要清除所有星星和徽章，重新開始嗎？')) return;
    state.rides = {}; state.celebrated = false; save(); refreshHud(); toast('進度已重設');
  });

  // ───────── 小提示 ─────────
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; show(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => hide(t), 2600);
  }

  refreshHud();
  setTimeout(() => toast('點一下遊樂設施或名牌，就能開始闖關！'), 1200);

  // 測試或教學示範用（例如在主控台呼叫 jialan.openQuest('carousel')）
  window.jialan = { openQuest, openLand, celebrate, state, flyTo, finishFlight: () => { if (flight) flight.t = 1; } };

  return {
    get modalOpen() { return isOpen(); },
    update(t, dt) {
      if (flight) {
        flight.t += dt / flight.duration;
        const k = Math.min(1, flight.t), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        camera.position.lerpVectors(flight.fromPos, flight.pos, e);
        controls.target.lerpVectors(flight.fromTarget, flight.target, e);
        controls.update();
        if (k >= 1) flight = null;
      }
      if (themed.anchors.train) { trainProxy.position.copy(themed.anchors.train).setY(1.5); trainProxy.updateMatrixWorld(true); }
      if (tagLayer.style.display !== 'none') updateTags();
    }
  };
}
