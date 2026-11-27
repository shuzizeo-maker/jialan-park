/* 四種煙火共用解析式軌跡，尾跡的每個取樣點都沿用同一顆火星的歷史位置。 */
const flightShader = `
  uniform float uAge, uDrag, uGravity, uTail, uKind, uPixels;
  attribute vec4 aFlight;
  attribute vec3 aScatter, aTint;
  attribute vec2 aSpark;
  varying vec3 vTint;
  varying float vAlpha;

  vec3 flightAt(float t) {
    t = max(0.0, t);
    float traveled = (1.0 - exp(-uDrag * t)) / uDrag;
    vec3 p = aFlight.xyz * traveled;
    p.y -= uGravity * (t - traveled) / uDrag;
    float f = aSpark.x * 42.0;
    p.x += (sin(f + 3.5*t) - sin(f)) * 0.027*t;
    p.z += (cos(f + 2.9*t) - cos(f)) * 0.034*t;
    float s = max(0.0, t - aSpark.y);
    p += aScatter * ((1.0 - exp(-2.2*s)) / 2.2);
    return p;
  }

  float energyAt(float t) {
    float lifetime = aFlight.w;
    float gate = smoothstep(aSpark.y-0.012, aSpark.y+0.045, t);
    float ending = 1.0-smoothstep(lifetime*0.74, lifetime, t);
    float f = aSpark.x*61.0;
    float shimmer = 0.91 + 0.09*sin(f + t*23.0);
    if (uKind > 2.5) {
      float blinking = pow(max(0.0, sin(t*(37.0+9.0*aSpark.x)+f)), 2.0);
      shimmer = mix(shimmer, 0.45+1.2*blinking, smoothstep(0.55,1.0,t));
    }
    if (uKind > 1.5 && uKind < 2.5) {
      shimmer = mix(shimmer, 0.66+0.49*abs(sin(t*(9.0+5.0*aSpark.x)+f)), smoothstep(1.6,2.9,t));
    }
    return gate * ending * shimmer;
  }
`;

const outputShader = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

const trailVertex = flightShader + `
  attribute vec2 aRibbon;
  varying float vAcross;
  void main() {
    float lag = aRibbon.x * uTail * (0.82 + 0.34*aSpark.x);
    float t = max(aSpark.y, uAge-lag);
    vec4 mv = modelViewMatrix * vec4(flightAt(t), 1.0);
    vec3 tangent = mat3(modelViewMatrix) * (flightAt(t+0.014)-flightAt(t));
    vec2 d = tangent.xy + vec2(0.00001,0.00001);
    vec2 side = normalize(vec2(-d.y,d.x));
    float pixel = max(0.0,-mv.z) / (uPixels*projectionMatrix[1][1]);
    float width = max(pixel*3.8, 0.147)*(0.9+0.20*aSpark.x);
    mv.xy += side * aRibbon.y * width * (1.0-0.46*aRibbon.x);
    gl_Position = projectionMatrix * mv;
    float sideFade = pow(1.0-aRibbon.x, 0.51);
    vAlpha = energyAt(t)*sideFade*smoothstep(aSpark.y+lag-0.03,aSpark.y+lag+0.025,uAge);
    vAlpha *= 1.0-smoothstep(aFlight.w,aFlight.w+uTail,uAge);
    vTint = mix(aTint, aTint*vec3(0.90,0.70,0.66), aRibbon.x*0.55);
    vAcross = aRibbon.y;
  }
`;
const trailFragment = `
  uniform float uDaylight;
  varying vec3 vTint;
  varying float vAlpha, vAcross;
  void main() {
    float core = 1.0-smoothstep(0.17,0.59,abs(vAcross));
    float feather = 1.0-smoothstep(0.39,1.0,abs(vAcross));
    gl_FragColor = vec4(vTint*1.21, min(1.0,vAlpha*(0.81*core+0.29*feather))*mix(1.,.42,uDaylight));
    ${outputShader}
  }
`;
const sparkVertex = flightShader + `
  void main() {
    vec4 mv = modelViewMatrix * vec4(flightAt(uAge),1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = energyAt(uAge);
    vTint = aTint;
    float radius = (0.34+0.17*aSpark.x) * (0.84+0.16*min(1.0,vAlpha));
    gl_PointSize = clamp(radius*uPixels*projectionMatrix[1][1]/max(1.0,-mv.z), 3.8, 25.0);
  }
`;
const sparkFragment = `
  uniform float uDaylight;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    vec2 xy = gl_PointCoord*2.0 - 1.0;
    float r = dot(xy,xy);
    float core = exp(-r*25.0);
    float halo = exp(-r*5.0);
    float magnitude = (core*0.66 + halo*0.62)*(1.0-smoothstep(0.73,1.0,r));
    gl_FragColor = vec4(mix(vTint, vec3(1.0,0.96,0.78),core*0.22)*1.25,magnitude*vAlpha*mix(1.,.66,uDaylight));
    ${outputShader}
  }
`;

const rocketVertex = `
  uniform float uAge, uLaunch, uHeight, uPixels;
  uniform vec2 uOffset;
  attribute vec3 aEmber;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float lag = aEmber.x;
    float p = clamp(1.0 + (uAge-lag)/uLaunch, 0.0, 1.0);
    float arc = sin(p*3.14159);
    vec3 pos = vec3(uOffset.x*(1.0-p)+arc*0.7,
                    -uHeight*(1.0-p-arc*0.15),
                    uOffset.y*(1.0-p));
    float loose = lag*lag;
    pos.x += aEmber.y * loose * 1.45;
    pos.z += aEmber.z * loose * 1.12;
    pos.y -= loose * 3.12;
    vec4 mv = modelViewMatrix * vec4(pos,1.0);
    gl_Position = projectionMatrix * mv;
    float head = 1.0-step(0.001,lag);
    gl_PointSize = clamp((0.21+0.26*head+0.07*abs(aEmber.z))*uPixels*projectionMatrix[1][1]/max(1.0,-mv.z), 3.0,22.0);
    vTint = mix(vec3(1.0,0.19,0.014),vec3(1.0,0.72,0.24),1.0-smoothstep(0.0,0.45,lag));
    vAlpha = (1.0-smoothstep(0.07,0.75,lag))*smoothstep(-uLaunch,-uLaunch+0.06,uAge-lag);
    vAlpha *= 1.0-smoothstep(0.0,0.13,uAge-lag);
    vAlpha *= 0.7 + 0.3*cos(aEmber.y*94.0+uAge*23.0);
  }
`;
const smokeVertex = `
  uniform float uAge, uPixels, uDaylight;
  uniform vec3 uSmokeColor;
  attribute vec3 aWisp;
  varying vec3 vSmoke;
  varying float vStrength, vSeed;
  void main() {
    float t = max(0.0,uAge);
    float spread = 0.58 + 0.46*(1.0-exp(-t));
    vec3 p = position*spread + vec3(t*0.65,t*0.48,0.0);
    vec4 mv = modelViewMatrix*vec4(p,1.0);
    gl_Position = projectionMatrix*mv;
    float size = (0.94 + t*0.45)*(1.0+aWisp.y)*(1.+.32*uDaylight);
    gl_PointSize = clamp(uPixels*projectionMatrix[1][1]*size/max(1.0,-mv.z),4.0,128.0);
    float flash = exp(-t*2.1);
    vSmoke = mix(vec3(0.12,0.14,0.19),uSmokeColor*0.8+vec3(0.22),flash);
    vec3 coloredSmoke=mix(vec3(.26,.28,.32),uSmokeColor*.52+vec3(.28),.58+.24*flash);
    vSmoke=mix(vSmoke,coloredSmoke,uDaylight);
    vStrength = (0.078+flash*0.20)*(1.0-smoothstep(2.0,5.0,t))*(0.6+0.4*aWisp.z);
    vStrength+=uDaylight*(.24+.14*flash)*(1.-smoothstep(1.9,5.,t))*(.7+.3*aWisp.z);
    vSeed = aWisp.x * 81.5 + t*0.09;
  }
`;
const smokeFragment = `
  varying vec3 vSmoke;
  varying float vStrength, vSeed;
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    vec2 basis = vec2(12.9898,78.233);
    float q = dot(i,basis);
    vec4 grains = fract(sin(q+vec4(0.0,basis.x,basis.y,basis.x+basis.y))*4375.55);
    return mix(mix(grains.x,grains.y,f.x),mix(grains.z,grains.w,f.x),f.y);
  }
  void main() {
    vec2 p = gl_PointCoord-0.5;
    float n = noise(p*4.0+vSeed)*0.52 + noise(p*9.0+vSeed)*0.32 + noise(p*21.0+vSeed)*0.16;
    float density = (1.0-smoothstep(0.1,0.51,length(p)))*smoothstep(0.22,0.78,n);
    gl_FragColor = vec4(vSmoke,vStrength*density);
    ${outputShader}
  }
`;

const tau = Math.PI * 2;
const period = 36;
// 每列依序為綻放時間、三維位置、花型與兩種花色。
const score = [
  [0.00, -14, 30, -27, 2, 0xffa724, 0xffd84c],
  [0.95, 12, 32, -25, 0, 0xff2459, 0xff7250],
  [2.69, 0, 35, -29, 1, 0x20efc1, 0xffc73a],
  [4.07, -16, 32, -24, 0, 0xad5bff, 0xff5296],
  [5.16, 15, 28, -22, 3, 0xff8c1c, 0xffcc48],
  [6.65, 1, 33, -28, 2, 0xffb522, 0xff8236],
  [8.10, -16, 28, -25, 1, 0xfd59bb, 0xffc84d],
  [9.02, 16, 34, -26, 0, 0x21d9dc, 0x8d76ff],
  [10.65, -2, 35, -29, 3, 0xfe7541, 0xffb732],
  [12.12, -14, 30, -25, 0, 0xfd3358, 0xff9055],
  [13.07, 14, 31, -25, 2, 0xffa425, 0xffce37],
  [14.75, 1, 35, -29, 1, 0xa166ff, 0xffbe44],
  [16.20, -16, 30, -23, 3, 0x20e9bf, 0xffc849],
  [17.13, 13, 33, -27, 0, 0xfd3e93, 0xffaded],
  [18.76, -4, 32, -29, 2, 0xffb124, 0xff852c],
  [20.05, -17, 34, -25, 1, 0x4cdafa, 0xffdc5b],
  [21.39, 15, 29, -25, 0, 0xff3e63, 0xff802d],
  [22.85, 0, 34, -29, 3, 0xa467ff, 0xffbf5a],
  [24.00, -16, 30, -24, 2, 0xffa424, 0xffdb55],
  [25.49, 14, 33, -26, 1, 0xff478d, 0xffad38],
  [26.72, 0, 35, -28, 0, 0x1ee5c4, 0x4fcaff],
  [28.19, -14, 31, -25, 3, 0xff7445, 0xffb837],
  [29.25, 16, 32, -26, 2, 0xffab2b, 0xffd751],
  [30.87, -1, 35, -29, 0, 0xb961fb, 0xf950b2],
  [32.25, -15, 30, -25, 1, 0x25d9d0, 0xffc532],
  [33.33, 14, 29, -24, 3, 0xff6549, 0xffc33a],
  [34.90, 0, 34, -28, 0, 0xff7750, 0xf02674]
];

function randomSequence(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state)+1013904223) >>> 0;
    return state/4294967296;
  };
}

function seedShell(T, style, primary, secondary, rand) {
  const sparks = [];
  const colors = [new T.Color(primary), new T.Color(secondary)];
  function emit(x,y,z,life,color,lag=0,scatter=[0,0,0]) {
    sparks.push({
      velocity:[x,y,z,life], scatter, tint:color.toArray(),
      phase:[rand(),lag]
    });
  }
  const count = [108,85,81,44][style];
  const offset = rand()*tau;
  for (let i=0; i<count; i++) {
    const a = i*2.39996323 + offset + (rand()-0.5)*0.19;
    const h = 1-2*(i+0.5)/count;
    const radial = Math.sqrt(1-h*h);
    let v = 6.55 + rand()*0.95;
    let x = Math.cos(a)*v*radial, y = h*v, z = Math.sin(a)*v*radial;
    let life = 2.65 + rand()*0.77;
    let tint = colors[(i%7)<2 ? 1:0];
    if (style === 1) {
      const inner = i >= 62;
      const angle = offset + tau*(inner ? (i-62)/23 : i/62);
      v = (inner ? 3.0:6.8)*(0.99+rand()*0.025);
      x = v*Math.cos(angle)*0.95;
      y = v*(Math.sin(angle)*0.94+Math.cos(angle)*0.09);
      z = v*(Math.cos(angle)*0.32 + Math.sin(angle)*0.29);
      life = 2.72 + rand()*0.38;
      tint = colors[inner ? 1 : 0];
    } else if (style === 2) {
      const height = (i+0.5)/count;
      const r = Math.sqrt(1-height*height)*(5.4+rand()*1.1);
      x = Math.cos(a)*r;
      z = Math.sin(a)*r;
      y = 1.2+height*6.4;
      life = 3.75+rand()*1.03;
    } else if (style === 3) {
      const split = 0.93 + rand()*0.60;
      emit(x,y,z,split+0.19,tint);
      for (let c=0; c<6; c++) {
        const v2 = 1.65+rand()*1.5;
        const h2 = rand()*2-1, r2 = Math.sqrt(1-h2*h2), a2 = rand()*tau;
        emit(x,y,z,split+0.84+rand()*0.58,colors[c%3 ? 1:0],split,
          [v2*Math.cos(a2)*r2,v2*h2,v2*Math.sin(a2)*r2]);
      }
      continue;
    }
    emit(x,y,z,life,tint);
  }
  // 內層短火星在爆點散開，外圈保留完整剪影。
  if (style === 0 || style === 2) {
    for (let i=0; i<28; i++) {
      const a = rand()*tau, h = rand()*2-1, r = Math.sqrt(1-h*h);
      emit(Math.cos(a)*r*3.4,h*3.4,Math.sin(a)*r*3.4,0.58+rand()*0.62,colors[1]);
    }
  }
  return sparks;
}

function sparkGeometry(T, sparks, subdivisions) {
  const p=[], v=[], s=[], col=[], ph=[], ribbon=[], index=[];
  for (const spark of sparks) {
    const base = p.length/3;
    const rows = subdivisions ? (subdivisions+1)*2 : 1;
    for (let j=0; j<rows; j++) {
      p.push(0,0,0);
      v.push(...spark.velocity);
      s.push(...spark.scatter);
      col.push(...spark.tint);
      ph.push(...spark.phase);
      if (subdivisions) ribbon.push(Math.floor(j/2)/subdivisions,j%2 ? 1:-1);
    }
    for (let j=0; j<subdivisions; j++) {
      const k = base+j*2;
      index.push(k,k+1,k+2,k+2,k+1,k+3);
    }
  }
  const geo = new T.BufferGeometry();
  for (const [name,array,width] of [['position',p,3],['aFlight',v,4],['aScatter',s,3],['aTint',col,3],['aSpark',ph,2]]) {
    geo.setAttribute(name,new T.Float32BufferAttribute(array,width));
  }
  if (subdivisions) {
    geo.setAttribute('aRibbon',new T.Float32BufferAttribute(ribbon,2));
    geo.setIndex(index);
  }
  return geo;
}

/** t 是場景啟動後累積的秒數，動畫與畫面更新率無關。 */
export function buildFireworks({ THREE: T, scene, dayCycle, onBurst, fireworksShow }) {
  // 煙火秀只在 fireworksShow.active 為 true 時播放一輪（約 36 秒），平常天空保持安靜。
  const show = fireworksShow || { active: true, start: 0 };
  const viewport = {value:1080};
  const daylight={value:0};
  const flashes = [new T.PointLight(),new T.PointLight()];
  for (const light of flashes) {
    light.intensity = 0;
    light.distance = 100;
    light.decay = 2;
    scene.add(light);
  }
  const shells = score.map(([beat,x,y,z,style,primary,secondary],id) => {
    const rand = randomSequence(8911 + 19037*id);
    const sparks = seedShell(T,style,primary,secondary,rand);
    const uniforms = {
      uAge:{value:0}, uKind:{value:style}, uPixels:viewport,uDaylight:daylight,
      uTail:{value:[1.50,0.93,2.14,0.72][style]},
      uDrag:{value:[0.56,0.56,0.48,0.62][style]},
      uGravity:{value:[2.1,1.7,3.2,1.95][style]},
      uLaunch:{value:1.75+rand()*0.34}, uHeight:{value:y-3.7},
      uOffset:{value:new T.Vector2((rand()-0.5)*9,2.0+rand()*2.1)},
      uSmokeColor:{value:new T.Color(primary)}
    };
    function material(vertexShader,fragmentShader,additive=true) {
      return new T.ShaderMaterial({
        uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,
        side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
        blending:additive ? T.AdditiveBlending:T.NormalBlending
      });
    }
    const group = new T.Group();
    group.position.set(x,y,z);
    const points = new T.Points(sparkGeometry(T,sparks,0),material(sparkVertex,sparkFragment));
    const trails = new T.Mesh(sparkGeometry(T,sparks,style===2 ? 10:4),material(trailVertex,trailFragment));
    const embers=[], wisp=[], smokePos=[];
    for (let i=0; i<64; i++) {
      embers.push(0.75*Math.pow(i/63,1.24),rand()*2-1,rand()*2-1);
    }
    for (let i=0; i<11; i++) {
      smokePos.push((rand()-0.5)*4.8, (rand()-0.5)*3.9, (rand()-0.5)*3.6);
      wisp.push(rand(),rand()*0.85,rand());
    }
    const rg = new T.BufferGeometry();
    rg.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(64*3),3));
    rg.setAttribute('aEmber',new T.Float32BufferAttribute(embers,3));
    const rocket = new T.Points(rg,material(rocketVertex,sparkFragment));
    const sg = new T.BufferGeometry();
    sg.setAttribute('position',new T.Float32BufferAttribute(smokePos,3));
    sg.setAttribute('aWisp',new T.Float32BufferAttribute(wisp,3));
    const smoke = new T.Points(sg,material(smokeVertex,smokeFragment,false));
    for (const [order,obj] of [[3,smoke],[4,trails],[5,points],[5,rocket]]) {
      obj.frustumCulled = false;
      obj.renderOrder = order;
      group.add(obj);
    }
    group.visible = false;
    scene.add(group);
    return {group,beat,style,uniforms,points,trails,rocket,smoke};
  });
  let previousTime=null;
  return (t) => {
    if (!show.active) {
      if (previousTime !== null) {
        for (const shell of shells) shell.group.visible = false;
        for (const light of flashes) light.intensity = 0;
        previousTime = null;
      }
      return;
    }
    if (show.start === null) show.start = t;
    daylight.value=dayCycle?.daylight ?? 0;
    viewport.value = Math.max(360,window.innerHeight)*Math.min(window.devicePixelRatio || 1, 1.5);
    const showTime=t-show.start+1.98, now=showTime%period;
    if (showTime > period + 6) { show.active = false; return; }
    let lightIndex = 0;
    for (const shell of shells) {
      let age = (now-shell.beat+period)%period;
      // 跨過此朵煙火的綻放點才發聲，切回背景分頁時跳過已過期的爆音。
      const burstTime=shell.beat+period*Math.floor((showTime-shell.beat)/period);
      if(previousTime!==null && previousTime<burstTime && showTime-burstTime<.35){
        onBurst?.(shell.style,shell.group.position,showTime-burstTime);
      }
      if (age > period-2.3) age -= period;
      shell.group.visible = age > -shell.uniforms.uLaunch.value && age < 6.20;
      if (!shell.group.visible) continue;
      shell.uniforms.uAge.value = age;
      shell.rocket.visible = age < 0.83;
      shell.smoke.visible = age >= 0 && age < 5.05;
      shell.points.visible = age >= 0 && age < (shell.style===2 ? 4.8:3.45);
      shell.trails.visible = age >= 0 && age < (shell.style===2 ? 6.18:4.35);
      if (age >= 0 && age < 2.1 && lightIndex < flashes.length) {
        const light = flashes[lightIndex++];
        light.position.copy(shell.group.position);
        light.color.copy(shell.uniforms.uSmokeColor.value);
        const echo = shell.style===3 && age>0.8 ? 0.18*Math.exp(-3.6*(age-0.8))*Math.pow(Math.sin(35*age),2):0;
        light.intensity = 3700*(1-daylight.value)**2*(Math.exp(-5.3*age)+0.13*Math.exp(-1.8*age)+echo);
      }
    }
    for (; lightIndex<flashes.length; lightIndex++) flashes[lightIndex].intensity=0;
    previousTime=showTime;
  };
}
