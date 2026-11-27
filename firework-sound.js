// 以短促破裂聲、低頻衝擊與衰減雜訊合成四款煙火，音訊只存在瀏覽器記憶體中。
function makeBurst(audio, style) {
  const rate=32000, seconds=[1.23,.96,1.58,1.72][style];
  const buffer=audio.createBuffer(1,Math.ceil(rate*seconds),rate);
  const samples=buffer.getChannelData(0);
  let state=28471+style*17579, bassNoise=0, midNoise=0, phase=0;
  const random=()=>((state=Math.imul(1664525,state)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<samples.length;i++){
    const t=i/rate, white=random()*2-1;
    bassNoise+=.023*(white-bassNoise);
    midNoise+=.21*(white-midNoise);
    const pitch=([47,64,40,54][style]+83*Math.exp(-t*13));
    phase+=2*Math.PI*pitch/rate;
    const onset=Math.min(1,t/.003);
    const thump=.70*Math.sin(phase)*Math.exp(-t*9);
    const snap=(white-midNoise)*.45*Math.exp(-t*39);
    const rumble=(2.45*bassNoise+.52*midNoise)*Math.exp(-t*(style===2?3.3:5.1));
    samples[i]=(thump+snap+rumble)*onset;
  }
  if(style===3){
    for(let j=0;j<36;j++){
      const start=Math.floor((.38+random()*1.05)*rate), len=Math.floor(rate*(.012+random()*.027));
      for(let k=0;k<len;k++)samples[start+k]+=(random()*2-1)*.35*Math.exp(-5*k/len)*Math.min(1,k/5);
    }
  }
  // 加入短距離反射聲，再將殘響平滑收尾。
  const echo=Math.round(rate*.143);
  for(let i=echo;i<samples.length;i++)samples[i]+=.17*samples[i-echo];
  for(let i=0;i<samples.length;i++)samples[i]=Math.tanh(samples[i])*Math.min(1,(samples.length-1-i)/(rate*.035));
  return buffer;
}

export function setupFireworkSound(button,camera) {
  let audio, buffers, wanted=true, unlocked=false;
  const voices=new Set();
  function active(){return wanted && !document.hidden && audio?.state==='running';}
  function updateButton(){
    const on=!!active();
    button.setAttribute('aria-pressed',String(on));
    button.title=on?'關閉煙火爆炸音效':'開啟煙火爆炸音效';
    button.setAttribute('aria-label',button.title);
  }
  function stopVoices(){
    for(const source of voices)source.stop();
    voices.clear();
  }
  function sync(){
    updateButton();
    if(!audio)return;
    if(!wanted || document.hidden){
      stopVoices();
      if(audio.state==='running')audio.suspend().catch(updateButton);
    }else if(unlocked && audio.state==='suspended'){
      audio.resume().catch(updateButton);
    }
  }
  try {
    audio=new AudioContext({latencyHint:'interactive'});
    unlocked=audio.state==='running';
    audio.addEventListener('statechange',sync);
  } catch {
    button.disabled=true;
    button.title='這個瀏覽器無法播放煙火音效';
    return ()=>{};
  }
  button.addEventListener('click',()=>{
    wanted=!active();
    unlocked=true;
    sync();
  });
  // Chrome 需要使用者操作時，可由音效按鈕或點擊園景解鎖。
  document.querySelector('canvas').addEventListener('click',()=>{
    if(wanted){unlocked=true;sync();}
  });
  document.addEventListener('visibilitychange',sync);
  updateButton();
  return (style,position,age)=>{
    if(!active())return;
    buffers??=[0,1,2,3].map(index=>makeBurst(audio,index));
    const dx=position.x-camera.position.x,dy=position.y-camera.position.y,dz=position.z-camera.position.z;
    const distance=Math.max(1,Math.hypot(dx,dy,dz));
    const right=camera.matrixWorld.elements;
    const source=audio.createBufferSource(), panner=audio.createStereoPanner(), gain=audio.createGain();
    source.buffer=buffers[style];
    source.playbackRate.value=.94+.10*Math.random();
    panner.pan.value=Math.max(-.85,Math.min(.85,(dx*right[0]+dy*right[1]+dz*right[2])/distance));
    gain.gain.value=.42/(1+distance*.005);
    source.connect(gain).connect(panner).connect(audio.destination);
    voices.add(source);
    source.onended=()=>{
      voices.delete(source);source.disconnect();gain.disconnect();panner.disconnect();
    };
    source.start(audio.currentTime+Math.max(0,Math.min(.42,distance/343)-age));
  };
}
