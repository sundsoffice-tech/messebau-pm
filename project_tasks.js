// Projekt‑Aufgabenansicht

const taskStatusesProj = ['ToDo', 'InBearbeitung', 'Done'];
const statusLabelsProj = {
  'ToDo': 'Offen',
  'InBearbeitung': 'In Bearbeitung',
  'Done': 'Erledigt'
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

let currentProjectId = null;
let currentProjectName = '';
// Aktuelle zu bearbeitende Aufgabe (ID) – null wenn es sich um eine neue Aufgabe handelt
let editTaskId = null;

async function init() {
  // Hole Projekt‑ID aus URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    showAlert('Keine Projekt‑ID übergeben');
    return;
  }
  currentProjectId = id;
  await fetchProject(id);
  await fetchTasks();
  // Formular submit
  const form = document.getElementById('task-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (editTaskId) {
      updateTask();
    } else {
      addTask();
    }
  });
}

async function fetchProject(id) {
  try {
    const resp = await fetch(`/api/projects/${id}`);
    if (!resp.ok) throw new Error('Projekt nicht gefunden');
    const project = await resp.json();
    currentProjectName = project.name;
    const titleEl = document.getElementById('project-title');
    if (titleEl) titleEl.textContent = `Aufgaben für Projekt: ${project.name}`;
  } catch (err) {
    showAlert(err.message || 'Fehler beim Laden des Projekts');
  }
}

async function fetchTasks() {
  try {
    const resp = await fetch(`/api/projects/${currentProjectId}/tasks`);
    if (!resp.ok) throw new Error('Aufgaben konnten nicht geladen werden');
    const tasks = await resp.json();
    renderBoard(tasks);
  } catch (err) {
    showAlert(err.message || 'Fehler beim Laden der Aufgaben');
  }
}

function renderBoard(tasks) {
  const board = document.getElementById('kanban');
  board.innerHTML = '';
  taskStatusesProj.forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    const h = document.createElement('h3');
    h.textContent = statusLabelsProj[status];
    column.appendChild(h);
    const tasksForStatus = tasks.filter(t => t.status === status);
    tasksForStatus.forEach(t => {
      const card = document.createElement('div');
      card.className = 'task-card';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = t.title;
      card.appendChild(title);
      if (t.description) {
        const desc = document.createElement('div');
        desc.className = 'project';
        desc.textContent = t.description;
        card.appendChild(desc);
      }
      // Bearbeiter
      if (t.assignee) {
        const ass = document.createElement('div');
        ass.className = 'assignee';
        ass.textContent = `Bearbeiter: ${t.assignee}`;
        card.appendChild(ass);
      }
      // Priorität
      if (t.priority) {
        const pr = document.createElement('div');
        pr.className = 'priority';
        pr.textContent = `Priorität: ${t.priority}`;
        card.appendChild(pr);
      }
      if (t.dueDate) {
        const due = document.createElement('div');
        due.className = 'due';
        due.textContent = `Fällig: ${t.dueDate}`;
        // Überfällige Aufgaben markieren
        const today = new Date().toISOString().split('T')[0];
        if (t.status !== 'Done' && t.dueDate < today) {
          card.classList.add('overdue');
        }
        card.appendChild(due);
      }
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'actions';
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
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-task';
      delBtn.textContent = 'Löschen';
      delBtn.addEventListener('click', () => {
        if (confirm('Aufgabe wirklich löschen?')) {
          deleteTask(t.id);
        }
      });
      actionsDiv.appendChild(delBtn);

      // Bearbeiten Button
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-task';
      editBtn.textContent = 'Bearbeiten';
      editBtn.addEventListener('click', () => {
        startEditTask(t);
      });
      actionsDiv.appendChild(editBtn);
      card.appendChild(actionsDiv);
      column.appendChild(card);
    });
    board.appendChild(column);
  });
}

async function addTask() {
  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const due = document.getElementById('task-due').value;
  const assignee = document.getElementById('task-assignee').value.trim();
  const priority = document.getElementById('task-priority').value;
  if (!title) {
    showAlert('Bitte einen Titel angeben');
    return;
  }
  const data = {
    title: title,
    description: desc || null,
    status: 'ToDo',
    dueDate: due || null,
    assignee: assignee || null,
    priority: priority || null
  };
  try {
    const resp = await fetch(`/api/projects/${currentProjectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Aufgabe konnte nicht angelegt werden');
    document.getElementById('task-form').reset();
    showAlert('Aufgabe gespeichert', 'success');
    await fetchTasks();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Speichern');
  }
}

// Aufgabe aktualisieren
async function updateTask() {
  const title = document.getElementById('task-title').value.trim();
  const desc = document.getElementById('task-desc').value.trim();
  const due = document.getElementById('task-due').value;
  const assignee = document.getElementById('task-assignee').value.trim();
  const priority = document.getElementById('task-priority').value;
  if (!title) {
    showAlert('Bitte einen Titel angeben');
    return;
  }
  const data = {
    title: title,
    description: desc || null,
    dueDate: due || null,
    assignee: assignee || null,
    priority: priority || null
  };
  try {
    const resp = await fetch(`/api/tasks/${editTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('Aufgabe konnte nicht aktualisiert werden');
    showAlert('Aufgabe aktualisiert', 'success');
    editTaskId = null;
    // Schaltflächen zurücksetzen
    document.querySelector('#task-form button[type="submit"]').textContent = 'Aufgabe speichern';
    document.getElementById('task-form').reset();
    await fetchTasks();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Aktualisieren');
  }
}

// Bearbeiten einer Aufgabe vorbereiten
function startEditTask(task) {
  editTaskId = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-desc').value = task.description || '';
  document.getElementById('task-due').value = task.dueDate || '';
  document.getElementById('task-assignee').value = task.assignee || '';
  document.getElementById('task-priority').value = task.priority || 'Mittel';
  const submitBtn = document.querySelector('#task-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Aktualisieren';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function updateTaskStatus(id, newStatus) {
  try {
    const resp = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!resp.ok) throw new Error('Aufgabe konnte nicht aktualisiert werden');
    await fetchTasks();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Aktualisieren');
  }
}

async function deleteTask(id) {
  try {
    const resp = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!resp.ok && resp.status !== 204) throw new Error('Aufgabe konnte nicht gelöscht werden');
    showAlert('Aufgabe gelöscht', 'success');
    await fetchTasks();
  } catch (err) {
    showAlert(err.message || 'Fehler beim Löschen');
  }
}

document.addEventListener('DOMContentLoaded', init);