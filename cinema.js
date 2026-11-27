// 在四分之一解析度擴散高亮像素，保留燈芯、煙火細線和欄杆的銳利輪廓。
export function makeCinema(T,renderer) {
  const frame=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:2});
  const bright=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false});
  const horizontal=bright.clone(),soft=bright.clone();
  const postScene=new T.Scene();
  const cam=new T.Camera();
  const tri=new T.BufferGeometry();
  tri.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const vertexShader=`varying vec2 uvScreen;
    void main(){uvScreen=.5+.5*position.xy;gl_Position=vec4(position,1.);}`;
  function material(fragmentShader,uniforms){
    return new T.ShaderMaterial({vertexShader,fragmentShader,uniforms,depthTest:false,depthWrite:false});
  }
  const downsample=material(`uniform sampler2D source;uniform vec2 pixel;varying vec2 uvScreen;
    vec3 highlight(vec2 offset){
      vec3 c=texture2D(source,uvScreen+offset*pixel).rgb;
      float top=max(c.r,max(c.g,c.b));
      return c*clamp((top-.50)/max(.001,top),0.,1.);
    }
    void main(){
      gl_FragColor=vec4(.25*(highlight(vec2(-1.,-1.))+highlight(vec2(1.,-1.))+
        highlight(vec2(-1.,1.))+highlight(vec2(1.,1.))),1.);
    }`,{source:{value:frame.texture},pixel:{value:new T.Vector2()}});
  const bloom=material(`uniform sampler2D source;uniform vec2 stepUV;varying vec2 uvScreen;
    vec3 readLight(vec2 uv){
      return texture2D(source,uv).rgb;
    }
    void main(){
      vec3 c=readLight(uvScreen)*.227027;
      c+=.316216*(readLight(uvScreen+stepUV*1.384615)+readLight(uvScreen-stepUV*1.384615));
      c+=.070270*(readLight(uvScreen+stepUV*3.230769)+readLight(uvScreen-stepUV*3.230769));
      gl_FragColor=vec4(c,1.);
    }`,{source:{value:null},stepUV:{value:new T.Vector2()}});
  const finish=material(`uniform sampler2D source,blurred;uniform float glow;varying vec2 uvScreen;
    void main(){
      vec3 c=texture2D(source,uvScreen).rgb;
      vec3 halo=texture2D(blurred,uvScreen).rgb;
      vec2 p=uvScreen*2.-1.;
      float corner=1.-.092*dot(p,p);
      gl_FragColor=vec4((c+halo*glow)*corner,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`, {source:{value:frame.texture},blurred:{value:soft.texture},glow:{value:.74}});
  const screen=new T.Mesh(tri,bloom);
  screen.frustumCulled=false;postScene.add(screen);
  return {
    resize(w,h){
      frame.setSize(w,h);bright.setSize(Math.ceil(w/4),Math.ceil(h/4));
      horizontal.setSize(bright.width,bright.height);soft.setSize(bright.width,bright.height);
      downsample.uniforms.pixel.value.set(1/w,1/h);
    },
    draw(scene,camera,daylight){
      finish.uniforms.glow.value=.74-.58*daylight;
      renderer.setRenderTarget(frame);renderer.render(scene,camera);
      screen.material=downsample;
      renderer.setRenderTarget(bright);renderer.render(postScene,cam);
      screen.material=bloom;const u=bloom.uniforms;
      u.source.value=bright.texture;u.stepUV.value.set(1/bright.width,0);
      renderer.setRenderTarget(horizontal);renderer.render(postScene,cam);
      u.source.value=horizontal.texture;u.stepUV.value.set(0,1/bright.height);
      renderer.setRenderTarget(soft);renderer.render(postScene,cam);
      screen.material=finish;
      renderer.setRenderTarget(null);renderer.render(postScene,cam);
    }
  };
}
