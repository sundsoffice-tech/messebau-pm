// Skript zum Anlegen eines neuen Projekts

const nextStepMappingCreate = {
  'Anfrage': 'Angebot erstellen'
};

function showAlert(message, type = 'error') {
  const alerts = document.getElementById('alerts');
  if (!alerts) return;
  alerts.textContent = message;
  alerts.classList.remove('hidden');
  alerts.className = '';
  alerts.classList.add(type === 'error' ? 'error' : 'success');
  setTimeout(() => {
    alerts.classList.add('hidden');
  }, 3000);
}

function calculateDueDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

async function createProject(data) {
  try {
    const resp = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Projekt konnte nicht gespeichert werden');
    showAlert('Projekt gespeichert', 'success');
    // optional: zurück zur Übersicht
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (err) {
    showAlert(err.message || 'Fehler beim Speichern');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('project-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('projName').value.trim();
    const customer = document.getElementById('customer').value.trim();
    const fair = document.getElementById('fair').value.trim();
    const sizeValue = document.getElementById('size').value;
    const size = sizeValue ? Number(sizeValue) : null;
    const date = document.getElementById('date').value;
    const priority = document.getElementById('priority').value;
    if (!name || !customer) {
      showAlert('Bitte Name und Kunde angeben');
      return;
    }
    const status = 'Anfrage';
    const nextStep = nextStepMappingCreate[status];
    const dueDate = calculateDueDate(date);
    const project = {
      name,
      customer,
      fair,
      size,
      date,
      priority,
      status,
      nextStep,
      dueDate
    };
    createProject(project);
    form.reset();
  });
});