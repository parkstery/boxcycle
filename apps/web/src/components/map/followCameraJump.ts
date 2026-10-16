/**
 * 운영 카메라 추종이 jumpTo 하는 동안의 깊이.
 * 지도 move/zoom 처리가 이 점프를 사용자 조작으로 보지 않게 한다.
 * DEV 계측(mapTickProbe)과 분리된 제품 상태다.
 */
let followJumpDepth = 0;

export function isFollowCameraJump(): boolean {
  return followJumpDepth > 0;
}

export function beginFollowCameraJump(): void {
  followJumpDepth += 1;
}

export function endFollowCameraJump(): void {
  followJumpDepth = Math.max(0, followJumpDepth - 1);
}
