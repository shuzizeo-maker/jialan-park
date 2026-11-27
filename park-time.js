// 以臺北為園區位置，依 NOAA 分數年近似式計算太陽位置。場景座標的 +X 朝東、−Z 朝北。
const radians = Math.PI / 180;
const latitude = 25.033 * radians;
const longitude = 121.5654;
const localOffset = 8 * 3600 * 1000;
const dayLength = 86400000;
const formatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit'
});

export function parkClock(date) {
  return formatter.format(date);
}

export function parkNoon(date) {
  const startOfLocalDay = Math.floor((date.getTime()+localOffset)/dayLength)*dayLength;
  return new Date(startOfLocalDay-localOffset+dayLength/2);
}

// 預覽採用同一個臺灣日期。夜景取當晚九點，畫面時鐘繼續使用實際日期與時間。
export function parkPreviewTime(date, mode) {
  if (mode === 'day') return parkNoon(date);
  if (mode === 'night') return new Date(parkNoon(date).getTime() + 9 * 3600000);
  return date;
}

function smooth(start, end, value) {
  const f = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return f * f * (3 - 2 * f);
}

export function getSunlight(date) {
  const local = new Date(date.getTime() + localOffset);
  const year = local.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - start) / dayLength;
  const day = Math.floor((local.getTime() - start) / dayLength);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
  const g = 2 * Math.PI / days * (day + (hour - 12) / 24);
  const equation = 229.18 * (.000075 + .001868*Math.cos(g) - .032077*Math.sin(g)
    - .014615*Math.cos(2*g) - .040849*Math.sin(2*g));
  const dec = .006918 - .399912*Math.cos(g) + .070257*Math.sin(g) - .006758*Math.cos(2*g)
    + .000907*Math.sin(2*g) - .002697*Math.cos(3*g) + .00148*Math.sin(3*g);
  const angle = (hour*15 + equation/4 + longitude - 120 - 180) * radians;
  const east = -Math.cos(dec)*Math.sin(angle);
  const up = Math.sin(latitude)*Math.sin(dec) + Math.cos(latitude)*Math.cos(dec)*Math.cos(angle);
  const north = Math.cos(latitude)*Math.sin(dec) - Math.sin(latitude)*Math.cos(dec)*Math.cos(angle);
  const elevation = Math.asin(Math.min(1, Math.max(-1, up))) / radians;
  return {
    east, up, north, elevation,
    daylight: smooth(-8.5, 11, elevation),
    dusk: smooth(-8.5, -1.5, elevation) * (1 - smooth(1, 11, elevation)),
    // 日落後開始亮燈，到民用暮光結束時全亮；清晨依相同高度逐步熄燈。
    lamps: 1 - smooth(-6, -.833, elevation)
  };
}
