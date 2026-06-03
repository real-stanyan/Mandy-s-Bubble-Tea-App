import { forwardRef, useImperativeHandle, useRef } from 'react'
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
}

export type TrackingMapHandle = { update: (t: Tracking) => void }

const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;background:#E8E5DE}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var PRIMARY=${JSON.stringify(BRAND.color)};
var map=L.map('map',{zoomControl:false,scrollWheelZoom:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
function pin(emoji,ring){return L.divIcon({className:'',iconSize:[34,34],iconAnchor:[17,17],
  html:'<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#fff;border:2px solid '+ring+';box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:18px;line-height:1">'+emoji+'</div>'});}
var storeM=null,destM=null,driverM=null,anim=null,cur={};
function pts(){var a=[[cur.storeLat,cur.storeLng]];
  if(cur.destLat!=null&&cur.destLng!=null)a.push([cur.destLat,cur.destLng]);
  if(cur.driverLat!=null&&cur.driverLng!=null)a.push([cur.driverLat,cur.driverLng]);return a;}
function fit(){var p=pts();if(p.length===1){map.setView(p[0],15);return;}
  var h=map.getSize().y||600,bp=Math.min(240,Math.round(h*0.38));
  map.fitBounds(L.latLngBounds(p).pad(0.3),{maxZoom:16,paddingTopLeft:[30,40],paddingBottomRight:[30,bp]});}
window.updateTracking=function(t){
  cur=t;
  if(!storeM){storeM=L.marker([t.storeLat,t.storeLng],{icon:pin('🧋',PRIMARY)}).addTo(map).bindTooltip("Mandy's");}
  if(t.destLat!=null&&t.destLng!=null&&!destM){destM=L.marker([t.destLat,t.destLng],{icon:pin('🏠','#5B7A52')}).addTo(map).bindTooltip('Your address');}
  if(t.driverLat!=null&&t.driverLng!=null){
    var target=[t.driverLat,t.driverLng];
    if(!driverM){driverM=L.marker(target,{icon:pin('🛵',PRIMARY),zIndexOffset:1000}).addTo(map).bindTooltip('Driver');fit();}
    else{var s=driverM.getLatLng(),f=[s.lat,s.lng],t0=Date.now();
      if(anim)cancelAnimationFrame(anim);
      (function step(){var p=Math.min(1,(Date.now()-t0)/900);
        driverM.setLatLng([f[0]+(target[0]-f[0])*p,f[1]+(target[1]-f[1])*p]);
        if(p<1)anim=requestAnimationFrame(step);else fit();})();}
  } else { fit(); }
  setTimeout(function(){map.invalidateSize();fit();},50);
};
</script></body></html>`

export const TrackingMap = forwardRef<TrackingMapHandle, { initial: Tracking }>(
  function TrackingMap({ initial }, ref) {
    const webRef = useRef<WebView>(null)
    const inject = (t: Tracking) => {
      webRef.current?.injectJavaScript(`window.updateTracking(${JSON.stringify(t)});true;`)
    }
    useImperativeHandle(ref, () => ({ update: inject }), [])
    return (
      <View style={styles.fill}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: HTML }}
          onLoadEnd={() => inject(initial)}
          style={styles.fill}
          scrollEnabled={false}
        />
      </View>
    )
  },
)

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#E8E5DE' } })
