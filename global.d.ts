// global.d.ts
// Tell TypeScript that this module exists:
declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Loader } from 'three';
  // minimal typing for GLTF
  export interface GLTF {
    scene: import('three').Group;
    scenes: import('three').Group[];
    animations: import('three').AnimationClip[];
    userData: any;
  }
  export class GLTFLoader extends Loader {
    constructor(manager?: any);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
    parse(
      data: ArrayBuffer,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}
