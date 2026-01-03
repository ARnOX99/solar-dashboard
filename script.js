/* ================= CONFIG ================= */
const CHANNEL_ID = "YOUR_CHANNEL_ID";
const READ_API_KEY = "YOUR_READ_API_KEY";
const RESULTS = 20;

/* ================= GLOBALS ================= */
let charts = {};
let alertList = document.getElementById("alertList");

/* ================= TAB CONTROL ================= */
function openTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  event.target.classList.add("active");
}

/* ================= FETCH DATA ================= */
async function fetchData() {
  const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}&results=${RESULTS}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.feeds || data.feeds.length === 0) return;

  updateLive(data.feeds[data.feeds.length - 1]);
  updateCharts(data.feeds);
  checkAlerts(data.feeds[data.feeds.length - 1]);
}

/* ================= LIVE UPDATE ================= */
function updateLive(feed) {
  const lux = parseFloat(feed.field1);
  const hErr = parseFloat(feed.field2);
  const vErr = parseFloat(feed.field3);
  const sx = parseFloat(feed.field4);
  const sy = parseFloat(feed.field5);
  const v = parseFloat(feed.field6);
  const i = parseFloat(feed.field7);
  const batt = parseFloat(feed.field8);

  document.getElementById("lux").textContent = lux;
  document.getElementById("hError").textContent = hErr;
  document.getElementById("vError").textContent = vErr;
  document.getElementById("servoX").textContent = sx;
  document.getElementById("servoY").textContent = sy;
  document.getElementById("solarV").textContent = v;
  document.getElementById("solarI").textContent = i;
  document.getElementById("batteryV").textContent = batt;

  const power = (v * i) / 1000;
  document.getElementById("power").textContent = power.toFixed(2);
}

/* ================= CHARTS ================= */
function createChart(id, label, data, labels) {
  if (charts[id]) charts[id].destroy();

  charts[id] = new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        borderWidth: 2,
        fill: false
      }]
    }
  });
}

function updateCharts(feeds) {
  const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString());

  createChart("luxChart", "Lux", feeds.map(f => f.field1), labels);
  createChart("hErrorChart", "Horizontal Error", feeds.map(f => f.field2), labels);
  createChart("vErrorChart", "Vertical Error", feeds.map(f => f.field3), labels);
  createChart("servoXChart", "Servo X", feeds.map(f => f.field4), labels);
  createChart("servoYChart", "Servo Y", feeds.map(f => f.field5), labels);
  createChart("solarVChart", "Solar Voltage", feeds.map(f => f.field6), labels);
  createChart("solarIChart", "Solar Current", feeds.map(f => f.field7), labels);
  createChart("batteryVChart", "Battery Voltage", feeds.map(f => f.field8), labels);
}

/* ================= ALERTS ================= */
function checkAlerts(feed) {
  alertList.innerHTML = "";

  if (parseFloat(feed.field8) < 3.5) {
    alertList.innerHTML += "<li>⚠ Low Battery Voltage</li>";
  }

  if (parseFloat(feed.field1) > 500 && parseFloat(feed.field6) < 5) {
    alertList.innerHTML += "<li>⚠ Possible Panel Dirt / Weather Issue</li>";
  }

  if (alertList.innerHTML === "") {
    alertList.innerHTML = "<li>No alerts</li>";
  }
}

/* ================= AUTO REFRESH ================= */
fetchData();
setInterval(fetchData, 20000);
