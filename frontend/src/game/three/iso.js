// ---- Isometric camera lock: three.js orthographic camera that reproduces worldPx() exactly ----
// The 2D renderer projects tile (x, y, h) to screen px as
//     sx = (x - y) * TILE_W/2,  sy = (x + y) * TILE_H/2 - h * H_STEP        (then * zoom + cam)
// A 2:1 dimetric view is an orthographic camera with yaw 45deg and pitch 30deg (sin(30deg) = 0.5).
// World mapping: X = tile x, Z = tile y, Y = h * H_UNIT.  One tile = one world unit.
import * as THREE from 'three';
import { TILE_W, TILE_H, H_STEP } from '../constants';

export const PITCH = Math.PI / 6;                       // 30deg
export const S_PX = (TILE_W / 2) * Math.SQRT2;          // screen px per world unit at zoom 1 (45.25)
export const H_UNIT = H_STEP / (Math.cos(PITCH) * S_PX); // world units per height step (~0.2552)
export const CAM_DIST = 160;                             // camera stand-off along the view axis
const COS_P = Math.cos(PITCH), SIN_P = Math.sin(PITCH);
// unit vector from the look-at target towards the camera
export const VIEW_DIR = new THREE.Vector3(COS_P / Math.SQRT2, SIN_P, COS_P / Math.SQRT2);
// direction light travels *towards* the viewer (for fresnel / rim tricks in shaders): -VIEW_DIR
export const TO_CAMERA = VIEW_DIR.clone();

// sanity: TILE_H/2 must equal sin(30deg) * S_PX / sqrt(2)  (=16 for 64x32 tiles)
if (Math.abs((SIN_P / Math.SQRT2) * S_PX - TILE_H / 2) > 1e-9) {
  console.warn('[iso] tile aspect is not 2:1; the 3D camera will not match the 2D projection exactly');
}

export const tileToWorld = (x, y, h = 0) => new THREE.Vector3(x, h * H_UNIT, y);

/** Ground point (Y = 0) that sits under the screen centre for the given 2D camera. */
export function centreTarget(cam, W, H, offX = 0, offY = 0) {
  const A = (W / 2 - (cam.x + offX)) / ((TILE_W / 2) * cam.zoom); // x - z
  const B = (H / 2 - (cam.y + offY)) / ((TILE_H / 2) * cam.zoom); // x + z
  return new THREE.Vector3((A + B) / 2, 0, (B - A) / 2);
}

/**
 * Fit an OrthographicCamera so that every world point projects to the same canvas pixel as the
 * legacy 2D transform (cam.x/y/zoom + optional shake offset in screen px).
 */
export function fitCamera(camera, cam, W, H, offX = 0, offY = 0) {
  const target = centreTarget(cam, W, H, offX, offY);
  const halfW = W / (2 * cam.zoom * S_PX);
  const halfH = H / (2 * cam.zoom * S_PX);
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.near = 1; camera.far = CAM_DIST + 260;
  camera.position.copy(target).addScaledVector(VIEW_DIR, CAM_DIST);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return target;
}

/** Canvas pixel for a world position through the fitted camera (for the boot-time equivalence check). */
export function projectToScreen(camera, worldPos, W, H) {
  const v = worldPos.clone().project(camera);
  return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H };
}

/** Legacy projection for the same point: what the 2D overlay believes. */
export function legacyScreen(cam, x, y, h, offX = 0, offY = 0) {
  return {
    x: cam.x + offX + cam.zoom * (x - y) * (TILE_W / 2),
    y: cam.y + offY + cam.zoom * ((x + y) * (TILE_H / 2) - h * H_STEP),
  };
}
