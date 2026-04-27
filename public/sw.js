const SHELL_CACHE_NAME = "smokehouse-shell-v3";
const RUNTIME_CACHE_NAME = "smokehouse-runtime-v3";
const IMAGE_CACHE_NAME = "smokehouse-images-v3";
const CACHE_NAMES = [SHELL_CACHE_NAME, RUNTIME_CACHE_NAME, IMAGE_CACHE_NAME];
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

    event.respondWith(networkFirstNavigation(request, { cacheable: cacheableNavigation }));
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
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Your Smokehouse order is ready for pickup.",
    icon: typeof payload.icon === "string" ? payload.icon : "/icons/icon-192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icons/icon-192.png",
    tag: typeof payload.tag === "string" ? payload.tag : "order-ready",
    data: {
      ...(payload.data && typeof payload.data === "object" ? payload.data : {}),
      url: typeof payload.url === "string" ? payload.url : "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationUrl = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url
    : "/";
  const targetUrl = new URL(notificationUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
