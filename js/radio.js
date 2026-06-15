window.__onGCastApiAvailable = function(isAvailable){
  window.radioCastApiAvailable = isAvailable
  if(isAvailable && window.radioInitializeCastApi){
    window.radioInitializeCastApi()
  }
}

const radioApiHosts = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info"
]
const radioHostedOrigin = "https://radio4nesthub.web.app"
const radioHostedArtwork = `${radioHostedOrigin}/icons/icon-512.png`
const radioStreamOverrides = [
  {
    terms:["rmf classic"],
    url:"https://rs9-krk2.rmfstream.pl/rmf_classic",
    codec:"MP3",
    bitrate:128
  },
  {
    terms:["sveriges radio - p2 klassiskt","sveriges radio p2 klassiskt","sveriges radio p2","sr p2","p2 klassiskt","p2 klassisk"],
    url:"https://live1.sr.se/p2-mp3-192",
    codec:"MP3",
    bitrate:192
  }
]
const radioPresetStations = [
  {
    stationuuid:"preset-rmf-classic",
    name:"RMF Classic",
    countrycode:"PL",
    country:"PL",
    tags:"classical, music",
    url:"https://rs9-krk2.rmfstream.pl/rmf_classic",
    url_resolved:"https://rs9-krk2.rmfstream.pl/rmf_classic",
    codec:"MP3",
    bitrate:128,
    lastcheckok:1,
    preset:true,
    aliases:["rmf classic","radio rmf classic"]
  },
  {
    stationuuid:"preset-sr-p2-klassisk",
    name:"Sveriges Radio - P2 Klassiskt",
    countrycode:"SE",
    country:"SE",
    tags:"classical, music",
    url:"https://live1.sr.se/p2-mp3-192",
    url_resolved:"https://live1.sr.se/p2-mp3-192",
    codec:"MP3",
    bitrate:192,
    lastcheckok:1,
    preset:true,
    aliases:["sveriges radio - p2 klassiskt","sveriges radio p2 klassiskt","sveriges radio p2","sr p2","p2 klassiskt","p2 klassisk"]
  }
]
const radioLocalArtworkRules = [
  {file:"rmf-classic.png", terms:["rmf classic","radio rmf classic"]},
  {file:"rmf-3city.png", terms:["rmf maxx","rmf 3city","rmf maxxx"]},
  {file:"rmf-fm.png", terms:["rmf fm"]},
  {file:"radio-zet.png", terms:["radio zet"]},
  {file:"tok-fm.png", terms:["tok fm"]},
  {file:"radio-chopin.jpg", terms:["radio chopin","polskie radio - chopin","polskie radio chopin"]},
  {file:"radio-dwojka.jpg", terms:["radio dwojka","dwojka","dwójka","polskie radio program 2","polskie radio 2"]},
  {file:"jedynka.jpg", terms:["polskie radio jedynka","jedynka"]},
  {file:"radio-gdansk.png", terms:["radio gdansk"]},
  {file:"eska-3city.png", terms:["eska trojmiasto","eska 3city","eska"]},
  {file:"plus-gdansk.png", terms:["radio plus gdansk","plus gdansk"]},
  {file:"zlote-gdansk.png", terms:["zlote przeboje","zlote gdansk"]},
  {file:"pogoda-gdansk.png", terms:["radio pogoda gdansk","pogoda gdansk","radio pogoda"]},
  {file:"p4-gotland.png", terms:["sveriges radio p4 gotland","p4 gotland"]},
  {file:"p4-stockholm.png", terms:["sveriges radio p4 stockholm","p4 stockholm"]},
  {file:"nrj-stockholm.png", terms:["nrj stockholm"]},
  {file:"nrj-sweden.png", terms:["nrj sweden","nrj"]},
  {file:"sr-p2-klassisk.png", terms:["sveriges radio - p2 klassiskt","sveriges radio p2 klassiskt","sveriges radio p2","sr p2 klassisk","p2 klassiskt","p2 klassisk"]},
  {file:"klassisk-musik.png", terms:["klassisk musik"]},
  {file:"sr-p1.png", terms:["sveriges radio p1","sr p1"]},
  {file:"sr-p3.png", terms:["sveriges radio p3","sr p3"]}
]

let radioState = {
  country:"PL",
  query:"",
  stations:[],
  current:null,
  playing:false,
  volume:localStorage.getItem("radioVolume") === null ? 0.8 : Number(localStorage.getItem("radioVolume")),
  castReady:false,
  castListenerAttached:false,
  casting:false,
  playRequestId:0,
  stationLoadRequestId:0,
  wantsPlay:false,
  bufferTimer:null
}

function radioInitializeCastApi(){
  if(!window.cast || !window.chrome || !chrome.cast || radioState.castReady) return
  let context = cast.framework.CastContext.getInstance()
  context.setOptions({
    receiverApplicationId:chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy:chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
  })
  if(!radioState.castListenerAttached && cast.framework.CastContextEventType){
    context.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, radioCastSessionChanged)
    radioState.castListenerAttached = true
  }
  radioState.castReady = true
  radioState.casting = !!context.getCurrentSession()
}
window.radioInitializeCastApi = radioInitializeCastApi
if(window.radioCastApiAvailable) radioInitializeCastApi()

function radioSetStatus(message){
  document.getElementById("radioStatus").textContent = message
}

function radioAudio(){
  return document.getElementById("radioAudio")
}

function radioPrepareAudio(){
  let audio = radioAudio()
  if(!audio || audio.dataset.radioReady) return

  audio.dataset.radioReady = "1"
  audio.preload = "none"

  audio.addEventListener("loadstart", () => {
    if(radioState.current && !radioState.casting){
      radioSetStatus(`Łączenie i buforowanie: ${radioState.current.name}`)
    }
  })

  audio.addEventListener("waiting", () => {
    if(radioState.current && !radioState.casting){
      radioSetStatus(`Buforowanie: ${radioState.current.name}`)
    }
  })

  audio.addEventListener("stalled", () => {
    if(radioState.current && !radioState.casting){
      radioSetStatus("Stream zwolnił. Czekam na dane audio...")
    }
  })

  audio.addEventListener("canplay", () => {
    if(radioState.current && !radioState.casting && radioState.wantsPlay && !radioState.playing && audio.paused){
      audio.play().catch(() => {
        radioSetStatus("Dotknij ▶, jeśli stacja nie wystartowała.")
      })
    }
  })

  audio.addEventListener("playing", () => {
    if(radioState.current && !radioState.casting){
      radioClearBufferTimer()
      radioState.playing = true
      radioSetPlayButton()
      radioRenderStations()
      radioSetStatus(`Odtwarzam: ${radioState.current.name}`)
    }
  })

  audio.addEventListener("pause", () => {
    if(!radioState.casting){
      radioState.playing = false
      radioSetPlayButton()
      radioRenderStations()
    }
  })

  audio.addEventListener("error", () => {
    if(radioState.current && !radioState.casting){
      radioClearBufferTimer()
      radioState.playing = false
      radioSetPlayButton()
      radioRenderStations()
      radioSetStatus("Ten stream nie odpowiedział. Kliknij Odśwież albo wybierz inną stację.")
    }
  })
}

function radioClearBufferTimer(){
  if(radioState.bufferTimer){
    clearTimeout(radioState.bufferTimer)
    radioState.bufferTimer = null
  }
}

function radioStopLocalAudio(){
  let audio = radioAudio()
  if(!audio) return
  audio.pause()
  audio.removeAttribute("src")
  audio.load()
}

function radioApplyVolume(){
  let audio = radioAudio()
  let label = document.getElementById("radioVolumeLabel")
  let slider = document.getElementById("radioVolume")
  if(audio) audio.volume = radioState.volume
  if(slider) slider.value = Math.round(radioState.volume * 100)
  if(label) label.textContent = `${Math.round(radioState.volume * 100)}%`
  radioApplyCastVolume()
}

function radioSetVolume(value){
  radioState.volume = Math.max(0, Math.min(1, Number(value) / 100))
  localStorage.setItem("radioVolume", String(radioState.volume))
  radioApplyVolume()
}

function radioCurrentCastSession(){
  if(!window.cast || !cast.framework) return null
  return cast.framework.CastContext.getInstance().getCurrentSession()
}

function radioHasCastSession(){
  return !!radioCurrentCastSession()
}

function radioCastSessionChanged(event){
  let state = event && event.sessionState
  let started = state === cast.framework.SessionState.SESSION_STARTED || state === cast.framework.SessionState.SESSION_RESUMED
  let ended = state === cast.framework.SessionState.SESSION_ENDED

  if(started){
    radioState.casting = true
    radioSetStatus("Połączono z Cast.")
  }

  if(ended){
    radioState.casting = false
    radioState.playing = false
    radioSetStatus("Cast zakończony.")
  }

  radioSetPlayButton()
  radioRenderStations()
}

async function radioApplyCastVolume(){
  let session = radioCurrentCastSession()
  if(!session) return

  try{
    if(typeof session.setVolume === "function"){
      await session.setVolume(radioState.volume)
      return
    }

    let rawSession = typeof session.getSessionObj === "function" ? session.getSessionObj() : null
    if(rawSession && typeof rawSession.setReceiverVolumeLevel === "function"){
      rawSession.setReceiverVolumeLevel(radioState.volume, () => {}, () => {})
    }
  }catch(error){
    radioSetStatus("Nie udało się zmienić głośności Nest Hub.")
  }
}

function radioSetPlayButton(){
  document.getElementById("radioPlayPause").textContent = radioState.playing || radioState.casting ? "Ⅱ" : "▶"
  radioUpdateArtwork(radioState.current)
}

function radioStationLabel(station){
  let country = station.countrycode || station.country || "radio"
  let tags = station.tags ? station.tags.split(",").slice(0, 3).join(", ") : "live"
  return `${country} · ${tags}`
}

function radioNormalizeName(value){
  return String(value || "").toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function radioLocalArtworkUrl(file, forceHosted){
  if(forceHosted) return `${radioHostedOrigin}/iconsradio/${file}`
  if(location.protocol === "file:") return `iconsradio/${file}`
  if(location.host) return `${location.origin}/iconsradio/${file}`
  return `${radioHostedOrigin}/iconsradio/${file}`
}

function radioLocalArtwork(station, forceHosted){
  let name = radioNormalizeName(station && station.name)
  let rule = radioLocalArtworkRules.find(item => item.terms.some(term => name.includes(term)))
  return rule ? radioLocalArtworkUrl(rule.file, forceHosted) : ""
}

function radioAppArtwork(forceHosted){
  if(!forceHosted && location.protocol === "file:"){
    return "icons/icon-512.png"
  }
  if(!forceHosted && location.host){
    return `${location.origin}/icons/icon-512.png`
  }
  return radioHostedArtwork
}

function radioArtworkMayFailOnCast(url){
  try{
    let host = new URL(url).hostname.replace(/^www\./, "")
    return host === "radiopogoda.pl"
  }catch(error){
    return true
  }
}

function radioStationArtwork(station, useFallback, forceHosted){
  let localArt = radioLocalArtwork(station, forceHosted)
  if(localArt) return localArt
  let url = String(station && station.favicon ? station.favicon : "").trim()
  if(!url || !url.startsWith("https://")) return useFallback ? radioAppArtwork(forceHosted) : ""
  if(radioArtworkMayFailOnCast(url)) return useFallback ? radioAppArtwork(forceHosted) : ""
  return url
}

function radioApplyStreamOverride(station){
  let name = radioNormalizeName(station && station.name)
  let override = radioStreamOverrides.find(item => item.terms.some(term => name.includes(term)))
  if(!override) return station

  return {
    ...station,
    url:override.url,
    url_resolved:override.url,
    codec:override.codec || station.codec,
    bitrate:override.bitrate || station.bitrate,
    lastcheckok:1
  }
}

function radioStationSearchTerms(station){
  return [station && station.name, ...((station && station.aliases) || [])].map(radioNormalizeName).filter(Boolean)
}

function radioStationMatchesQuery(station, query){
  if(!query) return false
  return radioStationSearchTerms(station).some(term => term.includes(query) || query.includes(term))
}

function radioPresetMatches(query, country){
  let normalizedQuery = radioNormalizeName(query)
  return radioPresetStations.filter(station => {
    if(country && station.countrycode !== country) return false
    return radioStationMatchesQuery(station, normalizedQuery)
  }).map(station => ({...station}))
}

function radioFallbackIcon(station){
  let name = String(station && station.name ? station.name : "").toLowerCase()
  if(name.includes("pogoda")) return "☀️"
  if(name.includes("p4") || name.includes("sveriges") || name.includes("sr ")) return "🇸🇪"
  if(name.includes("gdań") || name.includes("gdansk") || name.includes("trójmiasto")) return "🌊"
  if(name.includes("classic") || name.includes("klassisk") || name.includes("p2")) return "🎼"
  if(name.includes("nrj") || name.includes("rmf") || name.includes("zet") || name.includes("eska")) return "🎵"
  return "📻"
}

function radioUpdateArtwork(station){
  let box = document.getElementById("radioArtwork")
  if(!box) return

  box.classList.toggle("playing", radioState.playing)

  if(!station){
    box.innerHTML = `<span class="radio-art-fallback">📻</span>`
    return
  }

  let art = radioStationArtwork(station, true)
  if(art){
    box.innerHTML = `<img src="${radioEscape(art)}" alt="" onerror="this.replaceWith(document.createTextNode('${radioFallbackIcon(station)}'))">`
  }else{
    box.innerHTML = `<span class="radio-art-fallback">${radioFallbackIcon(station)}</span>`
  }
}

function radioEscape(value){
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")
}

function radioNormalizeStations(items){
  let seen = new Set()
  return items.map(radioApplyStreamOverride).filter(item => item.name && (item.url_resolved || item.url)).filter(item => {
    let key = `${item.name}-${item.url_resolved || item.url}`
    if(seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => radioStationScore(b) - radioStationScore(a)).slice(0,24)
}

function radioStationScore(station){
  let score = 0
  let name = radioNormalizeName(station.name)
  let query = radioNormalizeName(radioState.query)
  let url = radioNormalizeName(station.url_resolved || station.url || "")
  let homepage = radioNormalizeName(station.homepage || "")

  if(query){
    if(name === query) score += 100
    else if(name.startsWith(query)) score += 70
    else if(name.includes(query)) score += 45
  }

  if(station.lastcheckok) score += 20
  if(station.preset) score += 120
  if(Number(station.bitrate) >= 96) score += 8
  if(String(station.codec || "").toLowerCase().includes("mp3")) score += 5
  if(radioStreamOverrides.some(item => item.terms.some(term => name.includes(term)))) score += 80
  if(url.startsWith("https://")) score += 30
  if(/^http:\/\/\d+\./.test(String(station.url_resolved || station.url || "").toLowerCase())) score -= 70
  if(homepage.includes("onlineradiobox") || url.includes("onlineradiobox")) score -= 35
  if(url.includes(".pls") || url.includes(".m3u")) score -= 10

  return score
}

async function radioFetchStations(forceRefresh){
  let params = new URLSearchParams({hidebroken:"true",order:"clickcount",reverse:"true",limit:"36"})
  if(radioState.country) params.set("countrycode", radioState.country)
  if(radioState.query.trim()) params.set("name", radioState.query.trim())
  if(forceRefresh) params.set("_", String(Date.now()))
  let lastError = null
  for(let host of radioApiHosts){
    try{
      let response = await fetch(`${host}/json/stations/search?${params.toString()}`, {
        cache:"no-store",
        headers:{"Accept":"application/json"}
      })
      if(!response.ok) throw new Error(`HTTP ${response.status}`)
      let data = await response.json()
      return radioNormalizeStations([...radioPresetMatches(radioState.query, radioState.country), ...data])
    }catch(error){
      lastError = error
    }
  }
  throw lastError || new Error("Nie udało się pobrać stacji.")
}

async function radioLoadStations(playFirst, forceRefresh){
  let loadRequestId = ++radioState.stationLoadRequestId
  radioSetStatus(forceRefresh ? "Odświeżanie stacji..." : "Ładowanie stacji...")
  try{
    let stations = await radioFetchStations(forceRefresh)
    if(loadRequestId !== radioState.stationLoadRequestId) return
    radioState.stations = stations
    radioRenderStations()
    let label = radioState.query || radioState.country || "wybranego świata"
    radioSetStatus(`${forceRefresh ? "Odświeżono" : "Znaleziono"} ${radioState.stations.length} stacji dla: ${label}.`)
    if(playFirst && radioState.stations[0]){
      await radioPlayStation(radioState.stations[0].stationuuid)
    }
  }catch(error){
    if(loadRequestId !== radioState.stationLoadRequestId) return
    document.getElementById("radioStations").innerHTML = `<div class="radio-empty">Nie udało się pobrać stacji. Sprawdź internet i kliknij Odśwież.</div>`
    radioSetStatus("Problem z katalogiem stacji.")
  }
}

function radioRenderStations(){
  let list = document.getElementById("radioStations")
  if(!radioState.stations.length){
    list.innerHTML = `<div class="radio-empty">Brak wyników. Spróbuj innej nazwy albo kraju.</div>`
    return
  }
  list.innerHTML = radioState.stations.map(station => {
    let active = radioState.current && radioState.current.stationuuid === station.stationuuid
    let art = radioStationArtwork(station, true)
    let logo = art ? `<img src="${radioEscape(art)}" alt="" onerror="this.replaceWith(document.createTextNode('${radioFallbackIcon(station)}'))">` : `<span>${radioFallbackIcon(station)}</span>`
    return `<button class="radio-station ${active ? "active" : ""}" onclick="radioPlayStation('${station.stationuuid}')"><span class="station-logo">${logo}</span><span class="station-text"><b>${radioEscape(station.name)}</b><span>${radioEscape(radioStationLabel(station))}</span><span class="station-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span></button>`
  }).join("")
}

async function radioPlayStation(id){
  let station = radioState.stations.find(item => item.stationuuid === id)
  if(!station) return
  radioState.playRequestId += 1
  let requestId = radioState.playRequestId
  radioState.current = station
  document.getElementById("radioCurrentName").textContent = station.name
  document.getElementById("radioCurrentMeta").textContent = radioStationLabel(station)
  radioUpdateArtwork(station)
  radioRenderStations()

  if(radioHasCastSession()){
    await radioPlayStationOnCast(requestId)
    return
  }

  await radioPlayStationLocal(station, requestId)
}

async function radioPlayStationLocal(station, requestId, useFallbackUrl){
  let audio = radioAudio()
  if(!audio) return

  radioPrepareAudio()
  radioState.casting = false
  radioState.playing = false
  radioState.wantsPlay = true
  radioSetPlayButton()
  radioClearBufferTimer()
  radioSetStatus(`Łączenie i buforowanie: ${station.name}`)

  let streamUrl = useFallbackUrl && station.url ? station.url : (station.url_resolved || station.url)
  audio.pause()
  audio.removeAttribute("src")
  audio.load()
  audio.src = streamUrl
  audio.volume = radioState.volume
  audio.load()

  radioState.bufferTimer = setTimeout(() => {
    if(radioState.playRequestId === requestId && !radioState.playing && radioState.current === station){
      radioSetStatus("Stream jeszcze buforuje. Niektóre stacje startują po kilku sekundach.")
    }
  }, 4500)

  try{
    await audio.play()
  }catch(error){
    if(!useFallbackUrl && station.url && station.url_resolved && station.url !== station.url_resolved){
      await radioPlayStationLocal(station, requestId, true)
      return
    }
    radioClearBufferTimer()
    radioState.playing = false
    radioState.wantsPlay = false
    radioSetStatus("Przeglądarka zablokowała odtwarzanie albo stream nie odpowiada. Dotknij stację jeszcze raz.")
  }
  radioSetPlayButton()
}

async function radioPlayStationOnCast(requestId){
  let session = radioCurrentCastSession()
  if(!session || !radioState.current) return

  radioClearBufferTimer()
  radioStopLocalAudio()
  radioSetStatus(`Wysyłam na Cast: ${radioState.current.name}`)

  try{
    await radioLoadCastMedia(session)
    await radioApplyCastVolume()
    if(radioState.playRequestId === requestId){
      radioState.casting = true
      radioState.playing = true
      radioSetPlayButton()
      radioRenderStations()
      radioSetStatus(`Gra na Cast: ${radioState.current.name}`)
    }
  }catch(error){
    if(radioState.playRequestId === requestId){
      radioState.casting = false
      radioState.playing = false
      radioSetPlayButton()
      radioSetStatus("Cast nie przyjął tego streamu. Spróbuj inną stację albo uruchom lokalnie.")
    }
  }
}

async function radioTogglePlay(){
  let audio = radioAudio()
  if(!radioState.current){
    if(radioState.stations[0]) radioPlayStation(radioState.stations[0].stationuuid)
    return
  }
  if(radioHasCastSession()){
    radioSetStatus("Sterowanie pauzą Cast bywa ograniczone. Użyj Stop albo wybierz inną stację.")
    return
  }
  if(audio.paused){
    radioState.wantsPlay = true
    try{
      await audio.play()
      radioState.playing = true
    }catch(error){
      radioState.wantsPlay = false
      radioSetStatus("Nie mogę wznowić streamu. Wybierz stację ponownie.")
    }
  }else{
    radioState.wantsPlay = false
    audio.pause()
    radioState.playing = false
  }
  radioSetPlayButton()
  radioRenderStations()
}

function radioStop(){
  radioClearBufferTimer()
  radioStopCastMedia()
  radioStopLocalAudio()
  radioState.current = null
  radioState.playing = false
  radioState.casting = false
  radioState.wantsPlay = false
  document.getElementById("radioCurrentName").textContent = "Wybierz stację"
  document.getElementById("radioCurrentMeta").textContent = "Odtwarzanie zatrzymane."
  radioUpdateArtwork(null)
  radioSetPlayButton()
  radioRenderStations()
}

function radioStopCastMedia(){
  let session = radioCurrentCastSession()
  if(!session) return

  try{
    let media = typeof session.getMediaSession === "function" ? session.getMediaSession() : null
    if(media && typeof media.stop === "function"){
      media.stop(new chrome.cast.media.StopRequest(), () => {}, () => {})
    }
  }catch(error){}
}

async function radioCast(){
  if(!radioState.current){
    if(radioState.stations[0]){
      radioState.current = radioState.stations[0]
      document.getElementById("radioCurrentName").textContent = radioState.current.name
      document.getElementById("radioCurrentMeta").textContent = radioStationLabel(radioState.current)
      radioUpdateArtwork(radioState.current)
      radioRenderStations()
    }else{
      return radioSetStatus("Najpierw wybierz stację.")
    }
  }
  if(!radioState.castReady) radioInitializeCastApi()
  if(!radioState.castReady || !window.cast || !window.chrome || !chrome.cast){
    return radioSetStatus("Cast nie jest dostępny w tej przeglądarce. Spróbuj w Chrome na Androidzie lub Chrome na komputerze.")
  }
  try{
    radioSetStatus("Wybierz urządzenie Cast z listy.")
    let context = cast.framework.CastContext.getInstance()
    let session = context.getCurrentSession() || await context.requestSession()
    await radioLoadCastMedia(session)
    await radioApplyCastVolume()
    radioStopLocalAudio()
    radioState.casting = true
    radioState.playing = true
    radioSetPlayButton()
    radioRenderStations()
    radioSetStatus(`Gra na Cast: ${radioState.current.name}`)
  }catch(error){
    radioState.casting = false
    radioState.playing = false
    radioSetPlayButton()
    radioSetStatus("Cast anulowany albo urządzenie nie przyjęło tego streamu.")
  }
}

function radioCastContentType(station){
  let codec = String(station.codec || "").toLowerCase()
  let url = String(station.url_resolved || station.url || "").toLowerCase()
  if(Number(station.hls) === 1 || url.includes(".m3u8")) return "application/x-mpegURL"
  if(codec.includes("aac") || url.includes(".aac")) return "audio/aac"
  if(codec.includes("ogg") || url.includes(".ogg")) return "audio/ogg"
  if(codec.includes("opus") || url.includes(".opus")) return "audio/ogg"
  if(codec.includes("flac") || url.includes(".flac")) return "audio/flac"
  if(codec.includes("wav") || url.includes(".wav")) return "audio/wav"
  return "audio/mpeg"
}

function radioLoadCastMedia(session){
  let station = radioState.current
  let mediaInfo = new chrome.cast.media.MediaInfo(station.url_resolved || station.url, radioCastContentType(station))
  mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata()
  mediaInfo.metadata.title = station.name
  mediaInfo.metadata.artist = radioStationLabel(station)
  mediaInfo.metadata.images = [new chrome.cast.Image(radioStationArtwork(station, true, true))]
  mediaInfo.streamType = chrome.cast.media.StreamType.LIVE
  let request = new chrome.cast.media.LoadRequest(mediaInfo)
  request.autoplay = true
  request.currentTime = 0
  return session.loadMedia(request)
}

function radioSetCountry(country){
  radioState.country = country
  radioSyncCountryButtons()
  radioLoadStations()
}

function radioSyncCountryButtons(){
  let ids = {PL:"radioCountryPL",SE:"radioCountrySE","":"radioCountryOther"}
  Object.entries(ids).forEach(([country,id]) => {
    document.getElementById(id).classList.toggle("active", radioState.country === country)
  })
}

let radioSearchTimer = null
function radioSearchChanged(value){
  radioState.query = value
  clearTimeout(radioSearchTimer)
  radioSearchTimer = setTimeout(radioLoadStations, 350)
}

function radioQuick(query,country){
  radioState.query = query
  radioState.country = country
  document.getElementById("radioSearch").value = query
  radioSyncCountryButtons()
  let preset = radioPresetMatches(query, country)[0]
  if(preset){
    radioState.stationLoadRequestId += 1
    radioState.stations = radioNormalizeStations([preset, ...radioState.stations])
    radioRenderStations()
    radioPlayStation(preset.stationuuid)
    return
  }
  radioLoadStations(true)
}

radioPrepareAudio()
radioApplyVolume()
radioLoadStations()

if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
  })
}
