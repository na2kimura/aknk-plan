import { useRef, useEffect } from "react";
import { GREEN } from "../constants";

export default function SpotMap({ spots }) {
  const ref = useRef(null), inst = useRef(null);
  const allNamed = spots.filter(s => s.name);
  const withCoords = spots.filter(s => s.lat && s.lng && s.name);

  useEffect(() => {
    if (!ref.current || !withCoords.length) return;
    const init = () => {
      try {
        if (inst.current) { inst.current.remove(); inst.current = null; }
        if (!ref.current) return;
        ref.current._leaflet_id = null;
        const L = window.L;
        const cx = withCoords.length === 1
          ? [withCoords[0].lat, withCoords[0].lng]
          : [withCoords.reduce((s,sp)=>s+Number(sp.lat),0)/withCoords.length, withCoords.reduce((s,sp)=>s+Number(sp.lng),0)/withCoords.length];
        const map = L.map(ref.current).setView(cx, withCoords.length===1?15:13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OSM"}).addTo(map);
        withCoords.forEach((sp) => {
          const idx = allNamed.findIndex(s => s.id === sp.id || s.name === sp.name);
          const num = idx >= 0 ? idx + 1 : "•";
          const icon = L.divIcon({ html:`<div style="background:${GREEN};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)">${num}</div>`, className:"", iconSize:[28,28], iconAnchor:[14,14] });
          const gmapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sp.address||sp.name)}`;
          L.marker([Number(sp.lat),Number(sp.lng)],{icon}).addTo(map)
           .bindPopup(`<b>${sp.name}</b><br><a href="${gmapUrl}" target="_blank" style="color:${GREEN};font-size:12px">Googleマップで開く</a>`);
        });
        if (withCoords.length > 1) map.fitBounds(L.latLngBounds(withCoords.map(sp=>[Number(sp.lat),Number(sp.lng)])),{padding:[30,30]});
        inst.current = map;
      } catch(e) { console.error("Map init error:", e); }
    };
    if (!document.getElementById("lf-css")) { const lk=document.createElement("link");lk.id="lf-css";lk.rel="stylesheet";lk.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(lk); }
    window.L ? init() : (() => { if (!document.getElementById("lf-js")) { const sc=document.createElement("script");sc.id="lf-js";sc.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";sc.onload=()=>setTimeout(init,50);document.head.appendChild(sc); } else setTimeout(init,200); })();
    return () => { try { if (inst.current) { inst.current.remove(); inst.current=null; } } catch(e){} };
  }, [JSON.stringify(withCoords)]);

  if (!allNamed.length) return null;

  const toQuery = (sp) => encodeURIComponent(sp.address || sp.name);
  const routeUrl = allNamed.length === 1
    ? `https://www.google.com/maps/search/?api=1&query=${toQuery(allNamed[0])}`
    : `https://www.google.com/maps/dir/${allNamed.map(toQuery).join("/")}`;

  return (
    <div>
      {withCoords.length > 0 && (
        <div ref={ref} style={{width:"100%",height:220,borderRadius:10,overflow:"hidden",border:"1px solid #eee",marginBottom:8}}/>
      )}
      <a href={routeUrl} target="_blank" rel="noreferrer"
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"9px",borderRadius:10,background:"#e8f5f0",border:`1px solid ${GREEN}33`,color:GREEN,fontWeight:700,fontSize:13,textDecoration:"none",marginBottom:8,boxSizing:"border-box"}}>
        <span>🗺️</span>
        <span>{allNamed.length === 1 ? "Googleマップで開く" : `${allNamed.length}ヶ所のルートをGoogleマップで開く`}</span>
      </a>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {allNamed.map((sp,i) => (
          <a key={i} href={`https://www.google.com/maps/search/?api=1&query=${toQuery(sp)}`} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#333",textDecoration:"none",padding:"5px 8px",borderRadius:7,background:"#f7f7f7"}}>
            <span style={{background:sp.lat?GREEN:"#bbb",color:"#fff",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
            <span style={{flex:1}}>{sp.name}</span>
            <span style={{fontSize:11,color:GREEN}}>Gマップ</span>
          </a>
        ))}
      </div>
    </div>
  );
}
