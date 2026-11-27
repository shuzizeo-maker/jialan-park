// 三座遊樂設施共用低面數的鑄鐵、黃銅與彩繪木構件。
export function buildRides({ THREE: T, scene, dayCycle }) {
  const PI = Math.PI;
  const TAU = PI * 2;
  const ruby = 0x983d4a, garnet = 0x602532, coral = 0xde796a;
  const teal = 0x2c696b, aqua = 0x57a7a3, deep = 0x203f49;
  const gold = 0xd9a45d, gilt = 0xf1c77c, ivory = 0xf2deaa;
  const wine = 0x722a3c, bronze = 0x926647, timber = 0x794930;
  const honey = 0xffba57, vanilla = 0xffdc8a, rose = 0xff7778;
  const mint = 0x70ece6, lilac = 0xcaa6ff;
  const origin = new T.Vector3();
  const v = (x, y, z) => new T.Vector3(x, y, z);
  const identity = new T.Quaternion(), up = v(0, 1, 0);
  const rotation = (x, y, z) => new T.Quaternion().setFromEuler(new T.Euler(x, y, z));
  const painted = new T.MeshStandardMaterial({
    vertexColors: true, metalness: 0.29, roughness: 0.51, side: T.DoubleSide,
  });
  const geometryCache = new Map();
  function primitive(key, create) {
    if (!geometryCache.has(key)) {
      const source = create();
      geometryCache.set(key, source.index ? source.toNonIndexed() : source);
      if (source.index) source.dispose();
    }
    return geometryCache.get(key);
  }
  const box = primitive('box', () => new T.BoxGeometry(1, 1, 1));
  const globe = primitive('globe', () => new T.SphereGeometry(1, 12, 8));
  const cylinder = (sides = 10, top = 1) => primitive('c' + sides + '/' + top,
    () => new T.CylinderGeometry(top, 1, 1, sides));
  // 將固定部件依局部座標合成單一模型，避免為每一根桁條發出繪圖指令。
  function batch() {
    const pts = [], normals = [], cols = [];
    const matrix = new T.Matrix4(), normalMatrix = new T.Matrix3();
    const a = new T.Vector3(), b = new T.Vector3(), color = new T.Color();
    function put(geometry, pos, scale, quat, tint) {
      matrix.compose(pos, quat, scale);
      normalMatrix.getNormalMatrix(matrix);
      color.set(tint);
      const p = geometry.attributes.position, n = geometry.attributes.normal;
      for (let k = 0; k < p.count; k++) {
        a.fromBufferAttribute(p, k).applyMatrix4(matrix);
        b.fromBufferAttribute(n, k).applyNormalMatrix(normalMatrix);
        pts.push(a.x, a.y, a.z);
        normals.push(b.x, b.y, b.z);
        cols.push(color.r, color.g, color.b);
      }
    }
    function triangle(p, q, r, tint) {
      a.subVectors(q, p);
      b.subVectors(r, p);
      a.cross(b).normalize();
      color.set(tint);
      for (const s of [p, q, r]) {
        pts.push(s.x, s.y, s.z);
        normals.push(a.x, a.y, a.z);
        cols.push(color.r, color.g, color.b);
      }
    }
    return {
      put, triangle,
      quad(p, q, r, s, c) { triangle(p, q, r, c); triangle(p, r, s, c); },
      box(x, y, z, w, h, d, c, quat = identity) {
        put(box, v(x, y, z), v(w, h, d), quat, c);
      },
      oval(x, y, z, w, h, d, c, quat = identity) {
        put(globe, v(x, y, z), v(w, h, d), quat, c);
      },
      drum(x, y, z, radius, height, tint, sides = 24, top = 1, quat = identity) {
        put(cylinder(sides, top), v(x, y, z), v(radius, height, radius), quat, tint);
      },
      rod(p, q, r, c, sides = 6, taper = 1) {
        const d = q.clone().sub(p), length = d.length();
        if (length < 0.0001) return;
        const direction = new T.Quaternion().setFromUnitVectors(up, d.multiplyScalar(1 / length));
        put(cylinder(sides, taper), q.clone().add(p).multiplyScalar(0.5),
          v(r, length, r), direction, c);
      },
      ring(x, y, z, r, tube, c, quat = identity, seg = 60) {
        const geometry = primitive(['r', r, tube, seg].join('/'),
          () => new T.TorusGeometry(r, tube, 6, seg));
        put(geometry, v(x, y, z), v(1, 1, 1), quat, c);
      },
      mesh() {
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
        geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
        geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
        geo.computeBoundingSphere();
        return new T.Mesh(geo, painted);
      },
    };
  }
  const lampTime = { value: 0 }, pixelHeight = { value: 1080 };
  const lampPower = { value: 0 }, lightObjects=[];
  const lampMaterial = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { clock: lampTime, pixelHeight, lampPower },
    vertexShader: `
      attribute vec3 lampColor;
      attribute vec2 lampInfo;
      uniform float clock,lampPower;
      uniform float pixelHeight;
      varying vec3 hue;
      varying float intensity;
      void main(){
        vec4 eye = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(lampInfo.x * 3.8 * pixelHeight * projectionMatrix[1][1] / -eye.z, 2.5, 42.0);
        float chase = 0.5 + 0.5*cos(lampInfo.y*6.2831853 - clock*2.65);
        intensity = lampPower*(0.54 + 0.62*chase*chase);
        float ripple = 0.5 + 0.5*sin(lampInfo.y*9.0 - clock*0.79);
        hue = mix(lampColor, lampColor.gbr, 0.13*ripple*ripple);
      }
    `,
    fragmentShader: `
      varying vec3 hue;
      varying float intensity;
      void main(){
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        if(r > 1.0) discard;
        float bulb = 1.0-smoothstep(0.11,0.28,r);
        float halo = 0.36*exp(-4.8*r)*(1.0-r);
        gl_FragColor = vec4(mix(hue, vec3(1.0,0.94,0.80), 0.66*bulb)*2.5,
          min(1.0, (bulb + halo)*intensity));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  function lamps() {
    const positions = [], colors = [], info = [];
    const c = new T.Color();
    return {
      add(x, y, z, hue, size, phase) {
        positions.push(x, y, z);
        c.set(hue);
        colors.push(c.r, c.g, c.b);
        info.push(size, phase);
      },
      mesh() {
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geo.setAttribute('lampColor', new T.Float32BufferAttribute(colors, 3));
        geo.setAttribute('lampInfo', new T.Float32BufferAttribute(info, 2));
        const lights=new T.Points(geo, lampMaterial);
        lightObjects.push(lights);
        return lights;
      },
    };
  }
  function setGroup(parent, x, y, z) {
    const group = new T.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }
  const verticalDisc = rotation(PI / 2, 0, 0);
  const levelRing = verticalDisc;
  const polar = (r, a, z) => v(r * Math.cos(a), r * Math.sin(a), z);
  const polarGround = (r, a, y) => v(r * Math.cos(a), y, r * Math.sin(a));
  function circleOfLights(pool, radius, y, segments, tint, size, offset = 0) {
    for (let i = 0; i < segments; i++) {
      const a = TAU * i / segments;
      pool.add(radius * Math.cos(a), y, radius * Math.sin(a), tint, size, offset + i / segments * 3);
    }
  }

  // 摩天輪的前後兩層輪框以斜撐連成箱形桁架。
  const wheel = setGroup(scene, -13, 12.55, -9);
  const rotor = setGroup(wheel, 0, 0, 0);
  const metal = batch(), ironwork = batch(), wheelBulbs = lamps(), fixedBulbs = lamps();
  const radius = 10.1, count = 18;
  for (const side of [-1, 1]) {
    const z = side * 1.03;
    for (const [r, thick, color] of [[10.15, 0.133, gold], [9.18, 0.105, aqua], [7.02, 0.079, gold], [1.65, 0.11, gilt]]) {
      metal.ring(0, 0, z, r, thick, color);
    }
    for (let i = 0; i < count; i++) {
      const a = TAU * i / count, mid = a + PI / count, next = a + TAU / count;
      metal.rod(polar(1.48, a - 0.34, z), polar(9.20, a, z), 0.072, ivory);
      metal.rod(polar(1.48, a + 0.34, z), polar(9.20, a, z), 0.066, aqua);
      metal.rod(polar(7, mid, z), polar(9.2, a, z), 0.049, gold);
      metal.rod(polar(7, mid, z), polar(9.2, next, z), 0.049, gold);
      metal.rod(polar(9.18, a, z), polar(10.1, mid, z), 0.070, ivory);
      metal.rod(polar(10.1, mid, z), polar(9.18, next, z), 0.070, ivory);
      for (let j = 0; j < 11; j++) {
        const ang = a + (j / 11) * TAU / count;
        const p = polar(10.22, ang, z + side * 0.1), q = polar(9.18, ang, z + side * 0.10);
        wheelBulbs.add(p.x,p.y,p.z, vanilla,0.107, i/4 + j/44);
        wheelBulbs.add(q.x,q.y,q.z, [rose,mint,lilac][Math.floor(i/3)%3],0.098, i/3 - j/33);
      }
      for (let j = 1; j <= 11; j++) {
        const start = polar(1.50, a - 0.34, z), end = polar(9.17, a, z);
        const p = start.lerp(end,j/12);
        wheelBulbs.add(p.x,p.y,z+side*0.08, i%3 === 0 ? mint : honey, 0.092, j/11-i/12);
      }
      metal.rod(polar(radius, a, -1.05), polar(radius, mid, 1.05), 0.069, teal);
      if (side === 1) metal.rod(polar(radius, a, -1.20), polar(radius, a, 1.20), 0.13, gold);
    }
    metal.drum(0,0,z,1.65,0.28,teal,48,1,verticalDisc);
    metal.ring(0,0,z+side*0.23,1.38,0.1,gilt);
    for (let i = 0; i < 16; i++) {
      const a = TAU*i/16, b = a+TAU/16;
      metal.triangle(polar(0.34,a,z+side*0.22),polar(1.27,a+0.07,z+side*0.22),
        polar(0.68,b,z+side*0.22), i%2 ? ruby : ivory);
      const p = polar(1.40,a,z+side*0.34);
      wheelBulbs.add(p.x,p.y,p.z,vanilla,0.125,i/16);
    }
    metal.oval(0,0,z+side*0.20,0.47,0.47,0.24,gilt);
  }
  rotor.add(metal.mesh(), wheelBulbs.mesh());
  ironwork.rod(v(0,0,-2.5),v(0,0,2.5),0.35,bronze,16);
  for (const side of [-1,1]) {
    const sz = side*2.04;
    for (const dir of [-1,1]) {
      const base = v(dir*5.7,-12.26,side*3.28), tip = v(dir*0.35,-0.08,sz);
      const base2 = v(dir*4.73,-12.26,side*2.7), tip2 = v(dir*0.15,-0.19,sz);
      ironwork.rod(base,tip,0.24,teal,8);
      ironwork.rod(base2,tip2,0.17,aqua,8);
      ironwork.box(base.x,-12.20,base.z,1.26,0.55,1.24,bronze);
      for (let i = 0; i < 10; i++) {
        const p = base.clone().lerp(tip,i/10), q = base2.clone().lerp(tip2,(i+1)/10);
        ironwork.rod(p,q,0.068,gold);
        const l = base.clone().lerp(tip,(i+0.5)/10);
        fixedBulbs.add(l.x,l.y,l.z+side*0.23,vanilla,0.12,i/15);
      }
    }
    ironwork.rod(v(-4.2,-9.08,side*3.0),v(4.2,-9.08,side*3.0),0.12,teal);
    ironwork.drum(0,0,sz,0.70,0.25,gold,24,1,verticalDisc);
    ironwork.oval(0,0,sz+side*0.18,0.48,0.48,0.13,ruby);
  }
  for (const dir of [-1,1]) {
    ironwork.rod(v(dir*4.8,-10.5,-3.09),v(dir*4.8,-10.5,3.09),0.18,teal);
    ironwork.rod(v(dir*4.8,-10.5,-3.09),v(dir*2.7,-5.8,2.61),0.12,aqua);
  }
  ironwork.box(0,-12.2,0,9.2,0.58,4.3,teal);
  ironwork.box(0,-11.88,0,9.45,0.17,4.45,gold);
  wheel.add(ironwork.mesh(),fixedBulbs.mesh());

  function makeCabin(paint, second) {
    const b = batch();
    b.drum(0,-1.40,0,0.75,0.48,paint,10,1.24);
    b.drum(0,-1.69,0,0.55,0.13,gold,10,1.33);
    b.drum(0,-1.17,0,0.936,0.13,ivory,10);
    b.drum(0,-1.05,0,0.86,0.105,second,10);
    for (let i = 0; i < 6; i++) {
      const a = i*TAU/6;
      b.rod(polarGround(0.78,a,-1.09),polarGround(0.82,a,-0.13),0.042,gilt,6);
    }
    b.drum(0,-0.13,0,0.98,0.12,second,12);
    b.drum(0,0.02,0,1.02,0.22,paint,12,0.35);
    b.rod(v(0,0.12,0),v(0,0.51,0),0.075,gilt);
    b.rod(v(0,0.50,-0.92),v(0,0.50,0.92),0.075,bronze);
    for (const k of [-1,1]) {
      b.oval(k*0.29,-1.00,k*0.12,0.19,0.32,0.14,k<0 ? deep : teal);
      b.oval(k*0.29,-0.63,k*0.12,0.126,0.143,0.12,k<0 ? 0xcc9778 : 0xa87355);
    }
    return b.mesh();
  }
  const cabinTypes = [[ruby,coral],[teal,aqua],[0x655680,0x9a81af],[0xbc794a,gold]];
  const cabins = cabinTypes.map(([a,b]) => makeCabin(a,b));
  const baskets = [];
  const cabinLights = lamps();
  for (let i=0; i<count; i++) {
    const cabin= cabins[i%cabins.length].clone();
    wheel.add(cabin);
    baskets.push(cabin);
    for (let j=0;j<6;j++) cabinLights.add(0,0,0,[honey,mint,rose,vanilla][i%4],0.118,i/8+j/15);
  }
  const gondolaLights=cabinLights.mesh();
  gondolaLights.frustumCulled=false;
  const gondolaPositions=gondolaLights.geometry.attributes.position;
  gondolaPositions.setUsage(T.DynamicDrawUsage);
  wheel.add(gondolaLights);

  // 頂棚由放射狀絹布裁片、波浪簷幕與橢圓飾章組成。
  const carousel = setGroup(scene,-11,0,10);
  const deck = setGroup(carousel,0,0,0);
  deck.name='旋轉木馬轉盤';
  const base = batch(), pavilion = batch(), marquee = lamps();
  for (const [y,r,h,c] of [[0.18,5.32,0.35,teal],[0.4,5.16,0.19,gold],[0.55,4.95,0.16,wine]]) {
    base.drum(0,y,0,r,h,c,64);
  }
  carousel.add(base.mesh());
  pavilion.drum(0,0.7,0,4.82,0.28,timber,64);
  pavilion.ring(0,0.71,0,4.84,0.125,gilt,levelRing);
  pavilion.drum(0,2.82,0,1.36,4.20,teal,16);
  pavilion.drum(0,1.17,0,1.60,0.40,ruby,16);
  pavilion.drum(0,4.39,0,1.62,0.45,ruby,16);
  for (let i=0;i<16;i++) {
    const ang=TAU*i/16, p=polarGround(1.39,ang,2.83);
    pavilion.rod(polarGround(1.38,ang,1.35),polarGround(1.38,ang,4.3),0.07,gilt);
    const panelAngle=ang+PI/16, dir=rotation(0,-panelAngle+PI/2,0);
    const panel=polarGround(1.37,panelAngle,2.92);
    pavilion.oval(panel.x,panel.y,panel.z,0.20,0.86,0.075,i%2?ivory:aqua,dir);
    marquee.add(p.x,1.54,p.z,vanilla,0.11,i/8);
  }
  const panels = 20, bands = [[0.16,7.37],[0.78,6.91],[2.25,6.25],[3.60,5.86],[4.56,5.59],[5.01,5.60]];
  for (let i=0;i<panels;i++) {
    for (let j=0;j<3;j++) {
      const a=TAU*(i+j/3)/panels, b=TAU*(i+(j+1)/3)/panels;
      const stripe = i%4===0 ? ruby : i%4===2 ? teal : ivory;
      for(let k=0;k<bands.length-1;k++){
        const [r1,y1]=bands[k], [r2,y2]=bands[k+1];
        pavilion.quad(polarGround(r1,a,y1),polarGround(r1,b,y1),polarGround(r2,b,y2),polarGround(r2,a,y2),stripe);
      }
      const yA=5.09-0.19*Math.sin(PI*j/3), yB=5.09-0.19*Math.sin(PI*(j+1)/3);
      pavilion.quad(polarGround(5.01,b,5.60),polarGround(5.01,a,5.60),polarGround(5.01,a,yA),polarGround(5.01,b,yB),i%2 ? wine : teal);
      pavilion.rod(polarGround(5.015,a,yA),polarGround(5.015,b,yB),0.047,gilt);
      marquee.add(5.06*Math.cos(a),yA-0.045,5.06*Math.sin(a),vanilla,0.14,(i+j/3)/8);
    }
    const a=TAU*i/panels, mid=a+PI/panels;
    for(let k=0;k<bands.length-1;k++){
      const [r1,y1]=bands[k], [r2,y2]=bands[k+1];
      pavilion.rod(polarGround(r1,a,y1+0.018),polarGround(r2,a,y2+0.018),0.035,gold);
    }
    const rim=polarGround(5.04,mid,5.31), face=rotation(0,PI/2-mid,0);
    pavilion.oval(rim.x,rim.y,rim.z,0.28,0.18,0.074,gilt,face);
    pavilion.oval(rim.x*1.012,rim.y,rim.z*1.012,0.17,0.105,0.05,i%2 ? coral : aqua,face);
    if(i%2===0) {
      pavilion.rod(polarGround(1.4,a,4.34),polarGround(4.94,a,5.33),0.085,gold);
      for(let k=1;k<9;k++){
        const p=polarGround(0.78+(k/9)*4.1,a,6.87-1.33*Math.pow(k/9,0.72));
        marquee.add(p.x,p.y+0.06,p.z,vanilla,0.105,i/8+k/12);
      }
    }
  }
  pavilion.ring(0,5.63,0,5.00,0.094,gilt,levelRing);
  pavilion.drum(0,7.44,0,0.26,0.22,gold,16,0.5);
  pavilion.oval(0,7.69,0,0.23,0.28,0.23,gilt);
  pavilion.rod(v(0,7.76,0),v(0,8.43,0),0.047,gold,8);
  pavilion.triangle(v(0,8.40,0),v(0.92,8.22,0.12),v(0,7.99,0),ruby);
  circleOfLights(marquee,4.98,0.72,92,honey,0.125);
  circleOfLights(marquee,5.04,5.62,100,rose,0.11,0.35);
  function makeHorse(bodyColor, hair, blanket){
    const b=batch();
    b.oval(0,0.06,0,0.67,0.34,0.235,bodyColor);
    b.oval(0.39,0.32,0,0.32,0.56,0.205,bodyColor,rotation(0,0,-0.37));
    b.oval(0.66,0.72,0,0.28,0.265,0.16,bodyColor,rotation(0,0,-0.32));
    b.oval(0.86,0.65,0,0.245,0.158,0.132,bodyColor,rotation(0,0,-0.17));
    for(const s of [-1,1]) {
      b.oval(0.545,0.98,0.083*s,0.077,0.15,0.054,bodyColor,rotation(0,0,0.27*s));
      b.oval(0.735,0.77,0.149*s,0.038,0.039,0.020,deep);
      b.rod(v(0.57,0.81,s*0.154),v(0.91,0.57,s*0.147),0.034,gold);
      b.rod(v(0.90,0.62,s*0.145),v(0.15,0.19,s*0.232),0.018,garnet);
    }
    b.oval(0.02,0.27,0,0.36,0.13,0.253,blanket);
    b.oval(-0.05,0.35,0,0.27,0.1,0.22,bronze);
    for(let k=0;k<6;k++) b.oval(0.22+k*0.068,0.51+k*0.06,0,0.15,0.18,0.119,hair);
    b.oval(-0.68,-0.015,0,0.22,0.14,0.108,hair,rotation(0,0,0.55));
    b.oval(-0.83,-0.16,0,0.21,0.105,0.084,hair,rotation(0,0,0.78));
    b.oval(-0.90,-0.29,0,0.15,0.083,0.06,hair,rotation(0,0,0.80));
    for(const s of [-1,1]) for(const fore of [-1,1]){
      const x=fore*0.42,z=s*0.135;
      const kneeX=x+(fore===1 ? (s===1?0.30:0.02) : (s===1?-0.22:0.16));
      const kneeY=s===fore ? -0.37 : -0.47, toeX=kneeX-fore*0.16;
      b.rod(v(x,-0.05,z),v(kneeX,kneeY,z),0.102,bodyColor,7,0.70);
      b.rod(v(kneeX,kneeY,z),v(toeX,kneeY-0.25,z),0.068,bodyColor,7,0.76);
      b.oval(toeX+0.027,kneeY-0.26,z,0.096,0.069,0.061,hair);
    }
    return b.mesh();
  }
  const horseTypes=[makeHorse(ivory,0xba7145,teal),makeHorse(0xa95a39,0x53372e,ruby),makeHorse(0xc7c1ac,0x496066,wine)];
  const horses=[];
  for(let i=0;i<14;i++) {
    const a=TAU*i/14, r=i%2 ? 2.65 : 3.83;
    const p=polarGround(r,a,0), horse=horseTypes[i%3].clone();
    horse.name='旋轉木馬馬匹';
    horse.position.set(p.x,2,p.z);
    horse.rotation.y=-a-PI/2;
    deck.add(horse);
    horses.push(horse);
    pavilion.rod(v(p.x,0.84,p.z),v(p.x,5.49,p.z),0.054,gilt,10);
    pavilion.drum(p.x,1.02,p.z,0.13,0.16,gold,12);
    pavilion.drum(p.x,4.79,p.z,0.12,0.18,gold,12);
  }
  deck.add(pavilion.mesh(),marquee.mesh());

  // 船體採逐根肋骨生成的曲面，船首與船尾上揚，座艙固定在擺臂末端。
  const pier=setGroup(scene,13,0,15), pendulum=setGroup(pier,0,8.72,0);
  pier.rotation.y=-0.13;
  const frame=batch(), frameLights=lamps(), vessel=batch(), shipLights=lamps();
  frame.box(0,0.18,0,11.3,0.35,4.85,teal);
  frame.box(0,0.40,0,11.08,0.14,4.72,timber);
  // 棧板上的黃銅羅盤玫瑰與護欄呼應船首的鎏金裝飾。
  for(let plank=0;plank<32;plank++){
    frame.box(-5.36+plank*.346,.474,0,.332,.017,4.53,
      [0x755039,0x825b42,0x8c6347,0x80593e][plank%4]);
  }
  for(const s of [-1,1]){
    frame.box(0,.49,s*2.275,10.90,.024,.055,gilt);
    for(let i=0;i<9;i++){
      const x=-5.12+i*1.28;
      frame.rod(v(x,.46,s*2.31),v(x,1.04,s*2.31),.041,bronze,7);
      frame.oval(x,1.05,s*2.31,.066,.076,.066,gilt);
    }
    frame.rod(v(-5.12,.93,s*2.31),v(5.12,.93,s*2.31),.033,gold,7);
  }
  for(let i=0;i<8;i++){
    const a=i*TAU/8,len=i%2===0?1.8:1.07;
    const tip=v(Math.sin(a)*len,.491,Math.cos(a)*len);
    const left=v(Math.sin(a-.35)*.45,.491,Math.cos(a-.35)*.45);
    const right=v(Math.sin(a+.35)*.45,.491,Math.cos(a+.35)*.45);
    frame.triangle(v(0,.491,0),left,tip,gold);
    frame.triangle(v(0,.491,0),tip,right,teal);
  }
  for(const side of [-1,1]) {
    const z=side*2.19;
    for(const dir of [-1,1]) {
      const p=v(dir*4.89,0.44,z), q=v(dir*0.10,8.75,side*1.4);
      const p2=v(dir*4.12,0.47,z), q2=v(dir*0.04,8.55,side*1.38);
      frame.rod(p,q,0.202,teal,8); frame.rod(p2,q2,0.115,aqua,8);
      frame.box(p.x,0.60,z,0.81,0.31,0.60,gold);
      for(let j=0;j<12;j++) {
        const a=p.clone().lerp(q,j/12), b=p2.clone().lerp(q2,(j+1)/12);
        frame.rod(a,b,0.043,gold,5);
        const star=p.clone().lerp(q,(j+0.6)/12);
        frameLights.add(star.x,star.y,star.z+side*0.19,j%4===0 ? mint : vanilla,0.145, j/9+dir*0.7);
      }
    }
    frame.drum(0,8.72,side*1.64,0.56,0.28,gold,24,1,verticalDisc);
    frame.ring(0,8.72,side*1.83,0.47,0.065,ivory);
    frame.oval(0,8.72,side*1.86,0.26,0.26,0.12,ruby);
    frameLights.add(0,8.72,side*1.99,rose,0.23,0);
  }
  frame.rod(v(0,8.72,-1.68),v(0,8.72,1.68),0.23,bronze,14);
  pier.add(frame.mesh(),frameLights.mesh());
  const shipCentre=-6.0;
  function rib(x) {
    const u=Math.abs(x)/4.86, width=1.36*Math.pow(Math.max(0,1-u*u),0.7)+0.065;
    const top=shipCentre+0.28+1.63*Math.pow(u,3.5), keel=shipCentre-0.98+2.3*Math.pow(u,2.9);
    return { x, width, top, keel };
  }
  function cross(r,t,side) {
    return v(r.x,r.keel+(r.top-r.keel)*t,side*r.width*Math.pow(t,0.54));
  }
  const levels=[0,0.26,0.43,0.58,0.66,0.88,0.96,1];
  const planks=[garnet,0x9a5437,0xb77446,ivory,ruby,gold,ivory];
  for(let i=0;i<28;i++) {
    const a=rib(-4.85+i*9.70/28), b=rib(-4.85+(i+1)*9.70/28);
    vessel.quad(cross(a,1,-1),cross(b,1,-1),cross(b,1,1),cross(a,1,1),timber);
    for(const s of [-1,1]) {
      for(let j=0;j<levels.length-1;j++)
        vessel.quad(cross(a,levels[j],s),cross(b,levels[j],s),cross(b,levels[j+1],s),cross(a,levels[j+1],s),planks[j]);
      const p=cross(a,1,s), q=cross(b,1,s);
      vessel.rod(p,q,0.074,gilt,6);
      const lo=cross(a,0.64,s);
      shipLights.add(lo.x,lo.y,lo.z+0.05*s,honey,0.145,i/7);
      if(i%3===0) {
        const high=cross(a,0.76,s);
        vessel.drum(high.x,high.y,high.z,0.123,0.075,gilt,12,1,verticalDisc);
        vessel.drum(high.x,high.y,high.z+s*0.04,0.085,0.083,deep,12,1,verticalDisc);
      }
    }
  }
  for(const s of [-1,1]) {
    for(const d of [-1,1]) {
      const from=v(0,-0.04,s*1.13), to=v(d*2.63,shipCentre+0.52,s*1.09);
      vessel.rod(from,to,0.112,bronze,8);
      vessel.rod(from,v(d*3.65,shipCentre+0.95,s*0.73),0.040,gilt,6);
      for(let j=1;j<12;j++) {
        const p=from.clone().lerp(to,j/12);
        shipLights.add(p.x,p.y,p.z+0.13*s,j%3===0?rose:vanilla,0.109,j/12-d*0.33);
      }
    }
  }
  for(const dir of [-1,1]) {
    const r=rib(4.82*dir);
    let p=v(r.x,r.keel,0);
    for(const [x,y] of [[4.96,0.22],[5.09,0.54],[5.07,0.79],[4.90,0.91],[4.70,0.77],[4.79,0.65]]) {
      const q=v(x*dir,r.top+y,0);
      vessel.rod(p,q,0.095,gilt,7);
      p=q;
    }
    shipLights.add(4.97*dir,r.top+0.8,0,honey,0.20,dir*0.4);
  }
  for(let i=0;i<7;i++) {
    const x=-2.85+i*0.93,r=rib(x),y=r.top;
    vessel.box(x,y+0.24,0,0.69,0.20,1.72,teal);
    vessel.box(x-0.29,y+0.43,0,0.15,0.57,1.81,ruby,rotation(0,0,0.1));
    vessel.rod(v(x+0.35,y+0.46,-0.82),v(x+0.35,y+0.46,0.82),0.041,gold);
    for(const s of [-1,1]) {
      if ((i+(s>0?1:0))%3===1) continue;
      vessel.oval(x,y+0.55,0.42*s,0.136,0.23,0.157,[teal,deep,ruby,0x7f81ac][(i+1)%4]);
      vessel.oval(x+0.024,y+0.84,0.42*s,0.116,0.145,0.124,i%2 ? 0xbd8e72 : 0xe0b591);
    }
  }
  pendulum.add(vessel.mesh(),shipLights.mesh());
  const canvas = document.querySelector('canvas');
  function update(time) {
    lampTime.value=time;
    lampPower.value=dayCycle.lamps;
    for(const lights of lightObjects)lights.visible=dayCycle.lamps>0;
    pixelHeight.value=canvas?.height || window.innerHeight;
    const angle=time*TAU/70+0.09;
    rotor.rotation.z=angle;
    for(let i=0;i<count;i++) {
      const a=TAU*i/count+angle, x=radius*Math.cos(a), y=radius*Math.sin(a)-0.50;
      baskets[i].position.set(x,y,0);
      for(let j=0;j<6;j++) {
        const k=TAU*j/6;
        gondolaPositions.setXYZ(i*6+j,x+0.976*Math.cos(k),y-0.15,0.976*Math.sin(k));
      }
    }
    gondolaPositions.needsUpdate=true;
    // 馬頭沿圓周朝前，轉盤繞 Y 軸負向旋轉時，馬匹會沿同一條切線前進。
    deck.rotation.y=0.25-time*TAU/25;
    for(let i=0;i<horses.length;i++) horses[i].position.y=2.04+0.34*Math.sin(time*1.72+i*2.28);
    pendulum.rotation.z=0.88*Math.sin(time*TAU/8.1-0.32);
  }
  update(0);
  return update;
}
