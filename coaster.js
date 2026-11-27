export function buildCoaster({ THREE, scene, bulbs, dayCycle }) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const worldUp = V(0, 1, 0);
  const tau = Math.PI * 2;
  const points = [V(4.9, 2.1, 3.0), V(8, 1.98, 4.0), V(11.5, 2.0, 4.45), V(13.45, 2.0, 4.48)];
  const loopStart = points.length;
  for (let step = 0; step <= 20; step++) {
    const u = step / 20;
    const angle = tau * u;
    const eased = u * u * (3 - 2 * u);
    points.push(V(15.55 + 4.95 * Math.sin(angle) + 1.12 * eased,
      2 + 5.4 * (1 - Math.cos(angle)), 4.48 + 2.22 * eased));
  }
  const loopEnd = points.length - 1;
  points.push(
    V(19.7, 2.12, 6.73), V(22.7, 2.73, 6.68), V(25.6, 3.95, 5.35),
    V(27.6, 5.05, 2.7), V(28.05, 5.0, -0.4), V(27.75, 4.06, -4.6),
    V(26.3, 3.92, -8.85), V(24.0, 4.91, -10.75), V(20.9, 7.12, -11.8),
    V(16.2, 10.91, -12.1), V(12.3, 13.95, -12.05), V(9.68, 15.15, -11.5),
    V(7.84, 14.48, -10.72), V(5.53, 11.32, -9.61), V(3.49, 6.57, -8.31),
    V(2.78, 3.93, -6.81), V(2.48, 2.27, -3.73), V(2.62, 1.92, -0.61),
    V(3.34, 2.01, 1.52)
  );

  const path = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  path.arcLengthDivisions = 2600;
  const length = path.getLength();
  const count = 620;
  const segment = length / count;
  const centres = [], tangents = [], rights = [], ups = [], attitudes = [], onLoop = [];
  const basis = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const fraction = i / count;
    const splineKnot = path.getUtoTmapping(fraction) * points.length;
    centres.push(path.getPointAt(fraction));
    tangents.push(path.getTangentAt(fraction));
    onLoop.push(splineKnot >= loopStart && splineKnot <= loopEnd);
  }
  for (let i = 0; i < count; i++) {
    const tangent = tangents[i];
    let right;
    if (onLoop[i]) {
      // 固定環形軌道的橫軸，車廂越過環頂時自然倒懸。
      right = V(0, 0, -1);
      right.addScaledVector(tangent, -right.dot(tangent)).normalize();
    } else {
      right = V().crossVectors(worldUp, tangent).normalize();
      const turn = tangents[(i + 3) % count].clone().sub(tangents[(i - 3 + count) % count]);
      const curvature = turn.dot(right) / (6 * segment);
      const bank = THREE.MathUtils.clamp(-Math.atan(4.0 * curvature), -0.88, 0.88);
      right.applyAxisAngle(tangent, bank);
    }
    const up = V().crossVectors(tangent, right).normalize();
    rights.push(right);
    ups.push(up);
    attitudes.push(new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(right, up, tangent)));
  }
  const at = (i, x, y) => centres[i].clone().addScaledVector(rights[i], x).addScaledVector(ups[i], y);
  function steelTube(offsetX, offsetY, radius, sides, paint, material) {
    const xyz = [], normal = [], index = [];
    for (let i = 0; i <= count; i++) {
      const j = i % count, centre = at(j, offsetX, offsetY);
      for (let k = 0; k < sides; k++) {
        const a = k * tau / sides;
        const n = rights[j].clone().multiplyScalar(Math.cos(a)).addScaledVector(ups[j], Math.sin(a));
        const p = centre.clone().addScaledVector(n, radius);
        xyz.push(p.x, p.y, p.z);
        normal.push(n.x, n.y, n.z);
        if (i < count) {
          const v = i * sides + k, w = i * sides + (k + 1) % sides;
          index.push(v, w, v + sides, w, w + sides, v + sides);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, material || new THREE.MeshStandardMaterial({
      color: paint, metalness: 0.42, roughness: 0.34
    }));
    scene.add(mesh);
  }
  const railPaint = new THREE.MeshStandardMaterial({
    color: 0xff7655, emissive: 0x7a2316, emissiveIntensity: 0.44, metalness: 0.39, roughness: 0.36
  });
  steelTube(-0.49, 0, 0.073, 7, 0, railPaint);
  steelTube(0.49, 0, 0.073, 7, 0, railPaint);
  steelTube(0, -0.47, 0.155, 8, 0xb6423f);
  const lightStrip = new THREE.MeshStandardMaterial({color:0x802f22,roughness:.30,
    emissive:new THREE.Color(1.34,0.23,0.085),emissiveIntensity:0});
  steelTube(-0.52, -0.027, 0.023, 5, 0, lightStrip);

  const cylinders = [], blocks = [];
  const beam = (start, end, radius, color) => {
    const delta = end.clone().sub(start);
    const orientation = new THREE.Quaternion().setFromUnitVectors(worldUp, delta.clone().normalize());
    const matrix = new THREE.Matrix4().compose(start.clone().lerp(end, 0.5), orientation, V(radius, delta.length(), radius));
    cylinders.push({ matrix, color });
  };
  function block(p, dimensions, color) {
    blocks.push({ matrix: new THREE.Matrix4().makeScale(...dimensions).setPosition(p), color });
  }
  const sleeperCount = Math.ceil(length / 0.82);
  for (let n = 0; n < sleeperCount; n++) {
    const u = n / sleeperCount;
    const j = Math.round(u * count) % count;
    const k = Math.round((n + 0.5) / sleeperCount * count) % count;
    const left = at(j, -0.56, -0.055), right = at(j, 0.56, -0.055), spine = at(k, 0, -0.46);
    beam(left, right, 0.053, 0xda7260);
    beam(left, spine, 0.042, 0xc25349);
    beam(right, spine, 0.042, 0xc25349);
    const warm = n % 8 < 3 ? 0xffcd72 : 0xff7c48;
    const golden = at(j, -0.56, 0.018);
    bulbs.add(golden.x, golden.y, golden.z, warm, 0.083, 4, u);
    const cherry = at(j, 0.56, 0.018);
    bulbs.add(cherry.x, cherry.y, cherry.z, n % 7 < 3 ? 0xff526e : 0xffa35d, 0.071, 4, u);
  }

  const columnColor = 0x65a5a1, crossColor = 0x477d81;
  const pierCount = Math.ceil(length / 3.45);
  let lastPier = null;
  for (let n = 0; n < pierCount; n++) {
    const j = Math.round(n / pierCount * count) % count;
    if (onLoop[j]) {
      lastPier = null;
      continue;
    }
    const cap = at(j, 0, -0.61), side = rights[j].clone().setY(0).normalize();
    const tall = cap.y > 4.15;
    const footSpread = tall ? Math.min(1.8, 0.71 + cap.y * 0.065) : 0;
    const ends = [];
    for (const sign of tall ? [-1, 1] : [0]) {
      const foot = cap.clone().setY(0.22).addScaledVector(side, sign * footSpread);
      const top = cap.clone().addScaledVector(side, sign * 0.32);
      beam(foot, top, tall ? 0.132 : 0.18, columnColor);
      block(foot.clone().setY(0.13), [0.69, 0.26, 0.69], 0x7b7777);
      block(foot.clone().setY(0.31), [0.43, 0.10, 0.43], 0x4a797f);
      ends.push({ foot, top });
    }
    if (tall) {
      const [a, b] = ends;
      beam(a.top, b.top, 0.13, columnColor);
      for (let h = 0.28; h < 0.9; h += 0.30) {
        const ah = a.foot.clone().lerp(a.top, h), bh = b.foot.clone().lerp(b.top, h);
        beam(ah, bh, 0.052, crossColor);
      }
      if (lastPier && cap.y > 5.6) {
        for (let s = 0; s < 2; s++) {
          const p = lastPier[s], q = ends[s];
          beam(p.foot.clone().lerp(p.top, 0.25), q.foot.clone().lerp(q.top, 0.73), 0.059, crossColor);
          beam(p.foot.clone().lerp(p.top, 0.73), q.foot.clone().lerp(q.top, 0.25), 0.059, crossColor);
        }
      }
    }
    lastPier = tall ? ends : null;
  }
  // 兩座斜撐把環形軌道的側向力導向後方，保留中央鏤空輪廓。
  for (const angle of [Math.PI * 0.55, Math.PI * 1.46]) {
    const knot = (loopStart + angle / tau * 20) / points.length;
    const expected = path.getPoint(knot);
    let nearest = 0, best = Infinity;
    centres.forEach((p, j) => {
      const d = p.distanceToSquared(expected);
      if (d < best) { nearest = j; best = d; }
    });
    const cap = at(nearest, 0, -0.49);
    for (const offset of [-1.06, 1.06]) {
      const foot = V(cap.x + offset, 0.24, cap.z - 2.28);
      beam(foot, cap, 0.138, columnColor);
      block(foot.clone().setY(0.15), [0.78, 0.30, 0.78], 0x78797a);
    }
  }
  const structure = new THREE.MeshStandardMaterial({ metalness: 0.33, roughness: 0.47 });
  function assemble(items, geometry) {
    const mesh = new THREE.InstancedMesh(geometry, structure, items.length);
    items.forEach(({ matrix, color }, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new THREE.Color(color));
    });
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  assemble(cylinders, new THREE.CylinderGeometry(1, 1, 1, 7));
  assemble(blocks, new THREE.BoxGeometry(1, 1, 1));

  // 將每節車廂的車輪、琺瑯側板、黃銅扶手與乘客合併為單一網格。
  function carriage(paint, seatColor) {
    const xyz = [], normals = [], colors = [];
    function append(geometry, color, matrix = new THREE.Matrix4()) {
      const source = geometry.index ? geometry.toNonIndexed() : geometry;
      source.applyMatrix4(matrix);
      const p = source.getAttribute('position'), normal = source.getAttribute('normal');
      const c = new THREE.Color(color);
      for (let i = 0; i < p.count; i++) {
        xyz.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
        colors.push(c.r, c.g, c.b);
      }
      if (source !== geometry) source.dispose();
      geometry.dispose();
    }
    function cube(x, y, z, width, height, depth, color) {
      append(new THREE.BoxGeometry(width, height, depth), color, new THREE.Matrix4().makeTranslation(x, y, z));
    }
    function rod(a, b, radius, color) {
      const delta = b.clone().sub(a);
      append(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), color,
        new THREE.Matrix4().compose(a.clone().lerp(b, 0.5),
          new THREE.Quaternion().setFromUnitVectors(worldUp, delta.normalize()), V(1, 1, 1)));
    }
    function ball(x, y, z, sx, sy, sz, color) {
      append(new THREE.SphereGeometry(1, 9, 6), color,
        new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z));
    }
    cube(0, 0.26, 0, 0.86, 0.20, 0.96, 0x3e4252);
    cube(0, 0.40, 0, 0.91, 0.18, 0.97, paint);
    cube(0, 0.57, -0.37, 0.84, 0.37, 0.13, seatColor);
    cube(0, 0.48, -0.10, 0.76, 0.15, 0.47, seatColor);
    cube(0, 0.55, 0.435, 0.87, 0.25, 0.12, paint);
    for (const sign of [-1, 1]) {
      cube(sign * 0.443, 0.58, -0.02, 0.095, 0.255, 0.93, paint);
      rod(V(sign * 0.47, 0.70, -0.45), V(sign * 0.47, 0.70, 0.44), 0.031, 0xffcb77);
      cube(sign * 0.494, 0.55, 0.015, 0.014, 0.042, 0.87, 0xffbf65);
      for (const z of [-0.32, 0.32]) rod(V(sign * 0.415, 0.16, z), V(sign * 0.54, 0.16, z), 0.092, 0x394554);
      const x = 0.205 * sign;
      ball(x, 0.70, -0.12, 0.143, 0.205, 0.115, sign < 0 ? 0xdb7868 : 0x6fadc1);
      ball(x, 0.973, -0.13, 0.108, 0.13, 0.102, sign < 0 ? 0xd89b76 : 0xeac0a0);
      ball(x, 1.045, -0.141, 0.11, 0.073, 0.105, sign < 0 ? 0x493736 : 0x775848);
    }
    rod(V(-0.41, 0.75, 0.16), V(0.41, 0.75, 0.16), 0.036, 0xffcc84);
    rod(V(-0.40, 0.68, 0.35), V(0.40, 0.68, 0.35), 0.026, 0xf9ba6b);
    for (const x of [-0.31, 0.31]) ball(x, 0.585, 0.51, 0.075, 0.063, 0.028, 0xffe7ae);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }
  const coachCount = 5;
  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.39, metalness: 0.22 });
  const trains = [
    new THREE.InstancedMesh(carriage(0x29bdb8, 0x773651), carMat, coachCount),
    new THREE.InstancedMesh(carriage(0xffbf53, 0x883b43), carMat, coachCount)
  ];
  trains.forEach(train => {
    train.frustumCulled = false;
    train.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(train);
  });

  // 用每段的坡度與位能建立行車時刻表，各節車廂以固定實際距離銜接。
  const timetable = [0];
  for (let i = 0; i < count; i++) {
    const grade = tangents[i].y;
    const energySpeed = Math.sqrt(30 + 5.8 * Math.max(0, 15.2 - centres[i].y));
    const speed = energySpeed * (1 - 0.52 * Math.max(0, grade) + 0.19 * Math.max(0, -grade));
    timetable.push(timetable[i] + segment / speed);
  }
  const duration = timetable[count];
  const pos = V(), orient = new THREE.Quaternion(), unit = V(1, 1, 1), matrix = new THREE.Matrix4();
  return (time) => {
    railPaint.emissiveIntensity=.44*dayCycle.lamps;
    lightStrip.emissiveIntensity=dayCycle.lamps;
    trains.forEach((train, id) => {
      const clock = (time + duration * (id ? 0.62 : 0.12)) % duration;
      let low = 0, high = count;
      while (high - low > 1) {
        const middle = (high + low) >> 1;
        if (timetable[middle] > clock) high = middle;
        else low = middle;
      }
      const head = (low + (clock - timetable[low]) / (timetable[high] - timetable[low])) * segment;
      for (let car = 0; car < coachCount; car++) {
        const f = ((head - car * 1.085 + length) % length) / segment;
        const i = Math.floor(f) % count, j = (i + 1) % count, blend = f - Math.floor(f);
        pos.lerpVectors(centres[i], centres[j], blend);
        orient.slerpQuaternions(attitudes[i], attitudes[j], blend);
        train.setMatrixAt(car, matrix.compose(pos, orient, unit));
      }
      train.instanceMatrix.needsUpdate = true;
    });
  };
}
