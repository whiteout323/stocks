/* Live Scan View — iOS phone-first, action-focused */
const { useState: useStateLive, useEffect: useEffectLive, useMemo: useMemoLive } = React;

function LiveScanView() {
  const [scanData, setScanData] = useStateLive(null);
  const [loading, setLoading] = useStateLive(true);
  const [error, setError] = useStateLive(null);
  const [expandedTicker, setExpandedTicker] = useStateLive(null);

  useEffectLive(() => {
    fetch('data/latest-scan.json')
      .then(r => { if (!r.ok) throw new Error('No scan data'); return r.json(); })
      .then(data => { setScanData(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.5s infinite' }}>&#x25C8;</div>
        <div style={{ fontSize: 15 }}>Loading scan...</div>
      </div>
    </div>
  );

  if (error || !scanData) return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>&#x25C8;</div>
      <div style={{ fontSize: 17, color: '#888', marginBottom: 8 }}>No scan data yet</div>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
        Run the scanner or wait for the daily 6 AM scan.
      </div>
    </div>
  );

  const { regime, signals, buy_orders, sell_orders, manage_orders, timestamp } = scanData;
  const scanTime = new Date(timestamp);
  const timeAgo = Math.round((Date.now() - scanTime.getTime()) / 60000);
  const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : timeAgo < 1440 ? `${Math.round(timeAgo/60)}h ago` : `${Math.round(timeAgo/1440)}d ago`;

  const regimeColor = regime.regime.includes('STRONG') ? '#4ade80'
    : regime.regime.includes('MODERATE') ? '#86efac'
    : regime.regime.includes('CHOPPY') ? '#fbbf24' : '#f87171';

  // Split signals into actionable buys vs others
  const buys = signals.filter(s => s.signal_strength >= 3).sort((a,b) => b.conviction_score - a.conviction_score);
  const avoids = signals.filter(s => s.signal_strength <= -3).sort((a,b) => a.signal_strength - b.signal_strength);
  const holds = signals.filter(s => s.signal_strength > -3 && s.signal_strength < 3);

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Today's Scan
          </h1>
          <span style={{
            fontSize: 13, color: timeAgo < 480 ? '#4ade80' : '#fbbf24', fontWeight: 600,
          }}>{timeStr}</span>
        </div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>
          {scanTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Regime card */}
      <div style={{
        padding: '14px 16px', borderRadius: 16, marginBottom: 20,
        background: '#111', border: `1px solid ${regimeColor}25`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>MARKET</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: regimeColor }}>{regime.regime}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 15, fontWeight: 700 }}>
            <span style={{ color: '#4ade80' }}>{regime.bull_count}</span>
            <span style={{ color: '#666' }}>{regime.neutral_count}</span>
            <span style={{ color: '#f87171' }}>{regime.bear_count}</span>
          </div>
        </div>
        <div style={{
          marginTop: 10, fontSize: 13, color: '#888', lineHeight: 1.5, fontWeight: 500,
        }}>
          {regime.sizing_advice}
        </div>
        {/* Breadth bar */}
        <div style={{ marginTop: 10, display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#222' }}>
          <div style={{ width: `${(regime.bull_count / signals.length) * 100}%`, background: '#22c55e' }} />
          <div style={{ width: `${(regime.neutral_count / signals.length) * 100}%`, background: '#555' }} />
          <div style={{ width: `${(regime.bear_count / signals.length) * 100}%`, background: '#ef4444' }} />
        </div>
      </div>

      {/* BUY section */}
      {buys.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#4ade80', letterSpacing: '0.03em',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>&#x25B2;</span> BUY ({buys.length})
          </div>
          {buys.map(sig => (
            <ActionCard key={sig.ticker} sig={sig} type="buy"
              expanded={expandedTicker === sig.ticker}
              onToggle={() => setExpandedTicker(expandedTicker === sig.ticker ? null : sig.ticker)}
              order={buy_orders.find(o => o.ticker === sig.ticker)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: '20px', borderRadius: 16, marginBottom: 24,
          background: '#111', border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>&#x2014;</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#888', marginBottom: 4 }}>No buys today</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
            Nothing looks good right now. Cash is a position.{'\n'}
            Check back tomorrow.
          </div>
        </div>
      )}

      {/* AVOID section */}
      {avoids.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#f87171', letterSpacing: '0.03em',
            marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16 }}>&#x25BC;</span> AVOID ({avoids.length})
          </div>
          {avoids.map(sig => (
            <ActionCard key={sig.ticker} sig={sig} type="sell"
              expanded={expandedTicker === sig.ticker}
              onToggle={() => setExpandedTicker(expandedTicker === sig.ticker ? null : sig.ticker)}
            />
          ))}
        </div>
      )}

      {/* HOLD / NEUTRAL */}
      {holds.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#666', letterSpacing: '0.03em',
            marginBottom: 10,
          }}>
            HOLD / WAIT ({holds.length})
          </div>
          {holds.map(sig => (
            <ActionCard key={sig.ticker} sig={sig} type="neutral"
              expanded={expandedTicker === sig.ticker}
              onToggle={() => setExpandedTicker(expandedTicker === sig.ticker ? null : sig.ticker)}
            />
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: '#333' }}>
        Not financial advice. Do your own research.
      </div>
    </div>
  );
}

function ActionCard({ sig, type, expanded, onToggle, order }) {
  const isBuy = type === 'buy';
  const isSell = type === 'sell';

  const accent = isBuy ? '#4ade80' : isSell ? '#f87171' : '#888';
  const accentBg = isBuy ? '#0a1a0a' : isSell ? '#1a0a0a' : '#111';
  const borderColor = isBuy ? 'rgba(74,222,128,0.15)' : isSell ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)';
  const chg = sig.change_1d;

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden', marginBottom: 8,
      background: '#111', border: `1px solid ${borderColor}`,
    }}>
      {/* Main row — always visible */}
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', padding: '14px 16px',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        {/* Left: ticker + signal */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{sig.ticker}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, color: accent,
              padding: '2px 8px', borderRadius: 6,
              background: `${accent}15`,
            }}>
              {sig.signal}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>{sig.name}</div>
        </div>

        {/* Right: price + change */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
            ${sig.current_price.toFixed(2)}
          </div>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: chg >= 0 ? '#4ade80' : '#f87171',
          }}>
            {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Action note */}
          <div style={{
            padding: '12px 14px', borderRadius: 12, marginBottom: 12,
            background: accentBg, border: `1px solid ${accent}20`,
            fontSize: 14, color: '#ccc', lineHeight: 1.6, fontWeight: 500,
          }}>
            {sig.action_note}
          </div>

          {/* Key levels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'STOP', value: `$${sig.stop_loss.toFixed(2)}`, color: '#f87171' },
              { label: 'TARGET', value: `$${sig.target_1.toFixed(2)}`, color: '#4ade80' },
              { label: 'RSI', value: sig.rsi.toFixed(0), color: sig.rsi > 70 ? '#f87171' : sig.rsi < 30 ? '#4ade80' : '#888' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '10px', background: '#0a0a0a', borderRadius: 10,
                border: '1px solid #1a1a1a', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* EMA levels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'EMA 8', value: `$${sig.ema8.toFixed(2)}`, color: '#22d3ee' },
              { label: 'EMA 21', value: `$${sig.ema21.toFixed(2)}`, color: '#f59e0b' },
              { label: 'EMA 50', value: `$${sig.ema50.toFixed(2)}`, color: '#818cf8' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '10px', background: '#0a0a0a', borderRadius: 10,
                border: '1px solid #1a1a1a', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Momentum strip */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
            background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a',
            fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ color: chg >= 0 ? '#4ade80' : '#f87171' }}>1D: {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%</span>
            <span style={{ color: sig.change_5d >= 0 ? '#4ade80' : '#f87171' }}>5D: {sig.change_5d >= 0 ? '+' : ''}{sig.change_5d.toFixed(1)}%</span>
            <span style={{ color: sig.change_20d >= 0 ? '#4ade80' : '#f87171' }}>20D: {sig.change_20d >= 0 ? '+' : ''}{sig.change_20d.toFixed(1)}%</span>
            <span style={{ color: sig.vol_ratio > 1 ? '#4ade80' : '#fbbf24' }}>Vol: {sig.vol_ratio.toFixed(1)}x</span>
          </div>

          {/* Order info if available */}
          {order && (
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 12,
              background: isBuy ? '#052e1644' : '#2e050544',
              border: `1px solid ${accent}30`,
            }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>ORDER</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#666' }}>SHARES</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{order.shares}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#666' }}>AMOUNT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>${order.dollar_amount.toFixed(0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#666' }}>R:R</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>{order.risk_reward}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.LiveScanView = LiveScanView;
