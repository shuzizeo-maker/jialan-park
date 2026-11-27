// 嘉蘭遊樂場新增的主題設施：城堡、環球小火車、分數落塔、叢林咖啡杯、太空艙、飛天書本、聽力飛椅與園區招牌。
// 效能原則：每個「不會動的部分」或「一起動的部分」都先合併成一個網格（mergeGeometries），
// 顏色寫進頂點色，所有設施共用少數幾個材質，平板也能順跑。
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANDS, RIDES, TRAIN_TRACK, rideById } from './lands.js';

export function buildThemedRides(ctx) {
  const { THREE: T, scene, bulbs, dayCycle } = ctx;
  const tau = Math.PI * 2, V = (x, y, z) => new T.Vector3(x, y, z), up = V(0, 1, 0);

  // —— 共用材質（頂點色）——
  const paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .16 });
  const metal = new T.MeshStandardMaterial({ vertexColors: true, roughness: .34, metalness: .58 });
  const glow = new T.MeshStandardMaterial({ vertexColors: true, roughness: .4, emissive: 0xffd08a, emissiveIntensity: 0 });

  // —— 共用基本形狀 ——
  const G = {
    box: new T.BoxGeometry(1, 1, 1),
    cyl: new T.CylinderGeometry(1, 1, 1, 14),
    cyl6: new T.CylinderGeometry(1, 1, 1, 6),
    cyl8: new T.CylinderGeometry(1, 1, 1, 8),
    cone: new T.ConeGeometry(1, 1, 14),
    cone4: new T.ConeGeometry(1, 1, 4),
    ball: new T.SphereGeometry(1, 12, 8),
    torus: new T.TorusGeometry(1, .12, 6, 24),
  };
  for (const g of Object.values(G)) g.deleteAttribute('uv');

  // Kit：把許多小零件收集起來，最後合併成一個網格（一次繪圖呼叫）。
  function kit() {
    const parts = [], m = new T.Matrix4(), q = new T.Quaternion(), col = new T.Color();
    function add(geo, color, x, y, z, sx, sy, sz, quat) {
      const g = geo.clone();
      m.compose(V(x, y, z), quat || q.identity(), V(sx, sy, sz));
      g.applyMatrix4(m);
      col.set(color);
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      parts.push(g);
    }
    const rotY = a => new T.Quaternion().setFromAxisAngle(up, a);
    const api = {
      add,
      box: (c, x, y, z, w, h, d, ry = 0) => add(G.box, c, x, y, z, w, h, d, ry ? rotY(ry) : null),
      cyl: (c, x, y, z, r, h, geo = G.cyl) => add(geo, c, x, y, z, r, h, r),
      cone: (c, x, y, z, r, h, geo = G.cone) => add(geo, c, x, y, z, r, h, r),
      ball: (c, x, y, z, r, sy = r, sz = r) => add(G.ball, c, x, y, z, r, sy, sz),
      ring: (c, x, y, z, R, thick = 1) => add(G.torus, c, x, y, z, R, R, R * thick, new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)),
      // 兩點之間的圓柱（桁架、鏈條、扶手）
      beam(c, a, b, r, geo = G.cyl8) {
        const d = b.clone().sub(a), len = d.length(), mid = a.clone().lerp(b, .5);
        add(geo, c, mid.x, mid.y, mid.z, r, len, r, new T.Quaternion().setFromUnitVectors(up, d.normalize()));
      },
      geometry() {
        const mixed = parts.some(p => !p.index) && parts.some(p => p.index);
        const g = mergeGeometries(mixed ? parts.map(p => p.index ? p.toNonIndexed() : p) : parts, false);
        parts.length = 0;
        return g;
      },
      build(material = paint) {
        // 有索引與無索引（例如二十面體）的形狀混在一起時，統一轉成無索引再合併
        const mixed = parts.some(p => !p.index) && parts.some(p => p.index);
        const g = mergeGeometries(mixed ? parts.map(p => p.index ? p.toNonIndexed() : p) : parts, false);
        parts.length = 0;
        g.computeBoundingSphere();
        return new T.Mesh(g, material);
      },
      get empty() { return parts.length === 0; }
    };
    return api;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g;
  }
  // 把 kit 依材質分別合併放進 group
  function finish(parent, kits) {
    for (const [k, mat] of kits) if (!k.empty) parent.add(k.build(mat));
  }
  // 會動的小零件：把所有 kit 合併成「一個」網格（共用 paint 材質），減少繪圖呼叫
  function finishOne(parent, kits) {
    const geos = kits.filter(([k]) => !k.empty).map(([k]) => k.geometry());
    const anyNon = geos.some(g => !g.index) && geos.some(g => g.index);
    const g = mergeGeometries(anyNon ? geos.map(x => x.index ? x.toNonIndexed() : x) : geos, false);
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, paint); parent.add(mesh); return mesh;
  }
  // 靜態燈泡（共用整座園區的燈泡點雲；只能用在不會動的結構上）
  function bulb(gx, gz, x, y, z, color = 0xffcf82, size = .07, phase = 0) { bulbs.add(gx + x, y, gz + z, color, size, 1, phase); }

  // 園區配色（延續原本的維多利亞遊樂園色調）
  const C = { stone: 0xc5a186, cream: 0xf3ce99, ivory: 0xf4e6d4, teal: 0x185957, red: 0xa44546, gold: 0xe7a860,
    iron: 0x2a4147, pink: 0xe6a9b4, blue: 0x3d62b3, navy: 0x1d2c55, white: 0xf1efe9, wood: 0x9a6a48, dark: 0x2f2b33 };

  const updates = [];
  const anchors = {}; // 會移動的設施（小火車）即時位置，給點擊與名牌使用

  // ————————————————————————————————————————————————
  // 1. 嘉蘭城堡（世界城堡的地標，位於主街盡頭）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.castle.pos;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit(), w = kit();
    s.box(C.stone, 0, .3, 0, 13.4, .6, 7);
    // 城牆四面
    s.box(C.ivory, 0, 2.4, 2.1, 11, 3.6, .9); s.box(C.ivory, 0, 2.4, -2.1, 11, 3.6, .9);
    for (const sx of [-1, 1]) s.box(C.ivory, sx * 5.1, 2.4, 0, .9, 3.6, 4.6);
    s.box(C.pink, 0, 4.3, 2.1, 11.2, .3, 1.05);
    // 城垛
    for (let i = 0; i < 13; i++) { const x = -4.8 + i * .8; if (Math.abs(x) > 1.1) s.box(C.ivory, x, 4.7, 2.3, .42, .5, .5); }
    // 城門（深色拱門＋金色門框＋拱頂）
    s.box(C.dark, 0, 1.6, 2.58, 2.0, 2.6, .1);
    s.add(G.cyl, C.dark, 0, 2.9, 2.58, 1.0, .1, 1.0, new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    m.ring(C.gold, 0, 2.9, 2.65, 1.08, .5);
    for (const sx of [-1, 1]) m.box(C.gold, sx * 1.05, 1.6, 2.64, .12, 2.6, .12);
    // 四座角樓
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 5.6, z = sz * 2.5;
      s.cyl(C.ivory, x, 3.4, z, 1.05, 6.8);
      s.cyl(C.pink, x, 6.95, z, 1.22, .45);
      for (let k = 0; k < 8; k++) { const a = k / 8 * tau; s.box(C.ivory, x + Math.cos(a) * 1.08, 7.35, z + Math.sin(a) * 1.08, .3, .4, .3, -a); }
      s.cone(C.blue, x, 8.9, z, 1.3, 3.1);
      m.ball(C.gold, x, 10.55, z, .16);
      w.box(0x2c3a66, x, 5.2, z + sz * 1.02, .4, .8, .08);
      bulb(cx, cz, x, 7.25, z + sz * 1.25, 0xffd08a, .09, (x + z) * .1);
    }
    // 中央主堡與高塔
    s.box(C.ivory, 0, 6.4, -.4, 6.2, 4.6, 3.6);
    s.box(C.pink, 0, 8.8, -.4, 6.4, .35, 3.8);
    for (let i = 0; i < 9; i++) s.box(C.ivory, -2.8 + i * .7, 9.2, 1.4, .36, .45, .36);
    s.cyl(C.ivory, 0, 12, -.4, 1.55, 7);
    s.cyl(C.pink, 0, 15.6, -.4, 1.75, .45);
    s.cone(C.blue, 0, 18.4, -.4, 1.9, 5.2);
    m.ball(C.gold, 0, 21.2, -.4, .2);
    for (const sx of [-1, 1]) {           // 主堡兩側小尖塔
      s.cyl(C.ivory, sx * 2.6, 10.4, .9, .6, 3.2);
      s.cone(C.blue, sx * 2.6, 13, .9, .75, 2.1);
      m.ball(C.gold, sx * 2.6, 14.15, .9, .1);
      s.cyl(C.ivory, sx * 3.4, 6.6, 1.35, .5, 5);
      s.cone(C.blue, sx * 3.4, 10, 1.35, .62, 1.8);
    }
    // 窗戶（夜晚會亮）
    for (const [x, y, z, ww, hh] of [[0, 13, 1.16, .6, 1.1], [-1.5, 6.6, 1.42, .55, 1], [1.5, 6.6, 1.42, .55, 1], [0, 7.2, 1.42, .7, 1.3],
      [-3.4, 2.6, 2.58, .5, .8], [3.4, 2.6, 2.58, .5, .8], [-2.6, 11, 1.52, .3, .6], [2.6, 11, 1.52, .3, .6]]) w.box(0x2c3a66, x, y, z, ww, hh, .08);
    // 城牆燈飾
    for (let i = 0; i < 22; i++) bulb(cx, cz, -5.2 + i * .495, 4.55, 2.62, 0xffdca0, .055, i / 22);
    for (let i = 0; i < 12; i++) bulb(cx, cz, -2.9 + i * .53, 8.95, 1.55, 0xffc6e0, .05, i / 12);
    finish(root, [[s, paint], [m, metal], [w, glow]]);
    // 旗幟（會飄動）
    const flags = [], poles = kit();
    for (const [x, y, z, c] of [[0, 21.4, -.4, C.red], [-5.6, 10.7, 2.5, C.gold], [5.6, 10.7, 2.5, C.gold], [-5.6, 10.7, -2.5, C.teal], [5.6, 10.7, -2.5, C.teal]]) {
      poles.beam(C.iron, V(x, y, z), V(x, y + 1.3, z), .03);
      const pg = group(root, x, y, z);
      const f = kit(); f.box(c, .45, 1.05, 0, .9, .45, .03);
      const fm = f.build(paint); pg.add(fm); flags.push(fm);
    }
    root.add(poles.build(metal));
    // 塔頂旋轉的星星
    const octa = new T.OctahedronGeometry(1, 0); octa.deleteAttribute('uv');
    const sk = kit(); sk.add(octa, C.gold, 0, 0, 0, .35, .55, .12);
    const star = sk.build(metal); star.position.set(0, 23.1, -.4); root.add(star);
    updates.push(t => {
      flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 3.1 + i) * .35; f.scale.x = .9 + .1 * Math.sin(t * 5 + i); });
      star.rotation.y = t * 1.2;
    });
  }

  // ————————————————————————————————————————————————
  // 2. 環球小火車（繞著城堡的橢圓軌道）
  // ————————————————————————————————————————————————
  {
    const { cx, cz, rx, rz } = TRAIN_TRACK;
    const pts = [];
    for (let i = 0; i < 96; i++) { const a = i / 96 * tau; pts.push(V(cx + rx * Math.cos(a), 0, cz + rz * Math.sin(a))); }
    const curve = new T.CatmullRomCurve3(pts, true);
    // 預先取樣，動畫時只查表（不用每格重算曲線）
    const N = 720, P = [], D = [];
    for (let i = 0; i < N; i++) { P.push(curve.getPointAt(i / N)); D.push(curve.getTangentAt(i / N)); }
    const len = curve.getLength();
    const track = kit(), rails = kit();
    for (let i = 0; i < 150; i++) {
      const u = i / 150, p = curve.getPointAt(u), d = curve.getTangentAt(u), a = Math.atan2(d.x, d.z);
      track.box(0x8b8178, p.x, .04, p.z, 1.9, .08, .5, a);      // 碎石道床
      track.box(0x6d4c3a, p.x, .12, p.z, 1.5, .08, .22, a);    // 枕木
    }
    for (let i = 0; i < 180; i++) {
      const a = curve.getPointAt(i / 180), b = curve.getPointAt((i + 1) / 180), d = b.clone().sub(a).normalize();
      const side = V(d.z, 0, -d.x);
      for (const s of [-.5, .5]) rails.beam(0x9aa0a6, a.clone().addScaledVector(side, s).setY(.2), b.clone().addScaledVector(side, s).setY(.2), .045, G.cyl6);
    }
    scene.add(track.build(paint), rails.build(metal));
    // 小車站（月台＋屋頂），也是點擊的主要位置
    const st = kit(), sm = kit();
    const [sx, , sz] = rideById.train.pos;
    st.box(C.stone, sx + 2.8, .25, sz, 2.2, .5, 6.5);
    for (const dz of [-2.8, 2.8]) for (const dx of [2.0, 3.6]) sm.cyl(C.iron, sx + dx, 1.7, sz + dz, .08, 2.9);
    st.box(C.red, sx + 2.6, 3.25, sz, 3.4, .18, 6.9);
    st.box(C.cream, sx + 2.6, 3.45, sz, 3.0, .25, 6.4);
    for (let i = 0; i < 12; i++) bulb(0, 0, sx + 1.0, 3.1, sz - 3.2 + i * .58, 0xffd08a, .05, i / 12);
    scene.add(st.build(paint), sm.build(metal));

    // 火車頭與三節車廂（每節各自一個網格）
    function wheels(k, len) { for (const z of [-len / 2 + .35, len / 2 - .35]) for (const x of [-.55, .55]) k.add(G.cyl, 0x1e1e22, x, .32, z, .3, .12, .3, new T.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2)); }
    const loco = kit(), locoM = kit();
    loco.box(C.dark, 0, .55, 0, 1.2, .25, 2.4);
    loco.add(G.cyl, C.red, 0, 1.15, .45, .5, 1.4, .5, new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    loco.box(C.teal, 0, 1.4, -.75, 1.2, 1.5, .95);
    loco.box(C.red, 0, 2.2, -.75, 1.4, .12, 1.15);
    loco.cyl(C.dark, 0, 2.05, .85, .16, .8);
    loco.cone(C.dark, 0, 2.55, .85, .28, .3);
    locoM.ring(C.gold, 0, 1.15, .1, .52, .4); locoM.ring(C.gold, 0, 1.15, .8, .52, .4);
    locoM.ball(0xffe2a0, 0, 1.15, 1.18, .14);
    loco.box(C.gold, 0, .45, 1.35, 1.1, .3, .25);
    wheels(loco, 2.4);
    const cars = [group(scene)];
    finishOne(cars[0], [[loco, paint], [locoM, metal]]);
    for (const color of [C.cream, C.blue, C.pink]) {
      const k = kit(), km = kit(), g = group(scene);
      k.box(C.dark, 0, .55, 0, 1.2, .2, 2.2);
      k.box(color, 0, .95, 0, 1.25, .6, 2.1);
      k.box(0x6d4c3a, 0, 1.0, 0, 1.0, .25, 1.9);
      k.box(C.red, 0, 2.15, 0, 1.4, .1, 2.3);
      for (const x of [-.55, .55]) for (const z of [-.95, .95]) km.cyl(C.gold, x, 1.65, z, .04, 1.1);
      // 乘客（頭）
      for (const z of [-.5, .4]) { k.ball([0xf0c8a0, 0xd9a77e, 0xf3d2b3][Math.floor(Math.random() * 3)], 0, 1.55, z, .2); k.box([C.teal, C.red, C.gold][Math.floor(Math.random() * 3)], 0, 1.25, z, .45, .35, .3); }
      wheels(k, 2.2);
      finishOne(g, [[k, paint], [km, metal]]);
      cars.push(g);
    }
    anchors.train = V();
    const gap = 2.75 / len;
    updates.push(t => {
      const u0 = (t * 2.4 / len) % 1; // 每秒 2.4 公尺
      cars.forEach((car, i) => {
        const u = ((u0 - i * gap) % 1 + 1) % 1, k = Math.floor(u * N) % N;
        car.position.copy(P[k]);
        car.rotation.y = Math.atan2(D[k].x, D[k].z);
      });
      anchors.train.copy(cars[0].position);
    });
  }

  // ————————————————————————————————————————————————
  // 3. 分數落塔（自由落體塔）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.drop.pos, H = 21;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit();
    s.cyl(C.stone, 0, .25, 0, 3.3, .5);
    s.cyl(C.teal, 0, .6, 0, 2.6, .3);
    s.box(0x5a4fa0, 0, H / 2, 0, 1.1, H, 1.1);
    for (const [x, z] of [[-.75, -.75], [.75, -.75], [.75, .75], [-.75, .75]]) m.beam(C.gold, V(x, .6, z), V(x, H, z), .07);
    for (let y = 1.5; y < H - 1; y += 1.6) {
      for (let k = 0; k < 4; k++) {
        const a = [[-.75, -.75], [.75, -.75], [.75, .75], [-.75, .75]], p = a[k], q = a[(k + 1) % 4];
        m.beam(C.gold, V(p[0], y, p[1]), V(q[0], y + 1.6, q[1]), .035);
      }
      bulb(cx, cz, 0, y + .8, .82, [0xffd08a, 0xc9a4ff, 0x9fe8ff][Math.floor(y) % 3], .06, y / H);
    }
    s.cyl(0x6b4fc2, 0, H + .6, 0, 1.9, 1.2);
    s.cyl(C.gold, 0, H + 1.3, 0, 2.1, .25);
    s.cone(0x8a6ee8, 0, H + 2.4, 0, 1.6, 2);
    m.ball(C.gold, 0, H + 3.6, 0, .28);
    // 環繞塔頂的土星環
    m.ring(0xffd36b, 0, H + .6, 0, 2.6, .6);
    for (let i = 0; i < 16; i++) { const a = i / 16 * tau; bulb(cx, cz, Math.cos(a) * 2.0, H + 1.45, Math.sin(a) * 2.0, 0xffe0a0, .07, i / 16); }
    finish(root, [[s, paint], [m, metal]]);
    // 座椅環（會上下）
    const g = kit(), gm = kit();
    g.ring(0xd94a6a, 0, 0, 0, 1.6, 2.4);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * tau, x = Math.cos(a) * 1.75, z = Math.sin(a) * 1.75;
      g.box(0x2d2f45, x, .1, z, .55, .7, .55, -a);
      g.ball([0xf0c8a0, 0xd9a77e, 0xf3d2b3][i % 3], Math.cos(a) * 2.0, .65, Math.sin(a) * 2.0, .2);
      g.box([C.red, C.teal, C.gold, C.blue][i % 4], Math.cos(a) * 2.0, .25, Math.sin(a) * 2.0, .4, .45, .35, -a);
      gm.beam(C.gold, V(x, .5, z), V(Math.cos(a) * 2.25, .3, Math.sin(a) * 2.25), .04);
    }
    const car = group(root, 0, 1.2, 0);
    finishOne(car, [[g, paint], [gm, metal]]);
    const top = H - 3.5, bottom = 1.2;
    updates.push(t => {
      const c = t % 16;
      let y;
      if (c < 6) { const k = c / 6; y = bottom + (top - bottom) * (k * k * (3 - 2 * k)); }  // 慢慢升起
      else if (c < 8.5) y = top;                                                          // 頂端停留
      else if (c < 9.55) { const k = c - 8.5; y = Math.max(5, top - .5 * 29 * k * k); }    // 自由落體
      else if (c < 10.8) { const k = (c - 9.55) / 1.25; y = 5 - (5 - bottom) * (1 - (1 - k) * (1 - k)); } // 磁力煞車
      else y = bottom;
      car.position.y = y;
      car.rotation.y = c < 6 ? c * .25 : 1.5;
    });
  }

  // ————————————————————————————————————————————————
  // 4. 叢林咖啡杯（三層旋轉：大轉盤、小轉盤、杯子自轉）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.teacups.pos;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit();
    s.cyl(C.stone, 0, .2, 0, 6.6, .4);
    // 外圍欄杆與燈柱
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * tau, b = (i + 1) / 20 * tau;
      m.cyl(C.iron, Math.cos(a) * 6.4, .75, Math.sin(a) * 6.4, .06, 1.1);
      if (i % 4 !== 1) m.beam(C.gold, V(Math.cos(a) * 6.4, 1.15, Math.sin(a) * 6.4), V(Math.cos(b) * 6.4, 1.15, Math.sin(b) * 6.4), .04);
      bulb(cx, cz, Math.cos(a) * 6.4, 1.38, Math.sin(a) * 6.4, i % 2 ? 0xffd08a : 0xa8f0b0, .07, i / 20);
    }
    finish(root, [[s, paint], [m, metal]]);
    const turntable = group(root, 0, .4, 0);
    const tk = kit();
    tk.cyl(0x3e7d4f, 0, .07, 0, 6.0, .14);
    for (let i = 0; i < 12; i++) { const a = i / 12 * tau; tk.box(i % 2 ? 0xe9d6a8 : 0x5fa36b, Math.cos(a) * 5.6, .16, Math.sin(a) * 5.6, .9, .04, .9, -a); }
    // 中央大茶壺＋叢林葉片
    tk.ball(0xf6efe0, 0, 1.4, 0, 1.25, 1.0, 1.25);
    tk.cyl(0xd9822b, 0, 2.45, 0, .55, .25); tk.ball(0xd9822b, 0, 2.65, 0, .22);
    tk.beam(0xf6efe0, V(1.1, 1.2, 0), V(1.9, 1.9, 0), .18);
    tk.add(G.torus, 0xf6efe0, -1.25, 1.45, 0, .5, .5, 1.2);
    for (let i = 0; i < 7; i++) { const a = i / 7 * tau; tk.ball(i % 2 ? 0x4c9a52 : 0x2f7a43, Math.cos(a) * 1.1, .55, Math.sin(a) * 1.1, .55, .3, .55); }
    finish(turntable, [[tk, paint]]);
    const cupColors = [[0xe46f6f, 0xf3c96b], [0x6fb2e4, 0xf3e7c4], [0xa78bdc, 0x9fe0b5]];
    // 杯子輪廓（旋轉曲線）
    const profile = [[0, 0], [.48, 0], [.62, .15], [.74, .55], [.8, .95], [.72, .95], [.66, .55], [0, .5]].map(([x, y]) => new T.Vector2(x, y));
    const cupGeo = new T.LatheGeometry(profile, 18); cupGeo.deleteAttribute('uv');
    const plates = [], cups = [];
    for (let p = 0; p < 3; p++) {
      const a = p / 3 * tau, plate = group(turntable, Math.cos(a) * 3.6, .16, Math.sin(a) * 3.6);
      const pk = kit(); pk.cyl(cupColors[p][1], 0, .06, 0, 2.0, .12); pk.cyl(C.gold, 0, .13, 0, .3, .1);
      finish(plate, [[pk, paint]]);
      plates.push(plate);
      for (let c = 0; c < 2; c++) {
        const cup = group(plate, c ? 1.05 : -1.05, .12, 0);
        const ck = kit(), cm = kit();
        ck.add(cupGeo, cupColors[p][0], 0, 0, 0, 1, 1, 1);
        cm.ring(C.gold, 0, .95, 0, .78, .4);
        ck.add(G.torus, cupColors[p][0], .82, .55, 0, .25, .25, .9);
        ck.ball([0xf0c8a0, 0xd9a77e][c], -.2, .95, 0, .2); ck.ball([0xf3d2b3, 0xf0c8a0][c], .25, .9, .1, .17);
        cm.cyl(C.gold, 0, .75, 0, .1, .5);
        finishOne(cup, [[ck, paint], [cm, metal]]);
        cups.push(cup);
      }
    }
    updates.push(t => {
      const s = .55 + .45 * Math.sin(t * .2);       // 轉速慢慢起伏
      turntable.rotation.y = t * .35;
      plates.forEach((p, i) => p.rotation.y = -t * (.9 + .1 * i) * (1 + s));
      cups.forEach((c, i) => c.rotation.y = t * (1.4 + (i % 3) * .3) * (i % 2 ? 1 : -1));
    });
  }

  // ————————————————————————————————————————————————
  // 5. 太空艙（中央火箭塔＋六支機械臂，太空艙上下環繞）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.rocket.pos;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit(), w = kit();
    s.cyl(C.stone, 0, .25, 0, 5.4, .5);
    s.cyl(0x283a6b, 0, .55, 0, 4.6, .15);
    for (let i = 0; i < 24; i++) { const a = i / 24 * tau; bulb(cx, cz, Math.cos(a) * 5.2, .62, Math.sin(a) * 5.2, i % 3 ? 0x9fe8ff : 0xffe0a0, .06, i / 24); }
    // 中央火箭
    s.cyl(C.white, 0, 4.6, 0, .85, 8);
    s.cyl(0xd94a3a, 0, 1.2, 0, 1.0, 1.4);
    s.cone(0xd94a3a, 0, 9.6, 0, .85, 2);
    for (let k = 0; k < 4; k++) { const a = k / 4 * tau + .4; s.box(0xd94a3a, Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1, .12, 2.2, .9, -a + Math.PI / 2); }
    for (const y of [3.5, 5.2, 6.9]) for (let k = 0; k < 4; k++) { const a = k / 4 * tau; w.ball(0x9fd8ff, Math.cos(a) * .82, y, Math.sin(a) * .82, .22, .22, .22); }
    m.ring(C.gold, 0, 2.1, 0, .9, .3); m.ring(C.gold, 0, 8.2, 0, .9, .3);
    finish(root, [[s, paint], [m, metal], [w, glow]]);
    // 頂端繞行的行星
    const planets = group(root, 0, 10.2, 0);
    const pk = kit();
    pk.ring(0xffd36b, 0, 0, 0, 2.2, .3);
    for (const [a, r, c] of [[0, .35, 0x6fb2e4], [1.6, .28, 0xe46f6f], [3.1, .42, 0xf3c96b], [4.6, .24, 0x9fe0b5]]) pk.ball(c, Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2, r);
    finish(planets, [[pk, paint]]);
    const hub = group(root, 0, 3.0, 0), arms = [];
    for (let i = 0; i < 6; i++) {
      const pivot = group(hub, 0, 0, 0); pivot.rotation.y = -i / 6 * tau;
      const arm = group(pivot, .9, 0, 0);
      const ak = kit(), am = kit();
      am.beam(C.gold, V(0, 0, 0), V(3.2, 0, 0), .1);
      am.beam(C.gold, V(0, -.5, 0), V(2.6, 0, 0), .06);
      // 太空艙：白色機身＋彩色鼻錐＋玻璃艙罩
      const c = [0xe46f6f, 0x6fb2e4, 0xf3c96b, 0xa78bdc, 0x9fe0b5, 0xff9a5a][i];
      ak.add(G.cyl, C.white, 3.6, .1, 0, .42, 1.6, .42, new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
      ak.add(G.cone, c, 3.6, .1, 1.15, .42, .7, .42, new T.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
      ak.box(c, 3.6, .1, -.85, .9, .1, .4); ak.box(c, 3.6, .4, -.85, .1, .6, .4);
      ak.ball(0xf0c8a0, 3.6, .62, .1, .2);
      ak.ball(0x9fd8ff, 3.6, .55, .1, .34, .2, .4);
      finishOne(arm, [[ak, paint], [am, metal]]);
      arms.push(arm);
    }
    updates.push(t => {
      hub.rotation.y = t * .8;
      planets.rotation.y = -t * .5;
      arms.forEach((a, i) => a.rotation.z = .28 + .3 * Math.sin(t * .9 + i * 1.05));
    });
  }

  // ————————————————————————————————————————————————
  // 6. 飛天書本（大鉛筆中柱，打開的書本座艙一邊旋轉一邊起伏）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.books.pos;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit();
    s.cyl(C.stone, 0, .2, 0, 5.2, .4);
    s.cyl(0x2f6b45, 0, .45, 0, 4.6, .12);
    s.cyl(0xe96a8a, 0, .9, 0, .75, .7);                 // 橡皮擦
    m.cyl(0xc0c4c8, 0, 1.45, 0, .78, .45);              // 金屬圈
    s.cyl(0xf2c23a, 0, 4.0, 0, .75, 4.7, G.cyl6);        // 六角形筆桿
    s.cone(0xe8c49a, 0, 7.05, 0, .75, 1.4, G.cone);      // 削過的木頭
    s.cone(0x333333, 0, 7.6, 0, .26, .5);               // 筆芯
    for (let i = 0; i < 20; i++) { const a = i / 20 * tau; bulb(cx, cz, Math.cos(a) * 5.0, .52, Math.sin(a) * 5.0, i % 2 ? 0xffd08a : 0xb6f5c0, .06, i / 20); }
    // 漂浮的大字「字」：以方塊排出部首意象（裝飾）
    finish(root, [[s, paint], [m, metal]]);
    const hub = group(root, 0, 2.2, 0), books = [];
    const covers = [0xc0392b, 0x2e86c1, 0x27ae60, 0x8e44ad, 0xd68910, 0x17a589];
    for (let i = 0; i < 6; i++) {
      const pivot = group(hub); pivot.rotation.y = -i / 6 * tau;
      const arm = group(pivot, .8, 0, 0);
      const bk = kit(), bm = kit();
      bm.beam(C.gold, V(0, 0, 0), V(3.0, 0, 0), .08);
      // 打開的書：兩片封面呈 V 字，中間是白色書頁
      for (const sd of [-1, 1]) {
        const q = new T.Quaternion().setFromAxisAngle(V(1, 0, 0), sd * .5);
        bk.add(G.box, covers[i], 3.4, .25, sd * .45, 1.3, .08, 1.0, q);
        bk.add(G.box, 0xfbf6e8, 3.4, .31, sd * .42, 1.2, .1, .9, q);
      }
      bk.ball(0xf0c8a0, 3.4, .75, 0, .2); bk.box(covers[(i + 2) % 6], 3.4, .45, 0, .4, .35, .3);
      finishOne(arm, [[bk, paint], [bm, metal]]);
      books.push(arm);
    }
    updates.push(t => {
      hub.rotation.y = -t * .7;
      books.forEach((b, i) => { b.rotation.z = .22 + .26 * Math.sin(t * 1.3 + i * 2.1); b.rotation.x = .12 * Math.sin(t * 2 + i); });
    });
  }

  // ————————————————————————————————————————————————
  // 7. 聽力飛椅（旋轉鞦韆，速度越快椅子甩得越開）
  // ————————————————————————————————————————————————
  {
    const [cx, , cz] = rideById.swinger.pos;
    const root = group(scene, cx, 0, cz);
    const s = kit(), m = kit();
    s.cyl(C.stone, 0, .25, 0, 2.4, .5);
    s.cyl(0x2b8fd6, 0, 4.2, 0, .55, 7.6);
    for (const y of [1.2, 3.2, 5.2, 7.2]) m.ring(C.gold, 0, y, 0, .6, .4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * tau; bulb(cx, cz, Math.cos(a) * 2.3, .55, Math.sin(a) * 2.3, 0x9fd8ff, .06, i / 12); }
    finish(root, [[s, paint], [m, metal]]);
    const tilt = group(root, 0, 8, 0), top = group(tilt);
    const tk = kit(), tm = kit(), tw = kit();
    tk.cyl(0xf3e7c4, 0, 0, 0, 3.7, .5);
    tk.cone(0xc0392b, 0, 1.2, 0, 3.9, 1.9);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * tau;
      tk.box(i % 2 ? 0xf3e7c4 : 0x2b8fd6, Math.cos(a) * 3.75, -.35, Math.sin(a) * 3.75, 1.35, .45, .1, -a + Math.PI / 2);
      tw.ball(i % 2 ? 0xfff1c4 : 0xbfe6ff, Math.cos(a) * 3.85, .05, Math.sin(a) * 3.85, .09);
    }
    tm.ball(C.gold, 0, 2.35, 0, .25);
    finish(top, [[tk, paint], [tm, metal], [tw, glow]]);
    const swings = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * tau, sw = group(top, Math.cos(a) * 3.2, -.3, Math.sin(a) * 3.2);
      sw.rotation.order = 'YXZ'; sw.userData.a = a;
      const k = kit(), km = kit();
      for (const z of [-.18, .18]) km.beam(0xbfc3c7, V(0, 0, z), V(0, -3.6, z), .02, G.cyl6);
      k.box([0xe46f6f, 0xf3c96b, 0x6fb2e4, 0x9fe0b5][i % 4], 0, -3.75, 0, .45, .12, .5);
      k.box([0xe46f6f, 0xf3c96b, 0x6fb2e4, 0x9fe0b5][i % 4], -.2, -3.45, 0, .08, .55, .5);
      if (i % 3 !== 2) { k.ball(0xf0c8a0, 0, -3.25, 0, .18); k.box([C.teal, C.red, C.gold][i % 3], 0, -3.55, 0, .3, .4, .3); }
      finishOne(sw, [[k, paint], [km, metal]]);
      swings.push(sw);
    }
    let angle = 0;
    updates.push((t, dt) => {
      const c = t % 26;
      // 0–4 秒加速、4–18 秒全速、18–22 秒減速、22–26 秒停下讓遊客上下
      const speed = c < 4 ? c / 4 : c < 18 ? 1 : c < 22 ? 1 - (c - 18) / 4 : 0;
      const w = speed * 1.25;
      angle += w * dt;
      top.rotation.y = -angle;
      tilt.rotation.x = .1 * speed * Math.sin(t * .8);
      tilt.rotation.z = .1 * speed * Math.cos(t * .8);
      const swing = Math.atan(w * w * 5 / 9.8);   // 離心力讓椅子往外甩
      for (const sw of swings) { sw.rotation.y = -sw.userData.a; sw.rotation.z = swing; }
    });
  }

  // ————————————————————————————————————————————————
  // 7.5 新園區的樹木與路燈（全部合併成少數網格，避免空地太空曠）
  // ————————————————————————————————————————————————
  {
    let seed = 20261127;
    const rnd = () => ((seed = Math.imul(1664525, seed) + 1013904223 | 0) >>> 0) / 4294967296;
    // 不能種樹的地方：設施、城堡廣場與步道
    const blocked = [[-26, -25, 6.5], [-36, 8, 7.8], [-36, -12, 7], [38, 7, 7.2], [36, -16, 5], [-13, -9, 12], [16, -5, 15]];
    const paths = [[[2, -18], [0, -22]], [[-21, -11], [-24, -17], [-26, -22]], [[-13, -17], [-20, -21]], [[-23, 3], [-30, 6], [-35, 8]],
      [[-21, -11], [-29, -12], [-35, -12]], [[-36, 2], [-36, -5]], [[-42, 18], [-38, 13]], [[31, 0], [36, 4]], [[46, 15], [39, 11]],
      [[26, -12], [33, -15]], [[31, 0], [35, -10]], [[-23, 3], [-21, -11], [-13, -17], [-1, -18], [13, -17], [26, -12], [31, 0], [27, 12]],
      [[-42, 18], [-28, 19]], [[28, 18], [46, 15]]];
    const segDist = (x, z, [ax, az], [bx, bz]) => {
      const dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - ax - k * dx, z - az - k * dz);
    };
    const free = (x, z) => {
      if (Math.hypot((x - 0) / 18, (z + 26.5) / 8.6) < 1) return false;             // 城堡廣場與鐵道
      if (blocked.some(([bx, bz, r]) => Math.hypot(x - bx, z - bz) < r)) return false;
      for (const line of paths) for (let i = 1; i < line.length; i++) if (segDist(x, z, line[i - 1], line[i]) < 2.6) return false;
      return true;
    };
    const zones = [[30, 45, -33, -1], [-45, -31, -33, -19], [-45, -42, -5, 16], [-21, -16, -33, -21], [24, 31, -33, -21], [18, 24, -33, -24], [42, 45, 0, 13], [-31, -28, -10, 0]];
    const trees = kit(), leaves = kit(), spots = [];
    const ico = new T.IcosahedronGeometry(1, 1); ico.deleteAttribute('uv');
    for (const [x0, x1, z0, z1] of zones) {
      const n = Math.round((x1 - x0) * (z1 - z0) / 26);
      for (let i = 0; i < n * 3 && spots.length < 400; i++) {
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        if (!free(x, z) || spots.some(([a, b]) => Math.hypot(a - x, b - z) < 2.3)) continue;
        spots.push([x, z]);
        const h = 2.2 + rnd() * 2.2, green = [0x3f6e45, 0x4c7d4a, 0x2f5f3e, 0x5a8a52][Math.floor(rnd() * 4)];
        trees.cyl(0x6b4a35, x, h * .3, z, .14, h * .6);
        if (rnd() < .45) {           // 針葉樹
          leaves.cone(green, x, h * .75, z, .95 + rnd() * .3, h * .95);
        } else {                      // 闊葉樹（三團樹冠）
          for (let k = 0; k < 3; k++) leaves.add(ico, green, x + (rnd() - .5) * .9, h * .72 + k * .35, z + (rnd() - .5) * .9, .85 + rnd() * .35, .75 + rnd() * .3, .85 + rnd() * .35);
        }
      }
    }
    // 新步道旁的路燈（燈泡加入整園共用的點雲）
    const lamps = kit(), lampM = kit();
    for (const [x, z] of [[-30, 4.3], [-31, -10.2], [-23.4, -18], [-18.5, -21.6], [-3, -20.8], [5, -20.8], [33.5, 1.6], [41, 12.6], [30.4, -13], [33.8, -6], [-38.5, 2], [-38.6, -4.5], [-40, 15.6]]) {
      lamps.cyl(C.iron, x, .12, z, .22, .24); lamps.cyl(C.iron, x, 1.7, z, .07, 3.2);
      lampM.cyl(C.gold, x, 3.3, z, .14, .1); lamps.cone(C.iron, x, 3.75, z, .3, .3);
      lamps.box(0xffe2a8, x, 3.47, z, .26, .38, .26);
      bulbs.add(x, 3.48, z + .05, 0xffbc71, .2, 0, 0);
    }
    scene.add(trees.build(paint), leaves.build(paint), lamps.build(paint), lampM.build(metal));
  }

  // ————————————————————————————————————————————————
  // 8. 園區招牌（畫布繪製中文字，白天清楚、晚上發光）
  // ————————————————————————————————————————————————
  const signMats = [];
  function signTexture(title, sub, color, icon) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const g = c.getContext('2d');
    g.fillStyle = '#fbf3e3'; g.fillRect(0, 0, 512, 192);
    g.fillStyle = color; g.fillRect(10, 10, 492, 172);
    g.strokeStyle = '#e7a860'; g.lineWidth = 8; g.strokeRect(22, 22, 468, 148);
    g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 70px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    g.fillText((icon ? icon + ' ' : '') + title, 256, 82);
    g.font = 'bold 34px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    g.fillText(sub, 256, 145);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    return tex;
  }
  function sign(x, z, ry, title, sub, color, icon, scale = 1, poleH = 3.4, poles = true) {
    const root = group(scene, x, 0, z); root.rotation.y = ry; root.scale.setScalar(scale);
    const k = kit(), km = kit();
    if (poles) for (const sx of [-1.75, 1.75]) { km.cyl(C.iron, sx, poleH / 2, 0, .09, poleH); km.ball(C.gold, sx, poleH + .9, 0, .14); }
    k.box(0x5a3b2e, 0, poleH + .3, -.05, 3.7, 1.5, .12);
    finishOne(root, [[k, paint], [km, metal]]);
    const tex = signTexture(title, sub, color, icon);
    const mat = new T.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: .6 });
    signMats.push(mat);
    const board = new T.Mesh(new T.PlaneGeometry(3.5, 1.31), mat);
    board.position.set(0, poleH + .3, .02); root.add(board);
  }
  const signSpots = { chinese: [-20.5, -18.5, .5], math: [30.5, -10, -.45], english: [31.5, 12.5, -.6], science: [-28.5, -2, .7], social: [-5.5, -17.2, .15] };
  for (const land of LANDS) { const [x, z, ry] = signSpots[land.id]; sign(x, z, ry, land.name, land.subject + '・' + land.desc, land.color, ''); }
  // 入口大門上方的園名招牌
  sign(-1, 18.55, 0, '嘉蘭遊樂場', 'JIALAN PARK・快樂學習樂園', '#a44546', '', .95, 5.75, false);

  return {
    anchors,
    update(t, dt) {
      for (const u of updates) u(t, dt);
      glow.emissiveIntensity = .15 + dayCycle.lamps * 1.1;
      for (const m of signMats) m.emissiveIntensity = dayCycle.lamps * .55;
    }
  };
}
