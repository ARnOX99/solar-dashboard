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
let historicalData = [];  // Store all fetched data
let currentPage = 1;
let rowsPerPage = 50;
let sortColumn = -1;
let sortAscending = true;

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
    } else if (tabName === 'datatable') {
        loadDataTable();
    }
}

// Helper function to match tab icons
function getTabIcon(tabName) {
    const icons = {
        'live': '📊',
        'history': '📈',
        'datatable': '📋',
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
    document.getElementById('bhLux').textContent = parseFloat(data.field1 || 0).toFixed(1);
    document.getElementById('hError').textContent = parseInt(data.field2 || 0);
    document.getElementById('vError').textContent = parseInt(data.field3 || 0);
    document.getElementById('servoX').textContent = parseInt(data.field4 || 90);
    document.getElementById('servoY').textContent = parseInt(data.field5 || 90);
    document.getElementById('solarV').textContent = parseFloat(data.field6 || 0).toFixed(2);
    document.getElementById('solarI').textContent = parseFloat(data.field7 || 0).toFixed(2);
    document.getElementById('battV').textContent = parseFloat(data.field8 || 0).toFixed(2);

    const voltage = parseFloat(data.field6 || 0);
    const current = parseFloat(data.field7 || 0);
    const power = (voltage * current).toFixed(2);
    document.getElementById('solarP').textContent = power;

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

                const avg = Math.round((parseInt(ldrs[0]||0) + parseInt(ldrs[1]||0) + parseInt(ldrs[2]||0) + parseInt(ldrs[3]||0)) / 4);
                document.getElementById('avgLDR').textContent = avg;
            }
        });
    }

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

// ============ LOAD DATA TABLE ============
async function loadDataTable() {
    const range = document.getElementById('dataRange').value;
    const tableBody = document.getElementById('dataTableBody');

    // Show loading
    tableBody.innerHTML = `
        <tr>
            <td colspan="11" style="text-align: center; padding: 40px;">
                <div class="spinner"></div>
                <p>Loading ${range} readings from ThingSpeak...</p>
            </td>
        </tr>
    `;

    try {
        const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_KEY}&results=${range}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.feeds && data.feeds.length > 0) {
            historicalData = data.feeds;
            displayDataTable();
            updateStatistics();
        } else {
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;">No data available</td></tr>';
        }
    } catch (error) {
        console.error('Error loading data table:', error);
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px; color: #ef4444;">Error loading data. Please check ThingSpeak configuration.</td></tr>';
    }
}

// ============ DISPLAY DATA TABLE ============
function displayDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = historicalData.slice(start, end);

    let html = '';
    pageData.forEach((row, index) => {
        const actualIndex = start + index + 1;
        const timestamp = new Date(row.created_at).toLocaleString();
        const voltage = parseFloat(row.field6 || 0);
        const current = parseFloat(row.field7 || 0);
        const power = (voltage * current).toFixed(2);

        // Color code power values
        let powerClass = '';
        if (power > 1000) powerClass = 'high-power';
        else if (power > 500) powerClass = 'medium-power';
        else if (power > 0) powerClass = 'low-power';

        html += `
            <tr>
                <td>${actualIndex}</td>
                <td>${timestamp}</td>
                <td>${parseFloat(row.field1 || 0).toFixed(1)}</td>
                <td>${parseInt(row.field2 || 0)}</td>
                <td>${parseInt(row.field3 || 0)}</td>
                <td>${parseInt(row.field4 || 90)}</td>
                <td>${parseInt(row.field5 || 90)}</td>
                <td>${voltage.toFixed(2)}</td>
                <td>${current.toFixed(2)}</td>
                <td class="${powerClass}">${power}</td>
                <td>${parseFloat(row.field8 || 0).toFixed(2)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Update pagination
    const totalPages = Math.ceil(historicalData.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('rowCount').textContent = historicalData.length;

    // Update button states
    const prevBtn = document.querySelector('.pagination button:first-child');
    const nextBtn = document.querySelector('.pagination button:last-child');
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// ============ UPDATE STATISTICS ============
function updateStatistics() {
    let totalPower = 0;
    let maxPower = 0;

    historicalData.forEach(row => {
        const voltage = parseFloat(row.field6 || 0);
        const current = parseFloat(row.field7 || 0);
        const power = voltage * current;
        totalPower += power;
        if (power > maxPower) maxPower = power;
    });

    const avgPower = totalPower / historicalData.length;
    const totalEnergy = (totalPower * 20) / 3600000; // 20 sec intervals, convert to Wh

    document.getElementById('totalReadings').textContent = historicalData.length;
    document.getElementById('avgPower').textContent = avgPower.toFixed(2);
    document.getElementById('totalEnergy').textContent = totalEnergy.toFixed(2);
    document.getElementById('peakPower').textContent = maxPower.toFixed(2);
}

// ============ PAGINATION ============
function changePage(direction) {
    const totalPages = Math.ceil(historicalData.length / rowsPerPage);
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    displayDataTable();
}

// ============ SEARCH/FILTER TABLE ============
function filterTable() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const rows = document.querySelectorAll('#dataTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// ============ SORT TABLE ============
function sortTable(columnIndex) {
    if (sortColumn === columnIndex) {
        sortAscending = !sortAscending;
    } else {
        sortColumn = columnIndex;
        sortAscending = true;
    }

    historicalData.sort((a, b) => {
        let aVal, bVal;

        switch(columnIndex) {
            case 1: // Timestamp
                aVal = new Date(a.created_at);
                bVal = new Date(b.created_at);
                break;
            case 2: // Light
                aVal = parseFloat(a.field1 || 0);
                bVal = parseFloat(b.field1 || 0);
                break;
            case 3: // H Error
                aVal = parseInt(a.field2 || 0);
                bVal = parseInt(b.field2 || 0);
                break;
            case 4: // V Error
                aVal = parseInt(a.field3 || 0);
                bVal = parseInt(b.field3 || 0);
                break;
            case 5: // Servo X
                aVal = parseInt(a.field4 || 90);
                bVal = parseInt(b.field4 || 90);
                break;
            case 6: // Servo Y
                aVal = parseInt(a.field5 || 90);
                bVal = parseInt(b.field5 || 90);
                break;
            case 7: // Voltage
                aVal = parseFloat(a.field6 || 0);
                bVal = parseFloat(b.field6 || 0);
                break;
            case 8: // Current
                aVal = parseFloat(a.field7 || 0);
                bVal = parseFloat(b.field7 || 0);
                break;
            case 9: // Power
                aVal = parseFloat(a.field6 || 0) * parseFloat(a.field7 || 0);
                bVal = parseFloat(b.field6 || 0) * parseFloat(b.field7 || 0);
                break;
            case 10: // Battery
                aVal = parseFloat(a.field8 || 0);
                bVal = parseFloat(b.field8 || 0);
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return sortAscending ? -1 : 1;
        if (aVal > bVal) return sortAscending ? 1 : -1;
        return 0;
    });

    currentPage = 1;
    displayDataTable();
}

// ============ EXPORT TO CSV ============
function exportToCSV() {
    if (!historicalData || historicalData.length === 0) {
        alert('⚠️ No data available to export. Please load data first.');
        return;
    }

    // CSV Header
    let csv = 'Timestamp,Light Intensity (lux),H Error,V Error,Servo X (deg),Servo Y (deg),Voltage (V),Current (mA),Power (mW),Battery (V)\n';

    // Process each row with null/undefined handling
    historicalData.forEach(row => {
        const timestamp = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        // Parse all fields with fallback to 0 if null/undefined/empty
        const field1 = parseFloat(row.field1 || 0).toFixed(1);  // Light Intensity
        const field2 = parseInt(row.field2 || 0);                // H Error
        const field3 = parseInt(row.field3 || 0);                // V Error
        const field4 = parseInt(row.field4 || 90);               // Servo X (default 90)
        const field5 = parseInt(row.field5 || 90);               // Servo Y (default 90)
        const field6 = parseFloat(row.field6 || 0).toFixed(2);  // Voltage
        const field7 = parseFloat(row.field7 || 0).toFixed(2);  // Current
        const field8 = parseFloat(row.field8 || 0).toFixed(2);  // Battery

        // Calculate power with proper null handling
        const voltage = parseFloat(row.field6 || 0);
        const current = parseFloat(row.field7 || 0);
        const power = (voltage * current).toFixed(2);

        // Build CSV row - use quotes for timestamp to handle commas
        csv += `"${timestamp}",${field1},${field2},${field3},${field4},${field5},${field6},${field7},${power},${field8}\n`;
    });

    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `solar_tracker_data_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`✅ CSV exported: ${historicalData.length} rows`);
    alert(`✅ CSV file downloaded successfully!\n\nRows: ${historicalData.length}\nFile: solar_tracker_data_${dateStr}.csv`);
}


// ============ EXPORT TO EXCEL-COMPATIBLE CSV ============
function exportToExcel() {
    if (!historicalData || historicalData.length === 0) {
        alert('⚠️ No data available to export. Please load data first.');
        return;
    }

    // Excel-friendly CSV with UTF-8 BOM for proper encoding
    let csv = '\ufeffTimestamp,Light Intensity (lux),H Error,V Error,Servo X (deg),Servo Y (deg),Voltage (V),Current (mA),Power (mW),Battery (V)\n';

    // Process each row with comprehensive null handling
    historicalData.forEach(row => {
        const timestamp = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        // Parse all fields with fallback to 0 if null/undefined/empty
        // Use Number() for safer conversion
        const field1 = Number(row.field1) || 0;  // Light Intensity
        const field2 = Number(row.field2) || 0;  // H Error
        const field3 = Number(row.field3) || 0;  // V Error
        const field4 = Number(row.field4) || 90; // Servo X
        const field5 = Number(row.field5) || 90; // Servo Y
        const field6 = Number(row.field6) || 0;  // Voltage
        const field7 = Number(row.field7) || 0;  // Current
        const field8 = Number(row.field8) || 0;  // Battery

        // Calculate power
        const power = (field6 * field7).toFixed(2);

        // Format with proper decimal places
        const lightFormatted = field1.toFixed(1);
        const voltageFormatted = field6.toFixed(2);
        const currentFormatted = field7.toFixed(2);
        const batteryFormatted = field8.toFixed(2);

        // Build CSV row with quotes for timestamp
        csv += `"${timestamp}",${lightFormatted},${field2},${field3},${field4},${field5},${voltageFormatted},${currentFormatted},${power},${batteryFormatted}\n`;
    });

    // Create blob with proper MIME type and BOM
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `solar_tracker_data_excel_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`✅ Excel CSV exported: ${historicalData.length} rows`);
    alert(`✅ Excel-compatible CSV downloaded!\n\nRows: ${historicalData.length}\nFile: solar_tracker_data_excel_${dateStr}.csv\n\n💡 Tip: Open directly in Excel or Google Sheets`);
}

// ============ CHECK ALERTS ============
function checkAlerts(data) {
    if (!baselineData.current || baselineData.current === 0) {
        return;
    }

    const currentLux = parseFloat(data.field1 || 0);
    const currentCurrent = parseFloat(data.field7 || 0);

    if (currentLux < 100) {
        return;
    }

    const expectedCurrent = (currentLux / baselineData.bhLux) * baselineData.current;
    const threshold = 0.7;
    const performanceRatio = currentCurrent / expectedCurrent;

    if (performanceRatio < threshold) {
        showCleaningAlert(currentCurrent, expectedCurrent, performanceRatio);
    } else {
        removeCleaningAlert();
    }
}

function showCleaningAlert(actual, expected, ratio) {
    const alertsContainer = document.getElementById('alertsContainer');
    if (document.getElementById('cleaningAlert')) return;

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
    alertsContainer.insertAdjacentHTML('afterbegin', alertHTML);
}

function removeCleaningAlert() {
    const alert = document.getElementById('cleaningAlert');
    if (alert) alert.remove();
}

// ============ LOAD HISTORICAL DATA FOR CHARTS ============
async function loadHistoricalData() {
    try {
        const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_KEY}&results=100`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data && data.feeds && data.feeds.length > 0) {
            createCharts(data.feeds);
        } else {
            console.warn('No historical data available');
        }
    } catch (error) {
        console.error('Error loading historical data:', error);
    }
}

// ============ CREATE INDIVIDUAL CHARTS ============
function createCharts(feeds) {
    const timestamps = feeds.map(f => {
        const date = new Date(f.created_at);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    createCompactChart('chartIntensity', {
        labels: timestamps,
        datasets: [{
            label: 'Lux',
            data: feeds.map(f => parseFloat(f.field1 || 0)),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartHError', {
        labels: timestamps,
        datasets: [{
            label: 'H Error',
            data: feeds.map(f => parseInt(f.field2 || 0)),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartVError', {
        labels: timestamps,
        datasets: [{
            label: 'V Error',
            data: feeds.map(f => parseInt(f.field3 || 0)),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartServoX', {
        labels: timestamps,
        datasets: [{
            label: 'Degrees',
            data: feeds.map(f => parseInt(f.field4 || 90)),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartServoY', {
        labels: timestamps,
        datasets: [{
            label: 'Degrees',
            data: feeds.map(f => parseInt(f.field5 || 90)),
            borderColor: '#ec4899',
            backgroundColor: 'rgba(236, 72, 153, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartVoltage', {
        labels: timestamps,
        datasets: [{
            label: 'Volts',
            data: feeds.map(f => parseFloat(f.field6 || 0)),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartCurrent', {
        labels: timestamps,
        datasets: [{
            label: 'mA',
            data: feeds.map(f => parseFloat(f.field7 || 0)),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    createCompactChart('chartBattery', {
        labels: timestamps,
        datasets: [{
            label: 'Volts',
            data: feeds.map(f => parseFloat(f.field8 || 0)),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            fill: true,
            tension: 0.4
        }]
    });

    const powerData = feeds.map(f => {
        const voltage = parseFloat(f.field6 || 0);
        const current = parseFloat(f.field7 || 0);
        return (voltage * current).toFixed(2);
    });

    createCompactChart('chartPower', {
        labels: timestamps,
        datasets: [{
            label: 'mW',
            data: powerData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });

    const avgLDRData = feeds.map(f => {
        if (f.status && f.status.includes('LDRs:')) {
            const ldrPart = f.status.split(',').find(p => p.startsWith('LDRs:'));
            if (ldrPart) {
                const ldrs = ldrPart.split(':')[1].split('/').map(v => parseInt(v || 0));
                return Math.round((ldrs[0] + ldrs[1] + ldrs[2] + ldrs[3]) / 4);
            }
        }
        return 0;
    });

    createCompactChart('chartAvgLDR', {
        labels: timestamps,
        datasets: [{
            label: 'Units',
            data: avgLDRData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            tension: 0.4,
            fill: true
        }]
    });
}

function createCompactChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 }
                }
            }
        }
    });
}

// ============ COMMANDS & BASELINE ============
function sendCommand(command) {
    if (confirm(`Send command "${command}" to Arduino?`)) {
        console.log(`Command sent: ${command}`);
        alert(`✅ Command "${command}" queued for transmission.`);
    }
}

function setBaseline() {
    const currentLux = parseFloat(document.getElementById('bhLux').textContent);
    const currentAvgLDR = parseInt(document.getElementById('avgLDR').textContent);
    const currentVoltage = parseFloat(document.getElementById('solarV').textContent);
    const currentCurrent = parseFloat(document.getElementById('solarI').textContent);

    if (currentLux < 100) {
        alert('⚠️ Light intensity too low! Please set baseline in bright sunlight.');
        return;
    }

    if (currentCurrent < 10) {
        alert('⚠️ Solar current too low! Ensure panel is in direct sunlight.');
        return;
    }

    baselineData.bhLux = currentLux;
    baselineData.avgLDR = currentAvgLDR;
    baselineData.voltage = currentVoltage;
    baselineData.current = currentCurrent;

    localStorage.setItem('solarTrackerBaseline', JSON.stringify(baselineData));
    sendCommand('BASELINE');

    alert('✅ Baseline calibration set successfully!');
}

function checkCleaning() {
    if (!baselineData.current || baselineData.current === 0) {
        alert('⚠️ No baseline set! Please set a clean panel baseline first.');
        return;
    }

    const currentLux = parseFloat(document.getElementById('bhLux').textContent);
    const currentAvgLDR = parseInt(document.getElementById('avgLDR').textContent);
    const currentCurrent = parseFloat(document.getElementById('solarI').textContent);

    const expectedFromBH = (currentLux / baselineData.bhLux) * baselineData.current;
    const expectedFromLDR = (currentAvgLDR / baselineData.avgLDR) * baselineData.current;
    const expectedCurrent = (expectedFromBH + expectedFromLDR) / 2;
    const performance = (currentCurrent / expectedCurrent) * 100;

    const statusDiv = document.getElementById('cleaningStatus');
    const detailsDiv = document.getElementById('cleaningDetails');
    statusDiv.style.display = 'block';

    let statusHTML = `<strong>Performance: ${performance.toFixed(1)}%</strong><br><br>`;

    if (performance < 70) {
        statusHTML += '<div style="background: #fee2e2; padding: 15px; border-radius: 8px;"><strong>🧼 CLEANING REQUIRED</strong></div>';
    } else if (performance < 85) {
        statusHTML += '<div style="background: #fef3c7; padding: 15px; border-radius: 8px;"><strong>⚠️ MONITOR CLOSELY</strong></div>';
    } else {
        statusHTML += '<div style="background: #d1fae5; padding: 15px; border-radius: 8px;"><strong>✅ PANEL CLEAN</strong></div>';
    }

    detailsDiv.innerHTML = statusHTML;
}

function loadBaseline() {
    const saved = localStorage.getItem('solarTrackerBaseline');
    if (saved) {
        baselineData = JSON.parse(saved);
        console.log('Baseline loaded:', baselineData);
    }
}

// ============ INITIALIZE ============
window.onload = function() {
    console.log('Solar Tracker Dashboard initialized');
    loadBaseline();
    fetchLiveData();
    setInterval(fetchLiveData, UPDATE_INTERVAL);
};

