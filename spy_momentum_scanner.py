#!/usr/bin/env python3
"""
SPY Momentum Scanner — Daily Order Book Engine
================================================
Scans top 15 SPY holdings → generates explicit BUY/SELL orders each morning.
Allocates portfolio % across multiple setups, tracks open positions, and
texts you exactly what to do.

Usage:
  python spy_momentum_scanner.py                    # console scan
  python spy_momentum_scanner.py --sms              # scan + text alert
  python spy_momentum_scanner.py --weekly            # Sunday deep review
  python spy_momentum_scanner.py --account 50000     # custom account size

Cron (6 AM PST Mon-Fri):
  0 6 * * 1-5 cd /path/to/scanner && python3 spy_momentum_scanner.py --sms --json >> scanner.log 2>&1

Requirements:
  pip install requests python-dotenv twilio pandas

.env file:
  POLYGON_API_KEY=your_key        # or leave blank to auto-use Yahoo Finance
  TWILIO_ACCOUNT_SID=your_sid     # optional — for SMS alerts
  TWILIO_AUTH_TOKEN=your_token
  TWILIO_FROM_NUMBER=+1234567890
  ALERT_PHONE_NUMBER=+1234567890
"""

import os
import sys
import json
import time
import argparse
import logging
import tempfile
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional

import requests
import numpy as np
import pandas as pd
from dotenv import load_dotenv

load_dotenv()


class NumpyEncoder(json.JSONEncoder):
    """Handle numpy/pandas types in JSON serialization."""
    def default(self, obj):
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        return super().default(obj)

# ─── CONFIG ──────────────────────────────────────────────────────────────────────

POLYGON_API_KEY = os.getenv("POLYGON_API_KEY", "")
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER", "")
ALERT_PHONE = os.getenv("ALERT_PHONE_NUMBER", "")

WATCHLIST = [
    {"ticker": "NVDA", "name": "NVIDIA",       "weight": 7.83, "sector": "Tech"},
    {"ticker": "AAPL", "name": "Apple",         "weight": 6.47, "sector": "Tech"},
    {"ticker": "MSFT", "name": "Microsoft",     "weight": 5.39, "sector": "Tech"},
    {"ticker": "AMZN", "name": "Amazon",        "weight": 3.93, "sector": "Consumer"},
    {"ticker": "GOOGL","name": "Alphabet",      "weight": 3.32, "sector": "Tech"},
    {"ticker": "AVGO", "name": "Broadcom",      "weight": 2.64, "sector": "Tech"},
    {"ticker": "META", "name": "Meta",          "weight": 2.63, "sector": "Tech"},
    {"ticker": "TSLA", "name": "Tesla",         "weight": 2.04, "sector": "Consumer"},
    {"ticker": "BRK.B","name": "Berkshire",     "weight": 1.49, "sector": "Finance"},
    {"ticker": "JPM",  "name": "JPMorgan",      "weight": 1.35, "sector": "Finance"},
    {"ticker": "LLY",  "name": "Eli Lilly",     "weight": 1.30, "sector": "Health"},
    {"ticker": "V",    "name": "Visa",          "weight": 1.10, "sector": "Finance"},
    {"ticker": "UNH",  "name": "UnitedHealth",  "weight": 1.05, "sector": "Health"},
    {"ticker": "COST", "name": "Costco",        "weight": 0.98, "sector": "Consumer"},
    {"ticker": "WMT",  "name": "Walmart",       "weight": 0.92, "sector": "Consumer"},
]

SPY_TICKER = "SPY"

# Strategy parameters
EMA_FAST = 8
EMA_MID = 21
EMA_SLOW = 50
RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30
LOOKBACK_DAYS = 80
RISK_PCT = 0.02           # 2% risk per individual trade
MAX_PORTFOLIO_RISK = 0.10 # 10% max total portfolio at risk
MAX_POSITIONS = 5         # max simultaneous open positions
ACCOUNT_SIZE = 1000       # default — override with --account

# Resolve paths relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POSITIONS_FILE = os.path.join(SCRIPT_DIR, "open_positions.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("scanner")


# ─── DATA MODELS ─────────────────────────────────────────────────────────────────

@dataclass
class StockSignal:
    ticker: str
    name: str
    weight: float
    sector: str
    current_price: float
    ema8: float
    ema21: float
    ema50: float
    rsi: float
    vol_ratio: float
    change_1d: float
    change_5d: float
    change_20d: float
    bull_stacked: bool
    bear_stacked: bool
    ema_spread: float
    dist_to_8: float
    dist_to_21: float
    is_pullback_buy: bool
    is_pullback_sell: bool
    signal: str
    signal_strength: int
    action_note: str
    stop_loss: float
    target_1: float
    target_2: float
    risk_per_share: float
    position_size: int
    support: float
    resistance: float
    conviction_score: float = 0.0


@dataclass
class Order:
    action: str           # "BUY CALLS", "BUY PUTS", "SELL/EXIT", "TAKE PROFIT", "TIGHTEN STOP"
    ticker: str
    name: str
    price: float
    shares: int
    dollar_amount: float
    portfolio_pct: float  # % of total account allocated
    stop_loss: float
    target: float
    risk_reward: str
    reason: str
    priority: int
    option_type: str
    signal: str
    conviction: float


@dataclass
class MarketRegime:
    regime: str
    bull_count: int
    bear_count: int
    neutral_count: int
    avg_rsi: float
    actionable_count: int
    sizing_advice: str
    description: str
    regime_multiplier: float
    spy_above_21ema: Optional[bool] = None


# ─── POSITION TRACKER ───────────────────────────────────────────────────────────

def load_positions() -> dict:
    if os.path.exists(POSITIONS_FILE):
        try:
            with open(POSITIONS_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_positions(positions: dict):
    dir_name = os.path.dirname(os.path.abspath(POSITIONS_FILE)) or "."
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(positions, f, indent=2, cls=NumpyEncoder)
        os.replace(tmp_path, POSITIONS_FILE)
    except Exception:
        os.unlink(tmp_path)
        raise


def add_position(ticker, entry_price, shares, stop_loss, target, direction, dollar_amount):
    positions = load_positions()
    positions[ticker] = {
        "entry_price": entry_price, "shares": shares, "stop_loss": stop_loss,
        "target": target, "direction": direction, "dollar_amount": dollar_amount,
        "entry_date": datetime.now().isoformat(),
    }
    save_positions(positions)


def remove_position(ticker):
    positions = load_positions()
    if ticker in positions:
        del positions[ticker]
        save_positions(positions)


# ─── DATA CLIENTS ───────────────────────────────────────────────────────────────

class PolygonClient:
    BASE_URL = "https://api.polygon.io"

    def __init__(self, api_key):
        self.api_key = api_key
        self.session = requests.Session()
        self.session.params = {"apiKey": self.api_key}

    def get_daily_bars(self, ticker, days=LOOKBACK_DAYS):
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=days + 30)).strftime("%Y-%m-%d")
        url = f"{self.BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day/{start_date}/{end_date}"
        params = {"adjusted": "true", "sort": "asc", "limit": days + 30}
        try:
            resp = self.session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            if data.get("resultsCount", 0) == 0:
                return pd.DataFrame()
            df = pd.DataFrame(data.get("results", []))
            df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume", "t": "timestamp"})
            df["date"] = pd.to_datetime(df["timestamp"], unit="ms")
            df = df.sort_values("date").reset_index(drop=True)
            if len(df) > days:
                df = df.tail(days).reset_index(drop=True)
            return df[["date", "open", "high", "low", "close", "volume"]]
        except requests.exceptions.RequestException as e:
            log.error(f"Polygon error for {ticker}: {type(e).__name__}")
            return pd.DataFrame()

    def rate_limit_pause(self):
        time.sleep(0.25)


class YahooClient:
    def get_daily_bars(self, ticker, days=LOOKBACK_DAYS):
        yahoo_ticker = ticker.replace(".", "-")
        end_ts = int(datetime.now().timestamp())
        start_ts = int((datetime.now() - timedelta(days=days + 30)).timestamp())
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_ticker}"
        params = {"period1": start_ts, "period2": end_ts, "interval": "1d", "includeAdjustedClose": "true"}
        try:
            resp = requests.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            chart = data.get("chart", {})
            results = chart.get("result")
            if not results:
                log.error(f"No chart results for {ticker}")
                return pd.DataFrame()
            result = results[0]
            if "timestamp" not in result:
                log.error(f"No timestamp data for {ticker}")
                return pd.DataFrame()
            indicators = result.get("indicators", {})
            quotes_list = indicators.get("quote")
            if not quotes_list:
                log.error(f"No quote data for {ticker}")
                return pd.DataFrame()
            quotes = quotes_list[0]
            df = pd.DataFrame({
                "date": pd.to_datetime(result["timestamp"], unit="s"),
                "open": quotes["open"], "high": quotes["high"],
                "low": quotes["low"], "close": quotes["close"], "volume": quotes["volume"],
            }).dropna(subset=["close"]).reset_index(drop=True)
            if len(df) > days:
                df = df.tail(days).reset_index(drop=True)
            return df
        except (requests.exceptions.RequestException, KeyError, IndexError, ValueError) as e:
            log.error(f"Yahoo error for {ticker}: {type(e).__name__}: {e}")
            return pd.DataFrame()

    def rate_limit_pause(self):
        time.sleep(0.5)


# ─── TECHNICAL ANALYSIS ─────────────────────────────────────────────────────────

def calc_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()


def calc_rsi(series, period=RSI_PERIOD):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.iloc[-1] if not pd.isna(rsi.iloc[-1]) else 50.0


def analyze_stock(df, stock_info, account_size):
    if df.empty or len(df) < EMA_SLOW + 5:
        return None

    close, volume, high, low = df["close"], df["volume"], df["high"], df["low"]
    ema8, ema21, ema50 = calc_ema(close, EMA_FAST), calc_ema(close, EMA_MID), calc_ema(close, EMA_SLOW)

    cp = close.iloc[-1]
    e8, e21, e50 = ema8.iloc[-1], ema21.iloc[-1], ema50.iloc[-1]
    rsi = calc_rsi(close)

    recent_vol = volume.iloc[-5:].mean()
    avg_vol = volume.iloc[-20:].mean()
    vol_ratio = recent_vol / avg_vol if avg_vol > 0 else 1.0

    bull_stacked = e8 > e21 and e21 > e50
    bear_stacked = e8 < e21 and e21 < e50
    ema_spread = ((e8 - e50) / e50) * 100
    dist_to_8 = ((cp - e8) / e8) * 100
    dist_to_21 = ((cp - e21) / e21) * 100

    is_pullback_buy = bull_stacked and -1.5 < dist_to_8 < 0.5
    is_pullback_sell = bear_stacked and -0.5 < dist_to_8 < 1.5

    change_1d = ((close.iloc[-1] - close.iloc[-2]) / close.iloc[-2]) * 100 if len(close) >= 2 else 0
    change_5d = ((close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]) * 100 if len(close) >= 6 else 0
    change_20d = ((close.iloc[-1] - close.iloc[-21]) / close.iloc[-21]) * 100 if len(close) >= 21 else 0

    resistance = high.iloc[-20:].max()
    support = low.iloc[-20:].min()

    # Signal logic
    if bull_stacked and is_pullback_buy and vol_ratio < 1.0:
        signal, strength = "PULLBACK BUY", 5
        note = f"Price at 8 EMA (${e8:.2f}) in uptrend + declining vol ({vol_ratio:.1f}x). A+ call entry."
    elif bull_stacked and vol_ratio > 1.3 and rsi < RSI_OVERBOUGHT:
        signal, strength = "STRONG BUY", 4
        note = f"Bull stack + volume surge ({vol_ratio:.1f}x). Enter calls on intraday dip."
    elif bull_stacked:
        signal, strength = "BUY", 3
        note = f"Trend up, EMAs stacked. Wait for pullback to 8 EMA (${e8:.2f})."
    elif e8 > e21 and cp > e21:
        signal, strength = "LEAN BULL", 2
        note = "Developing bullish trend. Wait for full EMA stack."
    elif bear_stacked and is_pullback_sell and vol_ratio < 1.0:
        signal, strength = "PULLBACK SELL", -5
        note = f"Price at 8 EMA (${e8:.2f}) in downtrend + low vol ({vol_ratio:.1f}x). A+ put entry."
    elif bear_stacked and vol_ratio > 1.3 and rsi > RSI_OVERSOLD:
        signal, strength = "STRONG SELL", -4
        note = f"Bear stack + volume surge ({vol_ratio:.1f}x). Enter puts on bounce."
    elif bear_stacked:
        signal, strength = "SELL", -3
        note = f"Trend down. Wait for bounce to 8 EMA (${e8:.2f}) for puts."
    elif e8 < e21 and cp < e21:
        signal, strength = "LEAN BEAR", -2
        note = "Bearish momentum developing. Wait for full stack."
    else:
        signal, strength = "NEUTRAL", 0
        note = "No trend — EMAs tangled. Stay flat."

    # Trade math
    if bull_stacked:
        stop_loss = min(e21, support * 1.005)
    elif bear_stacked:
        stop_loss = max(e21, resistance * 0.995)
    else:
        stop_loss = support if strength >= 0 else resistance

    risk_per_share = abs(cp - stop_loss)
    if risk_per_share < 0.01:
        risk_per_share = cp * 0.02

    risk_amount = account_size * RISK_PCT
    position_size = int(risk_amount / risk_per_share) if risk_per_share > 0 else 0

    if strength > 0:
        target_1 = cp + risk_per_share * 2.5
        target_2 = cp + risk_per_share * 3.5
    elif strength < 0:
        target_1 = cp - risk_per_share * 2.5
        target_2 = cp - risk_per_share * 3.5
    else:
        target_1, target_2 = cp, cp

    # Conviction score (0-100) — drives allocation percentages
    score = 0.0
    if bull_stacked or bear_stacked:
        score += 25
    if is_pullback_buy or is_pullback_sell:
        score += 30
    if abs(strength) >= 4 and vol_ratio > 1.2:
        score += 15
    elif vol_ratio < 1.0 and (is_pullback_buy or is_pullback_sell):
        score += 20
    if 35 < rsi < 65:
        score += 10
    elif (strength > 0 and rsi < RSI_OVERBOUGHT) or (strength < 0 and rsi > RSI_OVERSOLD):
        score += 5
    if abs(ema_spread) > 3:
        score += 10
    elif abs(ema_spread) > 1.5:
        score += 5
    if (strength > 0 and change_5d > 0) or (strength < 0 and change_5d < 0):
        score += 10
    if stock_info["weight"] > 3:
        score += 5

    return StockSignal(
        ticker=stock_info["ticker"], name=stock_info["name"],
        weight=stock_info["weight"], sector=stock_info["sector"],
        current_price=round(cp, 2), ema8=round(e8, 2), ema21=round(e21, 2), ema50=round(e50, 2),
        rsi=round(rsi, 1), vol_ratio=round(vol_ratio, 2),
        change_1d=round(change_1d, 2), change_5d=round(change_5d, 2), change_20d=round(change_20d, 2),
        bull_stacked=bull_stacked, bear_stacked=bear_stacked,
        ema_spread=round(ema_spread, 2), dist_to_8=round(dist_to_8, 2), dist_to_21=round(dist_to_21, 2),
        is_pullback_buy=is_pullback_buy, is_pullback_sell=is_pullback_sell,
        signal=signal, signal_strength=strength, action_note=note,
        stop_loss=round(stop_loss, 2), target_1=round(target_1, 2), target_2=round(target_2, 2),
        risk_per_share=round(risk_per_share, 2), position_size=position_size,
        support=round(support, 2), resistance=round(resistance, 2),
        conviction_score=round(min(score, 100), 1),
    )


def determine_regime(signals, spy_signal=None):
    bull_count = sum(1 for s in signals if s.signal_strength > 0)
    bear_count = sum(1 for s in signals if s.signal_strength < 0)
    neutral_count = sum(1 for s in signals if s.signal_strength == 0)
    avg_rsi = sum(s.rsi for s in signals) / len(signals) if signals else 50
    actionable = sum(1 for s in signals if abs(s.signal_strength) >= 4)
    bull_pct = (bull_count / len(signals)) * 100 if signals else 0
    spy_above_21 = spy_signal.current_price > spy_signal.ema21 if spy_signal else None

    if bull_pct > 70:
        regime, mult = "STRONG UPTREND", 1.5
        sizing = "SIZE UP — Full positions, environment favors momentum."
        desc = f"{bull_count}/{len(signals)} bullish. Aggressive pullback entries."
    elif bull_pct > 50:
        regime, mult = "MODERATE BULL", 1.0
        sizing = "NORMAL — Be selective, highest-conviction only."
        desc = f"{bull_count}/{len(signals)} bullish. Mixed but leaning up."
    elif bull_pct > 30:
        regime, mult = "CHOPPY", 0.5
        sizing = "HALF SIZE — Choppy kills swing traders. Cut exposure."
        desc = f"No clear direction. Reduce frequency."
    else:
        regime, mult = "BEARISH", 0.25
        sizing = "QUARTER SIZE — Only high-conviction puts or stay cash."
        desc = f"{bear_count}/{len(signals)} bearish."

    return MarketRegime(
        regime=regime, bull_count=bull_count, bear_count=bear_count,
        neutral_count=neutral_count, avg_rsi=round(avg_rsi, 1),
        actionable_count=actionable, sizing_advice=sizing,
        description=desc, regime_multiplier=mult, spy_above_21ema=spy_above_21,
    )


# ─── ORDER BOOK GENERATOR ───────────────────────────────────────────────────────

def generate_orders(signals, regime, account_size):
    """
    The brain — generates explicit BUY/SELL/MANAGE orders.

    Returns:
        buy_orders:    New positions to open with $ amounts and portfolio %
        sell_orders:   Positions to close
        manage_orders: Existing positions to adjust
    """
    buy_orders, sell_orders, manage_orders = [], [], []
    positions = load_positions()

    # ── 1. CHECK EXISTING POSITIONS ──
    for ticker, pos in positions.items():
        sig = next((s for s in signals if s.ticker == ticker), None)
        if not sig:
            continue

        direction = pos["direction"]
        entry = pos["entry_price"]
        pnl_pct = ((sig.current_price - entry) / entry) * 100
        if direction == "SHORT":
            pnl_pct = -pnl_pct

        exit_reason = None

        # Stop loss hit
        if direction == "LONG" and sig.current_price <= pos["stop_loss"]:
            exit_reason = f"STOP HIT — ${sig.current_price} ≤ ${pos['stop_loss']}. P&L: {pnl_pct:+.1f}%"
        elif direction == "SHORT" and sig.current_price >= pos["stop_loss"]:
            exit_reason = f"STOP HIT — ${sig.current_price} ≥ ${pos['stop_loss']}. P&L: {pnl_pct:+.1f}%"

        # EMA stack reversal
        if direction == "LONG" and sig.bear_stacked:
            exit_reason = f"EMAs FLIPPED BEARISH. Exit all. P&L: {pnl_pct:+.1f}%"
        elif direction == "SHORT" and sig.bull_stacked:
            exit_reason = f"EMAs FLIPPED BULLISH. Exit all. P&L: {pnl_pct:+.1f}%"

        # Signal flipped hard opposite
        if direction == "LONG" and sig.signal_strength <= -3:
            exit_reason = f"SIGNAL → {sig.signal}. Trend reversed. P&L: {pnl_pct:+.1f}%"
        elif direction == "SHORT" and sig.signal_strength >= 3:
            exit_reason = f"SIGNAL → {sig.signal}. Trend reversed. P&L: {pnl_pct:+.1f}%"

        # RSI exhaustion
        if direction == "LONG" and sig.rsi > 80:
            exit_reason = f"RSI {sig.rsi} — OVERBOUGHT exhaustion. Take profits. P&L: {pnl_pct:+.1f}%"
        elif direction == "SHORT" and sig.rsi < 20:
            exit_reason = f"RSI {sig.rsi} — OVERSOLD exhaustion. Take profits. P&L: {pnl_pct:+.1f}%"

        if exit_reason:
            sell_orders.append(Order(
                action="SELL/EXIT", ticker=ticker, name=sig.name,
                price=sig.current_price, shares=pos["shares"],
                dollar_amount=round(pos["shares"] * sig.current_price, 2),
                portfolio_pct=0, stop_loss=0, target=0, risk_reward="N/A",
                reason=exit_reason, priority=1, option_type="Close position",
                signal=sig.signal, conviction=0,
            ))
            continue

        # Manage — take profit at target
        target_hit = (direction == "LONG" and sig.current_price >= pos["target"]) or \
                     (direction == "SHORT" and sig.current_price <= pos["target"])
        if target_hit:
            half = max(1, pos["shares"] // 2)
            manage_orders.append(Order(
                action="TAKE PROFIT (sell 50%)", ticker=ticker, name=sig.name,
                price=sig.current_price, shares=half,
                dollar_amount=round(half * sig.current_price, 2),
                portfolio_pct=0, stop_loss=round(sig.ema21, 2), target=sig.target_2,
                risk_reward="Runner",
                reason=f"Hit 2.5R target! Sell half. Trail stop → 21 EMA ${sig.ema21:.2f}. P&L: {pnl_pct:+.1f}%",
                priority=2, option_type="Partial close", signal=sig.signal, conviction=0,
            ))
        elif pnl_pct > 3 and direction == "LONG" and sig.ema8 > pos["stop_loss"]:
            manage_orders.append(Order(
                action="TIGHTEN STOP", ticker=ticker, name=sig.name,
                price=sig.current_price, shares=pos["shares"],
                dollar_amount=round(pos["shares"] * sig.current_price, 2),
                portfolio_pct=0, stop_loss=round(sig.ema8, 2), target=pos["target"],
                risk_reward="N/A",
                reason=f"Up {pnl_pct:+.1f}%. Move stop → 8 EMA ${sig.ema8:.2f} to lock gains.",
                priority=3, option_type="Adjust stop", signal=sig.signal, conviction=0,
            ))

    # ── 2. NEW BUY ORDERS ──
    exit_tickers = {o.ticker for o in sell_orders}
    open_tickers = set(positions.keys()) - exit_tickers
    candidates = [
        s for s in signals
        if s.signal_strength >= 3
        and s.ticker not in open_tickers
        and s.ticker not in exit_tickers
    ]
    candidates.sort(key=lambda s: s.conviction_score, reverse=True)

    keeping = len(positions) - len(sell_orders)
    open_slots = max(0, MAX_POSITIONS - keeping)
    to_buy = candidates[:open_slots]

    if to_buy:
        total_conviction = sum(s.conviction_score for s in to_buy) or 1

        # Capital available, adjusted by regime
        available = account_size * regime.regime_multiplier
        available = min(available, account_size * MAX_PORTFOLIO_RISK / RISK_PCT)

        for priority, sig in enumerate(to_buy, start=1):
            raw_pct = sig.conviction_score / total_conviction
            dollar_alloc = available * raw_pct

            # Dollar-based allocation with fractional shares (Robinhood supports this)
            shares = round(dollar_alloc / sig.current_price, 2) if sig.current_price > 0 else 0
            dollar_amount = round(shares * sig.current_price, 2)
            if dollar_amount < 1:
                continue  # skip if position is negligible
            portfolio_pct = (dollar_amount / account_size) * 100

            reward = abs(sig.target_1 - sig.current_price)
            rr = f"{reward / sig.risk_per_share:.1f}:1" if sig.risk_per_share > 0 else "N/A"

            action = "BUY"
            opt = "SHARES — Market or limit order"

            buy_orders.append(Order(
                action=action, ticker=sig.ticker, name=sig.name,
                price=sig.current_price, shares=shares,
                dollar_amount=dollar_amount, portfolio_pct=round(portfolio_pct, 1),
                stop_loss=sig.stop_loss, target=sig.target_1,
                risk_reward=rr, reason=sig.action_note, priority=priority,
                option_type=opt, signal=sig.signal, conviction=sig.conviction_score,
            ))

    return buy_orders, sell_orders, manage_orders


# ─── OUTPUT FORMATTING ──────────────────────────────────────────────────────────

def format_order_book(buy_orders, sell_orders, manage_orders, signals, regime,
                      account_size, weekly=False):
    L = []
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    mode = "WEEKLY REVIEW" if weekly else "DAILY ORDER BOOK"

    L.append("")
    L.append("█" * 72)
    L.append(f"  ◈ SPY MOMENTUM SCANNER — {mode}")
    L.append(f"  {now}  |  Account: ${account_size:,}")
    L.append("█" * 72)

    # Regime
    L.append("")
    L.append(f"  REGIME: {regime.regime}  (sizing: {regime.regime_multiplier}x)")
    L.append(f"  {regime.description}")
    L.append(f"  Bull: {regime.bull_count} | Bear: {regime.bear_count} | Neutral: {regime.neutral_count} | RSI: {regime.avg_rsi}")
    spy = f" | SPY {'ABOVE' if regime.spy_above_21ema else 'BELOW'} 21 EMA" if regime.spy_above_21ema is not None else ""
    L.append(f"  → {regime.sizing_advice}{spy}")

    # ── SELL ORDERS ──
    if sell_orders:
        L.append("")
        L.append("═" * 72)
        L.append("  🔴 SELL / EXIT — Do these FIRST")
        L.append("═" * 72)
        for o in sell_orders:
            L.append(f"")
            L.append(f"  ✕ {o.action}  {o.ticker} ({o.name})")
            L.append(f"    Price: ${o.price}  |  Shares: {o.shares}  |  Value: ${o.dollar_amount:,.2f}")
            L.append(f"    {o.reason}")

    # ── MANAGE ORDERS ──
    if manage_orders:
        L.append("")
        L.append("═" * 72)
        L.append("  🟡 MANAGE — Adjust existing positions")
        L.append("═" * 72)
        for o in manage_orders:
            L.append(f"")
            L.append(f"  ⚙ {o.action}  {o.ticker} ({o.name})")
            L.append(f"    {o.reason}")
            if o.stop_loss:
                L.append(f"    New Stop: ${o.stop_loss}  |  Target: ${o.target}")

    # ── BUY ORDERS ──
    if buy_orders:
        L.append("")
        L.append("═" * 72)
        L.append("  🟢 BUY ORDERS — New positions")
        L.append("═" * 72)

        total_pct = sum(o.portfolio_pct for o in buy_orders)
        total_dollar = sum(o.dollar_amount for o in buy_orders)
        L.append("")
        L.append(f"  TOTAL ALLOCATION: {total_pct:.1f}% of account  (${total_dollar:,.2f})")
        L.append(f"  Regime sizing: {regime.regime_multiplier}x applied")

        # Allocation bar chart
        L.append("")
        L.append(f"  PORTFOLIO SPLIT:")
        L.append(f"  {'─' * 62}")
        for o in buy_orders:
            bar_w = 40
            filled = int((o.portfolio_pct / max(total_pct, 0.1)) * bar_w)
            bar = "█" * filled + "░" * (bar_w - filled)
            L.append(f"  {o.ticker:<7} {bar}  {o.portfolio_pct:5.1f}%  ${o.dollar_amount:>9,.2f}  score:{o.conviction:.0f}")
        L.append(f"  {'─' * 62}")

        # Detailed orders
        for o in buy_orders:
            L.append("")
            L.append(f"  #{o.priority}  {o.action}  {o.ticker} ({o.name})")
            L.append(f"  ┌───────────────────────────────────────────────────────")
            L.append(f"  │ Signal:      {o.signal} (conviction: {o.conviction:.0f}/100)")
            L.append(f"  │ Price:       ${o.price}")
            L.append(f"  │ Shares:      {o.shares}")
            L.append(f"  │ $ Amount:    ${o.dollar_amount:,.2f}  ({o.portfolio_pct:.1f}% of account)")
            L.append(f"  │ Options:     {o.option_type}")
            L.append(f"  │ Stop Loss:   ${o.stop_loss}")
            L.append(f"  │ Target:      ${o.target}  (R:R = {o.risk_reward})")
            L.append(f"  │ Why:         {o.reason}")
            L.append(f"  └───────────────────────────────────────────────────────")

    elif not sell_orders and not manage_orders:
        L.append("")
        L.append("═" * 72)
        L.append("  📭 NO ORDERS TODAY")
        L.append("═" * 72)
        L.append("  No actionable setups. 80% of profits come from 20% of trades.")
        L.append("  Patience IS the strategy.")

    # ── OPEN POSITIONS ──
    positions = load_positions()
    if positions:
        L.append("")
        L.append("─" * 72)
        L.append("  📊 OPEN POSITIONS")
        L.append("─" * 72)
        L.append(f"  {'TICKER':<8}{'ENTRY':>9}{'NOW':>9}{'P&L':>9}{'STOP':>9}{'TARGET':>9}{'DIR':>7}")
        L.append("  " + "─" * 60)
        for t, p in positions.items():
            sig = next((s for s in signals if s.ticker == t), None)
            cur = sig.current_price if sig else p["entry_price"]
            pnl = ((cur - p["entry_price"]) / p["entry_price"]) * 100
            if p["direction"] == "SHORT":
                pnl = -pnl
            L.append(
                f"  {t:<8}${p['entry_price']:>7.2f}  ${cur:>7.2f}  {pnl:>+7.1f}%"
                f"  ${p['stop_loss']:>7.2f}  ${p['target']:>7.2f}  {p['direction']:>6}"
            )

    # ── FULL WATCHLIST ──
    L.append("")
    L.append("─" * 72)
    L.append("  FULL WATCHLIST (sorted by conviction)")
    L.append("─" * 72)
    L.append(f"  {'TICKER':<7}{'PRICE':>8}{'1D':>7}{'5D':>7}{'RSI':>5}{'VOL':>5}{'SCORE':>6}{'SIGNAL':>15}")
    L.append("  " + "─" * 60)
    for s in sorted(signals, key=lambda x: x.conviction_score, reverse=True):
        L.append(
            f"  {s.ticker:<7}${s.current_price:>7.2f}"
            f"{s.change_1d:>+6.1f}%{s.change_5d:>+6.1f}%"
            f"{s.rsi:>4.0f}{s.vol_ratio:>4.1f}x{s.conviction_score:>5.0f}"
            f"{'  ' + s.signal:>15}"
        )

    # Weekly extras
    if weekly:
        L.append("")
        L.append("─" * 72)
        L.append("  SECTOR ROTATION")
        L.append("─" * 72)
        sectors = {}
        for s in signals:
            sectors.setdefault(s.sector, {"bull": 0, "bear": 0, "total": 0, "chg": []})
            sectors[s.sector]["total"] += 1
            sectors[s.sector]["chg"].append(s.change_5d)
            if s.signal_strength > 0: sectors[s.sector]["bull"] += 1
            elif s.signal_strength < 0: sectors[s.sector]["bear"] += 1
        for sec, d in sorted(sectors.items(), key=lambda x: sum(x[1]["chg"])/len(x[1]["chg"]), reverse=True):
            avg = sum(d["chg"]) / len(d["chg"])
            st = "LEADING ↑" if d["bull"] > d["bear"] else "LAGGING ↓" if d["bear"] > d["bull"] else "MIXED ↔"
            L.append(f"  {sec:<12} {d['bull']}/{d['total']} bull  |  5D: {avg:+.2f}%  |  {st}")

    L.append("")
    L.append("█" * 72)
    L.append("  ⚠️  Not financial advice. Verify before executing.")
    L.append("█" * 72)
    L.append("")
    return "\n".join(L)


def format_sms(buy_orders, sell_orders, manage_orders, regime):
    """SMS that tells you exactly what to do."""
    L = []
    L.append(f"◈ {datetime.now().strftime('%m/%d')} {regime.regime} ({regime.regime_multiplier}x)")
    L.append("")

    if sell_orders:
        L.append("🔴 EXIT:")
        for o in sell_orders:
            L.append(f"SELL {o.ticker} {o.shares}sh @${o.price}")
            L.append(f"→ {o.reason.split('.')[0]}")
        L.append("")

    if manage_orders:
        L.append("🟡 ADJUST:")
        for o in manage_orders:
            L.append(f"{o.ticker} {o.action}")
            if o.stop_loss: L.append(f"Stop→${o.stop_loss}")
        L.append("")

    if buy_orders:
        total = sum(o.portfolio_pct for o in buy_orders)
        L.append(f"🟢 BUY ({total:.0f}% of acct):")
        for o in buy_orders:
            d = "C" if "CALL" in o.action else "P"
            L.append(f"{o.ticker} {o.portfolio_pct:.0f}% ${o.dollar_amount:,.0f} ({o.shares}sh)")
            L.append(f"  {d} SL:${o.stop_loss} T:${o.target} {o.risk_reward}")
    elif not sell_orders and not manage_orders:
        L.append("📭 No trades today. Stay patient.")

    return "\n".join(L).strip()


# ─── SMS + LOGGING ───────────────────────────────────────────────────────────────

def send_sms(body):
    if not all([TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM, ALERT_PHONE]):
        log.warning("Twilio not configured. Add creds to .env")
        return False
    try:
        from twilio.rest import Client
        msg = Client(TWILIO_SID, TWILIO_TOKEN).messages.create(
            body=body, from_=TWILIO_FROM, to=ALERT_PHONE)
        log.info(f"SMS sent: {msg.sid}")
        return True
    except ImportError:
        log.error("pip install twilio")
    except Exception as e:
        log.error(f"SMS failed: {e}")
    return False


def save_scan_log(signals, regime, buy_orders, sell_orders, manage_orders,
                  output_dir=None):
    if output_dir is None:
        output_dir = os.path.join(SCRIPT_DIR, "scan_logs")
    os.makedirs(output_dir, exist_ok=True)
    fp = os.path.join(output_dir, f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(fp, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "regime": asdict(regime),
            "signals": [asdict(s) for s in signals],
            "buy_orders": [asdict(o) for o in buy_orders],
            "sell_orders": [asdict(o) for o in sell_orders],
            "manage_orders": [asdict(o) for o in manage_orders],
        }, f, indent=2, cls=NumpyEncoder)
    log.info(f"Log: {fp}")


# ─── MAIN ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="SPY Momentum Scanner — Daily Order Book")
    parser.add_argument("--sms", action="store_true", help="Send SMS alerts")
    parser.add_argument("--weekly", action="store_true", help="Weekly review mode")
    parser.add_argument("--account", type=int, default=ACCOUNT_SIZE, help=f"Account size (default: ${ACCOUNT_SIZE:,})")
    parser.add_argument("--json", action="store_true", help="Save to scan_logs/")
    parser.add_argument("--quiet", action="store_true", help="No console output")
    parser.add_argument("--data-source", choices=["polygon", "yahoo"], default="auto")
    parser.add_argument("--record", action="store_true",
                        help="After scan, interactively record which orders you executed")
    args = parser.parse_args()

    if args.account <= 0:
        parser.error("--account must be a positive integer")

    if args.data_source == "polygon" or (args.data_source == "auto" and POLYGON_API_KEY):
        if not POLYGON_API_KEY:
            log.error("No POLYGON_API_KEY. Use --data-source yahoo or add to .env")
            sys.exit(1)
        client = PolygonClient(POLYGON_API_KEY)
        log.info("Data: Polygon.io")
    else:
        client = YahooClient()
        log.info("Data: Yahoo Finance")

    account_size = args.account
    log.info(f"Account: ${account_size:,} | Risk/trade: ${account_size * RISK_PCT:,.0f}")

    signals = []
    for stock in WATCHLIST:
        log.info(f"  {stock['ticker']}...")
        df = client.get_daily_bars(stock["ticker"])
        client.rate_limit_pause()
        if df.empty:
            continue
        result = analyze_stock(df, stock, account_size)
        if result:
            signals.append(result)

    if not signals:
        log.error("No data. Check API.")
        sys.exit(1)

    spy_df = client.get_daily_bars(SPY_TICKER)
    spy_sig = analyze_stock(spy_df, {"ticker": "SPY", "name": "S&P 500", "weight": 100, "sector": "Index"}, account_size) if not spy_df.empty else None

    regime = determine_regime(signals, spy_sig)
    buy_orders, sell_orders, manage_orders = generate_orders(signals, regime, account_size)

    log.info(f"Regime: {regime.regime} | BUY: {len(buy_orders)} | SELL: {len(sell_orders)} | MANAGE: {len(manage_orders)}")

    report = format_order_book(buy_orders, sell_orders, manage_orders, signals, regime, account_size, args.weekly)
    if not args.quiet:
        print(report)

    if args.sms:
        sms = format_sms(buy_orders, sell_orders, manage_orders, regime)
        if not args.quiet:
            print("\n--- SMS PREVIEW ---")
            print(sms)
            print("--- END SMS ---\n")
        send_sms(sms)

    if args.json:
        save_scan_log(signals, regime, buy_orders, sell_orders, manage_orders)

    # Always write latest-scan.json for the PWA frontend
    frontend_data_dir = os.path.join(SCRIPT_DIR, "frontend", "data")
    os.makedirs(frontend_data_dir, exist_ok=True)
    latest_path = os.path.join(frontend_data_dir, "latest-scan.json")
    scan_data = {
        "timestamp": datetime.now().isoformat(),
        "regime": asdict(regime),
        "signals": [asdict(s) for s in signals],
        "buy_orders": [asdict(o) for o in buy_orders],
        "sell_orders": [asdict(o) for o in sell_orders],
        "manage_orders": [asdict(o) for o in manage_orders],
    }
    fd, tmp_path = tempfile.mkstemp(dir=frontend_data_dir, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(scan_data, f, indent=2, cls=NumpyEncoder)
        os.replace(tmp_path, latest_path)
        log.info(f"Frontend data: {latest_path}")
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    if args.record and (buy_orders or sell_orders):
        print("\n📝 Record executed orders:")
        for o in buy_orders:
            resp = input(f"  Executed {o.action} {o.ticker} {o.shares}sh? (y/n): ").strip().lower()
            if resp == "y":
                direction = "LONG"
                add_position(o.ticker, o.price, o.shares, o.stop_loss, o.target, direction, o.dollar_amount)
                print(f"    ✓ {o.ticker} recorded")
        for o in sell_orders:
            resp = input(f"  Closed {o.ticker}? (y/n): ").strip().lower()
            if resp == "y":
                remove_position(o.ticker)
                print(f"    ✓ {o.ticker} removed")


if __name__ == "__main__":
    main()
