export async function geocode(q) {
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));
  const fetchWithTimeout = async (url, ms = 8000) => Promise.race([fetch(url), timeout(ms)]);

  // ① 郵便番号が含まれる場合: zipcloud で住所に変換
  const zipMatch = q.replace(/[〒\s　]/g, "").match(/(\d{3})-?(\d{4})/);
  if (zipMatch) {
    try {
      const r = await fetchWithTimeout(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipMatch[1]+zipMatch[2]}`, 5000);
      if (r.ok) {
        const d = await r.json();
        if (d?.results?.[0]) {
          const base = d.results[0].address1 + d.results[0].address2 + d.results[0].address3;
          const after = q.replace(/[〒\s　]/g,"").replace(/\d{3}-?\d{4}/, "").trim();
          q = base + after;
        }
      }
    } catch {}
  }

  // ② 国土地理院API（日本住所・番地レベルまで対応・無料・APIキー不要）
  try {
    const r = await fetchWithTimeout(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`,
      6000
    );
    if (r.ok) {
      const d = await r.json();
      if (d?.[0]?.geometry?.coordinates) {
        const [lng, lat] = d[0].geometry.coordinates;
        return { lat, lng };
      }
    }
  } catch {}

  // ③ photon（施設名・店舗名に強い）- 日本のbboxで絞る
  try {
    const r = await fetchWithTimeout(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lang=ja&bbox=122,24,154,46`,
      7000
    );
    if (r.ok) {
      const d = await r.json();
      const jp = d?.features?.find(f => f.properties?.country === "Japan" || f.properties?.country === "日本");
      const f = jp || d?.features?.[0];
      if (f) return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    }
  } catch {}

  // ④ GSI - 番地を除いた短縮クエリで再試行
  const qShort = q.replace(/\d+番(地|丁目)?/, "").replace(/[-－]\d+$/, "").trim();
  if (qShort !== q) {
    try {
      const r = await fetchWithTimeout(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(qShort)}`,
        6000
      );
      if (r.ok) {
        const d = await r.json();
        if (d?.[0]?.geometry?.coordinates) {
          const [lng, lat] = d[0].geometry.coordinates;
          return { lat, lng };
        }
      }
    } catch {}
  }

  return null;
}
