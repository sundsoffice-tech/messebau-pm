// Kanban‑Ansicht für alle Aufgaben

const taskStatuses = ['ToDo', 'InBearbeitung', 'Done'];
const statusLabels = {
  'ToDo': 'Offen',
  'InBearbeitung': 'In Bearbeitung',
  'Done': 'Erledigt'
};

// Merker für alle Aufgaben und Projekte, um Filter anwenden zu können
let allTasks = [];
let projectMapGlobal = {};

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

async function fetchData() {
  try {
    const [tasksResp, projectsResp] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/projects')
    ]);
    if (!tasksResp.ok || !projectsResp.ok) throw new Error('Daten konnten nicht geladen werden');
    allTasks = await tasksResp.json();
    const projects = await projectsResp.json();
    // Erstelle ein Mapping der Projekte für schnellen Zugriff
    projectMapGlobal = {};
    projects.forEach(p => {
      projectMapGlobal[p.id] = p;
    });
    applyFilters();
  } catch (err) {
    showAlert(err.message || 'Unbekannter Fehler');
  }
}

// Filterlogik anwenden und Board neu rendern
function applyFilters() {
  const statusSel = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-task');
  let filtered = allTasks.slice();
  if (statusSel && statusSel.value !== 'all') {
    filtered = filtered.filter(t => t.status === statusSel.value);
  }
  if (searchInput && searchInput.value.trim()) {
    const term = searchInput.value.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const proj = projectMapGlobal[t.project_id];
      const titleMatch = t.title && t.title.toLowerCase().includes(term);
      const projMatch = proj && proj.name && proj.name.toLowerCase().includes(term);
      return titleMatch || projMatch;
    });
  }
  renderKanban(filtered, projectMapGlobal);
}

function renderKanban(tasks, projectMap) {
  const board = document.getElementById('kanban');
  board.innerHTML = '';
  taskStatuses.forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    const h = document.createElement('h3');
    h.textContent = statusLabels[status];
    column.appendChild(h);
    // Aufgaben nach Status filtern
    const tasksForStatus = tasks.filter(t => t.status === status);
    tasksForStatus.forEach(t => {
      const card = document.createElement('div');
      card.className = 'task-card';
      // Titel
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = t.title;
      card.appendChild(title);
      // Projektname
      const projName = document.createElement('div');
      projName.className = 'project';
      const project = projectMap[t.project_id];
      projName.textContent = project ? project.name : '';
      card.appendChild(projName);
      // Assignee
      if (t.assignee) {
        const ass = document.createElement('div');
        ass.className = 'assignee';
        ass.textContent = `Bearbeiter: ${t.assignee}`;
        card.appendChild(ass);
      }
      // Priorität
      if (t.priority) {
        const prio = document.createElement('div');
        prio.className = 'priority';
        prio.textContent = `Priorität: ${t.priority}`;
        card.appendChild(prio);
      }
      // Fälligkeitsdatum und Überfälligkeit
      if (t.dueDate) {
        const due = document.createElement('div');
        due.className = 'due';
        due.textContent = `Fällig: ${t.dueDate}`;
        // Überfällige Aufgaben hervorheben
        const today = new Date().toISOString().split('T')[0];
        if (t.status !== 'Done' && t.dueDate < today) {
          card.classList.add('overdue');
        }
        card.appendChild(due);
      }
      // Aktionsbuttons
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions';
      // Statuswechselbutton, nur wenn nicht Done
      if (t.status !== 'Done') {
        const nextStatus = t.status === 'ToDo' ? 'InBearbeitung' : 'Done';
        const btn = document.createElement('button');
        btn.className = 'change-status';
        btn.textContent = nextStatus === 'InBearbeitung' ? 'Starten' : 'Erledigt';
        btn.addEventListener('click', () => {
          updateTaskStatus(t.id, nextStatus);
        });
        actionsDiv.appendChild(btn);
      }
      // Löschbutton
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-task';
      delBtn.textContent = 'Löschen';
      delBtn.addEventListener('click', () => {
        if (confirm('Aufgabe wirklich löschen?')) {
          deleteTask(t.id);
        }
      });
      actionsDiv.appendChild(delBtn);
      card.appendChild(actionsDiv);
      column.appendChild(card);
    });
    board.appendChild(column);
  });
}

async function updateTaskStatus(id, newStatus) {
  try {
    const resp = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!resp.ok) throw new Error('Aufgabe konnte nicht aktualisiert werden');
    await fetchData();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Aktualisieren');
  }
}

async function deleteTask(id) {
  try {
    const resp = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!resp.ok && resp.status !== 204) throw new Error('Aufgabe konnte nicht gelöscht werden');
    await fetchData();
    showAlert('Aufgabe gelöscht', 'success');
  } catch (err) {
    showAlert(err.message || 'Fehler beim Löschen');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Lade Daten initial
  fetchData();
  // Filterevents
  const statusSel = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-task');
  if (statusSel) {
    statusSel.addEventListener('change', applyFilters);
  }
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }
});