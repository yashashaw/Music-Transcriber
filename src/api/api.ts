// api.ts
import axios from 'axios';
import type { RenderedNote, SessionPayload } from '../types';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- INTERCEPTOR FOR TOKEN ---
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- TYPES ---\
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
  email: string; // Changed from username to email to match backend expectations
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

// --- API CALLS ---

export const login = async (credentials: LoginCredentials) => {
  // Matches @app.post("/api/auth/login")
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  authManager.setAuth(response.data);
  return response.data;
};

export const register = async (data: RegisterData) => {
  // Matches @app.post("/api/auth/register")
  const response = await apiClient.post('/auth/register', data);
  return response.data;
};

export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    authManager.clearAuth();
    // Force reload/redirect could happen here or in UI
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

export const fetchPDFExport = async (): Promise<Blob> => {
    // Assuming backend endpoint is /export or similar
    const response = await apiClient.get('/export', { responseType: 'blob' });
    return response.data;
};

export const fetchNotes = async (): Promise<RenderedNote[]> => {
    // This might just be loading a specific session in the new architecture
    return []; 
};

export const clearAllNotes = async () => {
    // No-op if purely local state until save
};