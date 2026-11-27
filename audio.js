// 原創三拍子遊園曲，每小節六個八分音符位置，0 表示延續前音。
const bars = [
  ['C',  76,0,79,81,79,76], ['G',  74,0,71,74,79,0],
  ['Am', 76,0,72,76,81,83], ['Em', 79,0,0,76,74,0],
  ['F',  77,0,81,84,83,81], ['C',  79,0,76,72,74,76],
  ['Dm', 77,81,79,77,74,0], ['G',  71,74,77,0,79,83],

  ['C',  84,0,79,76,79,81], ['G',  83,0,79,74,71,74],
  ['Am', 81,0,76,72,76,79], ['Em', 83,0,79,76,0,0],
  ['F',  81,84,86,0,84,81], ['C',  79,76,72,0,76,79],
  ['G',  74,79,83,0,81,79], ['C',  84,0,0,0,79,76],

  ['F',  81,0,0,77,79,81], ['Bb', 82,0,77,74,77,0],
  ['F',  81,0,77,81,84,0], ['C7', 79,0,76,0,82,79],
  ['Dm', 77,0,74,77,81,84], ['Am', 83,81,79,76,0,0],
  ['D7', 78,81,84,0,81,78], ['G',  79,0,0,74,77,83],

  ['C',  84,0,79,81,79,76], ['G',  74,0,71,74,79,0],
  ['Am', 81,84,83,81,79,76], ['Em', 79,0,83,0,86,83],
  ['F',  84,81,77,0,81,84], ['Dm', 86,84,81,77,74,0],
  ['G',  79,0,74,77,83,0], ['C',  84,0,0,72,74,0],
];

const harmony = {
  C:[48,60,64,67], G:[43,59,62,67], Am:[45,60,64,69],
  Em:[40,59,64,67], F:[41,60,65,69], Dm:[38,62,65,69],
  Bb:[46,62,65,70], C7:[48,58,64,67], D7:[38,60,66,69],
};
const beat = 60 / 132;
const sampleRate = 32000;

// 先在記憶體合成整段樂曲，循環播放時僅需一個音源，畫面幀率不影響節拍。
async function renderWaltz() {
  const loopFrames = Math.round(bars.length * 3 * beat * sampleRate);
  const render = new OfflineAudioContext(2, loopFrames + Math.round(sampleRate * .72), sampleRate);
  const sum = render.createGain();
  sum.gain.value = .70;
  sum.connect(render.destination);
  for (const [time,volume,pan] of [[.071,.105,-.43],[.147,.065,.46],[.223,.042,.17]]) {
    const delay = render.createDelay(.5), echo = render.createGain(), place = render.createStereoPanner();
    delay.delayTime.value = time;
    echo.gain.value = volume;
    place.pan.value = pan;
    sum.connect(delay).connect(echo).connect(place).connect(render.destination);
  }
  function register(harmonics, pan) {
    const imag = Float32Array.from([0,...harmonics]);
    const wave = render.createPeriodicWave(new Float32Array(imag.length),imag);
    const channel = render.createStereoPanner();
    channel.pan.value = pan;
    channel.connect(sum);
    return {wave,channel};
  }
  const organ = register([1,.48,.24,.17,.07,.05,.035],-.12);
  const reed = register([1,.15,.36,.09,.08],.14);
  const bass = register([1,.24,.12,.045],-.06);
  const keys = register([1,.47,.12,.16,.055],.32);
  const bell = register([1,.03,.02,.38,.02,.015,.10],-.39);
  function note(voice,midi,when,length,volume,attack=.017,release=.065,detune=0) {
    const osc = render.createOscillator(), env = render.createGain();
    osc.setPeriodicWave(voice.wave);
    osc.frequency.value = 440 * 2 ** ((midi-69)/12);
    osc.detune.value = detune;
    const end = when + length;
    env.gain.setValueAtTime(.0001,when);
    env.gain.exponentialRampToValueAtTime(volume,when+attack);
    env.gain.exponentialRampToValueAtTime(volume*.65,end);
    env.gain.exponentialRampToValueAtTime(.0001,end+release);
    osc.connect(env).connect(voice.channel);
    osc.start(when); osc.stop(end+release+.003);
  }
  const brush = render.createBuffer(1,Math.round(sampleRate*.11),sampleRate);
  const grains = brush.getChannelData(0);
  let seed = 5381, previous = 0;
  for(let i=0;i<grains.length;i++){
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const rnd = seed / 2147483648 - 1;
    grains[i] = (rnd - previous) * .5 * Math.exp(-i/(sampleRate*.019));
    previous = rnd;
  }
  for(let bar=0;bar<bars.length;bar++){
    const [key,...phrase]=bars[bar], [root,...chord]=harmony[key];
    const start=bar*3*beat;
    note(bass,root,start,.69*beat,.158,.012,.074);
    for(let b=1;b<=2;b++){
      const at=start+b*beat+.013;
      chord.forEach((m,i)=>note(keys,m,at+i*.003,(b===1?.29:.24)*beat,b===1?.047:.041,.011,.075));
      const noise = render.createBufferSource(), gain = render.createGain();
      noise.buffer = brush;
      gain.gain.value = b===2?.022:.014;
      noise.connect(gain).connect(sum);
      noise.start(at+.005);
    }
    if(bar%4===3)note(bass,root+7,start+2.5*beat,.32*beat,.085,.012,.055);
    for(let step=0;step<6;step++){
      const midi=phrase[step];
      if(!midi)continue;
      let span=1;
      while(step+span<6 && phrase[step+span]===0)span++;
      const onset=start+beat*step*.5+(step%2?.013:0);
      const len=(span*.5-.075)*beat;
      const strength=step===0?.18:step%2?.133:.153;
      note(organ,midi,onset,len,strength);
      note(reed,midi,onset+.006,len*.97,strength*.32,.025,.07,4);
      if(step===0 || (step===4 && bar%2===0)){
        note(bell,midi+12,onset+.008,.052,bar%4===0?.053:.033,.005,.34);
      }
    }
  }
  const finished=await render.startRendering();
  // 將末拍的殘響折回開頭，首尾銜接保持自然。
  const loop=render.createBuffer(2,loopFrames,sampleRate);
  for(let ch=0;ch<2;ch++){
    const input=finished.getChannelData(ch), out=loop.getChannelData(ch);
    out.set(input.subarray(0,loopFrames));
    for(let i=loopFrames;i<input.length;i++)out[i-loopFrames]+=input[i];
  }
  return loop;
}

// 備援：老師提供的背景音樂檔無法載入時，改用原本即時合成的遊園圓舞曲。
function setupSynthMusic(button) {
  let audio, score, source;
  let wanted=true, unlocked=false, failed=false;
  function updateButton(){
    const playing=!!(source && audio.state==='running' && wanted && !document.hidden);
    button.dataset.playing=String(playing);
    button.setAttribute('aria-pressed',String(playing));
    const label=failed?'配樂目前無法播放':playing?'暫停遊樂園音樂':'播放遊樂園音樂';
    button.title=label;
    button.setAttribute('aria-label',label);
    button.disabled=failed;
    return playing;
  }
  function sync(){
    if(score && !source && wanted && !document.hidden && audio.state==='running'){
      source=audio.createBufferSource();
      source.buffer=score; source.loop=true;
      source.connect(audio.destination); source.start();
    }
    updateButton();
  }
  function activate(byGesture){
    if(failed || !wanted || document.hidden)return;
    try {
      if(!audio){
        audio=new AudioContext({latencyHint:'playback'});
        audio.addEventListener('statechange',()=>{
          // 快速切換分頁或連按按鈕時，較早的暫停指令可能較晚完成。
          if((!wanted || document.hidden) && audio.state==='running')suspend();
          else if(wanted && !document.hidden && unlocked && audio.state==='suspended')activate(false);
          else sync();
        });
        renderWaltz().then(buffer=>{score=buffer;sync();}).catch(()=>{failed=true;updateButton();});
      }
      if(byGesture)unlocked=true;
      if(audio.state==='running'){
        unlocked=true;
        sync();
      } else if(unlocked){
        audio.resume().then(sync).catch(updateButton);
      }
    } catch {
      failed=true;
      updateButton();
    }
  }
  function suspend(){
    if(audio?.state==='running')audio.suspend().then(sync).catch(updateButton);
    updateButton();
  }
  button.addEventListener('click',()=>{
    if(updateButton()){
      wanted=false;suspend();
    }else{
      wanted=true;activate(true);
    }
  });
  const unlockOnGesture=event=>{
    if(!event.target.closest?.('button') && wanted && !updateButton())activate(true);
  };
  document.addEventListener('click',unlockOnGesture);
  document.addEventListener('keydown',event=>{
    if(!event.repeat && (event.key==='Enter' || event.key===' '))unlockOnGesture(event);
  });
  document.addEventListener('visibilitychange',()=>document.hidden?suspend():activate(false));
  updateButton();
  activate(false);
}

// ===================================================================
// 嘉蘭遊樂場背景音樂：播放 assets/bgm.mp3（循環播放）
// - 「開啟音樂」按鈕切換播放／暫停；第一次點畫面也會開始（和原本園區相同）。
// - 音量約 0.5，開始時淡入；切到其他分頁時自動暫停，回來再淡入。
// - 闖關視窗打開時自動調小聲（英語聽力才聽得清楚），關閉後恢復。
// - 手機/平板（iOS、Android）必須由使用者點擊才能出聲，按鈕剛好提供這個動作。
// - 若音檔載入失敗，自動改用原本的合成配樂。
// ===================================================================
const BGM_URL = './assets/bgm.mp3';
const BGM_VOLUME = .5, DUCK_VOLUME = .15, FADE_SECONDS = 1.6;

export function setupMusic(button) {
  const el = new Audio();
  el.src = BGM_URL; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  el.setAttribute('playsinline', '');
  const listeners = new AbortController(), on = { signal: listeners.signal };
  let ctx = null, gain = null;           // 有 WebAudio 時用 GainNode 控制音量（iOS 不能直接改 audio.volume）
  let wanted = true, unlocked = false, failed = false, ducked = false, fadeTimer = 0;
  const target = () => (ducked ? DUCK_VOLUME : BGM_VOLUME);
  const getVol = () => (gain ? gain.gain.value : el.volume);
  function setVol(v) { if (gain) gain.gain.value = v; else el.volume = Math.max(0, Math.min(1, v)); }
  function fadeTo(v, seconds = FADE_SECONDS, then) {
    clearInterval(fadeTimer);
    const from = getVol(), t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      setVol(from + (v - from) * k);
      if (k >= 1) { clearInterval(fadeTimer); then?.(); }
    }, 40);
  }
  function updateButton() {
    const playing = !el.paused && wanted && !document.hidden;
    button.dataset.playing = String(playing);
    button.setAttribute('aria-pressed', String(playing));
    const label = playing ? '暫停遊樂園音樂' : '播放遊樂園音樂';
    button.title = label; button.setAttribute('aria-label', label);
    return playing;
  }
  function ensureGraph() {
    if (ctx || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
      gain = ctx.createGain(); gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
    } catch { ctx = null; gain = null; }
  }
  function play() {
    if (failed || !wanted || document.hidden || !unlocked) return;
    ensureGraph();
    ctx?.resume?.();
    if (el.paused) setVol(0);
    el.play().then(() => { fadeTo(target()); updateButton(); }).catch(() => updateButton());
  }
  function pause(fade = true) {
    if (el.paused) return updateButton();
    if (fade) fadeTo(0, .5, () => { el.pause(); updateButton(); });
    else { el.pause(); updateButton(); }
  }
  // 音檔讀取失敗 → 改用合成配樂
  el.addEventListener('error', () => {
    if (failed) return;
    failed = true; listeners.abort(); el.removeAttribute('src');
    console.info('背景音樂檔無法載入，改用合成配樂。');
    setupSynthMusic(button);
  }, on);
  el.addEventListener('play', updateButton, on);
  el.addEventListener('pause', updateButton, on);
  button.addEventListener('click', () => {
    if (failed) return;
    if (updateButton()) { wanted = false; pause(); }
    else { wanted = true; unlocked = true; play(); }
  }, on);
  // 第一次點畫面（不是按鈕）也開始播放，和原本園區的行為一致
  const unlockOnGesture = e => {
    if (failed || unlocked || e.target.closest?.('button')) return;
    unlocked = true; play();
  };
  document.addEventListener('click', unlockOnGesture, on);
  document.addEventListener('pointerup', e => { if (e.pointerType === 'touch') unlockOnGesture(e); }, on);
  document.addEventListener('keydown', e => { if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) unlockOnGesture(e); }, on);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause(false) : play()), on);
  // 闖關視窗開關（quest.js 送出）→ 調整音量
  document.addEventListener('jialan:quest', e => {
    ducked = !!e.detail?.open;
    if (!el.paused) fadeTo(target(), .6);
  }, on);
  updateButton();
  return { element: el };
}
