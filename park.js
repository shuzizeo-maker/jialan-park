import * as THREE from 'three';
import { buildEnvironment } from './environment.js';
import { buildRides } from './rides.js';
import { buildCoaster } from './coaster.js';
import { buildFireworks } from './fireworks.js';
import { skyAndWater } from './sky-water.js';
import { makeCinema } from './cinema.js';
import { getSunlight, parkClock, parkPreviewTime } from './park-time.js';
import { createParkCamera } from './camera-controls.js';
import { setupMusic } from './audio.js';
import { buildShuttles } from './shuttle.js';
import { buildFerry } from './ferry.js';
import { buildAirTraffic } from './air-traffic.js';
import { setupFireworkSound } from './firework-sound.js';
import { buildThemedRides } from './new-rides.js';
import { setupQuests } from './quest.js';

const canvas = document.querySelector('canvas');
// 平板與手機（觸控為主的裝置）降低解析度上限與陰影貼圖大小，讓學校平板也能順跑。
const touchDevice = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const highQuality = params.get('quality') === 'high';   // 網址加 ?quality=high 可關閉自動降畫質
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touchDevice || devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setClearColor(0x111b33);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.07;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate=false;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x26344e, 0.0050);
const camera = new THREE.PerspectiveCamera(46, 1, .25, 490);
const controls = createParkCamera(camera,canvas);
const clock = document.querySelector('#park-clock');
const lightButtons = Array.from(document.querySelectorAll('[data-light-mode]'), button => ({
  button, label: button.querySelector('span'), defaultLabel: button.textContent.trim(), defaultTitle: button.title
}));
setupMusic(document.querySelector('#music'));

// 漆面和黃銅反射夜空、地面的暖光和月光。環境圖完全在記憶體中繪製。
const envCanvas = document.createElement('canvas');
envCanvas.width = 256;
envCanvas.height = 128;
const env = envCanvas.getContext('2d');
const band = env.createLinearGradient(0, 0, 0, 128);
for (const [stop, hex] of [[0,'#7285ba'],[.38,'#34416c'],[.54,'#b3a094'],[.62,'#584150'],[1,'#322623']]) band.addColorStop(stop, hex);
env.fillStyle = band;
env.fillRect(0,0,256,128);
for (const [x,y,r,c] of [[188,35,16,'#d8eaff'],[38,67,18,'#ffc283'],[106,61,9,'#fff2c9'],[220,69,7,'#e7c9ab']]) {
  const glow = env.createRadialGradient(x,y,0,x,y,r);
  glow.addColorStop(0,c); glow.addColorStop(1,'transparent');
  env.fillStyle=glow; env.fillRect(x-r,y-r,2*r,2*r);
}
const texture = new THREE.CanvasTexture(envCanvas);
texture.mapping = THREE.EquirectangularReflectionMapping;
texture.colorSpace = THREE.SRGBColorSpace;
scene.environment = texture;
scene.environmentIntensity = .27;
const ambient = new THREE.HemisphereLight(0x95b2f0, 0x423139, .50);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0xb3cdff, 1.16);
moon.position.set(-26, 37, -21);
moon.castShadow=true;
Object.assign(moon.shadow.camera,{left:-40,right:40,top:32,bottom:-31,near:.5,far:106});
moon.shadow.mapSize.set(touchDevice&&!highQuality?1024:2048,touchDevice&&!highQuality?1024:2048);
moon.shadow.normalBias=.026;moon.shadow.bias=-.00018;
scene.add(moon);
const fill = new THREE.DirectionalLight(0xffbb83, .38);
fill.position.set(-13, 19, 29);
scene.add(fill);
const parkLights=[];
// 最後一盞是嘉蘭城堡正面的夜間投射燈。
for (const [x,y,z,color,intensity,range] of [[-11.7,3.7,10.5,0xff9d4c,105,18],[-1,4.4,18.3,0xffa155,91,14],[13,4.4,14,0xf08c45,115,17],[-13,5,-6,0x70ceeb,175,25],[16,7,-5,0xff996a,145,24],[0,7,-17.5,0xffc8e6,190,22]]) {
  const l = new THREE.PointLight(color,intensity,range,2);
  l.position.set(x,y,z);
  parkLights.push({light:l,intensity});
  scene.add(l);
}

// 整座園區靜態燈泡共用一筆繪圖呼叫；近景呈現白熱燈芯與柔光。
class Bulbs {
  constructor() {
    this.position=[]; this.color=[]; this.data=[];
    this.uniforms={time:{value:0},pixels:{value:1080},power:{value:0}};
  }
  add(x,y,z,color,size=.07,group=0,phase=0) {
    const c=new THREE.Color(color);
    this.position.push(x,y,z); this.color.push(c.r,c.g,c.b); this.data.push(size,group,phase);
  }
  finish() {
    const g=new THREE.BufferGeometry();
    for(const [name,values] of [['position',this.position],['lightColor',this.color],['lamp',this.data]]) g.setAttribute(name,new THREE.Float32BufferAttribute(values,3));
    const mat=new THREE.ShaderMaterial({
      uniforms:this.uniforms, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
      vertexShader:`
        attribute vec3 lightColor,lamp;
        uniform float time,pixels,power;
        varying vec3 c; varying float intensity;
        void main(){
          vec4 mv=modelViewMatrix*vec4(position,1.);
          float w=cos(6.28318*(lamp.z-time*.29)+lamp.y*1.7);
          intensity=power*mix(.72,1.26,pow(.5+.5*w,2.));
          c=lightColor;
          gl_Position=projectionMatrix*mv;
          gl_PointSize=clamp(pixels*projectionMatrix[1][1]*lamp.x*3.8/max(1.,-mv.z),3.2,76.);
        }`,
      fragmentShader:`
        varying vec3 c; varying float intensity;
        void main(){
          float d=length(gl_PointCoord*2.-1.);
          if(d>=1.)discard;
          float core=1.-smoothstep(.06,.28,d);
          vec3 rgb=(c*.87+vec3(.13))*core*2.4+c*.51*exp(-4.4*d)*(1.-d);
          gl_FragColor=vec4(rgb*intensity,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const points=new THREE.Points(g,mat);
    this.points=points;
    points.renderOrder=3; points.frustumCulled=false; scene.add(points);
  }
}
const bulbs=new Bulbs();
const dayCycle={daylight:0,dusk:0,lamps:0,sunDirection:new THREE.Vector3()};
const onBurst=setupFireworkSound(document.querySelector('#burst-sound'),camera);
// 煙火秀開關：五大園區全部過關後由 quest.js 啟動（active=true）。
const fireworksShow={active:false,start:null};
const ctx={THREE,scene,camera,renderer,bulbs,dayCycle,onBurst,fireworksShow};
const color=n=>new THREE.Color(n);
const palette={
  nightFog:color(0x26344e), dayFog:color(0xc1dbeb), duskFog:color(0xb68989),
  nightSky:color(0x95b2f0), daySky:color(0xe1efff), nightGround:color(0x423139), dayGround:color(0xa7937c),
  moon:color(0xb3cdff), sun:color(0xfff0d3), sunset:color(0xffa16b)
};
const lunarDirection=new THREE.Vector3(-26,37,-21).normalize(), solarDirection=new THREE.Vector3();
let lastWallSecond=-1;
let lightMode='live';
function refreshTime(force=false) {
  const now=Date.now(), second=Math.floor(now/1000);
  if(!force && second===lastWallSecond)return;
  lastWallSecond=second;
  const date=new Date(now), solar=getSunlight(parkPreviewTime(date,lightMode));
  clock.textContent=parkClock(date);
  clock.dateTime=date.toISOString();
  const {daylight,dusk,lamps}=solar;
  Object.assign(dayCycle,{daylight,dusk,lamps});
  dayCycle.sunDirection.set(solar.east,solar.up,-solar.north);
  ambient.color.copy(palette.nightSky).lerp(palette.daySky,daylight);
  ambient.groundColor.copy(palette.nightGround).lerp(palette.dayGround,daylight);
  ambient.intensity=.50+1.09*daylight;
  solarDirection.copy(dayCycle.sunDirection);
  solarDirection.y=Math.max(.055,solarDirection.y);
  moon.position.copy(lunarDirection).lerp(solarDirection.normalize(),daylight).normalize().multiplyScalar(51);
  moon.color.copy(palette.moon).lerp(palette.sun,daylight).lerp(palette.sunset,.78*dusk);
  moon.intensity=1.16+1.48*daylight-.65*dusk;
  fill.intensity=.38+.15*daylight;
  scene.environmentIntensity=.27+.34*daylight;
  scene.fog.color.copy(palette.nightFog).lerp(palette.dayFog,daylight).lerp(palette.duskFog,.57*dusk);
  renderer.toneMappingExposure=1.07-.16*daylight;
  for(const {light,intensity} of parkLights)light.intensity=intensity*lamps;
  bulbs.uniforms.power.value=lamps;
  if(bulbs.points)bulbs.points.visible=lamps>0;
}
for (const {button} of lightButtons) {
  button.addEventListener('click', () => {
    const selected=button.dataset.lightMode;
    lightMode=lightMode===selected ? 'live' : selected;
    for (const control of lightButtons) {
      const active=control.button.dataset.lightMode===lightMode;
      control.button.setAttribute('aria-pressed',String(active));
      control.label.textContent=active ? '恢復即時' : control.defaultLabel;
      control.button.title=active ? '恢復臺灣現在時間的日夜光照' : control.defaultTitle;
    }
    refreshTime(true);
  });
}
refreshTime();
const atmosphere=skyAndWater(ctx);
const environment=buildEnvironment(ctx);
const rides=buildRides(ctx);
const coaster=buildCoaster(ctx);
const fireworks=buildFireworks(ctx);
const shuttles=buildShuttles(ctx);
const ferry=buildFerry(ctx);
const airTraffic=buildAirTraffic(ctx);
const themed=buildThemedRides(ctx);   // 新增的主題設施與招牌
bulbs.finish();
bulbs.points.visible=dayCycle.lamps>0;
scene.traverse(obj=>{
  if(!obj.isMesh || !obj.material?.isMeshStandardMaterial)return;
  obj.castShadow=obj.geometry.boundingSphere?.radius !== 0 && !obj.material.map;
  obj.receiveShadow=true;
});
const cinema=makeCinema(THREE,renderer);
const quests=setupQuests({THREE,camera,controls,canvas,fireworksShow,themed});
// 效能檢查用：在主控台輸入 jialanPerf() 可看到繪圖呼叫次數與三角形數量。
window.jialanPerf=()=>new Promise(done=>{
  const info=renderer.info; info.autoReset=false; info.reset(); const f0=performance.now();
  setTimeout(()=>{ const n=Math.max(1,info.render.frame), r={fps:+(n/((performance.now()-f0)/1000)).toFixed(1),callsPerFrame:Math.round(info.render.calls/n),trianglesPerFrame:Math.round(info.render.triangles/n),pixelRatio:renderer.getPixelRatio(),quality}; info.autoReset=true; done(r); },2000);
});

// 自動畫質：每 2 秒檢查一次平均幀率，太低就逐步降低解析度（最低 0.6 倍）。
let quality=1, fpsFrames=0, fpsTime=0;
function resize() {
  const w=innerWidth,h=innerHeight;
  const cap=touchDevice&&!highQuality ? 1.15 : 1.35;
  renderer.setPixelRatio(Math.max(.5,Math.min(devicePixelRatio,cap,1450/Math.max(w,h))*quality));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(46/2))/Math.min(1,camera.aspect)));
  camera.updateProjectionMatrix();
  bulbs.uniforms.pixels.value=canvas.height;
  cinema.resize(canvas.width,canvas.height);
}
addEventListener('resize',resize);
resize();
let start, previous, shadowTime=-1, lastDraw=0, firstFrame=true;
renderer.setAnimationLoop((now)=>{
  if(start===undefined) start=previous=now;
  // 闖關視窗打開時，背景只需約 20 fps，把效能留給介面並省電。
  if(quests.modalOpen && now-lastDraw<48) return;
  lastDraw=now;
  const t=(now-start)*.001, dt=Math.min(.08,(now-previous)*.001);
  previous=now;
  if(!highQuality && !quests.modalOpen && t>4){
    fpsFrames++; fpsTime+=dt;
    if(fpsTime>2){
      const fps=fpsFrames/fpsTime; fpsFrames=0; fpsTime=0;
      if(fps<38 && quality>.6){ quality=Math.max(.6,quality-.15); resize(); }
    }
  }
  refreshTime();
  controls.update();
  bulbs.uniforms.time.value=t;
  atmosphere(t,dt); environment(t,dt); rides(t,dt); coaster(t,dt); fireworks(t,dt); shuttles(t,dt);
  ferry(t,dt); airTraffic(t,dt); themed.update(t,dt); quests.update(t,dt);
  if(t-shadowTime>.065){renderer.shadowMap.needsUpdate=true;shadowTime=t;}
  cinema.draw(scene,camera,dayCycle.daylight);
  if(firstFrame){ firstFrame=false; document.querySelector('#loading').style.display='none'; }
});
