import { GREEN, CS, SI, fmt, totalOf, ALL_MONTHS } from "../constants";

export default function DateList({ filtered, filterYear, filterMonth, allYears, setFilterYear, setFilterMonth, setSelDateId, openAddDate }) {
  return (
    <div style={{padding:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <p style={{margin:0,fontWeight:700}}>デート記録</p>
        <button onClick={openAddDate} style={{fontSize:13,padding:"4px 12px",borderRadius:20,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>+ 追加</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <select value={filterYear}  onChange={e=>setFilterYear(e.target.value)}  style={{flex:1,...SI}}>{allYears.map(y=><option key={y}>{y}</option>)}</select>
        <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{flex:1,...SI}}>{ALL_MONTHS.map(m=><option key={m}>{m}</option>)}</select>
        {(filterYear!=="すべて"||filterMonth!=="すべて")&&<button onClick={()=>{setFilterYear("すべて");setFilterMonth("すべて");}} style={{fontSize:12,padding:"6px 10px",borderRadius:8,border:"1px solid #ddd",background:"transparent",cursor:"pointer"}}>リセット</button>}
      </div>
      {filtered.length===0&&<p style={{color:"#aaa",fontSize:14,textAlign:"center",padding:"1rem"}}>記録がありません</p>}
      {filtered.map(d=>(
        <div key={d.id} onClick={()=>setSelDateId(d.id)} style={{...CS,cursor:"pointer"}}>
          {d.photos?.length>0&&<div style={{display:"flex",gap:4,marginBottom:8}}>{d.photos.slice(0,4).map(p=><img key={p.id} src={p.url} alt="" style={{width:56,height:56,borderRadius:6,objectFit:"cover",flexShrink:0}}/>)}</div>}
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><p style={{margin:0,fontWeight:700,fontSize:15}}>{d.title}</p><span style={{fontWeight:700,color:GREEN}}>{fmt(totalOf(d.items||[]))}</span></div>
          <p style={{margin:0,fontSize:12,color:"#888"}}>{d.date}{(d.spots||[]).length>0?` · ${d.spots.length}ヶ所`:""}{ (d.photos||[]).length>0?` · 写真${d.photos.length}枚`:""}</p>
        </div>
      ))}
    </div>
  );
}
