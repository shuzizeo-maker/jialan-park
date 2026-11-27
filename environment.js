import { buildVillage } from './village.js';

export function buildEnvironment(ctx) {
  const {THREE:T,scene,bulbs,dayCycle}=ctx;
  const V=(x,y,z)=>new T.Vector3(x,y,z);
  const tau=Math.PI*2;
  let seed=6135781;
  const rnd=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
  const shore=x=>21.1+1.5*Math.cos(x*.17)+.85*Math.sin(x*.077);
  const materials={
    paint:new T.MeshStandardMaterial({roughness:.63,metalness:.18}),
    brass:new T.MeshStandardMaterial({roughness:.35,metalness:.56}),
    stone:new T.MeshStandardMaterial({roughness:.92}),
    glass:new T.MeshStandardMaterial({color:0xbbbcb7,roughness:.28,emissive:0xffd69b,emissiveIntensity:0})
  };
  const cube=new T.BoxGeometry(1,1,1);
  const sphere=new T.SphereGeometry(1,10,7), tube=new T.CylinderGeometry(1,1,1,10);
  const dome=new T.SphereGeometry(1,14,9,0,tau,0,Math.PI/2);
  const roof=new T.ConeGeometry(1,1,8), trim=new T.CylinderGeometry(1,1,1,8);
  const stone=0xc5a186,cream=0xf3ce99,teal=0x185957,red=0xa44546,gold=0xe7a860,iron=0x2a4147,dark=0x42414c;
  const batches=new Map(), dummy=new T.Object3D();
  const up=V(0,1,0);
  function add(geo,mat,col,x,y,z,sx,sy,sz,rotation){
    const id=geo.uuid+mat.uuid;
    if(!batches.has(id))batches.set(id,{geo,mat,transforms:[],colors:[]});
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);
    dummy.quaternion.identity();
    if(typeof rotation==='number') dummy.rotation.y=rotation;
    else if(rotation)dummy.quaternion.copy(rotation);
    dummy.updateMatrix();
    const b=batches.get(id);b.transforms.push(dummy.matrix.clone());b.colors.push(new T.Color(col));
  }
  const box=(...a)=>add(cube,...a);
  const cyl=(mat,c,x,y,z,r,h,n=tube)=>add(n,mat,c,x,y,z,r,h,r);
  const ball=(mat,c,x,y,z,r,sy=r,sz=r)=>add(sphere,mat,c,x,y,z,r,sy,sz);
  function beam(a,b,r,c,mat=materials.brass){
    const d=b.clone().sub(a),len=d.length(),mid=a.clone().lerp(b,.5);
    add(tube,mat,c,mid.x,mid.y,mid.z,r,len,r,new T.Quaternion().setFromUnitVectors(up,d.normalize()));
  }
  function pipe(points,r,color,mat=materials.brass){
    for(let i=1;i<points.length;i++)beam(points[i-1],points[i],r,color,mat);
  }
  function bulb(x,y,z,c=0xffcf82,r=.074,phase=0,g=1){bulbs.add(x,y,z,c,r,g,phase);}
  // 園區平面手繪在記憶體畫布上，鋪磚、草地、路緣和接觸陰影共享一張紋理。
  const map=document.createElement('canvas');map.width=1536;map.height=1024;
  const draw=map.getContext('2d');
  const minX=-46,maxX=46,minZ=-34,maxZ=25;
  const px=(x)=>(x-minX)/(maxX-minX)*map.width, pz=(z)=>(z-minZ)/(maxZ-minZ)*map.height;
  draw.fillStyle='#435147';draw.fillRect(0,0,map.width,map.height);
  for(let i=0;i<45000;i++){
    draw.fillStyle=rnd()<.54?'rgba(40,58,47,.27)':'rgba(151,148,109,.21)';
    draw.fillRect(rnd()*map.width,rnd()*map.height,rnd()*4+.8,rnd()*3+.6);
  }
  const bricks=document.createElement('canvas');bricks.width=52;bricks.height=34;
  const bc=bricks.getContext('2d');bc.fillStyle='#746674';bc.fillRect(0,0,52,34);
  for(let j=0;j<4;j++)for(let i=-1;i<5;i++){
    const k=Math.floor(rnd()*16);
    bc.fillStyle=`rgb(${121+k},${109+k},${116+k})`;
    bc.fillRect(i*13+(j%2)*6.5,j*8.5,12.35,8.05);
  }
  const pavement=draw.createPattern(bricks,'repeat');
  function line(points,width){
    draw.beginPath();draw.moveTo(px(points[0][0]),pz(points[0][1]));
    for(let i=1;i<points.length;i++)draw.lineTo(px(points[i][0]),pz(points[i][1]));
    draw.lineJoin='round';draw.lineCap='round';
    for(const [delta,col] of [[.45,'#a4968b'],[.22,'#675f69'],[0,pavement]]){
      draw.strokeStyle=col;draw.lineWidth=(width+delta)*16.72;draw.stroke();
    }
  }
  function plaza(x,z,rx,rz){
    draw.beginPath();draw.ellipse(px(x),pz(z),rx*16.72,rz*17.35,0,0,tau);draw.fillStyle=pavement;draw.fill();
    draw.strokeStyle='#b49b85';draw.lineWidth=4;draw.stroke();
    draw.beginPath();draw.ellipse(px(x),pz(z),(rx-.31)*16.72,(rz-.31)*17.35,0,0,tau);
    draw.lineWidth=2;draw.stroke();
  }
  line([[-42,18],[-28,19],[-15,18],[-1,17],[12,20],[28,18],[46,15]],3.0);
  line([[-1,23],[-1,16],[-2.5,10],[-1.6,4],[-1,-8],[2,-18]],3.9);
  line([[-27,16],[-21,7],[-17,2],[-8,0],[-1,2],[6,3],[17,5],[24,10],[26,18]],2.7);
  line([[-23,3],[-21,-11],[-13,-17],[-1,-18],[13,-17],[26,-12],[31,0],[27,12]],2.3);
  plaza(-11,10,6.5,6.15); plaza(13,15,7.0,5.25); plaza(-13,-9,10.8,6.9);plaza(-1,18,6.0,3.4);
  // 嘉蘭遊樂場新增園區的步道與廣場：主街延伸到城堡、左側探險叢林、右側 ABC 港灣與數字星球、後方文字森林。
  line([[2,-18],[0,-22]],3.9);
  line([[-21,-11],[-24,-17],[-26,-22]],2.3); line([[-13,-17],[-20,-21]],2.3);
  line([[-23,3],[-30,6],[-35,8]],2.5); line([[-21,-11],[-29,-12],[-35,-12]],2.5); line([[-36,2],[-36,-5]],2.2); line([[-42,18],[-38,13]],2.2);
  line([[31,0],[36,4]],2.4); line([[46,15],[39,11]],2.4); line([[26,-12],[33,-15]],2.4); line([[31,0],[35,-10]],2.2);
  plaza(0,-26.5,17.2,8.1);
  plaza(-26,-25,6.0,5.8); plaza(-36,8,7.4,7.2); plaza(-36,-12,6.6,6.4); plaza(38,7,6.6,6.4); plaza(36,-16,4.6,4.4);
  function stain(x,z,rx,rz,color){
    draw.save();draw.translate(px(x),pz(z));draw.scale(rx*16.72,rz*17.35);
    const gr=draw.createRadialGradient(0,0,0,0,0,1);
    gr.addColorStop(0,color);gr.addColorStop(1,'transparent');
    draw.fillStyle=gr;draw.fillRect(-1,-1,2,2);draw.restore();
  }
  for(const [x,z,rx,rz] of [[-13,-9,10,6],[-11,10,5.5,5.5],[13,15,5.8,3.6],[15,-4,14,8],[-21,15,4,3],[23,13,4,3]]) stain(x,z,rx,rz,'rgba(22,19,29,.58)');
  const groundMap=new T.CanvasTexture(map);groundMap.colorSpace=T.SRGBColorSpace;groundMap.anisotropy=4;
  // 燈柱腳邊的暖光另繪於發光貼圖，白天的鋪磚保有原色。
  const spill=document.createElement('canvas');spill.width=384;spill.height=256;
  const wash=spill.getContext('2d');wash.fillStyle='#000';wash.fillRect(0,0,384,256);
  for(const [x,z] of [[-2,19],[3,19],[-11,15],[-20,13],[8,17],[20,17],[2,6],[-5,9],[-13,-2],[24,12]]){
    const xx=px(x)/4,zz=pz(z)/4;
    const glow=wash.createRadialGradient(xx,zz,0,xx,zz,12);
    glow.addColorStop(0,'#e6a061');glow.addColorStop(1,'transparent');
    wash.fillStyle=glow;wash.fillRect(xx-12,zz-12,24,24);
  }
  const spillMap=new T.CanvasTexture(spill);spillMap.colorSpace=T.SRGBColorSpace;
  const groundMaterial=new T.MeshStandardMaterial({map:groundMap,roughness:.73,metalness:.17,
    emissive:0xffffff,emissiveMap:spillMap,emissiveIntensity:0});
  const gv=[],gu=[],gi=[];
  for(let i=0;i<=128;i++){
    const x=minX+(maxX-minX)*i/128,z=shore(x);
    gv.push(x,0,minZ,x,0,z);gu.push(i/128,1,i/128,1-(z-minZ)/(maxZ-minZ));
    if(i<128){const k=2*i;gi.push(k,k+1,k+2,k+2,k+1,k+3);}
  }
  const groundGeo=new T.BufferGeometry();
  groundGeo.setAttribute('position',new T.Float32BufferAttribute(gv,3));groundGeo.setAttribute('uv',new T.Float32BufferAttribute(gu,2));groundGeo.setIndex(gi);groundGeo.computeVertexNormals();
  scene.add(new T.Mesh(groundGeo,groundMaterial));

  // 水岸的砌石壓頂、間隔柱與兩道鑄鐵欄杆。
  for(let x=-45;x<45;x+=1.45){
    const z=shore(x),z2=shore(x+1.45),theta=-Math.atan2(z2-z,1.45);
    const len=Math.hypot(1.45,z2-z),cx=x+.725,cz=(z+z2)/2;
    box(materials.stone,0x74646b,cx,-.65,cz,len+.035,1.32,.55,theta);
    box(materials.stone,stone,cx,.038,cz,len+.032,.14,.67,theta);
    for(let k=0;k<2;k++)box(materials.stone,0x9b8580,cx,-.33-k*.48,cz+.264,len-.056,.41,.09,theta);
    if(x< -4.6 || x>1.35){
      beam(V(x,.18,z),V(x,.93,z),.054,iron);
      ball(materials.brass,gold,x,.96,z,.095);
      for(const y of [.44,.8])beam(V(x,y,z),V(x+1.45,y,z2),.029,iron);
    }
  }
  function lamp(x,z,height=3.65,lit=true){
    const p=materials.paint,b=materials.brass;
    cyl(p,iron,x,.1,z,.26,.2);cyl(b,gold,x,.23,z,.18,.10);
    cyl(p,teal,x,.48,z,.14,.45);cyl(p,iron,x,height*.48,z,.065,height-.85);
    cyl(b,gold,x,height-.53,z,.13,.10);cyl(p,iron,x,height-.44,z,.24,.09,trim);
    add(trim,materials.glass,0xffdb9e,x,height-.21,z,.208,.42,.208);
    for(let i=0;i<4;i++){
      const a=Math.PI/4+i*Math.PI/2;const dx=Math.cos(a)*.19,dz=Math.sin(a)*.19;
      beam(V(x+dx,height-.44,z+dz),V(x+dx*1.16,height+.015,z+dz*1.16),.025,iron);
    }
    cyl(p,iron,x,height+.10,z,.33,.22,roof);ball(b,gold,x,height+.25,z,.07,.11);
    if(lit)bulb(x,height-.17,z+.11,0xffbc71,.21,0,0);
  }
  for(const [x,z,h] of [[-24,19,3.2],[-17.5,19,3.5],[-7,18,3.3],[5.4,19.3,3.35],[20.5,18.5,3.45],[27.5,16,3.2],[-3.8,10.5,3.25],[1.25,11,3.25],[-18,2.5,3.55],[1,-2.5,3.45],[6,6.5,3.5],[26,6.5,3.55],[-6,-12,3.65]])lamp(x,z,h);

  // 斜向木棧橋從水面導向入口。踏板逐片拼接，橋墩延伸到水面下。
  const entryX=-1,entryZ=18;
  const bridgeFrom=V(-8,0,36.8),bridgeTo=V(entryX,0,shore(entryX)-.14);
  const bridgeDir=bridgeTo.clone().sub(bridgeFrom).normalize(),side=V(bridgeDir.z,0,-bridgeDir.x);
  const ra=-Math.atan2(bridgeDir.x,-bridgeDir.z);
  const bridgePoint=(t,d=0)=>bridgeFrom.clone().lerp(bridgeTo,t).addScaledVector(side,d);
  for(let k=0;k<61;k++){
    const p=bridgePoint((k+.5)/61);
    const tones=[0xa58065,0x8f7065,0x967a69,0xad8871,0x9f7e70];
    box(materials.stone,tones[Math.floor(rnd()*tones.length)],p.x,.08,p.z,3.12,.16,bridgeFrom.distanceTo(bridgeTo)/61-.009,ra);
  }
  for(let s of [-1,1]){
    for(let i=0;i<=7;i++){
      const p=bridgePoint(i/7,s*1.52);
      box(materials.paint,0x66504d,p.x,-.13,p.z,.18,2.48,.18);
      ball(materials.brass,gold,p.x,1.15,p.z,.15,.075);
      if(i<7)for(let y of [.47,1.03]){
        const q=bridgePoint((i+1)/7,s*1.52);
        beam(V(p.x,y,p.z),V(q.x,y,q.z),.047,0x8e7062,materials.paint);
      }
      if(i===1||i===5)lamp(p.x,p.z,2.45);
    }
  }

  // 入口採用雙層拱券、星芒徽章和銅綠尖頂，不使用招牌文字。
  const z=entryZ,x0=entryX;
  for(const s of [-1,1]){
    const x=x0+s*2.73;
    box(materials.stone,stone,x,.17,z,.97,.34,1.05);
    box(materials.paint,teal,x,1.87,z,.63,3.13,.74);
    box(materials.paint,red,x,1.97,z+.385,.32,2.46,.052);
    for(let k of [-1,1])box(materials.brass,gold,x+k*.23,1.8,z+.398,.041,2.94,.055);
    for(const [y,w,h,c] of [[.4,.80,.18,cream],[.58,.69,.09,gold],[3.30,.81,.21,cream],[3.54,.93,.20,red],[3.68,.99,.08,gold]])box(materials.paint,c,x,y,z,w,h,w);
    add(dome,materials.paint,teal,x,3.73,z,.45,.65,.45);
    cyl(materials.brass,gold,x,4.5,z,.085,.38,roof);ball(materials.glass,0xffdca2,x,4.72,z,.075);
    for(let i=0;i<10;i++)bulb(x, .76+i*.24,z+.432,0xffc78b,.043,i/10);
  }
  const arch=(s,yOff,zOff)=>V(x0+2.75*s,2.84+1.68*(1-s*s)+yOff,z+zOff);
  for(let k=0;k<32;k++){
    const a=-1+k/16,b=a+1/16;
    for(const [y,dep,r,c] of [[.06,.17,.19,teal],[.035,.35,.095,gold],[-.15,.35,.050,cream],[.33,.1,.11,red],[.38,.25,.053,gold]]){
      beam(arch(a,y,dep),arch(b,y,dep),r,c,materials.paint);
    }
    if(k%2===0){const p=arch(a,.025,.45);bulb(p.x,p.y,p.z,0xffd398,.076,k/32);}
  }
  const badge=V(x0,4.63,z+.30);
  ball(materials.brass,gold,badge.x,badge.y,badge.z,.65,.66,.16);
  ball(materials.paint,teal,badge.x,badge.y,badge.z+.12,.55,.56,.08);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,dx=Math.sin(a),dy=Math.cos(a),len=i%2?.27:.47;
    const center=badge.clone().add(V(0,0,.23));
    const end=center.clone().add(V(dx*len,dy*len,0));
    beam(center,end,i%2?.026:.047,cream);
  }
  bulb(badge.x,badge.y,badge.z+.27,0xffe4aa,.11);
  function booth(x,z,c){
    const p=materials.paint,b=materials.brass;
    box(materials.stone,stone,x,.08,z,1.86,.16,1.62);
    box(p,c,x,.71,z,1.63,1.25,1.42);
    for(let sx of [-.75,.75])for(let sz of [-.64,.64])box(b,gold,x+sx,1.68,z+sz,.09,1.26,.09);
    box(p,cream,x,1.18,z+.67,1.76,.12,.30);
    box(p,0x5c555a,x,1.65,z-.60,1.52,.89,.06);
    box(p,c,x,2.19,z,1.77,.19,1.55);
    for(let sx of [-.45,0,.45])box(p,cream,x+sx,.68,z+.718,.038,.96,.031);
    for(let sz of [-.7,.7])box(b,gold,x,2.27,z+sz,1.92,.085,.12);
    add(dome,p,c,x,2.29,z,.97,.62,.85);
    cyl(b,gold,x,2.98,z,.065,.29,roof);
    for(let i=0;i<9;i++)bulb(x-.80+i*.20,2.22,z+.82,0xffce87,.052,i/9);
  }
  booth(x0-4.5,z-.55,0x9e4440);booth(x0+4.55,z-.65,0x256f70);

  // 園內長椅與曲線花圃。
  function bench(x,z,angle){
    const a=Math.cos(angle),b=-Math.sin(angle);
    const local=(u,v)=>[x+u*a-v*b,z+u*b+v*a];
    for(let i=0;i<3;i++){const q=local(0,i*.155);box(materials.paint,0xad7353,q[0],.48,q[1],1.6,.085,.12,angle);}
    for(let i=0;i<2;i++){const q=local(0,-.12);box(materials.paint,0xb4805d,q[0],.72+i*.17,q[1],1.60,.105,.085,angle);}
    for(const side of [-.58,.58]){
      const q=local(side,.14);box(materials.paint,iron,q[0],.22,q[1],.11,.42,.44,angle);
      const r=local(side,-.12);beam(V(r[0],.20,r[1]),V(r[0],.93,r[1]),.048,iron);
    }
  }
  for(const [x,z,a] of [[-13,18.6,.14],[-10.3,18.3,.1],[8.2,20.4,-.12],[17.5,19.9,-.28],[-5.65,7,1.48],[22,18.3,-.3],[-18.5,2.4,-.22]])bench(x,z,a);
  for(const [x,z,r] of [[-7.5,17.3,.69],[5,16.3,.67],[-1.6,6,.59],[3.6,-1,.78],[-19,18.7,.66],[19.4,19,.73]]){
    cyl(materials.stone,stone,x,.22,z,r,.43,trim);cyl(materials.paint,0x46583f,x,.44,z,r*.95,.09,trim);
    for(let n=0;n<48;n++){
      const a=rnd()*tau,h=Math.sqrt(rnd())*r*.84;
      const xx=x+h*Math.cos(a),zz=z+h*Math.sin(a);
      ball(materials.paint,n%4===0?0xd9a291:n%4===1?0xbd796b:0x638663,xx,.5+rnd()*.14,zz,.085+rnd()*.055);
    }
  }
  for(const {geo,mat,transforms,colors} of batches.values()){
    const mesh=new T.InstancedMesh(geo,mat,transforms.length);
    transforms.forEach((mx,i)=>{mesh.setMatrixAt(i,mx);mesh.setColorAt(i,colors[i]);});
    mesh.computeBoundingSphere();scene.add(mesh);
  }
  const updateVillage=buildVillage(ctx);
  return (t,dt)=>{
    materials.glass.emissiveIntensity=dayCycle.lamps*.86;
    groundMaterial.emissiveIntensity=dayCycle.lamps*.16;
    updateVillage(t,dt);
  };
}
