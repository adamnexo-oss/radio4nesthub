const CACHE_NAME = "radio4nesthub-v15"
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/js/radio.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon-180.png",
  "/icons/apple-touch-icon-167.png",
  "/icons/apple-touch-icon-152.png",
  "/iconsradio/rmf-fm.png",
  "/iconsradio/rmf-classic.png",
  "/iconsradio/radio-zet.png",
  "/iconsradio/tok-fm.png",
  "/iconsradio/radio-chopin.jpg",
  "/iconsradio/radio-dwojka.jpg",
  "/iconsradio/jedynka.jpg",
  "/iconsradio/sr-p1.png",
  "/iconsradio/sr-p3.png",
  "/iconsradio/radio-gdansk.png",
  "/iconsradio/eska-3city.png",
  "/iconsradio/plus-gdansk.png",
  "/iconsradio/zlote-gdansk.png",
  "/iconsradio/rmf-3city.png",
  "/iconsradio/pogoda-gdansk.png",
  "/iconsradio/p4-gotland.png",
  "/iconsradio/p4-stockholm.png",
  "/iconsradio/nrj-sweden.png",
  "/iconsradio/nrj-stockholm.png",
  "/iconsradio/sr-p2-klassisk.png",
  "/iconsradio/klassisk-musik.png"
]

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  )
  self.clients.claim()
})

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
