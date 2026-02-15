// src/api/api.ts
import axios from 'axios';
import type { RenderedNote, SessionPayload } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- INTERCEPTOR ---
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- TYPES ---
export interface User {
  user_id: string;
  email: string;
  name?: string;
  subscription_tier: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

// --- AUTH MANAGER ---
class AuthManager {
  private token: string | null = null;
  private user: User | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.token = localStorage.getItem('auth-token');
    const userJson = localStorage.getItem('user');
    if (userJson) {
      this.user = JSON.parse(userJson);
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  setAuth(data: AuthResponse) {
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem('auth-token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth-token');
    localStorage.removeItem('user');
  }
}

export const authManager = new AuthManager();

// --- API FUNCTIONS ---

export const login = async (credentials: LoginCredentials) => {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  authManager.setAuth(response.data);
  return response.data;
};

export const register = async (data: RegisterData) => {
  const response = await apiClient.post('/auth/register', data);
  return response.data;
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    authManager.clearAuth();
  }
};

export const listSessions = async () => {
  const response = await apiClient.get('/sessions');
  return response.data;
};

export const saveSession = async (sessionData: SessionPayload) => {
  const response = await apiClient.post('/sessions', sessionData);
  return response.data;
};

// --- FETCH NOTES (UPDATED) ---
export const fetchNotes = async (): Promise<RenderedNote[]> => {
  try {
    const response = await apiClient.get<RenderedNote[]>('/notes');
    return response.data;
  } catch (error) {
    console.error("Error fetching notes:", error);
    return [];
  }
};

export const fetchPDFExport = async (): Promise<Blob> => {
    const response = await apiClient.get('/export', { responseType: 'blob' });
    return response.data;
};

export const clearAllNotes = async () => {
    // Optional
};