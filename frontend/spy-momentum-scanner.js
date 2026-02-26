/* SPY Momentum Scanner — Advanced Dashboard */
const { useState, useEffect, useMemo, useCallback } = React;

// ─── DATA ───────────────────────────────────────────────────────────────────────
const STOCKS = [
  { ticker: "NVDA", name: "NVIDIA", weight: 7.83, sector: "Tech" },
  { ticker: "AAPL", name: "Apple", weight: 6.47, sector: "Tech" },
  { ticker: "MSFT", name: "Microsoft", weight: 5.39, sector: "Tech" },
  { ticker: "AMZN", name: "Amazon", weight: 3.93, sector: "Consumer" },
  { ticker: "GOOGL", name: "Alphabet", weight: 3.32, sector: "Tech" },
  { ticker: "AVGO", name: "Broadcom", weight: 2.64, sector: "Tech" },
  { ticker: "META", name: "Meta", weight: 2.63, sector: "Tech" },
  { ticker: "TSLA", name: "Tesla", weight: 2.04, sector: "Consumer" },
  { ticker: "BRK.B", name: "Berkshire", weight: 1.49, sector: "Finance" },
  { ticker: "JPM", name: "JPMorgan", weight: 1.35, sector: "Finance" },
  { ticker: "LLY", name: "Eli Lilly", weight: 1.30, sector: "Health" },
  { ticker: "V", name: "Visa", weight: 1.10, sector: "Finance" },
  { ticker: "UNH", name: "UnitedHealth", weight: 1.05, sector: "Health" },
  { ticker: "COST", name: "Costco", weight: 0.98, sector: "Consumer" },
  { ticker: "WMT", name: "Walmart", weight: 0.92, sector: "Consumer" },
];

const SECTOR_COLORS = {
  Tech: "#3b82f6", Consumer: "#f59e0b", Finance: "#10b981", Health: "#ec4899",
};

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateStockData(ticker) {
  const seedNum = ticker.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const rand = seededRandom(seedNum);

  const basePrice = 80 + rand() * 450;
  const days = 60;
  const prices = [], highs = [], lows = [], opens = [], volumes = [];
  let price = basePrice;
  const trendBias = rand() > 0.35 ? 1 : -1;
  const trendStr = 0.0008 + rand() * 0.005;
  const volatility = 0.01 + rand() * 0.025;

  for (let i = 0; i < days; i++) {
    const dailyReturn = (rand() - 0.47) * volatility * 2 + trendBias * trendStr;
    const open = price;
    price = price * (1 + dailyReturn);
    const high = Math.max(open, price) * (1 + rand() * 0.008);
    const low = Math.min(open, price) * (1 - rand() * 0.008);
    opens.push(open);
    prices.push(price);
    highs.push(high);
    lows.push(low);
    const volBase = 800000 + rand() * 8000000;
    const volSpike = Math.abs(dailyReturn) > volatility ? 1.5 + rand() : 1;
    volumes.push(volBase * volSpike);
  }

  const calcEMA = (data, period) => {
    const k = 2 / (period + 1);
    const ema = [data[0]];
    for (let i = 1; i < data.length; i++) ema.push(data[i] * k + ema[i - 1] * (1 - k));
    return ema;
  };

  const ema8 = calcEMA(prices, 8);
  const ema21 = calcEMA(prices, 21);
  const ema50 = calcEMA(prices, 50);

  const calcRSI = (data, period = 14) => {
    let gains = 0, losses = 0;
    for (let i = data.length - period; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      if (change > 0) gains += change; else losses -= change;
    }
    const rs = gains / (losses || 0.001);
    return 100 - 100 / (1 + rs);
  };

  const cp = prices[prices.length - 1];
  const e8 = ema8[ema8.length - 1], e21 = ema21[ema21.length - 1], e50 = ema50[ema50.length - 1];
  const bullStacked = e8 > e21 && e21 > e50;
  const bearStacked = e8 < e21 && e21 < e50;
  const emaSpread = ((e8 - e50) / e50) * 100;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = recentVol / avgVol;
  const rsi = calcRSI(prices);

  const distTo8 = ((cp - e8) / e8) * 100;
  const distTo21 = ((cp - e21) / e21) * 100;

  const isPullbackToBuy = bullStacked && distTo8 < 0.5 && distTo8 > -1.5;
  const isPullbackToSell = bearStacked && distTo8 > -0.5 && distTo8 < 1.5;

  let signal, signalStrength, actionNote;
  if (bullStacked && isPullbackToBuy && volRatio < 1.0) {
    signal = "PULLBACK BUY"; signalStrength = 5;
    actionNote = "Price pulling back to 8 EMA in uptrend with declining volume — ideal entry zone for calls";
  } else if (bullStacked && volRatio > 1.3 && rsi < 75) {
    signal = "STRONG BUY"; signalStrength = 4;
    actionNote = "Bullish EMA stack with volume surge. Momentum accelerating — look for call entries on any intraday dip";
  } else if (bullStacked) {
    signal = "BUY"; signalStrength = 3;
    actionNote = "Trend is up with EMAs stacked bullish. Wait for pullback to 8/21 EMA before entering";
  } else if (e8 > e21 && cp > e21) {
    signal = "LEAN BULL"; signalStrength = 2;
    actionNote = "Trend is developing but 50 EMA not yet aligned. Watch for 21 to cross above 50 for confirmation";
  } else if (bearStacked && isPullbackToSell && volRatio < 1.0) {
    signal = "PULLBACK SELL"; signalStrength = -5;
    actionNote = "Price rallying to 8 EMA in downtrend with low volume — ideal entry for puts";
  } else if (bearStacked && volRatio > 1.3 && rsi > 25) {
    signal = "STRONG SELL"; signalStrength = -4;
    actionNote = "Bearish EMA stack with volume surge. Momentum breaking down — look for put entries on any bounce";
  } else if (bearStacked) {
    signal = "SELL"; signalStrength = -3;
    actionNote = "Trend is down with EMAs stacked bearish. Wait for bounce to 8/21 EMA before entering puts";
  } else if (e8 < e21 && cp < e21) {
    signal = "LEAN BEAR"; signalStrength = -2;
    actionNote = "Bearish momentum developing. Wait for full EMA stack confirmation before trading";
  } else {
    signal = "NEUTRAL"; signalStrength = 0;
    actionNote = "No clear trend — EMAs are tangled. Stay flat and wait for a breakout or breakdown with volume";
  }

  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  const stopLoss = bullStacked ? Math.min(e21, support * 1.005) : Math.max(e21, resistance * 0.995);
  const riskPerShare = Math.abs(cp - stopLoss);
  const target1 = bullStacked ? cp + riskPerShare * 2 : cp - riskPerShare * 2;
  const target2 = bullStacked ? cp + riskPerShare * 3 : cp - riskPerShare * 3;

  const change1d = ((prices[days-1] - prices[days-2]) / prices[days-2]) * 100;
  const change5d = ((prices[days-1] - prices[days-6]) / prices[days-6]) * 100;
  const change20d = ((prices[days-1] - prices[days-21]) / prices[days-21]) * 100;

  return {
    prices: prices.slice(-30), opens: opens.slice(-30), highs: highs.slice(-30),
    lows: lows.slice(-30), volumes: volumes.slice(-30),
    ema8: ema8.slice(-30), ema21: ema21.slice(-30), ema50: ema50.slice(-30),
    currentPrice: cp, e8, e21, e50, signal, signalStrength, actionNote,
    emaSpread: emaSpread.toFixed(2), volRatio: volRatio.toFixed(2), rsi: rsi.toFixed(0),
    change1d: change1d.toFixed(2), change5d: change5d.toFixed(2), change20d: change20d.toFixed(2),
    bullStacked, bearStacked, support, resistance, stopLoss,
    target1, target2, riskPerShare, distTo8: distTo8.toFixed(2), distTo21: distTo21.toFixed(2),
    isPullbackToBuy, isPullbackToSell,
  };
}

// ─── COMPONENTS ─────────────────────────────────────────────────────────────────

function CandleChart({ data, width = 280, height = 90 }) {
  const { prices, opens, highs, lows, ema8, ema21, ema50, volumes } = data;
  const allP = [...highs, ...lows, ...ema50];
  const min = Math.min(...allP), max = Math.max(...allP);
  const range = max - min || 1;
  const n = prices.length;
  const cw = (width - 8) / n;

  const toY = v => 6 + ((max - v) / range) * (height - 12);
  const toX = i => 4 + i * cw + cw / 2;

  const emaPath = (arr, col, sw = 1) => {
    const d = arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    return React.createElement('path', { d, fill: 'none', stroke: col, strokeWidth: sw, opacity: 0.7 });
  };

  const maxVol = Math.max(...volumes);
  const volH = 18;

  return (
    <svg width={width} height={height + volH + 4} style={{ display: 'block' }}>
      {prices.map((close, i) => {
        const open = opens[i], high = highs[i], low = lows[i];
        const isUp = close >= open;
        const bodyTop = toY(Math.max(open, close));
        const bodyBot = toY(Math.min(open, close));
        const bodyH = Math.max(bodyBot - bodyTop, 1);
        return (
          <g key={i}>
            <line x1={toX(i)} y1={toY(high)} x2={toX(i)} y2={toY(low)}
              stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth={0.8} />
            <rect x={toX(i) - cw * 0.35} y={bodyTop} width={cw * 0.7} height={bodyH}
              fill={isUp ? '#22c55e' : '#ef4444'} rx={0.5} opacity={0.85} />
          </g>
        );
      })}
      {emaPath(ema50, '#818cf8', 1.2)}
      {emaPath(ema21, '#f59e0b', 1.2)}
      {emaPath(ema8, '#22d3ee', 1.5)}
      {volumes.map((v, i) => {
        const h = (v / maxVol) * volH;
        const isUp = prices[i] >= opens[i];
        return (
          <rect key={`v${i}`} x={toX(i) - cw * 0.35} y={height + 4 + volH - h}
            width={cw * 0.7} height={h}
            fill={isUp ? '#22c55e' : '#ef4444'} opacity={0.3} rx={0.5} />
        );
      })}
    </svg>
  );
}

const SIGNAL_STYLES = {
  "PULLBACK BUY":  { bg: '#052e16', border: '#16a34a', text: '#4ade80', glow: '#22c55e33' },
  "STRONG BUY":    { bg: '#052e16', border: '#15803d', text: '#86efac', glow: '#22c55e22' },
  "BUY":           { bg: '#052e16', border: '#166534', text: '#86efac', glow: 'none' },
  "LEAN BULL":     { bg: '#1a2e05', border: '#4d7c0f', text: '#bef264', glow: 'none' },
  "NEUTRAL":       { bg: '#1c1917', border: '#57534e', text: '#a8a29e', glow: 'none' },
  "LEAN BEAR":     { bg: '#2e1a05', border: '#c2410c', text: '#fdba74', glow: 'none' },
  "SELL":          { bg: '#2e0505', border: '#991b1b', text: '#fca5a5', glow: 'none' },
  "STRONG SELL":   { bg: '#2e0505', border: '#dc2626', text: '#f87171', glow: '#ef444422' },
  "PULLBACK SELL": { bg: '#2e0505', border: '#dc2626', text: '#f87171', glow: '#ef444433' },
};

function SignalBadgeAdvanced({ signal }) {
  const s = SIGNAL_STYLES[signal] || SIGNAL_STYLES.NEUTRAL;
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 6,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      boxShadow: s.glow !== 'none' ? `0 0 12px ${s.glow}` : 'none',
      fontFamily: 'var(--mono)',
    }}>
      {(signal === 'PULLBACK BUY' || signal === 'PULLBACK SELL') ? '⚡ ' : ''}{signal}
    </span>
  );
}

function MetricPill({ label, value, color, sub }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1, padding: '6px 10px',
      background: '#0d0d0d', borderRadius: 6, border: '1px solid #1a1a1a', minWidth: 70,
    }}>
      <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, letterSpacing: '0.08em', fontFamily: 'var(--mono)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'var(--mono)' }}>{value}</span>
      {sub && <span style={{ fontSize: 9, color: '#4b5563', fontFamily: 'var(--mono)' }}>{sub}</span>}
    </div>
  );
}

function StockRow({ stock, data, isExpanded, onToggle, onAddToWatchlist, isWatched }) {
  const chg = v => parseFloat(v) >= 0 ? '#4ade80' : '#f87171';
  const fmtChg = v => `${parseFloat(v) > 0 ? '+' : ''}${v}%`;
  const isActionable = Math.abs(data.signalStrength) >= 4;

  return (
    <div style={{
      background: isActionable ? '#0a0f0a' : '#0d0d0d',
      borderRadius: 10, border: `1px solid ${isActionable ? '#16a34a22' : isExpanded ? '#2563eb22' : '#141414'}`,
      overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      <div onClick={onToggle} style={{
        display: 'grid', gridTemplateColumns: '120px 280px 90px 70px 70px 70px 50px auto',
        alignItems: 'center', padding: '10px 14px', cursor: 'pointer', gap: 8,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f5f5f5', fontFamily: 'var(--mono)' }}>{stock.ticker}</span>
            <span style={{
              fontSize: 9, color: SECTOR_COLORS[stock.sector], background: `${SECTOR_COLORS[stock.sector]}15`,
              padding: '1px 5px', borderRadius: 3, fontWeight: 600,
            }}>{stock.sector}</span>
            {isWatched && <span style={{ fontSize: 10 }}>★</span>}
          </div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{stock.name} · {stock.weight}%</div>
        </div>

        <CandleChart data={data} />

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f5', fontFamily: 'var(--mono)' }}>
            ${data.currentPrice.toFixed(2)}
          </div>
        </div>

        {['change1d', 'change5d', 'change20d'].map((key, i) => (
          <div key={key} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#4b5563' }}>{['1D', '5D', '20D'][i]}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: chg(data[key]), fontFamily: 'var(--mono)' }}>
              {fmtChg(data[key])}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)',
            color: parseFloat(data.rsi) > 70 ? '#f87171' : parseFloat(data.rsi) < 30 ? '#4ade80' : '#9ca3af',
          }}>{data.rsi}</div>
          <div style={{ fontSize: 8, color: '#4b5563' }}>RSI</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <SignalBadgeAdvanced signal={data.signal} />
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid #141414' }}>
          <div style={{
            margin: '10px 0', padding: '10px 14px', borderRadius: 8,
            background: data.signalStrength > 0 ? '#052e1688' : data.signalStrength < 0 ? '#2e050588' : '#1c191788',
            border: `1px solid ${data.signalStrength > 0 ? '#16a34a33' : data.signalStrength < 0 ? '#dc262633' : '#57534e33'}`,
          }}>
            <div style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.6, fontFamily: 'var(--mono)' }}>
              💡 {data.actionNote}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>EMA STACK</div>
              {[
                { label: 'EMA 8', val: data.e8, color: '#22d3ee' },
                { label: 'EMA 21', val: data.e21, color: '#f59e0b' },
                { label: 'EMA 50', val: data.e50, color: '#818cf8' },
              ].map(({ label, val, color }) => {
                const diff = ((data.currentPrice - val) / val * 100).toFixed(1);
                const above = data.currentPrice > val;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ color: '#9ca3af', fontFamily: 'var(--mono)', width: 48 }}>{label}</span>
                    <span style={{ color: '#d1d5db', fontFamily: 'var(--mono)' }}>${val.toFixed(2)}</span>
                    <span style={{ color: above ? '#4ade80' : '#f87171', fontFamily: 'var(--mono)', fontSize: 10 }}>
                      {above ? '▲' : '▼'}{Math.abs(diff)}%
                    </span>
                  </div>
                );
              })}
              <div style={{
                marginTop: 8, fontSize: 10, fontFamily: 'var(--mono)',
                color: data.bullStacked ? '#4ade80' : data.bearStacked ? '#f87171' : '#fbbf24',
              }}>
                {data.bullStacked ? '✦ BULLISH STACK' : data.bearStacked ? '✦ BEARISH STACK' : '✦ MIXED — NO STACK'}
              </div>
              <div style={{ marginTop: 4, fontSize: 10, fontFamily: 'var(--mono)', color: '#6b7280' }}>
                Spread: <span style={{ color: parseFloat(data.emaSpread) > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{data.emaSpread}%</span>
                {' · '}Vol: <span style={{
                  color: parseFloat(data.volRatio) > 1.2 ? '#4ade80' : parseFloat(data.volRatio) > 0.8 ? '#fbbf24' : '#f87171',
                  fontWeight: 700,
                }}>{data.volRatio}x</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>KEY LEVELS</div>
              {[
                { label: 'RESISTANCE', val: data.resistance, color: '#f87171' },
                { label: 'CURRENT', val: data.currentPrice, color: '#f5f5f5' },
                { label: 'SUPPORT', val: data.support, color: '#4ade80' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--mono)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: 'var(--mono)' }}>${val.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ height: 1, background: '#1f2937', margin: '8px 0' }} />
              <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--mono)', marginBottom: 4 }}>
                Dist to 8 EMA: <span style={{ color: '#22d3ee', fontWeight: 700 }}>{data.distTo8}%</span>
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--mono)' }}>
                Dist to 21 EMA: <span style={{ color: '#f59e0b', fontWeight: 700 }}>{data.distTo21}%</span>
              </div>
              {(data.isPullbackToBuy || data.isPullbackToSell) && (
                <div style={{
                  marginTop: 8, padding: '4px 8px', borderRadius: 4,
                  background: '#fbbf2411', border: '1px solid #fbbf2433',
                  fontSize: 10, color: '#fbbf24', fontFamily: 'var(--mono)', fontWeight: 700,
                }}>
                  ⚡ PULLBACK ZONE — Ideal entry area
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8 }}>TRADE SETUP</div>
              <div style={{ background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a', padding: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 8, color: '#6b7280', fontFamily: 'var(--mono)' }}>DIRECTION</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: data.signalStrength > 0 ? '#4ade80' : data.signalStrength < 0 ? '#f87171' : '#9ca3af', fontFamily: 'var(--mono)' }}>
                      {data.signalStrength > 0 ? 'LONG CALLS' : data.signalStrength < 0 ? 'LONG PUTS' : 'FLAT'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: '#6b7280', fontFamily: 'var(--mono)' }}>STOP LOSS</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', fontFamily: 'var(--mono)' }}>
                      ${data.stopLoss.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: '#6b7280', fontFamily: 'var(--mono)' }}>TARGET 1 (2R)</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', fontFamily: 'var(--mono)' }}>
                      ${data.target1.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: '#6b7280', fontFamily: 'var(--mono)' }}>TARGET 2 (3R)</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', fontFamily: 'var(--mono)' }}>
                      ${data.target2.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <div style={{
                    flex: 1, padding: '5px 8px', background: '#111827', borderRadius: 4,
                    fontSize: 9, color: '#9ca3af', fontFamily: 'var(--mono)', textAlign: 'center',
                  }}>
                    RISK/SHARE: ${data.riskPerShare.toFixed(2)}
                  </div>
                  <div style={{
                    flex: 1, padding: '5px 8px', background: '#111827', borderRadius: 4,
                    fontSize: 9, color: '#9ca3af', fontFamily: 'var(--mono)', textAlign: 'center',
                  }}>
                    @2% / $25K: {data.riskPerShare > 0 ? Math.floor(500 / data.riskPerShare) : 'N/A'} shares
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onAddToWatchlist(stock.ticker); }}
                style={{
                  width: '100%', marginTop: 6, padding: '6px 0',
                  background: isWatched ? '#1e3a5f' : 'transparent',
                  border: `1px solid ${isWatched ? '#3b82f6' : '#1f2937'}`,
                  borderRadius: 6, color: isWatched ? '#60a5fa' : '#6b7280',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
                }}>
                {isWatched ? '★ On Watchlist' : '☆ Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketRegimePanel({ allData }) {
  const bullCount = allData.filter(d => d.data.signalStrength > 0).length;
  const bearCount = allData.filter(d => d.data.signalStrength < 0).length;
  const neutralCount = allData.filter(d => d.data.signalStrength === 0).length;
  const avgRSI = (allData.reduce((a, d) => a + parseFloat(d.data.rsi), 0) / allData.length).toFixed(0);
  const bullPct = ((bullCount / allData.length) * 100).toFixed(0);
  const strongSignals = allData.filter(d => Math.abs(d.data.signalStrength) >= 4).length;

  let regime, regimeColor, regimeAdvice, sizingAdvice;
  if (bullPct > 70) {
    regime = 'STRONG UPTREND'; regimeColor = '#4ade80';
    regimeAdvice = 'Majority of top holdings are bullish. Aggressive swing entries on pullbacks.';
    sizingAdvice = 'SIZE UP — Environment favors the strategy. Use full position sizes.';
  } else if (bullPct > 50) {
    regime = 'MODERATE BULL'; regimeColor = '#86efac';
    regimeAdvice = 'Mixed signals but leaning bullish. Be selective — focus on strongest setups only.';
    sizingAdvice = 'NORMAL SIZE — Standard risk per trade. Pick highest-conviction names.';
  } else if (bullPct > 30) {
    regime = 'CHOPPY / MIXED'; regimeColor = '#fbbf24';
    regimeAdvice = 'No clear market direction. Reduce trading frequency and wait for clarity.';
    sizingAdvice = 'SIZE DOWN — Choppy markets kill swing traders. Halve your position sizes.';
  } else {
    regime = 'BEARISH REGIME'; regimeColor = '#f87171';
    regimeAdvice = 'Majority of holdings are bearish. Consider put strategies or staying flat.';
    sizingAdvice = 'DEFENSIVE — Only take high-conviction put setups with tight stops.';
  }

  return (
    <div style={{
      padding: '14px 18px', background: '#0d0d0d', borderRadius: 10,
      border: `1px solid ${regimeColor}22`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>MARKET REGIME</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: regimeColor, fontFamily: 'var(--mono)' }}>{regime}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <MetricPill label="BULL" value={bullCount} color="#4ade80" />
          <MetricPill label="BEAR" value={bearCount} color="#f87171" />
          <MetricPill label="FLAT" value={neutralCount} color="#9ca3af" />
          <MetricPill label="AVG RSI" value={avgRSI} color={avgRSI > 65 ? '#f87171' : avgRSI < 35 ? '#4ade80' : '#fbbf24'} />
          <MetricPill label="ACTIONABLE" value={strongSignals} color="#a78bfa" sub="setups" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: '8px 12px', background: '#0a0a0a', borderRadius: 6, border: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 10, color: '#d1d5db', lineHeight: 1.5, fontFamily: 'var(--mono)' }}>{regimeAdvice}</div>
        </div>
        <div style={{ padding: '8px 12px', background: '#0a0a0a', borderRadius: 6, border: `1px solid ${regimeColor}22` }}>
          <div style={{ fontSize: 10, color: regimeColor, lineHeight: 1.5, fontFamily: 'var(--mono)', fontWeight: 700 }}>{sizingAdvice}</div>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 8, color: '#4b5563', marginBottom: 3, fontFamily: 'var(--mono)' }}>BREADTH</div>
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#1a1a1a' }}>
          <div style={{ width: `${(bullCount / allData.length) * 100}%`, background: '#22c55e', transition: 'width 0.3s' }} />
          <div style={{ width: `${(neutralCount / allData.length) * 100}%`, background: '#6b7280' }} />
          <div style={{ width: `${(bearCount / allData.length) * 100}%`, background: '#ef4444' }} />
        </div>
      </div>
    </div>
  );
}

function AlertsPanel({ allData }) {
  const actionable = allData.filter(d => Math.abs(d.data.signalStrength) >= 4)
    .sort((a, b) => Math.abs(b.data.signalStrength) - Math.abs(a.data.signalStrength));
  const pullbacks = allData.filter(d => d.data.isPullbackToBuy || d.data.isPullbackToSell);

  if (actionable.length === 0 && pullbacks.length === 0) {
    return (
      <div style={{
        padding: '14px 18px', background: '#0d0d0d', borderRadius: 10,
        border: '1px solid #1a1a1a', textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'var(--mono)' }}>
          📭 No actionable signals right now. Market may be choppy — patience is the edge.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 18px', background: '#0d0d0d', borderRadius: 10,
      border: '1px solid #fbbf2422',
    }}>
      <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10 }}>
        ⚡ TRADE ALERTS — {actionable.length + pullbacks.length} ACTIONABLE SETUP{actionable.length + pullbacks.length > 1 ? 'S' : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pullbacks.map(({ ticker, name, data }) => (
          <div key={`pb-${ticker}`} style={{
            padding: '8px 12px', borderRadius: 6,
            background: data.isPullbackToBuy ? '#052e1666' : '#2e050566',
            border: `1px solid ${data.isPullbackToBuy ? '#16a34a44' : '#dc262644'}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f5f5f5', fontFamily: 'var(--mono)', width: 56 }}>{ticker}</div>
            <SignalBadgeAdvanced signal={data.signal} />
            <div style={{ flex: 1, fontSize: 10, color: '#d1d5db', fontFamily: 'var(--mono)', lineHeight: 1.4 }}>
              {data.actionNote}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f5f5f5', fontFamily: 'var(--mono)' }}>${data.currentPrice.toFixed(2)}</div>
              <div style={{ fontSize: 9, color: '#6b7280', fontFamily: 'var(--mono)' }}>SL: ${data.stopLoss.toFixed(2)}</div>
            </div>
          </div>
        ))}
        {actionable.filter(d => !d.data.isPullbackToBuy && !d.data.isPullbackToSell).map(({ ticker, name, data }) => (
          <div key={`a-${ticker}`} style={{
            padding: '8px 12px', borderRadius: 6,
            background: data.signalStrength > 0 ? '#052e1644' : '#2e050544',
            border: `1px solid ${data.signalStrength > 0 ? '#16a34a22' : '#dc262622'}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f5f5f5', fontFamily: 'var(--mono)', width: 56 }}>{ticker}</div>
            <SignalBadgeAdvanced signal={data.signal} />
            <div style={{ flex: 1, fontSize: 10, color: '#d1d5db', fontFamily: 'var(--mono)', lineHeight: 1.4 }}>
              {data.actionNote}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f5f5f5', fontFamily: 'var(--mono)' }}>${data.currentPrice.toFixed(2)}</div>
              <div style={{ fontSize: 9, color: '#6b7280', fontFamily: 'var(--mono)' }}>T1: ${data.target1.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyPanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  const sections = [
    { title: '1. GAUGE THE REGIME', color: '#3b82f6', icon: '🌊', rules: [
      'Check breadth: >70% of top SPY names bullish = STRONG uptrend → size up',
      '50-70% bullish = moderate → normal size, be selective',
      '<50% bullish = choppy/bearish → size DOWN or stay flat',
      'The regime determines HOW MUCH you trade, not IF you trade',
    ]},
    { title: '2. FIND EMA STACKS', color: '#22d3ee', icon: '📊', rules: [
      'Look for 8 > 21 > 50 EMA (bullish) or reverse (bearish)',
      'Wider EMA spread = stronger trend momentum',
      'EMAs tangled/crossing = STAY OUT — no edge in chop',
    ]},
    { title: '3. WAIT FOR THE PULLBACK', color: '#f59e0b', icon: '🎯', rules: [
      'The money is in the WAIT — best entries come on pullbacks to 8 or 21 EMA',
      'Volume should DECREASE on pullback (weak selling)',
      'Price touching 8 EMA with stack intact = highest probability entry',
      'Do NOT chase breakouts — let the trade come to you',
    ]},
    { title: '4. ENTER WITH CONFIRMATION', color: '#22c55e', icon: '⚡', rules: [
      'Bounce off EMA with volume spike = GO',
      'Use ATM or slightly ITM options (30-45 DTE) for leverage',
      'Risk 2% of account max per trade',
      'Options leverage amplifies both gains AND losses',
    ]},
    { title: '5. MANAGE & EXIT', color: '#a78bfa', icon: '🛡️', rules: [
      'Trail stop under 21 EMA for swing trades',
      'Take partial profits at 2R, let runner to 3R',
      'EMAs cross/unstack = EXIT immediately',
      'If RSI > 75 with narrowing EMA spread = take profits',
    ]},
    { title: '6. SIZING RULES', color: '#ec4899', icon: '📏', rules: [
      'Winning streak (3+ wins) → size up 50% on next trade',
      'Losing streak (2+ losses) → cut size in HALF',
      'Strong regime → full size | Choppy → half size | Bear → quarter or flat',
      'NEVER let one trade risk more than 2% of total account',
    ]},
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)', zIndex: 100,
      display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#0d0d0d', border: '1px solid #1f2937', borderRadius: 14,
        maxWidth: 620, width: '100%', padding: 24, maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f5f5f5', fontFamily: 'var(--mono)', margin: 0 }}>
              Momentum Swing Playbook
            </h2>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0', fontFamily: 'var(--mono)' }}>
              EMA trend-following · Volume confirmation · Options leverage
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, background: '#1f2937',
            border: 'none', color: '#9ca3af', fontSize: 14, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: s.color, marginBottom: 6,
              fontFamily: 'var(--mono)', letterSpacing: '0.06em',
            }}>
              {s.icon} {s.title}
            </div>
            {s.rules.map((r, i) => (
              <div key={i} style={{
                fontSize: 11, color: '#d1d5db', lineHeight: 1.7, paddingLeft: 12,
                borderLeft: `2px solid ${s.color}33`, marginBottom: 3,
              }}>{r}</div>
            ))}
          </div>
        ))}
        <div style={{
          marginTop: 12, padding: 12, background: '#0a0a0a', borderRadius: 8,
          border: '1px solid #fbbf2422',
        }}>
          <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, marginBottom: 4, fontFamily: 'var(--mono)' }}>
            ⚠️ REMEMBER
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.6, fontFamily: 'var(--mono)' }}>
            80% of profits come from 20% of trades. Your job is to WAIT for the A+ setups in a strong regime.
            Patience and position sizing are the actual edge — not the indicators. Not financial advice.
          </div>
        </div>
      </div>
    </div>
  );
}

function SpyMomentumScanner() {
  const [expandedTicker, setExpandedTicker] = useState(null);
  const [sortBy, setSortBy] = useState('signal');
  const [filterSignal, setFilterSignal] = useState('ALL');
  const [showRules, setShowRules] = useState(false);
  const [watchlist, setWatchlist] = useState(['NVDA', 'AAPL', 'TSLA']);
  const [view, setView] = useState('all');

  const allData = useMemo(() => STOCKS.map(s => ({
    ...s, data: generateStockData(s.ticker),
  })), []);

  const toggleWatchlist = useCallback((ticker) => {
    setWatchlist(prev => prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]);
  }, []);

  let displayed = view === 'watchlist'
    ? allData.filter(d => watchlist.includes(d.ticker))
    : view === 'alerts'
      ? allData.filter(d => Math.abs(d.data.signalStrength) >= 3)
      : [...allData];

  if (filterSignal === 'BULLISH') displayed = displayed.filter(d => d.data.signalStrength > 0);
  else if (filterSignal === 'BEARISH') displayed = displayed.filter(d => d.data.signalStrength < 0);
  else if (filterSignal === 'ACTIONABLE') displayed = displayed.filter(d => Math.abs(d.data.signalStrength) >= 4);

  if (sortBy === 'signal') displayed.sort((a, b) => b.data.signalStrength - a.data.signalStrength);
  else if (sortBy === 'change') displayed.sort((a, b) => parseFloat(b.data.change5d) - parseFloat(a.data.change5d));
  else if (sortBy === 'volume') displayed.sort((a, b) => parseFloat(b.data.volRatio) - parseFloat(a.data.volRatio));
  else if (sortBy === 'rsi') displayed.sort((a, b) => parseFloat(a.data.rsi) - parseFloat(b.data.rsi));

  return (
    <div>
      <StrategyPanel isOpen={showRules} onClose={() => setShowRules(false)} />

      <div style={{ padding: '16px 20px', borderBottom: '1px solid #141414' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              fontSize: 20, fontWeight: 800, color: '#f5f5f5', fontFamily: 'var(--mono)',
              letterSpacing: '-0.03em', margin: 0,
            }}>
              <span style={{ color: '#3b82f6' }}>◈</span> SPY MOMENTUM SCANNER
            </h1>
            <p style={{ fontSize: 10, color: '#4b5563', margin: '3px 0 0', fontFamily: 'var(--mono)' }}>
              Top 15 Holdings · EMA 8/21/50 + Volume + RSI · Swing Signals
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowRules(true)} style={{
              padding: '7px 14px', background: '#111', border: '1px solid #2563eb33',
              borderRadius: 7, color: '#60a5fa', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--mono)',
            }}>📋 Playbook</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
          {[
            { key: 'all', label: 'ALL STOCKS', count: allData.length },
            { key: 'alerts', label: 'ALERTS', count: allData.filter(d => Math.abs(d.data.signalStrength) >= 3).length },
            { key: 'watchlist', label: 'WATCHLIST', count: watchlist.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setView(tab.key)} style={{
              padding: '6px 14px', borderRadius: 6,
              border: `1px solid ${view === tab.key ? '#3b82f6' : '#1f2937'}`,
              background: view === tab.key ? '#3b82f622' : 'transparent',
              color: view === tab.key ? '#60a5fa' : '#6b7280',
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)',
            }}>
              {tab.label} <span style={{ opacity: 0.6 }}>({tab.count})</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {['ALL', 'BULLISH', 'BEARISH', 'ACTIONABLE'].map(f => (
            <button key={f} onClick={() => setFilterSignal(f)} style={{
              padding: '5px 10px', borderRadius: 5,
              border: `1px solid ${filterSignal === f ? '#6366f1' : '#1a1a1a'}`,
              background: filterSignal === f ? '#6366f122' : 'transparent',
              color: filterSignal === f ? '#a78bfa' : '#4b5563',
              fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
            }}>{f}</button>
          ))}
          <div style={{ width: 1, background: '#1f2937', margin: '0 4px' }} />
          {['signal', 'change', 'volume', 'rsi'].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              padding: '5px 8px', borderRadius: 5,
              border: `1px solid ${sortBy === s ? '#374151' : '#1a1a1a'}`,
              background: sortBy === s ? '#1f293744' : 'transparent',
              color: sortBy === s ? '#d1d5db' : '#4b5563',
              fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--mono)',
            }}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <MarketRegimePanel allData={allData} />
          <AlertsPanel allData={allData} />
        </div>
        <div style={{
          display: 'flex', gap: 14, padding: '6px 0 8px', marginBottom: 4,
        }}>
          {[
            { color: '#22d3ee', label: 'EMA 8' },
            { color: '#f59e0b', label: 'EMA 21' },
            { color: '#818cf8', label: 'EMA 50' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#4b5563' }}>
              <div style={{ width: 14, height: 2, borderRadius: 1, background: l.color }} />{l.label}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#4b5563' }}>
            <div style={{ width: 8, height: 8, background: '#22c55e', borderRadius: 1 }} />
            <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: 1 }} />
            Candles
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayed.map(({ data, ...stock }) => (
            <StockRow
              key={stock.ticker}
              stock={stock}
              data={data}
              isExpanded={expandedTicker === stock.ticker}
              onToggle={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
              onAddToWatchlist={toggleWatchlist}
              isWatched={watchlist.includes(stock.ticker)}
            />
          ))}
          {displayed.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#4b5563', fontFamily: 'var(--mono)', fontSize: 12 }}>
              No stocks match current filters.
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: '12px 20px', borderTop: '1px solid #141414', textAlign: 'center',
        fontSize: 9, color: '#374151', fontFamily: 'var(--mono)',
      }}>
        ⚠️ Simulated data for strategy visualization. Not financial advice. Connect to live market data API for real signals.
      </div>
    </div>
  );
}

window.SpyMomentumScanner = SpyMomentumScanner;
