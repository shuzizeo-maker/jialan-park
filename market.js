// 每座攤位各有一位攤主和交替光顧的兩位顧客。商品從檯面、攤主掌心一路跟到買主手上。
export function buildMarket({THREE:T,scene,makeProductModel},stalls) {
  const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), up=v(0,1,0);
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const mix=(a,b,x)=>a+(b-a)*x;
  const mod=(x,n)=>((x%n)+n)%n;
  const step=(a,b,t)=>smooth((t-a)/(b-a));
  const period=12.6;
  const cube=new T.BoxGeometry(1,1,1), ball=new T.SphereGeometry(1,10,7);
  const tube=new T.CylinderGeometry(1,1,1,9),shirt=new T.CylinderGeometry(.91,1,1,10);
  const token=new T.CylinderGeometry(1,1,1,14);
  const cloth=new T.MeshStandardMaterial({roughness:.76,metalness:.06});
  const goodsMaterial=new T.MeshStandardMaterial({roughness:.49,metalness:.12,vertexColors:true,side:T.DoubleSide});
  const baskets=new Map(), trades=[], matrix=new T.Matrix4(),identity=new T.Quaternion();
  const turn=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  const ivory=0xffe2b7,skin=[0xd7a484,0xaf795d,0xdfb393,0xbc8968];
  const jackets=[0xaf554b,0x467b86,0xd4a55e,0xa97887,0x6f8692,0x9b7955,0x557b68];
  const aprons=[0xc96050,0x407d80,0xa16e96,0x658b82,0xd06a57,0x806b96,0x778d59];
  const trousers=0x434b56;
  function node(parent,name){
    const g=new T.Group();parent.add(g);if(name)g.name=name;return g;
  }
  function part(g,anchor,p,size,c,q=identity){
    if(!baskets.has(g))baskets.set(g,[]);
    baskets.get(g).push({anchor,local:new T.Matrix4().compose(p,q,size),color:new T.Color(c)});
  }
  function shapedLimb(anchor,r,color){
    part(tube,anchor,v(),v(r,1,r),color);
  }
  function person(parent,name,id,seller,kind,idx){
    const root=node(parent,name),torso=node(root),legs=[],knees=[],arms=[];
    const size=seller?1.06:(id%2?.99:1.015), c=seller?ivory:jackets[id%7],tone=skin[id%4];
    root.scale.setScalar(size);
    part(shirt,torso,v(0,.96,0),v(.190,.47,.145),c);
    part(ball,torso,v(0,1.376,.016),v(.148,.165,.135),tone);
    part(ball,torso,v(0,1.465,-.013),v(.15,.091,.136),id%2?0x744e3c:0x423637);
    for(const side of [-1,1]){
      part(ball,torso,v(side*.051,1.387,.141),v(.012,.014,.006),0x503d33);
    }
    if(seller){
      part(cube,torso,v(0,.978,.133),v(.276,.345,.045),aprons[idx]);
      part(cube,torso,v(0,.742,.105),v(.323,.167,.086),aprons[idx]);
      part(cube,torso,v(0,.884,.16),v(.104,.070,.012),ivory);
      for(const side of [-1,1])part(cube,torso,v(side*.085,1.159,.095),v(.028,.105,.029),aprons[idx],turn(-.42,0,0));
      part(tube,torso,v(0,1.494,0),v(.153,.056,.140),ivory);
      part(ball,torso,v(-.014,1.564,-.005),v(.161,.079,.157),ivory);
      part(cube,torso,v(0,1.484,.128),v(.224,.026,.087),aprons[idx]);
    }else{
      const tote=node(torso);
      // 布袋掛在身側，交易後購買的小物可以收進袋口。
      part(cube,tote,v(-.242,.76,.042),v(.174,.297,.213),id%2?0xcda476:0xdabb8d,turn(0,0,-.095));
      part(cube,tote,v(-.245,.912,.043),v(.160,.025,.201),0x766850);
      part(cube,tote,v(-.184,.995,.078),v(.018,.264,.023),0x9c7653,turn(0,0,-.37));
      if(id%3===1){
        part(tube,torso,v(0,1.497,0),v(.18,.028,.173),0xe7c693);
        part(ball,torso,v(0,1.537,-.012),v(.132,.076,.131),0xe7c693);
      }
    }
    for(const s of [-1,1]){
      const thigh=node(root),knee=node(thigh);thigh.position.set(.089*s,.727,0);knee.position.y=-.333;
      part(tube,thigh,v(0,-.160,0),v(.064,.335,.068),trousers);
      part(tube,knee,v(0,-.153,.013),v(.054,.32,.056),0x4b545c);
      part(ball,knee,v(0,-.327,.040),v(.068,.055,.105),0x513b32);legs.push(thigh);knees.push(knee);
      const upper=node(torso),lower=node(torso);
      const grip=node(torso,s===-1?(seller?'遞貨手-'+kind:'付款手-'+kind+'-'+idx):(seller?'收款手-'+kind:'接貨手-'+kind+'-'+idx));
      shapedLimb(upper,.058,c);shapedLimb(lower,.043,tone);
      part(ball,grip,v(),v(.053,.061,.049),tone);
      arms.push({shoulder:v(.169*s,1.15,.016),upper,lower,grip,s});
    }
    return {root,torso,legs,knees,arms,size};
  }
  const toStall=(person,p)=>p.multiplyScalar(person.size).applyQuaternion(person.root.quaternion).add(person.root.position);
  const vectorA=v(),vectorB=v(),vectorC=v(),vectorD=v(),inverse=new T.Quaternion();
  function segment(bone,a,b){
    const delta=vectorD.subVectors(b,a),len=delta.length();
    bone.position.copy(a).lerp(b,.5);bone.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/Math.max(.00001,len)));bone.scale.y=len;
  }
  function armTo(actor,armIndex,goal){
    const arm=actor.arms[armIndex], shoulder=arm.shoulder;
    const end=vectorA.copy(goal).sub(actor.root.position).applyQuaternion(inverse.copy(actor.root.quaternion).invert()).divideScalar(actor.size);
    arm.grip.position.copy(end);
    const reach=vectorB.subVectors(end,shoulder),len=reach.length();reach.normalize();
    const bend=vectorC.set(arm.s*.34,-1,-.26);
    bend.addScaledVector(reach,-reach.dot(bend)).normalize();
    const joint=vectorC.multiplyScalar(Math.sqrt(Math.max(0,.315*.315-len*len*.25))).addScaledVector(reach,len*.5).add(shoulder);
    segment(arm.upper,shoulder,joint);segment(arm.lower,joint,end);
  }
  function gait(actor,stride){
    actor.torso.rotation.z=0;
    for(let i=0;i<2;i++){const k=(i?1:-1)*stride;
      actor.legs[i].rotation.x=-k*.42;actor.knees[i].rotation.x=Math.max(0,k)*.47;
    }
  }
  function route(coords){
    const curve=new T.CatmullRomCurve3(coords.map(([x,z])=>v(x,0,z)),false,'centripetal');
    curve.arcLengthDivisions=58;curve.updateArcLengths();return curve;
  }
  function follow(actor,path,f,faceStart,faceEnd,t,id){
    const u=clamp(f),q=smooth(u);
    path.getPointAt(q,actor.root.position);path.getTangentAt(q,vectorA);
    let yaw=Math.atan2(vectorA.x,vectorA.z);
    function shortest(a,b,u){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*u;}
    yaw=shortest(faceStart,yaw,step(0,.18,u));yaw=shortest(yaw,faceEnd,step(.78,1,u));
    actor.root.rotation.y=yaw;
    const stride=Math.sin(t*7.3+id)*Math.min(step(0,.20,u),1-step(.80,1,u));
    actor.root.position.y+=Math.abs(stride)*.026;gait(actor,stride);return stride;
  }
  for(const [k,def] of stalls.entries()){
    const [x,z,angle,w,d,kind]=def,front=d*.5;
    const group=node(scene,'攤位交易-'+kind);group.position.set(x,0,z);group.rotation.y=angle;
    const vendor=person(group,'攤主-'+kind,k,true,kind,k);
    const counterX=kind==='candy'?.24:kind==='cake'?-.25:0;
    const side=['cake','balloons','gelato','lanterns'].includes(kind)?-1:1;
    const counter=v(counterX,0,front+.40);
    const till=v(counterX+.205,1.32,front+.04), handoff=v(counterX-.10,1.35,front+.065);
    const stock=v(-.43,1.32,front-.16);
    const register=v(.46,1.28,front-.28), vendorStand=v(counterX,.113,front-.69);
    const customers=[],products=[];
    const merchandise=new T.InstancedMesh(makeProductModel(T,kind),goodsMaterial,2);
    merchandise.name='販售商品模型-'+kind;merchandise.frustumCulled=false;merchandise.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(merchandise);
    for(let i=0;i<2;i++){
      const personId=k*3+i+1,actor=person(group,'顧客-'+kind+'-'+i,personId,false,kind,i);
      const wait=[counterX+side*(.92+i*.09),front+.37+i*.06];
      const turnX=side*(w*.5+.57),away=[turnX,front-.27-i*.25];
      const near=[counter.x, counter.z];
      const approach=route([wait,[counterX+side*.48,front+.44],near]);
      const leave=route([near,[counterX+side*.69,front+1.03],[side*(w*.50+.43),front+1.00],away]);
      const waiting=route([away,[turnX+side*.11,front+.38],[side*(w*.5+.06),front+.59],wait]);
      customers.push({actor,approach,leave,waiting,wait,away,id:personId});
      const item=node(group,'商品-'+kind+'-'+i);products.push(item);
    }
    const ticket=node(group,'付款牌-'+kind);
    part(cube,ticket,v(),v(.140,.022,.098),0xf7cf79,turn(.1,-.15,.19));
    part(token,ticket,v(.020,.021,0),v(.032,.013,.032),0xbe7653);
    const offset=[0,4.87,8.14,1.96,5.52,9.48,6.83][k];
    trades.push({group,vendor,customers,products,merchandise,ticket,front,counter,side,till,handoff,stock,register,vendorStand,kind,offset});
  }
  const batches=[];
  for(const [g,items] of baskets){
    const mesh=new T.InstancedMesh(g,cloth,items.length);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;
    items.forEach((item,i)=>mesh.setColorAt(i,item.color));scene.add(mesh);batches.push({mesh,items});
  }
  const hand=v(),free=v(),rightGoal=v(),leftGoal=v(),tray=v(),grip=v();
  function vendorPose(trade,age){
    const {vendor,till,register,stock,handoff,front,counter,vendorStand}=trade;
    vendor.root.position.copy(vendorStand);
    const lean=step(2.45,3.55,age)*(1-step(4.65,5,age))+.92*step(5.05,6.48,age)*(1-step(7.65,8.45,age));
    vendor.root.position.z+=lean*.083;vendor.root.rotation.y=0;gait(vendor,0);
    const homeL=leftGoal.set(counter.x-.23,1.22,front-.42),homeR=rightGoal.set(counter.x+.27,1.22,front-.43);
    if(age>=4.67 && age<7.58){
      if(age<5.45)homeL.lerp(stock,step(4.67,5.45,age));
      else if(age<6.2)homeL.copy(stock).y+=.17*step(5.45,6.20,age);
      else{tray.copy(stock);tray.y+=.17;homeL.lerpVectors(tray,handoff,step(6.20,7.55,age));}
    }else if(age>=7.58 && age<8.46){homeL.lerp(handoff,1-step(7.58,8.46,age));}
    if(age>=2.45 && age<3.72)homeR.lerp(till,step(2.45,3.62,age));
    else if(age>=3.72 && age<4.65)homeR.lerpVectors(till,register,step(3.77,4.62,age));
    else if(age>=4.65 && age<5.1)homeR.lerp(register,1-step(4.65,5.10,age));
    armTo(vendor,0,homeL);armTo(vendor,1,homeR);
  }
  function update(t){
    for(const trade of trades){
      const {group,vendor,customers,stock,handoff,till,products,ticket,kind,merchandise}=trade;
      const clock=t+trade.offset,active=mod(Math.floor(clock/period),2),age=mod(clock,period);
      group.userData.customer=active;
      group.userData.phase=age<2.45?'走向櫃台':age<4.67?'付款':age<6.2?'取貨':age<8.35?'交貨':age<11.3?'持商品離開':'攤主備貨';
      vendorPose(trade,age);
      for(let i=0;i<2;i++){
        const {actor,approach,leave,waiting,wait,away,id}=customers[i],item=products[i];
        const personal=mod(clock-i*period,2*period),still=Math.PI,awayFace=trade.side*Math.PI*.48;
        let stride=0;
        if(personal<2.45)stride=follow(actor,approach,personal/2.45,still,still,t,id);
        else if(personal<8.35){actor.root.position.copy(trade.counter);actor.root.rotation.y=still;gait(actor,0);}
        else if(personal<13.90)stride=follow(actor,leave,(personal-8.35)/5.55,still,awayFace,t,id);
        else if(personal<19.1){actor.root.position.set(away[0],0,away[1]);actor.root.rotation.y=awayFace;gait(actor,0);}
        else if(personal<23.90)stride=follow(actor,waiting,(personal-19.1)/4.80,awayFace,still,t,id);
        else{actor.root.position.set(wait[0],0,wait[1]);actor.root.rotation.y=still;gait(actor,0);}
        toStall(actor,free.set(-.205,.868,.13+stride*.126));
        toStall(actor,hand.set(.218,.886,.13-stride*.12));
        if(personal>=2.45 && personal<4.60){
          const f=step(2.45,3.62,personal)*(1-step(3.78,4.60,personal));free.lerp(till,f);
        }
        if(personal>=6.2 && personal<8.35){
          const carry=grip.set(.22,1.05,.28);toStall(actor,carry);
          if(personal<7.58)hand.lerp(handoff,step(6.2,7.55,personal));
          else hand.lerpVectors(handoff,carry,step(7.63,8.35,personal));
        }else if(personal>=8.35 && personal<17.9){
          const take=step(15.3,16.25,personal)*(1-step(16.7,17.88,personal));
          hand.set(mix(.22,-.23,take),mix(1.05,.94,take),mix(.28,.055,take));
          toStall(actor,hand);
        }
        armTo(actor,0,free);armTo(actor,1,hand);actor.root.userData.phase=i===active?group.userData.phase:'候場';
        item.scale.setScalar(1);
        if(personal<5.45){item.position.copy(stock);item.userData.owner='攤位';}
        else if(personal<7.58){
          toStall(vendor,item.position.copy(vendor.arms[0].grip.position));item.userData.owner='攤主';
        }else if(personal<16.65){
          item.position.copy(hand);item.userData.owner='顧客';
        }else if(personal<17.8){
          item.position.copy(hand);
          const tuck=step(16.65,17.8,personal);item.position.y-=.14*tuck;item.scale.setScalar(1-tuck);
          item.userData.owner='收起';
        }else if(personal<2*period-1.30){item.position.copy(stock);item.scale.setScalar(0);item.userData.owner='收起';}
        else{
          item.position.copy(stock);item.scale.setScalar(step(2*period-1.30,2*period-.58,personal));item.userData.owner='攤位';
        }
        if(i===active){
          if(age>=2.45 && age<3.72)ticket.position.copy(free);
          else if(age>=3.72 && age<4.65)toStall(vendor,ticket.position.copy(vendor.arms[1].grip.position));
          const tokenSize=step(2.45,2.77,age)*(1-step(4.53,4.67,age));
          ticket.scale.setScalar(tokenSize);ticket.userData.owner=age<3.72?'顧客':'攤主';
        }
      }
      group.updateMatrixWorld(true);
      products.forEach((item,i)=>merchandise.setMatrixAt(i,item.matrixWorld));merchandise.instanceMatrix.needsUpdate=true;
    }
    for(const {mesh,items} of batches){
      for(let i=0;i<items.length;i++){const obj=items[i];mesh.setMatrixAt(i,matrix.multiplyMatrices(obj.anchor.matrixWorld,obj.local));}
      mesh.instanceMatrix.needsUpdate=true;
    }
  }
  update(0);
  return update;
}
