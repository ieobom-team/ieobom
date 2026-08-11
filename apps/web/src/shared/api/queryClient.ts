import { QueryClient } from '@tanstack/react-query'

/**
 * 서버 상태 캐시.
 *
 * 자동 재시도를 끈다. 실패를 세 번 다시 시도하는 동안 화면은 "불러오는 중"에 멈춰 있고,
 * 돌봄 중인 근무자는 기다리는 것 말고 할 수 있는 게 없다. 실패는 바로 보여 주고
 * 다시 시도할지는 사람이 버튼으로 고르게 한다.
 *
 * 연결이 끊겼을 때 입력을 기기에 임시 저장했다가 자동으로 재전송하는 것은 별도 Issue(#9)다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}
