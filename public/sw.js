const CACHE_VERSION = "atletas-energisa-v4";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

// Notificações push (FCM, mensagem só de dados): o portal monta a notificação.
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    const payload = event.data ? event.data.json() : {};
    dados = payload.data || payload;
  } catch {
    dados = { corpo: event.data ? event.data.text() : "" };
  }
  const titulo = dados.titulo || "Atletas Energisa";
  const opcoes = {
    body: dados.corpo || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { link: dados.link || "/dashboard" },
    lang: "pt-BR",
  };
  if (dados.tag) {
    opcoes.tag = dados.tag;
    opcoes.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Toque na notificação: reaproveita uma janela aberta do portal ou abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/dashboard";
  const destino = new URL(link.startsWith("/") ? link : "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          return janela.focus().then((j) => (j && "navigate" in j ? j.navigate(destino) : undefined));
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
