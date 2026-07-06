import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { BRAND } from '@/lib/constants'

export type Tracking = {
  destLat: number | null
  destLng: number | null
  storeLat: number
  storeLng: number
  driverLat: number | null
  driverLng: number | null
  driverHeading: number | null
  locationUpdatedAt: string | null
  // Driving route driver→destination ([lat, lng] points) + ETA seconds,
  // resolved server-side via Google Directions (cached on the dispatch row).
  route?: [number, number][] | null
  etaSeconds?: number | null
}

// `stale` (optional, backward compatible): the driver's GPS stream has
// dropped (see lib/delivery-freshness.ts). The map renders it honestly —
// semi-transparent amber driver pin + faded route — instead of presenting a
// dead position behind a live-looking pin.
export type TrackingUpdate = Tracking & { stale?: boolean }

export type TrackingMapHandle = { update: (t: TrackingUpdate) => void }

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;background:#E8E5DE}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var PRIMARY=${JSON.stringify(BRAND.color)};
var GREEN='#3CA96E',AMBER='#C9A227';
// Street-level zoom for the live-driver follow cam — close enough that the 🛵
// reads clearly (Uber-Eats style), wide enough to keep street context.
var DRIVER_ZOOM=16;
var map=L.map('map',{zoomControl:false,scrollWheelZoom:false});
// Minimal label-free basemap (CARTO light_nolabels) — a clean pale-grey canvas
// with no street/suburb names, so the only things the customer reads are our
// own pins (🧋 🏠 🛵) and the route. Default OSM tiles were too busy.
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  {attribution:'© OpenStreetMap © CARTO',subdomains:'abcd',maxZoom:20}).addTo(map);
function pin(emoji,ring){return L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],
  html:'<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#fff;border:2px solid '+ring+';box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:18px;line-height:1">'+emoji+'</div>'});}
// Driver pin: bigger, green ring + soft halo; stale flips it translucent amber.
function driverPin(stale){
  var ring=stale?AMBER:GREEN;
  var halo=stale?'rgba(201,162,39':'rgba(60,169,110';
  var op=stale?'opacity:.62;':'';
  return L.divIcon({className:'',iconSize:[40,40],iconAnchor:[20,20],
    html:'<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:#fff;border:2.5px solid '+ring+';'+op
      +'box-shadow:0 5px 12px rgba(42,30,20,.3),0 0 0 6px '+halo+',.16),0 0 0 13px '+halo+',.07);font-size:19px;line-height:1">🛵</div>'});}
var storeM=null,destM=null,driverM=null,doneL=null,restL=null,anim=null,cur={},lastStale=null;
// Bottom pixels obscured by an overlay sheet; -1 = not measured (use heuristic).
var bottomInset=-1;
window.setBottomInset=function(px){bottomInset=Math.max(0,Math.round(px));fit();};
function obscuredPx(){var h=map.getSize().y||600;
  if(bottomInset>=0)return Math.min(bottomInset,Math.round(h*0.45));
  return Math.min(240,Math.round(h*0.38));}
function fit(){
  if(cur.storeLat==null)return;
  var ob=obscuredPx();
  if(cur.driverLat!=null&&cur.driverLng!=null){
    // Follow cam: keep the 🛵 centred in the visible band above the sheet by
    // shifting the map centre DOWN half the obscured height (map is full-bleed
    // behind the sheet). Deliberately not fitting store/destination — the
    // customer's question is "where's my driver right now".
    var d=L.latLng(cur.driverLat,cur.driverLng);
    if(ob>0){var c=map.unproject(map.project(d,DRIVER_ZOOM).add(L.point(0,Math.round(ob/2))),DRIVER_ZOOM);
      map.setView(c,DRIVER_ZOOM,{animate:false});}
    else{map.setView(d,DRIVER_ZOOM,{animate:false});}
    return;}
  // Pre-pickup overview: store → destination.
  var p=[[cur.storeLat,cur.storeLng]];
  if(cur.destLat!=null&&cur.destLng!=null)p.push([cur.destLat,cur.destLng]);
  if(p.length===1){map.setView(p[0],15);return;}
  map.fitBounds(L.latLngBounds(p).pad(0.3),{maxZoom:16,paddingTopLeft:[30,40],paddingBottomRight:[30,ob]});}
function nearestIdx(route,lat,lng){var bi=0,bd=Infinity;
  for(var i=0;i<route.length;i++){var dx=route[i][0]-lat,dy=route[i][1]-lng,d=dx*dx+dy*dy;
    if(d<bd){bd=d;bi=i;}}return bi;}
// Two-segment route: the stretch already covered (route start → driver) as a
// solid brand line, the remaining leg (driver → destination) dotted. Split at
// the route point nearest the driver — simple projection, good enough at
// street zoom. Stale fades both segments.
function drawRoute(){
  var route=cur.route,stale=!!cur.stale;
  if(!route||route.length<2){
    if(doneL){map.removeLayer(doneL);doneL=null;}
    if(restL){map.removeLayer(restL);restL=null;}
    return;}
  var donePts=null,restPts=route;
  if(cur.driverLat!=null&&cur.driverLng!=null){
    var i=nearestIdx(route,cur.driverLat,cur.driverLng);
    donePts=route.slice(0,i+1);donePts.push([cur.driverLat,cur.driverLng]);
    restPts=[[cur.driverLat,cur.driverLng]].concat(route.slice(i+1));}
  if(donePts&&donePts.length>1){
    if(!doneL){doneL=L.polyline(donePts,{color:PRIMARY,weight:4.5,lineCap:'round',lineJoin:'round'}).addTo(map);}
    else{doneL.setLatLngs(donePts);}
    doneL.setStyle({opacity:stale?0.5:0.9});
  }else if(doneL){map.removeLayer(doneL);doneL=null;}
  if(restPts&&restPts.length>1){
    if(!restL){restL=L.polyline(restPts,{color:PRIMARY,weight:4,lineCap:'round',lineJoin:'round',dashArray:'1 10'}).addTo(map);}
    else{restL.setLatLngs(restPts);}
    restL.setStyle({opacity:stale?0.35:0.55});
  }else if(restL){map.removeLayer(restL);restL=null;}}
window.updateTracking=function(t){
  cur=t;
  var stale=!!t.stale;
  drawRoute();
  if(!storeM){storeM=L.marker([t.storeLat,t.storeLng],{icon:pin('🧋',PRIMARY)}).addTo(map).bindTooltip("Mandy's");}
  if(t.destLat!=null&&t.destLng!=null&&!destM){destM=L.marker([t.destLat,t.destLng],{icon:pin('🏠','#5B7A52')}).addTo(map).bindTooltip('Your address');}
  if(t.driverLat!=null&&t.driverLng!=null){
    var target=[t.driverLat,t.driverLng];
    if(!driverM){driverM=L.marker(target,{icon:driverPin(stale),zIndexOffset:1000}).addTo(map).bindTooltip('Driver');lastStale=stale;fit();}
    else{
      if(stale!==lastStale){driverM.setIcon(driverPin(stale));lastStale=stale;}
      var s=driverM.getLatLng(),f=[s.lat,s.lng],t0=Date.now();
      if(anim)cancelAnimationFrame(anim);
      (function step(){var p=Math.min(1,(Date.now()-t0)/900);
        driverM.setLatLng([f[0]+(target[0]-f[0])*p,f[1]+(target[1]-f[1])*p]);
        if(p<1)anim=requestAnimationFrame(step);else fit();})();}
  } else { fit(); }
  setTimeout(function(){map.invalidateSize();fit();},50);
};
</script></body></html>`

export const TrackingMap = forwardRef<
  TrackingMapHandle,
  { initial: TrackingUpdate; bottomInset?: number }
>(function TrackingMap({ initial, bottomInset }, ref) {
  const webRef = useRef<WebView>(null)
  const initialRef = useRef(initial)
  initialRef.current = initial
  const insetRef = useRef(bottomInset)
  insetRef.current = bottomInset
  const inject = (t: TrackingUpdate) => {
    webRef.current?.injectJavaScript(`window.updateTracking(${JSON.stringify(t)});true;`)
  }
  const injectInset = (px: number) => {
    webRef.current?.injectJavaScript(`window.setBottomInset(${JSON.stringify(px)});true;`)
  }
  useImperativeHandle(ref, () => ({ update: inject }), [])
  // The sheet height is only known after its first layout pass — push the
  // measured inset through whenever it changes so the follow cam recentres
  // the driver into the visible band above the sheet.
  useEffect(() => {
    if (bottomInset != null) injectInset(bottomInset)
  }, [bottomInset])
  return (
    <View style={styles.fill}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html: HTML }}
        onLoadEnd={() => {
          if (insetRef.current != null) injectInset(insetRef.current)
          inject(initialRef.current)
        }}
        style={styles.fill}
        scrollEnabled={false}
      />
    </View>
  )
})

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#E8E5DE' } })
