// ============ CONFIGURATION ============
const THINGSPEAK_CHANNEL_ID = '3209440';  // CHANGE THIS
const THINGSPEAK_READ_KEY = 'RAP1FJI6NKHKOEI2';  // CHANGE THIS
const UPDATE_INTERVAL = 20000; // 20 seconds

// ============ GLOBAL VARIABLES ============
let charts = {};
let baselineData = {
    voltage: 0,
    current: 0,
    bhLux: 0,
    avgLDR: 0
};

// ============ TAB SWITCHING ============
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Highlight active tab button
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.textContent.includes(getTabIcon(tabName))) {
            tab.classList.add('active');
        }
    });

    // Load data for specific tabs
    if (tabName === 'history') {
        loadHistoricalData();
    }
}

// Helper function to match tab icons
function getTabIcon(tabName) {
    const icons = {
        'live': '📊',
        'history': '📈',
        'alerts': '🔔',
        'control': '🎛️',
        'about': 'ℹ️'
    };
    return icons[tabName] || '';
}

// ============ FETCH LIVE DATA FROM THINGSPEAK ============
async function fetchLiveData() {
    try {
        const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_READ_KEY}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.created_at) {
            updateLiveReadings(data);
            checkAlerts(data);
        } else {
            console.warn('No data received from ThingSpeak');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('systemStatus').innerHTML = '<div class="status-dot"></div><span>Connection Error</span>';
        document.getElementById('systemStatus').className = 'status-badge offline';
    }
}

// ============ UPDATE LIVE READINGS ============
function updateLiveReadings(data) {
    // ThingSpeak Fields:
    // Field1: BH1750 Lux
    // Field2: Horizontal Error
    // Field3: Vertical Error
    // Field4: Servo X
    // Field5: Servo Y
    // Field6: Solar Voltage
    // Field7: Solar Current
    // Field8: Battery Voltage

    document.getElementById('bhLux').textContent = parseFloat(data.field1 || 0).toFixed(1);
    document.getElementById('hError').textContent = parseInt(data.field2 || 0);
    document.getElementById('vError').textContent = parseInt(data.field3 || 0);
    document.getElementById('servoX').textContent = parseInt(data.field4 || 90);
    document.getElementById('servoY').textContent = parseInt(data.field5 || 90);
    document.getElementById('solarV').textContent = parseFloat(data.field6 || 0).toFixed(2);
    document.getElementById('solarI').textContent = parseFloat(data.field7 || 0).toFixed(2);
    document.getElementById('battV').textContent = parseFloat(data.field8 || 0).toFixed(2);

    // Calculate power (V × I)
    const voltage = parseFloat(data.field6 || 0);
    const current = parseFloat(data.field7 || 0);
    const power = (voltage * current).toFixed(2);
    document.getElementById('solarP').textContent = power;

    // Parse status field for additional data (LDRs and Mode)
    if (data.status) {
        const statusParts = data.status.split(',');
        statusParts.forEach(part => {
            if (part.startsWith('Mode:')) {
                const mode = part.split(':')[1];
                updateSystemStatus(mode);
            }
            if (part.startsWith('LDRs:')) {
                const ldrs = part.split(':')[1].split('/');
                document.getElementById('ldrW').textContent = ldrs[0] || '0';
                document.getElementById('ldrE').textContent = ldrs[1] || '0';
                document.getElementById('ldrL').textContent = ldrs[2] || '0';
                document.getElementById('ldrR').textContent = ldrs[3] || '0';

                // Calculate average
                const avg = Math.round((parseInt(ldrs[0]||0) + parseInt(ldrs[1]||0) + parseInt(ldrs[2]||0) + parseInt(ldrs[3]||0)) / 4);
                document.getElementById('avgLDR').textContent = avg;
            }
        });
    }

    // Update timestamp
    const now = new Date();
    document.getElementById('lastUpdate').textContent = `Last updated: ${now.toLocaleTimeString()}`;
}

// ============ UPDATE SYSTEM STATUS ============
function updateSystemStatus(mode) {
    const statusBadge = document.getElementById('systemStatus');
    const powerStatus = document.getElementById('powerStatus');

    if (mode === 'Active') {
        statusBadge.className = 'status-badge active';
        statusBadge.innerHTML = '<div class="status-dot"></div><span>System Active</span>';
        if (powerStatus) powerStatus.textContent = 'Active Tracking';
    } else if (mode === 'PowerSave') {
        statusBadge.className = 'status-badge powersave';
        statusBadge.innerHTML = '<div class="status-dot"></div><span>Power Save Mode</span>';
        if (powerStatus) powerStatus.textContent = 'Power Saving';
    }
}

// ============ CHECK ALERTS (SMART CLEANING DETECTION) ============
function checkAlerts(data) {
    if (!baselineData.current || baselineData.current === 0) {
        return; // No baseline set yet
    }

    const currentLux = parseFloat(data.field1 || 0);
    const currentCurrent = parseFloat(data.field7 || 0);

    // Only check if there's sufficient light
    if (currentLux < 100) {
        return; // Too dark to evaluate cleaning status
    }

    // Calculate expected current based on baseline ratio
    const expectedCurrent = (currentLux / baselineData.bhLux) * baselineData.current;

    // Check if actual current is significantly lower than expected
    const threshold = 0.7; // 70% of expected (30% drop triggers alert)
    const performanceRatio = currentCurrent / expectedCurrent;

    if (performanceRatio < threshold) {
        showCleaningAlert(currentCurrent, expectedCurrent, performanceRatio);
    } else {
        // Remove cleaning alert if performance is good
        removeCleaningAlert();
    }
}

// ============ SHOW CLEANING ALERT ============
function showCleaningAlert(actual, expected, ratio) {
    const alertsContainer = document.getElementById('alertsContainer');

    // Check if alert already exists
    if (document.getElementById('cleaningAlert')) {
        return;
    }

    const performanceDrop = ((1 - ratio) * 100).toFixed(1);

    const alertHTML = `
        <div class="alert danger" id="cleaningAlert">
            <span style="font-size: 1.5em;">🧼</span>
            <div>
                <strong>Cleaning Required!</strong><br>
                Expected current: ${expected.toFixed(2)} mA | Actual: ${actual.toFixed(2)} mA<br>
                Performance drop: ${performanceDrop}%
            </div>
        </div>
    `;

    // Insert at the beginning
    alertsContainer.insertAdjacentHTML('afterbegin', alertHTML);
}

// ============ REMOVE CLEANING ALERT ============
function removeCleaningAlert() {
    const alert = document.getElementById('cleaningAlert');
    if (alert) {
        alert.remove();
    }
}

// ============ LOAD HISTORICAL DATA ============
async function loadHistoricalData() {
    try {
        const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_KEY}&results=100`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.feeds && data.feeds.length > 0) {
            createCharts(data.feeds);
        } else {
            console.warn('No historical data available');
            // Show message in charts
            showNoDataMessage();
        }
    } catch (error) {
        console.error('Error loading historical data:', error);
        showNoDataMessage();
    }
}

// Show message when no data available
function showNoDataMessage() {
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.font = '16px Arial';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.fillText('No data available. Please check ThingSpeak configuration.', canvas.width / 2, canvas.height / 2);
        }
    });
}

// ============ CREATE CHARTS ============
function createCharts(feeds) {
    // Extract timestamps
    const timestamps = feeds.map(f => {
        const date = new Date(f.created_at);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    // 1. Intensity Chart (BH1750)
    createChart('chartIntensity', {
        labels: timestamps,
        datasets: [{
            label: 'Light Intensity (Lux)',
            data: feeds.map(f => parseFloat(f.field1 || 0)),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    // 2. Tracking Errors Chart
    createChart('chartErrors', {
        labels: timestamps,
        datasets: [
            {
                label: 'Horizontal Error',
                data: feeds.map(f => parseInt(f.field2 || 0)),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4
            },
            {
                label: 'Vertical Error',
                data: feeds.map(f => parseInt(f.field3 || 0)),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }
        ]
    });

    // 3. Servo Positions Chart
    createChart('chartServos', {
        labels: timestamps,
        datasets: [
            {
                label: 'Servo X (Horizontal)',
                data: feeds.map(f => parseInt(f.field4 || 90)),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4
            },
            {
                label: 'Servo Y (Vertical)',
                data: feeds.map(f => parseInt(f.field5 || 90)),
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                tension: 0.4
            }
        ]
    });

    // 4. Solar Performance Chart (Dual Y-axis)
    createChart('chartSolar', {
        labels: timestamps,
        datasets: [
            {
                label: 'Voltage (V)',
                data: feeds.map(f => parseFloat(f.field6 || 0)),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                yAxisID: 'y',
                tension: 0.4
            },
            {
                label: 'Current (mA)',
                data: feeds.map(f => parseFloat(f.field7 || 0)),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                yAxisID: 'y1',
                tension: 0.4
            }
        ]
    }, true); // Dual axis enabled

    // 5. Battery Voltage Chart
    createChart('chartBattery', {
        labels: timestamps,
        datasets: [{
            label: 'Battery Voltage (V)',
            data: feeds.map(f => parseFloat(f.field8 || 0)),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.4
        }]
    });
}

// ============ CREATE INDIVIDUAL CHART ============
function createChart(canvasId, data, dualAxis = false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
        console.error(`Canvas element ${canvasId} not found`);
        return;
    }

    // Destroy existing chart if it exists
    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    const options = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    padding: 15,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    // Add second Y-axis for dual-axis charts
    if (dualAxis) {
        options.scales.y1 = {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: {
                drawOnChartArea: false
            }
        };
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: data,
        options: options
    });
}

// ============ SEND COMMAND TO ARDUINO (via ThingSpeak TalkBack or Server) ============
function sendCommand(command) {
    // Display confirmation
    const confirmMsg = `Send command "${command}" to Arduino?\n\n` +
                      `Note: This requires ThingSpeak TalkBack API or a server-side relay.\n` +
                      `For now, this is a demonstration.`;

    if (confirm(confirmMsg)) {
        console.log(`Command sent: ${command}`);

        // TODO: Implement actual command sending via:
        // 1. ThingSpeak TalkBack API
        // 2. Custom server endpoint
        // 3. MQTT broker

        // Example ThingSpeak TalkBack implementation:
        /*
        const talkbackID = 'YOUR_TALKBACK_ID';
        const talkbackKey = 'YOUR_TALKBACK_KEY';
        fetch(`https://api.thingspeak.com/talkbacks/${talkbackID}/commands.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                api_key: talkbackKey, 
                command_string: command 
            })
        });
        */

        alert(`✅ Command "${command}" queued for transmission.`);
    }
}

// ============ SET BASELINE CALIBRATION ============
function setBaseline() {
    const currentLux = parseFloat(document.getElementById('bhLux').textContent);
    const currentAvgLDR = parseInt(document.getElementById('avgLDR').textContent);
    const currentVoltage = parseFloat(document.getElementById('solarV').textContent);
    const currentCurrent = parseFloat(document.getElementById('solarI').textContent);

    // Validate data
    if (currentLux < 100) {
        alert('⚠️ Light intensity too low! Please set baseline in bright sunlight.');
        return;
    }

    if (currentCurrent < 10) {
        alert('⚠️ Solar current too low! Ensure panel is in direct sunlight.');
        return;
    }

    // Store baseline
    baselineData.bhLux = currentLux;
    baselineData.avgLDR = currentAvgLDR;
    baselineData.voltage = currentVoltage;
    baselineData.current = currentCurrent;

    // Save to localStorage
    localStorage.setItem('solarTrackerBaseline', JSON.stringify(baselineData));

    // Send BASELINE command to Arduino
    sendCommand('BASELINE');

    alert('✅ Baseline calibration set successfully!\n\n' +
          `BH1750 Lux: ${baselineData.bhLux.toFixed(1)}\n` +
          `Avg LDR: ${baselineData.avgLDR}\n` +
          `Voltage: ${baselineData.voltage.toFixed(2)} V\n` +
          `Current: ${baselineData.current.toFixed(2)} mA`);
}

// ============ CHECK CLEANING STATUS ============
function checkCleaning() {
    if (!baselineData.current || baselineData.current === 0) {
        alert('⚠️ No baseline set!\n\nPlease set a clean panel baseline first.');
        return;
    }

    const currentLux = parseFloat(document.getElementById('bhLux').textContent);
    const currentAvgLDR = parseInt(document.getElementById('avgLDR').textContent);
    const currentCurrent = parseFloat(document.getElementById('solarI').textContent);

    // Calculate expected current from both sensors
    const expectedFromBH = (currentLux / baselineData.bhLux) * baselineData.current;
    const expectedFromLDR = (currentAvgLDR / baselineData.avgLDR) * baselineData.current;
    const expectedCurrent = (expectedFromBH + expectedFromLDR) / 2;

    // Calculate performance
    const performance = (currentCurrent / expectedCurrent) * 100;

    // Display results
    const statusDiv = document.getElementById('cleaningStatus');
    const detailsDiv = document.getElementById('cleaningDetails');

    statusDiv.style.display = 'block';

    let statusHTML = `
        <strong>📊 Current Analysis:</strong><br><br>
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: white;">
                <td style="padding: 10px;"><strong>Light Intensity (BH1750):</strong></td>
                <td style="padding: 10px;">${currentLux.toFixed(1)} lux (Baseline: ${baselineData.bhLux.toFixed(1)} lux)</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 10px;"><strong>Average LDR:</strong></td>
                <td style="padding: 10px;">${currentAvgLDR} (Baseline: ${baselineData.avgLDR})</td>
            </tr>
            <tr style="background: white;">
                <td style="padding: 10px;"><strong>Expected Current (BH1750):</strong></td>
                <td style="padding: 10px;">${expectedFromBH.toFixed(2)} mA</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 10px;"><strong>Expected Current (LDR):</strong></td>
                <td style="padding: 10px;">${expectedFromLDR.toFixed(2)} mA</td>
            </tr>
            <tr style="background: white;">
                <td style="padding: 10px;"><strong>Expected Current (Average):</strong></td>
                <td style="padding: 10px;">${expectedCurrent.toFixed(2)} mA</td>
            </tr>
            <tr style="background: #f8f9fa;">
                <td style="padding: 10px;"><strong>Actual Current:</strong></td>
                <td style="padding: 10px;">${currentCurrent.toFixed(2)} mA</td>
            </tr>
            <tr style="background: white;">
                <td style="padding: 10px;"><strong>Performance:</strong></td>
                <td style="padding: 10px; font-size: 1.2em; font-weight: bold;">${performance.toFixed(1)}%</td>
            </tr>
        </table>
        <br>
    `;

    // Add recommendation
    if (performance < 70) {
        statusHTML += '<div style="background: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">';
        statusHTML += '<span style="color: #991b1b; font-weight: bold; font-size: 1.1em;">🧼 CLEANING REQUIRED</span><br>';
        statusHTML += '<span style="color: #991b1b;">Performance below 70% - Panel cleaning strongly recommended!</span>';
        statusHTML += '</div>';
    } else if (performance < 85) {
        statusHTML += '<div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">';
        statusHTML += '<span style="color: #92400e; font-weight: bold; font-size: 1.1em;">⚠️ MONITOR CLOSELY</span><br>';
        statusHTML += '<span style="color: #92400e;">Performance slightly degraded - Consider cleaning soon.</span>';
        statusHTML += '</div>';
    } else {
        statusHTML += '<div style="background: #d1fae5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">';
        statusHTML += '<span style="color: #065f46; font-weight: bold; font-size: 1.1em;">✅ PANEL CLEAN</span><br>';
        statusHTML += '<span style="color: #065f46;">Performance optimal - No cleaning needed at this time.</span>';
        statusHTML += '</div>';
    }

    detailsDiv.innerHTML = statusHTML;
}

// ============ LOAD BASELINE FROM LOCALSTORAGE ============
function loadBaseline() {
    const saved = localStorage.getItem('solarTrackerBaseline');
    if (saved) {
        baselineData = JSON.parse(saved);
        console.log('Baseline loaded from localStorage:', baselineData);
    }
}

// ============ INITIALIZE ON PAGE LOAD ============
window.onload = function() {
    console.log('Solar Tracker Dashboard initialized');

    // Load saved baseline
    loadBaseline();

    // Initial data fetch
    fetchLiveData();

    // Set up periodic updates
    setInterval(fetchLiveData, UPDATE_INTERVAL);

    // Add GitHub link update helper
    const githubLink = document.getElementById('githubLink');
    if (githubLink) {
        githubLink.addEventListener('click', function(e) {
            if (this.href === '#' || this.href.endsWith('#')) {
                e.preventDefault();
                const repoURL = prompt('Enter your GitHub repository URL:', 'https://github.com/yourusername/solar-tracker');
                if (repoURL) {
                    this.href = repoURL;
                    this.textContent = repoURL;
                }
            }
        });
    }
};

// ============ ERROR HANDLING ============
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ', msg, '\nURL: ', url, '\nLine: ', lineNo, '\nColumn: ', columnNo, '\nError object: ', error);
    return false;
};

