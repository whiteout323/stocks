# ◈ SPY Momentum Scanner

Pre-market swing trade signal engine for the top 15 SPY holdings.
Implements EMA trend-following with volume confirmation and options leverage — automated into a daily scan with SMS alerts.

## Strategy Overview

Based on momentum swing trading with three core pillars:

1. **EMA Stack (8/21/50)** — Identifies trend direction and strength
2. **Volume Confirmation** — Validates conviction behind moves
3. **Pullback Entries** — Highest-probability setups: buying dips in uptrends (or shorting rallies in downtrends)

### Signal Hierarchy

| Signal | Strength | What It Means |
|---|---|---|
| **PULLBACK BUY** | ⚡ 5 | A+ setup: Price at 8 EMA in bull stack + declining volume |
| **STRONG BUY** | 4 | Bull stack + volume surge + RSI not overbought |
| **BUY** | 3 | Bull stack intact — wait for pullback to enter |
| **LEAN BULL** | 2 | Developing trend, not fully confirmed yet |
| **NEUTRAL** | 0 | No edge — stay flat |
| **LEAN BEAR** | -2 | Developing bearish momentum |
| **SELL** | -3 | Bear stack intact — wait for bounce to enter puts |
| **STRONG SELL** | -4 | Bear stack + volume surge |
| **PULLBACK SELL** | ⚡ -5 | A+ setup: Price at 8 EMA in bear stack + low volume |

### Market Regime (Position Sizing)

| Regime | Condition | Action |
|---|---|---|
| STRONG UPTREND | >70% of names bullish | Size UP — full positions |
| MODERATE BULL | 50-70% bullish | Normal size — be selective |
| CHOPPY | 30-50% bullish | Size DOWN — halve positions |
| BEARISH | <30% bullish | Defensive — quarter size or flat |

## Quick Start

```bash
# 1. Clone/download the files
# 2. Run setup
chmod +x setup.sh
./setup.sh

# 3. Edit your API keys
nano .env

# 4. Run a scan
python3 spy_momentum_scanner.py

# 5. Run with SMS alerts
python3 spy_momentum_scanner.py --sms
```

## Data Sources

The scanner supports two data sources:

- **Polygon.io** (recommended) — Free tier gives 5 requests/minute, which is plenty for 15 stocks. Sign up at [polygon.io](https://polygon.io)
- **Yahoo Finance** (fallback) — No API key needed. Used automatically if no Polygon key is set.

## Cron Schedule

```cron
# Daily pre-market scan at 6:00 AM PST, Mon-Fri
0 6 * * 1-5 cd /path/to/scanner && python3 spy_momentum_scanner.py --sms --json >> scanner.log 2>&1

# Weekly deep review, Sunday 6:00 PM PST
0 18 * * 0 cd /path/to/scanner && python3 spy_momentum_scanner.py --weekly --sms --json >> scanner.log 2>&1
```

## CLI Options

```
--sms             Send SMS alerts via Twilio
--weekly          Weekly review mode (sector breakdown, checklist)
--account N       Account size for position sizing (default: $25,000)
--json            Save results to scan_logs/ directory
--quiet           Suppress console output (for cron)
--data-source     Force 'polygon' or 'yahoo' (default: auto)
```

## SMS Alert Format

Alerts are concise and text you only when there are actionable setups:

```
◈ SPY SCAN 02/26 06:00
Regime: STRONG UPTREND
B:11 N:2 S:2 RSI:58.3
SIZE UP

⚡PB NVDA PULLBACK BUY
 $142.50 | SL:$138.20 T:$151.10
 36sh @2% | C | Vol:0.8x RSI:55

AAPL STRONG BUY
 $238.90 | SL:$232.15 T:$252.40
 37sh @2% | C | Vol:1.4x RSI:62
```

## Files

```
spy_momentum_scanner.py   — Main scanner engine
.env.example              — API key template (copy to .env)
setup.sh                  — One-command setup script
scan_logs/                — JSON history of all scans (with --json)
```

## Updating the Watchlist

Edit the `WATCHLIST` array in `spy_momentum_scanner.py` to add/remove tickers. Check SPY holdings quarterly at [stockanalysis.com/etf/spy/holdings](https://stockanalysis.com/etf/spy/holdings/).

---

⚠️ Not financial advice. This tool is for informational and educational purposes only. Always do your own research before trading.
