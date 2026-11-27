import { buildMarket } from './market.js';

// 櫃檯商品、攤主取出的商品與遊客手上的商品共用網格，座標原點位於手掌。
const productFamilies=new WeakMap();
export function makeProductModel(T,kind){
  let family=productFamilies.get(T);
  if(!family){
    const blade=new T.BufferGeometry();
    blade.setAttribute('position',new T.Float32BufferAttribute([
      0,0,.02, -.052,.177,.025, .112,.158,0, .138,.095,-.038
    ],3));
    blade.setIndex([0,2,1,0,3,2,1,2,0,2,3,0]);
    // 兩面可見的葉片採用正面法線，摺線用不同深度塑形。
    blade.setAttribute('normal',new T.Float32BufferAttribute([0,.2,.98,0,0,1,.1,.12,.98,.2,.05,.97],3));
    family={models:new Map(),shapes:{
      box:new T.BoxGeometry(1,1,1),orb:new T.SphereGeometry(1,12,9),
      kernel:new T.IcosahedronGeometry(1,0),tube:new T.CylinderGeometry(1,1,1,12),
      cup:new T.CylinderGeometry(1,.73,1,12),cone:new T.ConeGeometry(1,1,12),
      ring:new T.TorusGeometry(1,.12,6,20),blade
    }};
    productFamilies.set(T,family);
  }
  if(family.models.has(kind))return family.models.get(kind);
  const pos=[],normal=[],rgb=[],idx=[];
  const matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),p=new T.Vector3(),n=new T.Vector3(),color=new T.Color();
  function part(type,col,x,y,z,w,h,d,rx=0,ry=0,rz=0){
    const g=family.shapes[type],a=g.attributes.position,b=g.attributes.normal;
    matrix.compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(w,h,d));
    normalMatrix.getNormalMatrix(matrix);color.set(col);
    const base=pos.length/3;
    for(let j=0;j<a.count;j++){
      p.fromBufferAttribute(a,j).applyMatrix4(matrix);n.fromBufferAttribute(b,j).applyNormalMatrix(normalMatrix);
      pos.push(p.x,p.y,p.z);normal.push(n.x,n.y,n.z);rgb.push(color.r,color.g,color.b);
    }
    for(let j=0;j<(g.index?.count??a.count);j++)idx.push(base+(g.index?g.index.getX(j):j));
  }
  function rod(col,x1,y1,z1,x2,y2,z2,r){
    const a=new T.Vector3(x1,y1,z1),b=new T.Vector3(x2,y2,z2),dir=b.clone().sub(a),l=dir.length();
    const e=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));
    part('tube',col,(x1+x2)/2,(y1+y2)/2,(z1+z2)/2,r,l,r,e.x,e.y,e.z);
  }
  const cream=0xffebbc,gold=0xf7b849,wood=0xb7814e,red=0xbb3234,blue=0x38a6a4;
  const names={cake:'焦糖爆米花杯',balloons:'印花氣球',gelato:'雙球甜筒',lanterns:'手提紙燈',candy:'糖蘋果',hoops:'彩色風車',lemon:'檸檬汽水'};
  if(kind==='cake'){
    part('cup',red,0,-.015,0,.139,.322,.139);
    for(let j=0;j<6;j++){
      const a=(j+.5)*Math.PI/3;
      part('box',cream,.118*Math.sin(a),-.012,.118*Math.cos(a),.053,.286,.014,0,a);
    }
    part('tube',cream,0,.145,0,.143,.023,.143);
    for(let j=0;j<17;j++){
      const a=j*2.399963,r=Math.sqrt(j/17)*.12,h=.166+.042*(1-j/17);
      part('kernel',j%4===0?gold:0xffdda1,r*Math.cos(a),h,r*Math.sin(a),.044,.044,.047,0,a,.4);
    }
  }else if(kind==='candy'){
    part('tube',wood,0,-.045,0,.016,.257,.016);
    part('orb',0xc32b35,0,.174,0,.134,.125,.128);
    part('orb',0xe04440,-.045,.225,.008,.077,.080,.083);
    part('orb',0xd63a3f,.045,.223,.01,.077,.081,.082);
    part('orb',0xffb782,-.063,.208,.097,.022,.034,.012,0,-.3,-.46);
    rod(wood,.002,.277,0,.036,.329,0,.012);
    part('orb',0x4d8b45,.059,.311,0,.039,.013,.017,0,0,.37);
  }else if(kind==='gelato'){
    part('cone',0xd39655,0,-.043,0,.103,.267,.103,Math.PI);
    part('tube',0xf3bd79,0,.071,0,.102,.044,.102);
    part('orb',0x9ac7a4,-.007,.123,0,.111,.096,.109);
    part('orb',0xec8d99,.012,.236,0,.094,.090,.094);
    part('box',0xdfa85e,.065,.301,-.02,.047,.132,.027,0,.35,-.25);
  }else if(kind==='lemon'){
    part('cup',0xe5bc51,0,-.012,0,.116,.328,.116);
    part('tube',blue,0,-.037,0,.100,.079,.100);
    part('tube',cream,0,.153,0,.123,.024,.123);
    rod(0xe16a63,.017,.155,0,.041,.305,0,.012);
    rod(0xfde8be,.041,.305,0,.080,.335,0,.012);
    part('tube',0xe5aa37,-.085,.176,.043,.073,.020,.073,Math.PI/2,.18,-.15);
    part('tube',0xffe19a,-.085,.176,.055,.061,.007,.061,Math.PI/2,.18,-.15);
    for(let j=0;j<5;j++){
      const a=j*Math.PI*.4;
      rod(0xfff1c3,-.085,.176,.062,-.085+.054*Math.cos(a),.176+.054*Math.sin(a),.062,.005);
    }
  }else if(kind==='balloons'){
    rod(cream,0,-.17,0,.035,.20,0,.008);
    part('cone',0xbb606f,.035,.225,0,.032,.067,.032);
    part('orb',0xe98091,.038,.405,0,.153,.202,.152);
    part('orb',cream,-.020,.468,.125,.025,.039,.010,0,-.26,-.36);
    part('ring',0xffc8a1,.038,.403,.143,.057,.057,.04);
  }else if(kind==='lanterns'){
    part('orb',0x43a89b,0,.035,0,.130,.160,.129);
    for(let j=0;j<4;j++){
      const y=(j-1.5)*.052,r=.132*Math.sqrt(1-(y/.162)**2);
      part('ring',0xe0c17a,0,.035+y,0,r,r,.041,Math.PI/2);
    }
    part('tube',0xb97940,0,-.11,0,.080,.035,.080);
    part('tube',0xb97940,0,.188,0,.081,.035,.081);
    part('ring',wood,0,.232,0,.067,.060,.042);
    part('cone',red,0,-.144,0,.018,.059,.018);
  }else if(kind==='hoops'){
    rod(wood,0,-.174,0,0,.212,0,.013);
    for(let j=0;j<4;j++)part('blade',[0xf08760,0x5bc2b8,0xe5b54a,0xb77eaa][j],0,.21,.017,0.88,0.88,.88,0,0,j*Math.PI*.5);
    part('orb',cream,0,.21,.048,.035,.035,.022);
  }else{throw new Error('未知的攤位商品 '+kind);}
  const g=new T.BufferGeometry();g.setIndex(idx);
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
  g.setAttribute('color',new T.Float32BufferAttribute(rgb,3));g.computeBoundingBox();g.computeBoundingSphere();g.name=names[kind];
  family.models.set(kind,g);return g;
}

// 攤位木作、園景與遊客依幾何形狀批次繪製。
export function buildVillage(ctx) {
  const {THREE:T,scene,bulbs}=ctx;
  const tau = Math.PI * 2;
  const v = (x,y,z) => new T.Vector3(x,y,z);
  const identity=new T.Quaternion(), up=v(0,1,0);
  const turn=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  const cube=new T.BoxGeometry(1,1,1);
  const orb=new T.SphereGeometry(1,10,7);
  const crown=new T.IcosahedronGeometry(1,1);
  const pipe=new T.CylinderGeometry(1,1,1,8);
  const slim=new T.CylinderGeometry(.72,1,1,7);
  const cone=new T.ConeGeometry(1,1,12);
  const brim=new T.CylinderGeometry(1,1,1,14);
  const ring=new T.TorusGeometry(1,.13,6,18);
  const funnel=new T.CylinderGeometry(.72,1,1,10);
  const shirt=new T.CylinderGeometry(.96,.84,1,9);
  const paint=new T.MeshStandardMaterial({metalness:.12,roughness:.65});
  const signPaint=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,metalness:.19,roughness:.65});
  const tubs=new Map(), faces=[], faceColors=[];
  const walkers=[], moving=[];
  let seed=241937;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const ivory=0xf1d8a5, gold=0xddad6d, ruby=0x9a3d4b, coral=0xcb665c;
  const teal=0x326d70, aqua=0x6fa7a0, plum=0x62537b, walnut=0x77513e;
  const honey=0xffbe6c, mint=0x79dfd1, rose=0xff8e82;

  function space(x,y,z,angle=0,scale=1,actor=null) {
    const frame=new T.Matrix4().compose(v(x,y,z),turn(0,angle,0),v(scale,scale,scale));
    function shape(geometry,p,size,q,color,bone=0) {
      const base=new T.Matrix4().compose(p,q,size);
      if(!actor) base.premultiply(frame);
      if(!tubs.has(geometry)) tubs.set(geometry,[]);
      tubs.get(geometry).push({base,actor,bone,color});
    }
    function triangle(a,b,c,col){
      const rgb=new T.Color(col);
      for(const p of [a,b,c]){
        const u=p.clone().applyMatrix4(frame);
        faces.push(u.x,u.y,u.z);faceColors.push(rgb.r,rgb.g,rgb.b);
      }
    }
    return {
      shape,
      box(x,y,z,w,h,d,color,q=identity,bone=0) {shape(cube,v(x,y,z),v(w,h,d),q,color,bone);},
      egg(x,y,z,w,h,d,color,q=identity,bone=0) {shape(orb,v(x,y,z),v(w,h,d),q,color,bone);},
      tube(x,y,z,r,h,color,type=pipe,q=identity){shape(type,v(x,y,z),v(r,h,r),q,color);},
      rod(a,b,r,color,bone=0,type=pipe) {
        const delta=b.clone().sub(a),len=delta.length();
        const q=new T.Quaternion().setFromUnitVectors(up,delta.multiplyScalar(1/len));
        shape(type,b.clone().add(a).multiplyScalar(.5),v(r,len,r),q,color,bone);
      },
      bulb(x,y,z,col,r,phase){
        const p=v(x,y,z).applyMatrix4(frame);
        bulbs.add(p.x,p.y,p.z,col,r*scale,3,phase);
      },
      triangle,
      quad(a,b,c,d,col){triangle(a,b,c,col);triangle(a,c,d,col);},
    };
  }
  function bunting(s,x1,z1,x2,z2,high,drop,colors){
    const n=9, p=[];
    for(let i=0;i<=n;i++){
      const u=i/n, x=x1+(x2-x1)*u, z=z1+(z2-z1)*u;
      p.push(v(x,high-drop*Math.sin(Math.PI*u),z));
      s.bulb(x,p[i].y-.064,z,colors[i%colors.length],.072,i/n);
      if(i>0) s.rod(p[i-1],p[i],.017,walnut);
    }
  }
  function tent(s,w,d,y,peak,a,b){
    const sides=12;
    for(let i=0;i<sides;i++){
      const u=tau*i/sides, t=tau*(i+1)/sides,m=(u+t)/2;
      const xy=(a,k,h)=>v(w*.58*k*Math.cos(a),h,d*.68*k*Math.sin(a));
      const c=i%2?a:b;
      s.quad(xy(u,.18,peak-.18),xy(t,.18,peak-.18),xy(t,.57,y+.25),xy(u,.57,y+.25),c);
      s.quad(xy(u,.57,y+.25),xy(t,.57,y+.25),xy(t,1,y),xy(u,1,y),c);
      s.quad(xy(u,1,y),xy(t,1,y),xy(t,1,y-.19),xy(u,1,y-.19),c);
      s.triangle(xy(u,1,y-.19),xy(t,1,y-.19),xy(m,1,y-.37),c);
      s.rod(xy(u,.18,peak-.16),xy(u,1,y+.012),.022,gold);
      const l=xy(m,1,y-.37);
      s.bulb(l.x,l.y,l.z,honey,.085,i/6);
    }
    s.tube(0,peak-.12,0,.22,.24,gold,cone);
  }
  function stripedAwning(s,w,d,y,a,b){
    const n=10, left=-w*.57, right=w*.57;
    for(let i=0;i<n;i++){
      const x=left+(right-left)*i/n, xx=left+(right-left)*(i+1)/n;
      const rear=-d*.51, ridge=-.13, front=d*.66, c=i%2===0?a:b;
      s.quad(v(x,y+.12,rear),v(xx,y+.12,rear),v(xx,y+.67,ridge),v(x,y+.67,ridge),c);
      s.quad(v(x,y+.67,ridge),v(xx,y+.67,ridge),v(xx,y,front),v(x,y,front),c);
      s.quad(v(x,y,front),v(xx,y,front),v(xx,y-.21,front),v(x,y-.21,front),c);
      s.egg((x+xx)/2,y-.19,front,(xx-x)*.49,.13,.036,c);
      s.bulb((x+xx)/2,y-.32,front+.025,i%3? honey:rose,.084,i/8);
    }
    s.rod(v(left,y+.68,-.13),v(right,y+.68,-.13),.065,gold);
  }
  const stalls=[
    [-20,4.0,.23,3.2,2.3,'cake',ruby,0xd65f61],
    [-23,10.8,.36,3.7,2.5,'balloons',teal,aqua],
    [-21.2,16.1,.30,3.0,2.0,'gelato',plum,0xa788b7],
    [-3.9,-4.2,-.15,3.2,2.3,'lanterns',teal,aqua],
    [3.5,6.6,-.32,2.62,1.75,'candy',ruby,0xd65f61],
    [23.4,10.4,-.28,3.25,2.2,'hoops',plum,0x9c80aa],
    [24.2,16.2,-.44,3.25,2.25,'lemon',teal,0x92b36d],
  ];
  const stockPaint=new T.MeshStandardMaterial({vertexColors:true,roughness:.49,metalness:.09});
  const machineWindows=[];
  for(let i=0;i<stalls.length;i++){
    const [x,z,angle,w,d,kind,a,b]=stalls[i], s=space(x,0,z,angle);
    const stock=[], model=makeProductModel(T,kind);
    const stallMatrix=new T.Matrix4().makeRotationY(angle).setPosition(x,0,z);
    function onShelf(px,base,pz,scale=1,yaw=0){
      const m=new T.Matrix4().compose(v(px,base-model.boundingBox.min.y*scale,pz),turn(0,yaw,0),v(scale,scale,scale));
      stock.push(stallMatrix.clone().multiply(m));
    }
    function glassPane(px,py,pz,width,height,depth){
      const m=new T.Matrix4().compose(v(px,py,pz),identity,v(width,height,depth));
      machineWindows.push(stallMatrix.clone().multiply(m));
    }
    const shelf=1.07, eave=2.44+(i%3)*.13;
    const front=d*.49+.10,tableZ=front-.28;
    s.box(0,.062,0,w+.20,.124,d+.14,walnut);
    s.box(0,.61,tableZ,w,.88,.55,a);
    for(let k=0;k<7;k++){
      const p=(k-3)*w/7;
      s.box(p,.67,front+.008,w/7-.05,.54,.044,k%2===0?b:a);
      s.box(p,.69,front+.040,.035,.43,.036,gold);
    }
    s.box(0,.27,front+.014,w,.085,.11,gold);
    s.box(0,shelf,tableZ,w+.17,.14,.59,ivory);
    // 背牆和窄檯面之間是工作走道，攤主可從貨架伸手取貨。
    s.box(0,.70,-d*.48,w,.99,.13,a);
    s.box(0,1.76,-d*.48,w,.99,.13,a);
    s.box(0,1.82,-d*.39,w-.24,.063,.35,gold);
    for(const side of [-1,1]) for(const front of [-1,1]){
      s.tube(side*(w/2-.07),1.77,front*(d/2-.03),.067,1.51,gold);
      s.egg(side*(w/2-.07),2.48,front*(d/2-.03),.10,.10,.10,ivory);
    }
    if(i%2===1 || kind==='gelato') tent(s,w,d,eave,eave+1.09,a,ivory);
    else stripedAwning(s,w,d,eave,b,ivory);
    bunting(s,-w*.5,d*.54,w*.5,d*.54,eave-.27,.13,[honey,honey,mint]);
    // 左端展示單件，右邊是成排備貨。中間預留完整的取貨與交付動線。
    s.box(w*.30,1.173,tableZ,w*.36,.066,.43,walnut);
    for(let k=0;k<3;k++)onShelf(w*(.18+k*.114),1.206,tableZ-.015,k===1?1.07:.98,(k-1)*.21);
    onShelf(-w*.39,1.14,tableZ+.04,1.20,.22);
    if(kind==='balloons'){
      for(let k=0;k<11;k++){
        const bx=-1.02+random()*.78,by=2.1+random()*1.22,bz=.31+random()*.52;
        s.rod(v(-.78,1.15,.58),v(bx,by-.23,bz),.012,ivory);
        s.egg(bx,by,bz,.205,.259,.200,[coral,aqua,0xd39caa,0xe3ba74][k%4]);
      }
      for(let k=0;k<3;k++)s.tube(w*.21+k*.19,1.235,tableZ,.068,.08,gold,brim);
    }else if(kind==='cake'){
      // 黃銅熱鍋、玻璃機身、紅色機頂與鍋底的焦糖玉米。
      const cx=-w*.27,cz=-d*.37;
      s.box(cx,1.902,cz,.74,.10,.37,ruby);
      glassPane(cx,2.117,cz+.14,.67,.35,.015);
      for(const dx of [-.336,.336])for(const dz of [-.145,.145])s.tube(cx+dx,2.12,cz+dz,.024,.42,gold);
      s.box(cx,2.34,cz,.77,.092,.42,ruby);
      s.tube(cx,2.20,cz,.167,.117,walnut,brim);
      for(let k=0;k<18;k++){
        const xx=cx-.27+(k%6)*.103,zz=cz-.083+Math.floor(k/6)*.087;
        s.shape(crown,v(xx,1.995+.026*Math.sin(k*1.6),zz),v(.082,.071,.075),turn(.2*k,.52*k,0),k%3?0xffdda1:0xe6ae58);
      }
      onShelf(w*.20,1.852,cz,1.15);onShelf(w*.35,1.852,cz);
    }else if(kind==='gelato'){
      // 冷藏展示盒內的三條冰淇淋，前面插好兩球甜筒。
      const cx=-w*.21,cz=-d*.39;
      s.box(cx,1.945,cz,.96,.184,.36,ivory);
      glassPane(cx,2.05,cz+.16,.89,.19,.014);
      for(let k=0;k<3;k++){
        const px=cx+(k-1)*.285;
        s.box(px,2.041,cz,.27,.037,.26,0x926e62);
        s.egg(px,2.069,cz,.119,.067,.108,[0xe99e9d,0xb4ceb8,0xeac795][k]);
      }
      onShelf(w*.30,1.852,cz,1.30);
      s.shape(cone,v(0,3.74,0),v(.28,.54,.28),turn(Math.PI,0,0),gold);
      s.egg(0,4.03,0,.30,.24,.30,0xedadaf);
      s.egg(.13,4.16,0,.17,.14,.16,ivory);
    }else if(kind==='lanterns'){
      s.rod(v(-w*.40,2.42,-d*.39),v(w*.40,2.42,-d*.39),.030,gold);
      for(let k=0;k<4;k++){
        const bx=(k-1.5)*.49;
        onShelf(bx,1.932,-d*.39,1.09,k*.2);
        s.tube(bx,2.421,-d*.39,.017,.079,gold);
        s.bulb(bx,2.167,-d*.39+.143,honey,.065,k/7);
      }
    }else if(kind==='candy'){
      // 木製雙層蘋果架與緩緩凝固的糖衣。不同高度能從攤前看清木棒。
      const cz=-d*.39;
      s.box(0,1.888,cz,w*.76,.072,.31,walnut);
      for(let k=0;k<4;k++){
        const bx=(k-1.5)*w*.18;
        const height=k%2*.08;
        s.tube(bx,1.957+height/2,cz,.084,.068+height,ivory,brim);
        onShelf(bx,1.989+height,cz,.96,k*.29);
      }
    }else if(kind==='hoops'){
      for(let k=0;k<5;k++){
        const bx=(k-2)*w*.165,cz=-d*.39;
        s.box(bx,1.916,cz,.16,.13,.17,[aqua,coral,ivory][k%3]);
        onShelf(bx,1.98,cz,.96,Math.sin(k)*.3);
      }
    }else{
      // 黃檸檬與青檸冷飲機有不同色的槽身、冰塊、出水龍頭及接水盤。
      for(let k=0;k<2;k++){
        const bx=(-.24+k*.29)*w,cz=-d*.39;
        s.box(bx,1.904,cz,.48,.10,.34,teal);
        s.tube(bx,2.107,cz,.172,.308,k?0xa8c75c:0xf2bf48,brim);
        s.tube(bx,2.27,cz,.181,.037,ivory,brim);
        s.box(bx,2.060,cz+.183,.06,.057,.109,gold);
        s.box(bx,2.073,cz+.232,.104,.032,.045,teal);
        s.box(bx-.092,2.136,cz+.148,.028,.179,.014,0xffedb8,turn(0,0,-.10));
        glassPane(bx,2.095,cz+.157,.32,.29,.013);
      }
      for(let k=0;k<4;k++)s.egg(w*.35+(k%2)*.07,1.91+Math.floor(k/2)*.08,-d*.37,.084,.062,.060,0xe7c053,turn(0,0,(k-1)*.40));
      s.egg(0,3.7,0,.30,.32,.31,0xd6ad54);
      s.egg(.15,3.99,0,.16,.061,.076,teal,turn(0,0,.4));
    }
    const goods=new T.InstancedMesh(model,stockPaint,stock.length);
    goods.name='陳列商品-'+kind;
    stock.forEach((m,j)=>goods.setMatrixAt(j,m));goods.computeBoundingSphere();scene.add(goods);
  }
  const glass=new T.InstancedMesh(cube,new T.MeshStandardMaterial({
    color:0xe2f2f2,transparent:true,opacity:.18,depthWrite:false,roughness:.15,metalness:.13
  }),machineWindows.length);
  machineWindows.forEach((m,i)=>glass.setMatrixAt(i,m));glass.computeBoundingSphere();scene.add(glass);

  // 外圍的柏樹、闊葉樹與少量棕櫚保留了中央設施的剪影。
  const trees=[[-26,-13,5.3,0],[-24,-6,4.5,1],[-24,.2,4.8,2],[-26.7,5.2,3.0,0],[-26.0,13.9,4.75,2],[-25.1,18.5,3.2,1],
    [-19,-18,4.8,1],[-14,-18.4,5.1,0],[-8.8,-18.0,4.2,0],[-4,-17.4,5.0,2], [1.1,-16.9,4.5,0],[5.2,-19.3,5.1,1],
    [12.8,-19.8,4.2,0],[19,-17.9,4.6,0],[27,-17.6,5.9,2],[29.8,-10.8,5.2,0],
    [30.4,-3.8,4.1,1],[30,5,4.6,0],[27.7,11.7,4.0,1],[27.7,17.7,4.8,2]];
  for(const [x,z,h,kind] of trees){
    const s=space(x,0,z,random()*tau), bark=0x695848;
    s.tube(0,h*.34,0,h*.047,h*.69,bark,slim);
    if(kind===0){
      s.egg(0,h*.60,0,h*.149,h*.405,h*.16,0x345a52);
      s.egg(-h*.035,h*.59,h*.048,h*.105,h*.33,h*.115,0x426b55);
      s.egg(0,h*.80,0,h*.096,h*.24,h*.10,0x517253);
    }else if(kind===1){
      for(let i=0;i<7;i++){
        const a=tau*i/7,reach=(.11+random()*.13)*h, cx=reach*Math.cos(a),cz=reach*Math.sin(a);
        s.rod(v(0,.43*h,0),v(cx,.66*h,cz),.082,bark);
        s.shape(crown,v(cx,(.66+random()*.16)*h,cz),v(.19*h,.215*h,.20*h),turn(random(),random(),0),
          [0x406650,0x486e54,0x527753,0x385b52][i%4]);
      }
    }else{
      s.rod(v(0,h*.62,0),v(h*.05,h*.87,0),h*.047,bark,0,slim);
      for(let k=0;k<8;k++){
        const a=tau*k/8+random()*.17, dir=v(Math.cos(a),0,Math.sin(a)), side=v(-dir.z,0,dir.x);
        const center=t=>v(h*.05+dir.x*t*h*.50,h*(.845+.20*Math.sin(Math.PI*t)-.135*t),dir.z*t*h*.50);
        for(let j=0;j<7;j++){
          const t=j/7, next=(j+1)/7,p=center(t),q=center(next);
          s.rod(p,q,.023,0x7f814f);
          for(const sign of [-1,1]){
            const leaf=q.clone().addScaledVector(side,sign*h*(.075+.057*Math.sin(Math.PI*t))*(1-t*.76));
            leaf.y-=h*.074;
            s.triangle(p,q,leaf,(j+k)%3?0x507454:0x69824f);
          }
        }
      }
    }
  }
  const skirts=[[-19.3,1.3],[-24.5,8.1],[-18.8,17.9],[25.8,13.9],[-16.1,-15.2],[28.2,8.3],[21.0,18.4]];
  for(const [x,z] of skirts){
    const s=space(x,0,z);
    for(let k=0;k<6;k++){
      s.shape(crown,v((k-2.5)*.34,.40+random()*.12,.21*Math.sin(k)),v(.58,.46,.53),turn(0,k*.7,.22),
        k%2?0x436955:0x477155);
    }
  }

  // 手臂與腿部各有獨立轉軸，散步人群沿橢圓路段行走。
  const coats=[0xa65358,0x5e8084,0xb5966e,0x7f7697,0x526576,0xb67966,0x6e8d79,0xcdc1a6];
  const skin=[0xe2b395,0xc18c70,0x986d57,0xd4aa80], hair=[0x503d33,0x3a3738,0x83644a,0x744739];
  function visitor(x,z,angle,scale,id,walk=0,height=0){
    const actor=walk?{x,z,angle,scale,phase:random()*tau,speed:.52+random()*.2,
      walk,bones:Array.from({length:5},()=>new T.Matrix4())}:null;
    if(actor) walkers.push(actor);
    const s=space(x,height,z,angle,scale,actor);
    const coat=coats[id%coats.length],tone=skin[id%4],locks=hair[(id*3+1)%4];
    const pants=id%3 ? 0x434d58 : 0x57534f, skirt=id%6===1;
    s.shape(shirt,v(0,.89,0),v(.177,.40,.116),identity,coat);
    if(skirt) s.shape(funnel,v(0,.65,0),v(.21,.30,.145),identity,coat);
    s.egg(0,1.234,.016,.129,.158,.119,tone);
    s.egg(0,1.318,-.018,.131,.111,.123,locks);
    if(id%5===2) s.egg(0,1.205,-.100,.129,.138,.067,locks);
    if(id%8===0){
      s.tube(0,1.327,0,.161,.037,ivory,brim);
      s.egg(0,1.37,0,.128,.079,.115,teal);
    }
    for(const side of [-1,1]) {
      const i=side<0?1:2, leg=walk?i:0, arm=walk?i+2:0;
      const gap=side*(.075+((id%3)*.014));
      const forward=walk?0:side*((id%5)*.035);
      s.rod(v(gap,.70,0),v(gap*1.07,.36,forward+.015),.065,pants,leg);
      s.rod(v(gap*1.07,.36,forward+.015),v(gap*1.16,.09,forward),.058,pants,leg,slim);
      s.egg(gap*1.16,.073,forward+.038,.066,.066,.106,0x38363b,identity,leg);
      const raised=!walk && (id+side)%7===0;
      const elbow=v(side*(raised?.28:.205),raised?.97:.841,.037);
      const hand=v(side*(raised?.23:.207),raised?1.16:.685,raised?.18:.067);
      s.rod(v(side*.155,1.04,0),elbow,.058,coat,arm);
      s.rod(elbow,hand,.044,tone,arm);s.egg(hand.x,hand.y,hand.z,.048,.054,.048,tone,identity,arm);
    }
  }
  let number=0;
  for(const [x,z,a] of [[-6.1,12.7,-1.6],[-5.7,13.3,-1.62],[-5.3,14.03,-1.46],[-4.9,13.65,-1.62],
    [-4.4,13.71,-1.8],[-4.15,13.12,1.75],[-16.4,9.53,1.52],[-17,9.85,1.57],[-17.6,10.26,1.93],
    [7,12.0,1.90],[6.68,12.57,1.96],[6.42,13.13,2.32],[6.18,13.78,1.89],[5.71,14.24,2.09],
    [-8.33,17.49,-1.35],[-8.99,17.46,1.96],[9.04,18.15,2.91],[9.61,18.19,2.95],
    [17.81,11.65,.88],[18.2,11.92,.75],[-2.25,2.15,2.7],[-2.71,1.72,1.2]]){
    visitor(x,z,a,.80+random()*.27,number++);
  }
  for(const [x,z,r] of [[-1.3,11.7,1.52],[-2.8,6.65,1.12],[-2.75,2.4,1.21],[.3,13.1,1.04],
    [-21.05,13.95,1.08],[-20.65,8.0,.87],[5.28,16.66,1.19],[19.54,13.55,1.33]]){
    visitor(x,z,0,.83+random()*.22,number++,r);
  }
  if(faces.length){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(faces,3));
    g.setAttribute('color',new T.Float32BufferAttribute(faceColors,3));
    g.computeVertexNormals();
    scene.add(new T.Mesh(g,signPaint));
  }
  for(const [g,records] of tubs){
    const m=new T.InstancedMesh(g,paint,records.length);
    const dynamic=[];
    for(let i=0;i<records.length;i++){
      const item=records[i];
      m.setMatrixAt(i,item.base);m.setColorAt(i,new T.Color(item.color));
      if(item.actor) dynamic.push({index:i,...item});
    }
    if(dynamic.length){m.instanceMatrix.setUsage(T.DynamicDrawUsage);moving.push([m,dynamic]);m.frustumCulled=false;}
    scene.add(m);
  }
  const tmp=new T.Matrix4(), rot=new T.Matrix4(), shift=new T.Matrix4();
  const direction=new T.Quaternion(), point=v(0,0,0), size=v(1,1,1);
  const updateMarket=buildMarket({...ctx,makeProductModel},stalls);
  function update(t){
    updateMarket(t);
    for(const a of walkers){
      const time=t*a.speed+a.phase, dx=-.46*Math.sin(time),dz=Math.cos(time);
      const stride=Math.sin(t*5.6+a.phase);
      point.set(a.x+.46*a.walk*Math.cos(time),.024*Math.abs(stride),a.z+a.walk*Math.sin(time));
      direction.setFromAxisAngle(up,Math.atan2(dx,dz));size.setScalar(a.scale);
      a.bones[0].compose(point,direction,size);
      for(let j=1;j<5;j++){
        const isLeg=j<3,sign=j%2?1:-1, y=isLeg?.68:1.03;
        rot.makeRotationX(stride*sign*(isLeg?.36:-.27));
        a.bones[j].copy(a.bones[0]).multiply(shift.makeTranslation(0,y,0)).multiply(rot).multiply(shift.makeTranslation(0,-y,0));
      }
    }
    for(const [m,items] of moving){
      for(const item of items) m.setMatrixAt(item.index,tmp.multiplyMatrices(item.actor.bones[item.bone],item.base));
      m.instanceMatrix.needsUpdate=true;
    }
  }
  update(0);
  return update;
}
