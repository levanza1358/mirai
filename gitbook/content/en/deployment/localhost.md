# 🏠 Localhost Deployment

Run Mirai on your local machine for development and personal use.

---

## 📦 Installation

Install Mirai globally via npm:

```bash
npm install -g mirai
```

**Requirements:**
- Node.js 20 or higher
- npm 9 or higher

---

## 🚀 Starting the Server

Start Mirai with a single command:

```bash
mirai
```

The dashboard will automatically open in your browser at `http://localhost:3000`

**Default Configuration:**
- **Dashboard**: `http://localhost:3000`
- **API Endpoint**: `http://localhost:1463/v1`
- **Data Directory**: `~/.mirai`

---

## 🔧 Configuration

### Custom Data Directory

Set a custom data directory using environment variable:

```bash
DATA_DIR=/path/to/data mirai
```

### Custom Port

The API port (1463) and dashboard port (3000) are configured in the application. To change them, you'll need to modify the source code or use environment variables if supported.

---

## 🛑 Stopping the Server

Press `Ctrl+C` in the terminal where Mirai is running.

```bash
# In the terminal running mirai
^C  # Press Ctrl+C
```

The server will gracefully shut down and save all data.

---

## 🔄 Restarting the Server

Simply run the start command again:

```bash
mirai
```

All your configurations, API keys, and combos are preserved in the data directory.

---

## 📊 Updating Mirai

Update to the latest version:

```bash
npm update -g mirai
```

Check your current version:

```bash
npm list -g mirai
```

---

## 🔍 Troubleshooting

### Port Already in Use

If port 1463 or 3000 is already in use:

```bash
# Find process using the port (macOS/Linux)
lsof -i :1463
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Permission Errors

If you encounter permission errors during installation:

```bash
# Use sudo (not recommended)
sudo npm install -g mirai

# Or fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Data Directory Issues

If the data directory is not accessible:

```bash
# Check permissions
ls -la ~/.mirai

# Fix permissions
chmod 755 ~/.mirai
```

---

## 📁 Data Directory Structure

```
~/.mirai/
├── db.json           # Main database (providers, combos, settings)
├── logs/             # Application logs
└── cache/            # Temporary cache files
```

**Backup Your Data:**

```bash
# Backup
cp -r ~/.mirai ~/.mirai.backup

# Restore
cp -r ~/.mirai.backup ~/.mirai
```

---

## 🔗 Next Steps

- [Connect Providers](/providers/subscription.md)
- [Create Combos](/features/combos.md)
- [Integrate with CLI Tools](/integration/cursor.md)
