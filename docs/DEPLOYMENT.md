# Oracle Cloud Deployment Guide

## Prerequisites
- Oracle Cloud account (free, sign up at cloud.oracle.com)
- Always Free eligible ARM VM (Ampere A1, 4 OCPU / 24GB RAM)

## Step 1: Create the VM

1. Go to **Oracle Cloud Console** → **Compute** → **Instances** → **Create Instance**
2. Name it `querycanvas-server`
3. Image: **Canonical Ubuntu 22.04** (click "Change image" → Ubuntu)
4. Shape: **VM.Standard.A1.Flex** (ARM Ampere — Always Free eligible)
   - Set to **4 OCPU** and **24 GB RAM** (free tier max)
5. Networking: Create new VCN + public subnet, assign a **public IPv4**
6. Save the SSH private key when prompted (or upload your own)
7. Click **Create**

Wait ~2 min for the VM to show "Running" status. Note the **public IP**.

## Step 2: Open Port 8000

Oracle Cloud has TWO firewalls you must configure:

### A. VCN Security List (cloud-level)
1. Console → **Networking** → **Virtual Cloud Networks** → click your VCN
2. **Security Lists** → **Default Security List for-vcn-...**
3. **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `8000`
4. Click **Add Ingress Rules**

### B. OS Firewall (VM-level)
```bash
ssh -i <your-key> ubuntu@<VM-PUBLIC-IP>
sudo ufw allow 8000/tcp
sudo ufw allow ssh
sudo ufw --force enable
```

## Step 3: Upload the Project

From your Mac:
```bash
# Option A: SCP the entire project
scp -r -i <your-key> /Users/akash/Desktop/LIVUP/project1 ubuntu@<VM-PUBLIC-IP>:/home/ubuntu/querycanvas

# Option B: Push to GitHub first, then clone on the VM (recommended)
# On your Mac:
cd /Users/akash/Desktop/LIVUP/project1
git init && git add -A && git commit -m "QueryCanvas"
# Create a repo on GitHub, then:
git remote add origin git@github.com:<your-username>/querycanvas.git
git push -u origin main

# On the VM:
git clone https://github.com/<your-username>/querycanvas.git ~/querycanvas
```

## Step 4: Run the Deploy Script

SSH into the VM and run:
```bash
ssh -i <your-key> ubuntu@<VM-PUBLIC-IP>

# Run the deployment script
cd ~/querycanvas
chmod +x deploy.sh
# The script expects the project at /opt/querycanvas/app — adjust it:
sudo mkdir -p /opt/querycanvas/app
sudo cp -r ~/querycanvas/* /opt/querycanvas/app/
cd /opt/querycanvas/app
sudo bash deploy.sh
```

The script will:
1. Install Python, Node.js, and system packages
2. Create a Python virtual environment
3. Install backend dependencies
4. Build the frontend (`npm run build`)
5. Create a systemd service that auto-starts on boot
6. Configure the firewall

## Step 5: Verify

```bash
# Check the service is running
sudo systemctl status querycanvas

# Test locally on the VM
curl http://localhost:8000/

# View live logs
sudo journalctl -u querycanvas -f
```

From your browser, visit:
```
http://<VM-PUBLIC-IP>:8000
```

## Updating the App

After making changes on your Mac, push to GitHub:
```bash
git add -A && git commit -m "update" && git push
```

On the VM:
```bash
cd /opt/querycanvas/app
git pull
cd frontend && npm run build && cd ..
sudo systemctl restart querycanvas
```

## Useful Commands

```bash
sudo systemctl start querycanvas       # start
sudo systemctl stop querycanvas         # stop
sudo systemctl restart querycanvas      # restart
sudo systemctl status querycanvas        # status
sudo journalctl -u querycanvas -f        # live logs
sudo journalctl -u querycanvas --since "1 hour ago"  # recent logs
```

## Notes
- The app runs as a systemd service → **auto-starts on reboot** (permanent)
- SQLite files persist at whatever path you create them at (e.g. `/opt/querycanvas/data/mydb.db`)
- The Always Free tier is genuinely free — Oracle won't charge you as long as you stay within the limits (4 OCPU / 24GB RAM ARM)
- If the VM stops, Oracle may reclaim it after 7 days of inactivity. To prevent this, set up a cron job that pings the server:
  ```bash
  crontab -e
  # Add: */5 * * * * curl -s http://localhost:8000/ > /dev/null
  ```