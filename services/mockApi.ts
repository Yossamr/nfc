

import { Session, AttendanceRecord, Student } from '../types';

const STORAGE_KEY_SESSIONS = 'nfc_app_sessions';
const STORAGE_KEY_LOGS = 'nfc_app_logs';

// Helper to load from storage or return default
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error("Failed to load from storage", e);
    return defaultValue;
  }
};

// Initial Mock Data (used only if storage is empty)
const defaultSessions: Session[] = [
  { id: '101', lectureName: 'مقدمة في علوم الحاسب', hall: 'A', weekNumber: 1, status: 'closed', createdAt: new Date(Date.now() - 86400000).toISOString(), attendedCount: 45, targetSheetId: 'mock-id-1' },
  { id: '102', lectureName: 'قواعد بيانات متقدمة', hall: 'C', weekNumber: 3, status: 'active', createdAt: new Date().toISOString(), attendedCount: 12 },
];

const defaultLogs: AttendanceRecord[] = [
  { id: '1', sessionId: '102', studentName: 'أحمد محمد', studentId: '2023001', timestamp: new Date().toISOString() },
  { id: '2', sessionId: '102', studentName: 'سارة علي', studentId: '2023005', timestamp: new Date(Date.now() - 60000).toISOString() },
];

// Load state from local storage or defaults
let sessions: Session[] = loadFromStorage(STORAGE_KEY_SESSIONS, defaultSessions);
let attendanceLogs: AttendanceRecord[] = loadFromStorage(STORAGE_KEY_LOGS, defaultLogs);

const mockStudents: Student[] = [
  { id: '2023001', name: 'أحمد محمد', nfcId: 'aabbcc' },
  { id: '2023002', name: 'خالد يوسف', nfcId: 'ddeeff' },
  { id: '2023003', name: 'مريم حسن', nfcId: '112233' },
  { id: '2023004', name: 'عمر فاروق', nfcId: '445566' },
  { id: '2023005', name: 'سارة علي', nfcId: '778899' },
];

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  // Save current memory state to localStorage
  persistData: () => {
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(attendanceLogs));
  },

  getSessions: async (): Promise<Session[]> => {
    await delay(500);
    return [...sessions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createSession: async (lectureName: string, hall: string, weekNumber: number, scriptUrl?: string): Promise<Session> => {
    await delay(500);
    const newSession: Session = {
      id: Math.floor(Math.random() * 10000).toString(),
      lectureName,
      hall,
      weekNumber,
      scriptUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
      attendedCount: 0
    };
    sessions = [newSession, ...sessions];
    // Auto-save on create
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    return newSession;
  },

  closeSession: async (id: string): Promise<void> => {
    await delay(300);
    sessions = sessions.map(s => s.id === id ? { ...s, status: 'closed' } : s);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  },

  updateSessionSheetId: async (sessionId: string, sheetId: string): Promise<void> => {
    sessions = sessions.map(s => s.id === sessionId ? { ...s, targetSheetId: sheetId } : s);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  },

  getSessionDetails: async (id: string): Promise<{ session: Session | undefined, logs: AttendanceRecord[] }> => {
    // Minimal delay for polling responsiveness
    // await delay(100); 
    const session = sessions.find(s => s.id === id);
    const logs = attendanceLogs.filter(l => l.sessionId === id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { session, logs };
  },

  // NEW: Fetch the Sheet ID from Cell A2 of the Master Sheet
  fetchLatestSheetId: async (scriptUrl: string): Promise<{success: boolean, id?: string, message?: string}> => {
      if (!scriptUrl) return { success: false, message: "رابط السكربت غير موجود" };
      
      try {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        // action=get_id tells the script to read Cell A2 from Master Sheet
        const fetchUrl = `${scriptUrl}${separator}action=get_id&t=${Date.now()}`;
        
        const response = await fetch(fetchUrl, {
            method: 'GET',
            redirect: 'follow',
            credentials: 'omit',
        });

        if (!response.ok) throw new Error("فشل الاتصال بالسكربت");
        
        const text = await response.text();
        // Check for HTML error pages
        if (text.trim().startsWith('<')) throw new Error("تأكد من نشر السكربت بصلاحية 'Anyone'");

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
             throw new Error("استجابة غير صالحة من السكربت");
        }

        if (data.error) throw new Error(data.error);
        
        if (!data.id) {
            const sheetInfo = data.sheetName ? ` (الورقة: ${data.sheetName})` : '';
            throw new Error(`الخلية A2 فارغة أو لا تحتوي على ID.${sheetInfo}`);
        }

        return { success: true, id: String(data.id).trim() };

      } catch (error: any) {
          console.error("Fetch ID Error:", error);
          return { success: false, message: error.message };
      }
  },

  // Sync Data from Google Sheet via Apps Script
  syncExternalAttendance: async (sessionId: string, scriptUrl: string, targetSheetId: string, force: boolean = false): Promise<{success: boolean, message?: string, count?: number}> => {
    if (!scriptUrl) return { success: false, message: "رابط السكربت غير موجود" };
    if (!targetSheetId) return { success: false, message: "لم يتم تحديد Sheet ID (الخلية A2 فارغة أو لم يتم جلبها)" };

    try {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        const fetchUrl = `${scriptUrl}${separator}targetId=${targetSheetId}&t=${Date.now()}`;

        const response = await fetch(fetchUrl, {
            method: 'GET',
            redirect: 'follow',
            credentials: 'omit', 
        });

        if (!response.ok) {
            throw new Error(`خطأ في الشبكة: ${response.status} ${response.statusText}`);
        }
        
        const text = await response.text();
        
        if (text.trim().startsWith('<') || text.toLowerCase().includes('<!doctype html>')) {
             throw new Error("الرابط أعاد صفحة HTML. تأكد من نشر السكربت بصلاحية 'Anyone'.");
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Parse Error Content:", text.substring(0, 100));
            throw new Error("فشل تحليل البيانات. التنسيق غير صحيح (ليس JSON).");
        }

        if (data.error) {
            throw new Error(`رسالة من السكربت: ${data.error}`);
        }

        if (!Array.isArray(data)) {
            throw new Error("تنسيق البيانات المستلمة غير صحيح (ليس مصفوفة)");
        }

        const session = sessions.find(s => s.id === sessionId);
        
        // Allow sync if Active OR if Force is true (Manual Sync - Add all names)
        // If session is closed and NOT forced, we stop strictly.
        if (!session || (session.status === 'closed' && !force)) {
            return { success: true, count: 0 };
        }

        const sessionStart = new Date(session.createdAt).getTime();
        let newCount = 0;

        data.forEach((row: any) => {
            // Expected Format from script:
            // { date: "yyyy-MM-dd", time: "HH:mm:ss", seatNumber: "...", name: "..." }
            
            // Validate basic presence
            if(!row.name) return;

            let logTime = Date.now(); // Fallback to now if no date provided
            
            if (row.date && row.time) {
                 const timestampStr = `${row.date}T${row.time}`;
                 const parsedTime = new Date(timestampStr).getTime();
                 if (!isNaN(parsedTime)) {
                     logTime = parsedTime;
                 }
            }
            
            // Validation: allow data from 24h before session start until now
            if (logTime > sessionStart - 86400000) { 
                // CRITICAL FIX: Explicitly treat seatNumber as string
                const studentId = row.seatNumber ? String(row.seatNumber).trim() : 'N/A'; 
                
                // Deduplicate check
                const exists = attendanceLogs.find(
                    l => l.sessionId === sessionId && (
                        (l.studentId !== 'N/A' && l.studentId === studentId) || 
                        l.studentName === row.name
                    )
                );

                if (!exists) {
                    attendanceLogs.unshift({
                        id: Math.random().toString(),
                        sessionId,
                        studentName: row.name,
                        studentId: studentId,
                        timestamp: new Date(logTime).toISOString()
                    });
                    newCount++;
                }
            }
        });

        if (newCount > 0) {
            // Update session count
            sessions = sessions.map(s => s.id === sessionId ? { ...s, attendedCount: s.attendedCount + newCount } : s);
            
            // Persist
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(attendanceLogs));
            localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
        }
        
        return { success: true, count: newCount };

    } catch (error: any) {
        console.error("Sync Error Detailed:", error);
        
        let friendlyMessage = error.message;
        
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
            friendlyMessage = "فشل الاتصال: يرجى التأكد من نشر السكربت بصلاحية 'Anyone'.";
        } else if (error.name === 'SyntaxError') {
             friendlyMessage = "خطأ في قراءة البيانات (ليس JSON). تأكد من رابط السكربت.";
        }

        return { success: false, message: friendlyMessage };
    }
  },

  // Simulates the ESP32 POST request (Internal Test - Deprecated mostly but kept for robustness)
  simulateScan: async (sessionId: string): Promise<AttendanceRecord> => {
    await delay(600);
    const randomStudent = mockStudents[Math.floor(Math.random() * mockStudents.length)];
    
    // Check if already attended
    const exists = attendanceLogs.find(l => l.sessionId === sessionId && l.studentId === randomStudent.id);
    if (exists) {
        throw new Error("الطالب مسجل بالفعل");
    }

    const newLog: AttendanceRecord = {
      id: Math.random().toString(),
      sessionId,
      studentName: randomStudent.name,
      studentId: randomStudent.id,
      timestamp: new Date().toISOString()
    };
    attendanceLogs = [newLog, ...attendanceLogs];
    
    // Update session count
    sessions = sessions.map(s => s.id === sessionId ? { ...s, attendedCount: s.attendedCount + 1 } : s);
    
    // Auto-save on scan
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(attendanceLogs));
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    
    return newLog;
  }
};