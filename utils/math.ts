import { Point } from '../types';

// Solves linear system Ax = B using Gaussian elimination
function solveLinearSystem(A: number[][], B: number[]): number[] {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    // Pivot
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    // Swap
    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;

    // Zero out below
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let k = i + 1; k < n; k++) {
      sum += A[i][k] * x[k];
    }
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
}

// Computes the Homography Matrix H that maps srcPoints to dstPoints
// Normalized DLT for better stability
export function computeHomography(srcPoints: Point[], dstPoints: Point[]): number[] {
  // Normalize points to reduce numerical instability
  const normalize = (points: Point[]) => {
    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= points.length;
    cy /= points.length;
    
    let distSum = 0;
    points.forEach(p => {
        distSum += Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
    });
    const s = (Math.sqrt(2) * points.length) / distSum;
    
    const T = [s, 0, -s*cx, 0, s, -s*cy, 0, 0, 1];
    
    const normPoints = points.map(p => ({
        x: s * (p.x - cx),
        y: s * (p.y - cy)
    }));
    
    return { points: normPoints, T };
  };

  const src = normalize(srcPoints);
  const dst = normalize(dstPoints);

  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < 4; i++) {
    const s = src.points[i];
    const d = dst.points[i];
    A.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    A.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    B.push(d.x);
    B.push(d.y);
  }

  const h = solveLinearSystem(A, B);
  h.push(1);

  // Denormalize: H = inv(T_dst) * H_norm * T_src
  // Matrix multiplication helper
  const mult3x3 = (m1: number[], m2: number[]) => {
      const res = new Array(9).fill(0);
      for(let r=0; r<3; r++) {
          for(let c=0; c<3; c++) {
              for(let k=0; k<3; k++) {
                  res[r*3+c] += m1[r*3+k] * m2[k*3+c];
              }
          }
      }
      return res;
  };

  // Inverse of similarity matrix T is simple
  // [s 0 tx]^-1 = [1/s 0 -tx/s]
  // [0 s ty]      [0 1/s -ty/s]
  // [0 0 1 ]      [0  0   1   ]
  const invTd = [
      1/dst.T[0], 0, -dst.T[2]/dst.T[0],
      0, 1/dst.T[4], -dst.T[5]/dst.T[4],
      0, 0, 1
  ];

  const H_temp = mult3x3(h, src.T);
  const H_final = mult3x3(invTd, H_temp);

  // Normalize H_final so H[8] is 1 (if possible)
  if (Math.abs(H_final[8]) > 1e-8) {
      for(let i=0; i<9; i++) H_final[i] /= H_final[8];
  }

  return H_final;
}

// Transforms a point using the homography matrix
export function transformPoint(x: number, y: number, H: number[]): Point {
  const newX = (H[0] * x + H[1] * y + H[2]) / (H[6] * x + H[7] * y + H[8]);
  const newY = (H[3] * x + H[4] * y + H[5]) / (H[6] * x + H[7] * y + H[8]);
  return { x: newX, y: newY };
}

// Generates a CSS transform string to map a standard unit square (or 0,0 to w,h) to 4 arbitrary points
// Note: CSS matrix3d is column-major.
export function getCSSMatrix3d(srcWidth: number, srcHeight: number, dstPoints: Point[]): string {
  const srcPoints = [
    { x: 0, y: 0 },
    { x: srcWidth, y: 0 },
    { x: srcWidth, y: srcHeight },
    { x: 0, y: srcHeight }
  ];

  const H = computeHomography(srcPoints, dstPoints);

  // Convert 3x3 Homography to 4x4 CSS Matrix3D
  // Column-major order:
  // a1, b1, c1, d1 (Column 1)
  // a2, b2, c2, d2 (Column 2) ...
  const css = [
    H[0], H[3], 0, H[6],
    H[1], H[4], 0, H[7],
    0,    0,    1, 0,
    H[2], H[5], 0, H[8]
  ];

  return `matrix3d(${css.join(',')})`;
}

export function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}