import axios from 'axios';
import type { RenderedNote } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface NotePayload {
  id: string;
  keys: string[]; 
  duration: string;
  isRest: boolean;
}

export const fetchNotes = async (): Promise<RenderedNote[]> => {
  try {
    const response = await apiClient.get<RenderedNote[]>('/notes');
    return response.data;
  } catch (error) {
    console.error('API Error fetching notes:', error);
    return []; 
  }
};

export const fetchPDFExport = async (): Promise<Blob> => {
  const response = await apiClient.get('/export', { 
    responseType: 'blob', 
  });
  return response.data;
};

export const saveNote = async (noteData: NotePayload) => {
  const response = await apiClient.post('/notes', noteData);
  return response.data;
};

export const clearAllNotes = async () => {
  const response = await apiClient.delete('/notes');
  return response.data;
};