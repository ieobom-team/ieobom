/**
 * 받아 온 파일을 사용자의 기기에 저장한다.
 *
 * `clipboard.ts`와 같은 이유로 `boolean`을 돌려준다. 브라우저나 환경에 따라 `URL.createObjectURL`이
 * 없을 수 있고, 그때 화면이 "내려받지 못했다"고 말할 수 있어야 한다. 조용히 아무 일도 일어나지 않으면
 * 직원은 파일을 기다리다 다시 누른다.
 */
export function saveFile(blob: Blob, fileName: string): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false
  }

  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return true
  } finally {
    // 해제하지 않으면 탭이 살아 있는 동안 파일이 메모리에 남는다. 어르신의 상태 이야기가 담긴 파일이다.
    URL.revokeObjectURL(url)
  }
}
