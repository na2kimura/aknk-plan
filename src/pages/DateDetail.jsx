import { GREEN, CS, fmt, totalOf, paidByUser, itemLabel, toDisplayUser, USER_COLORS } from "../constants";
import SpotMap from "../components/SpotMap";

export default function DateDetail({ selDate, setSelDateId, openEditDate, deleteDate, setShowBulk, setPhotoView }) {
  return (
    <div style={{padding:"1rem"}}>
      <button onClick={()=>setSelDateId(null)} style={{fontSize:13,color:"#888",background:"none",border:"none",cursor:"pointer",marginBottom:10,padding:0}}>← 一覧に戻る</button>
      <div style={CS}>
        <p style={{margin:"0 0 6px",fontWeight:700,fontSize:17}}>{selDate.title}</p>
        <p style={{margin:"0 0 6px",fontSize:13,color:"#888"}}>{selDate.date}</p>
        {selDate.memo&&<div style={{background:"#f7f7f7",borderRadius:8,padding:"8px 12px",fontSize:14}}>{selDate.memo}</div>}
      </div>
      {(selDate.photos||[]).length>0&&(
        <div style={{marginBottom:12}}>
          <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>写真</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
            {selDate.photos.map(p=><div key={p.id} onClick={()=>setPhotoView(p.url)} style={{aspectRatio:"1",borderRadius:8,overflow:"hidden",border:"1px solid #eee",cursor:"pointer"}}><img src={p.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>)}
          </div>
        </div>
      )}
      {(selDate.spots||[]).filter(s=>s.name).length>0&&(
        <div style={{marginBottom:12}}>
          <p style={{fontWeight:700,fontSize:14,marginBottom:8}}>訪れた場所</p>
          <SpotMap spots={selDate.spots.filter(s=>s.name)}/>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <p style={{margin:0,fontWeight:700,fontSize:14}}>費用明細</p>
        <button onClick={()=>setShowBulk(true)} style={{fontSize:12,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 一括入力</button>
      </div>
      <div style={CS}>
        {(selDate.items||[]).map((item,i)=>{
          const displayUser = toDisplayUser(item.paidBy);
          return (
            <div key={item.id||i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"4px 12px",padding:"7px 0",borderBottom:i<selDate.items.length-1?"1px solid #f0f0f0":"none",alignItems:"center"}}>
              <span style={{fontSize:14}}>{itemLabel(item)}</span>
              <span style={{fontSize:11,padding:"1px 7px",borderRadius:20,background:(USER_COLORS[displayUser]||"#888")+"22",color:USER_COLORS[displayUser]||"#888",whiteSpace:"nowrap"}}>{displayUser}</span>
              <span style={{fontWeight:500,fontSize:14,textAlign:"right"}}>{fmt(item.amount)}</span>
            </div>
          );
        })}
        <div style={{paddingTop:10,marginTop:6,borderTop:"2px solid #eee"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:16,marginBottom:6}}><span>合計</span><span style={{color:GREEN}}>{fmt(totalOf(selDate.items||[]))}</span></div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {["Nk","Ak"].map(u=>{const t=paidByUser(selDate.items||[],u);return t>0?<span key={u} style={{fontSize:12,color:USER_COLORS[u]}}>{u}: {fmt(t)}</span>:null;})}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:"0.5rem"}}>
        <button onClick={()=>openEditDate(selDate)} style={{flex:1,padding:"12px",borderRadius:10,border:"1px solid #ddd",background:"#fff",color:"#555",fontWeight:700,fontSize:14,cursor:"pointer"}}>編集する</button>
        <button onClick={()=>deleteDate(selDate.id)} style={{padding:"12px 16px",borderRadius:10,border:"1px solid #ffcccc",background:"#fff8f8",color:"#E24B4A",fontWeight:700,fontSize:14,cursor:"pointer"}}>削除</button>
      </div>
    </div>
  );
}
