const SHELL_CACHE_NAME = "smokehouse-shell-v8";
const RUNTIME_CACHE_NAME = "smokehouse-runtime-v8";
const IMAGE_CACHE_NAME = "smokehouse-images-v8";
const NOTIFICATION_INTENT_CACHE_NAME = "smokehouse-notification-intent-v2";
const NOTIFICATION_INTENT_CACHE_KEY = "/__smokehouse-notification-intent__";
const NOTIFICATION_INTENT_MAX_AGE_MS = 2 * 60 * 1000;
const CACHE_NAMES = [SHELL_CACHE_NAME, RUNTIME_CACHE_NAME, IMAGE_CACHE_NAME, NOTIFICATION_INTENT_CACHE_NAME];
const STATIC_NAVIGATION_PATHS = ["/", "/cart", "/offline"];
const STATIC_ASSET_PATHS = [
  "/manifest.webmanifest",
  "/icons/logo-bigger.jpg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/logo-square.png"
];
const STATIC_PATHS = [...STATIC_NAVIGATION_PATHS, ...STATIC_ASSET_PATHS];

function normalizePathname(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isSameOriginRequest(url) {
  return url.origin === self.location.origin;
}

function isRestrictedDynamicNavigation(pathname) {
  return pathname === "/checkout" || pathname.startsWith("/order/");
}

function isCacheableNavigationPath(pathname) {
  return STATIC_NAVIGATION_PATHS.includes(normalizePathname(pathname));
}

async function cacheSuccessfulResponse(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== "opaque")) {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirstNavigation(request, options) {
  try {
    const response = await fetch(request);

    if (options?.cacheable) {
      await cacheSuccessfulResponse(SHELL_CACHE_NAME, request, response.clone());
    }

    return response;
  } catch {
    const shellCache = await caches.open(SHELL_CACHE_NAME);

    if (options?.cacheable) {
      const cached = await shellCache.match(request);
      if (cached) {
        return cached;
      }
    }

    const offlineFallback = await shellCache.match("/offline");
    if (offlineFallback) {
      return offlineFallback;
    }

    throw new Error("Unable to fulfill navigation request from network or offline fallback.");
  }
}

async function staleWhileRevalidate(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then((response) => cacheSuccessfulResponse(cacheName, request, response))
    .catch(() => null);

  if (cached) {
    void networkResponsePromise;
    return cached;
  }

  const networkResponse = await networkResponsePromise;
  if (networkResponse) {
    return networkResponse;
  }

  throw new Error("Unable to fulfill request from cache or network.");
}

function getNotificationIntentRequest() {
  return new Request(new URL(NOTIFICATION_INTENT_CACHE_KEY, self.location.origin));
}

function isOrderNotificationTarget(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.origin === self.location.origin && parsedUrl.pathname.startsWith("/order/");
  } catch {
    return false;
  }
}

async function rememberNotificationTarget(targetUrl) {
  if (!isOrderNotificationTarget(targetUrl)) {
    return;
  }

  const cache = await caches.open(NOTIFICATION_INTENT_CACHE_NAME);
  await cache.put(
    getNotificationIntentRequest(),
    new Response(JSON.stringify({
      url: targetUrl,
      createdAt: Date.now()
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    })
  );
}

async function consumeNotificationTarget() {
  const cache = await caches.open(NOTIFICATION_INTENT_CACHE_NAME);
  const intentRequest = getNotificationIntentRequest();
  const response = await cache.match(intentRequest);

  if (!response) {
    return null;
  }

  await cache.delete(intentRequest);

  try {
    const payload = await response.json();
    const createdAt = typeof payload?.createdAt === "number" ? payload.createdAt : 0;
    const targetUrl = typeof payload?.url === "string" ? payload.url : "";
    const isFresh = createdAt > 0 && Date.now() - createdAt <= NOTIFICATION_INTENT_MAX_AGE_MS;
    return isFresh && isOrderNotificationTarget(targetUrl) ? targetUrl : null;
  } catch {
    return null;
  }
}

async function clearNotificationTarget() {
  const cache = await caches.open(NOTIFICATION_INTENT_CACHE_NAME);
  await cache.delete(getNotificationIntentRequest());
}

async function handleRootNavigation(request, options) {
  const notificationTarget = await consumeNotificationTarget().catch(() => null);
  if (notificationTarget) {
    return Response.redirect(notificationTarget, 302);
  }

  return networkFirstNavigation(request, options);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE_NAME).then((cache) => cache.addAll(STATIC_PATHS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CACHE_NAMES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || !isSameOriginRequest(url) || url.pathname.startsWith("/api")) {
    return;
  }

  if (request.mode === "navigate") {
    const normalizedPathname = normalizePathname(url.pathname);
    const cacheableNavigation = !url.search && !isRestrictedDynamicNavigation(normalizedPathname) && isCacheableNavigationPath(normalizedPathname);

    event.respondWith(
      normalizedPathname === "/"
        ? handleRootNavigation(request, { cacheable: cacheableNavigation })
        : networkFirstNavigation(request, { cacheable: cacheableNavigation })
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(IMAGE_CACHE_NAME, request));
    return;
  }

  if (["style", "script", "font", "manifest"].includes(request.destination) || url.pathname.startsWith("/_next/static")) {
    event.respondWith(staleWhileRevalidate(RUNTIME_CACHE_NAME, request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Order Ready",
    body: "Your Smokehouse order is ready for pickup.",
    url: "/",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "order-ready"
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json()
      };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  const title = typeof payload.title === "string" ? payload.title : "Order Ready";
  const targetUrl = getNotificationTargetUrl({
    url: typeof payload.url === "string" ? payload.url : "/"
  });
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Your Smokehouse order is ready for pickup.",
    icon: typeof payload.icon === "string" ? payload.icon : "/icons/icon-192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icons/icon-192.png",
    tag: typeof payload.tag === "string" ? payload.tag : "order-ready",
    data: {
      ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
      url: targetUrl
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function getNotificationTargetUrl(notificationData) {
  const notificationUrl = notificationData && typeof notificationData.url === "string"
    ? notificationData.url
    : "/";

  try {
    const candidateUrl = new URL(notificationUrl, self.location.origin);
    return candidateUrl.origin === self.location.origin
      ? candidateUrl.href
      : new URL("/", self.location.origin).href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}

async function navigateAndFocusClient(client, targetUrl) {
  let targetClient = client;

  if (client.url !== targetUrl && "navigate" in client) {
    try {
      targetClient = await client.navigate(targetUrl) || client;
    } catch {
      return undefined;
    }
  }

  if (targetClient.url !== targetUrl) {
    return undefined;
  }

  await clearNotificationTarget().catch(() => undefined);

  if ("focus" in targetClient) {
    try {
      return await targetClient.focus();
    } catch {
      return undefined;
    }
  }

  return targetClient;
}

async function messageAndFocusClient(client, targetUrl) {
  if (!("postMessage" in client)) {
    return undefined;
  }

  try {
    client.postMessage({
      type: "OPEN_NOTIFICATION_TARGET",
      url: targetUrl
    });
  } catch {
    return undefined;
  }

  if ("focus" in client) {
    try {
      await client.focus();
    } catch {
      // WebKit can report a newly launched Home Screen client before it is focusable.
    }
  }

  return client;
}

async function openNotificationTarget(targetUrl) {
  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windowClients) {
    if (client.url !== targetUrl) {
      continue;
    }

    const focusedClient = await navigateAndFocusClient(client, targetUrl);
    if (focusedClient) {
      return focusedClient;
    }

    const messagedClient = await messageAndFocusClient(client, targetUrl);
    if (messagedClient) {
      return messagedClient;
    }
  }

  for (const client of windowClients) {
    try {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin !== self.location.origin || client.url === targetUrl) {
        continue;
      }

      const focusedClient = await navigateAndFocusClient(client, targetUrl);
      if (focusedClient) {
        return focusedClient;
      }

      const messagedClient = await messageAndFocusClient(client, targetUrl);
      if (messagedClient) {
        return messagedClient;
      }
    } catch {
      // Try the next eligible existing client.
    }
  }

  if (self.clients.openWindow) {
    try {
      const openedClient = await self.clients.openWindow(targetUrl);
      if (openedClient) {
        const focusedClient = await navigateAndFocusClient(openedClient, targetUrl);
        if (focusedClient) {
          return focusedClient;
        }

        const messagedClient = await messageAndFocusClient(openedClient, targetUrl);
        if (messagedClient) {
          return messagedClient;
        }
      }
    } catch {
      // The notification click cannot open another client.
    }
  }

  return undefined;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = getNotificationTargetUrl(event.notification.data);
  event.waitUntil(
    rememberNotificationTarget(targetUrl)
      .catch(() => undefined)
      .then(() => openNotificationTarget(targetUrl))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CONSUME_NOTIFICATION_TARGET" || !event.source || !("postMessage" in event.source)) {
    return;
  }

  event.waitUntil(
    consumeNotificationTarget()
      .catch(() => null)
      .then((targetUrl) => {
        if (!targetUrl) {
          return;
        }

        event.source.postMessage({
          type: "OPEN_NOTIFICATION_TARGET",
          url: targetUrl
        });
      })
  );
});
