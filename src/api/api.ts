import axios from 'axios';
import type { RenderedNote } from '../types';

// Centralized base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Create an axios instance (optional but good practice)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// for saveNote function
export interface NotePayload {
  id: string;
  types: string[];
  duration: string;
  isRest: boolean;
}

/**
 * GET: Fetch all notes from the database.
 * Used when the page reloads.
 */
export const fetchNotes = async (): Promise<RenderedNote[]> => {
  try {
    const response = await apiClient.get<RenderedNote[]>('/notes');
    return response.data;
  } catch (error) {
    console.error('API Error fetching notes:', error);
    return []; // Return empty array to prevent app crash
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