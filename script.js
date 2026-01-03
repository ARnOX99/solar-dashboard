function showTab(tabId) {
  document.querySelectorAll('.tab-section')
    .forEach(section => section.classList.remove('active'));

  document.getElementById(tabId)
    .classList.add('active');
}
