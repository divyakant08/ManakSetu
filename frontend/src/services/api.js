import axios from 'axios';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
).replace(/\/$/, '');

export const getDocumentViewUrl = (filename, page) => {
  const encoded = encodeURIComponent(filename);
  const url = `${API_BASE_URL}/documents/${encoded}/view`;
  return page ? `${url}#page=${page}` : url;
};

const REQUEST_TIMEOUT_MS = 180000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

const timeoutError = (message = 'Request timed out after 180 seconds.') => {
  const err = new Error(message);
  err.code = 'TIMEOUT';
  return err;
};

async function parseErrorPayload(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    const detail = payload?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || JSON.stringify(item)).join('; ');
    }
    return detail || payload.message || text || response.statusText;
  } catch {
    return text || response.statusText;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw timeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function applySseEvent(raw, state, { onMeta, onDelta } = {}) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const jsonText = line.slice(5).trim();
    if (!jsonText) continue;
    const event = JSON.parse(jsonText);
    if (event.type === 'meta') {
      Object.assign(state.meta, event);
      onMeta?.(event);
    } else if (event.type === 'delta') {
      state.assembled += event.text || '';
      onDelta?.(state.assembled, event.text || '');
    } else if (event.type === 'done') {
      state.assembled = event.response || state.assembled;
      state.done = { ...state.meta, ...event, response: state.assembled };
    } else if (event.type === 'error') {
      throw new Error(event.detail || 'Stream failed.');
    }
  }
}

async function consumeSse(response, handlers = {}) {
  if (!response.body) {
    throw new Error('Streaming is not supported in this browser.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const state = { assembled: '', meta: {}, done: null };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      applySseEvent(part, state, handlers);
    }
  }
  if (buffer.trim()) {
    applySseEvent(buffer, state, handlers);
  }
  if (state.done) return state.done;
  if (state.assembled) {
    return { ...state.meta, response: state.assembled };
  }
  throw new Error('The AI stream ended without a response.');
}

function shouldFallback(err) {
  const message = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  return err?.code === 'TIMEOUT' || /timeout|network|failed to fetch|stream/.test(message);
}

export const uploadFiles = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const { data } = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const getDocuments = async () => {
  const { data } = await api.get('/documents');
  return data;
};

export const deleteDocument = async (filename) => {
  const { data } = await api.delete(`/documents/${encodeURIComponent(filename)}`);
  return data;
};

export const searchQuery = async (query, language, handlers = {}) => {
  const run = async (stream) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({ query, language, stream }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorPayload(response));
    }
    const contentType = response.headers.get('content-type') || '';
    if (stream && contentType.includes('text/event-stream')) {
      return consumeSse(response, handlers);
    }
    return response.json();
  };

  try {
    return await run(true);
  } catch (err) {
    if (shouldFallback(err)) return run(false);
    throw err;
  }
};

export const searchPreloadQuery = async (
  query,
  language = 'English',
  selectedDocuments = ['ALL'],
  voiceMode = false,
  handlers = {}
) => {
  const payload = {
    query,
    language,
    selected_documents: selectedDocuments,
    voice_mode: voiceMode,
  };
  const run = async (stream) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/search/preloaded`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify({ ...payload, stream }),
    });
    if (!response.ok) {
      throw new Error(await parseErrorPayload(response));
    }
    const contentType = response.headers.get('content-type') || '';
    if (stream && contentType.includes('text/event-stream')) {
      return consumeSse(response, handlers);
    }
    return response.json();
  };

  try {
    return await run(true);
  } catch (err) {
    if (shouldFallback(err)) return run(false);
    throw err;
  }
};

export const searchCustomQuery = async (file, query, language = 'English', handlers = {}) => {
  const run = async (stream) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('query', query);
    formData.append('language', language);
    formData.append('stream', stream ? 'true' : 'false');
    const response = await fetchWithTimeout(`${API_BASE_URL}/search/custom`, {
      method: 'POST',
      headers: { Accept: stream ? 'text/event-stream' : 'application/json' },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await parseErrorPayload(response));
    }
    const contentType = response.headers.get('content-type') || '';
    if (stream && contentType.includes('text/event-stream')) {
      return consumeSse(response, handlers);
    }
    return response.json();
  };

  try {
    return await run(true);
  } catch (err) {
    if (shouldFallback(err)) return run(false);
    throw err;
  }
};

export const runGapAnalysis = async (specs, standardHint = null, language = 'English') => {
  const { data } = await api.post('/gap-analysis', {
    specs,
    standard_hint: standardHint,
    language,
  });
  return data;
};

export const getSummary = async (language = 'English', selectedDocuments = ['ALL']) => {
  const { data } = await api.post('/summary', {
    language,
    selected_documents: selectedDocuments,
  });
  return data;
};

export const getPenalties = async (language = 'English', selectedDocuments = ['ALL']) => {
  const { data } = await api.post('/penalties', {
    language,
    selected_documents: selectedDocuments,
  });
  return data;
};

export const verifyCML = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  const { data } = await api.post('/cml-verify', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const verifyCMLEnhanced = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);
  const { data } = await api.post('/cml/verify-enhanced', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const getCMLRegistry = async () => {
  const { data } = await api.get('/cml/registry');
  return data;
};

export const getAnalyticsMetrics = async () => {
  const { data } = await api.get('/analytics/metrics');
  return data;
};

export const exportAuditPdf = async (title, content, doc_names = []) => {
  const response = await api.post(
    '/export/pdf',
    { title, content, doc_names },
    { responseType: 'blob' }
  );
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'BIS_Compliance_Report.pdf');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const exportAuditExcel = async (title, content, doc_names = []) => {
  const response = await api.post(
    '/export/excel',
    { title, content, doc_names },
    { responseType: 'blob' }
  );
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (title || 'Compliance_Report').replace(/\s+/g, '_');
  link.setAttribute('download', `BIS_Compliance_Audit_${safeTitle}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;
