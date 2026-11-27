// 雙向渡輪沿兩座碼頭間的航線往返。乘客會搭船一程，在岸上停留一班，再搭回程。
export function buildFerry({THREE:T,scene,dayCycle}) {
  const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const up=v(0,1,0),unit=v(1,1,1),identity=new T.Quaternion();
  const turn=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  const twoPi=Math.PI*2, waterY=-1;
  const clamp=x=>Math.min(1,Math.max(0,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const mod=(x,n)=>((x%n)+n)%n;
  const navy=0x194b60,teal=0x287e81,ivory=0xffe2ae,gold=0xe9b46c,wood=0x966547,red=0xb7483c;
  const box=new T.BoxGeometry(1,1,1), globe=new T.SphereGeometry(1,12,8);
  const cylinder=new T.CylinderGeometry(1,1,1,12),ring=new T.TorusGeometry(1,.21,7,28);
  const enamel=new T.MeshStandardMaterial({metalness:.24,roughness:.52});
  const cabinLight=new T.MeshStandardMaterial({color:0xffe0b3,emissive:0xffbe6b,emissiveIntensity:0,roughness:.31});
  const glass=new T.MeshStandardMaterial({color:0x82b9bc,roughness:.18,metalness:.10,transparent:true,opacity:.30,depthWrite:false});
  const mat=new T.Matrix4();
  function batch(parent) {
    const groups=new Map();
    function put(g,c,p,s,q=identity,m=enamel){
      const key=g.uuid+m.uuid;
      if(!groups.has(key))groups.set(key,{g,m,items:[]});
      groups.get(key).items.push([new T.Matrix4().compose(p,q,s),new T.Color(c)]);
    }
    function rod(a,b,r,c){
      const delta=b.clone().sub(a),length=delta.length();
      put(cylinder,c,a.clone().lerp(b,.5),v(r,length,r),new T.Quaternion().setFromUnitVectors(up,delta.normalize()));
    }
    function plank(a,b,w,h,color){
      const delta=b.clone().sub(a);
      put(box,color,a.clone().lerp(b,.5),v(w,h,delta.length()),turn(0,Math.atan2(delta.x,delta.z),0));
    }
    return {
      put,rod,plank,
      box:(x,y,z,w,h,d,c,q,m)=>put(box,c,v(x,y,z),v(w,h,d),q,m),
      egg:(x,y,z,rx,ry,rz,c,m)=>put(globe,c,v(x,y,z),v(rx,ry,rz),identity,m),
      drum:(x,y,z,r,h,c)=>put(cylinder,c,v(x,y,z),v(r,h,r)),
      finish(){
        for(const {g,m,items} of groups.values()){
          const mesh=new T.InstancedMesh(g,m,items.length);
          items.forEach(([a,c],i)=>{mesh.setMatrixAt(i,a);mesh.setColorAt(i,c);});
          mesh.computeBoundingSphere();parent.add(mesh);
        }
      }
    };
  }
  const ship=new T.Group(),dockGroup=new T.Group();
  ship.name='湖畔接駁渡輪';dockGroup.name='園區與對岸渡輪碼頭';scene.add(ship,dockGroup);
  const dock=batch(dockGroup),boat=batch(ship);
  const ports=[v(6.65,waterY,27.00),v(46,waterY,33.2)];
  const sailing=new T.CatmullRomCurve3([ports[0],v(13,waterY,27),v(23,waterY,29.5),
    v(32,waterY,34.5),v(40,waterY,33.2),ports[1]],false,'centripetal');
  sailing.arcLengthDivisions=400;
  const mooring=17,passage=18,legTime=mooring+passage;

  // 棧橋的入口保留欄杆開口，旅客從原有遊樂園大門沿新支橋走到浮動碼頭。
  const parkPier=[v(-.69,.16,22.08),v(.70,.16,23.07),v(2.44,.16,24.72)];
  for(let i=0;i<parkPier.length-1;i++){
    const a=parkPier[i],b=parkPier[i+1],forward=b.clone().sub(a).normalize(),side=v(forward.z,0,-forward.x);
    const count=Math.ceil(a.distanceTo(b)/.23);
    for(let n=0;n<count;n++){
      const p=a.clone().lerp(b,(n+.5)/count);p.y=.10;
      dock.put(box,n%3===0?0xa58061:0x9d765d,p,v(1.35,.12,a.distanceTo(b)/count-.012),turn(0,Math.atan2(forward.x,forward.z),0));
    }
    for(const sign of [-1,1]){
      const aa=a.clone().addScaledVector(side,.63*sign),bb=b.clone().addScaledVector(side,.63*sign);
      dock.rod(v(aa.x,1.01,aa.z),v(bb.x,1.01,bb.z),.032,gold);
      dock.rod(v(bb.x,-.1,bb.z),v(bb.x,1.04,bb.z),.048,navy);
    }
  }
  for(const [index,port] of ports.entries()){
    const center=port.x,dockZ=port.z-2.21;
    const left=center-4.53,right=center+4.12;
    dock.box((left+right)/2,-.20,dockZ,right-left,.53,1.64,0x294f58);
    for(let i=0;i<42;i++)dock.box(left+(i+.5)*(right-left)/42,.10,dockZ,(right-left)/42-.013,.12,1.66,
      [0x9b775d,0xb18868,0xa67c5c,0xb38967][i%4]);
    for(let i=0;i<5;i++){
      const x=left+.30+i*(right-left-.6)/4;
      for(const s of [-1,1]){
        const z=dockZ+s*.68;
        dock.drum(x,-.70,z,.088,1.52,0x534a43);
        if(s<0 && (index===1 || i!==0)){
          dock.rod(v(x,.16,z),v(x,.86,z),.047,navy);
          dock.egg(x,.89,z,.07,.07,.07,gold);
          if(i<4 && !(index===1 && i===3))dock.rod(v(x,.79,z),v(x+(right-left-.6)/4,.79,z),.030,navy);
        }
      }
    }
    for(const s of [-1,1]){
      const x=center+s*3.68;
      dock.drum(x,.267,dockZ+.62,.095,.21,navy);
      dock.drum(x,.383,dockZ+.62,.145,.052,gold);
    }
    for(const u of [-2.9,2.7]){
      const x=center+u;
      dock.put(ring,0x3c4346,v(x,-.16,dockZ+.85),v(.19,.19,.19));
    }
  }
  // 對岸候船亭架在浮台上，連接東側岸線。乘客能實際在這一端下船及候船。
  const outer=ports[1],farX=outer.x+3.15,farZ=outer.z-4.86;
  dock.box(farX,.075,farZ,4.72,.17,4.72,wood);
  dock.plank(v(farX,.09,farZ-2.2),v(43.5,.09,16),1.7,.14,0xa8856b);
  for(const dx of [-2.07,2.07])for(const dz of [-2.05,2.05]){
    dock.drum(farX+dx,-.66,farZ+dz,.115,1.47,0x4b4c48);
    dock.drum(farX+dx,1.26,farZ+dz,.078,2.22,teal);
  }
  dock.box(farX,2.44,farZ,4.88,.15,4.98,navy);
  dock.box(farX,2.54,farZ,4.56,.12,4.66,teal);
  dock.box(farX,.43,farZ-1.62,3.5,.15,.43,wood);
  dock.box(farX,.74,farZ-1.81,3.5,.45,.1,wood);
  dock.finish();

  // 每道水線用不同寬度和高度構成有舷弧的雙尖船殼，中央留有平坦甲板。
  const hullPos=[],hullTint=[],slices=40;
  const sections=[];
  const hullColors=[0x313941,0x9a4c3c,navy,ivory,0x368986,gold];
  function face(a,b,c,d,tint){
    const color=new T.Color(tint);
    for(const p of [a,b,c,a,c,d]){hullPos.push(p.x,p.y,p.z);hullTint.push(color.r,color.g,color.b);}
  }
  for(let i=0;i<=slices;i++){
    const u=i/slices, x=-4.42+8.84*u, end=Math.abs(2*u-1),sheer=.30*Math.pow(end,3.1);
    const w=.055+1.306*Math.pow(Math.max(0,1-Math.pow(end,3.05)),.67);
    sections.push([[-.53,w*.23],[-.08,w*.72],[.125,w*.85],[.65+sheer,w*.995],
      [.83+sheer,w],[1.09+sheer,w*.98],[1.145+sheer,w*.985]].map(([y,z])=>v(x,y,z)));
  }
  for(let i=0;i<slices;i++){
    const a=sections[i],b=sections[i+1];
    for(const side of [-1,1])for(let j=0;j<hullColors.length;j++){
      const pt=(p)=>v(p.x,p.y,side*p.z);
      face(pt(a[j]),pt(b[j]),pt(b[j+1]),pt(a[j+1]),hullColors[j]);
    }
    const ar=a[a.length-1],br=b[b.length-1];
    face(v(ar.x,ar.y,-ar.z),v(br.x,br.y,-br.z),br,ar,wood);
  }
  const hg=new T.BufferGeometry();
  hg.setAttribute('position',new T.Float32BufferAttribute(hullPos,3));hg.setAttribute('color',new T.Float32BufferAttribute(hullTint,3));hg.computeVertexNormals();
  ship.add(new T.Mesh(hg,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.47,metalness:.23})));
  const seats=[v(-1.64,1.15,.60),v(-.92,1.15,-.54),v(.84,1.15,.60),v(1.49,1.15,-.54)];
  for(const p of seats){
    boat.box(p.x,1.42,p.z,.45,.32,.54,navy);boat.box(p.x,1.61,p.z,.49,.09,.60,0xce955f);
    boat.box(p.x-.225,1.80,p.z,.085,.37,.59,teal);
  }
  for(const z of [-1.16,1.16]){
    for(const x of [-2.28,-.53,.61,1.90,2.94])boat.rod(v(x,1.19,z),v(x,2.75,z*.91),.043,gold);
    for(const [a,b] of (z<0?[[-2.74,-.57],[.62,2.96]]:[[-2.74,2.96]])){
      boat.rod(v(a,1.51,z),v(b,1.51,z),.043,ivory);
      boat.rod(v(a,1.35,z),v(b,1.35,z),.025,gold);
    }
    for(const x of [-2.79,-1.10,1.71,2.68]){
      boat.egg(x,.60,z*1.12,.15,.28,.11,0x363d40);
      boat.rod(v(x,.8,z*1.10),v(x+.07,1.13,z),.021,ivory);
    }
    const buoyX=-2.25,buoyZ=z*1.056;
    boat.put(ring,0xe96743,v(buoyX,1.62,buoyZ),v(.255,.255,.26));
    for(let j=0;j<4;j++){
      const a=Math.PI*j/2+.35;
      boat.box(buoyX+.257*Math.cos(a),1.62+.257*Math.sin(a),buoyZ,.125,.095,.095,ivory,turn(0,0,a));
    }
  }
  // 開放乘客艙使用酒紅條紋的布篷，保留外側乘客的視線；前端設駕駛艙。
  for(let j=0;j<13;j++){
    const x=-2.66+(j+.5)*4.53/13;
    boat.box(x,2.72,0,4.53/13+.004,.085,2.48,j%2?0xd6b385:ivory);
  }
  for(const z of [-1.24,1.24])boat.box(-.40,2.66,z,4.57,.14,.07,red);
  boat.box(2.41,1.50,0,1.46,.62,2.02,teal);
  boat.box(2.50,2.31,0,1.55,1.02,1.94,0xb4d8cf,identity,glass);
  for(const z of [-1,1])for(const x of [1.73,2.44,3.22])boat.rod(v(x,1.80,z),v(x-.065,2.86,z*.90),.048,ivory);
  boat.box(2.44,2.89,0,1.75,.15,2.15,ivory);boat.box(2.44,2.98,0,1.56,.08,1.96,teal);
  boat.egg(2.36,1.91,.19,.18,.245,.17,0x305364);boat.egg(2.37,2.23,.19,.137,.16,.131,0xbb8f6e);
  boat.drum(2.37,2.35,.19,.148,.08,ivory);boat.drum(2.37,2.325,.19,.161,.035,navy);
  boat.drum(1.86,3.15,-.42,.173,.37,navy);boat.drum(1.86,3.21,-.42,.177,.085,ivory);
  boat.drum(2.85,3.19,0,.036,.38,gold);boat.egg(2.85,3.43,0,.086,.095,.086,0xffffff,cabinLight);
  for(const x of [-1.81,-.47,.90])boat.egg(x,2.56,.94,.084,.06,.07,0xffffff,cabinLight);
  for(const sign of [-1,1]){
    boat.rod(v(sign*3.18,1.31,-.82),v(sign*4.18,1.54,0),.05,ivory);
    boat.rod(v(sign*3.18,1.31,.82),v(sign*4.18,1.54,0),.05,ivory);
    boat.drum(sign*3.58,1.45,0,.075,.15,navy);
  }
  boat.finish();

  // 水花隨航速顯隱，兩側波脊沿尾跡向外展開，迴航時切換到另一端。
  const foamRoot=new T.Group();scene.add(foamRoot);foamRoot.name='渡輪航跡';
  const foamPositions=[],flow=[],across=[],foamIndices=[];
  for(const side of [-1,1])for(let ridge=0;ridge<2;ridge++){
    const offset=foamPositions.length/3;
    for(let i=0;i<=48;i++){
      const a=i/48,x=-2.85-a*5.7+ridge*.56;
      const z=side*(1.26+2.13*a+.28*ridge+.15*Math.sin(3.3*a+ridge));
      for(const edge of [-1,1]){
        foamPositions.push(x,.027+ridge*.004,z+edge*.085*(1+a));flow.push(a);across.push(edge);
      }
      if(i<48){const k=offset+2*i;foamIndices.push(k,k+1,k+2,k+2,k+1,k+3);}
    }
  }
  const fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(foamPositions,3));
  fg.setAttribute('flow',new T.Float32BufferAttribute(flow,1));fg.setAttribute('edge',new T.Float32BufferAttribute(across,1));fg.setIndex(foamIndices);
  const foam=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{speed:{value:0},time:{value:0},day:{value:0}},
    vertexShader:`attribute float flow,edge;uniform float time;varying float u,e;
      void main(){u=flow;e=edge;vec3 p=position;p.z+=.041*sin(35.*u-time*4.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float speed,time,day;varying float u,e;void main(){
      float ripples=.45+.55*smoothstep(-.8,.45,sin(u*28.-time*3.2)+.50*sin(u*57.+time));
      float alpha=(1.-abs(e))*(1.-u)*ripples*speed*.79;
      gl_FragColor=vec4(mix(vec3(.40,.66,.74),vec3(.89,.98,1.),day),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  foamRoot.add(new T.Mesh(fg,foam));

  // 每位旅客的骨架獨立，衣物與四肢以實例網格繪製，船上、岸上使用同一個角色。
  const travelers=[],parts=new Map(), garments=[0xbd6349,0x3a8390,0xf1b254,0x885376,0x4a849a,0xc68e60];
  const skins=[0xd2a07b,0xe0b798,0xb88667,0xdeba93];
  function wearable(g,bone,p,s,color,q=identity){
    if(!parts.has(g))parts.set(g,[]);
    parts.get(g).push({bone,local:new T.Matrix4().compose(p,q,s),color:new T.Color(color)});
  }
  const path=(points)=>new T.CatmullRomCurve3(points,false,'centripetal');
  for(let group=0;group<3;group++)for(let i=0;i<seats.length;i++){
    const id=group*seats.length+i,root=new T.Group(),hips=new T.Group(),legs=[],knees=[],arms=[];
    root.name='渡輪旅客'+(id+1);root.add(hips);scene.add(root);
    const scale=[1.03,.90,.83,1][i];root.scale.setScalar(scale);
    const c=garments[(id*5)%garments.length],skin=skins[(id+group)%4];
    wearable(globe,hips,v(0,.225,0),v(.176,.26,.14),c);
    wearable(globe,hips,v(0,.545,.022),v(.132,.16,.128),skin);
    wearable(globe,hips,v(0,.64,-.010),v(.135,.076,.134),id%2?0x714a37:0x40383a);
    if(id%4===0){
      wearable(cylinder,hips,v(0,.672,0),v(.182,.03,.166),ivory);
      wearable(globe,hips,v(0,.705,0),v(.132,.066,.122),0xaa7651);
    }
    for(const sign of [-1,1]){
      const thigh=new T.Group(),knee=new T.Group(),arm=new T.Group();
      hips.add(thigh,arm);thigh.add(knee);thigh.position.x=.088*sign;knee.position.y=-.28;
      arm.position.set(sign*.146,.355,0);legs.push(thigh);knees.push(knee);arms.push(arm);
      wearable(cylinder,thigh,v(0,-.143,0),v(.063,.286,.067),navy);
      wearable(cylinder,knee,v(0,-.127,0),v(.056,.254,.058),0x425460);
      wearable(globe,knee,v(0,-.255,.034),v(.071,.054,.109),0x4c3935);
      wearable(cylinder,arm,v(0,-.105,0),v(.055,.21,.055),c);
      wearable(globe,arm,v(0,-.236,.014),v(.046,.103,.049),skin);
    }
    const journeys=ports.map((port,index)=>{
      const seat=port.clone().add(seats[i]),deck=port.clone().add(v(.13,1.15,0));
      const waiting=port.clone().add(v(-1.72+i*.86,1.16,-2.05+i%2*.18));
      const doorway=port.clone().add(v(.13,1.15,-1.12)),berth=port.clone().add(v(.13,1.16,-1.83));
      const plaza=index===0?v(-1.52+(i%2)*.86,.035,17.1-Math.floor(i/2)*.80):v(farX+.35*(i-1),.16,farZ-1.0+(i%2)*.80);
      const road=index===0?[v(2.48,.16,24.73),v(.70,.16,23.07),v(-.69,.16,22.08),v(-1.05,.04,20.25)]:
        [v(farX,.16,port.z-2.05),v(farX,.16,farZ+.9)];
      const aisle=port.clone().add(v(seats[i].x,1.15,0));
      return {waiting,plaza,
        leave:path([seat,aisle,deck,doorway,berth,...road,plaza]),
        returnToJetty:path([plaza,...road.slice().reverse(),waiting]),
        board:path([waiting,berth,doorway,deck,aisle,seat])};
    });
    travelers.push({group,i,root,hips,legs,knees,arms,journeys,scale});
  }
  const batches=[];
  for(const [g,items] of parts){
    const mesh=new T.InstancedMesh(g,enamel,items.length);mesh.frustumCulled=false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    items.forEach((item,i)=>mesh.setColorAt(i,item.color));scene.add(mesh);batches.push({mesh,items});
  }
  const center=v(),direction=v(),p=v(),facing=v();
  function update(t){
    const clock=t-3.65, leg=Math.floor(clock/legTime),portIndex=mod(leg,2),age=mod(clock,legTime);
    const moving=clamp((age-mooring)/passage),travel=smooth(moving),speed=4*moving*(1-moving);
    const u=portIndex===0?travel:1-travel;
    sailing.getPointAt(u,center);sailing.getTangentAt(u,direction);
    const yaw=-Math.atan2(direction.z,direction.x);
    ship.position.copy(center);ship.position.y+=.060*speed*Math.sin(t*2.10);
    ship.rotation.set(.016*speed*Math.sin(t*1.43),yaw,.013*speed*Math.sin(t*1.70),'YXZ');
    ship.updateMatrixWorld(true);
    ship.userData.service=age<mooring?(portIndex===0?'園區靠岸':'對岸靠岸'):(portIndex===0?'離園航行':'抵園航行');
    foamRoot.position.copy(center);foamRoot.rotation.y=yaw+(portIndex===0?0:Math.PI);foamRoot.visible=speed>.003;
    foam.uniforms.time.value=t;foam.uniforms.speed.value=speed;foam.uniforms.day.value=dayCycle.daylight;
    cabinLight.emissiveIntensity=1.22*dayCycle.lamps;
    for(const person of travelers){
      const {group,i,root,legs,knees,arms,hips,journeys,scale}=person;
      const phase=mod(leg-group,3), j=journeys[phase===2?1-portIndex:portIndex];
      let sit=0,stride=0,heading=Math.PI/2+yaw;
      function walk(curve,portion){
        const progress=clamp(portion);curve.getPointAt(progress,p);curve.getTangentAt(progress,facing);
        heading=Math.atan2(facing.x,facing.z);
        stride=Math.sin(t*7.65+group+i)*Math.min(1,progress*15,(1-progress)*15);
      }
      if(phase===0){
        const progress=(age-5.25-i*.85)/3.62;
        if(progress<=0){p.copy(j.waiting);heading=0;root.userData.journey='候船';}
        else if(progress<1){walk(j.board,progress);sit=smooth((progress-.80)/.20);root.userData.journey='上船';}
        else{p.copy(seats[i]).applyMatrix4(ship.matrixWorld);sit=1;root.userData.journey='乘船';}
      }else if(phase===1){
        const progress=(age-.55-i*.80)/(j.leave.getLength()/1.69);
        if(progress<=0){p.copy(seats[i]).applyMatrix4(ship.matrixWorld);sit=1;root.userData.journey='乘船';}
        else if(progress<1){walk(j.leave,progress);sit=1-smooth(progress*j.leave.getLength()/.57);root.userData.journey='下船步行';}
        else{p.copy(j.plaza);heading=portIndex===0?Math.PI:Math.PI*.40;root.userData.journey='岸上';}
      }else{
        const duration=j.returnToJetty.getLength()/1.36;
        const progress=(age-legTime+duration+1.5+i*.23)/duration;
        if(progress<=0){p.copy(j.plaza);heading=portIndex===1?Math.PI:Math.PI*.40;root.userData.journey='岸上';}
        else if(progress<1){walk(j.returnToJetty,progress);root.userData.journey='前往碼頭';}
        else{p.copy(j.waiting);heading=0;root.userData.journey='候船';}
      }
      root.position.copy(p);root.position.y+=.018*Math.abs(stride);root.rotation.y=heading;
      hips.position.y=.59+( .50/scale-.59)*sit;
      for(let k=0;k<2;k++){
        const step=stride*(k?1:-1);
        legs[k].rotation.x=-1.42*sit+.48*step*(1-sit);
        knees[k].rotation.x=1.40*sit+.45*Math.max(0,-step)*(1-sit);
        arms[k].rotation.x=-.53*sit-.34*step*(1-sit);
      }
      root.updateMatrixWorld(true);
    }
    for(const {mesh,items} of batches){
      for(let i=0;i<items.length;i++)mesh.setMatrixAt(i,mat.multiplyMatrices(items[i].bone.matrixWorld,items[i].local));
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  update(0);
  return update;
}
