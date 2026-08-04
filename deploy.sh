#!/bin/bash
# ============================================================
# Database Visualizer & SQL Workspace — Deployment Script
# Run this on a fresh Oracle Cloud Ubuntu VM (ARM or AMD64)
# Usage: bash deploy.sh
# ============================================================
set -e

echo "=== Database Visualizer Deployment ==="
echo ""

# --- 1. System packages ---
echo "[1/7] Installing system packages..."
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv git curl ufw

# --- 2. Python virtual environment ---
echo "[2/7] Setting up Python environment..."
python3 -m venv /opt/dvws/venv
source /opt/dvws/venv/bin/activate
pip install --upgrade pip
pip install fastapi 'uvicorn[standard]' pydantic

# --- 3. Project setup ---
echo "[3/7] Setting up project..."
APP_DIR="/opt/dvws/app"
sudo mkdir -p "$APP_DIR"

# If you cloned/uploaded the project to a directory, adjust this path.
# For first-time setup, copy the project files:
if [ ! -f "$APP_DIR/backend/main.py" ]; then
  echo "  Please upload your project to $APP_DIR"
  echo "  Options:"
  echo "    a) git clone <your-repo> $APP_DIR"
  echo "    b) scp -r ./* ubuntu@<vm-ip>:$APP_DIR/"
  echo "  Then re-run this script."
  exit 1
fi

cd "$APP_DIR"
pip install -r backend/requirements.txt

# --- 4. Build frontend ---
echo "[4/7] Building frontend..."
# Install Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

# --- 5. Systemd service ---
echo "[5/7] Creating systemd service..."
sudo tee /etc/systemd/system/dvws.service > /dev/null << 'UNIT'
[Unit]
Description=Database Visualizer & SQL Workspace
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dvws/app
ExecStart=/opt/dvws/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=PORT=8000

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable dvws
sudo systemctl start dvws

# --- 6. Firewall ---
echo "[6/7] Configuring firewall..."
sudo ufw allow 8000/tcp
sudo ufw allow ssh
sudo ufw --force enable

# --- 7. Verify ---
echo "[7/7] Verifying..."
sleep 3
if curl -s http://localhost:8000/ | grep -q "Database Visualizer\|root\|html"; then
  echo ""
  echo "✅ Deployment successful!"
  echo "   The app is running on port 8000."
  echo ""
  echo "   To access it from the internet:"
  echo "   1. Open Oracle Cloud Console → Networking → Virtual Cloud Networks"
  echo "   2. Click your VCN → Security Lists → Default Security List"
  echo "   3. Add Ingress Rule: Source 0.0.0.0/0, IP Protocol TCP, Destination Port 8000"
  echo "   4. Access at: http://<your-vm-public-ip>:8000"
  echo ""
  echo "   Useful commands:"
  echo "     sudo systemctl status dvws    # check status"
  echo "     sudo systemctl restart dvws    # restart after updates"
  echo "     sudo journalctl -u dvws -f     # view live logs"
else
  echo "❌ Deployment may have failed. Check logs:"
  echo "   sudo journalctl -u dvws -f"
fi