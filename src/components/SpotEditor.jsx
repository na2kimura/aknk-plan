import { GREEN, SI } from "../constants";

export default function SpotEditor({ spots, onUpdate, onGeocode, onAdd, onRemove, onMove }) {
  return (
    <div style={{width:"100%",minWidth:0}}>
      {spots.map((spot,i) => (
        <div key={spot.id} style={{background:"#f9f9f9",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid #eee"}}>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
            <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
              <button onClick={()=>onMove(i,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?"#ddd":"#aaa",cursor:i===0?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▲</button>
              <button onClick={()=>onMove(i,1)} disabled={i===spots.length-1} style={{background:"none",border:"none",color:i===spots.length-1?"#ddd":"#aaa",cursor:i===spots.length-1?"default":"pointer",padding:"0 2px",fontSize:12,lineHeight:1}}>▼</button>
            </div>
            <span style={{background:GREEN,color:"#fff",borderRadius:"50%",width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
            <input value={spot.name} placeholder="場所名（例: 近江町市場）" onChange={e=>onUpdate(spot.id,"name",e.target.value)} style={{...SI,flex:1}}/>
            {spots.length>1 && <button onClick={()=>onRemove(spot.id)} style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,flexShrink:0}}>×</button>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",paddingLeft:32}}>
            <input value={spot.address||""} placeholder="住所を入力すると地図にピンが立ちます" onChange={e=>onUpdate(spot.id,"address",e.target.value)} style={{...SI,flex:1}}/>
            <button onClick={()=>onGeocode(spot.id, spot.address||spot.name)} disabled={spot.searching||!spot.name}
              style={{padding:"7px 10px",borderRadius:7,border:"none",background:GREEN,color:"#fff",fontSize:12,cursor:(spot.searching||!spot.name)?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0,opacity:(spot.searching||!spot.name)?0.5:1}}>
              {spot.searching ? "検索中…" : spot.lat ? "再取得" : "地図取得"}
            </button>
          </div>
          {spot.lat && <p style={{margin:"4px 0 0",fontSize:11,color:GREEN,paddingLeft:32}}>✓ 取得済</p>}
          {spot.geoError && !spot.lat && <p style={{margin:"4px 0 0",fontSize:11,color:"#E24B4A",paddingLeft:32}}>取得できませんでした。住所を入力して再度お試しください。</p>}
        </div>
      ))}
      <button onClick={onAdd} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer",marginTop:2}}>+ 場所を追加</button>
    </div>
  );
}
