import { Reflector } from 'three/addons/objects/Reflector.js';

export function skyAndWater({THREE:T,scene,renderer,dayCycle}) {
  let seed=85391;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  // 可平鋪的多尺度雜訊，用於薄雲和水波的細微擾動。
  const n=256, texels=new Uint8Array(n*n);
  const octaves=[4,9,18,36,75].map(side=>({side,grid:Float32Array.from({length:side*side},rand)}));
  function valueNoise(o,x,y){
    const gx=x*o.side,gy=y*o.side,ix=Math.floor(gx),iy=Math.floor(gy);
    let fx=gx-ix,fy=gy-iy;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    const at=(i,j)=>o.grid[(j%o.side)*o.side+(i%o.side)];
    return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    let value=0;
    for(let k=0;k<octaves.length;k++)value+=valueNoise(octaves[k],i/n,j/n)*(.52/Math.pow(2,k));
    texels[j*n+i]=Math.min(255,value*255);
  }
  const grain=new T.DataTexture(texels,n,n,T.RedFormat);
  grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.magFilter=T.LinearFilter;
  grain.minFilter=T.LinearMipMapLinearFilter;grain.generateMipmaps=true;grain.needsUpdate=true;
  const time={value:0}, daylight={value:0}, dusk={value:0}, lamps={value:1};
  const sunDirection={value:new T.Vector3(-.36,.47,-.80).normalize()};
  // 兩層雲各在自己的水平面順風飄移。雲腹和捲邊共用座標，細紋以較慢的速度演化。
  const cloudField=`
    vec2 cloudLayers(vec3 d,float t){
      float h=max(d.y,0.);
      vec2 plane=d.xz/(h+.14);
      vec2 low=plane*vec2(.23,.19)-t*vec2(.00232,.00148)+vec2(.09,.21);
      vec2 curl=vec2(texture2D(noiseMap,low*2.1+vec2(.52,.1)).r,
                     texture2D(noiseMap,low*2.35+vec2(.18,.67)).r)-.5;
      vec2 puff=low+curl*.079;
      float body=texture2D(noiseMap,puff).r;
      float lobes=texture2D(noiseMap,puff*2.72+vec2(.29,.61)).r;
      float fringe=texture2D(noiseMap,puff*7.25+vec2(.68,-.13)+t*vec2(.00059,-.00024)).r;
      float mass=.68*body+.23*lobes+.09*fringe;
      float cumulus=smoothstep(.502,.611,mass)*smoothstep(.018,.12,h);
      vec2 high=plane*vec2(.086,.27)-t*vec2(.00087,.00054)+vec2(.24,.52);
      float veil=texture2D(noiseMap,high+curl*.04).r;
      float cirrus=smoothstep(.53,.72,veil)*smoothstep(.012,.12,h);
      return vec2(cumulus,cirrus);
    }`;
  const sky=new T.Mesh(new T.SphereGeometry(340,36,24),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,fog:false,uniforms:{noiseMap:{value:grain},time,daylight,dusk,sunDirection},
    vertexShader:`varying vec3 viewDir;
      void main(){viewDir=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      uniform sampler2D noiseMap;uniform float time,daylight,dusk;uniform vec3 sunDirection;varying vec3 viewDir;
      ${cloudField}
      void main(){
        vec3 d=normalize(viewDir);float h=max(d.y,0.);
        vec3 low=vec3(.135,.090,.145), zen=vec3(.0038,.0085,.034);
        vec3 col=mix(low,vec3(.028,.040,.087),smoothstep(-.03,.155,h));
        col=mix(col,zen,smoothstep(.075,.49,h));
        col+=vec3(.008,.015,.021)*pow(max(dot(d,normalize(vec3(-.45,.19,-1.))),0.),12.);
        vec3 m=normalize(vec3(-.34,.286,-1.));float r=distance(d,m);
        float disc=1.-smoothstep(.008,.00845,r);
        float cut=smoothstep(.0077,.00835,distance(d,normalize(m+vec3(.0035,.0015,0.))));
        float darkness=1.-smoothstep(.015,.33,daylight);
        col+=(vec3(.65,.68,.68)*disc*cut+vec3(.026,.033,.052)*exp(-r*59.))*darkness*(1.-.86*dusk);
        // 光暈的位置依太陽方向移動，天空近地平線處保留較強的大氣散射。
        float sunDot=clamp(dot(d,sunDirection),-1.,1.);
        float solarRadius=length(d-sunDirection);
        vec3 horizon=mix(vec3(.53,.73,.92),vec3(1.10,.44,.18),dusk);
        vec3 blue=mix(vec3(.095,.40,.79),vec3(.22,.29,.53),dusk);
        vec3 sunSky=mix(horizon,blue,smoothstep(-.025,.42,h));
        sunSky=mix(sunSky,vec3(.045,.23,.61),smoothstep(.30,.92,h)*.74);
        vec3 settingGlow=vec3(.35,.095,.022)*dusk*(.38+.62*pow(max(sunDot,0.),4.))
          *exp(-4.2*abs(h-.055));
        col=mix(col,sunSky,daylight)+settingGlow;
        col+=vec3(1.,.72,.42)*exp(-solarRadius*13.)*.22*max(daylight,dusk);
        col+=vec3(6.,4.8,3.1)*(1.-smoothstep(.007,.0095,solarRadius))*max(daylight,dusk);
        vec2 cloud=cloudLayers(d,time);
        float litSide=max(sunDot,0.);
        vec3 feather=mix(vec3(.028,.039,.065),vec3(.74,.86,1.0),daylight);
        col=mix(col,feather,cloud.y*mix(.47,.40,daylight));
        float edge=pow(1.-cloud.x,2.)*(.45+.55*litSide);
        vec3 dayPuff=mix(vec3(.72,.80,.88),vec3(1.32,1.30,1.21),
                         clamp(.18+1.14*h+.22*litSide+edge,0.,1.));
        vec3 nightPuff=mix(vec3(.032,.040,.067),vec3(.068,.081,.111),.42*edge+.23*h);
        vec3 puffHue=mix(nightPuff,dayPuff,daylight);
        puffHue=mix(puffHue,vec3(.48,.28,.29)+vec3(.45,.19,.045)*(edge+litSide*.28),dusk*.76);
        col=mix(col,puffHue,cloud.x*mix(.62,.93,daylight));
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.name='雙層流雲天穹';
  sky.renderOrder=-50; scene.add(sky);
  const pos=[], sizes=[], hues=[];
  for(let i=0;i<5600;i++){
    const h=.015+rand()*.985,a=rand()*Math.PI*2,r=Math.sqrt(1-h*h)*277;
    pos.push(r*Math.cos(a),h*277,r*Math.sin(a));
    sizes.push(.73+Math.pow(rand(),4.5)*2.65);
    hues.push(.52+rand()*.48);
  }
  const sg=new T.BufferGeometry();
  sg.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  sg.setAttribute('size',new T.Float32BufferAttribute(sizes,1));
  sg.setAttribute('hue',new T.Float32BufferAttribute(hues,1));
  const stars=new T.Points(sg,new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{time,daylight,dusk,noiseMap:{value:grain},pixels:{value:1}},
    vertexShader:`attribute float size,hue;uniform sampler2D noiseMap;uniform float time,pixels,daylight,dusk;varying float lum;
      ${cloudField}
      void main(){lum=hue*(.90+.10*sin(position.y*.36+time*1.2))*smoothstep(4.,40.,position.y);
      vec2 cloud=cloudLayers(normalize(position),time);
      lum*=(1.-.84*cloud.x)*(1.-.27*cloud.y);
      lum*=(1.-smoothstep(.015,.30,daylight))*(1.-.95*dusk);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.5,size*pixels);}`,
    fragmentShader:`varying float lum;void main(){float r=length(gl_PointCoord*2.-1.);
      float f=exp(-2.6*r*r)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(vec3(.71,.80,.94),lum*f*.93);}`
  }));
  stars.renderOrder=-45;scene.add(stars);

  // 讓山脊向湖畔伸出支稜與溪谷，離岸愈遠，山體顏色愈接近暮光。
  function hillNoise(x, salt) {
    const n=Math.floor(x), a=x-n, fade=a*a*(3-2*a);
    const hash=k=>{const v=Math.sin(k*127.1+salt*317.7)*43758.5453;return v-Math.floor(v);};
    return T.MathUtils.lerp(hash(n),hash(n+1),fade);
  }
  const ranges=[
    {z:-133,span:27,base:6,scale:13,salt:29,low:0x494d61,high:0x565c70,dayLow:0x7d9daf,dayHigh:0x9cb3bb},
    {z:-100,span:26,base:4,scale:11,salt:21,low:0x304256,high:0x404f63,dayLow:0x577e87,dayHigh:0x82a194},
    {z:-74,span:21,base:2.8,scale:6.9,salt:8,low:0x233444,high:0x304557,dayLow:0x466c66,dayHigh:0x739266}
  ];
  const crestZ=(x,m)=>m.z+(hillNoise(x*.042,m.salt+45)-.5)*10+(hillNoise(x*.11,m.salt+11)-.5)*3;
  function heightAt(x,z,m) {
    const ridge=crestZ(x,m), inward=(z-ridge)/m.span;
    const spurs=(hillNoise(x*.12+inward*.9,m.salt+7)-.5)*.34
      +(hillNoise(x*.38+inward*.4,m.salt+52)-.5)*.07;
    const falloff=Math.max(0,1-Math.abs(inward-spurs*Math.sin(Math.min(Math.abs(inward),1)*2.4)));
    const peaks=hillNoise(x*.023,m.salt)*.68+hillNoise(x*.091,m.salt+2)*.25+hillNoise(x*.26,m.salt)*.07;
    return -1.13+(m.base+m.scale*peaks)*Math.pow(falloff,.9)+.27*falloff*(hillNoise(x*.83+z*.23,m.salt)-.5);
  }
  const forestXYZ=[],forestTint=[];
  function conifer(x,y,z,h,w,color){
    const k=rand()*.4, c=new T.Color(color).multiplyScalar(.7+.30*rand());
    for(let i=0;i<5;i++){
      const a=k+i*1.256637,b=a+1.256637, shade=.89+.11*Math.cos(a);
      forestXYZ.push(x,y+h,z,x+Math.cos(a)*w,y,z+Math.sin(a)*w,x+Math.cos(b)*w,y,z+Math.sin(b)*w);
      for(let v=0;v<3;v++)forestTint.push(c.r*shade,c.g*shade,c.b*shade);
    }
  }
  for(const m of ranges){
    const positions=[], indices=[];
    const cols=300, rows=24;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const x=-186+372*i/cols,z=m.z+(j/rows*2-1)*(m.span+8);
      positions.push(x,heightAt(x,z,m),z);
      if(i<cols&&j<rows){
        const k=j*(cols+1)+i,l=k+cols+1;
        indices.push(k,l,k+1,k+1,l,l+1);
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setIndex(indices);g.computeVertexNormals();
    const terrain=new T.ShaderMaterial({
      uniforms:{low:{value:new T.Color(m.low)},high:{value:new T.Color(m.high)},
        dayLow:{value:new T.Color(m.dayLow)},dayHigh:{value:new T.Color(m.dayHigh)},grain:{value:grain},daylight,dusk,sunDirection},
      vertexShader:`varying vec3 p,norm;void main(){p=position;norm=normal;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 p,norm;uniform vec3 low,high,dayLow,dayHigh,sunDirection;
        uniform float daylight,dusk;uniform sampler2D grain;
        void main(){vec3 n=normalize(norm);
          float facing=dot(n,normalize(vec3(-.64,.29,.59)));
          float g=texture2D(grain,p.xz*.036+vec2(.27,.18)).r;
          float ravine=texture2D(grain,vec2(p.x*.022+p.z*.010,p.z*.060)).r;
          float tone=clamp(.28+facing*.51+(g-.47)*.34+(ravine-.48)*.50,0.,1.);
          float sun=dot(n,sunDirection);
          vec3 day=mix(dayLow,dayHigh,clamp(.24+.65*sun+(g-.47)*.49+(ravine-.48)*.58,0.,1.));
          vec3 col=mix(mix(low,high,tone),day,daylight)+dusk*vec3(.028,.012,.010)*max(sun,0.);
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    scene.add(new T.Mesh(g,terrain));
    if(m===ranges[0])continue;
    for(let i=0;i<1480;i++){
      const x=-129+258*rand(), near=m===ranges[2];
      const z=crestZ(x,m)+(i%3===0?rand()*m.span:rand()*2.5-1);
      const coverage=hillNoise(x*.14+z*.037,m.salt+9);
      if(coverage<.26)continue;
      const h=(near ? .29 : .20)+rand()*(near ? .72 : .57);
      conifer(x,heightAt(x,z,m)-.06,z,h,h*(.21+rand()*.13),m.low);
    }
  }

  // 河岸聚落以山牆、屋頂、不同樓層的實體窗格和少數街燈構成。
  const villageXYZ=[],villageTint=[],villageDay=[],villageLamp=[];
  const masonry=new Map([
    [0x34414b,0xc9b9a0],[0x38434b,0xbbad97],[0x323f49,0xb4acad],[0x36414c,0xc3b099],[0x37434b,0xc5b5a8],
    [0x293642,0x876651],[0x2c3843,0x906b57],[0x2d3945,0x947260],[0x2a3743,0x776758],
    [0x293a40,0x61786c],[0x2b3b41,0x708268],[0x343f46,0x596361]
  ]);
  function appendVillageFace(c,v,window){
    const color=new T.Color(c);
    const day=window?new T.Color(0x5d7882):masonry.has(c)?new T.Color(masonry.get(c))
      :color.clone().multiplyScalar(3.2).addScalar(.071);
    for(const p of v){
      villageXYZ.push(...p);villageTint.push(color.r,color.g,color.b);
      villageDay.push(day.r,day.g,day.b);villageLamp.push(window?1:0);
    }
  }
  function villageFace(c,...v){appendVillageFace(c,v,false);}
  function quad(c,a,b,d,e){villageFace(c,a,b,d,a,d,e);}
  function windowQuad(c,a,b,d,e){appendVillageFace(c,[a,b,d,a,d,e],true);}
  const shoreline=x=>-49+1.27*Math.sin(.056*x+.4)+.7*Math.sin(.118*x);
  for(let x=-105;x<105;x+=2){
    const a=shoreline(x), b=shoreline(x+2);
    quad(0x293a40,[x,-1.05,a+1.3],[x+2,-1.05,b+1.3],[x+2,.05,b],[x,.05,a]);
    quad(0x2b3b41,[x,.05,a],[x+2,.05,b],[x+2,.05,b-13],[x,.05,a-13]);
  }
  const towns=[-75,-63,-45,-31,-19,-5,4,20,35,52,68,79];
  const wallColors=[0x34414b,0x38434b,0x323f49,0x36414c,0x37434b];
  const roofColors=[0x293642,0x2c3843,0x2d3945,0x2a3743];
  const windows=[0xc69b6d,0xedb67d,0xdbb389,0xaf956e,0x768e9d];
  const choose=arr=>arr[Math.floor(rand()*arr.length)];
  function house(x,z,w,d,h,steep){
    const base=.11,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
    const wall=choose(wallColors),side=new T.Color(wall).multiplyScalar(.67),roof=choose(roofColors);
    quad(wall,[x0,base,z1],[x1,base,z1],[x1,h,z1],[x0,h,z1]);
    quad(side,[x0,base,z0],[x0,base,z1],[x0,h,z1],[x0,h,z0]);
    quad(side,[x1,base,z1],[x1,base,z0],[x1,h,z0],[x1,h,z1]);
    const pitch=.32+steep*.40, top=h+w*pitch;
    villageFace(wall,[x0,h,z1],[x1,h,z1],[x,top,z1]);
    quad(roof,[x0-.10,h-.045,z0-.12],[x0-.10,h-.045,z1+.12],[x,top,z1+.12],[x,top,z0-.12]);
    quad(new T.Color(roof).multiplyScalar(.74),[x,top,z0-.12],[x,top,z1+.12],[x1+.10,h-.045,z1+.12],[x1+.10,h-.045,z0-.12]);
    const rows=h>1.5?2:1,cols=w>1.3?3:2;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const wx=x0+w*(col+.53)/cols,wy=.28+row*(h-.20)/rows;
      const color=rand()<.49?choose(windows):0x39434c;
      windowQuad(color,[wx-.062,wy,z1+.009],[wx+.07,wy,z1+.009],[wx+.07,wy+.19,z1+.009],[wx-.062,wy+.19,z1+.009]);
    }
  }
  for(const cx of towns){
    for(let row=0;row<2;row++){
      const start=cx-(row===0?4.2:2.9), num=row===0?5:4;
      for(let i=0;i<num;i++){
        const x=start+i*1.99+rand()*.55;
        if(rand()<.15)continue;
        const z=shoreline(x)-1.25-row*2.32-rand()*.47;
        house(x,z,.84+rand()*.92,.85+rand()*.66,.76+rand()*1.18,rand());
      }
    }
    for(let i=0;i<10;i++){
      const x=cx+(rand()-.5)*13.4, z=shoreline(x)-4.3-rand()*2.2;
      const h=1.15+rand()*1.52;conifer(x,.01,z,h,h*.25,0x293b41);
    }
    for(const offset of [-3.8,2.9]){
      const x=cx+offset,z=shoreline(x)-.23;
      quad(0x343f46,[x-.035,.05,z],[x+.035,.05,z],[x+.035,1.03,z],[x-.035,1.03,z]);
      windowQuad(0xc99e70,[x-.075,1.03,z],[x+.075,1.03,z],[x+.054,1.17,z],[x-.054,1.17,z]);
    }
  }
  const bx=-4.2,bz=shoreline(bx)-4.7,by=3.63;
  house(bx,bz,1.08,1.14,by,.12);
  for(let i=0;i<4;i++){
    const a=Math.PI*.25+i*Math.PI*.5,b=a+Math.PI*.5;
    villageFace(i%3?0x2e3c49:0x35424c,[bx,by+2.0,bz],
      [bx+.83*Math.cos(a),by-.05,bz+.83*Math.sin(a)],[bx+.83*Math.cos(b),by-.05,bz+.83*Math.sin(b)]);
  }
  // 在同一筆幾何中標記窗格，日間只保留玻璃色，黃昏才逐步出現暖光。
  const distantMaterial=new T.ShaderMaterial({
    side:T.DoubleSide,uniforms:{daylight,lamps},
    vertexShader:`attribute vec3 nightColor,dayColor;attribute float isLamp;uniform float daylight,lamps;
      varying vec3 hue;
      void main(){
        hue=mix(nightColor,dayColor,daylight);
        if(isLamp>.5)hue=mix(dayColor*(.23+.77*daylight),nightColor,lamps);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`varying vec3 hue;void main(){
      gl_FragColor=vec4(hue,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  const forestDay=[];
  for(let i=0;i<forestTint.length;i+=3){
    forestDay.push(.035+forestTint[i]*1.6,.083+forestTint[i+1]*2.0,.050+forestTint[i+2]*1.1);
  }
  for(const [p,c,d,l] of [[villageXYZ,villageTint,villageDay,villageLamp],
    [forestXYZ,forestTint,forestDay,new Float32Array(forestXYZ.length/3)]]){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
    g.setAttribute('nightColor',new T.Float32BufferAttribute(c,3));
    g.setAttribute('dayColor',new T.Float32BufferAttribute(d,3));g.setAttribute('isLamp',new T.Float32BufferAttribute(l,1));
    scene.add(new T.Mesh(g,distantMaterial));
  }

  const base=Reflector.ReflectorShader;
  const water=new Reflector(new T.PlaneGeometry(230,190),{
    textureWidth:512,textureHeight:512,multisample:0,clipBias:.0012,color:0x456267,
    shader:{
      name:'漣漪倒影',
      uniforms:{...base.uniforms,noiseMap:{value:grain},time:{value:0},daylight,dusk,sunDirection},
      vertexShader:`uniform mat4 textureMatrix;varying vec4 refl;varying vec3 world;
        void main(){world=(modelMatrix*vec4(position,1.)).xyz;refl=textureMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform sampler2D tDiffuse,noiseMap;uniform float time,daylight,dusk;uniform vec3 sunDirection;
        varying vec3 world;varying vec4 refl;
        void main(){
          vec2 p=world.xz;
          float noise=texture2D(noiseMap,p*vec2(.026,.047)+vec2(.005*time,-.007*time)).r;
          float w1=sin(p.y*5.2+noise*14.+time*1.7+p.x*.67);
          float w2=sin(p.y*9.3+p.x*.8+noise*6.-time*1.9);
          vec2 dis=vec2((w1*.45+w2*.55)*.0038,(w1*.82+w2*.28)*.0075);
          vec2 uv=refl.xy/refl.w+dis;
          vec3 image=texture2D(tDiffuse,uv).rgb*.65+texture2D(tDiffuse,uv+vec2(.0018,.0015)).rgb*.35;
          float fresnel=pow(1.-abs(normalize(cameraPosition-world).y),2.);
          vec3 color=vec3(.008,.022,.030)+image*(.43+.31*fresnel)*vec3(.83,.91,1.);
          color+=vec3(.008,.016,.019)*smoothstep(.20,1.10,w1*.49+w2*.58)*(.35+.65*noise);
          vec3 dayWater=vec3(.025,.15,.19)*(.75+.36*noise)+image*(.36+.45*fresnel)*vec3(.82,.92,.96);
          vec3 waveNormal=normalize(vec3(-.055*w1,1.,.105*w2+.032*w1));
          vec3 halfVector=normalize(sunDirection+normalize(cameraPosition-world));
          float glitter=pow(max(0.,dot(waveNormal,halfVector)),255.)*smoothstep(-.015,.11,sunDirection.y);
          color=mix(color,dayWater,daylight)+vec3(1.,.78,.49)*glitter*max(daylight,dusk)*.76;
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    }
  });
  water.material.uniforms.noiseMap.value=grain;
  Object.assign(water.material.uniforms,{daylight,dusk,sunDirection});
  water.rotation.x=-Math.PI/2;water.position.set(0,-1,11);
  scene.add(water);
  const reflect=water.onBeforeRender;
  let reflectedAt=-1;
  water.onBeforeRender=function(...args){
    if(time.value-reflectedAt<1/20)return;
    reflectedAt=time.value;reflect.apply(this,args);
  };
  return t=>{
    time.value=t; water.material.uniforms.time.value=t;
    if(dayCycle){
      daylight.value=dayCycle.daylight;dusk.value=dayCycle.dusk;lamps.value=dayCycle.lamps;
      sunDirection.value.copy(dayCycle.sunDirection);
    }
    stars.visible=daylight.value<.30;
    stars.material.uniforms.pixels.value=renderer.domElement.height/930;
  };
}
