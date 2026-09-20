import axios from 'axios';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
).replace(/\/$/, '');

export const getDocumentViewUrl = (filename, page) => {
  const encoded = encodeURIComponent(filename);
  const url = `${API_BASE_URL}/documents/${encoded}/view`;
  return page ? `${url}#page=${page}` : url;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

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

export const searchQuery = async (query, language) => {
  const { data } = await api.post('/search', { query, language });
  return data;
};

export const searchPreloadQuery = async (query, language = 'English', selectedDocuments = ['ALL'], voiceMode = false) => {
  const { data } = await api.post('/search/preloaded', {
    query,
    language,
    selected_documents: selectedDocuments,
    voice_mode: voiceMode,
  });
  return data;
};

export const searchCustomQuery = async (file, query, language = 'English') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('query', query);
  formData.append('language', language);
  const { data } = await api.post('/search/custom', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
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
