/* Swing Trader Dashboard — Simplified View */
const { useState: useStateST, useCallback: useCallbackST, useMemo: useMemoST } = React;

const STOCKS_ST = [
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

function generateStockDataST(ticker) {
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (s) => {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  const basePrice = 50 + rand(seed) * 500;
  const days = 60;
  const prices = [];
  const volumes = [];
  let price = basePrice;

  const trendBias = rand(seed * 7) > 0.4 ? 1 : -1;
  const trendStrength = 0.001 + rand(seed * 3) * 0.004;

  for (let i = 0; i < days; i++) {
    const dailyReturn = (rand(seed * i + i * 13) - 0.48) * 0.03 + trendBias * trendStrength;
    price = price * (1 + dailyReturn);
    prices.push(price);
    volumes.push(500000 + rand(seed * i + 99) * 5000000);
  }

  const calcEMA = (data, period) => {
    const k = 2 / (period + 1);
    const ema = [data[0]];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  };

  const ema8 = calcEMA(prices, 8);
  const ema21 = calcEMA(prices, 21);
  const ema50 = calcEMA(prices, 50);

  const currentPrice = prices[prices.length - 1];
  const e8 = ema8[ema8.length - 1];
  const e21 = ema21[ema21.length - 1];
  const e50 = ema50[ema50.length - 1];

  const bullStacked = e8 > e21 && e21 > e50;
  const bearStacked = e8 < e21 && e21 < e50;
  const emaSpread = ((e8 - e50) / e50) * 100;

  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volRatio = recentVol / avgVol;

  const change1d = ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100;
  const change5d = ((prices[prices.length - 1] - prices[prices.length - 6]) / prices[prices.length - 6]) * 100;
  const change20d = ((prices[prices.length - 1] - prices[prices.length - 21]) / prices[prices.length - 21]) * 100;

  let signal, signalStrength;
  if (bullStacked && volRatio > 1.1 && change5d > 0) {
    signal = "STRONG BUY"; signalStrength = 5;
  } else if (bullStacked && change5d > 0) {
    signal = "BUY"; signalStrength = 4;
  } else if (e8 > e21 && currentPrice > e21) {
    signal = "LEAN BULL"; signalStrength = 3;
  } else if (bearStacked && volRatio > 1.1 && change5d < 0) {
    signal = "STRONG SELL"; signalStrength = -5;
  } else if (bearStacked) {
    signal = "SELL"; signalStrength = -4;
  } else if (e8 < e21 && currentPrice < e21) {
    signal = "LEAN BEAR"; signalStrength = -3;
  } else {
    signal = "NEUTRAL"; signalStrength = 0;
  }

  const supportLevel = Math.min(e21, e50) * 0.99;
  const resistanceLevel = Math.max(e8, currentPrice) * 1.02;

  return {
    prices: prices.slice(-30),
    volumes: volumes.slice(-30),
    ema8: ema8.slice(-30),
    ema21: ema21.slice(-30),
    ema50: ema50.slice(-30),
    currentPrice, e8, e21, e50,
    signal, signalStrength,
    emaSpread: emaSpread.toFixed(2),
    volRatio: volRatio.toFixed(2),
    change1d: change1d.toFixed(2),
    change5d: change5d.toFixed(2),
    change20d: change20d.toFixed(2),
    bullStacked, bearStacked,
    supportLevel, resistanceLevel,
  };
}

function MiniChart({ prices, ema8, ema21, ema50, height = 60, width = 200 }) {
  const allVals = [...prices, ...ema8, ...ema21, ...ema50];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toY = (v) => height - 4 - ((v - min) / range) * (height - 8);
  const toX = (i) => (i / (prices.length - 1)) * width;

  const line = (data, color, sw = 1.5) => {
    const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
    return React.createElement('path', { d, fill: 'none', stroke: color, strokeWidth: sw });
  };

  const priceD = prices.map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const fillD = `${priceD} L${width},${height} L0,${height} Z`;
  const isUp = prices[prices.length - 1] > prices[0];

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`grad-st-${isUp}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity="0.2" />
          <stop offset="100%" stopColor={isUp ? "#22c55e" : "#ef4444"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#grad-st-${isUp})`} />
      {line(ema50, "#6366f1", 1)}
      {line(ema21, "#f59e0b", 1)}
      {line(ema8, "#06b6d4", 1)}
      {line(prices, isUp ? "#22c55e" : "#ef4444", 2)}
    </svg>
  );
}

function VolumeBars({ volumes, width = 200, height = 24 }) {
  const max = Math.max(...volumes);
  const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const barW = width / volumes.length - 1;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {volumes.map((v, i) => {
        const h = (v / max) * height;
        const isAboveAvg = v > avg;
        return (
          <rect key={i} x={i * (barW + 1)} y={height - h} width={barW} height={h}
            fill={isAboveAvg ? "#8b5cf6" : "#374151"} opacity={0.7} rx={1} />
        );
      })}
    </svg>
  );
}

function SignalBadgeST({ signal, strength }) {
  const colors = {
    "STRONG BUY": { bg: "#052e16", border: "#16a34a", text: "#4ade80" },
    "BUY": { bg: "#052e16", border: "#15803d", text: "#86efac" },
    "LEAN BULL": { bg: "#1a2e05", border: "#4d7c0f", text: "#bef264" },
    "NEUTRAL": { bg: "#1c1917", border: "#57534e", text: "#a8a29e" },
    "LEAN BEAR": { bg: "#2e1a05", border: "#c2410c", text: "#fdba74" },
    "SELL": { bg: "#2e0505", border: "#b91c1c", text: "#fca5a5" },
    "STRONG SELL": { bg: "#2e0505", border: "#dc2626", text: "#f87171" },
  };
  const c = colors[signal] || colors["NEUTRAL"];

  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 6,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {signal}
    </span>
  );
}

function EMAIndicatorST({ label, value, price, color }) {
  const diff = ((price - value) / value * 100).toFixed(1);
  const above = price > value;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontFamily: "'JetBrains Mono', monospace" }}>${value.toFixed(2)}</span>
      <span style={{
        color: above ? "#4ade80" : "#f87171",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      }}>
        {above ? "▲" : "▼"}{Math.abs(diff)}%
      </span>
    </div>
  );
}

function TradePlanST({ data, stock }) {
  const [showPlan, setShowPlan] = useStateST(false);
  const isBull = data.signalStrength > 0;
  const riskPct = 2;
  const accountSize = 25000;
  const riskAmount = accountSize * (riskPct / 100);
  const stopDistance = Math.abs(data.currentPrice - data.supportLevel);
  const shares = stopDistance > 0 ? Math.floor(riskAmount / stopDistance) : 0;
  const targetPrice = isBull
    ? data.currentPrice + stopDistance * 2.5
    : data.currentPrice - stopDistance * 2.5;

  if (!showPlan) {
    return (
      <button onClick={() => setShowPlan(true)} style={{
        width: "100%", padding: "6px 0", background: "transparent",
        border: "1px dashed #374151", borderRadius: 6, color: "#6b7280",
        fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", marginTop: 4,
      }}>
        ⚡ Show Trade Plan
      </button>
    );
  }

  return (
    <div style={{
      marginTop: 4, padding: 10, background: "#0a0a0a", borderRadius: 8,
      border: "1px solid #1f2937", fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#9ca3af" }}>TRADE PLAN</span>
        <button onClick={() => setShowPlan(false)} style={{
          background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12,
        }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>DIRECTION</div>
          <div style={{ color: isBull ? "#4ade80" : "#f87171", fontWeight: 700 }}>
            {isBull ? "LONG CALLS" : "LONG PUTS"}
          </div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>ENTRY ZONE</div>
          <div style={{ color: "#e5e7eb" }}>
            ${(isBull ? data.e21 : data.e8).toFixed(2)} – ${data.currentPrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>STOP LOSS</div>
          <div style={{ color: "#f87171" }}>${data.supportLevel.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>TARGET (2.5R)</div>
          <div style={{ color: "#4ade80" }}>${targetPrice.toFixed(2)}</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>SHARES @ 2% RISK</div>
          <div style={{ color: "#e5e7eb" }}>{shares} shares</div>
        </div>
        <div>
          <div style={{ color: "#6b7280", fontSize: 9, marginBottom: 2 }}>$ AT RISK</div>
          <div style={{ color: "#fbbf24" }}>${riskAmount.toFixed(0)}</div>
        </div>
      </div>
      <div style={{
        marginTop: 8, padding: "6px 8px", background: "#111827", borderRadius: 4,
        color: "#9ca3af", fontSize: 10, lineHeight: 1.5,
      }}>
        💡 {isBull
          ? "Wait for pullback to 8/21 EMA zone. Enter on bounce with volume confirmation. Trail stop under 21 EMA."
          : "Wait for rally to 8/21 EMA zone. Enter on rejection with volume spike. Trail stop above 21 EMA."}
      </div>
    </div>
  );
}

function StockCardST({ stock, data, isExpanded, onToggle }) {
  const changeColor = (v) => parseFloat(v) >= 0 ? "#4ade80" : "#f87171";

  return (
    <div style={{
      background: "#111111", borderRadius: 12,
      border: `1px solid ${isExpanded ? "#2563eb33" : "#1a1a1a"}`,
      overflow: "hidden", transition: "all 0.2s ease",
    }}>
      <div onClick={onToggle} style={{
        display: "grid", gridTemplateColumns: "140px 200px 1fr 100px 100px 100px 140px",
        alignItems: "center", padding: "12px 16px", cursor: "pointer", gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 15, fontWeight: 800, color: "#f5f5f5",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em",
            }}>{stock.ticker}</span>
            <span style={{
              fontSize: 10, color: "#6b7280", background: "#1f2937",
              padding: "1px 6px", borderRadius: 4,
            }}>{stock.sector}</span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            {stock.name} · {stock.weight}%
          </div>
        </div>

        <MiniChart prices={data.prices} ema8={data.ema8} ema21={data.ema21} ema50={data.ema50} />

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: "#f5f5f5",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            ${data.currentPrice.toFixed(2)}
          </div>
        </div>

        {[{key: 'change1d', label: '1D'}, {key: 'change5d', label: '5D'}, {key: 'change20d', label: '20D'}].map(({key, label}) => (
          <div key={key} style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 1 }}>{label}</div>
            <div style={{
              fontSize: 13, fontWeight: 600, color: changeColor(data[key]),
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {parseFloat(data[key]) > 0 ? "+" : ""}{data[key]}%
            </div>
          </div>
        ))}

        <div style={{ textAlign: "right" }}>
          <SignalBadgeST signal={data.signal} strength={data.signalStrength} />
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1a1a1a" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16, paddingTop: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 8, letterSpacing: "0.1em" }}>
                EMA STACK
              </div>
              <EMAIndicatorST label="EMA 8" value={data.e8} price={data.currentPrice} color="#06b6d4" />
              <div style={{ height: 4 }} />
              <EMAIndicatorST label="EMA 21" value={data.e21} price={data.currentPrice} color="#f59e0b" />
              <div style={{ height: 4 }} />
              <EMAIndicatorST label="EMA 50" value={data.e50} price={data.currentPrice} color="#6366f1" />
              <div style={{
                marginTop: 8, fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: data.bullStacked ? "#4ade80" : data.bearStacked ? "#f87171" : "#fbbf24",
              }}>
                {data.bullStacked ? "✦ BULLISH STACK (8 > 21 > 50)" :
                 data.bearStacked ? "✦ BEARISH STACK (8 < 21 < 50)" :
                 "✦ MIXED — NO CLEAR STACK"}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 8, letterSpacing: "0.1em" }}>
                VOLUME (30D)
              </div>
              <VolumeBars volumes={data.volumes} />
              <div style={{
                marginTop: 8, display: "flex", alignItems: "center", gap: 8,
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: "#9ca3af" }}>Vol Ratio:</span>
                <span style={{
                  color: parseFloat(data.volRatio) > 1.2 ? "#4ade80" :
                         parseFloat(data.volRatio) > 0.8 ? "#fbbf24" : "#f87171",
                  fontWeight: 700,
                }}>
                  {data.volRatio}x
                </span>
                <span style={{ fontSize: 9, color: "#6b7280" }}>
                  {parseFloat(data.volRatio) > 1.2 ? "(HIGH conviction)" :
                   parseFloat(data.volRatio) > 0.8 ? "(NORMAL)" : "(LOW — caution)"}
                </span>
              </div>
              <div style={{
                marginTop: 4, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#9ca3af",
              }}>
                EMA Spread: <span style={{
                  color: parseFloat(data.emaSpread) > 0 ? "#4ade80" : "#f87171", fontWeight: 700,
                }}>{data.emaSpread}%</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 8, letterSpacing: "0.1em" }}>
                SWING SETUP
              </div>
              <TradePlanST data={data} stock={stock} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StrategyRulesST({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(8px)", zIndex: 100,
      display: "flex", justifyContent: "center", alignItems: "center", padding: 20,
    }}>
      <div style={{
        background: "#111", border: "1px solid #2563eb33", borderRadius: 16,
        maxWidth: 560, width: "100%", padding: 28, maxHeight: "80vh",
        overflowY: "auto", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 16, right: 16, background: "none",
          border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer",
        }}>✕</button>

        <h2 style={{
          fontSize: 18, fontWeight: 800, color: "#f5f5f5", marginBottom: 4,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Momentum Swing Strategy
        </h2>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>
          EMA trend-following with volume confirmation. Based on riding strong momentum with options leverage.
        </p>

        {[
          { title: "1. IDENTIFY TREND", color: "#06b6d4", rules: [
            "EMAs stacked bullish: 8 > 21 > 50 (or bearish reverse)",
            "Price above all 3 EMAs for longs",
            "EMA spread widening = strengthening trend",
          ]},
          { title: "2. WAIT FOR PULLBACK", color: "#f59e0b", rules: [
            "Price pulls back to the 8 or 21 EMA zone",
            "Volume decreases on the pullback (low conviction selling)",
            "EMAs maintain their stacked order",
          ]},
          { title: "3. ENTER ON BOUNCE", color: "#22c55e", rules: [
            "Price bounces off EMA support with volume spike",
            "Use options (calls for bull, puts for bear) for leverage",
            "Risk 2% of account per trade max",
          ]},
          { title: "4. MANAGE THE TRADE", color: "#8b5cf6", rules: [
            "Trail stop under the 21 EMA",
            "Target 2-3R reward (risk-to-reward)",
            "Size up when strategy is working, size down on losing streaks",
            "If EMAs cross/unstack → EXIT",
          ]},
          { title: "5. VOLUME RULES", color: "#ec4899", rules: [
            "Volume ratio > 1.2x = high conviction move",
            "Volume spike on breakout = confirmation",
            "Low volume rally into resistance = potential reversal",
            "Volume doesn't lie — it shows institutional participation",
          ]},
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: section.color,
              letterSpacing: "0.1em", marginBottom: 8,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{section.title}</div>
            {section.rules.map((rule, i) => (
              <div key={i} style={{
                fontSize: 12, color: "#d1d5db", lineHeight: 1.7, paddingLeft: 12,
                borderLeft: `2px solid ${section.color}22`, marginBottom: 4,
              }}>{rule}</div>
            ))}
          </div>
        ))}

        <div style={{
          marginTop: 16, padding: 12, background: "#0a0a0a", borderRadius: 8,
          border: "1px solid #fbbf2433",
        }}>
          <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 700, marginBottom: 4, letterSpacing: "0.1em" }}>
            ⚠️ RISK MANAGEMENT
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
            Never risk more than 2% per trade. Size down during choppy/sideways markets.
            The best trades come from strong trending environments — be patient and wait for the setup.
            Not financial advice — always do your own due diligence.
          </div>
        </div>
      </div>
    </div>
  );
}

function SwingTraderDashboard() {
  const [expandedTicker, setExpandedTicker] = useStateST(null);
  const [sortBy, setSortBy] = useStateST("weight");
  const [filterSignal, setFilterSignal] = useStateST("ALL");
  const [showRules, setShowRules] = useStateST(false);

  const allDataST = useMemoST(() => STOCKS_ST.map(s => ({
    ...s, data: generateStockDataST(s.ticker),
  })), []);

  const stockData = useMemoST(() => {
    const map = {};
    allDataST.forEach(d => { map[d.ticker] = d.data; });
    return map;
  }, [allDataST]);

  let displayed = [...allDataST];

  if (filterSignal !== "ALL") {
    if (filterSignal === "BULLISH") {
      displayed = displayed.filter((s) => s.data.signalStrength > 0);
    } else if (filterSignal === "BEARISH") {
      displayed = displayed.filter((s) => s.data.signalStrength < 0);
    } else if (filterSignal === "STRONG") {
      displayed = displayed.filter((s) => Math.abs(s.data.signalStrength) >= 4);
    }
  }

  if (sortBy === "signal") {
    displayed.sort((a, b) => b.data.signalStrength - a.data.signalStrength);
  } else if (sortBy === "change") {
    displayed.sort((a, b) => parseFloat(b.data.change5d) - parseFloat(a.data.change5d));
  } else if (sortBy === "volume") {
    displayed.sort((a, b) => parseFloat(b.data.volRatio) - parseFloat(a.data.volRatio));
  }

  const bullCount = STOCKS_ST.filter((s) => stockData[s.ticker].signalStrength > 0).length;
  const bearCount = STOCKS_ST.filter((s) => stockData[s.ticker].signalStrength < 0).length;
  const neutralCount = STOCKS_ST.filter((s) => stockData[s.ticker].signalStrength === 0).length;
  const strongBuys = STOCKS_ST.filter((s) => stockData[s.ticker].signal === "STRONG BUY").length;

  return (
    <div>
      <StrategyRulesST isOpen={showRules} onClose={() => setShowRules(false)} />

      <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: "#f5f5f5",
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.03em", margin: 0,
            }}>
              <span style={{ color: "#2563eb" }}>◈</span> SWING TRADER DASHBOARD
            </h1>
            <p style={{
              fontSize: 11, color: "#6b7280", marginTop: 4,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Top 15 SPY Holdings · EMA Trend + Volume · Swing Trade Signals
            </p>
          </div>
          <button onClick={() => setShowRules(true)} style={{
            padding: "8px 16px", background: "#111", border: "1px solid #2563eb44",
            borderRadius: 8, color: "#60a5fa", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}>
            📋 Strategy Rules
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          {[
            { label: "BULLISH", value: bullCount, color: "#4ade80" },
            { label: "BEARISH", value: bearCount, color: "#f87171" },
            { label: "NEUTRAL", value: neutralCount, color: "#9ca3af" },
            { label: "STRONG BUY", value: strongBuys, color: "#22c55e" },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: "8px 14px", background: "#111", borderRadius: 8,
              border: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{
                fontSize: 20, fontWeight: 800, color: stat.color,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{stat.value}</span>
              <span style={{ fontSize: 9, color: "#6b7280", fontWeight: 600, letterSpacing: "0.1em" }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {["ALL", "BULLISH", "BEARISH", "STRONG"].map((f) => (
              <button key={f} onClick={() => setFilterSignal(f)} style={{
                padding: "5px 12px", borderRadius: 6, border: "1px solid",
                borderColor: filterSignal === f ? "#2563eb" : "#1f2937",
                background: filterSignal === f ? "#2563eb22" : "transparent",
                color: filterSignal === f ? "#60a5fa" : "#6b7280",
                fontSize: 10, fontWeight: 600, cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{f}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {[
              { key: "weight", label: "BY WEIGHT" },
              { key: "signal", label: "BY SIGNAL" },
              { key: "change", label: "BY 5D Δ" },
              { key: "volume", label: "BY VOLUME" },
            ].map((s) => (
              <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                padding: "5px 10px", borderRadius: 6, border: "1px solid",
                borderColor: sortBy === s.key ? "#6366f1" : "#1f2937",
                background: sortBy === s.key ? "#6366f122" : "transparent",
                color: sortBy === s.key ? "#a78bfa" : "#6b7280",
                fontSize: 10, fontWeight: 600, cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        padding: "8px 24px", display: "flex", gap: 16, borderBottom: "1px solid #1a1a1a",
      }}>
        {[
          { color: "#06b6d4", label: "EMA 8 (fast)" },
          { color: "#f59e0b", label: "EMA 21 (mid)" },
          { color: "#6366f1", label: "EMA 50 (slow)" },
          { color: "#8b5cf6", label: "Vol > avg" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#6b7280" }}>
            <div style={{ width: 12, height: 3, borderRadius: 2, background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 24px 24px", display: "flex", flexDirection: "column", gap: 6 }}>
        {displayed.map(({ data, ...stock }) => (
          <StockCardST key={stock.ticker} stock={stock} data={data}
            isExpanded={expandedTicker === stock.ticker}
            onToggle={() => setExpandedTicker(expandedTicker === stock.ticker ? null : stock.ticker)}
          />
        ))}
      </div>

      <div style={{
        padding: "16px 24px", borderTop: "1px solid #1a1a1a", textAlign: "center",
        fontSize: 10, color: "#4b5563", fontFamily: "'JetBrains Mono', monospace",
      }}>
        ⚠️ Simulated data for educational purposes. Not financial advice. Always do your own research before trading.
      </div>
    </div>
  );
}

window.SwingTraderDashboard = SwingTraderDashboard;
