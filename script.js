function openTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));

  document.getElementById(tabId).classList.add('active');
  event.target.classList.add('active');
}

function sendCommand(cmd) {
  alert("Command sent: " + cmd);
  // Later this will call ThingSpeak / API
}
