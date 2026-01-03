const CHANNEL_ID = "YOUR_CHANNEL_ID";
const READ_API_KEY = "YOUR_READ_API_KEY";

const API_URL =
  `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?results=20&api_key=${READ_API_KEY}`;

let luxChart, hErrorChart, vErrorChart, batteryChart;

// TAB HANDLING
function openTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.style.display = "none";
  });
  document.getElementById(tabId).style.display = "block";
}

// DEFAULT TAB
openTab("live");

// FETCH DATA
async function fetchData() {
  const response = await fetch(API_URL);
  const data = await response.json();
  const feeds = data.feeds;

  if (feeds.length === 0) return;

  const latest = feeds[feeds.length - 1];

  const lux = parseFloat(latest.field1);
  const hError = parseFloat(latest.field2);
  const vError = parseFloat(latest.field3);
  const servoX = parseFloat(latest.field4);
  const servoY = parseFloat(latest.field5);
  const solarV = parseFloat(latest.field6);
  const solarI = parseFloat(latest.field7);
  const batteryV = parseFloat(latest.field8);

  // LIVE UPDATE
  document.getElementById("lux").innerText = lux;
  document.getElementById("hError").innerText = hError;
  document.getElementById("vError").innerText = vError;
  document.getElementById("servoX").innerText = servoX;
  document.getElementById("servoY").innerText = servoY;
  document.getElementById("solarV").innerText = solarV;
  document.getElementById("solarI").innerText = solarI;
  document.getElementById("batteryV").innerText = batteryV;

  const power = (solarV * solarI).toFixed(2);
  document.getElementById("power").innerText = power + " W";

  updateCharts(feeds);
  checkAlerts(lux, power, batteryV);
}

// CHART INITIALIZATION
function createChart(ctx, label) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label: label,
        data: [],
        borderWidth: 2
      }]
    }
  });
}

function updateCharts(feeds) {
  if (!luxChart) {
    luxChart = createChart(document.getElementById("luxChart"), "Lux");
    hErrorChart = createChart(document.getElementById("hErrorChart"), "Horizontal Error");
    vErrorChart = createChart(document.getElementById("vErrorChart"), "Vertical Error");
    batteryChart = createChart(document.getElementById("batteryChart"), "Battery Voltage");
  }

  feeds.forEach(feed => {
    const time = feed.created_at.split("T")[1].split("Z")[0];

    luxChart.data.labels.push(time);
    luxChart.data.datasets[0].data.push(feed.field1);

    hErrorChart.data.labels.push(time);
    hErrorChart.data.datasets[0].data.push(feed.field2);

    vErrorChart.data.labels.push(time);
    vErrorChart.data.datasets[0].data.push(feed.field3);

    batteryChart.data.labels.push(time);
    batteryChart.data.datasets[0].data.push(feed.field8);
  });

  luxChart.update();
  hErrorChart.update();
  vErrorChart.update();
  batteryChart.update();
}

// ALERT LOGIC
function checkAlerts(lux, power, batteryV) {
  const alerts = [];

  if (batteryV < 3.5) {
    alerts.push("⚠️ Low Battery Voltage");
  }

  if (lux > 500 && power < 5) {
    alerts.push("⚠️ Possible panel dirt or obstruction");
  }

  const list = document.getElementById("alertList");
  list.innerHTML = "";

  alerts.forEach(alert => {
    const li = document.createElement("li");
    li.innerText = alert;
    list.appendChild(li);
  });
}

// REFRESH EVERY 20 SECONDS
setInterval(fetchData, 20000);
fetchData();
