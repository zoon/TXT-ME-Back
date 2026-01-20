addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)

  let targetUrl

  // API запросы → API Gateway
  if (url.pathname.startsWith('/prod/')) {
    targetUrl = 'https://326ltbm205.execute-api.eu-north-1.amazonaws.com' + url.pathname + url.search
  } else {
    // Статические файлы → CloudFront
    targetUrl = 'https://drprp5q0sg5tt.cloudfront.net' + url.pathname + url.search
  }

  const modifiedRequest = new Request(targetUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'Host': new URL(targetUrl).host,
    },
    body: request.body,
  })

  const response = await fetch(modifiedRequest)

  // CORS для API
  const newResponse = new Response(response.body, response)
  newResponse.headers.set('Access-Control-Allow-Origin', '*')
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Кеш для статики
  if (url.pathname.match(/\.(css|js|png|jpg|svg)$/)) {
    newResponse.headers.set('Cache-Control', 'public, max-age=3600')
  }

  return newResponse
}
