const CACHE_NAME = 'wordbook-v1';

// 캐시할 파일 목록
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&family=Space+Mono:wght@400;700&display=swap'
];

// 설치: 핵심 파일 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 폰트는 별도 처리 (CORS 이슈 방지)
      const localAssets = ASSETS.filter(url => !url.startsWith('http'));
      return cache.addAll(localAssets);
    }).then(() => self.skipWaiting())
  );
});

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  const { request } = event;

  // 구글 폰트: 네트워크 우선, 실패시 캐시
  if (request.url.includes('fonts.googleapis.com') || request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        fetch(request)
          .then(response => {
            cache.put(request, response.clone());
            return response;
          })
          .catch(() => cache.match(request))
      )
    );
    return;
  }

  // 나머지: 캐시 우선, 실패시 네트워크 (오프라인 지원)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // 유효한 응답만 캐시
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // 오프라인 + 캐시 없음: index.html 반환
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
