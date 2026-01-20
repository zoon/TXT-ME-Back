export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const awsHost = "326ltbm205.execute-api.eu-north-1.amazonaws.com";

    // 1. Быстрый ответ на OPTIONS (обязательно для Safari)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
          "Access-Control-Allow-Credentials": "true"
        },
      });
    }

    // 2. Формируем новый URL для AWS
    const newUrl = `https://${awsHost}${url.pathname}${url.search}`;

    // 3. Создаем новый запрос, принудительно меняя заголовок Host
    const modifiedRequest = new Request(newUrl, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      redirect: 'manual'
    });

    modifiedRequest.headers.set("Host", awsHost);

    // 4. Отправляем в AWS
    let response = await fetch(modifiedRequest);

    // 5. Исправляем CORS в ответе
    let newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", origin || "*");
    newHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
