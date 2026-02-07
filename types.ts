
export interface User {
  id: string;
  name: string;
  role: 'professor' | 'admin';
}

export interface Student {
  id: string;
  name: string;
  nfcId: string;
}

export interface Session {
  id: string;
  lectureName: string;
  hall: string; // A, B, C...
  weekNumber: number; // Added week number
  targetSheetId?: string; // The ID fetched from Cell A2
  scriptUrl?: string; // Google Apps Script Web App URL for fetching data
  status: 'active' | 'closed';
  createdAt: string;
  attendedCount: number;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentName: string;
  studentId: string;
  timestamp: string;
}

export interface Subject {
  id: string;
  name: string;
  // link removed as requested
  scriptUrl?: string; // Stored script URL
}

export interface Hall {
  id: string;
  name: string;
}

export type ViewState = 'login' | 'dashboard' | 'subjects-list' | 'subject-weeks' | 'create-session' | 'session-details' | 'settings';
