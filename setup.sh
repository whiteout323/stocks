#!/bin/bash
# ─── SPY Momentum Scanner — Quick Setup ──────────────────────────────
#
# Run this script to install dependencies and configure cron jobs
#
# Usage: chmod +x setup.sh && ./setup.sh
#

echo "◈ SPY Momentum Scanner — Setup"
echo "================================"

# 1. Install Python dependencies
echo ""
echo "[1/4] Installing Python dependencies..."
pip install requests python-dotenv twilio pandas

# 2. Create .env from template
if [ ! -f .env ]; then
    echo ""
    echo "[2/4] Creating .env file from template..."
    cp .env.example .env
    echo "  → Created .env — edit it with your API keys:"
    echo "    nano .env"
else
    echo ""
    echo "[2/4] .env already exists, skipping..."
fi

# 3. Create log directory
echo ""
echo "[3/4] Creating scan_logs directory..."
mkdir -p scan_logs

# 4. Set up cron jobs
echo ""
echo "[4/4] Cron job setup"
echo ""
echo "Add these to your crontab (run: crontab -e):"
echo ""
echo "# ── SPY Momentum Scanner ──────────────────────────────────────"
echo "# Daily pre-market scan at 6:00 AM PST (Mon-Fri) with SMS alerts"
echo "0 6 * * 1-5 cd $(pwd) && /usr/bin/python3 spy_momentum_scanner.py --sms --json >> scanner.log 2>&1"
echo ""
echo "# Weekly review Sunday at 6:00 PM PST"
echo "0 18 * * 0 cd $(pwd) && /usr/bin/python3 spy_momentum_scanner.py --weekly --sms --json >> scanner.log 2>&1"
echo "# ─────────────────────────────────────────────────────────────"
echo ""

# Quick test
echo "================================"
echo "Setup complete! Quick start:"
echo ""
echo "  1. Edit .env with your API keys:"
echo "     nano .env"
echo ""
echo "  2. Test the scanner:"
echo "     python3 spy_momentum_scanner.py"
echo ""
echo "  3. Test with SMS:"
echo "     python3 spy_momentum_scanner.py --sms"
echo ""
echo "  4. Weekly review mode:"
echo "     python3 spy_momentum_scanner.py --weekly"
echo ""
echo "  5. Add cron jobs (copy the lines above):"
echo "     crontab -e"
echo ""
echo "Options:"
echo "  --sms        Send SMS alerts via Twilio"
echo "  --weekly     Deeper analysis with sector breakdown"
echo "  --account N  Set account size (default: \$25,000)"
echo "  --json       Save scan results to scan_logs/"
echo "  --quiet      No console output (for cron)"
echo "  --data-source polygon|yahoo  Force data source"
echo ""
echo "No Polygon key? No problem — it auto-falls back to Yahoo Finance."
echo ""
