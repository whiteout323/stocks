/* Live Scan View — Reads latest-scan.json from the scanner */
const { useState: useStateLive, useEffect: useEffectLive, useMemo: useMemoLive } = React;

const SIGNAL_COLORS_LIVE = {
  "PULLBACK BUY":  { bg: '#052e16', border: '#16a34a', text: '#4ade80' },
  "STRONG BUY":    { bg: '#052e16', border: '#15803d', text: '#86efac' },
  "BUY":           { bg: '#052e16', border: '#166534', text: '#86efac' },
  "LEAN BULL":     { bg: '#1a2e05', border: '#4d7c0f', text: '#bef264' },
  "NEUTRAL":       { bg: '#1c1917', border: '#57534e', text: '#a8a29e' },
  "LEAN BEAR":     { bg: '#2e1a05', border: '#c2410c', text: '#fdba74' },
  "SELL":          { bg: '#2e0505', border: '#991b1b', text: '#fca5a5' },
  "STRONG SELL":   { bg: '#2e0505', border: '#dc2626', text: '#f87171' },
  "PULLBACK SELL": { bg: '#2e0505', border: '#dc2626', text: '#f87171' },
};

function LiveSignalBadge({ signal }) {
  const s = SIGNAL_COLORS_LIVE[signal] || SIGNAL_COLORS_LIVE.NEUTRAL;
  const isPB = signal === 'PULLBACK BUY' || signal === 'PULLBACK SELL';
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 6,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {isPB ? '⚡ ' : ''}{signal}
    </span>
  );
}

function LiveOrderCard({ order, type }) {
  const isBuy = type === 'buy';
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      background: isBuy ? '#0a1a0a' : '#1a0a0a',
      border: `1px solid ${isBuy ? '#16a34a22' : '#dc262622'}`,
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 16, fontWeight: 800, color: '#f5f5f5',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{order.ticker}</span>
          <LiveSignalBadge signal={order.signal} />
        </div>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: isBuy ? '#4ade80' : '#f87171',
          fontFamily: "'JetBrains Mono', monospace",
        }}>{order.action}</div>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, lineHeight: 1.5,
        fontFamily: "'JetBrains Mono', monospace" }}>
        {order.reason}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'PRICE', value: `$${order.price.toFixed(2)}`, color: '#f5f5f5' },
          { label: 'STOP', value: `$${order.stop_loss.toFixed(2)}`, color: '#f87171' },
          { label: 'TARGET', value: `$${order.target.toFixed(2)}`, color: '#4ade80' },
          { label: 'SHARES', value: order.shares, color: '#e5e7eb' },
          { label: 'SIZE', value: `$${order.dollar_amount.toFixed(0)}`, color: '#fbbf24' },
          { label: 'R:R', value: order.risk_reward, color: '#a78bfa' },
        ].map(m => (
          <div key={m.label} style={{
            padding: '6px 8px', background: '#0d0d0d', borderRadius: 6,
            border: '1px solid #1a1a1a',
          }}>
            <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 600, letterSpacing: '0.1em',
              fontFamily: "'JetBrains Mono', monospace" }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.color, marginTop: 2,
              fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 8, display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span>{order.option_type}</span>
        <span>Conviction: {order.conviction.toFixed(0)}/100</span>
        <span>{order.portfolio_pct.toFixed(1)}% of acct</span>
      </div>
    </div>
  );
}

function LiveSignalRow({ sig }) {
  const [expanded, setExpanded] = useStateLive(false);
  const chgColor = v => v >= 0 ? '#4ade80' : '#f87171';
  const fmtChg = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div style={{
      background: '#111', borderRadius: 8, border: '1px solid #1a1a1a',
      overflow: 'hidden', marginBottom: 4,
    }}>
      <div onClick={() => setExpanded(!expanded)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: '#f5f5f5', width: 56,
            fontFamily: "'JetBrains Mono', monospace",
          }}>{sig.ticker}</span>
          <LiveSignalBadge signal={sig.signal} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5',
            fontFamily: "'JetBrains Mono', monospace" }}>${sig.current_price.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: chgColor(sig.change_1d),
            fontFamily: "'JetBrains Mono', monospace" }}>{fmtChg(sig.change_1d)}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 12px', borderTop: '1px solid #1a1a1a' }}>
          <div style={{
            margin: '8px 0', padding: '8px 10px', borderRadius: 6,
            background: sig.signal_strength > 0 ? '#052e1666' : sig.signal_strength < 0 ? '#2e050566' : '#1c191766',
            border: `1px solid ${sig.signal_strength > 0 ? '#16a34a33' : sig.signal_strength < 0 ? '#dc262633' : '#57534e33'}`,
            fontSize: 11, color: '#d1d5db', lineHeight: 1.5,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            💡 {sig.action_note}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { label: 'RSI', value: sig.rsi.toFixed(0), color: sig.rsi > 70 ? '#f87171' : sig.rsi < 30 ? '#4ade80' : '#9ca3af' },
              { label: 'VOL', value: `${sig.vol_ratio.toFixed(1)}x`, color: sig.vol_ratio > 1.2 ? '#4ade80' : sig.vol_ratio < 0.8 ? '#f87171' : '#fbbf24' },
              { label: 'SPREAD', value: `${sig.ema_spread.toFixed(1)}%`, color: sig.ema_spread > 0 ? '#4ade80' : '#f87171' },
              { label: 'EMA 8', value: `$${sig.ema8.toFixed(2)}`, color: '#22d3ee' },
              { label: 'EMA 21', value: `$${sig.ema21.toFixed(2)}`, color: '#f59e0b' },
              { label: 'EMA 50', value: `$${sig.ema50.toFixed(2)}`, color: '#818cf8' },
              { label: 'STOP', value: `$${sig.stop_loss.toFixed(2)}`, color: '#f87171' },
              { label: 'T1', value: `$${sig.target_1.toFixed(2)}`, color: '#4ade80' },
              { label: 'T2', value: `$${sig.target_2.toFixed(2)}`, color: '#22c55e' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '5px 8px', background: '#0d0d0d', borderRadius: 4,
                border: '1px solid #1a1a1a',
              }}>
                <div style={{ fontSize: 8, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace" }}>{m.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 8, display: 'flex', gap: 8, fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span style={{ color: chgColor(sig.change_5d) }}>5D: {fmtChg(sig.change_5d)}</span>
            <span style={{ color: chgColor(sig.change_20d) }}>20D: {fmtChg(sig.change_20d)}</span>
            <span style={{ color: '#6b7280' }}>Wt: {sig.weight}%</span>
            <span style={{ color: sig.bull_stacked ? '#4ade80' : sig.bear_stacked ? '#f87171' : '#fbbf24' }}>
              {sig.bull_stacked ? '✦ BULL STACK' : sig.bear_stacked ? '✦ BEAR STACK' : 'MIXED'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveScanView() {
  const [scanData, setScanData] = useStateLive(null);
  const [loading, setLoading] = useStateLive(true);
  const [error, setError] = useStateLive(null);
  const [filter, setFilter] = useStateLive('ALL');

  useEffectLive(() => {
    fetch('data/latest-scan.json')
      .then(r => {
        if (!r.ok) throw new Error('No scan data yet');
        return r.json();
      })
      .then(data => { setScanData(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace" }}>
          Loading scan data...
        </div>
      </div>
    );
  }

  if (error || !scanData) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 14, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
          No live scan data available yet.
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
          Run the scanner to generate data:<br />
          <code style={{ color: '#60a5fa' }}>python3 spy_momentum_scanner.py</code><br /><br />
          Or check the simulated dashboards in the other tabs.
        </div>
      </div>
    );
  }

  const { regime, signals, buy_orders, sell_orders, manage_orders, timestamp } = scanData;
  const scanTime = new Date(timestamp);
  const timeAgo = Math.round((Date.now() - scanTime.getTime()) / 60000);
  const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : timeAgo < 1440 ? `${Math.round(timeAgo / 60)}h ago` : `${Math.round(timeAgo / 1440)}d ago`;

  let displayedSignals = [...signals];
  if (filter === 'BULLISH') displayedSignals = displayedSignals.filter(s => s.signal_strength > 0);
  else if (filter === 'BEARISH') displayedSignals = displayedSignals.filter(s => s.signal_strength < 0);
  else if (filter === 'ACTIONABLE') displayedSignals = displayedSignals.filter(s => Math.abs(s.signal_strength) >= 4);
  displayedSignals.sort((a, b) => b.signal_strength - a.signal_strength);

  const regimeColor = regime.regime.includes('STRONG') ? '#4ade80'
    : regime.regime.includes('MODERATE') ? '#86efac'
    : regime.regime.includes('CHOPPY') ? '#fbbf24' : '#f87171';

  return (
    <div style={{ padding: '12px 16px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{
            fontSize: 18, fontWeight: 800, color: '#f5f5f5', margin: 0,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span style={{ color: '#3b82f6' }}>◈</span> LIVE SCAN
          </h1>
          <div style={{
            fontSize: 10, color: '#6b7280', fontFamily: "'JetBrains Mono', monospace",
          }}>
            {scanTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' '}{scanTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            {' '}<span style={{ color: timeAgo < 480 ? '#4ade80' : '#fbbf24' }}>({timeStr})</span>
          </div>
        </div>
      </div>

      {/* Regime */}
      <div style={{
        padding: '12px 14px', background: '#0d0d0d', borderRadius: 10,
        border: `1px solid ${regimeColor}22`, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em' }}>REGIME</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: regimeColor,
              fontFamily: "'JetBrains Mono', monospace" }}>{regime.regime}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: '#4ade80' }}>▲ {regime.bull_count}</span>
            <span style={{ color: '#f87171' }}>▼ {regime.bear_count}</span>
            <span style={{ color: '#9ca3af' }}>— {regime.neutral_count}</span>
          </div>
        </div>
        <div style={{ fontSize: 10, color: regimeColor, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace" }}>
          {regime.sizing_advice}
        </div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4,
          fontFamily: "'JetBrains Mono', monospace" }}>
          {regime.description}
        </div>
        {/* Breadth bar */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: '#1a1a1a' }}>
            <div style={{ width: `${(regime.bull_count / signals.length) * 100}%`, background: '#22c55e' }} />
            <div style={{ width: `${(regime.neutral_count / signals.length) * 100}%`, background: '#6b7280' }} />
            <div style={{ width: `${(regime.bear_count / signals.length) * 100}%`, background: '#ef4444' }} />
          </div>
        </div>
      </div>

      {/* Orders */}
      {(buy_orders.length > 0 || sell_orders.length > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.1em',
            marginBottom: 8, fontFamily: "'JetBrains Mono', monospace",
          }}>
            ⚡ TODAY'S ORDERS — {buy_orders.length + sell_orders.length} ACTION{buy_orders.length + sell_orders.length > 1 ? 'S' : ''}
          </div>
          {buy_orders.map(o => <LiveOrderCard key={`b-${o.ticker}`} order={o} type="buy" />)}
          {sell_orders.map(o => <LiveOrderCard key={`s-${o.ticker}`} order={o} type="sell" />)}
        </div>
      )}

      {manage_orders.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 9, color: '#a78bfa', fontWeight: 700, letterSpacing: '0.1em',
            marginBottom: 8, fontFamily: "'JetBrains Mono', monospace",
          }}>
            🛡️ MANAGE — {manage_orders.length} POSITION{manage_orders.length > 1 ? 'S' : ''}
          </div>
          {manage_orders.map(o => <LiveOrderCard key={`m-${o.ticker}`} order={o} type={o.action.includes('SELL') ? 'sell' : 'buy'} />)}
        </div>
      )}

      {/* Signal filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {['ALL', 'BULLISH', 'BEARISH', 'ACTIONABLE'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '6px 0', borderRadius: 6,
            border: `1px solid ${filter === f ? '#3b82f6' : '#1f2937'}`,
            background: filter === f ? '#3b82f622' : 'transparent',
            color: filter === f ? '#60a5fa' : '#6b7280',
            fontSize: 9, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{f}</button>
        ))}
      </div>

      {/* All signals */}
      <div style={{
        fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em',
        marginBottom: 6, fontFamily: "'JetBrains Mono', monospace",
      }}>
        ALL SIGNALS ({displayedSignals.length})
      </div>
      {displayedSignals.map(sig => (
        <LiveSignalRow key={sig.ticker} sig={sig} />
      ))}

      <div style={{
        marginTop: 16, padding: 10, textAlign: 'center',
        fontSize: 9, color: '#374151', fontFamily: "'JetBrains Mono', monospace",
      }}>
        ⚠️ Not financial advice. Always do your own research.
      </div>
    </div>
  );
}

window.LiveScanView = LiveScanView;
