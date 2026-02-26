/* Main App — Tab Navigation between Dashboards */
const { useState: useStateApp } = React;

function App() {
  const [activeTab, setActiveTab] = useStateApp('live');

  const tabs = [
    { key: 'live', label: 'LIVE SCAN' },
    { key: 'portfolio', label: 'PORTFOLIO' },
    { key: 'scanner', label: 'SCANNER' },
    { key: 'swing', label: 'SWING' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: '#080808',
      color: '#e5e7eb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      '--mono': '"JetBrains Mono", "SF Mono", "Fira Code", monospace',
    }}>
      <div className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'live' && React.createElement(window.LiveScanView)}
      {activeTab === 'portfolio' && React.createElement(window.PortfolioView)}
      {activeTab === 'scanner' && React.createElement(window.SpyMomentumScanner)}
      {activeTab === 'swing' && React.createElement(window.SwingTraderDashboard)}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
