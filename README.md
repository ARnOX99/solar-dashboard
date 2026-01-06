# Solar Tracker Dashboard

## 🌞 Real-time IoT Solar Energy Harvesting System

A comprehensive dual-axis solar tracking system with cloud-based monitoring, smart cleaning alerts, and remote control capabilities.

---

## 🎯 Features

- ✅ **Dual-Axis Sun Tracking** - Automatic horizontal and vertical panel positioning
- ✅ **Real-time Monitoring** - Live sensor data updated every 20 seconds
- ✅ **Smart Cleaning Alerts** - Dual-sensor validation for panel efficiency
- ✅ **Power Saving Mode** - Automatic energy conservation during night/cloudy periods
- ✅ **Remote Battery Management** - Manual switching between dual battery sources
- ✅ **Historical Data Visualization** - Interactive charts with 100+ data points
- ✅ **Responsive Web Dashboard** - Works on desktop, tablet, and mobile

---

## 🔧 Hardware Components

| Component | Description |
|-----------|-------------|
| **Arduino Uno** | Main microcontroller for sensor reading and servo control |
| **ESP8266 (ESP-01)** | WiFi connectivity and cloud communication |
| **4× LDR Sensors** | Light direction detection (West, East, Left, Right) |
| **BH1750** | Digital light intensity sensor (I2C) |
| **INA219** | Solar panel voltage and current monitoring (I2C) |
| **2× Servo Motors** | Dual-axis panel positioning (SG90/MG996R) |
| **2-Channel Relay** | Battery switching control |
| **2× 18650 Batteries** | Energy storage with automatic switching |
| **TP4056** | Battery charging module |
| **AMS1117** | 3.3V voltage regulator for ESP8266 |
| **Buck Converter** | 9V to 5V step-down for servo power |

---

## 📂 Project Structure

```
solar-tracker-dashboard/
├── index.html              # Main HTML structure
├── style.css               # Complete styling
├── script.js               # JavaScript functionality
├── images/
│   ├── solar-model.jpg     # Real solar tracker photo
│   ├── block-diagram.png   # System block diagram
│   └── circuit-diagram.png # Circuit schematic
├── Arduino/
│   └── Solar_Tracker_Arduino_FINAL.ino
├── ESP8266/
│   └── Solar_Tracker_ESP8266.ino
└── README.md
```

---

## 🚀 Quick Start

### 1. Hardware Setup
1. Connect all components according to the circuit diagram
2. Upload Arduino code to Arduino Uno
3. Upload ESP8266 code to ESP-01 module

### 2. ThingSpeak Configuration
1. Create a ThingSpeak account at https://thingspeak.com
2. Create a new channel with 8 fields:
   - Field 1: Light Intensity (BH1750 Lux)
   - Field 2: Horizontal Error
   - Field 3: Vertical Error
   - Field 4: Servo X Position
   - Field 5: Servo Y Position
   - Field 6: Solar Voltage
   - Field 7: Solar Current
   - Field 8: Battery Voltage

### 3. Code Configuration

**ESP8266 (Solar_Tracker_ESP8266.ino):**
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
unsigned long channelID = YOUR_CHANNEL_ID;
const char* writeAPIKey = "YOUR_WRITE_API_KEY";
```

**Dashboard (script.js):**
```javascript
const THINGSPEAK_CHANNEL_ID = 'YOUR_CHANNEL_ID';
const THINGSPEAK_READ_KEY = 'YOUR_READ_API_KEY';
```

### 4. Add Images
Place your images in the `images/` folder:
- `solar-model.jpg` - Photo of your solar tracker
- `block-diagram.png` - System architecture diagram
- `circuit-diagram.png` - Electrical circuit schematic

### 5. Deploy Dashboard
- **Local:** Open `index.html` in a web browser
- **GitHub Pages:** 
  1. Push to GitHub repository
  2. Go to Settings → Pages
  3. Select main branch and root folder
  4. Access at `https://yourusername.github.io/repo-name`

---

## 📊 Data Flow

```
Sensors → Arduino (500ms) → ESP8266 (2 sec) → ThingSpeak (20 sec) → Web Dashboard
```

**Complete Dataset (14 fields):**
1. Horizontal Error (East-West)
2. Vertical Error (Left-Right)
3. BH1750 Lux
4. Average LDR
5-8. Individual LDR values (W/E/L/R)
9-10. Servo X/Y positions
11-13. Solar Voltage/Current/Power
14. System Mode (Active/PowerSave)

---

## 🧼 Smart Cleaning Alert Algorithm

### Calibration (Clean Panel)
```
baseline_BHLux, baseline_AvgLDR, baseline_Current
ratio_BH = baseline_Current / baseline_BHLux
ratio_LDR = baseline_Current / baseline_AvgLDR
```

### Real-time Monitoring
```
expected_BH = current_BHLux × ratio_BH
expected_LDR = current_AvgLDR × ratio_LDR
expected_avg = (expected_BH + expected_LDR) / 2
```

### Alert Trigger
```
if (actual_current < expected_avg × 0.7):
    → ALERT: Panel cleaning recommended! (30% performance drop)
```

**Benefits:**
- Cross-validation prevents false alarms
- Accounts for sensor drift over time
- Works in varying light conditions

---

## 🔋 Power Management

### Power Save Mode
- **Trigger:** Light intensity < threshold for 10 minutes
- **Action:** Stops servo movement, reduces sensor reading frequency
- **Auto-Wake:** Resumes tracking when sunlight returns
- **Battery Life:** ~30-40% energy savings during inactive periods

### Dual Battery System
- Automatic relay switching between two 18650 batteries
- Manual override via web dashboard
- TP4056 solar charging for continuous operation

---

## 📱 Web Dashboard Tabs

### 1. Live Readings
- 10 real-time sensor values
- Individual LDR breakdown
- System status indicator
- Last update timestamp

### 2. Historical Data
- 5 interactive charts (Chart.js)
- 100 data points from ThingSpeak
- Zoom, pan, and hover tooltips

### 3. Alerts
- Smart cleaning recommendations
- Set baseline calibration
- Check cleaning status
- Algorithm explanation

### 4. Controls
- Battery switching (Battery 1/2/Auto)
- Baseline calibration trigger
- Power save mode status

### 5. About
- Complete project documentation
- Block diagram
- Circuit diagram
- Hardware specifications

---

## 🛠️ Required Libraries

### Arduino IDE
```
Adafruit_INA219
BH1750 (by Christopher Laws)
Servo (built-in)
Wire (built-in)
SoftwareSerial (built-in)
```

### ESP8266
```
ESP8266WiFi (built-in)
ESP8266HTTPClient (built-in)
ThingSpeak (Library Manager)
```

---

## 📸 Screenshots

![Solar Tracker Model](images/solar-model.jpg)
*Dual-axis solar tracking system in operation*

![Block Diagram](images/block-diagram.png)
*System architecture and data flow*

![Circuit Diagram](images/circuit-diagram.png)
*Complete electrical connections*

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

This project is open-source and available under the MIT License.

---

## 👥 Authors

[Your Name] - Initial work and development

---

## 🙏 Acknowledgments

- ThingSpeak IoT Platform
- Chart.js for data visualization
- Arduino and ESP8266 communities

---

## 📞 Contact

For questions or support:
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com

---

**⭐ If you found this project helpful, please give it a star!**
