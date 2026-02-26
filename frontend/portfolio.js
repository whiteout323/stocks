/* Portfolio Tracker — reads static portfolio.json, trades managed via GitHub Actions */
const { useState: useStatePort, useEffect: useEffectPort, useMemo: useMemoPort } = React;

const EMPTY_PORTFOLIO = { starting_cash: 1000, positions: [], history: [] };

function PortfolioView() {
  const [portfolio, setPortfolio] = useStatePort(EMPTY_PORTFOLIO);
  const [scanData, setScanData] = useStatePort(null);
  const [loading, setLoading] = useStatePort(true);
  const [lastUpdated, setLastUpdated] = useStatePort(null);

  // Load scan data for live prices
  useEffectPort(() => {
    fetch('data/latest-scan.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => setScanData(data))
      .catch(() => {});
  }, []);

  // Load portfolio from static file (deployed by GitHub Pages)
  useEffectPort(() => {
    fetch('data/portfolio.json')
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(data => {
        setPortfolio(data);
        setLastUpdated(data.last_updated || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const priceMap = useMemoPort(() => {
    if (!scanData) return {};
    const map = {};
    scanData.signals.forEach(s => { map[s.ticker] = s; });
    return map;
  }, [scanData]);

  const startingCash = portfolio.starting_cash || 1000;
  const totalInvested = portfolio.positions.reduce((s, p) => s + p.cost, 0);
  const totalCurrent = portfolio.positions.reduce((s, p) => {
    const sig = priceMap[p.ticker];
    return s + (sig ? sig.current_price : p.buyPrice) * p.shares;
  }, 0);
  const openPnL = totalCurrent - totalInvested;
  const closedPnL = portfolio.history.reduce((s, h) => s + h.pnl, 0);
  const cashRemaining = startingCash - totalInvested + portfolio.history.reduce((s, h) => s + h.cost + h.pnl, 0);
  const totalValue = cashRemaining + totalCurrent;
  const totalReturn = totalValue - startingCash;
  const totalReturnPct = (totalReturn / startingCash) * 100;

  if (loading) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: '#555' }}>Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Portfolio</h1>
      </div>

      {/* Last updated */}
      <div style={{ marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
          background: portfolio.positions.length > 0 || portfolio.history.length > 0 ? '#4ade80' : '#555',
        }} />
        <span style={{ color: '#555' }}>
          {lastUpdated ? 'Updated ' + lastUpdated : 'Manage trades via GitHub Actions'}
        </span>
      </div>

      {/* Account value card */}
      <div style={{
        padding: '20px', borderRadius: 20, marginBottom: 20,
        background: 'linear-gradient(135deg, #111 0%, #0a0a0a 100%)',
        border: `1px solid ${totalReturn >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)'}`,
      }}>
        <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 6 }}>TOTAL VALUE</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-1px', marginBottom: 4 }}>
          ${totalValue.toFixed(2)}
        </div>
        <div style={{
          fontSize: 17, fontWeight: 700,
          color: totalReturn >= 0 ? '#4ade80' : '#f87171',
          marginBottom: 16,
        }}>
          {totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)} ({totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(1)}%)
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Cash', value: `$${cashRemaining.toFixed(0)}`, color: '#e5e7eb' },
            { label: 'Open', value: `${openPnL >= 0 ? '+' : ''}$${openPnL.toFixed(2)}`, color: openPnL >= 0 ? '#4ade80' : '#f87171' },
            { label: 'Closed', value: `${closedPnL >= 0 ? '+' : ''}$${closedPnL.toFixed(2)}`, color: closedPnL >= 0 ? '#4ade80' : '#f87171' },
          ].map(m => (
            <div key={m.label} style={{
              flex: 1, padding: '10px', background: '#000', borderRadius: 12, textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#555', fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Open positions */}
      {portfolio.positions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#888', letterSpacing: '0.03em', marginBottom: 10 }}>
            OPEN ({portfolio.positions.length})
          </div>
          {portfolio.positions.map(pos => {
            const sig = priceMap[pos.ticker];
            const curPrice = sig ? sig.current_price : null;
            const pnl = curPrice ? (curPrice - pos.buyPrice) * pos.shares : null;
            const pnlPct = curPrice ? ((curPrice - pos.buyPrice) / pos.buyPrice) * 100 : null;

            return (
              <div key={pos.id} style={{
                borderRadius: 14, overflow: 'hidden', marginBottom: 8,
                background: '#111', border: `1px solid ${pnl !== null ? (pnl >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)') : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{pos.ticker}</span>
                      {sig && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          color: sig.signal_strength > 0 ? '#4ade80' : sig.signal_strength < 0 ? '#f87171' : '#888',
                          background: sig.signal_strength > 0 ? 'rgba(74,222,128,0.1)' : sig.signal_strength < 0 ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                        }}>{sig.signal}</span>
                      )}
                    </div>
                    {pnl !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 12, color: pnl >= 0 ? '#4ade80' : '#f87171' }}>
                          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[
                      { label: 'Buy', value: `$${pos.buyPrice.toFixed(2)}` },
                      { label: 'Now', value: curPrice ? `$${curPrice.toFixed(2)}` : '-' },
                      { label: 'Shares', value: pos.shares },
                      { label: 'Value', value: curPrice ? `$${(curPrice * pos.shares).toFixed(0)}` : `$${pos.cost.toFixed(0)}` },
                    ].map(m => (
                      <div key={m.label} style={{
                        flex: 1, padding: '8px', background: '#0a0a0a', borderRadius: 10, textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 10, color: '#555', fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ddd' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {sig && sig.signal_strength <= -3 && (
                    <div style={{
                      padding: '12px 14px', borderRadius: 10, marginBottom: 10,
                      background: '#2e0505', border: '1px solid rgba(248,113,113,0.3)',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>EXIT SIGNAL</div>
                      <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
                        Scanner says {sig.signal}. Consider selling.
                      </div>
                    </div>
                  )}

                  {sig && sig.signal_strength >= 3 && (
                    <div style={{
                      padding: '10px 12px', borderRadius: 10, marginBottom: 10,
                      background: '#052e16', border: '1px solid rgba(74,222,128,0.15)',
                      fontSize: 13, color: '#86efac', lineHeight: 1.5,
                    }}>
                      Hold — {sig.action_note}
                    </div>
                  )}

                  {sig && sig.signal_strength > -3 && sig.signal_strength < 3 && sig.action_note && (
                    <div style={{
                      padding: '10px 12px', borderRadius: 10, marginBottom: 10,
                      background: '#0a0a0a', fontSize: 12, color: '#888', lineHeight: 1.5,
                    }}>
                      {sig.action_note}
                    </div>
                  )}

                  {sig && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, padding: '8px', background: '#1a0a0a', borderRadius: 8, textAlign: 'center',
                        border: '1px solid rgba(248,113,113,0.1)',
                      }}>
                        <div style={{ fontSize: 9, color: '#f87171', fontWeight: 700, marginBottom: 2 }}>STOP</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5' }}>${sig.stop_loss.toFixed(2)}</div>
                      </div>
                      <div style={{
                        flex: 1, padding: '8px', background: '#0a1a0a', borderRadius: 8, textAlign: 'center',
                        border: '1px solid rgba(74,222,128,0.1)',
                      }}>
                        <div style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, marginBottom: 2 }}>TARGET</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#86efac' }}>${sig.target_1.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {portfolio.positions.length === 0 && (
        <div style={{
          padding: '40px 20px', borderRadius: 20, background: '#111',
          border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>$</div>
          <div style={{ fontSize: 17, color: '#888', fontWeight: 600, marginBottom: 6 }}>No positions yet</div>
          <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            Check the Scan tab for buys, then go to<br/>
            Actions &rarr; Manage Trade to log your trades.
          </div>
        </div>
      )}

      {/* Closed trades */}
      {portfolio.history.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#555', letterSpacing: '0.03em', marginBottom: 10 }}>
            CLOSED ({portfolio.history.length})
          </div>
          {portfolio.history.slice().reverse().map((h, i) => (
            <div key={i} style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 6,
              background: '#111', border: `1px solid ${h.pnl >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{h.ticker}</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  ${h.buyPrice.toFixed(2)} &#x2192; ${h.closePrice.toFixed(2)} &middot; {h.shares} sh
                </div>
              </div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: h.pnl >= 0 ? '#4ade80' : '#f87171',
              }}>
                {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 12, color: '#333' }}>
        ${startingCash} starting capital
      </div>
    </div>
  );
}

window.PortfolioView = PortfolioView;
