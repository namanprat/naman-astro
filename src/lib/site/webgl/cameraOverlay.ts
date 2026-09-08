/**
 * A group pinned to the camera's frustum, scaled so a mesh spanning
 * `[-aspect, aspect] × [-1, 1]` covers the frame exactly. A point on such a mesh
 * is then a point on the screen, which is what the fluid trail and the hero's
 * glyph grid both need: they index screen-space textures.
 *
 * Not parented to the camera. three collects draw calls by walking the scene,
 * and R3F's default camera is not in it — a mesh hung on the camera renders
 * nowhere at all.
 *
 * It also undoes `Camera.setViewOffset`, which `HeroGlass` uses to scroll the
 * hero out of frame. That offset moves the whole projected image, this quad
 * included, and a screen-space device that moves is no longer screen-space:
 * every sample lands `offsetY` pixels from where it should, which is the glass
 * and its characters sliding apart as the page scrolls. Read off the camera
 * rather than off `window.scrollY` so it is exactly whatever was applied, and
 * nothing on a route that applies none.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Just in front of the near plane, and clear of it on any sane camera. */
const DEFAULT_DISTANCE = 0.2;

export function useCameraOverlay(distance = DEFAULT_DISTANCE): THREE.Group {
  const scene = useThree((state) => state.scene);
  const overlay = useMemo(() => new THREE.Group(), []);

  const scratch = useMemo(
    () => ({
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
    }),
    [],
  );

  useEffect(() => {
    scene.add(overlay);
    return () => {
      scene.remove(overlay);
    };
  }, [scene, overlay]);

  useFrame((state) => {
    const camera = state.camera;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    const near = Math.max(distance, camera.near * 1.25);
    const halfHeight =
      near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

    camera.getWorldPosition(scratch.position);
    camera.getWorldQuaternion(scratch.quaternion);
    scratch.forward
      .set(0, 0, -1)
      .applyQuaternion(scratch.quaternion)
      .multiplyScalar(near);

    const offsetY = camera.view?.enabled ? camera.view.offsetY : 0;
    const worldPerPixel = (halfHeight * 2) / Math.max(state.size.height, 1);
    scratch.up
      .set(0, 1, 0)
      .applyQuaternion(scratch.quaternion)
      .multiplyScalar(-offsetY * worldPerPixel);

    overlay.position
      .copy(scratch.position)
      .add(scratch.forward)
      .add(scratch.up);
    overlay.quaternion.copy(scratch.quaternion);
    overlay.scale.setScalar(halfHeight);
  });

  return overlay;
}
