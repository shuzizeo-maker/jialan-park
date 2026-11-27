export function buildAirTraffic({THREE:T,scene,dayCycle}) {
  const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), tau=Math.PI*2;
  const white=0xf4e6c6, teal=0x27696c, wine=0xa44640, dark=0x354454;
  const sphere=new T.SphereGeometry(1,14,10), matrix=new T.Matrix4();
  const rotation=new T.Euler(), quaternion=new T.Quaternion();
  const batchMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.50,metalness:.24,side:T.DoubleSide});
  const birdMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.88,side:T.DoubleSide});
  // 機體、機翼和鳥羽先合併為少數網格，近看仍保留斷面厚度與分色。
  function partBuilder() {
    const pos=[],col=[],clr=new T.Color(),p=V(),q=V(),r=V();
    function triangle(a,b,c,tint){
      pos.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
      clr.set(tint);
      for(let i=0;i<3;i++)col.push(clr.r,clr.g,clr.b);
    }
    function oval(x,y,z,sx,sy,sz,color,tilt=0){
      quaternion.setFromEuler(rotation.set(tilt,0,0));
      matrix.compose(V(x,y,z),quaternion,V(sx,sy,sz));
      const g=sphere.attributes.position, ix=sphere.index;
      for(let i=0;i<ix.count;i+=3){
        p.fromBufferAttribute(g,ix.getX(i)).applyMatrix4(matrix);
        q.fromBufferAttribute(g,ix.getX(i+1)).applyMatrix4(matrix);
        r.fromBufferAttribute(g,ix.getX(i+2)).applyMatrix4(matrix);
        triangle(p,q,r,color);
      }
    }
    function quad(a,b,c,d,tint){triangle(a,b,c,tint);triangle(a,c,d,tint);}
    // 各翼剖面沿展長逐漸後掠，前緣有圓弧，後緣收成薄片。
    function foil(sections,colors){
      const rings=sections.map(([x,y,lead,trail,t])=>[
        V(x,y,lead),V(x,y+t,lead*.70+trail*.30),V(x,y+.22*t,trail),
        V(x,y-.24*t,trail),V(x,y-.78*t,lead*.68+trail*.32)
      ]);
      const sign=sections[1][0]>sections[0][0]?1:-1;
      for(let i=0;i<rings.length-1;i++){
        for(let j=0;j<5;j++){
          const next=(j+1)%5,outer=rings[i+1],inner=rings[i];
          const color=colors[i];
          if(sign>0)quad(inner[j],outer[j],outer[next],inner[next],color);
          else quad(inner[next],outer[next],outer[j],inner[j],color);
        }
      }
      const tip=rings[rings.length-1];
      for(let j=1;j<tip.length-1;j++)triangle(tip[0],tip[j],tip[j+1],colors[colors.length-1]);
    }
    function geometry(){
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
      g.setAttribute('color',new T.Float32BufferAttribute(col,3));
      g.computeVertexNormals();g.computeBoundingSphere();return g;
    }
    return {triangle,quad,oval,foil,geometry};
  }

  const plane=new T.Group();plane.name='雙螺旋槳客機';scene.add(plane);
  const fuselage=partBuilder();
  const sections=[
    [-4.20,.26,.07,.10],[-3.70,.22,.22,.24],[-2.7,.14,.42,.43],
    [-1.6,.08,.62,.62],[.00,.05,.68,.70],[1.65,.04,.66,.68],
    [2.46,.01,.55,.58],[3.19,-.09,.37,.39],[3.48,-.13,.09,.13]
  ];
  const ringCount=28;
  const hull=sections.map(([z,y,rx,ry])=>Array.from({length:ringCount},(_,j)=>{
    const a=j*tau/ringCount;
    return V(rx*Math.cos(a),y+ry*Math.sin(a),z);
  }));
  for(let i=0;i<hull.length-1;i++)for(let j=0;j<ringCount;j++){
    const next=(j+1)%ringCount, height=Math.sin((j+.5)*tau/ringCount);
    const tint=height<-.43?teal:height<-.18?wine:white;
    fuselage.quad(hull[i][j],hull[i][next],hull[i+1][next],hull[i+1][j],tint);
  }
  for(const side of [-1,1]){
    fuselage.foil([[.36*side,-.16,.99,-1.13,.19],[1.57*side,-.10,.99,-.79,.19],
      [4.28*side,.10,.33,-.62,.092],[4.71*side,.15,.20,-.48,.073],
      [4.85*side,.16,.02,-.32,.045]],[white,white,wine,wine]);
    fuselage.foil([[side*.1,.30,-2.58,-3.65,.10],[side*1.55,.39,-2.95,-3.65,.07],
      [side*1.87,.43,-3.24,-3.58,.04]],[white,teal]);
    fuselage.oval(side*1.47,-.05,.72,.33,.34,.91,teal);
    fuselage.oval(side*1.47,-.04,1.39,.34,.34,.29,wine);
    fuselage.oval(side*1.47,-.04,1.67,.17,.17,.20,0xcfc4a4);
    for(const [z,rx] of [[-1.86,.57],[-1.38,.63],[-.90,.65],[-.42,.66],[.06,.67],[.54,.67],[1.02,.66]]){
      fuselage.oval(side*rx,.18,z,.041,.135,.145,0x334e60);
    }
    fuselage.quad(V(side*.601,.16,1.80),V(side*.49,.44,1.89),
      V(side*.354,.387,2.47),V(side*.533,.12,2.45),0x304c5d);
    fuselage.quad(V(side*.346,.405,2.47),V(side*.044,.452,2.50),
      V(side*.043,.227,3.00),V(side*.352,.164,2.89),0x426274);
    const fin=[V(side*.09,.22,-3.91),V(side*.088,1.67,-3.68),V(side*.068,1.79,-3.34),
      V(side*.07,1.73,-3.09),V(side*.102,.44,-2.24)];
    fuselage.triangle(fin[0],fin[1],fin[2],wine);fuselage.triangle(fin[0],fin[2],fin[3],wine);
    fuselage.triangle(fin[0],fin[3],fin[4],wine);
    fuselage.quad(V(side*.102,1.30,-3.74),V(side*.104,1.44,-3.70),
      V(side*.102,1.44,-2.95),V(side*.104,1.30,-2.86),white);
  }
  const planeMesh=new T.Mesh(fuselage.geometry(),batchMaterial);plane.add(planeMesh);
  const blade=partBuilder();
  for(let j=0;j<3;j++){
    const a=j*tau/3;
    const vertex=(rad,offset,z)=>V(Math.cos(a)*rad-Math.sin(a)*offset,Math.sin(a)*rad+Math.cos(a)*offset,z);
    blade.quad(vertex(.09,-.045,0),vertex(.72,-.09,.01),vertex(.72,.057,-.05),vertex(.12,.07,-.05),dark);
    blade.quad(vertex(.72,-.09,.01),vertex(.86,-.05,-.01),vertex(.88,.009,-.037),vertex(.72,.057,-.05),0xe8ba71);
  }
  const bladeGeometry=blade.geometry(),propellers=[];
  for(const side of [-1,1]){
    const prop=new T.Mesh(bladeGeometry,batchMaterial);prop.position.set(side*1.47,-.04,1.70);
    plane.add(prop);propellers.push(prop);
  }
  const beaconMat=new T.MeshStandardMaterial({color:0xffffff,emissive:0xffddbe,emissiveIntensity:0});
  const beacon=new T.Mesh(new T.SphereGeometry(.09,8,6),beaconMat);
  beacon.position.set(0,.764,.05);plane.add(beacon);

  // 鷗翼分成肩翼與外翼，讓腕部延遲拍動、滑翔時張開成弧形。
  const body=partBuilder();
  body.oval(0,.012,.0,.102,.095,.31,0xc8c7b9);
  body.oval(0,.079,.22,.092,.085,.120,0xf4e6cb);
  body.oval(0,.065,.34,.047,.038,.11,0xcc8d48);
  for(const s of [-1,1]){
    body.oval(s*.083,.099,.263,.013,.015,.021,0x252c34);
    body.triangle(V(s*.01,.018,-.11),V(s*.106,.044,-.38),V(0,.02,-.341),0x51535a);
  }
  const flock=new T.Group();flock.name='湖岸飛鳥';scene.add(flock);
  const count=10;
  const instances=g=>{
    const mesh=new T.InstancedMesh(g,birdMaterial,count);
    mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);flock.add(mesh);return mesh;
  };
  const bodies=instances(body.geometry());bodies.name='鷗鳥軀幹';
  const feathers=[-1,1].map(side=>{
    const inner=partBuilder(),outer=partBuilder();
    inner.foil([[0,.026,.13,-.18,.048],[side*.24,.095,.09,-.16,.037],
      [side*.395,.115,.010,-.131,.024]],[0xe2dbc8,0xbab8b1]);
    outer.foil([[0,0,.010,-.131,.031],[side*.18,-.023,-.060,-.176,.024],
      [side*.33,-.07,-.129,-.201,.017],[side*.46,-.117,-.232,-.238,.008]],
      [0xbdbcb5,0x565a63,0x383e47]);
    const elbow=new T.Matrix4().makeTranslation(side*.395,.115,0);
    return {side,inner:instances(inner.geometry()),outer:instances(outer.geometry()),elbow};
  });
  feathers[0].inner.name='鷗鳥左翼';feathers[1].inner.name='鷗鳥右翼';
  const birds=Array.from({length:count},(_,i)=>{
    const follower=i<6?i:i-6,side=follower%2?1:-1,row=Math.ceil(follower/2);
    return {far:i>=6,along:-row*(1.55+.15*Math.sin(i*7.7)),across:row*side*(1.37+.23*Math.cos(i*2.6)),
      height:.49*Math.sin(i*3.23),size:i<6?.86+.19*Math.abs(Math.sin(i*2.36)):.72+.16*Math.abs(Math.sin(i*2.36)),phase:i*1.47};
  });
  const base=new T.Matrix4(),wing=new T.Matrix4(),bend=new T.Matrix4(),wingBase=new T.Matrix4();
  const position=V(),dimensions=V(),orientation=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
  function update(t){
    // 閉合航線在園後方較高處迴轉，連續的斜向軌跡可從任何手動視角觀看。
    const phase=.47-t*tau/53,sn=Math.sin(phase),cs=Math.cos(phase);
    const x=84*sn, dx=-84*cs, dz=28*sn+.13*dx, dy=-22*sn-2*cs;
    plane.position.set(x,71.8-22*cs+2*sn,-88+28*cs+.13*x);
    plane.rotation.order='YXZ';plane.rotation.set(-Math.atan2(dy,Math.hypot(dx,dz)),Math.atan2(dx,dz),.115+.165*sn*sn);
    for(const prop of propellers)prop.rotation.z=t*31;
    const flash=Math.exp(-Math.pow(((t+.19)%1.38-.11)/.073,2));
    beaconMat.emissiveIntensity=(dayCycle?.lamps??0)*(1.15+4*flash);
    birds.forEach((b,i)=>{
      const a=b.far?2.40+t*tau/58:-.45+t*tau/43,rx=b.far?32:29,rz=b.far?9:12;
      const dx=rx*Math.cos(a),dz=-rz*Math.sin(a),len=Math.hypot(dx,dz),fx=dx/len,fz=dz/len;
      const flow=t*.71+b.phase;
      const y=(b.far?24.6:20.9)+1.18*Math.sin(a*2+.7)+b.height+.19*Math.sin(flow);
      position.set((b.far?3:-1)+rx*Math.sin(a)+fx*b.along+fz*b.across+.22*Math.sin(flow),y,
        (b.far?-25:1)+rz*Math.cos(a)+fz*b.along-fx*b.across);
      euler.set(-.072*Math.cos(a*2+.7),Math.atan2(dx,dz)+.033*Math.cos(flow),.07*Math.cos(a)+.15*Math.sin(flow*.60+b.phase));
      orientation.setFromEuler(euler);dimensions.setScalar(b.size);
      base.compose(position,orientation,dimensions);bodies.setMatrixAt(i,base);
      const rhythm=t*(6.8+.34*Math.sin(b.phase))+b.phase;
      const glide=T.MathUtils.smoothstep(Math.sin(t*.67+b.phase),-.43,.65);
      for(const w of feathers){
        const lift=.095+.52*glide*Math.sin(rhythm);
        wing.makeRotationZ(w.side*lift);wingBase.multiplyMatrices(base,wing);w.inner.setMatrixAt(i,wingBase);
        bend.makeRotationZ(w.side*(-.06+.37*glide*Math.sin(rhythm-.84)));
        matrix.copy(wingBase).multiply(w.elbow).multiply(bend);w.outer.setMatrixAt(i,matrix);
      }
    });
    bodies.instanceMatrix.needsUpdate=true;
    for(const w of feathers){w.inner.instanceMatrix.needsUpdate=true;w.outer.instanceMatrix.needsUpdate=true;}
  }
  update(0);return update;
}
