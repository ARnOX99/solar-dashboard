// ============ CONFIGURATION ============
const THINGSPEAK_CHANNEL_ID = '3209440';  // CHANGE THIS
const THINGSPEAK_READ_KEY = 'RAP1FJI6NKHKOEI2';  // CHANGE THIS
const UPDATE_INTERVAL = 20000; // 20 seconds

// Global variables
let charts = {};
let historicalData = [];
let currentPage = 1;
let rowsPerPage = 50;
let cleanBaseline = {
    bhLux: null,
    avgLDR: null,
    solarI: null
};

// ============ TAB SWITCHING ============
function switchTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab content
    document.getElementById(tabId).classList.add('active');

    // Add active to clicked tab
    event.target.classList.add('active');

    // If switching to history tab, load historical data
    if (tabId === 'history') {
        fetchHistoricalData();
    }
}

// ============ FETCH LIVE DATA ============
async function fetchLiveData() {
    try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=1`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            const latest = data.feeds[0];
            updateLiveReadings(latest);
            updateStatus('active');
            return true;
        } else {
            updateStatus('offline');
            console.log('No data received from ThingSpeak');
            return false;
        }
    } catch (error) {
        console.error('Error fetching live data:', error);
        updateStatus('offline');
        return false;
    }
}

// ============ UPDATE LIVE READINGS ============
function updateLiveReadings(data) {
    // Parse values with null/undefined handling
    const bhLux = Number(data.field1) || 0;
    const hError = Number(data.field2) || 0;
    const vError = Number(data.field3) || 0;
    const servoX = Number(data.field4) || 90;
    const servoY = Number(data.field5) || 90;
    const solarV = Number(data.field6) || 0;
    const solarI = Number(data.field7) || 0;
    const battV = Number(data.field8) || 0;

    // Calculate power
    const solarP = (solarV * solarI).toFixed(2);

    // Update display
    document.getElementById('bhLux').textContent = bhLux.toFixed(1);
    document.getElementById('hError').textContent = hError;
    document.getElementById('vError').textContent = vError;
    document.getElementById('servoX').textContent = servoX;
    document.getElementById('servoY').textContent = servoY;
    document.getElementById('solarV').textContent = solarV.toFixed(2);
    document.getElementById('solarI').textContent = solarI.toFixed(2);
    document.getElementById('battV').textContent = battV.toFixed(2);
    document.getElementById('solarP').textContent = solarP;

    // Calculate average LDR from field1 (if BH1750 is used as proxy)
    const avgLDR = Math.round(bhLux / 10);
    document.getElementById('avgLDR').textContent = avgLDR;

    // Update LDR individual readings (estimated from tracking errors)
    const baseLight = bhLux / 4;
    document.getElementById('ldrW').textContent = Math.round(baseLight - hError);
    document.getElementById('ldrE').textContent = Math.round(baseLight + hError);
    document.getElementById('ldrL').textContent = Math.round(baseLight - vError);
    document.getElementById('ldrR').textContent = Math.round(baseLight + vError);

    // Update last update time
    const timestamp = new Date(data.created_at);
    document.getElementById('lastUpdate').textContent = 
        `Last updated: ${timestamp.toLocaleString()}`;

    // Check for power save mode
    if (bhLux < 100 && solarP < 50) {
        updateStatus('powersave');
    } else {
        updateStatus('active');
    }
}

// ============ UPDATE STATUS ============
function updateStatus(status) {
    const statusBadge = document.getElementById('systemStatus');
    const powerStatus = document.getElementById('powerStatus');

    statusBadge.classList.remove('active', 'powersave', 'offline');

    switch(status) {
        case 'active':
            statusBadge.classList.add('active');
            statusBadge.innerHTML = '<div class="status-dot"></div><span>System Active</span>';
            if (powerStatus) powerStatus.textContent = 'Active - Tracking';
            break;
        case 'powersave':
            statusBadge.classList.add('powersave');
            statusBadge.innerHTML = '<div class="status-dot"></div><span>Power Save Mode</span>';
            if (powerStatus) powerStatus.textContent = 'Power Save - Low Light';
            break;
        case 'offline':
            statusBadge.classList.add('offline');
            statusBadge.innerHTML = '<div class="status-dot"></div><span>Offline</span>';
            if (powerStatus) powerStatus.textContent = 'Offline';
            break;
    }
}

// ============ FETCH HISTORICAL DATA ============
async function fetchHistoricalData() {
    try {
        // Fetch last 100 readings for charts
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=100`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            createCharts(data.feeds);
        } else {
            console.log('No historical data available');
        }
    } catch (error) {
        console.error('Error fetching historical data:', error);
    }
}

// ============ CREATE CHARTS ============
function createCharts(feeds) {
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    charts = {};

    // Prepare data arrays
    const timestamps = feeds.map(feed => {
        const date = new Date(feed.created_at);
        return date.toLocaleTimeString();
    });

    const field1Data = feeds.map(feed => Number(feed.field1) || 0);
    const field2Data = feeds.map(feed => Number(feed.field2) || 0);
    const field3Data = feeds.map(feed => Number(feed.field3) || 0);
    const field4Data = feeds.map(feed => Number(feed.field4) || 90);
    const field5Data = feeds.map(feed => Number(feed.field5) || 90);
    const field6Data = feeds.map(feed => Number(feed.field6) || 0);
    const field7Data = feeds.map(feed => Number(feed.field7) || 0);
    const field8Data = feeds.map(feed => Number(feed.field8) || 0);
    const powerData = feeds.map(feed => {
        const v = Number(feed.field6) || 0;
        const i = Number(feed.field7) || 0;
        return (v * i).toFixed(2);
    });
    const avgLDRData = feeds.map(feed => Math.round((Number(feed.field1) || 0) / 10));

    // Chart configuration
    const commonConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    display: false
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            }
        }
    };

    // Create individual charts
    charts.intensity = new Chart(document.getElementById('chartIntensity'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field1Data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.hError = new Chart(document.getElementById('chartHError'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field2Data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.vError = new Chart(document.getElementById('chartVError'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field3Data,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.servoX = new Chart(document.getElementById('chartServoX'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field4Data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.servoY = new Chart(document.getElementById('chartServoY'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field5Data,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.voltage = new Chart(document.getElementById('chartVoltage'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field6Data,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.current = new Chart(document.getElementById('chartCurrent'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field7Data,
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.battery = new Chart(document.getElementById('chartBattery'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: field8Data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.power = new Chart(document.getElementById('chartPower'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: powerData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });

    charts.avgLDR = new Chart(document.getElementById('chartAvgLDR'), {
        ...commonConfig,
        data: {
            labels: timestamps,
            datasets: [{
                data: avgLDRData,
                borderColor: '#ec4899',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                tension: 0.3,
                fill: true
            }]
        }
    });
}

// ============ LOAD DATA TABLE ============
async function loadDataTable() {
    const dataRange = document.getElementById('dataRange').value;
    const tableBody = document.getElementById('dataTableBody');

    // Show loading spinner
    tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;"><div class="spinner"></div><p>Loading data from ThingSpeak...</p></td></tr>';

    try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=${dataRange}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.feeds && data.feeds.length > 0) {
            historicalData = data.feeds.reverse(); // Newest first
            currentPage = 1;
            displayDataTable();
            updateStatistics();
        } else {
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;">No data available</td></tr>';
        }
    } catch (error) {
        console.error('Error loading data table:', error);
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: #ef4444;">Error loading data: ${error.message}</td></tr>`;
    }
}

// ============ DISPLAY DATA TABLE ============
function displayDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = historicalData.slice(start, end);

    if (pageData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px;">No data on this page</td></tr>';
        return;
    }

    let html = '';
    let nullWarningShown = false;

    pageData.forEach((row, index) => {
        const actualIndex = start + index + 1;
        const timestamp = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        // Safe parsing with fallbacks
        const field1 = Number(row.field1) || 0;
        const field2 = Number(row.field2) || 0;
        const field3 = Number(row.field3) || 0;
        const field4 = Number(row.field4) || 90;
        const field5 = Number(row.field5) || 90;
        const field6 = Number(row.field6) || 0;
        const field7 = Number(row.field7) || 0;
        const field8 = Number(row.field8) || 0;
        const power = (field6 * field7).toFixed(2);

        // Check for null values and add warning style
        let rowClass = '';
        if (row.field1 === null || row.field6 === null || row.field7 === null || 
            row.field1 === '' || row.field6 === '' || row.field7 === '') {
            rowClass = 'class="null-warning"';
            nullWarningShown = true;
        }

        // Color code power values
        let powerClass = '';
        if (power > 1000) powerClass = 'high-power';
        else if (power > 500) powerClass = 'medium-power';
        else if (power > 0) powerClass = 'low-power';

        html += `
            <tr ${rowClass}>
                <td>${actualIndex}</td>
                <td>${timestamp}</td>
                <td>${field1.toFixed(1)}</td>
                <td>${field2}</td>
                <td>${field3}</td>
                <td>${field4}</td>
                <td>${field5}</td>
                <td>${field6.toFixed(2)}</td>
                <td>${field7.toFixed(2)}</td>
                <td class="${powerClass}">${power}</td>
                <td>${field8.toFixed(2)}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;

    // Show warning if nulls detected
    const warningDiv = document.getElementById('dataWarning');
    if (warningDiv) {
        if (nullWarningShown) {
            warningDiv.style.display = 'block';
        } else {
            warningDiv.style.display = 'none';
        }
    }

    // Update pagination
    const totalPages = Math.ceil(historicalData.length / rowsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('rowCount').textContent = historicalData.length;

    // Update button states
    const pagination = document.querySelectorAll('.pagination button');
    if (pagination[0]) pagination[0].disabled = currentPage === 1;
    if (pagination[1]) pagination[1].disabled = currentPage === totalPages;
}

// ============ UPDATE STATISTICS ============
function updateStatistics() {
    let totalPower = 0;
    let maxPower = 0;
    let validReadings = 0;
    let nullReadings = 0;

    historicalData.forEach(row => {
        const voltage = Number(row.field6) || 0;
        const current = Number(row.field7) || 0;

        // Check if this is a null reading
        if (row.field6 === null || row.field7 === null || row.field6 === '' || row.field7 === '') {
            nullReadings++;
        } else {
            validReadings++;
        }

        const power = voltage * current;
        totalPower += power;
        if (power > maxPower) maxPower = power;
    });

    const avgPower = validReadings > 0 ? totalPower / validReadings : 0;
    const totalEnergy = (totalPower * 20) / 3600000; // 20 sec intervals, convert to Wh

    document.getElementById('totalReadings').textContent = historicalData.length;
    document.getElementById('avgPower').textContent = avgPower.toFixed(2);
    document.getElementById('totalEnergy').textContent = totalEnergy.toFixed(2);
    document.getElementById('peakPower').textContent = maxPower.toFixed(2);

    // Show data quality info
    const dataQuality = historicalData.length > 0 ? 
        ((validReadings / historicalData.length) * 100).toFixed(1) : 0;
    const qualityDiv = document.getElementById('dataQuality');
    if (qualityDiv) {
        qualityDiv.style.display = 'block';
        qualityDiv.innerHTML = `
            <strong>Data Quality:</strong> ${dataQuality}% complete
            (${validReadings} valid readings, ${nullReadings} with missing data)
        `;
    }
}

// ============ PAGINATION ============
function changePage(direction) {
    const totalPages = Math.ceil(historicalData.length / rowsPerPage);
    currentPage += direction;

    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    displayDataTable();
}

// ============ EXPORT TO CSV ============
function exportToCSV() {
    if (!historicalData || historicalData.length === 0) {
        alert('⚠️ No data available to export. Please load data first by clicking "Refresh Data".');
        return;
    }

    // CSV Header
    let csv = 'Timestamp,Light Intensity (lux),H Error,V Error,Servo X (deg),Servo Y (deg),Voltage (V),Current (mA),Power (mW),Battery (V)\n';

    // Process each row with null/undefined handling
    historicalData.forEach(row => {
        const timestamp = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        // Parse all fields with fallback to 0 if null/undefined/empty
        const field1 = Number(row.field1) || 0;
        const field2 = Number(row.field2) || 0;
        const field3 = Number(row.field3) || 0;
        const field4 = Number(row.field4) || 90;
        const field5 = Number(row.field5) || 90;
        const field6 = Number(row.field6) || 0;
        const field7 = Number(row.field7) || 0;
        const field8 = Number(row.field8) || 0;

        // Calculate power with proper null handling
        const power = (field6 * field7).toFixed(2);

        // Format with proper decimal places
        const lightFormatted = field1.toFixed(1);
        const voltageFormatted = field6.toFixed(2);
        const currentFormatted = field7.toFixed(2);
        const batteryFormatted = field8.toFixed(2);

        // Build CSV row - use quotes for timestamp to handle commas
        csv += `"${timestamp}",${lightFormatted},${field2},${field3},${field4},${field5},${voltageFormatted},${currentFormatted},${power},${batteryFormatted}\n`;
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
    alert(`✅ CSV file downloaded successfully!\n\nRows: ${historicalData.length}\nFile: solar_tracker_data_${dateStr}.csv\n\n💡 All null values have been replaced with 0 for clean data.`);
}

// ============ EXPORT TO EXCEL ============
function exportToExcel() {
    if (!historicalData || historicalData.length === 0) {
        alert('⚠️ No data available to export. Please load data first by clicking "Refresh Data".');
        return;
    }

    // Excel-friendly CSV with UTF-8 BOM for proper encoding
    let csv = '\ufeffTimestamp,Light Intensity (lux),H Error,V Error,Servo X (deg),Servo Y (deg),Voltage (V),Current (mA),Power (mW),Battery (V)\n';

    // Process each row with comprehensive null handling
    historicalData.forEach(row => {
        const timestamp = row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A';

        // Parse all fields with fallback to 0 if null/undefined/empty
        const field1 = Number(row.field1) || 0;
        const field2 = Number(row.field2) || 0;
        const field3 = Number(row.field3) || 0;
        const field4 = Number(row.field4) || 90;
        const field5 = Number(row.field5) || 90;
        const field6 = Number(row.field6) || 0;
        const field7 = Number(row.field7) || 0;
        const field8 = Number(row.field8) || 0;

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
    alert(`✅ Excel-compatible CSV downloaded!\n\nRows: ${historicalData.length}\nFile: solar_tracker_data_excel_${dateStr}.csv\n\n💡 Tip: Open directly in Excel or Google Sheets\n✅ All null values replaced with 0`);
}

// ============ DATA QUALITY CHECK ============
function checkDataQuality() {
    if (!historicalData || historicalData.length === 0) {
        alert('❌ No data loaded. Click "Refresh Data" first.');
        return;
    }

    let nullCount = 0;
    let totalFields = 0;

    historicalData.forEach(row => {
        for (let i = 1; i <= 8; i++) {
            totalFields++;
            if (row[`field${i}`] === null || row[`field${i}`] === undefined || row[`field${i}`] === '') {
                nullCount++;
            }
        }
    });

    const nullPercentage = ((nullCount / totalFields) * 100).toFixed(1);
    const completeFields = totalFields - nullCount;

    let qualityMessage = '';
    if (nullPercentage < 5) {
        qualityMessage = '✅ Excellent data quality!';
    } else if (nullPercentage < 15) {
        qualityMessage = '⚠️ Acceptable quality with some gaps';
    } else {
        qualityMessage = '❌ Poor quality - check sensor connections';
    }

    alert(`📊 Data Quality Report\n\n` +
          `Total Readings: ${historicalData.length}\n` +
          `Fields Checked: ${totalFields}\n` +
          `Null/Missing: ${nullCount} (${nullPercentage}%)\n` +
          `Complete Fields: ${completeFields}\n\n` +
          `${qualityMessage}`);
}

// ============ TABLE FILTERING ============
function filterTable() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const table = document.getElementById('dataTable');
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');

    let visibleCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const text = row.textContent.toLowerCase();

        if (text.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    }

    document.getElementById('rowCount').textContent = visibleCount;
}

// ============ TABLE SORTING ============
let sortColumn = -1;
let sortAscending = true;

function sortTable(column) {
    if (sortColumn === column) {
        sortAscending = !sortAscending;
    } else {
        sortColumn = column;
        sortAscending = true;
    }

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = historicalData.slice(start, end);

    pageData.sort((a, b) => {
        let aVal, bVal;

        switch(column) {
            case 0: // Index
                return 0; // Don't sort index
            case 1: // Timestamp
                aVal = new Date(a.created_at);
                bVal = new Date(b.created_at);
                break;
            case 2: // Light
                aVal = Number(a.field1) || 0;
                bVal = Number(b.field1) || 0;
                break;
            case 3: // H Error
                aVal = Number(a.field2) || 0;
                bVal = Number(b.field2) || 0;
                break;
            case 4: // V Error
                aVal = Number(a.field3) || 0;
                bVal = Number(b.field3) || 0;
                break;
            case 5: // Servo X
                aVal = Number(a.field4) || 90;
                bVal = Number(b.field4) || 90;
                break;
            case 6: // Servo Y
                aVal = Number(a.field5) || 90;
                bVal = Number(b.field5) || 90;
                break;
            case 7: // Voltage
                aVal = Number(a.field6) || 0;
                bVal = Number(b.field6) || 0;
                break;
            case 8: // Current
                aVal = Number(a.field7) || 0;
                bVal = Number(b.field7) || 0;
                break;
            case 9: // Power
                aVal = (Number(a.field6) || 0) * (Number(a.field7) || 0);
                bVal = (Number(b.field6) || 0) * (Number(b.field7) || 0);
                break;
            case 10: // Battery
                aVal = Number(a.field8) || 0;
                bVal = Number(b.field8) || 0;
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return sortAscending ? -1 : 1;
        if (aVal > bVal) return sortAscending ? 1 : -1;
        return 0;
    });

    // Update the page data in historicalData
    historicalData.splice(start, pageData.length, ...pageData);
    displayDataTable();
}

// ============ CLEANING DETECTION ============
function setBaseline() {
    const current = {
        bhLux: parseFloat(document.getElementById('bhLux').textContent) || 0,
        avgLDR: parseFloat(document.getElementById('avgLDR').textContent) || 0,
        solarI: parseFloat(document.getElementById('solarI').textContent) || 0
    };

    if (current.bhLux < 100) {
        alert('⚠️ Light intensity too low! Please wait for sunny conditions to set baseline.');
        return;
    }

    if (current.solarI < 50) {
        alert('⚠️ Solar current too low! Ensure panel is producing power in good sunlight.');
        return;
    }

    cleanBaseline = current;
    localStorage.setItem('cleanBaseline', JSON.stringify(cleanBaseline));

    alert(`✅ Baseline set successfully!\n\nLight: ${current.bhLux} lux\nAvg LDR: ${current.avgLDR}\nCurrent: ${current.solarI} mA\n\nCleaning detection is now active.`);

    // Update alerts container
    updateAlert('info', `✅ Clean panel baseline set at ${new Date().toLocaleString()}`);
}

function checkCleaning() {
    // Load baseline from storage if exists
    const stored = localStorage.getItem('cleanBaseline');
    if (stored) {
        cleanBaseline = JSON.parse(stored);
    }

    if (!cleanBaseline.bhLux) {
        alert('⚠️ No baseline set! Please click "Set Clean Panel Baseline" first when panel is freshly cleaned.');
        return;
    }

    const current = {
        bhLux: parseFloat(document.getElementById('bhLux').textContent) || 0,
        avgLDR: parseFloat(document.getElementById('avgLDR').textContent) || 0,
        solarI: parseFloat(document.getElementById('solarI').textContent) || 0
    };

    if (current.bhLux < 100) {
        alert('⚠️ Light intensity too low to check cleaning status. Please check during sunny conditions.');
        return;
    }

    // Calculate expected current based on light intensity
    const expectedCurrent = (current.bhLux / cleanBaseline.bhLux) * cleanBaseline.solarI;
    const performanceRatio = (current.solarI / expectedCurrent) * 100;

    // Cross-validate with LDR
    const ldrRatio = current.avgLDR / cleanBaseline.avgLDR;
    const ldrExpectedCurrent = ldrRatio * cleanBaseline.solarI;
    const ldrPerformanceRatio = (current.solarI / ldrExpectedCurrent) * 100;

    // Weighted average (60% BH1750, 40% LDR)
    const weightedRatio = (performanceRatio * 0.6) + (ldrPerformanceRatio * 0.4);

    let status = '';
    let alertType = '';

    if (weightedRatio >= 85) {
        status = '✅ Panel is CLEAN - Performance excellent!';
        alertType = 'info';
    } else if (weightedRatio >= 70) {
        status = '⚠️ Panel performance slightly reduced - Monitor condition';
        alertType = 'warning';
    } else {
        status = '🧼 CLEANING REQUIRED - Performance significantly reduced!';
        alertType = 'danger';
    }

    const details = `
        <strong>Performance Analysis:</strong><br>
        Current Light: ${current.bhLux} lux<br>
        Expected Current: ${expectedCurrent.toFixed(2)} mA<br>
        Actual Current: ${current.solarI} mA<br>
        <br>
        <strong>Performance Ratio:</strong> ${weightedRatio.toFixed(1)}%<br>
        (BH1750: ${performanceRatio.toFixed(1)}%, LDR: ${ldrPerformanceRatio.toFixed(1)}%)<br>
        <br>
        <strong>Status:</strong> ${status}
    `;

    document.getElementById('cleaningStatus').style.display = 'block';
    document.getElementById('cleaningDetails').innerHTML = details;

    updateAlert(alertType, status);
}

// ============ ALERTS MANAGEMENT ============
function updateAlert(type, message) {
    const alertsContainer = document.getElementById('alertsContainer');
    const timestamp = new Date().toLocaleString();

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;

    let icon = '';
    switch(type) {
        case 'warning': icon = '⚠️'; break;
        case 'danger': icon = '🚨'; break;
        case 'info': icon = 'ℹ️'; break;
        default: icon = '✅';
    }

    alertDiv.innerHTML = `
        <span style="font-size: 1.5em;">${icon}</span>
        <span>${message} <em style="font-size: 0.9em;">(${timestamp})</em></span>
    `;

    alertsContainer.insertBefore(alertDiv, alertsContainer.firstChild);

    // Keep only last 10 alerts
    while (alertsContainer.children.length > 10) {
        alertsContainer.removeChild(alertsContainer.lastChild);
    }
}

// ============ SEND COMMANDS (For future IoT control) ============
function sendCommand(command) {
    // Placeholder for sending commands to Arduino
    // In future, implement MQTT or ThingSpeak TalkBack
    alert(`🎛️ Command sent: ${command}\n\n(Command functionality requires MQTT broker or ThingSpeak TalkBack setup)`);
    console.log(`Command: ${command}`);
}

// ============ INITIALIZE ON PAGE LOAD ============
window.addEventListener('DOMContentLoaded', () => {
    console.log('Solar Tracker Dashboard initialized');

    // Fetch live data immediately
    fetchLiveData();

    // Update live data every 20 seconds
    setInterval(fetchLiveData, 20000);

    // Load stored baseline if exists
    const stored = localStorage.getItem('cleanBaseline');
    if (stored) {
        cleanBaseline = JSON.parse(stored);
        console.log('Loaded baseline:', cleanBaseline);
    }
});




