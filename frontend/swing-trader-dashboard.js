/* Swing Tab — Compact trade execution board using real scan data */
const { useState: useStateST, useEffect: useEffectST, useMemo: useMemoST } = React;

function SwingTraderDashboard() {
  const [scanData, setScanData] = useStateST(null);
  const [loading, setLoading] = useStateST(true);
  const [filter, setFilter] = useStateST('actionable'); // actionable, all, bullish, bearish
  const [expandedTicker, setExpandedTicker] = useStateST(null);
  const [showRules, setShowRules] = useStateST(false);

  useEffectST(() => {
    fetch('data/latest-scan.json')
      .then(r => { if (!r.ok) throw new Error('No data'); return r.json(); })
      .then(d => { setScanData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemoST(() => {
    if (!scanData) return [];
    const sigs = [...scanData.signals];
    if (filter === 'actionable') return sigs.filter(s => Math.abs(s.signal_strength) >= 3).sort((a, b) => b.conviction_score - a.conviction_score);
    if (filter === 'bullish') return sigs.filter(s => s.signal_strength > 0).sort((a, b) => b.signal_strength - a.signal_strength);
    if (filter === 'bearish') return sigs.filter(s => s.signal_strength < 0).sort((a, b) => a.signal_strength - b.signal_strength);
    return sigs.sort((a, b) => b.conviction_score - a.conviction_score);
  }, [scanData, filter]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u223F'}</div>
        <div style={{ fontSize: 15 }}>Loading trades...</div>
      </div>
    </div>
  );

  if (!scanData) return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{'\u223F'}</div>
      <div style={{ fontSize: 17, color: '#888', marginBottom: 8 }}>No scan data yet</div>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
        Run the scanner to see trade setups.
      </div>
    </div>
  );

  const { regime, buy_orders, signals } = scanData;
  const bullCount = signals.filter(s => s.signal_strength > 0).length;
  const bearCount = signals.filter(s => s.signal_strength < 0).length;
  const actionableCount = signals.filter(s => Math.abs(s.signal_strength) >= 3).length;

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Rules modal */}
      {showRules && <SwingRulesModal onClose={() => setShowRules(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Trade Board
          </h1>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
            {actionableCount} actionable setup{actionableCount !== 1 ? 's' : ''} today
          </div>
        </div>
        <button onClick={() => setShowRules(true)} style={{
          padding: '8px 14px', background: '#111', border: '1px solid #2563eb33',
          borderRadius: 10, color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Rules</button>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'BULL', value: bullCount, color: '#4ade80' },
          { label: 'BEAR', value: bearCount, color: '#f87171' },
          { label: 'SETUPS', value: actionableCount, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '10px', background: '#111', borderRadius: 10,
            border: '1px solid #1a1a1a', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {[
          { key: 'actionable', label: 'Actionable', count: actionableCount },
          { key: 'bullish', label: 'Bullish', count: bullCount },
          { key: 'bearish', label: 'Bearish', count: bearCount },
          { key: 'all', label: 'All', count: signals.length },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: 10,
            border: `1px solid ${filter === f.key ? '#3b82f6' : '#222'}`,
            background: filter === f.key ? '#3b82f622' : '#111',
            color: filter === f.key ? '#60a5fa' : '#888',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Trade cards */}
      {filtered.length === 0 ? (
        <div style={{
          padding: '32px 20px', textAlign: 'center',
          background: '#111', borderRadius: 14, border: '1px solid #1a1a1a',
        }}>
          <div style={{ fontSize: 16, color: '#555', marginBottom: 4 }}>No setups match this filter</div>
          <div style={{ fontSize: 13, color: '#444' }}>Try switching to "All" to see everything.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(sig => {
            const isExpanded = expandedTicker === sig.ticker;
            const order = buy_orders ? buy_orders.find(o => o.ticker === sig.ticker) : null;
            return (
              <SwingCard
                key={sig.ticker}
                sig={sig}
                order={order}
                expanded={isExpanded}
                onToggle={() => setExpandedTicker(isExpanded ? null : sig.ticker)}
              />
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 0', fontSize: 11, color: '#333' }}>
        Not financial advice. Do your own research.
      </div>
    </div>
  );
}

function SwingCard({ sig, order, expanded, onToggle }) {
  const accent = sig.signal_strength >= 3 ? '#4ade80'
    : sig.signal_strength <= -3 ? '#f87171' : '#888';
  const isBull = sig.signal_strength > 0;

  const riskPerShare = Math.abs(sig.current_price - sig.stop_loss);
  const rewardPerShare = Math.abs(sig.target_1 - sig.current_price);
  const rr = riskPerShare > 0 ? (rewardPerShare / riskPerShare).toFixed(1) : '0';

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      background: '#111', border: `1px solid ${expanded ? `${accent}30` : '#1a1a1a'}`,
    }}>
      {/* Collapsed row */}
      <div onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', padding: '14px 16px',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{sig.ticker}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: accent,
              padding: '2px 8px', borderRadius: 6, background: `${accent}15`,
            }}>{sig.signal}</span>
            {order && (
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#fbbf24',
                padding: '2px 6px', borderRadius: 4, background: '#fbbf2415',
              }}>ORDER</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#555' }}>{sig.name}</div>
        </div>

        <div style={{ textAlign: 'right', marginRight: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>${sig.current_price.toFixed(2)}</div>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: sig.change_1d >= 0 ? '#4ade80' : '#f87171',
          }}>
            {sig.change_1d >= 0 ? '+' : ''}{sig.change_1d.toFixed(2)}%
          </div>
        </div>

        {/* Conviction mini-bar */}
        <div style={{ width: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>{sig.conviction_score}</div>
          <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
            <div style={{ width: `${sig.conviction_score * 10}%`, height: '100%', background: accent, borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Expanded trade plan */}
      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Quick trade levels */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10,
          }}>
            {[
              { label: 'STOP', value: `$${sig.stop_loss.toFixed(2)}`, color: '#f87171' },
              { label: 'TARGET', value: `$${sig.target_1.toFixed(2)}`, color: '#4ade80' },
              { label: 'R:R', value: `${rr}x`, color: '#a78bfa' },
            ].map(m => (
              <div key={m.label} style={{
                padding: '10px', background: '#0a0a0a', borderRadius: 10,
                border: '1px solid #1a1a1a', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: '#555', fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Momentum + RSI row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 14px',
            background: '#0a0a0a', borderRadius: 10, border: '1px solid #1a1a1a', marginBottom: 10,
            fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ color: sig.change_5d >= 0 ? '#4ade80' : '#f87171' }}>
              5D: {sig.change_5d >= 0 ? '+' : ''}{sig.change_5d.toFixed(1)}%
            </span>
            <span style={{ color: sig.change_20d >= 0 ? '#4ade80' : '#f87171' }}>
              20D: {sig.change_20d >= 0 ? '+' : ''}{sig.change_20d.toFixed(1)}%
            </span>
            <span style={{ color: sig.rsi > 70 ? '#f87171' : sig.rsi < 30 ? '#4ade80' : '#888' }}>
              RSI: {sig.rsi.toFixed(0)}
            </span>
            <span style={{ color: sig.vol_ratio > 1.2 ? '#4ade80' : sig.vol_ratio > 0.8 ? '#fbbf24' : '#f87171' }}>
              Vol: {sig.vol_ratio.toFixed(1)}x
            </span>
          </div>

          {/* EMA quick row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10,
          }}>
            {[
              { label: 'EMA 8', value: sig.ema8, color: '#22d3ee' },
              { label: 'EMA 21', value: sig.ema21, color: '#f59e0b' },
              { label: 'EMA 50', value: sig.ema50, color: '#818cf8' },
            ].map(ema => {
              const above = sig.current_price > ema.value;
              return (
                <div key={ema.label} style={{
                  padding: '8px', background: '#0a0a0a', borderRadius: 8,
                  border: '1px solid #1a1a1a', textAlign: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: ema.color }} />
                    <span style={{ fontSize: 9, color: '#666', fontWeight: 700 }}>{ema.label}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>${ema.value.toFixed(2)}</div>
                  <div style={{ fontSize: 9, color: above ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                    {above ? 'ABOVE' : 'BELOW'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action note */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: `${accent}08`, border: `1px solid ${accent}20`,
            fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 10,
          }}>
            {sig.action_note}
          </div>

          {/* Order details if we have one */}
          {order && (
            <div style={{
              padding: '12px 14px', borderRadius: 12,
              background: '#052e1622', border: '1px solid #22c55e25',
            }}>
              <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>
                RECOMMENDED ORDER
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#666', fontWeight: 600, marginBottom: 2 }}>SHARES</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{order.shares}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666', fontWeight: 600, marginBottom: 2 }}>AMOUNT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>${order.dollar_amount.toFixed(0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#666', fontWeight: 600, marginBottom: 2 }}>R:R</div>
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

function SwingRulesModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)', zIndex: 100,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        background: '#111', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        padding: '24px 20px', maxHeight: '80vh', overflowY: 'auto',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Swing Trade Rules</div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>Position sizing + risk management</div>

        {[
          { title: 'ENTRY', color: '#22c55e', rules: [
            'Only enter on pullback to 8/21 EMA in stacked trend',
            'Volume should decrease on pullback, spike on bounce',
            'Prefer entries when conviction score is 7+',
          ]},
          { title: 'POSITION SIZE', color: '#a78bfa', rules: [
            'Risk max 2% of account per trade ($500 on $25K)',
            'Shares = $risk / (entry - stop distance)',
            'Strong regime: full size | Choppy: half size',
          ]},
          { title: 'EXIT RULES', color: '#f59e0b', rules: [
            'Stop loss: below support or 21 EMA',
            'Target 1: take half at 2R (2x your risk)',
            'Target 2: trail rest with stop at 21 EMA',
            'EMAs unstack = close everything',
          ]},
          { title: 'LOSING STREAKS', color: '#f87171', rules: [
            '2 losses in a row: cut size by 50%',
            '3 losses: stop trading, re-evaluate regime',
            'Never revenge trade to get it back',
          ]},
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: s.color, marginBottom: 6, letterSpacing: '0.04em' }}>
              {s.title}
            </div>
            {s.rules.map((r, i) => (
              <div key={i} style={{
                fontSize: 13, color: '#ccc', lineHeight: 1.7, paddingLeft: 12,
                borderLeft: `2px solid ${s.color}33`, marginBottom: 3,
              }}>{r}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

window.SwingTraderDashboard = SwingTraderDashboard;
