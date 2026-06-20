const {onRequest} = require("firebase-functions/v2/https")
const {setGlobalOptions} = require("firebase-functions/v2")

setGlobalOptions({
  region:"europe-west1",
  maxInstances:2,
  memory:"128MiB",
  timeoutSeconds:10
})

const cache = {
  expires:0,
  data:null
}

const allowedOrigins = new Set([
  "https://radio4nesthub.web.app",
  "https://lexikonsv-pl.web.app",
  "http://127.0.0.1:8765",
  "http://localhost:8765"
])

function cleanText(value){
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function currentTrack(items){
  if(!Array.isArray(items)) return null
  return items.find(item => Number(item.order) === 0) ||
    items.find(item => Number(item.uptime) >= 0) ||
    items[0] ||
    null
}

function formatTrack(track, program){
  if(!track) return {
    station:"RMF Classic",
    provider:"rmfon",
    program,
    title:program || "RMF Classic",
    artist:"RMF Classic",
    album:"",
    image:"",
    line:program ? `Audycja: ${program}` : "RMF Classic"
  }

  const artist = cleanText(track.author)
  const title = cleanText(track.title)
  const album = cleanText(track.recordTitle)
  const image = cleanText(track.coverBigUrl || track.coverUrl)
  const main = artist && title ? `${artist} - ${title}` : (title || artist || "RMF Classic")
  const line = [
    `Utwór: ${main}`,
    album ? `Film/album: ${album}` : "",
    program ? `Audycja: ${program}` : ""
  ].filter(Boolean).join(" • ")

  return {
    station:"RMF Classic",
    provider:"rmfon",
    program,
    title:title || main,
    artist:artist || "RMF Classic",
    album,
    image,
    line
  }
}

async function fetchJson(url){
  const response = await fetch(url, {
    headers:{
      "Accept":"application/json",
      "User-Agent":"radio4nesthub-rds/1.0"
    }
  })
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function fetchText(url){
  const response = await fetch(url, {
    headers:{
      "Accept":"text/html",
      "User-Agent":"radio4nesthub-rds/1.0"
    }
  })
  if(!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function fetchRmfProgram(){
  try{
    const html = await fetchText("https://www.rmfclassic.pl/")
    const match = html.match(/Teraz na antenie RMF Classic:\s*([^"]+)/i)
    return cleanText(match && match[1])
  }catch(error){
    return ""
  }
}

async function loadRmfClassicRds(){
  const [playlist, program] = await Promise.all([
    fetchJson("https://api.rmfon.pl/stations/7/playlist"),
    fetchRmfProgram()
  ])
  return {
    ...formatTrack(currentTrack(playlist), program),
    fetchedAt:new Date().toISOString()
  }
}

function setCors(req, res){
  const origin = req.get("origin")
  if(origin && allowedOrigins.has(origin)){
    res.set("Access-Control-Allow-Origin", origin)
    res.set("Vary", "Origin")
  }
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type")
}

exports.rmfClassicRds = onRequest({invoker:"public"}, async (req, res) => {
  setCors(req, res)

  if(req.method === "OPTIONS"){
    res.status(204).send("")
    return
  }

  if(req.method !== "GET"){
    res.status(405).json({error:"Method not allowed"})
    return
  }

  res.set("Cache-Control", "public, max-age=20, s-maxage=30")

  const now = Date.now()
  if(cache.data && cache.expires > now){
    res.json(cache.data)
    return
  }

  try{
    const data = await loadRmfClassicRds()
    cache.data = data
    cache.expires = now + 30000
    res.json(data)
  }catch(error){
    if(cache.data){
      res.json({...cache.data, stale:true})
      return
    }
    res.status(502).json({
      error:"RMF Classic RDS unavailable",
      station:"RMF Classic",
      title:"RMF Classic",
      artist:"RMF Classic",
      album:"",
      image:"",
      line:"RMF Classic"
    })
  }
})
