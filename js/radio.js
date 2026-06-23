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
const radioRmfClassicRdsUrl = `${radioHostedOrigin}/api/rds/rmf-classic`
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
  bufferTimer:null,
  castStartTimer:null,
  nowPlayingTimer:null,
  nowPlayingRequestId:0,
  nowPlaying:null,
  castResetting:false
}

function radioInitializeCastApi(force){
  if(!window.cast || !window.chrome || !chrome.cast) return
  if(radioState.castReady && !force) return
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

function radioClearCastStartTimer(){
  if(radioState.castStartTimer){
    clearTimeout(radioState.castStartTimer)
    radioState.castStartTimer = null
  }
}

function radioQueueCastPlayback(delay){
  if(!radioState.current) return
  radioClearCastStartTimer()
  let station = radioState.current
  let requestId = ++radioState.playRequestId
  radioState.castStartTimer = setTimeout(() => {
    radioState.castStartTimer = null
    if(radioState.current !== station) return
    radioPlayStationOnCast(requestId)
  }, delay || 0)
}

function radioCastSessionChanged(event){
  if(radioState.castResetting) return

  let state = event && event.sessionState
  let started = state === cast.framework.SessionState.SESSION_STARTED || state === cast.framework.SessionState.SESSION_RESUMED
  let ended = state === cast.framework.SessionState.SESSION_ENDED

  if(started){
    radioState.casting = true
    if(radioState.current){
      radioSetStatus("Połączono z Cast. Uruchamiam stację...")
      radioQueueCastPlayback(450)
    }else{
      radioSetStatus("Połączono z Cast.")
    }
  }

  if(ended){
    radioClearCastStartTimer()
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

function radioWait(ms){
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function radioLoadCastMediaWithRetry(session){
  try{
    return await radioLoadCastMedia(session)
  }catch(error){
    await radioWait(750)
    return radioLoadCastMedia(session)
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

function radioStationVisualKind(station){
  let name = radioNormalizeName(station && station.name)
  if(name.includes("rmf classic")) return "rmf-classic"
  return ""
}

function radioNowPlayingProvider(station){
  let srChannelId = radioSverigesRadioChannelId(station)
  if(srChannelId) return {type:"sr", channelId:srChannelId}
  if(radioStationVisualKind(station) === "rmf-classic") return {type:"rmfon", stationId:7}
  return null
}

function radioSverigesRadioChannelId(station){
  let name = radioNormalizeName(station && station.name)
  if(name.includes("p4 gotland")) return 205
  if(name.includes("p4 stockholm")) return 701
  if(name.includes("p2")) return 163
  if(name.includes("sveriges radio p1") || name.includes("sr p1")) return 132
  if(name.includes("sveriges radio p3") || name.includes("sr p3")) return 164
  return 0
}

function radioCleanNowPlayingText(value){
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function radioFormatRmfonNowPlaying(track){
  if(!track) return null
  let artist = radioCleanNowPlayingText(track.author)
  let title = radioCleanNowPlayingText(track.title)
  let album = radioCleanNowPlayingText(track.recordTitle)
  let main = artist && title ? `${artist} - ${title}` : (title || artist)
  if(!main) return null
  return {
    artist,
    title:title || main,
    album,
    image:radioCleanNowPlayingText(track.coverBigUrl || track.coverUrl),
    line:[`Utwór: ${main}`, album ? `Film/album: ${album}` : ""].filter(Boolean).join(" • ")
  }
}

function radioFormatProxyNowPlaying(data){
  if(!data) return null
  let artist = radioCleanNowPlayingText(data.artist)
  let title = radioCleanNowPlayingText(data.title)
  let album = radioCleanNowPlayingText(data.album)
  let image = radioCleanNowPlayingText(data.image)
  let line = radioCleanNowPlayingText(data.line)
  let main = artist && title ? `${artist} - ${title}` : (title || artist)
  if(!line && main){
    line = [`Utwór: ${main}`, album ? `Film/album: ${album}` : ""].filter(Boolean).join(" • ")
  }
  if(!line && !main) return null
  return {
    artist,
    title:title || main || "RMF Classic",
    album,
    image,
    line:line || main
  }
}

function radioPickCurrentRmfonTrack(items){
  if(!Array.isArray(items)) return null
  return items.find(item => Number(item.order) === 0) || items.find(item => Number(item.uptime) >= 0) || items[0] || null
}

async function radioRefreshNowPlayingForCast(station){
  if(!station) return
  try{
    let info = await Promise.race([
      radioFetchNowPlaying(station),
      radioWait(1400).then(() => null)
    ])
    if(info) radioApplyNowPlaying(station, info)
  }catch(error){}
}

function radioParseSrDate(value){
  let match = String(value || "").match(/\d+/)
  return match ? new Date(Number(match[0])) : null
}

function radioFormatSrTime(date){
  if(!date || Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("sv-SE", {hour:"2-digit", minute:"2-digit"})
}

function radioFormatSrTimeRange(item){
  let start = radioFormatSrTime(radioParseSrDate(item && (item.starttimeutc || item.starttime)))
  let end = radioFormatSrTime(radioParseSrDate(item && (item.endtimeutc || item.stoptimeutc || item.endtime)))
  return start && end ? `${start}-${end}` : ""
}

function radioFormatSrSong(song){
  if(!song) return null
  let title = radioCleanNowPlayingText(song.title)
  let artist = radioCleanNowPlayingText(song.artist || song.description)
  let composer = radioCleanNowPlayingText(song.composer)
  let album = radioCleanNowPlayingText(song.albumname)
  let main = artist && title ? `${artist} - ${title}` : (title || artist)
  if(!main) return null
  return {
    artist,
    title:title || main,
    album,
    line:[`Utwór: ${main}`, composer ? `Kompozytor: ${composer}` : "", album ? `Album: ${album}` : ""].filter(Boolean).join(" • ")
  }
}

function radioFormatSrSchedule(data){
  let episode = data && data.channel && data.channel.currentscheduledepisode
  if(!episode) return null
  let title = radioCleanNowPlayingText(episode.title)
  let subtitle = radioCleanNowPlayingText(episode.subtitle)
  let program = radioCleanNowPlayingText(episode.program && episode.program.name)
  let description = radioCleanNowPlayingText(episode.description)
  let time = radioFormatSrTimeRange(episode)
  let detail = [time, subtitle, program && program !== title ? program : "", description].filter(Boolean).join(" • ")
  if(!title && !detail) return null
  return {
    artist:program || "Sveriges Radio",
    title:title || program || "Audycja",
    album:time,
    image:radioCleanNowPlayingText(episode.socialimage),
    line:[`Audycja: ${title || program}`, detail].filter(Boolean).join(" • ")
  }
}

async function radioFetchSrNowPlaying(channelId){
  let songInfo = null
  try{
    let playlistResponse = await fetch(`https://api.sr.se/api/v2/playlists/rightnow?channelid=${channelId}&format=json&_=${Date.now()}`, {
      cache:"no-store",
      headers:{"Accept":"application/json"}
    })
    if(playlistResponse.ok){
      let playlistData = await playlistResponse.json()
      songInfo = radioFormatSrSong(playlistData && playlistData.playlist && playlistData.playlist.song)
    }
  }catch(error){}

  let scheduleInfo = null
  try{
    let scheduleResponse = await fetch(`https://api.sr.se/api/v2/scheduledepisodes/rightnow?channelid=${channelId}&format=json&_=${Date.now()}`, {
      cache:"no-store",
      headers:{"Accept":"application/json"}
    })
    if(!scheduleResponse.ok) throw new Error(`HTTP ${scheduleResponse.status}`)
    scheduleInfo = radioFormatSrSchedule(await scheduleResponse.json())
  }catch(error){
    if(!songInfo) throw error
  }

  if(songInfo && scheduleInfo){
    return {
      ...songInfo,
      image:scheduleInfo.image || songInfo.image,
      line:[songInfo.line, scheduleInfo.line].filter(Boolean).join(" • ")
    }
  }

  return songInfo || scheduleInfo
}

async function radioFetchNowPlaying(station){
  let provider = radioNowPlayingProvider(station)
  if(!provider) return null
  if(provider.type === "sr") return radioFetchSrNowPlaying(provider.channelId)
  if(provider.type === "rmfon"){
    try{
      let proxyResponse = await fetch(`${radioRmfClassicRdsUrl}?_=${Date.now()}`, {
        cache:"no-store",
        headers:{"Accept":"application/json"}
      })
      if(proxyResponse.ok){
        let proxyInfo = radioFormatProxyNowPlaying(await proxyResponse.json())
        if(proxyInfo) return proxyInfo
      }
    }catch(error){}

    let response = await fetch(`https://api.rmfon.pl/stations/${provider.stationId}/playlist?_=${Date.now()}`, {
      cache:"no-store",
      headers:{"Accept":"application/json"}
    })
    if(!response.ok) throw new Error(`HTTP ${response.status}`)
    return radioFormatRmfonNowPlaying(radioPickCurrentRmfonTrack(await response.json()))
  }
  return null
}

function radioSetCurrentMeta(text){
  let meta = document.getElementById("radioCurrentMeta")
  if(meta) meta.textContent = text
}

function radioApplyNowPlaying(station, info){
  if(!station || !radioState.current || radioState.current.stationuuid !== station.stationuuid) return
  radioState.nowPlaying = info || null
  radioSetCurrentMeta(info && info.line ? info.line : radioStationLabel(station))
}

function radioClearNowPlayingTimer(){
  if(radioState.nowPlayingTimer){
    clearInterval(radioState.nowPlayingTimer)
    radioState.nowPlayingTimer = null
  }
}

function radioStartNowPlaying(station){
  radioClearNowPlayingTimer()
  radioState.nowPlaying = null
  let requestId = ++radioState.nowPlayingRequestId
  radioSetCurrentMeta(radioStationLabel(station))
  if(!radioNowPlayingProvider(station)) return

  let update = () => {
    radioFetchNowPlaying(station).then(info => {
      if(requestId === radioState.nowPlayingRequestId) radioApplyNowPlaying(station, info)
    }).catch(() => {
      if(requestId === radioState.nowPlayingRequestId && !radioState.nowPlaying) radioSetCurrentMeta(radioStationLabel(station))
    })
  }

  update()
  radioState.nowPlayingTimer = setInterval(update, 30000)
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

function radioCastStationArtwork(station){
  if(radioStationVisualKind(station) === "rmf-classic"){
    return radioLocalArtworkUrl("rmf-classic-cast.png", true)
  }
  return radioStationArtwork(station, true, true)
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
  box.classList.toggle("rmf-classic-art", radioStationVisualKind(station) === "rmf-classic")

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
    let visual = radioStationVisualKind(station)
    return `<button class="radio-station ${active ? "active" : ""}" onclick="radioPlayStation('${station.stationuuid}')"><span class="station-logo ${visual ? `station-logo-${visual}` : ""}">${logo}</span><span class="station-text"><b>${radioEscape(station.name)}</b><span>${radioEscape(radioStationLabel(station))}</span><span class="station-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span></button>`
  }).join("")
}

async function radioPlayStation(id){
  let station = radioState.stations.find(item => item.stationuuid === id)
  if(!station) return
  radioState.playRequestId += 1
  let requestId = radioState.playRequestId
  radioState.current = station
  document.getElementById("radioCurrentName").textContent = station.name
  radioStartNowPlaying(station)
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
  radioSetStatus(`Pobieram opis dla Cast: ${radioState.current.name}`)
  await radioRefreshNowPlayingForCast(radioState.current)
  radioSetStatus(`Wysyłam na Cast: ${radioState.current.name}`)

  try{
    await radioLoadCastMediaWithRetry(session)
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
  radioClearCastStartTimer()
  radioClearNowPlayingTimer()
  radioStopCastMedia()
  radioStopLocalAudio()
  radioState.current = null
  radioState.playing = false
  radioState.casting = false
  radioState.wantsPlay = false
  radioState.nowPlaying = null
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
      radioStartNowPlaying(radioState.current)
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
    let session = context.getCurrentSession()
    if(session){
      radioQueueCastPlayback(0)
    }else{
      await context.requestSession()
      radioSetStatus("Łączę z Cast. Uruchamiam stację...")
      radioQueueCastPlayback(550)
    }
  }catch(error){
    radioState.casting = false
    radioState.playing = false
    radioClearCastStartTimer()
    radioSetPlayButton()
    radioSetStatus("Cast anulowany albo urządzenie nie przyjęło tego streamu.")
  }
}

async function radioResetCast(){
  radioSetStatus("Resetuję Cast...")
  radioState.castResetting = true
  radioClearCastStartTimer()

  try{
    if(window.cast && cast.framework){
      let context = cast.framework.CastContext.getInstance()
      let session = context.getCurrentSession()
      if(session){
        radioStopCastMedia()
        if(typeof context.endCurrentSession === "function"){
          context.endCurrentSession(true)
        }
      }
    }
  }catch(error){}

  radioState.casting = false
  radioState.playing = false
  radioState.castReady = false
  radioSetPlayButton()
  radioRenderStations()

  await radioWait(900)
  radioState.castResetting = false
  radioInitializeCastApi(true)

  if(radioState.castReady){
    radioSetStatus("Cast odświeżony. Kliknij Cast i wybierz Nest Hub ponownie.")
  }else{
    radioSetStatus("Cast jeszcze nie jest gotowy. Odczekaj chwilę albo odśwież stronę.")
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
  let nowPlaying = radioState.nowPlaying
  mediaInfo.metadata = new chrome.cast.media.MusicTrackMediaMetadata()
  mediaInfo.metadata.title = nowPlaying && nowPlaying.title ? nowPlaying.title : station.name
  mediaInfo.metadata.artist = nowPlaying && nowPlaying.artist ? nowPlaying.artist : radioStationLabel(station)
  if(nowPlaying && nowPlaying.album) mediaInfo.metadata.albumName = nowPlaying.album
  let image = radioStationVisualKind(station) === "rmf-classic"
    ? radioCastStationArtwork(station)
    : (nowPlaying && nowPlaying.image && nowPlaying.image.startsWith("https://") ? nowPlaying.image : radioCastStationArtwork(station))
  mediaInfo.metadata.images = [new chrome.cast.Image(image)]
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
