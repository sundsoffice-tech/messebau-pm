// Skript zum Anlegen eines neuen Projekts inkl. Kundenanlage

const nextStepMappingCreate = {
  'Anfrage': 'Angebot erstellen'
};

let allCustomers = []; // wird beim Laden aus /api/customers gefüllt

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

// -----------------------------
// Kunden laden & Dropdown füllen
// -----------------------------
async function fetchCustomersForForm() {
  try {
    const resp = await fetch('/api/customers');
    if (!resp.ok) throw new Error('Kunden konnten nicht geladen werden');
    const customers = await resp.json();
    allCustomers = customers;
    populateCustomerSelect(customers);
  } catch (err) {
    showAlert(err.message || 'Fehler beim Laden der Kunden');
  }
}

function populateCustomerSelect(customers) {
  const select = document.getElementById('customer-select');
  if (!select) return;

  // Basisoptionen stehen schon im HTML, wir ergänzen nur die Kunden
  // Erste Option: value="" – Kunde auswählen
  // Zweite Option: value="new" – Neuer Kunde …
  // Danach: bestehende Kunden
  // Erst alles außer "" und "new" löschen:
  const keepValues = new Set(['', 'new']);
  const toRemove = [];
  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    if (!keepValues.has(opt.value)) {
      toRemove.push(opt);
    }
  }
  toRemove.forEach(opt => opt.remove());

  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = String(c.id);
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

// -----------------------------
// Kunde erstellen
// -----------------------------
async function createCustomerIfNeeded(selectedValue) {
  // Wenn bestehender Kunde gewählt (id), nichts anlegen -> nur zurückgeben
  if (selectedValue && selectedValue !== 'new') {
    const id = parseInt(selectedValue, 10);
    const existing = allCustomers.find(c => c.id === id);
    if (!existing) {
      throw new Error('Ausgewählter Kunde existiert nicht mehr');
    }
    return { customer_id: existing.id, customer_name: existing.name };
  }

  // Neuer Kunde -> Felder prüfen
  const nameNew = document.getElementById('customer-name-new').value.trim();
  const contact = document.getElementById('customer-contact').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const designNote = document.getElementById('customer-design-note').value.trim();

  if (!nameNew) {
    throw new Error('Bitte einen Kundennamen/Firma angeben oder einen bestehenden Kunden auswählen.');
  }

  const payload = {
    name: nameNew,
    contact_person: contact || null,
    email: email || null,
    phone: phone || null,
    address: address || null,
    design_note: designNote || null
  };

  const resp = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    throw new Error('Kunde konnte nicht gespeichert werden');
  }
  const created = await resp.json();
  // internen Kunden-Cache aktualisieren
  allCustomers.push(created);
  return { customer_id: created.id, customer_name: created.name };
}

// -----------------------------
// Projekt erstellen
// -----------------------------
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

// -----------------------------
// Formularverhalten
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('project-form');
  const customerSelect = document.getElementById('customer-select');
  const newCustomerFields = document.getElementById('new-customer-fields');

  // Felder für neuen Kunden initial verstecken
  if (newCustomerFields) {
    newCustomerFields.style.display = 'none';
  }

  // Kunden aus Backend laden
  fetchCustomersForForm();

  // Umschalten zwischen bestehendem Kunde / Neuer Kunde
  if (customerSelect) {
    customerSelect.addEventListener('change', () => {
      if (customerSelect.value === 'new') {
        if (newCustomerFields) newCustomerFields.style.display = 'grid';
      } else {
        if (newCustomerFields) newCustomerFields.style.display = 'none';
      }
    });
  }

  // Formular submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('projName').value.trim();
    const fair = document.getElementById('fair').value.trim();
    const sizeValue = document.getElementById('size').value;
    const size = sizeValue ? Number(sizeValue) : null;
    const date = document.getElementById('date').value;
    const priority = document.getElementById('priority').value;

    if (!name) {
      showAlert('Bitte einen Projektnamen angeben');
      return;
    }

    // Kundenlogik: vorhandener Kunde oder neuer Kunde
    const selectedCustomerValue = customerSelect ? customerSelect.value : '';
    let customerInfo;
    try {
      customerInfo = await createCustomerIfNeeded(selectedCustomerValue);
    } catch (err) {
      showAlert(err.message || 'Fehler bei der Kundenanlage');
      return;
    }

    const status = 'Anfrage';
    const nextStep = nextStepMappingCreate[status];
    const dueDate = calculateDueDate(date);

    const project = {
      name,
      // Text-Kundenname für Anzeige
      customer: customerInfo.customer_name,
      fair,
      size,
      date,
      priority,
      status,
      nextStep,
      dueDate,
      // Verknüpfung auf Kundentabelle
      customer_id: customerInfo.customer_id
    };

    await createProject(project);
    form.reset();
    // nach Reset neuen Kundenbereich wieder verstecken
    if (newCustomerFields) newCustomerFields.style.display = 'none';
    if (customerSelect) customerSelect.value = '';
  });
});
