// ════════════════════════════════════════════════════
// /api/stocks.js — 시세 데이터 백엔드 (Yahoo Finance)
// ════════════════════════════════════════════════════
// 호출: GET /api/stocks?symbols=^KS11,^IXIC,005930.KS
// 응답: { "^KS11": { price, change, changePercent, ... }, ... }
// ════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS 허용 (어디서든 호출 가능)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const { symbols } = req.query;
  if (!symbols) {
    return res.status(400).json({ error: 'symbols query required' });
  }

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const results = await Promise.allSettled(
      symbolList.map(sym => fetchYahooQuote(sym))
    );

    const data = {};
    results.forEach((r, i) => {
      const sym = symbolList[i];
      if (r.status === 'fulfilled' && r.value) {
        data[sym] = r.value;
      } else {
        data[sym] = { error: true };
      }
    });

    return res.status(200).json({ ok: true, data, ts: Date.now() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InvestDashboard/1.0)',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('no data');

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close || [];
  const validCloses = closes.filter(c => c !== null && c !== undefined);

  const price = meta.regularMarketPrice ?? validCloses[validCloses.length - 1];
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? validCloses[validCloses.length - 2];

  if (price === undefined || price === null) throw new Error('no price');

  const change = prev ? price - prev : 0;
  const changePercent = prev ? ((price - prev) / prev) * 100 : 0;

  return {
    symbol,
    price,
    previousClose: prev,
    change,
    changePercent,
    currency: meta.currency,
    marketState: meta.marketState,
    exchangeName: meta.exchangeName,
    longName: meta.longName || meta.shortName || symbol
  };
}
