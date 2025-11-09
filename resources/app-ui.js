const roleProfiles = {
  admin: {
    role: 'admin',
    label: 'Administrator',
    canManageData: true,
  },
  user: {
    role: 'user',
    label: 'Field User',
    canManageData: false,
  },
};

const STATUS_TYPES = {
  NEED_HELP: 'need_help',
  NEED_MEDICAL: 'need_medical',
  NEED_EVACUATION: 'need_evacuation',
  SAFE: 'safe',
};

const STATUS_LABELS = {
  [STATUS_TYPES.NEED_HELP]: 'Need Help',
  [STATUS_TYPES.NEED_MEDICAL]: 'Need Medical Attention',
  [STATUS_TYPES.NEED_EVACUATION]: 'Need Evacuation',
  [STATUS_TYPES.SAFE]: 'Safe',
};

const STATUS_STYLES = {
  [STATUS_TYPES.NEED_HELP]: { fill: 'rgba(239,68,68,0.9)', stroke: '#7f1d1d', symbol: '!' },
  [STATUS_TYPES.NEED_MEDICAL]: { fill: 'rgba(14,165,233,0.9)', stroke: '#0c4a6e', symbol: '+' },
  [STATUS_TYPES.NEED_EVACUATION]: { fill: 'rgba(249,115,22,0.9)', stroke: '#9a3412', symbol: '↗' },
  [STATUS_TYPES.SAFE]: { fill: 'rgba(34,197,94,0.9)', stroke: '#166534', symbol: '✓' },
};

const ORS_CONFIG = window.PROJECT_UWAN_ORS || {};
const ORS_API_KEY = ORS_CONFIG.apiKey || '';
const ORS_PROFILE = ORS_CONFIG.profile || 'driving-car';
const ORS_ENDPOINT = ORS_CONFIG.endpoint || 'https://api.openrouteservice.org/v2/directions';
const RESPONDER_CONFIG = ORS_CONFIG.responder || {};
const USE_RESPONDER_GEOLOCATION = RESPONDER_CONFIG.useGeolocation !== false;
const RESPONDER_FIXED_LOCATION = RESPONDER_CONFIG.location || null;

const storageKeyForRole = (role) => `project-uwan-settings-${role}`;
const storageKeyIncidents = 'project-uwan-incidents';
const MAX_INCIDENTS_STORED = 500;

function defaultSettings() {
  return {
    baseLayerTitle: null,
    hoverPopups: false,
    highlight: false,
    legend: true,
  };
}

function loadIncidentsFromStorage() {
  try {
    const raw = localStorage.getItem(storageKeyIncidents);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((record) => record && record.id && record.timestamp)
      .map((record) => {
        const lat = Number(record?.location?.lat);
        const lng = Number(record?.location?.lng);
        const accuracy = Number(record?.location?.accuracy);
        return {
          ...record,
          households: record.households
            ? Number(record.households) || null
            : null,
          location:
            Number.isFinite(lat) && Number.isFinite(lng)
              ? {
                  lat,
                  lng,
                  accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
                }
              : null,
        };
      });
  } catch (error) {
    console.warn('Unable to load incident reports', error);
    return [];
  }
}

function escapeHtml(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(isoString) {
  if (!isoString) {
    return '—';
  }
  try {
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return isoString;
  }
}

function formatIncidentLocationText(incident) {
  if (!incident.location) {
    return 'No location captured';
  }
  const lat = Number(incident.location.lat);
  const lng = Number(incident.location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'No location captured';
  }
  const accuracy = Number(incident.location.accuracy);
  const accuracyText = Number.isFinite(accuracy)
    ? ` ±${Math.round(accuracy)} m`
    : '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracyText}`;
}

const state = {
  role: null,
  canManageData: false,
  settings: defaultSettings(),
  incidents: loadIncidentsFromStorage(),
  currentLocation: null,
  activeStatusType: null,
};

const elements = {
  appShell: document.getElementById('app-shell'),
  roleLabel: document.getElementById('current-role'),
  settingsToggle: document.getElementById('settings-toggle'),
  statusToggle: document.getElementById('status-toggle'),
  statusPanel: document.getElementById('status-panel'),
  statusClose: document.getElementById('status-close'),
  statusOptionButtons: Array.from(
    document.querySelectorAll('[data-status-option]')
  ),
  statusForm: document.getElementById('status-form'),
  statusTypeInput: document.getElementById('status-type'),
  statusName: document.getElementById('status-name'),
  statusHouseholds: document.getElementById('status-households'),
  statusAddress: document.getElementById('status-address'),
  statusNotes: document.getElementById('status-notes'),
  statusSubmit: document.getElementById('status-submit'),
  statusFeedback: document.getElementById('status-feedback'),
  statusLocation: document.getElementById('status-location'),
  statusChoiceHint: document.querySelector('.status-choice-hint'),
  settingsPanel: document.getElementById('settings-panel'),
  dataPanel: document.getElementById('data-panel'),
  baseLayerSelect: document.getElementById('base-layer-select'),
  hoverToggle: document.getElementById('hover-popups-toggle'),
  highlightToggle: document.getElementById('highlight-toggle'),
  legendToggle: document.getElementById('legend-toggle'),
  incidentList: document.getElementById('incident-list'),
  navigationInstruction: document.getElementById('navigation-instruction'),
};

let mapRef = null;
let olRef = null;
let incidentSource = null;
let incidentLayer = null;
const incidentStyleCache = {};
let activeRouteLayer = null;
const routeCache = new Map();
let activeRouteMarkerLayer = null;
let activeRouteAnimationId = null;
let navigationInstructionTimeout = null;

function sanitizeTitle(rawTitle) {
  if (!rawTitle) {
    return { name: 'Untitled layer', meta: '' };
  }
  const parts = rawTitle.split('<br');
  const name = parts[0].replace(/<[^>]+>/g, ' ').trim() || 'Layer';
  const meta = parts
    .slice(1)
    .map((part) => part.replace(/<[^>]+>/g, ' ').trim())
    .join(' • ');
  return { name, meta };
}

function setBaseLayerVisibility(baseLayers, selectedTitle) {
  if (!Array.isArray(baseLayers)) return;
  let activeLayerTitle = selectedTitle;
  baseLayers.forEach((layer, index) => {
    const title = layer.get('title') || `Base ${index + 1}`;
    const isActive = title === selectedTitle;
    layer.setVisible(isActive);
    if (isActive) {
      activeLayerTitle = title;
    }
  });
  state.settings.baseLayerTitle = activeLayerTitle;
}

function applyHoverSetting(enabled) {
  window.doHover = Boolean(enabled);
  if (!enabled) {
    const popup = document.getElementById('popup');
    if (popup) {
      popup.style.display = 'none';
    }
  }
}

function applyHighlightSetting(enabled) {
  window.doHighlight = Boolean(enabled);
  if (!enabled && window.featureOverlay && window.featureOverlay.getSource) {
    window.featureOverlay.getSource().clear();
  }
}

function applyLegendSetting(show) {
  const targets = document.querySelectorAll(
    '.layer-switcher, #legend, .legend, .ol-layerswitcher'
  );
  targets.forEach((element) => {
    if (element) {
      element.style.display = show ? '' : 'none';
    }
  });
}

function saveSettings() {
  if (!state.role) return;
  try {
    localStorage.setItem(
      storageKeyForRole(state.role),
      JSON.stringify(state.settings)
    );
  } catch (error) {
    console.warn('Unable to persist settings', error);
  }
}

function loadSettings(role) {
  try {
    const stored = localStorage.getItem(storageKeyForRole(role));
    if (stored) {
      const parsed = JSON.parse(stored);
      state.settings = {
        ...state.settings,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('Unable to load stored settings', error);
  }
}

function closePanels(exceptPanel) {
  [elements.settingsPanel, elements.dataPanel].forEach((panel) => {
    if (!panel) return;
    if (panel !== exceptPanel) {
      panel.classList.remove('is-open');
    }
  });
}

function togglePanel(panel) {
  if (!panel) return;
  if (panel.classList.contains('is-open')) {
    panel.classList.remove('is-open');
  } else {
    closePanels(panel);
    panel.classList.add('is-open');
  }
}

function buildBaseLayerSelect(baseLayers) {
  if (!elements.baseLayerSelect) return;
  elements.baseLayerSelect.innerHTML = '';
  baseLayers.forEach((layer, index) => {
    const option = document.createElement('option');
    const title = layer.get('title') || `Base ${index + 1}`;
    option.value = title;
    option.textContent = title;
    elements.baseLayerSelect.appendChild(option);
  });
  const activeTitle =
    state.settings.baseLayerTitle ||
    (baseLayers.find((layer) => layer.getVisible())?.get('title') ||
      baseLayers[0]?.get('title'));
  if (activeTitle) {
    elements.baseLayerSelect.value = activeTitle;
    setBaseLayerVisibility(baseLayers, activeTitle);
  }
}

function saveIncidentsToStorage() {
  try {
    localStorage.setItem(storageKeyIncidents, JSON.stringify(state.incidents));
  } catch (error) {
    console.warn('Unable to store incident reports', error);
  }
}

function ensureIncidentLayer() {
  if (!mapRef || !olRef) return;
  if (!incidentSource) {
    incidentSource = new olRef.source.Vector();
  }
  if (!incidentLayer) {
    incidentLayer = new olRef.layer.Vector({
      source: incidentSource,
      style: (feature) => getIncidentStyle(feature.get('status')),
    });
    incidentLayer.set('displayInLayerSwitcher', false);
    incidentLayer.setZIndex(999);
    mapRef.addLayer(incidentLayer);
  }
}

function getIncidentStyle(status) {
  if (!olRef) return null;
  if (incidentStyleCache[status]) {
    return incidentStyleCache[status];
  }
  const palette = STATUS_STYLES[status] || STATUS_STYLES[STATUS_TYPES.NEED_HELP];
  const style = new olRef.style.Style({
    image: new olRef.style.Circle({
      radius: 11,
      fill: new olRef.style.Fill({ color: palette.fill }),
      stroke: new olRef.style.Stroke({ color: palette.stroke, width: 2 }),
    }),
    text: new olRef.style.Text({
      text: palette.symbol,
      fill: new olRef.style.Fill({ color: '#ffffff' }),
      font: 'bold 12px "Segoe UI", Arial, sans-serif',
      offsetY: 1,
    }),
  });
  incidentStyleCache[status] = style;
  return style;
}

function syncIncidentLayer() {
  if (!mapRef || !olRef) return;
  ensureIncidentLayer();
  if (!incidentSource) return;
  incidentSource.clear();
  if (!Array.isArray(state.incidents)) return;
  const projection = mapRef.getView().getProjection();
  const features = state.incidents
    .filter(
      (incident) =>
        incident.location &&
        Number.isFinite(Number(incident.location.lat)) &&
        Number.isFinite(Number(incident.location.lng))
    )
    .map((incident) => {
      const coords = olRef.proj.fromLonLat(
        [Number(incident.location.lng), Number(incident.location.lat)],
        projection
      );
      const feature = new olRef.Feature({
        geometry: new olRef.geom.Point(coords),
        incidentId: incident.id,
        status: incident.status,
      });
      feature.setStyle(getIncidentStyle(incident.status));
      return feature;
    });
  incidentSource.addFeatures(features);
}

function renderIncidentList() {
  if (!elements.incidentList) return;
  if (!state.canManageData) {
    elements.incidentList.innerHTML = '';
    return;
  }
  const container = elements.incidentList;
  container.innerHTML = '';
  if (!state.incidents.length) {
    const empty = document.createElement('p');
    empty.className = 'app-incident-empty';
    empty.textContent = 'No reports submitted yet.';
    container.appendChild(empty);
    return;
  }

  state.incidents.forEach((incident) => {
    const card = document.createElement('article');
    card.className = 'app-incident-card';
    card.setAttribute('role', 'listitem');

    const header = document.createElement('header');
    const nameNode = document.createElement('div');
    nameNode.className = 'app-layer-name';
    nameNode.textContent = incident.name || 'Unnamed reporter';

    const statusBadge = document.createElement('span');
    statusBadge.className = 'app-incident-status';
    const badgeClass = (() => {
      switch (incident.status) {
        case STATUS_TYPES.NEED_MEDICAL:
          return 'incident-status-medical';
        case STATUS_TYPES.NEED_EVACUATION:
          return 'incident-status-evac';
        case STATUS_TYPES.SAFE:
          return 'incident-status-safe';
        default:
          return 'incident-status-help';
      }
    })();
    statusBadge.classList.add(badgeClass);
    statusBadge.textContent =
      STATUS_LABELS[incident.status] || incident.status;

    header.appendChild(nameNode);
    header.appendChild(statusBadge);

    const meta = document.createElement('div');
    meta.className = 'app-incident-meta';
    meta.textContent = formatTimestamp(incident.timestamp);

    const addressMeta = document.createElement('div');
    addressMeta.className = 'app-incident-meta';
    addressMeta.textContent = `Notes: ${
      incident.address || 'No location notes provided'
    }`;

    const locationMeta = document.createElement('div');
    locationMeta.className = 'app-incident-meta';
    locationMeta.textContent = `Location: ${formatIncidentLocationText(
      incident
    )}`;

    const notesMeta =
      incident.notes && incident.notes.trim()
        ? (() => {
            const notes = document.createElement('div');
            notes.className = 'app-incident-meta';
            notes.textContent = `Notes: ${incident.notes.trim()}`;
            return notes;
          })()
        : null;

    const actions = document.createElement('div');
    actions.className = 'app-incident-actions';
    const locateButton = document.createElement('button');
    locateButton.type = 'button';
    locateButton.className = 'app-button app-button-primary';
    if (!incident.location) {
      locateButton.textContent = 'Location unavailable';
      locateButton.disabled = true;
    } else {
      locateButton.textContent = 'Locate on map';
      locateButton.addEventListener('click', () => {
        showRouteToIncident(incident);
      });
    }
    const driveButton = document.createElement('button');
    driveButton.type = 'button';
    driveButton.className = 'app-button';
    if (!incident.location) {
      driveButton.textContent = 'Drive to location';
      driveButton.disabled = true;
    } else {
      driveButton.textContent = 'Drive to location';
      driveButton.addEventListener('click', () => {
        driveToIncident(incident);
      });
    }
    actions.appendChild(locateButton);
    actions.appendChild(driveButton);
    card.appendChild(header);
    card.appendChild(meta);
    if (incident.households) {
      const peopleMeta = document.createElement('div');
      peopleMeta.className = 'app-incident-meta';
      peopleMeta.textContent = `Households / occupants: ${incident.households}`;
      card.appendChild(peopleMeta);
    }
    card.appendChild(addressMeta);
    card.appendChild(locationMeta);
    if (notesMeta) {
      card.appendChild(notesMeta);
    }
    card.appendChild(actions);
    container.appendChild(card);
  });
}

function showIncidentPopup(incident, coordinate) {
  const popupContainer = document.getElementById('popup');
  const popupContent = document.getElementById('popup-content');
  if (!popupContainer || !popupContent || !window.overlayPopup) return;
  const statusLabel = STATUS_LABELS[incident.status] || incident.status;
  const locationText = formatIncidentLocationText(incident);
  const segments = [
    `<strong>${escapeHtml(statusLabel)}</strong>`,
    escapeHtml(incident.name || 'Unnamed reporter'),
    incident.households
      ? `<div><strong>Households / occupants:</strong> ${escapeHtml(
          incident.households
        )}</div>`
      : '',
    `<small>${escapeHtml(formatTimestamp(incident.timestamp))}</small>`,
    '<hr>',
    `<div><strong>Location notes:</strong> ${escapeHtml(
      incident.address || '—'
    )}</div>`,
    incident.notes
      ? `<div><strong>Notes:</strong> ${escapeHtml(incident.notes)}</div>`
      : '',
    `<div><strong>Location:</strong> ${escapeHtml(locationText)}</div>`,
  ].filter(Boolean);
  popupContent.innerHTML = `<div class="incident-popup">${segments.join(
    ''
  )}</div>`;
  popupContainer.style.display = 'block';
  window.overlayPopup.setPosition(coordinate);
}

function focusIncident(incident) {
  if (!mapRef || !olRef) return;
  if (!incident.location) {
    window.alert('No location captured for this report.');
    return;
  }
  const lat = Number(incident.location.lat);
  const lng = Number(incident.location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    window.alert('Stored location is invalid.');
    return;
  }
  const projection = mapRef.getView().getProjection();
  const coordinate = olRef.proj.fromLonLat([lng, lat], projection);
  const view = mapRef.getView();
  const currentZoom =
    typeof view.getZoom === 'function' ? view.getZoom() : undefined;
  const targetZoom =
    Number.isFinite(currentZoom) && currentZoom !== null
      ? Math.max(currentZoom, 16)
      : 16;
  if (typeof view.animate === 'function') {
    view.animate({ center: coordinate, zoom: targetZoom, duration: 600 });
  } else {
    view.setCenter(coordinate);
    view.setZoom(targetZoom);
  }
  showIncidentPopup(incident, coordinate);
}

function updateStatusLocation(message, variant) {
  if (!elements.statusLocation) return;
  elements.statusLocation.textContent = message;
  elements.statusLocation.classList.remove('success', 'error');
  if (variant) {
    elements.statusLocation.classList.add(variant);
  }
}

function clearStatusSelection() {
  state.activeStatusType = null;
  if (elements.statusTypeInput) {
    elements.statusTypeInput.value = '';
  }
  elements.statusOptionButtons.forEach((button) => {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
  });
  elements.statusChoiceHint?.classList.remove('app-hidden');
  updateStatusSubmitState();
}

function setStatusType(type) {
  state.activeStatusType = type;
  if (elements.statusTypeInput) {
    elements.statusTypeInput.value = type || '';
  }
  elements.statusOptionButtons.forEach((button) => {
    const buttonType = button.getAttribute('data-status-option');
    const isActive = type === buttonType;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  if (type) {
    elements.statusChoiceHint?.classList.add('app-hidden');
  } else {
    elements.statusChoiceHint?.classList.remove('app-hidden');
  }
  showStatusFeedback('');
  updateStatusSubmitState();
}

function updateStatusSubmitState() {
  if (!elements.statusSubmit || !elements.statusForm) return;
  const nameValue = elements.statusName?.value.trim();
  const householdsValue = Number(elements.statusHouseholds?.value);
  const occupantValid = Number.isFinite(householdsValue) && householdsValue > 0;
  const nameValid = Boolean(nameValue);
  const isValid = Boolean(state.activeStatusType) && nameValid && occupantValid;
  elements.statusSubmit.disabled = !isValid;
}

function requestGeolocation() {
  if (!navigator.geolocation) {
    state.currentLocation = null;
    updateStatusLocation(
      'Geolocation not supported. Describe your location in the form.',
      'error'
    );
    return;
  }
  updateStatusLocation('Detecting your location…');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      state.currentLocation = {
        lat: Number(latitude),
        lng: Number(longitude),
        accuracy: Number(accuracy),
      };
      updateStatusLocation(
        `Location captured: ${latitude.toFixed(5)}, ${longitude.toFixed(
          5
        )} (±${Math.round(accuracy)} m)`,
        'success'
      );
    },
    (error) => {
      state.currentLocation = null;
      updateStatusLocation(
        `Unable to detect location (${error.message}). Please describe your location manually.`,
        'error'
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    }
  );
}

function showStatusFeedback(message, variant) {
  if (!elements.statusFeedback) return;
  elements.statusFeedback.textContent = message;
  elements.statusFeedback.classList.remove('success', 'error');
  if (variant) {
    elements.statusFeedback.classList.add(variant);
  }
}

function openStatusPanel() {
  if (!elements.statusPanel) return;
  elements.statusPanel.classList.remove('app-hidden');
  elements.statusForm?.reset();
  state.currentLocation = null;
  clearStatusSelection();
  updateStatusLocation('Detecting your location…');
  showStatusFeedback('');
  updateStatusSubmitState();
  requestGeolocation();
  setTimeout(() => {
    elements.statusName?.focus({ preventScroll: true });
  }, 150);
}

function closeStatusPanel() {
  if (!elements.statusPanel) return;
  elements.statusPanel.classList.add('app-hidden');
  elements.statusForm?.reset();
  state.currentLocation = null;
  clearStatusSelection();
  showStatusFeedback('');
  updateStatusLocation('Detecting your location…');
}

function handleStatusSubmit(event) {
  event.preventDefault();
  if (!elements.statusForm) return;
  if (!state.activeStatusType) {
    showStatusFeedback(
      'Please choose your current status before submitting.',
      'error'
    );
    return;
  }
  if (!elements.statusForm.checkValidity()) {
    elements.statusForm.reportValidity();
    updateStatusSubmitState();
    return;
  }
  const record = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `incident-${Date.now()}`,
    status: state.activeStatusType,
    name: elements.statusName?.value.trim() || 'Unnamed reporter',
    households: Number(elements.statusHouseholds?.value) || null,
    address: elements.statusAddress?.value.trim() || '',
    notes: elements.statusNotes?.value.trim() || '',
    timestamp: new Date().toISOString(),
    location: state.currentLocation
      ? {
          lat: state.currentLocation.lat,
          lng: state.currentLocation.lng,
          accuracy: state.currentLocation.accuracy,
        }
      : null,
  };
  addIncident(record);
  showStatusFeedback('Thank you! Your status has been recorded.', 'success');
  elements.statusSubmit.disabled = true;
  setTimeout(() => {
    closeStatusPanel();
    showStatusFeedback('');
  }, 1800);
}

function notifyNewIncident(incident) {
  if (!state.canManageData) {
    return;
  }
  const statusLabel = STATUS_LABELS[incident.status] || incident.status;
  const householdsText = incident.households
    ? `Households / occupants: ${incident.households}\n`
    : '';
  const locationText = incident.location
    ? `Location: ${formatIncidentLocationText(incident)}\n`
    : '';
  const message =
    `New status report received\n` +
    `Reporter: ${incident.name || 'Unnamed reporter'}\n` +
    `Status: ${statusLabel}\n` +
    householdsText +
    locationText +
    (incident.notes ? `Notes: ${incident.notes}` : '');
  window.alert(message.trim());
}

function addIncident(record) {
  state.incidents = [record, ...state.incidents].slice(0, MAX_INCIDENTS_STORED);
  saveIncidentsToStorage();
  syncIncidentLayer();
  renderIncidentList();
  notifyNewIncident(record);
}

function applySettings(baseLayers) {
  if (baseLayers.length > 0 && elements.baseLayerSelect) {
    buildBaseLayerSelect(baseLayers);
  }

  if (elements.hoverToggle) {
    const hoverValue = Boolean(state.settings.hoverPopups);
    elements.hoverToggle.checked = hoverValue;
    applyHoverSetting(hoverValue);
  }

  if (elements.highlightToggle) {
    const highlightValue = Boolean(state.settings.highlight);
    elements.highlightToggle.checked = highlightValue;
    applyHighlightSetting(highlightValue);
  }

  if (elements.legendToggle) {
    const legendValue =
      state.settings.legend === undefined ? true : Boolean(state.settings.legend);
    elements.legendToggle.checked = legendValue;
    applyLegendSetting(legendValue);
  }

  renderIncidentList();
  syncIncidentLayer();
}

function setRoleContext(roleKey, baseLayers, groupLayer) {
  const profile = roleProfiles[roleKey] || roleProfiles.admin;
  state.role = profile.role;
  state.canManageData = profile.canManageData;
  state.settings = defaultSettings();
  if (elements.roleLabel) {
    elements.roleLabel.textContent = profile.label;
  }
  if (elements.appShell) {
    elements.appShell.classList.remove('app-hidden');
    elements.appShell.setAttribute('data-role', profile.role);
  }
  if (elements.dataPanel) {
    elements.dataPanel.classList.toggle('app-hidden', !profile.canManageData);
  }
  loadSettings(profile.role);
  applySettings(baseLayers);
}

function drawRoute(routeGeoJson) {
  if (!mapRef || !olRef) return;
  clearRouteAnimation();
  if (activeRouteLayer) {
    mapRef.removeLayer(activeRouteLayer);
    activeRouteLayer = null;
  }
  activeRouteLayer = new olRef.layer.Vector({
    source: new olRef.source.Vector({
      features: new olRef.format.GeoJSON().readFeatures(routeGeoJson, {
        featureProjection: mapRef.getView().getProjection(),
      }),
    }),
    style: new olRef.style.Style({
      stroke: new olRef.style.Stroke({ color: '#2563eb', width: 4 }),
    }),
  });
  mapRef.addLayer(activeRouteLayer);
  const routeExtent = activeRouteLayer.getSource().getExtent();
  mapRef.getView().fit(routeExtent, { padding: [80, 360, 80, 80], maxZoom: 18 });
}

async function fetchRoute(start, end) {
  if (!ORS_API_KEY) {
    throw new Error('OpenRouteService API key is not configured.');
  }
  const url = `${ORS_ENDPOINT}/${encodeURIComponent(ORS_PROFILE)}/geojson`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [start.lng, start.lat],
        [end.lng, end.lat],
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Routing request failed (${response.status})`);
  }
  return response.json();
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        reject(new Error(`Unable to retrieve your location (${err.message})`));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

async function getResponderOrigin() {
  if (USE_RESPONDER_GEOLOCATION) {
    try {
      return await getCurrentPosition();
    } catch (error) {
      if (RESPONDER_FIXED_LOCATION) {
        return RESPONDER_FIXED_LOCATION;
      }
      throw error;
    }
  }
  if (RESPONDER_FIXED_LOCATION) {
    return RESPONDER_FIXED_LOCATION;
  }
  throw new Error('Responder location is not configured.');
}

function makeIncidentCacheKey(incident) {
  if (!incident || !incident.location) {
    return null;
  }
  if (incident.id) {
    return incident.id;
  }
  return `${incident.location.lat},${incident.location.lng}`;
}

async function routeToIncident(incident) {
  const cacheKey = !USE_RESPONDER_GEOLOCATION
    ? makeIncidentCacheKey(incident)
    : null;
  if (cacheKey && routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }
  const responder = await getResponderOrigin();
  const routeGeoJson = await fetchRoute(responder, incident.location);
  const result = { responder, routeGeoJson };
  if (cacheKey) {
    routeCache.set(cacheKey, result);
  }
  return result;
}

function hideNavigationInstruction() {
  if (!elements.navigationInstruction) {
    return;
  }
  elements.navigationInstruction.classList.add('app-hidden');
  if (navigationInstructionTimeout) {
    window.clearTimeout(navigationInstructionTimeout);
    navigationInstructionTimeout = null;
  }
}

function showNavigationInstruction(message, sticky = false) {
  if (!elements.navigationInstruction) {
    return;
  }
  elements.navigationInstruction.textContent = message;
  elements.navigationInstruction.classList.remove('app-hidden');
  if (!sticky) {
    if (navigationInstructionTimeout) {
      window.clearTimeout(navigationInstructionTimeout);
    }
    navigationInstructionTimeout = window.setTimeout(() => {
      elements.navigationInstruction?.classList.add('app-hidden');
      navigationInstructionTimeout = null;
    }, 4000);
  }
}

function clearRouteAnimation(preserveInstruction = false) {
  if (activeRouteAnimationId) {
    window.clearInterval(activeRouteAnimationId);
    activeRouteAnimationId = null;
  }
  if (activeRouteMarkerLayer && mapRef) {
    mapRef.removeLayer(activeRouteMarkerLayer);
    activeRouteMarkerLayer = null;
  }
  if (!preserveInstruction) {
    hideNavigationInstruction();
  }
}

function startRouteAnimation(routeGeoJson) {
  if (!mapRef || !olRef) {
    return;
  }
  const feature = routeGeoJson?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!feature || !Array.isArray(coords) || coords.length < 2) {
    return;
  }

  clearRouteAnimation();

  const projection = mapRef.getView().getProjection();
  const projected = coords.map((coord) =>
    olRef.proj.fromLonLat(coord, projection)
  );

  const markerFeature = new olRef.Feature(
    new olRef.geom.Point(projected[0])
  );
  activeRouteMarkerLayer = new olRef.layer.Vector({
    source: new olRef.source.Vector({
      features: [markerFeature],
    }),
    style: new olRef.style.Style({
      image: new olRef.style.Circle({
        radius: 7,
        fill: new olRef.style.Fill({ color: '#ffffff' }),
        stroke: new olRef.style.Stroke({ color: '#2563eb', width: 3 }),
      }),
    }),
  });
  mapRef.addLayer(activeRouteMarkerLayer);

  const steps = feature.properties?.segments?.flatMap(
    (segment) => segment.steps || []
  ) || [];
  let stepIndex = 0;
  let nextWaypoint = steps[0]?.way_points?.[1] ?? Infinity;
  let shownInitialInstruction = false;

  const updateInstruction = (step) => {
    if (step && step.instruction) {
      showNavigationInstruction(step.instruction, true);
    }
  };

  const tickDelay = Math.max(120, Math.floor(8000 / projected.length));
  let coordIndex = 0;
  activeRouteAnimationId = window.setInterval(() => {
    coordIndex += 1;
    if (coordIndex >= projected.length) {
      clearRouteAnimation();
      showNavigationInstruction('Arrived at location.');
      return;
    }
    markerFeature.getGeometry().setCoordinates(projected[coordIndex]);

    if (!shownInitialInstruction && steps.length) {
      updateInstruction(steps[0]);
      shownInitialInstruction = true;
    }

    if (coordIndex >= nextWaypoint) {
      const currentStep = steps[stepIndex];
      if (currentStep) {
        updateInstruction(currentStep);
      }
      stepIndex += 1;
      nextWaypoint = steps[stepIndex]?.way_points?.[1] ?? Infinity;
    }
  }, tickDelay);
}

async function showRouteToIncident(incident) {
  if (!incident.location) {
    window.alert('No coordinates stored for this report.');
    return;
  }
  try {
    const { routeGeoJson } = await routeToIncident(incident);
    drawRoute(routeGeoJson);
  } catch (error) {
    console.error('Routing error:', error);
    window.alert(error.message || 'Unable to fetch route. Please try again.');
  }
}

async function driveToIncident(incident) {
  if (!incident.location) {
    window.alert('No coordinates stored for this report.');
    return;
  }
  try {
    const { routeGeoJson } = await routeToIncident(incident);
    drawRoute(routeGeoJson);
    startRouteAnimation(routeGeoJson);
  } catch (error) {
    console.error('Routing error:', error);
    window.alert(error.message || 'Unable to fetch route. Please try again.');
  }
}

window.addEventListener('load', () => {
  mapRef = window.map;
  olRef = window.ol;

  const baseLayers = Array.isArray(window.layersList)
    ? window.layersList.filter(
        (layer) => olRef && layer instanceof olRef.layer.Tile
      )
    : [];
  const floodGroup = window.group_FloodExtentinMeters;

  const initialRole =
    elements.appShell?.getAttribute('data-role') || 'admin';
  setRoleContext(initialRole, baseLayers, floodGroup);

  updateStatusSubmitState();

  elements.settingsToggle?.addEventListener('click', () => {
    togglePanel(elements.settingsPanel);
  });

  elements.statusToggle?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openStatusPanel();
  });
  elements.statusClose?.addEventListener('click', (event) => {
    event.preventDefault();
    closeStatusPanel();
  });
  elements.statusOptionButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const status = button.getAttribute('data-status-option');
      setStatusType(status);
    });
  });
  elements.statusPanel?.addEventListener('click', (event) => {
    if (event.target === elements.statusPanel) {
      closeStatusPanel();
    }
  });
  elements.statusForm?.addEventListener('submit', handleStatusSubmit);
  elements.statusForm?.addEventListener('input', updateStatusSubmitState);
  elements.settingsPanel
    ?.querySelectorAll('[data-close-panel]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        elements.settingsPanel.classList.remove('is-open');
      });
    });

  elements.dataPanel
    ?.querySelectorAll('[data-close-panel]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        elements.dataPanel.classList.remove('is-open');
      });
    });

  elements.baseLayerSelect?.addEventListener('change', (event) => {
    const selectedTitle = event.target.value;
    state.settings.baseLayerTitle = selectedTitle;
    setBaseLayerVisibility(baseLayers, selectedTitle);
    saveSettings();
  });

  elements.hoverToggle?.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    state.settings.hoverPopups = isChecked;
    applyHoverSetting(isChecked);
    saveSettings();
  });

  elements.highlightToggle?.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    state.settings.highlight = isChecked;
    applyHighlightSetting(isChecked);
    saveSettings();
  });

  elements.legendToggle?.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    state.settings.legend = isChecked;
    applyLegendSetting(isChecked);
    saveSettings();
  });

  if (mapRef) {
    mapRef.on('click', () => {
      closePanels();
    });
  }
});

window.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    elements.statusPanel &&
    !elements.statusPanel.classList.contains('app-hidden')
  ) {
    closeStatusPanel();
  }
});

