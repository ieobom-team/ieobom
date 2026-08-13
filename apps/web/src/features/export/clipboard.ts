/**
 * 클립보드 쓰기 한 겹.
 *
 * `navigator.clipboard`는 HTTPS와 사용자 제스처를 요구한다(#18 위험). 배포 환경이나 브라우저에 따라
 * 아예 없을 수도 있고, 권한이 없어 거부될 수도 있다. 실패를 구분해 화면이 "직접 선택해 복사하라"고
 * 안내할 수 있게 `boolean`으로만 돌려준다.
 *
 * 실제로 복사되지 않았는데 복사 기록 API를 부르면 "쓰이지 않은 문구가 쓰인 것으로" 남는다.
 * 그래서 이 함수가 실패를 알려야 호출한 쪽이 기록 API를 건너뛸 수 있다.
 */
export async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
