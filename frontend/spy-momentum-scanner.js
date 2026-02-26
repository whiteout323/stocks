/* Detail Tab — Deep-dive stock analysis using real scan data */
const { useState: useStateDetail, useEffect: useEffectDetail, useMemo: useMemoDetail } = React;

function SpyMomentumScanner() {
  const [scanData, setScanData] = useStateDetail(null);
  const [loading, setLoading] = useStateDetail(true);
  const [selected, setSelected] = useStateDetail(null);
  const [showPlaybook, setShowPlaybook] = useStateDetail(false);

  useEffectDetail(() => {
    fetch('data/latest-scan.json')
      .then(r => { if (!r.ok) throw new Error('No data'); return r.json(); })
      .then(d => { setScanData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center', color: '#555' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u2261'}</div>
        <div style={{ fontSize: 15 }}>Loading analysis...</div>
      </div>
    </div>
  );

  if (!scanData) return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{'\u2261'}</div>
      <div style={{ fontSize: 17, color: '#888', marginBottom: 8 }}>No scan data yet</div>
      <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
        Run the scanner to see detailed stock analysis.
      </div>
    </div>
  );

  const { signals, regime } = scanData;
  const sorted = [...signals].sort((a, b) => b.conviction_score - a.conviction_score);
  const sig = selected ? signals.find(s => s.ticker === selected) : null;

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Playbook modal */}
      {showPlaybook && <PlaybookModal onClose={() => setShowPlaybook(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            Stock Analysis
          </h1>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
            Tap a stock to deep-dive
          </div>
        </div>
        <button onClick={() => setShowPlaybook(true)} style={{
          padding: '8px 14px', background: '#111', border: '1px solid #2563eb33',
          borderRadius: 10, color: '#60a5fa', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Playbook</button>
      </div>

      {/* Stock picker — horizontal scroll chips */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {sorted.map(s => {
          const isActive = selected === s.ticker;
          const accent = s.signal_strength >= 3 ? '#4ade80'
            : s.signal_strength <= -3 ? '#f87171' : '#888';
          return (
            <button key={s.ticker} onClick={() => setSelected(isActive ? null : s.ticker)} style={{
              flexShrink: 0, padding: '10px 16px', borderRadius: 12,
              border: `1px solid ${isActive ? accent : '#222'}`,
              background: isActive ? `${accent}15` : '#111',
              color: isActive ? '#fff' : '#999', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 72,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{s.ticker}</span>
              <span style={{ fontSize: 10, color: accent, fontWeight: 700 }}>
                {s.signal_strength > 0 ? '+' : ''}{s.signal_strength}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected stock deep dive */}
      {sig ? (
        <StockDeepDive sig={sig} regime={regime} />
      ) : (
        /* Overview grid when nothing selected */
        <OverviewGrid signals={sorted} onSelect={setSelected} regime={regime} />
      )}
    </div>
  );
}

function OverviewGrid({ signals, onSelect, regime }) {
  const regimeColor = regime.regime.includes('STRONG') ? '#4ade80'
    : regime.regime.includes('MODERATE') ? '#86efac'
    : regime.regime.includes('CHOPPY') ? '#fbbf24' : '#f87171';

  return (
    <div>
      {/* Regime summary */}
      <div style={{
        padding: '14px 16px', borderRadius: 14, marginBottom: 16,
        background: '#111', border: `1px solid ${regimeColor}25`,
      }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>MARKET REGIME</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: regimeColor, marginBottom: 8 }}>{regime.regime}</div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{regime.sizing_advice}</div>
        <div style={{ marginTop: 10, display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#222' }}>
          <div style={{ width: `${(regime.bull_count / signals.length) * 100}%`, background: '#22c55e' }} />
          <div style={{ width: `${(regime.neutral_count / signals.length) * 100}%`, background: '#555' }} />
          <div style={{ width: `${(regime.bear_count / signals.length) * 100}%`, background: '#ef4444' }} />
        </div>
      </div>

      {/* Sector breakdown */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 }}>
          ALL STOCKS — SIGNAL STRENGTH
        </div>
        {signals.map(s => {
          const pct = ((s.signal_strength + 5) / 10) * 100;
          const color = s.signal_strength >= 3 ? '#4ade80'
            : s.signal_strength >= 1 ? '#86efac'
            : s.signal_strength <= -3 ? '#f87171'
            : s.signal_strength <= -1 ? '#fca5a5' : '#888';
          return (
            <div key={s.ticker} onClick={() => onSelect(s.ticker)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: '#111', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
              border: '1px solid #1a1a1a',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', width: 52 }}>{s.ticker}</span>
              <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.max(pct, 5)}%`, height: '100%', background: color, borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color, width: 30, textAlign: 'right' }}>
                {s.signal_strength > 0 ? '+' : ''}{s.signal_strength}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, color,
                padding: '2px 8px', borderRadius: 6, background: `${color}15`,
                whiteSpace: 'nowrap',
              }}>
                {s.signal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockDeepDive({ sig, regime }) {
  const accent = sig.signal_strength >= 3 ? '#4ade80'
    : sig.signal_strength <= -3 ? '#f87171' : '#fbbf24';
  const isBull = sig.signal_strength > 0;

  // EMA stack status
  const bullStack = sig.ema8 > sig.ema21 && sig.ema21 > sig.ema50;
  const bearStack = sig.ema8 < sig.ema21 && sig.ema21 < sig.ema50;
  const stackLabel = bullStack ? 'BULLISH' : bearStack ? 'BEARISH' : 'MIXED';
  const stackColor = bullStack ? '#4ade80' : bearStack ? '#f87171' : '#fbbf24';

  const distTo8 = ((sig.current_price - sig.ema8) / sig.ema8 * 100).toFixed(1);
  const distTo21 = ((sig.current_price - sig.ema21) / sig.ema21 * 100).toFixed(1);
  const distTo50 = ((sig.current_price - sig.ema50) / sig.ema50 * 100).toFixed(1);

  const riskPerShare = Math.abs(sig.current_price - sig.stop_loss);
  const posSize2pct = riskPerShare > 0 ? Math.floor(500 / riskPerShare) : 0;

  return (
    <div>
      {/* Stock header card */}
      <div style={{
        padding: '16px', borderRadius: 16, marginBottom: 12,
        background: '#111', border: `1px solid ${accent}25`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>{sig.ticker}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: accent,
                padding: '3px 10px', borderRadius: 8, background: `${accent}15`,
              }}>{sig.signal}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>{sig.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>${sig.current_price.toFixed(2)}</div>
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: sig.change_1d >= 0 ? '#4ade80' : '#f87171',
            }}>
              {sig.change_1d >= 0 ? '+' : ''}{sig.change_1d.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Action note */}
        <div style={{
          padding: '12px 14px', borderRadius: 12,
          background: `${accent}08`, border: `1px solid ${accent}20`,
          fontSize: 13, color: '#ccc', lineHeight: 1.6,
        }}>
          {sig.action_note}
        </div>
      </div>

      {/* Momentum strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12,
      }}>
        {[
          { label: '1D', value: sig.change_1d },
          { label: '5D', value: sig.change_5d },
          { label: '20D', value: sig.change_20d },
          { label: 'VOL', value: sig.vol_ratio, isVol: true },
        ].map(m => (
          <div key={m.label} style={{
            padding: '10px', background: '#111', borderRadius: 10,
            border: '1px solid #1a1a1a', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: '#555', fontWeight: 700, marginBottom: 4 }}>{m.label}</div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: m.isVol
                ? (m.value > 1.2 ? '#4ade80' : m.value > 0.8 ? '#fbbf24' : '#f87171')
                : (m.value >= 0 ? '#4ade80' : '#f87171'),
            }}>
              {m.isVol ? `${m.value.toFixed(1)}x` : `${m.value >= 0 ? '+' : ''}${m.value.toFixed(1)}%`}
            </div>
          </div>
        ))}
      </div>

      {/* EMA Stack Analysis */}
      <div style={{
        padding: '16px', borderRadius: 14, marginBottom: 12,
        background: '#111', border: '1px solid #1a1a1a',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em' }}>EMA STACK</div>
          <span style={{
            fontSize: 10, fontWeight: 800, color: stackColor,
            padding: '3px 8px', borderRadius: 6, background: `${stackColor}15`,
          }}>{stackLabel}</span>
        </div>

        {[
          { label: 'EMA 8', value: sig.ema8, dist: distTo8, color: '#22d3ee' },
          { label: 'EMA 21', value: sig.ema21, dist: distTo21, color: '#f59e0b' },
          { label: 'EMA 50', value: sig.ema50, dist: distTo50, color: '#818cf8' },
        ].map(ema => {
          const above = parseFloat(ema.dist) >= 0;
          return (
            <div key={ema.label} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              padding: '8px 12px', background: '#0a0a0a', borderRadius: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ema.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#888', width: 52 }}>{ema.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ddd', flex: 1 }}>${ema.value.toFixed(2)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: above ? '#4ade80' : '#f87171' }}>
                {above ? '\u25B2' : '\u25BC'} {Math.abs(ema.dist)}%
              </span>
            </div>
          );
        })}

        {/* Visual EMA spread bar */}
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>EMA SPREAD (8 vs 50)</div>
          <div style={{ position: 'relative', height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
            {(() => {
              const spread = ((sig.ema8 - sig.ema50) / sig.ema50) * 100;
              const pct = Math.min(Math.abs(spread) * 5, 100);
              return (
                <div style={{
                  position: 'absolute', left: spread >= 0 ? '50%' : `${50 - pct / 2}%`,
                  width: `${pct / 2}%`, height: '100%',
                  background: spread >= 0 ? '#4ade80' : '#f87171', borderRadius: 4,
                }} />
              );
            })()}
            <div style={{
              position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#333',
            }} />
          </div>
        </div>
      </div>

      {/* Key Levels */}
      <div style={{
        padding: '16px', borderRadius: 14, marginBottom: 12,
        background: '#111', border: '1px solid #1a1a1a',
      }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>
          KEY LEVELS
        </div>

        {/* Visual price ladder */}
        {[
          { label: 'TARGET', value: sig.target_1, color: '#4ade80' },
          { label: 'RESISTANCE', value: sig.resistance, color: '#fbbf24' },
          { label: 'CURRENT', value: sig.current_price, color: '#fff', bold: true },
          { label: 'SUPPORT', value: sig.support, color: '#fbbf24' },
          { label: 'STOP', value: sig.stop_loss, color: '#f87171' },
        ].map((level, i) => (
          <div key={level.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', marginBottom: 4,
            background: level.bold ? '#0a1a0a' : '#0a0a0a', borderRadius: 8,
            borderLeft: `3px solid ${level.color}`,
          }}>
            <span style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: '0.05em', width: 80 }}>{level.label}</span>
            <span style={{ fontSize: 15, fontWeight: level.bold ? 800 : 700, color: level.color }}>${level.value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Trade Setup */}
      <div style={{
        padding: '16px', borderRadius: 14, marginBottom: 12,
        background: '#111', border: `1px solid ${accent}25`,
      }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 12 }}>
          TRADE SETUP
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'DIRECTION', value: isBull ? 'LONG' : sig.signal_strength < 0 ? 'SHORT' : 'FLAT', color: accent },
            { label: 'STOP LOSS', value: `$${sig.stop_loss.toFixed(2)}`, color: '#f87171' },
            { label: 'TARGET (2R)', value: `$${sig.target_1.toFixed(2)}`, color: '#4ade80' },
            { label: 'RSI', value: sig.rsi.toFixed(0), color: sig.rsi > 70 ? '#f87171' : sig.rsi < 30 ? '#4ade80' : '#888' },
            { label: 'RISK/SHARE', value: `$${riskPerShare.toFixed(2)}`, color: '#fbbf24' },
            { label: 'SIZE @2%/$25K', value: `${posSize2pct} shares`, color: '#a78bfa' },
          ].map(m => (
            <div key={m.label} style={{
              padding: '10px', background: '#0a0a0a', borderRadius: 8, border: '1px solid #1a1a1a',
            }}>
              <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conviction score */}
      <div style={{
        padding: '14px 16px', borderRadius: 14, background: '#111', border: '1px solid #1a1a1a',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: '0.05em' }}>CONVICTION</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{sig.conviction_score}/10</span>
        </div>
        <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${sig.conviction_score * 10}%`, height: '100%', background: accent, borderRadius: 3,
          }} />
        </div>
      </div>
    </div>
  );
}

function PlaybookModal({ onClose }) {
  const sections = [
    { title: '1. GAUGE THE REGIME', color: '#3b82f6', rules: [
      'Check breadth: >70% bullish = STRONG \u2192 size up',
      '50-70% bullish = moderate \u2192 normal size',
      '<50% bullish = choppy/bearish \u2192 size DOWN',
    ]},
    { title: '2. FIND EMA STACKS', color: '#22d3ee', rules: [
      'Look for 8 > 21 > 50 (bullish) or reverse',
      'Wider spread = stronger trend',
      'Tangled EMAs = STAY OUT',
    ]},
    { title: '3. WAIT FOR PULLBACK', color: '#f59e0b', rules: [
      'Best entries on pullbacks to 8 or 21 EMA',
      'Volume should decrease on pullback',
      'Do NOT chase breakouts',
    ]},
    { title: '4. ENTER WITH CONFIRMATION', color: '#22c55e', rules: [
      'Bounce off EMA with volume spike = GO',
      'Risk 2% of account max per trade',
    ]},
    { title: '5. MANAGE & EXIT', color: '#a78bfa', rules: [
      'Trail stop under 21 EMA for swings',
      'Take partial at 2R, let runner to 3R',
      'EMAs unstack = EXIT immediately',
    ]},
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(12px)', zIndex: 100,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end', padding: 0,
    }} onClick={onClose}>
      <div style={{
        background: '#111', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480,
        padding: '24px 20px', maxHeight: '85vh', overflowY: 'auto',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#333', margin: '0 auto 16px' }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Momentum Playbook</div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>EMA trend-following + volume confirmation</div>
        {sections.map(s => (
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
        <div style={{
          marginTop: 8, padding: 12, background: '#0a0a0a', borderRadius: 10,
          border: '1px solid #fbbf2422',
        }}>
          <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>REMEMBER</div>
          <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6 }}>
            80% of profits come from 20% of trades. Wait for A+ setups. Not financial advice.
          </div>
        </div>
      </div>
    </div>
  );
}

window.SpyMomentumScanner = SpyMomentumScanner;
