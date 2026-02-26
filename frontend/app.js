/* Main App — iOS-style bottom tab navigation */
const { useState: useStateApp } = React;

function App() {
  const [activeTab, setActiveTab] = useStateApp('live');

  const tabs = [
    { key: 'live', icon: '\u25C8', label: 'Scan' },
    { key: 'portfolio', icon: '$', label: 'Portfolio' },
    { key: 'scanner', icon: '\u2261', label: 'Detail' },
    { key: 'swing', icon: '\u223F', label: 'Swing' },
  ];

  return (
    <>
      <div className="tab-content">
        {activeTab === 'live' && React.createElement(window.LiveScanView)}
        {activeTab === 'portfolio' && React.createElement(window.PortfolioView)}
        {activeTab === 'scanner' && React.createElement(window.SpyMomentumScanner)}
        {activeTab === 'swing' && React.createElement(window.SwingTraderDashboard)}
      </div>

      <div className="tab-bar">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-item ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
