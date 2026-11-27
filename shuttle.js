// 每站各有一組下車遊客與一組等車遊客。離站後，乘客隨車行進兩站才下車。
export function buildShuttles({ THREE:T, scene, dayCycle }) {
  const tau=Math.PI*2, v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const knots=[
    [-12,0],[-7.7,-.37],[-3.25,-.46],[-.8,.20],[.24,2.72],[.33,5.45],[.58,7.94],
    [2.33,9.75],[4.39,10.59],[4.82,11.78],[3.91,13.73],[2.10,14.84],[-.59,15.45],[-3.92,15.61],
    [-6.51,15.42],[-10.23,16.11],[-13.15,16.23],[-15.61,15.62],[-17.65,14.16],[-18.86,11.52],
    [-18.72,8.92],[-17.90,6.48],[-16.29,3.73],[-14.62,1.65]
  ];
  const curve=new T.CatmullRomCurve3(knots.map(([x,z])=>v(x,.035,z)),true,'centripetal');
  curve.arcLengthDivisions=2400;
  const length=curve.getLength(), lengths=curve.getLengths();
  const marks=[0,4,9,15];
  const stops=marks.map(i=>lengths[i*curve.arcLengthDivisions/knots.length]);
  const dwell=6.2,ramp=1.25,pace=2.65, starts=[],trips=[];
  let total=0;
  for(let i=0;i<stops.length;i++){
    const distance=(stops[(i+1)%4]-stops[i]+length)%length;
    starts.push(total);trips.push(distance/pace+ramp);total+=dwell+trips[i];
  }
  const mod=(x,n)=>((x%n)+n)%n;
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
  function traveled(s,duration){
    const tail=u=>u*.5-ramp*Math.sin(Math.PI*u/ramp)/(2*Math.PI);
    const full=duration-ramp;
    if(s<ramp)return tail(s)/full;
    if(s>duration-ramp)return 1-tail(duration-s)/full;
    return (s-ramp*.5)/full;
  }
  function schedule(seconds){
    const lap=Math.floor(seconds/total), where=mod(seconds,total);
    let i=0;
    while(i<3&&where>=starts[i+1])i++;
    const elapsed=where-starts[i], along=traveled(Math.max(0,elapsed-dwell),trips[i]);
    const span=(stops[(i+1)%4]-stops[i]+length)%length;
    return {i,leg:lap*4+i,elapsed,duration:dwell+trips[i],distance:stops[i]+along*span};
  }
  const paint=new T.MeshStandardMaterial({roughness:.57,metalness:.22,vertexColors:true});
  const actorPaint=new T.MeshStandardMaterial({roughness:.78,metalness:.03});
  const cyan=0x187979,berry=0xb74746,maroon=0x773b41,cream=0xf5d59b,gold=0xe4ab55,metal=0x365250,wood=0x8d5035;
  const box=new T.BoxGeometry(1,1,1),orb=new T.SphereGeometry(1,12,8), wheelGeometry=new T.CylinderGeometry(1,1,1,20);
  const cylinder=new T.CylinderGeometry(1,1,1,10), unit=v(1,1,1),up=v(0,1,0);
  const identity=new T.Quaternion(), rotate=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  // 將固定零件合為單一幾何，兩台車的八顆輪胎則共用同一個實例網格。
  function builder(){
    const xyz=[],normal=[],colors=[], indices=[],matrix=new T.Matrix4(),nmat=new T.Matrix3(),p=v(),n=v(),color=new T.Color();
    function put(g,x,y,z,sx,sy,sz,tint,q=identity){
      matrix.compose(v(x,y,z),q,v(sx,sy,sz));nmat.getNormalMatrix(matrix);color.set(tint);
      const a=g.attributes.position,b=g.attributes.normal,base=xyz.length/3;
      for(let i=0;i<a.count;i++){
        p.fromBufferAttribute(a,i).applyMatrix4(matrix);n.fromBufferAttribute(b,i).applyNormalMatrix(nmat);
        xyz.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);
      }
      for(let i=0;i<(g.index?.count??a.count);i++)indices.push(base+(g.index?g.index.getX(i):i));
    }
    function rod(a,b,r,c){
      const delta=b.clone().sub(a), len=delta.length(),pos=a.clone().lerp(b,.5);
      put(cylinder,pos.x,pos.y,pos.z,r,len,r,c,new T.Quaternion().setFromUnitVectors(up,delta.normalize()));
    }
    return {put,rod,box:(x,y,z,w,h,d,c,q)=>put(box,x,y,z,w,h,d,c,q),
      egg:(x,y,z,w,h,d,c,q)=>put(orb,x,y,z,w,h,d,c,q),
      geo(){
        const g=new T.BufferGeometry();
        g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
        g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeBoundingSphere();return g;
      }};
  }
  const stat=builder(), wheels=builder(), axleTurn=rotate(0,0,Math.PI/2);
  wheels.put(wheelGeometry,0,0,0,.335,.18,.335,0x292c34,axleTurn);
  for(const sign of [-1,1]){
    wheels.put(wheelGeometry,sign*.096,0,0,.236,.025,.236,cream,axleTurn);
    wheels.put(wheelGeometry,sign*.112,0,0,.181,.024,.181,maroon,axleTurn);
    for(let k=0;k<6;k++){
      const a=k*tau/6;
      wheels.rod(v(sign*.126,0,0),v(sign*.126,.17*Math.cos(a),.17*Math.sin(a)),.018,gold);
    }
    wheels.egg(sign*.138,0,0,.052,.089,.089,gold);
  }
  const wheelMesh=new T.InstancedMesh(wheels.geo(),paint,8);wheelMesh.frustumCulled=false;scene.add(wheelMesh);
  const lampMaterial=new T.MeshStandardMaterial({color:0xffdeb0,emissive:0xffbd69,emissiveIntensity:0,roughness:.25});
  const lenses=new T.InstancedMesh(orb,lampMaterial,4);lenses.frustumCulled=false;scene.add(lenses);
  function makeCar(color){
    const b=builder();
    b.box(0,.42,0,1.45,.16,3.46,metal);
    b.box(0,.57,-.12,1.58,.19,3.30,color);
    b.box(0,.682,-.16,1.56,.055,3.17,wood);
    b.box(0,.705,1.34,1.37,.41,.62,color);
    b.egg(0,.96,1.32,.70,.13,.375,color);
    b.box(0,.69,1.67,.66,.26,.045,gold);
    for(let k=0;k<8;k++)b.box((k-3.5)*.073,.70,1.696,.025,.22,.012,metal);
    for(const s of [-1,1]){
      b.box(s*.79,.59,-.12,.054,.048,3.26,gold);
      b.box(s*.88,.275,-.38,.22,.065,2.39,wood);
      b.rod(v(s*.75,.60,-1.64),v(s*.75,2.16,-1.64),.046,gold);
      b.rod(v(s*.74,.68,.22),v(s*.74,2.16,.22),.036,gold);
      b.rod(v(s*.72,.74,1.32),v(s*.72,2.16,1.22),.051,gold);
      b.rod(v(s*.72,.94,.49),v(s*.72,1.11,1.20),.038,gold);
      b.egg(s*.51,.86,1.69,.118,.11,.085,gold);
      b.box(s*.77,1.96,-.13,.045,.15,3.64,color);
    }
    b.box(0,.85,-1.63,1.52,.39,.095,color);
    b.box(0,1.05,-1.63,1.55,.043,.103,gold);
    for(const z of [-1.0,-.20,.66]){
      b.box(0,.82,z,1.23,.12,.39,wood);
      b.box(0,.90,z,1.21,.07,.35,0xab7247);
      b.box(0,1.04,z-.19,1.21,.28,.086,color,rotate(-.15,0,0));
      b.box(0,1.20,z-.215,1.21,.033,.093,gold);
    }
    // 蓬頂是逐片鉚接的拱形烤漆板，邊緣保留明亮的黃銅簷口。
    for(let i=0;i<9;i++){
      const x=(i-4)*.198,y=2.14+.15*(1-(x/.92)**2);
      b.box(x,y,-.13,.205,.060,3.65,i===0||i===8?color:(i%2===0?cream:0xffe9b4),rotate(0,0,-.29*x));
    }
    for(const s of [-1,1])b.rod(v(s*.848,2.105,-1.99),v(s*.848,2.105,1.72),.043,gold);
    b.box(0,.4,1.79,1.43,.087,.105,cream);b.box(0,.43,-1.79,1.4,.085,.11,cream);
    // 司機的手扶在方向盤上，與乘客長椅分開。
    b.egg(-.27,1.25,.65,.175,.241,.146,0x3e6978);
    b.egg(-.27,1.58,.67,.126,.15,.11,0xd6ae87);
    b.egg(-.27,1.688,.65,.152,.058,.15,0x344957);
    b.rod(v(-.27,.90,1.1),v(-.27,1.26,.96),.035,metal);
    b.put(new T.TorusGeometry(.152,.022,6,14),-.27,1.28,.94,1,1,1,metal,rotate(-.78,0,0));
    for(const s of [-1,1]){
      b.rod(v(-.27+s*.13,1.37,.68),v(-.27+s*.159,1.27,.91),.047,0x507688);
      b.egg(-.27+s*.134,1.275,.95,.05,.05,.057,0xd6ae87);
    }
    const mesh=new T.Mesh(b.geo(),paint);scene.add(mesh);return mesh;
  }
  const cars=[makeCar(cyan),makeCar(berry)];
  cars.forEach((car,i)=>{car.name='園區接駁車'+(i+1);});
  const roadPos=[],roadTint=[],roadIndices=[];
  const laneCount=420,laneOffsets=[-1.12,-1.065,-.991,.991,1.065,1.12];
  const roadHues=[0x80766d,0xb1a084,0x746e70,0xb1a084,0x80766d],roadColor=new T.Color();
  for(let i=0;i<laneCount;i++){
    const u=i/laneCount,next=(i+1)/laneCount;
    const a=curve.getPointAt(u),b=curve.getPointAt(next),da=curve.getTangentAt(u),db=curve.getTangentAt(next);
    for(let j=0;j<roadHues.length;j++){
      const inside=laneOffsets[j],outside=laneOffsets[j+1],base=roadPos.length/3;
      roadPos.push(a.x+da.z*inside,.014,a.z-da.x*inside,b.x+db.z*inside,.014,b.z-db.x*inside,
        b.x+db.z*outside,.014,b.z-db.x*outside,a.x+da.z*outside,.014,a.z-da.x*outside);
      roadIndices.push(base,base+1,base+2,base,base+2,base+3);
      roadColor.set(roadHues[j]).multiplyScalar(j===2?(i%3===0?.95:1):1);
      for(let r=0;r<4;r++)roadTint.push(roadColor.r,roadColor.g,roadColor.b);
    }
  }
  const lane=new T.BufferGeometry();
  lane.setAttribute('position',new T.Float32BufferAttribute(roadPos,3));lane.setAttribute('color',new T.Float32BufferAttribute(roadTint,3));lane.setIndex(roadIndices);
  lane.computeVertexNormals();
  const laneMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.93,polygonOffset:true,polygonOffsetFactor:-1});
  const road=new T.Mesh(lane,laneMat);road.receiveShadow=true;road.name='接駁巡迴車道';scene.add(road);

  // 以摩天輪、迴圈、船錨及旋轉木馬頂篷的小圖案辨認站點。
  const destinations=[[-12.2,-3.8],[1.76,-.14],[7.16,12.15],[-10.54,14.98]];
  const stations=stops.map((distance,i)=>{
    const center=curve.getPointAt(distance/length),forward=curve.getTangentAt(distance/length),side=v(forward.z,0,-forward.x);
    const aim=v(destinations[i][0],.035,destinations[i][1]);
    const sign=side.dot(aim.clone().sub(center))>=0?1:-1;
    const stand=center.clone().addScaledVector(side,sign*1.83).addScaledVector(forward,-1.78);
    stat.rod(v(stand.x,.04,stand.z),v(stand.x,1.74,stand.z),.046,metal);
    stat.put(cylinder,stand.x,.09,stand.z,.14,.10,.14,gold);
    stat.egg(stand.x,1.74,stand.z,.282,.28,.077,gold);stat.egg(stand.x,1.74,stand.z+.055,.242,.24,.045,cyan);
    const icon=(x,y)=>v(stand.x+x,1.74+y,stand.z+.104);
    const stroke=(x0,y0,x1,y1)=>stat.rod(icon(x0,y0),icon(x1,y1),.018,cream);
    if(i<2){
      for(let k=0;k<14;k++){
        const a=k*tau/14,n=(k+1)*tau/14;
        stroke(Math.sin(a)*.13,Math.cos(a)*.13,Math.sin(n)*.13,Math.cos(n)*.13);
        if(i===0 && k%3===0)stroke(0,0,Math.sin(a)*.13,Math.cos(a)*.13);
      }
      stroke(-.07,-.16,0,i===0?0:-.13);stroke(0,i===0?0:-.13,.145,-.16);
    }else if(i===2){
      stroke(0,.15,0,-.13);stroke(-.08,.06,.08,.06);stroke(0,-.13,-.13,-.045);stroke(0,-.13,.13,-.045);
    }else{
      stroke(-.15,.02,0,.14);stroke(0,.14,.15,.02);stroke(-.15,.02,.15,.02);
      stroke(-.07,.01,-.07,-.11);stroke(.07,.01,.07,-.11);stroke(-.11,-.12,.11,-.12);
    }
    return {center,forward,side,sign,aim};
  });
  scene.add(new T.Mesh(stat.geo(),paint));

  // 腿部有髖與膝關節，乘客踏上低地板後坐下，步態與登車高度連續變化。
  const people=[],parts=new Map(),coats=[0xcd625f,0xf2ba62,0x489b97,0x7785b5,0xd89985,0x86a66d];
  const skins=[0xe6bd94,0xd8a783,0xb07b62,0xf2cbae],hairs=[0x503d34,0x373940,0x734736,0x5a4f44];
  function addPart(g,bone,x,y,z,sx,sy,sz,c,q=identity){
    if(!parts.has(g))parts.set(g,[]);parts.get(g).push({bone,mat:new T.Matrix4().compose(v(x,y,z),q,v(sx,sy,sz)),c});
  }
  function person(bus,offset,member){
    const group=new T.Object3D(),hips=new T.Object3D();group.add(hips);
    const torso=new T.Object3D();hips.add(torso);
    const id=bus*7+offset*2+member,coat=coats[id%coats.length],sk=skins[id%4],hair=hairs[(id+1)%4];
    addPart(orb,torso,0,.22,0,.168,.225,.124,coat);
    addPart(orb,torso,0,.535,.014,.124,.150,.113,sk);
    addPart(orb,torso,0,.614,-.025,.129,.094,.116,hair);
    if(id%4===1){addPart(cylinder,torso,0,.668,0,.150,.027,.147,cream);addPart(orb,torso,0,.697,0,.105,.049,.096,maroon);}
    const legs=[],knees=[],arms=[];
    for(const sign of [-1,1]){
      const thigh=new T.Object3D(),shin=new T.Object3D(),arm=new T.Object3D();hips.add(thigh);thigh.add(shin);torso.add(arm);
      thigh.position.x=sign*.083;shin.position.y=-.284;arm.position.set(sign*.151,.34,0);
      addPart(cylinder,thigh,0,-.151,0,.060,.302,.065,0x415361);
      addPart(cylinder,shin,0,-.128,0,.054,.251,.059,0x475461);addPart(orb,shin,0,-.246,.039,.062,.052,.105,0x513e36);
      addPart(cylinder,arm,0,-.085,0,.053,.17,.05,coat);addPart(cylinder,arm,0,-.220,.012,.042,.14,.041,sk);
      addPart(orb,arm,0,-.302,.015,.041,.052,.044,sk);legs.push(thigh);knees.push(shin);arms.push(arm);
    }
    const bodyScale=member===0?.99:(offset%3===0?.81:.93);
    group.scale.setScalar(bodyScale);
    return {bus,offset,member,id,group,hips,torso,legs,knees,arms,bodyScale};
  }
  for(let b=0;b<2;b++)for(let o=0;o<6;o++)for(let m=0;m<2;m++)people.push(person(b,o,m));
  const batches=[];
  for(const [g,items] of parts){
    const mesh=new T.InstancedMesh(g,actorPaint,items.length);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    items.forEach((item,i)=>mesh.setColorAt(i,new T.Color(item.c)));scene.add(mesh);batches.push([mesh,items]);
  }
  const mat=new T.Matrix4(), wheelMat=new T.Matrix4(), spin=new T.Quaternion(), wheelAxis=v(1,0,0), p=v(),tangent=v();
  const lensScale=v(.080,.078,.027);
  const seat=v(),outside=v(),queue=v(),activity=v(),target=v(),facing=v();
  function update(t){
    const states=[schedule(t+1.05),schedule(t+1.05+total*.5)];
    lampMaterial.emissiveIntensity=2.30*(dayCycle?.lamps??0);
    cars.forEach((car,b)=>{
      const st=states[b],u=mod(st.distance,length)/length;
      curve.getPointAt(u,car.position);curve.getTangentAt(u,tangent);
      car.rotation.y=Math.atan2(tangent.x,tangent.z);car.updateMatrixWorld();
      const turns=st.distance+Math.floor(st.leg/4)*length;
      spin.setFromAxisAngle(wheelAxis,turns/.335);
      for(let k=0;k<4;k++){
        p.set(k%2?.754:-.754,.34,k<2?-1.17:1.12);
        wheelMat.compose(p,spin,unit);wheelMesh.setMatrixAt(b*4+k,mat.multiplyMatrices(car.matrixWorld,wheelMat));
      }
      for(let k=0;k<2;k++){
        p.set(k?.51:-.51,.858,1.757);wheelMat.compose(p,identity,lensScale);
        lenses.setMatrixAt(b*2+k,mat.multiplyMatrices(car.matrixWorld,wheelMat));
      }
    });
    wheelMesh.instanceMatrix.needsUpdate=true;lenses.instanceMatrix.needsUpdate=true;
    for(const rider of people){
      const {bus,offset,member,group,hips,legs,knees,arms,bodyScale}=rider,st=states[bus],car=cars[bus];
      const phase=mod(st.leg-offset,6);
      const stationIndex=phase<=1?st.i:mod(st.i-(phase-2),4),station=stations[stationIndex];
      const benchZ=offset%2===0?-1.02:-.21;
      seat.set(member===0?-.33:.33,0,benchZ).applyMatrix4(car.matrixWorld);
      outside.copy(station.center).addScaledVector(station.side,station.sign*1.02).addScaledVector(station.forward,benchZ);
      queue.copy(station.center).addScaledVector(station.side,station.sign*(1.39+.32*member)).addScaledVector(station.forward,benchZ+.30*member);
      activity.copy(station.aim).addScaledVector(station.forward,(offset%3-1)*.52+.39*member).addScaledVector(station.side,.36*bus);
      let sit=0,stride=0,heading=car.rotation.y;
      const go=(a,b,k)=>{
        k=clamp(k);target.lerpVectors(a,b,ease(k));
        facing.subVectors(b,a);heading=Math.atan2(facing.x,facing.z);
        stride=Math.sin(Math.PI*k)*Math.sin(t*7.9+rider.id);
      };
      const align=(from,to,k)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*k;
      if(phase===0){
        const far=(member===0?-1:1)!==station.sign, u=(st.elapsed-(far?2.15:2.71))/2.47;
        if(u<=0){target.copy(queue);heading=Math.atan2(-station.side.x*station.sign,-station.side.z*station.sign);}
        else if(u<.37)go(queue,outside,u/.37);
        else if(u<1){
          const k=(u-.37)/.63;go(outside,seat,k);sit=ease((k-.34)/.66);
          target.y+=.41*ease(k);heading=align(heading,car.rotation.y,sit);
        }else{target.copy(seat);target.y+=.41;sit=1;}
      }else if(phase===1){
        target.copy(seat);target.y+=.41;sit=1;
      }else if(phase===2){
        const near=(member===0?-1:1)===station.sign, u=(st.elapsed-(near?.18:.74))/3.06;
        if(u<=0){target.copy(seat);target.y+=.41;sit=1;}
        else if(u<.43){
          const k=u/.43;go(seat,outside,k);sit=1-ease(k/.71);target.y+=.41*(1-ease(k));
          heading=align(heading,car.rotation.y,sit);
        }else if(u<1)go(outside,activity,(u-.43)/.57);
        else{target.copy(activity);heading=Math.atan2(station.side.x*station.sign,station.side.z*station.sign);}
      }else if(phase===5 && st.duration-st.elapsed<3.4){
        go(activity,queue,1-(st.duration-st.elapsed)/3.4);
      }else{
        target.copy(activity);heading=Math.atan2(station.side.x*station.sign,station.side.z*station.sign);
      }
      group.position.copy(target);group.position.y+=Math.abs(stride)*.023;
      group.rotation.y=heading;hips.position.y=.58+(1.02-.41-.58*bodyScale)*sit/bodyScale;
      for(let j=0;j<2;j++){
        const step=(j?1:-1)*stride;
        legs[j].rotation.x=-(sit*1.32+step*.47*(1-sit));
        knees[j].rotation.x=sit*1.42+Math.max(0,step)*.45*(1-sit);
        arms[j].rotation.x=-sit*.57+step*.34*(1-sit);
      }
      group.updateMatrixWorld(true);
    }
    for(const [mesh,items] of batches){
      for(let i=0;i<items.length;i++)mesh.setMatrixAt(i,mat.multiplyMatrices(items[i].bone.matrixWorld,items[i].mat));
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  update(0);
  return update;
}
