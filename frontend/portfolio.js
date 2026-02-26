/* Portfolio Tracker — Track your Robinhood positions with buy prices */
const { useState: useStatePort, useEffect: useEffectPort, useMemo: useMemoPort } = React;

const PORTFOLIO_KEY = 'spy-scanner-portfolio';
const STARTING_CASH = 1000;

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : { positions: [], history: [] };
  } catch { return { positions: [], history: [] }; }
}

function savePortfolio(data) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(data));
}

function PortfolioView() {
  const [portfolio, setPortfolio] = useStatePort(loadPortfolio);
  const [scanData, setScanData] = useStatePort(null);
  const [showAdd, setShowAdd] = useStatePort(false);
  const [showClose, setShowClose] = useStatePort(null);
  const [closePrice, setClosePrice] = useStatePort('');
  const [form, setForm] = useStatePort({ ticker: '', buyPrice: '', shares: '', date: new Date().toISOString().slice(0, 10) });

  useEffectPort(() => {
    fetch('data/latest-scan.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => setScanData(data))
      .catch(() => {});
  }, []);

  useEffectPort(() => { savePortfolio(portfolio); }, [portfolio]);

  const priceMap = useMemoPort(() => {
    if (!scanData) return {};
    const map = {};
    scanData.signals.forEach(s => { map[s.ticker] = s; });
    return map;
  }, [scanData]);

  const addPosition = () => {
    const ticker = form.ticker.toUpperCase().trim();
    const buyPrice = parseFloat(form.buyPrice);
    const shares = parseFloat(form.shares);
    if (!ticker || isNaN(buyPrice) || isNaN(shares) || buyPrice <= 0 || shares <= 0) return;

    const newPos = {
      id: Date.now(),
      ticker,
      buyPrice,
      shares,
      date: form.date,
      cost: buyPrice * shares,
    };
    setPortfolio(prev => ({ ...prev, positions: [...prev.positions, newPos] }));
    setForm({ ticker: '', buyPrice: '', shares: '', date: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
  };

  const closePosition = (id) => {
    const price = parseFloat(closePrice);
    if (isNaN(price) || price <= 0) return;
    const pos = portfolio.positions.find(p => p.id === id);
    if (!pos) return;
    const pnl = (price - pos.buyPrice) * pos.shares;
    const closed = { ...pos, closePrice: price, closeDate: new Date().toISOString().slice(0, 10), pnl };
    setPortfolio(prev => ({
      positions: prev.positions.filter(p => p.id !== id),
      history: [...prev.history, closed],
    }));
    setShowClose(null);
    setClosePrice('');
  };

  const removePosition = (id) => {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.id !== id),
    }));
  };

  // Calculate portfolio stats
  const totalInvested = portfolio.positions.reduce((s, p) => s + p.cost, 0);
  const totalCurrent = portfolio.positions.reduce((s, p) => {
    const sig = priceMap[p.ticker];
    const curPrice = sig ? sig.current_price : p.buyPrice;
    return s + curPrice * p.shares;
  }, 0);
  const openPnL = totalCurrent - totalInvested;
  const closedPnL = portfolio.history.reduce((s, h) => s + h.pnl, 0);
  const cashRemaining = STARTING_CASH - totalInvested + portfolio.history.reduce((s, h) => s + h.cost + h.pnl, 0);
  const totalValue = cashRemaining + totalCurrent;
  const totalReturn = totalValue - STARTING_CASH;
  const totalReturnPct = (totalReturn / STARTING_CASH) * 100;

  const mono = "'JetBrains Mono', monospace";
  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #2a2a2a', background: '#0d0d0d', color: '#f5f5f5',
    fontSize: 13, fontFamily: mono, outline: 'none',
  };

  return (
    <div style={{ padding: '12px 16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f5f5f5', margin: 0, fontFamily: mono }}>
          <span style={{ color: '#fbbf24' }}>$</span> PORTFOLIO
        </h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '6px 14px', borderRadius: 6, border: '1px solid #3b82f6',
          background: '#3b82f622', color: '#60a5fa', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', fontFamily: mono,
        }}>
          + ADD TRADE
        </button>
      </div>

      {/* Account summary */}
      <div style={{
        padding: '14px', background: '#0d0d0d', borderRadius: 10,
        border: `1px solid ${totalReturn >= 0 ? '#16a34a22' : '#dc262622'}`, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em' }}>TOTAL VALUE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f5f5f5', fontFamily: mono }}>
              ${totalValue.toFixed(2)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 16, fontWeight: 700, fontFamily: mono,
              color: totalReturn >= 0 ? '#4ade80' : '#f87171',
            }}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}
            </div>
            <div style={{
              fontSize: 11, fontFamily: mono,
              color: totalReturn >= 0 ? '#4ade80' : '#f87171',
            }}>
              ({totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}%)
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'CASH', value: `$${cashRemaining.toFixed(2)}`, color: '#e5e7eb' },
            { label: 'OPEN P&L', value: `${openPnL >= 0 ? '+' : ''}$${openPnL.toFixed(2)}`, color: openPnL >= 0 ? '#4ade80' : '#f87171' },
            { label: 'CLOSED P&L', value: `${closedPnL >= 0 ? '+' : ''}$${closedPnL.toFixed(2)}`, color: closedPnL >= 0 ? '#4ade80' : '#f87171' },
          ].map(m => (
            <div key={m.label} style={{ padding: '6px 8px', background: '#111', borderRadius: 6, border: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 8, color: '#6b7280', fontWeight: 600, letterSpacing: '0.1em', fontFamily: mono }}>{m.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.color, marginTop: 2, fontFamily: mono }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add position form */}
      {showAdd && (
        <div style={{
          padding: 14, background: '#0d0d0d', borderRadius: 10,
          border: '1px solid #3b82f644', marginBottom: 12,
        }}>
          <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10, fontFamily: mono }}>
            ADD POSITION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 4, fontFamily: mono }}>TICKER</div>
              <input
                value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })}
                placeholder="AAPL" style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 4, fontFamily: mono }}>DATE</div>
              <input
                type="date" value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 4, fontFamily: mono }}>BUY PRICE</div>
              <input
                type="number" step="0.01" value={form.buyPrice}
                onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                placeholder="0.00" style={inputStyle}
              />
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#6b7280', marginBottom: 4, fontFamily: mono }}>SHARES</div>
              <input
                type="number" step="0.01" value={form.shares}
                onChange={e => setForm({ ...form, shares: e.target.value })}
                placeholder="0" style={inputStyle}
              />
            </div>
          </div>
          {form.buyPrice && form.shares && (
            <div style={{ fontSize: 11, color: '#fbbf24', fontFamily: mono, marginBottom: 10 }}>
              Total cost: ${(parseFloat(form.buyPrice || 0) * parseFloat(form.shares || 0)).toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addPosition} style={{
              flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #16a34a',
              background: '#052e16', color: '#4ade80', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: mono,
            }}>CONFIRM</button>
            <button onClick={() => setShowAdd(false)} style={{
              flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #374151',
              background: 'transparent', color: '#6b7280', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: mono,
            }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Open positions */}
      <div style={{
        fontSize: 9, color: '#fbbf24', fontWeight: 700, letterSpacing: '0.1em',
        marginBottom: 8, fontFamily: mono,
      }}>
        OPEN POSITIONS ({portfolio.positions.length})
      </div>

      {portfolio.positions.length === 0 ? (
        <div style={{
          padding: '24px 14px', background: '#0d0d0d', borderRadius: 10,
          border: '1px solid #1a1a1a', textAlign: 'center', marginBottom: 16,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>$</div>
          <div style={{ fontSize: 12, color: '#6b7280', fontFamily: mono }}>No open positions</div>
          <div style={{ fontSize: 10, color: '#4b5563', fontFamily: mono, marginTop: 4 }}>
            Check the LIVE SCAN tab for today's picks, then add your trades here.
          </div>
        </div>
      ) : (
        portfolio.positions.map(pos => {
          const sig = priceMap[pos.ticker];
          const curPrice = sig ? sig.current_price : null;
          const pnl = curPrice ? (curPrice - pos.buyPrice) * pos.shares : null;
          const pnlPct = curPrice ? ((curPrice - pos.buyPrice) / pos.buyPrice) * 100 : null;
          const signal = sig ? sig.signal : null;
          const isClosing = showClose === pos.id;

          return (
            <div key={pos.id} style={{
              padding: '12px 14px', background: '#111', borderRadius: 10,
              border: `1px solid ${pnl !== null ? (pnl >= 0 ? '#16a34a22' : '#dc262622') : '#1a1a1a'}`,
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#f5f5f5', fontFamily: mono }}>{pos.ticker}</span>
                  {signal && (
                    <span style={{
                      fontSize: 9, padding: '3px 8px', borderRadius: 4,
                      background: sig.signal_strength > 0 ? '#052e16' : sig.signal_strength < 0 ? '#2e0505' : '#1c1917',
                      border: `1px solid ${sig.signal_strength > 0 ? '#16a34a' : sig.signal_strength < 0 ? '#dc2626' : '#57534e'}`,
                      color: sig.signal_strength > 0 ? '#4ade80' : sig.signal_strength < 0 ? '#f87171' : '#a8a29e',
                      fontWeight: 700, fontFamily: mono,
                    }}>{signal}</span>
                  )}
                </div>
                {pnl !== null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, fontFamily: mono,
                      color: pnl >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: 10, fontFamily: mono,
                      color: pnl >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                {[
                  { label: 'BUY', value: `$${pos.buyPrice.toFixed(2)}`, color: '#e5e7eb' },
                  { label: 'NOW', value: curPrice ? `$${curPrice.toFixed(2)}` : '—', color: '#f5f5f5' },
                  { label: 'SHARES', value: pos.shares, color: '#e5e7eb' },
                  { label: 'VALUE', value: curPrice ? `$${(curPrice * pos.shares).toFixed(2)}` : `$${pos.cost.toFixed(2)}`, color: '#fbbf24' },
                ].map(m => (
                  <div key={m.label} style={{ padding: '5px 6px', background: '#0d0d0d', borderRadius: 4, border: '1px solid #1a1a1a' }}>
                    <div style={{ fontSize: 7, color: '#6b7280', fontWeight: 600, letterSpacing: '0.1em', fontFamily: mono }}>{m.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: m.color, marginTop: 1, fontFamily: mono }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#4b5563', fontFamily: mono }}>
                  Bought {pos.date} | Cost: ${pos.cost.toFixed(2)}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isClosing ? (
                    <>
                      <button onClick={() => { setShowClose(pos.id); setClosePrice(curPrice ? curPrice.toFixed(2) : ''); }} style={{
                        padding: '4px 10px', borderRadius: 4, border: '1px solid #fbbf2444',
                        background: 'transparent', color: '#fbbf24', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', fontFamily: mono,
                      }}>SELL</button>
                      <button onClick={() => removePosition(pos.id)} style={{
                        padding: '4px 10px', borderRadius: 4, border: '1px solid #37415144',
                        background: 'transparent', color: '#6b7280', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', fontFamily: mono,
                      }}>DEL</button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="number" step="0.01" value={closePrice}
                        onChange={e => setClosePrice(e.target.value)}
                        placeholder="Sell price"
                        style={{ ...inputStyle, width: 90, padding: '4px 6px', fontSize: 11 }}
                      />
                      <button onClick={() => closePosition(pos.id)} style={{
                        padding: '4px 8px', borderRadius: 4, border: '1px solid #16a34a',
                        background: '#052e16', color: '#4ade80', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', fontFamily: mono,
                      }}>OK</button>
                      <button onClick={() => setShowClose(null)} style={{
                        padding: '4px 8px', borderRadius: 4, border: '1px solid #374151',
                        background: 'transparent', color: '#6b7280', fontSize: 9, fontWeight: 700,
                        cursor: 'pointer', fontFamily: mono,
                      }}>X</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Scanner recommendation for this position */}
              {sig && sig.action_note && (
                <div style={{
                  marginTop: 8, padding: '6px 8px', borderRadius: 4,
                  background: sig.signal_strength > 0 ? '#052e1633' : sig.signal_strength < 0 ? '#2e050533' : '#1c191733',
                  fontSize: 9, color: '#9ca3af', fontFamily: mono, lineHeight: 1.5,
                }}>
                  SCANNER: {sig.action_note}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Closed trades */}
      {portfolio.history.length > 0 && (
        <>
          <div style={{
            fontSize: 9, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em',
            marginTop: 16, marginBottom: 8, fontFamily: mono,
          }}>
            CLOSED TRADES ({portfolio.history.length})
          </div>
          {portfolio.history.slice().reverse().map((h, i) => (
            <div key={i} style={{
              padding: '10px 12px', background: '#0d0d0d', borderRadius: 8,
              border: `1px solid ${h.pnl >= 0 ? '#16a34a22' : '#dc262622'}`, marginBottom: 4,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#f5f5f5', fontFamily: mono }}>{h.ticker}</span>
                  <span style={{ fontSize: 9, color: '#6b7280', fontFamily: mono, marginLeft: 8 }}>
                    {h.shares} shares
                  </span>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, fontFamily: mono,
                  color: h.pnl >= 0 ? '#4ade80' : '#f87171',
                }}>
                  {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#4b5563', fontFamily: mono, marginTop: 4 }}>
                ${h.buyPrice.toFixed(2)} → ${h.closePrice.toFixed(2)} | {h.date} → {h.closeDate}
              </div>
            </div>
          ))}

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => {
              if (confirm('Clear all closed trade history?')) {
                setPortfolio(prev => ({ ...prev, history: [] }));
              }
            }} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #37415133',
              background: 'transparent', color: '#4b5563', fontSize: 9, fontWeight: 700,
              cursor: 'pointer', fontFamily: mono,
            }}>CLEAR HISTORY</button>
          </div>
        </>
      )}

      <div style={{
        marginTop: 20, padding: 10, textAlign: 'center',
        fontSize: 9, color: '#374151', fontFamily: mono, lineHeight: 1.6,
      }}>
        Portfolio data saved in your browser (localStorage).<br />
        Prices update from the daily scan. Starting capital: ${STARTING_CASH}.
      </div>
    </div>
  );
}

window.PortfolioView = PortfolioView;
