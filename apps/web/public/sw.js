// sw.js — 이어봄 푸시 수신 전용 서비스 워커 (Manyfast F-QPWGNS, #72 / PWA installability, #110)
//
// 주의: 이 서비스 워커는 푸시 수신(push) 및 알림 클릭(notificationclick) 전용입니다.
// fetch 를 가로채지 않으며 오프라인 캐싱을 수행하지 않습니다.
// 아래 fetch 리스너는 아무 것도 하지 않는 no-op이며 (respondWith 없음, 기존 네트워크 동작 불변),
// 일부 브라우저의 설치(installable) 판정이 fetch 핸들러 존재 여부를 참고하는 경우를 대비한 것입니다.

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  let data
  try {
    data = event.data.json()
  } catch {
    data = {
      title: '이어봄',
      body: event.data.text() || '새 후속 업무가 배정되었습니다',
      url: '/tasks',
    }
  }

  const title = data.title || '이어봄'
  const options = {
    body: data.body || '새 후속 업무가 배정되었습니다',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.url || '/tasks',
      taskId: data.taskId,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data && event.notification.data.url) || '/tasks'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열려 있는 창이 있으면 포커스 후 이동
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) {
            return client.navigate(targetUrl)
          }
          return client
        }
      }
      // 열린 창이 없으면 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

self.addEventListener('fetch', () => {
  // no-op: 네트워크 요청을 가로채지 않는다.
})
