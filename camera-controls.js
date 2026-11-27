import { Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createParkCamera(camera, canvas) {
  // 首幀固定面向整座園區（主街盡頭是城堡），後續視角由滑鼠、觸控或園區導覽列控制。
  camera.position.set(-2.5, 30, 82);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(1, 7.5, -6);
  controls.autoRotate = false;
  controls.enableDamping = false;
  controls.minDistance = 4;
  controls.maxDistance = 135;
  controls.minPolarAngle = .065;
  controls.maxPolarAngle = Math.PI/2-.025;
  controls.panSpeed = .8;
  controls.rotateSpeed = .7;
  controls.zoomSpeed = .92;
  controls.update();

  const minimum = new Vector3(-43, 1.1, -33), maximum = new Vector3(43, 40, 36);
  const adjusted = new Vector3();
  controls.addEventListener('change', () => {
    // 平移到園界時，讓相機和觀景中心一起停止，保留當下視線方向。
    adjusted.copy(controls.target).clamp(minimum,maximum).sub(controls.target);
    controls.target.add(adjusted);
    camera.position.add(adjusted);
  });
  controls.addEventListener('start', () => { canvas.style.cursor='grabbing'; });
  controls.addEventListener('end', () => { canvas.style.cursor='grab'; });
  return controls;
}
