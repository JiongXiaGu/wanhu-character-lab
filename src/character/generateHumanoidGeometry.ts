import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BodyParameters } from './types';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

function createEllipsoid(
  center: THREE.Vector3,
  radius: THREE.Vector3,
  widthSegments = 16,
  heightSegments = 10,
): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  geometry.scale(radius.x, radius.y, radius.z);
  geometry.translate(center.x, center.y, center.z);
  return geometry;
}

function createCylinderBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  radialSegments = 10,
): THREE.BufferGeometry {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  direction.normalize();

  const geometry = new THREE.CylinderGeometry(
    radius * 0.92,
    radius,
    length,
    radialSegments,
    1,
    false,
  );

  const rotation = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction);
  geometry.applyQuaternion(rotation);
  geometry.translate(midpoint.x, midpoint.y, midpoint.z);

  return geometry;
}

export function generateHumanoidGeometry(
  parameters: BodyParameters,
): THREE.BufferGeometry {
  const { height, build, shoulderWidth, headScale } = parameters;

  const bulk = THREE.MathUtils.lerp(0.82, 1.24, build);
  const headHeight = height * 0.135 * headScale;
  const neckHeight = height * 0.045;
  const legLength = height * 0.49;
  const torsoHeight = height - legLength - headHeight - neckHeight;

  const pelvisY = legLength;
  const shoulderY = pelvisY + torsoHeight * 0.82;
  const headCenterY = height - headHeight * 0.5;

  const chestWidth = shoulderWidth * 0.82 * bulk;
  const chestDepth = height * 0.115 * bulk;
  const waistWidth = shoulderWidth * 0.61 * bulk;
  const pelvisWidth = shoulderWidth * THREE.MathUtils.lerp(0.63, 0.73, build);

  const armRadius = height * 0.033 * THREE.MathUtils.lerp(0.85, 1.22, build);
  const legRadius = height * 0.045 * THREE.MathUtils.lerp(0.88, 1.22, build);

  const upperArmLength = height * 0.185;
  const lowerArmLength = height * 0.175;

  const geometries: THREE.BufferGeometry[] = [];

  geometries.push(
    createEllipsoid(
      new THREE.Vector3(0, pelvisY + torsoHeight * 0.58, 0),
      new THREE.Vector3(chestWidth * 0.5, torsoHeight * 0.39, chestDepth * 0.5),
      18,
      12,
    ),
  );

  geometries.push(
    createEllipsoid(
      new THREE.Vector3(0, pelvisY + torsoHeight * 0.18, 0),
      new THREE.Vector3(
        waistWidth * 0.55,
        torsoHeight * 0.24,
        chestDepth * 0.43,
      ),
      16,
      10,
    ),
  );

  geometries.push(
    createEllipsoid(
      new THREE.Vector3(0, pelvisY, 0),
      new THREE.Vector3(
        pelvisWidth * 0.54,
        height * 0.075,
        height * 0.085 * bulk,
      ),
      16,
      10,
    ),
  );

  const neckStart = new THREE.Vector3(0, height - headHeight - neckHeight, 0);
  const neckEnd = new THREE.Vector3(0, height - headHeight * 0.92, 0);
  geometries.push(
    createCylinderBetween(neckStart, neckEnd, height * 0.034 * bulk, 10),
  );

  geometries.push(
    createEllipsoid(
      new THREE.Vector3(0, headCenterY, 0),
      new THREE.Vector3(
        headHeight * 0.38,
        headHeight * 0.5,
        headHeight * 0.42,
      ),
      18,
      12,
    ),
  );

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(
      side * shoulderWidth * 0.47,
      shoulderY,
      0,
    );
    const elbow = new THREE.Vector3(
      side * (shoulderWidth * 0.5 + height * 0.018),
      shoulderY - upperArmLength,
      0,
    );
    const wrist = new THREE.Vector3(
      side * (shoulderWidth * 0.49 + height * 0.012),
      elbow.y - lowerArmLength,
      0,
    );

    geometries.push(createCylinderBetween(shoulder, elbow, armRadius, 10));
    geometries.push(
      createCylinderBetween(elbow, wrist, armRadius * 0.86, 9),
    );
    geometries.push(
      createEllipsoid(
        new THREE.Vector3(wrist.x, wrist.y - height * 0.035, 0),
        new THREE.Vector3(
          height * 0.032,
          height * 0.055,
          height * 0.022,
        ),
        10,
        8,
      ),
    );
  }

  const hipOffset = pelvisWidth * 0.26;

  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(side * hipOffset, pelvisY, 0);
    const knee = new THREE.Vector3(
      side * hipOffset * 0.92,
      legLength * 0.48,
      0,
    );
    const ankle = new THREE.Vector3(
      side * hipOffset * 0.88,
      height * 0.055,
      0,
    );

    geometries.push(createCylinderBetween(hip, knee, legRadius, 11));
    geometries.push(
      createCylinderBetween(knee, ankle, legRadius * 0.79, 10),
    );
    geometries.push(
      createEllipsoid(
        new THREE.Vector3(
          ankle.x,
          height * 0.032,
          height * 0.026,
        ),
        new THREE.Vector3(
          height * 0.055,
          height * 0.032,
          height * 0.092,
        ),
        12,
        8,
      ),
    );
  }

  const merged = mergeGeometries(geometries, false);

  for (const geometry of geometries) {
    geometry.dispose();
  }

  if (!merged) {
    throw new Error('Failed to merge generated humanoid geometry.');
  }

  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}
