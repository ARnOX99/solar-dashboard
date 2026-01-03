function openTab(tabId, button) {
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.remove('active');
  });
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');
  button.classList.add('active');
}

let systemMode = "AUTO";
let activeBattery = "NONE";

function sendCommand(cmd) {
  try {
    if (cmd === "AUTO") {
      systemMode = "AUTO";
      activeBattery = "AUTO SELECT";
    } else if (cmd === "MANUAL") {
      systemMode = "MANUAL";
      activeBattery = "NONE";
    } else if (systemMode === "MANUAL") {
      if (cmd === "BAT1") activeBattery = "Battery 1";
      else if (cmd === "BAT2") activeBattery = "Battery 2";
    } else {
      console.warn("Ignoring battery switch command in AUTO mode.");
      return;
    }

    updateStatus();
    console.log("Command sent:", cmd);

    // TODO: Add ThingSpeak API call here to send command to ESP

  } catch (err) {
    console.error("sendCommand error:", err);
  }
}

function updateStatus() {
  document.getElementById("modeStatus").innerText = systemMode;
  document.getElementById("batteryStatus").innerText = activeBattery;
}
