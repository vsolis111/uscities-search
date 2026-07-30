'use strict';

const BASE_URL =
  'https://solisvr-uscities-microservices-bng7gmd3ajgefpd6.canadacentral-01.azurewebsites.net';

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const statusElement = document.getElementById('status');
const resultsSection = document.getElementById('results-section');
const resultsElement = document.getElementById('results');

let debounceTimer = null;
let activeController = null;
let latestRequestId = 0;

function sanitizeText(value) {
  return DOMPurify.sanitize(String(value ?? ''), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

function setStatus(message, type = '') {
  statusElement.textContent = message;
  statusElement.className = `status ${type}`.trim();
}

function clearResults() {
  resultsElement.replaceChildren();
  resultsSection.hidden = true;
}

function addCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = sanitizeText(value);
  row.appendChild(cell);
}

function displaySearch(data) {
  clearResults();

  if (data.length === 0) {
    setStatus('No cities found.', 'error');
    return;
  }

  data.forEach((city) => {
    const row = document.createElement('tr');

    addCell(row, city.city);
    addCell(row, `${city.state_name} (${city.state_id})`);
    addCell(row, city.county_name);
    addCell(row, city.timezone);
    addCell(row, city.zips);

    resultsElement.appendChild(row);
  });

  resultsSection.hidden = false;

  setStatus(
    `${data.length} ${data.length === 1 ? 'city' : 'cities'} found.`,
    'success'
  );
}

async function search(queryValue = searchInput.value) {
  const query = queryValue.trim();

  if (!query) {
    latestRequestId += 1;

    if (activeController) {
      activeController.abort();
    }

    clearResults();
    setStatus('Enter a ZIP code or city name.', 'error');
    return;
  }

  const requestId = ++latestRequestId;

  if (activeController) {
    activeController.abort();
  }

  activeController = new AbortController();

  setStatus(`Searching for “${query}”…`, 'loading');

  try {
    const response = await fetch(
      `${BASE_URL}/uscities-search/${encodeURIComponent(query)}`,
      {
        method: 'GET',
        signal: activeController.signal,
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Malformed response');
    }

    if (requestId !== latestRequestId) {
      return;
    }

    displaySearch(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      return;
    }

    if (requestId !== latestRequestId) {
      return;
    }

    clearResults();
    console.error('Search error:', error);
    setStatus('Error: could not load results.', 'error');
  } finally {
    if (requestId === latestRequestId) {
      activeController = null;
    }
  }
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  search();
});

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);

  const query = searchInput.value.trim();

  latestRequestId += 1;

  if (activeController) {
    activeController.abort();
  }

  if (query.length < 2) {
    clearResults();

    if (query.length === 0) {
      setStatus('Enter a ZIP code or city name to begin.');
    } else {
      setStatus('Type at least two characters for instant results.');
    }

    return;
  }

  debounceTimer = setTimeout(() => {
    search(query);
  }, 300);
});