import { CircleGeometry, Mesh, MeshStandardMaterial, RingGeometry, MeshBasicMaterial } from 'three';

/** 作者水位平面：不透明深度遮挡水下腿部；轻微水纹使用同一预览时钟，没有浮力模拟。 */
export function createPreviewWater() {
  const material = new MeshStandardMaterial({ color: '#648e92', roughness: .72, metalness: 0 });
  const time = { value: 0 };
  material.onBeforeCompile = shader => {
    shader.uniforms.uPreviewWaterTime = time;
    shader.vertexShader = 'varying vec2 vPreviewWater;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvPreviewWater = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = 'uniform float uPreviewWaterTime;\nvarying vec2 vPreviewWater;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat wave = sin(vPreviewWater.x*8.0 + uPreviewWaterTime*0.25)*sin(vPreviewWater.y*6.0-uPreviewWaterTime*0.25);\ndiffuseColor.rgb *= 1.0 + wave*0.035;');
  };
  const geometry = new CircleGeometry(1, 64), mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; mesh.visible = false;
  // 仅单只近景显示一圈轻量接触水纹，不为500只分别建材质或生成粒子。
  const rippleGeometry = new RingGeometry(.19, .194, 32), rippleMaterial = new MeshBasicMaterial({ color: '#c5d9cd', transparent: true, opacity: .28, depthWrite: false });
  const ripple = new Mesh(rippleGeometry, rippleMaterial); ripple.rotation.x = -Math.PI / 2; ripple.visible = false;
  let disposed = false;
  return {
    mesh, ripple,
    update(active: boolean, y: number, radius: number, clockTime: number, single: boolean) {
      mesh.visible = active; mesh.position.y = y; mesh.scale.setScalar(radius); time.value = Math.sin(clockTime*Math.PI/3);
      ripple.visible = active && single; ripple.position.set(0, y+.001, -.025);
      const stretch = 1 + .025*Math.sin(clockTime*Math.PI*2/3); ripple.scale.set(.85*stretch, 1.4*stretch, 1);
    },
    dispose() { if (disposed) return; disposed = true; mesh.removeFromParent(); ripple.removeFromParent(); geometry.dispose(); material.dispose(); rippleGeometry.dispose(); rippleMaterial.dispose(); },
  };
}
