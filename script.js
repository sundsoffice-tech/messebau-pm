// Projektmanagement mit REST‑API und SQLite‑Datenbank

// Statusoptionen und zugehörige nächste Schritte definieren
const statuses = [
  'Anfrage',
  'Angebot',
  'Auftrag',
  'Design',
  'Produktion',
  'Logistik',
  'Montage',
  'Abbau',
  'Abgeschlossen'
];

const nextStepMapping = {
  'Anfrage': 'Angebot erstellen',
  'Angebot': 'Auftrag erteilen',
  'Auftrag': 'Design finalisieren',
  'Design': 'Produktion vorbereiten',
  'Produktion': 'Logistik planen',
  'Logistik': 'Montage vorbereiten',
  'Montage': 'Abbau vorbereiten',
  'Abbau': 'Projekt abschließen',
  'Abgeschlossen': '-'
};

const tasksForStatus = {
  'Anfrage': [
    'Anforderungen aufnehmen',
    'Standgröße und Besonderheiten klären',
    'Budgetrahmen besprechen'
  ],
  'Angebot': [
    'Kalkulation erstellen',
    'Angebot an Kunde senden',
    'Freigabe vom Kunden einholen'
  ],
  'Auftrag': [
    'Auftragsbestätigung versenden',
    'Projekt im System anlegen'
  ],
  'Design': [
    'Grundriss erstellen',
    '3D‑Rendering erarbeiten',
    'Revisionen einarbeiten',
    'Finale Freigabe erhalten'
  ],
  'Produktion': [
    'Materialliste erstellen',
    'Banner und Drucke bestellen',
    'Möbel und Technik reservieren',
    'Transport planen'
  ],
  'Logistik': [
    'Route planen',
    'Fahrer und Fahrzeuge einteilen',
    'Ladeplan erstellen',
    'Packliste abhaken'
  ],
  'Montage': [
    'Montageteam zuweisen',
    'Uhrzeit und Ansprechpartner festlegen',
    'Montage‑Checkliste durchgehen',
    'Abschlussfotos anfertigen'
  ],
  'Abbau': [
    'Abbauzeit bestätigen',
    'Rücktransport organisieren',
    'Material im Lager einbuchen',
    'Nachkalkulation durchführen'
  ],
  'Abgeschlossen': [
    'Feedback einholen',
    'Projekt archivieren'
  ]
};

// Zeigt eine Benachrichtigung an
function showAlert(message, type = 'error') {
  const alerts = document.getElementById('alerts');
  alerts.textContent = message;
  alerts.classList.remove('hidden');
  alerts.className = '';
  alerts.classList.add(type === 'error' ? 'error' : 'success');
  setTimeout(() => {
    alerts.classList.add('hidden');
  }, 3000);
}

// Berechnet das Fälligkeitsdatum (7 Tage vor dem angegebenen Datum)
function calculateDueDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

// Lädt Projekte vom Server
async function fetchProjects() {
  try {
    const resp = await fetch('/api/projects');
    if (!resp.ok) throw new Error('Fehler beim Laden der Projekte');
    const data = await resp.json();
    renderProjects(data);
  } catch (err) {
    showAlert(err.message || 'Unbekannter Fehler');
  }
}

// Rendert die Tabelle mit den Projekten
function renderProjects(projects) {
  const tbody = document.querySelector('#projects-table tbody');
  tbody.innerHTML = '';
  projects.forEach((project) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${project.name}</td>
      <td>${project.customer}</td>
      <td>${project.fair || '-'}</td>
      <td>${project.size ? project.size + ' m²' : '-'}</td>
      <td></td>
      <td>${project.nextStep || '-'}</td>
      <td>${project.dueDate || '-'}</td>
      <td class="actions"></td>
    `;
    // Status Drop‑Down
    const statusTd = tr.children[4];
    const select = document.createElement('select');
    select.className = 'status-select';
    statuses.forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      if (st === project.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      const newStatus = select.value;
      updateProjectStatus(project.id, newStatus);
    });
    statusTd.appendChild(select);
    // Aktionen
    const actionsTd = tr.querySelector('.actions');
    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = 'Details';
    detailsBtn.className = 'details';
    detailsBtn.addEventListener('click', () => {
      showProjectDetail(project);
    });
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Löschen';
    deleteBtn.className = 'delete';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Projekt wirklich löschen?')) {
        deleteProject(project.id);
      }
    });
    actionsTd.appendChild(detailsBtn);
    actionsTd.appendChild(deleteBtn);
    tbody.appendChild(tr);
  });
}

// Erstellt ein neues Projekt
async function createProject(data) {
  try {
    const resp = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Projekt konnte nicht gespeichert werden');
    await fetchProjects();
    showAlert('Projekt gespeichert', 'success');
  } catch (err) {
    showAlert(err.message || 'Fehler beim Speichern');
  }
}

// Aktualisiert den Status eines Projekts
async function updateProjectStatus(id, newStatus) {
  const nextStep = nextStepMapping[newStatus];
  // Optional: dueDate bleibt unverändert, da Datum im Projekt gespeichert
  try {
    const resp = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, nextStep: nextStep })
    });
    if (!resp.ok) throw new Error('Status konnte nicht aktualisiert werden');
    await fetchProjects();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Aktualisieren');
  }
}

// Löscht ein Projekt
async function deleteProject(id) {
  try {
    const resp = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!resp.ok && resp.status !== 204) throw new Error('Projekt konnte nicht gelöscht werden');
    await fetchProjects();
    showAlert('Projekt gelöscht', 'success');
  } catch (err) {
    showAlert(err.message || 'Fehler beim Löschen');
  }
}

// Zeigt Detailansicht eines Projekts an
function showProjectDetail(project) {
  const detailSection = document.getElementById('project-detail');
  const contentDiv = document.getElementById('detail-content');
  contentDiv.innerHTML = '';
  const general = document.createElement('div');
  general.innerHTML = `
    <h3>Allgemeine Daten</h3>
    <p><strong>Name:</strong> ${project.name}</p>
    <p><strong>Kunde:</strong> ${project.customer}</p>
    <p><strong>Messe / Standort:</strong> ${project.fair || '-'}</p>
    <p><strong>Standgröße:</strong> ${project.size ? project.size + ' m²' : '-'}</p>
    <p><strong>Datum:</strong> ${project.date || '-'}</p>
    <p><strong>Status:</strong> ${project.status}</p>
    <p><strong>Nächster Schritt:</strong> ${project.nextStep || '-'}</p>
    <p><strong>Fällig bis:</strong> ${project.dueDate || '-'}</p>`;
  contentDiv.appendChild(general);
  const tasksDiv = document.createElement('div');
  const tasks = tasksForStatus[project.status] || [];
  tasksDiv.innerHTML = `<h3>Checkliste – ${project.status}</h3>`;
  const ul = document.createElement('ul');
  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.textContent = task;
    ul.appendChild(li);
  });
  if (!tasks.length) {
    const li = document.createElement('li');
    li.textContent = 'Keine Schritte definiert.';
    ul.appendChild(li);
  }
  tasksDiv.appendChild(ul);
  contentDiv.appendChild(tasksDiv);
  detailSection.classList.remove('hidden');
}

// Schließt die Detailansicht
document.getElementById('close-detail').addEventListener('click', () => {
  document.getElementById('project-detail').classList.add('hidden');
});

// Formularbehandlung
document.getElementById('project-form').addEventListener('submit', (e) => {
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
  const nextStep = nextStepMapping[status];
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
  e.target.reset();
});

// Beim Laden der Seite Projekte abrufen
window.addEventListener('DOMContentLoaded', () => {
  fetchProjects();
});