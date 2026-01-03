function openTab(tabId, btn) {
  // Hide all sections
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.remove('active');
  });

  // Deactivate all tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // Show selected section
  document.getElementById(tabId).classList.add('active');

  // Activate clicked tab
  btn.classList.add('active');
}

let systemMode = "AUTO";
let activeBattery = "NONE";

function sendCommand(cmd) {
  if (cmd === "AUTO") {
    systemMode = "AUTO";
  }
  if (cmd === "MANUAL") {
    systemMode = "MANUAL";
  }
  if (cmd === "BAT1" && systemMode === "MANUAL") {
    activeBattery = "Battery 1";
  }
  if (cmd === "BAT2" && systemMode === "MANUAL") {
    activeBattery = "Battery 2";
  }

  updateUI();

  console.log("Command sent:", cmd);
  // This is where ThingSpeak / ESP API will be added
}

function updateUI() {
  document.getElementById("modeStatus").innerText = systemMode;
  document.getElementById("batteryStatus").innerText = activeBattery;
}
