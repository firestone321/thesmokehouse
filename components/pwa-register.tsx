"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VERSION_STORAGE_KEY = "smokehouse-storefront-app-version";

type VersionPayload = {
  version?: unknown;
};

function readStoredVersion() {
  try {
    return window.localStorage.getItem(VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeVersion(version: string) {
  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, version);
  } catch {
    return;
  }
}

async function fetchCurrentVersion() {
  const response = await fetch("/api/app-version", {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as VersionPayload | null;
  return typeof payload?.version === "string" && payload.version.length > 0 ? payload.version : null;
}

export function PwaRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const pendingVersionRef = useRef<string | null>(null);

  const showUpdateBanner = useCallback((version?: string) => {
    if (version) {
      pendingVersionRef.current = version;
    }

    setUpdateAvailable(true);
  }, []);

  const checkVersion = useCallback(async () => {
    const currentVersion = await fetchCurrentVersion();

    if (!currentVersion) {
      return;
    }

    const storedVersion = readStoredVersion();

    if (!storedVersion) {
      storeVersion(currentVersion);
      return;
    }

    if (storedVersion !== currentVersion) {
      showUpdateBanner(currentVersion);
    }
  }, [showUpdateBanner]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });

      if ("caches" in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        });
      }

      return;
    }

    let cancelled = false;
    let hasPromptedForControllerChange = false;

    const handleControllerChange = () => {
      if (hasPromptedForControllerChange) {
        return;
      }

      hasPromptedForControllerChange = true;
      showUpdateBanner();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none"
    }).then((registration) => {
      if (cancelled) {
        return;
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;

        if (!worker) {
          return;
        }

        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      void registration.update();
    }).catch((error) => {
      console.error("service_worker_registration_failed", error);
    });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [showUpdateBanner]);

  useEffect(() => {
    void checkVersion();

    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };

    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);

    return () => {
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, [checkVersion]);

  const reloadApp = () => {
    if (pendingVersionRef.current) {
      storeVersion(pendingVersionRef.current);
    }

    window.location.reload();
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] border-b border-[#3f2b22] bg-[#1d1916] text-[#f5f5f2] shadow-[0_12px_30px_rgba(29,25,22,0.28)]">
      <button
        type="button"
        onClick={reloadApp}
        className="mx-auto flex min-h-12 w-full max-w-6xl items-center justify-center px-4 py-3 text-center text-sm font-semibold sm:text-base"
      >
        Updates available. Tap to reload.
      </button>
    </div>
  );
}
