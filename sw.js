const CACHE_NAME = "robot-trainer-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "SHOW_REMINDER") {
    self.registration.showNotification(data.title || "Робот-Тренер", {
      body: data.body || "Пора тренироваться!",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      vibrate: [300, 100, 300, 100, 300],
      tag: "robot-trainer-reminder",
      renotify: true,
      requireInteraction: true
    });
  }
});
