export interface BodyParameters {
  height: number;
  build: number;
  shoulderWidth: number;
  headScale: number;
}

export const DEFAULT_BODY_PARAMETERS: BodyParameters = {
  height: 1.72,
  build: 0.45,
  shoulderWidth: 0.43,
  headScale: 1,
};
