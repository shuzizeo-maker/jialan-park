// 嘉蘭遊樂場：五大主題園區與 11 座遊樂設施的「設定表」。
// 想調整設施名稱、位置、點擊範圍或相機視角，只要改這個檔案即可。
// 座標單位與 three.js 場景相同：x 向右、z 向前（湖邊入口約在 z=18）、y 向上。

export const LANDS = [
  // view：按下導覽列時相機的位置 pos 與注視點 target
  { id:'chinese', name:'文字森林', subject:'國語', icon:'📚', color:'#3f9b5a', desc:'成語、部首、閱讀理解', view:{ pos:[6,36,30],  target:[-17,4,-6] } },
  { id:'math',    name:'數字星球', subject:'數學', icon:'🪐', color:'#7b5cd6', desc:'速算、分數與小數',     view:{ pos:[8,30,28],  target:[25,6,-10] } },
  { id:'english', name:'ABC 港灣', subject:'英語', icon:'⚓', color:'#2b8fd6', desc:'單字配對、英語聽力',   view:{ pos:[17,22,40], target:[26,4,10] } },
  { id:'science', name:'探險叢林', subject:'自然', icon:'🌿', color:'#d9822b', desc:'動植物、天氣與天文',   view:{ pos:[-12,26,24], target:[-35,3,-2] } },
  { id:'social',  name:'世界城堡', subject:'社會', icon:'🏰', color:'#d6476b', desc:'臺灣地理歷史、世界地理', view:{ pos:[2,24,8],   target:[2,7,-25] } },
];

// hit：點擊判定用的隱形外框（box 為 [寬, 高, 深]，cyl 為 [半徑, 高]），中心點在 pos 上方 hit 高度的一半。
// label：設施名牌顯示的高度。view：相機飛過去時的距離；dir：相機從哪個水平方向看（[x, z]）；elev：俯角高度比例。
export const RIDES = [
  // —— 國語「文字森林」——
  { id:'carousel', land:'chinese', name:'旋轉木馬', topic:'成語配對', icon:'🎠', pos:[-11,0,10],   hit:{cyl:[5.6,7]},       label:7.6,  view:15, dir:[.2,1] },
  { id:'books',    land:'chinese', name:'飛天書本', topic:'部首與拼字', icon:'📖', pos:[-26,0,-25], hit:{cyl:[5.2,7]},       label:8.2,  view:16, dir:[-1,.3] },
  { id:'wheel',    land:'chinese', name:'摩天輪',   topic:'閱讀理解', icon:'🎡', pos:[-13,0,-9],   hit:{box:[25,25,5]},     label:25.5, view:30, dir:[0,1] },
  // —— 數學「數字星球」——
  { id:'coaster',  land:'math',    name:'雲霄飛車', topic:'速算挑戰', icon:'🎢', pos:[16,0,-5],    hit:{box:[28,13,15]},    label:14,   view:30, dir:[.3,1] },
  { id:'drop',     land:'math',    name:'分數落塔', topic:'分數與小數', icon:'🗼', pos:[36,0,-16],  hit:{cyl:[3.2,25]},      label:25.2, view:30, dir:[-.4,1], elev:.75 },
  // —— 英語「ABC 港灣」——
  { id:'pirate',   land:'english', name:'海盜船',   topic:'單字配對', icon:'🏴‍☠️', pos:[13,0,15], hit:{box:[13,10,6]},     label:11,   view:18, dir:[0,1] },
  { id:'swinger',  land:'english', name:'聽力飛椅', topic:'英語聽力', icon:'🎧', pos:[38,0,7],     hit:{cyl:[6,10]},        label:11.2, view:18, dir:[-.3,1] },
  // —— 自然「探險叢林」——
  { id:'teacups',  land:'science', name:'叢林咖啡杯', topic:'動物與植物', icon:'☕', pos:[-36,0,8], hit:{cyl:[6.4,4]},       label:5.2,  view:15, dir:[.4,1] },
  { id:'rocket',   land:'science', name:'太空艙',   topic:'天氣與天文', icon:'🚀', pos:[-36,0,-12], hit:{cyl:[5.5,11]},      label:11.8, view:18, dir:[.3,1] },
  // —— 社會「世界城堡」——
  { id:'castle',   land:'social',  name:'嘉蘭城堡', topic:'臺灣地理歷史', icon:'🏰', pos:[0,0,-26.5], hit:{box:[13,20,7]},   label:21,   view:30, dir:[.3,1] },
  { id:'train',    land:'social',  name:'環球小火車', topic:'世界地理', icon:'🚂', pos:[13.5,0,-24], hit:{box:[6,4,8]},     label:4.6,  view:16, dir:[-.6,1], elev:.8 },
];

// 小火車軌道（繞著城堡的橢圓），new-rides.js 與點擊判定共用。
export const TRAIN_TRACK = { cx:0, cz:-26.5, rx:15, rz:6.6 };

export const landById = Object.fromEntries(LANDS.map(l => [l.id, l]));
export const rideById = Object.fromEntries(RIDES.map(r => [r.id, r]));
