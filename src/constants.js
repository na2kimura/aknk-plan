export const GREEN = "#1D9E75";
export const USERS = ["Nk", "Ak"];
export const EXPENSE_CATS = ["飛行機", "電車", "その他交通費", "食事", "宿泊", "体験", "その他"];
export const TRANSPORT_CATS = ["飛行機", "電車", "その他交通費"];
export const USER_COLORS = { Nk: "#D4537E", Ak: "#378ADD", Natsuki: "#D4537E", Akira: "#378ADD" };
export const EMAIL_TO_USER = {
  "na2kimu@gmail.com": "Nk",
  "marcosmini1@gmail.com": "Ak",
};
export const getUserName = (email) => EMAIL_TO_USER[email] || "Nk";
export const getPartnerName = (myName) => myName === "Nk" ? "Ak" : "Nk";
export const toDisplayUser = (u) => {
  if (!u) return u;
  const s = String(u).trim();
  if (s === "Natsuki" || s.toUpperCase() === "NK") return "Nk";
  if (s === "Akira"   || s.toUpperCase() === "AK") return "Ak";
  return s;
};
export const SCHEDULE_CATS = ["移動（行き）", "移動（帰り）", "場所・観光", "食事", "宿泊", "体験", "休憩", "その他"];

export const makeRow   = (id) => ({ id, cat: "食事", note: "", amount: "", paidBy: "Nk" });
export const makeSpot  = (id) => ({ id, name: "", address: "", lat: "", lng: "" });
export const makeSched = (id) => ({ id, cat: "食事", content: "", budget: "", time: "", place: "", address: "", lat: "", lng: "", dayOffset: 0, natsuki: { time: "", from: "", budget: "" }, akira: { time: "", from: "", budget: "" } });

export const isTransport    = (cat) => cat === "移動（行き）" || cat === "移動（帰り）";
export const isReturn       = (cat) => cat === "移動（帰り）";
export const isTransportCat = (cat) => TRANSPORT_CATS.includes(cat);

export const totalOf    = (items) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
export const budgetOf   = (rows)  => rows.reduce((s, r) => isTransport(r.cat) ? s + (Number(r.natsuki?.budget)||0) + (Number(r.akira?.budget)||0) : s + (Number(r.budget)||0), 0);
export const paidByUser = (items, u) => items.filter(i => toDisplayUser(i.paidBy) === u).reduce((s, i) => s + (Number(i.amount)||0), 0);
export const fmt        = (n) => `¥${Number(n).toLocaleString()}`;
export const getYM      = (d) => d.slice(0, 7);
export const getY       = (d) => d.slice(0, 4);
export const itemLabel  = (item) => item.cat === "その他" && item.note ? item.note : item.cat + (item.note && item.cat !== "その他" ? `（${item.note}）` : "");
export const planSpots  = (plan) => (plan.schedule||[])
  .filter(s => !isTransport(s.cat) && (s.place||s.content))
  .map((s,i) => ({id:s.id||i, name:s.place||s.content||"スポット", address:s.address||"", lat:s.lat||"", lng:s.lng||""}));

export const ALL_YEARS  = ["すべて"];
export const ALL_MONTHS = ["すべて","01月","02月","03月","04月","05月","06月","07月","08月","09月","10月","11月","12月"];
export const TABS = ["ホーム", "デート記録", "計画", "費用管理"];
export const CS  = { background:"#fff", borderRadius:12, border:"1px solid #eee", padding:"1rem 1.25rem", marginBottom:10 };
export const INP = { boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, width:"100%", fontFamily:"sans-serif" };
export const SI  = { padding:"7px 10px", borderRadius:7, border:"1px solid #ddd", fontSize:13, fontFamily:"sans-serif", boxSizing:"border-box" };
