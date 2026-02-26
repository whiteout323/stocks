/* Portfolio Tracker — GitHub-backed storage, iOS phone-first */
const { useState: useStatePort, useEffect: useEffectPort, useMemo: useMemoPort, useRef: useRefPort, useCallback: useCallbackPort } = React;

const PORTFOLIO_PATH = 'frontend/data/portfolio.json';
const GH_TOKEN_KEY = 'spy-scanner-gh-token';
const GH_REPO_KEY = 'spy-scanner-gh-repo';
const EMPTY_PORTFOLIO = { starting_cash: 1000, positions: [], history: [] };

// Detect repo from GitHub Pages URL: username.github.io/repo -> username/repo
function detectRepo() {
  const host = window.location.hostname;
  const path = window.location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io')) {
    const owner = host.replace('.github.io', '');
    const repo = path[0] || '';
    if (owner && repo) return owner + '/' + repo;
  }
  return '';
}

// GitHub API helpers
async function ghRead(repo, token) {
  const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + PORTFOLIO_PATH, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error('GitHub read failed: ' + res.status);
  const data = await res.json();
  const content = JSON.parse(atob(data.content));
  return { content, sha: data.sha };
}

async function ghWrite(repo, token, portfolio, sha) {
  const body = JSON.stringify(portfolio, null, 2) + '\n';
  const res = await fetch('https://api.github.com/repos/' + repo + '/contents/' + PORTFOLIO_PATH, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'portfolio: update ' + new Date().toISOString().slice(0, 10),
      content: btoa(body),
      sha: sha,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'GitHub write failed: ' + res.status);
  }
  const result = await res.json();
  return result.content.sha;
}

function PortfolioView() {
  const [portfolio, setPortfolio] = useStatePort(EMPTY_PORTFOLIO);
  const [scanData, setScanData] = useStatePort(null);
  const [showAdd, setShowAdd] = useStatePort(false);
  const [showClose, setShowClose] = useStatePort(null);
  const [closePrice, setClosePrice] = useStatePort('');
  const [form, setForm] = useStatePort({ ticker: '', buyPrice: '', shares: '', date: new Date().toISOString().slice(0, 10) });
  const [showSettings, setShowSettings] = useStatePort(false);
  const [token, setToken] = useStatePort(() => localStorage.getItem(GH_TOKEN_KEY) || '');
  const [repo, setRepo] = useStatePort(() => localStorage.getItem(GH_REPO_KEY) || detectRepo());
  const [synced, setSynced] = useStatePort(false);
  const [saving, setSaving] = useStatePort(false);
  const [syncError, setSyncError] = useStatePort(null);
  const shaRef = useRefPort(null);

  // Load scan data for price updates
  useEffectPort(() => {
    fetch('data/latest-scan.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => setScanData(data))
      .catch(() => {});
  }, []);

  // Load portfolio: try GitHub API first, fall back to static file
  useEffectPort(() => {
    let cancelled = false;

    async function load() {
      // Try GitHub API if token is set
      if (token && repo) {
        try {
          const { content, sha } = await ghRead(repo, token);
          if (!cancelled) {
            setPortfolio(content);
            shaRef.current = sha;
            setSynced(true);
            setSyncError(null);
          }
          return;
        } catch (e) {
          if (!cancelled) setSyncError('Read: ' + e.message);
        }
      }

      // Fall back to static file (deployed by GitHub Pages)
      try {
        const res = await fetch('data/portfolio.json');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPortfolio(data);
            setSynced(false);
          }
        }
      } catch {}
    }

    load();
    return () => { cancelled = true; };
  }, [token, repo]);

  // Save to GitHub
  const saveToGitHub = useCallbackPort(async (newPortfolio) => {
    if (!token || !repo) return;
    setSaving(true);
    setSyncError(null);
    try {
      // If we don't have a SHA yet, read the file first
      if (!shaRef.current) {
        const { sha } = await ghRead(repo, token);
        shaRef.current = sha;
      }
      const newSha = await ghWrite(repo, token, newPortfolio, shaRef.current);
      shaRef.current = newSha;
      setSynced(true);
    } catch (e) {
      setSyncError('Save: ' + e.message);
      // SHA might be stale, clear it so next save re-reads
      shaRef.current = null;
    } finally {
      setSaving(false);
    }
  }, [token, repo]);

  // Wrapper: update portfolio state + save to GitHub
  const updatePortfolio = useCallbackPort((updater) => {
    setPortfolio(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveToGitHub(next);
      return next;
    });
  }, [saveToGitHub]);

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
    updatePortfolio(prev => ({
      ...prev,
      positions: [...prev.positions, { id: Date.now(), ticker, buyPrice, shares, date: form.date, cost: buyPrice * shares }],
    }));
    setForm({ ticker: '', buyPrice: '', shares: '', date: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
  };

  const closePosition = (id) => {
    const price = parseFloat(closePrice);
    if (isNaN(price) || price <= 0) return;
    const pos = portfolio.positions.find(p => p.id === id);
    if (!pos) return;
    const pnl = (price - pos.buyPrice) * pos.shares;
    updatePortfolio(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.id !== id),
      history: [...prev.history, { ...pos, closePrice: price, closeDate: new Date().toISOString().slice(0, 10), pnl }],
    }));
    setShowClose(null);
    setClosePrice('');
  };

  const removePosition = (id) => {
    updatePortfolio(prev => ({ ...prev, positions: prev.positions.filter(p => p.id !== id) }));
  };

  const saveSettings = () => {
    localStorage.setItem(GH_TOKEN_KEY, token);
    localStorage.setItem(GH_REPO_KEY, repo);
    setShowSettings(false);
    // Trigger a reload from GitHub
    setSynced(false);
    shaRef.current = null;
    if (token && repo) {
      ghRead(repo, token).then(({ content, sha }) => {
        setPortfolio(content);
        shaRef.current = sha;
        setSynced(true);
        setSyncError(null);
      }).catch(e => setSyncError('Read: ' + e.message));
    }
  };

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

  const inputStyle = {
    width: '100%', padding: '14px 16px', borderRadius: 12,
    border: '1px solid #2a2a2a', background: '#111', color: '#fff',
    fontSize: 16, outline: 'none', WebkitAppearance: 'none',
  };

  return (
    <div style={{ padding: '16px 16px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Portfolio</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{
            padding: '10px 14px', borderRadius: 12, border: '1px solid #222',
            background: 'transparent', color: '#666', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            &#x2699;
          </button>
          <button onClick={() => setShowAdd(!showAdd)} style={{
            padding: '10px 18px', borderRadius: 12, border: 'none',
            background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            + Add
          </button>
        </div>
      </div>

      {/* Sync status */}
      <div style={{ marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
          background: saving ? '#fbbf24' : synced ? '#4ade80' : token ? '#f87171' : '#555',
        }} />
        <span style={{ color: '#555' }}>
          {saving ? 'Saving...' : synced ? 'Synced to GitHub' : token ? 'Not synced' : 'Local only'}
        </span>
        {syncError && <span style={{ color: '#f87171', marginLeft: 4 }}>{syncError}</span>}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{
          padding: '20px', borderRadius: 20, marginBottom: 20,
          background: '#111', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>GitHub Sync</div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 16 }}>
            Saves your trades to a JSON file in your repo. Create a
            fine-grained token with Contents read/write permission.
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Repository (owner/repo)</div>
            <input value={repo} onChange={e => setRepo(e.target.value)}
              placeholder="username/stocks" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>GitHub Token</div>
            <input type="password" value={token} onChange={e => setToken(e.target.value)}
              placeholder="github_pat_..." style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveSettings} style={{
              flex: 1, padding: '14px', borderRadius: 12, border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>Save</button>
            <button onClick={() => setShowSettings(false)} style={{
              flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #333',
              background: 'transparent', color: '#888', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

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

      {/* Add form */}
      {showAdd && (
        <div style={{
          padding: '20px', borderRadius: 20, marginBottom: 20,
          background: '#111', border: '1px solid rgba(59,130,246,0.2)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Add Trade</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Ticker</div>
              <input value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value })}
                placeholder="AAPL" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Date</div>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Buy Price</div>
              <input type="number" step="0.01" value={form.buyPrice}
                onChange={e => setForm({ ...form, buyPrice: e.target.value })}
                placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Shares</div>
              <input type="number" step="0.01" value={form.shares}
                onChange={e => setForm({ ...form, shares: e.target.value })}
                placeholder="0" style={inputStyle} />
            </div>
          </div>
          {form.buyPrice && form.shares && (
            <div style={{ fontSize: 14, color: '#fbbf24', fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
              Total: ${(parseFloat(form.buyPrice || 0) * parseFloat(form.shares || 0)).toFixed(2)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addPosition} style={{
              flex: 1, padding: '14px', borderRadius: 12, border: 'none',
              background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
            }}>Confirm</button>
            <button onClick={() => setShowAdd(false)} style={{
              flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #333',
              background: 'transparent', color: '#888', fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

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
            const isClosing = showClose === pos.id;

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
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
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

                  {!isClosing ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setShowClose(pos.id); setClosePrice(curPrice ? curPrice.toFixed(2) : ''); }} style={{
                        flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                        background: '#fbbf24', color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}>Sell</button>
                      <button onClick={() => removePosition(pos.id)} style={{
                        padding: '12px 16px', borderRadius: 10, border: '1px solid #222',
                        background: 'transparent', color: '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}>Del</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="number" step="0.01" value={closePrice}
                        onChange={e => setClosePrice(e.target.value)} placeholder="Sell price"
                        style={{ ...inputStyle, flex: 1, padding: '12px 14px' }}
                      />
                      <button onClick={() => closePosition(pos.id)} style={{
                        padding: '12px 18px', borderRadius: 10, border: 'none',
                        background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}>OK</button>
                      <button onClick={() => setShowClose(null)} style={{
                        padding: '12px 14px', borderRadius: 10, border: '1px solid #333',
                        background: 'transparent', color: '#888', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      }}>X</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {portfolio.positions.length === 0 && !showAdd && !showSettings && (
        <div style={{
          padding: '40px 20px', borderRadius: 20, background: '#111',
          border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', marginBottom: 24,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>$</div>
          <div style={{ fontSize: 17, color: '#888', fontWeight: 600, marginBottom: 6 }}>No positions yet</div>
          <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6 }}>
            Check the Scan tab, then add your trades here.
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
          <button onClick={() => {
            if (confirm('Clear closed trade history?')) {
              updatePortfolio(prev => ({ ...prev, history: [] }));
            }
          }} style={{
            width: '100%', padding: '12px', marginTop: 8, borderRadius: 12,
            border: '1px solid #1a1a1a', background: 'transparent',
            color: '#444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Clear History</button>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 12, color: '#333' }}>
        {synced ? 'Synced to GitHub' : 'Tap \u2699 to connect GitHub'} &middot; ${startingCash} starting capital
      </div>
    </div>
  );
}

window.PortfolioView = PortfolioView;
