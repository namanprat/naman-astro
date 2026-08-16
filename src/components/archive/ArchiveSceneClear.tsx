import { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SWATCH_BLACK_NUM } from "../../lib/site/siteColors";

/** Brand-black canvas + no fog — the shared scene keeps Env's HDR / FogExp2 otherwise. */
export default function ArchiveSceneClear() {
  const { scene, gl } = useThree();

  useLayoutEffect(() => {
    scene.background = new THREE.Color(SWATCH_BLACK_NUM);
    scene.fog = null;
    gl.setClearColor(SWATCH_BLACK_NUM, 1);

    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, gl]);

  return null;
}
