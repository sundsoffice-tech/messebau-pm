// Übersicht der Projekte mit offenen Aufgaben

// Statusoptionen für Projekte
const projectStatuses = [
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

// Mapping für nächsten Schritt je nach Status
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

// Checklisten für Projektstatus (für Detailansicht)
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

// Benachrichtigung anzeigen
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

// Speicherung der geladenen Projekte, um Filter anwenden zu können
let allProjects = [];

// Projekte abrufen und speichern
async function fetchProjects() {
  try {
    const resp = await fetch('/api/projects');
    if (!resp.ok) throw new Error('Projekte konnten nicht geladen werden');
    const projects = await resp.json();
    // Offene Aufgaben zählen
    allProjects = await Promise.all(projects.map(async (proj) => {
      const tasksResp = await fetch(`/api/projects/${proj.id}/tasks`);
      let tasks = [];
      if (tasksResp.ok) {
        tasks = await tasksResp.json();
      }
      const openCount = tasks.filter(t => t.status !== 'Done').length;
      return { ...proj, openTasks: openCount };
    }));
    applyProjectFilters();
  } catch (err) {
    showAlert(err.message || 'Unbekannter Fehler');
  }
}

// Filter anwenden auf Projekte
function applyProjectFilters() {
  const searchInput = document.getElementById('project-search');
  let filtered = allProjects.slice();
  if (searchInput && searchInput.value.trim()) {
    const term = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(p => {
      const nameMatch = p.name && p.name.toLowerCase().includes(term);
      const custMatch = p.customer && p.customer.toLowerCase().includes(term);
      return nameMatch || custMatch;
    });
  }
  renderProjects(filtered);
}

// Tabelle rendern
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
      <td>${project.openTasks}</td>
      <td>${project.nextStep || '-'}</td>
      <td>${project.dueDate || '-'}</td>
      <td class="actions"></td>
    `;
    // Statusauswahl
    const statusTd = tr.children[4];
    const select = document.createElement('select');
    select.className = 'status-select';
    projectStatuses.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      if (st === project.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      updateProjectStatus(project.id, select.value);
    });
    statusTd.appendChild(select);
    // Aktionen
    const actionsTd = tr.querySelector('.actions');
    // Detail Button
    const detailBtn = document.createElement('button');
    detailBtn.textContent = 'Details';
    detailBtn.className = 'details';
    detailBtn.addEventListener('click', () => {
      showProjectDetail(project);
    });
    // Aufgaben Button
    const tasksBtn = document.createElement('button');
    tasksBtn.textContent = 'Aufgaben';
    tasksBtn.className = 'details';
    tasksBtn.addEventListener('click', () => {
      // zur Projekt‑Aufgabenansicht navigieren
      window.location.href = `project_tasks.html?id=${project.id}`;
    });
    // Löschen Button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Löschen';
    deleteBtn.className = 'delete';
    deleteBtn.addEventListener('click', () => {
      if (confirm('Projekt wirklich löschen?')) {
        deleteProject(project.id);
      }
    });
    actionsTd.appendChild(detailBtn);
    actionsTd.appendChild(tasksBtn);
    actionsTd.appendChild(deleteBtn);
    tbody.appendChild(tr);
  });
}

// Status aktualisieren
async function updateProjectStatus(id, newStatus) {
  const nextStep = nextStepMapping[newStatus];
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

// Projekt löschen
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

// Detailansicht anzeigen
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
  // Checkliste anzeigen
  const tasksDiv = document.createElement('div');
  const tasks = tasksForStatus[project.status] || [];
  tasksDiv.innerHTML = `<h3>Checkliste – ${project.status}</h3>`;
  const ul = document.createElement('ul');
  if (tasks.length) {
    tasks.forEach(t => {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'Keine Schritte definiert.';
    ul.appendChild(li);
  }
  tasksDiv.appendChild(ul);
  contentDiv.appendChild(tasksDiv);
  detailSection.classList.remove('hidden');
}

// Detailansicht schließen
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('close-detail');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('project-detail').classList.add('hidden');
    });
  }
  // Suchfeld für Projekte
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.addEventListener('input', applyProjectFilters);
  }
  fetchProjects();
});