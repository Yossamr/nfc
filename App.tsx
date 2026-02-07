import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar'; // This is now the BottomDock
import { DashboardCard } from './components/DashboardCard';
import { api } from './services/mockApi';
import { Session, ViewState, AttendanceRecord, Subject, Hall } from './types';
import { Users, BookOpen, Activity, Play, StopCircle, UserCheck, Check, LogOut, PlusCircle, Calendar, Trash2, Link as LinkIcon, Building2, Save, RefreshCw, Network, Radio, Link2, Sheet, Printer, ChevronLeft, Clock, ArrowRight, Menu, FileText, Download } from 'lucide-react';

const STORAGE_KEY_SUBJECTS = 'nfc_app_subjects';
const STORAGE_KEY_HALLS = 'nfc_app_halls';
const STORAGE_KEY_GLOBAL_SCRIPT = 'nfc_app_global_script';
const STORAGE_KEY_N8N_WEBHOOK = 'nfc_app_n8n_webhook';
const STORAGE_KEY_MASTER_GID = 'nfc_app_master_gid';
const STORAGE_KEY_TARGET_CELL = 'nfc_app_target_cell';

export default function App() {
  const [view, setView] = useState<ViewState>('login');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  
  // Create Session Pre-fill state
  const [prefillSession, setPrefillSession] = useState<{subjectId: string, weekNumber: number} | null>(null);

  const [loading, setLoading] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // --- Initial Data Load ---
  const loadInitialSubjects = (): Subject[] => {
    const stored = localStorage.getItem(STORAGE_KEY_SUBJECTS);
    if (stored) return JSON.parse(stored);
    return [
      { id: '1', name: 'مقدمة في علوم الحاسب' },
      { id: '2', name: 'قواعد بيانات متقدمة' },
    ];
  };

  const loadInitialHalls = (): Hall[] => {
    const stored = localStorage.getItem(STORAGE_KEY_HALLS);
    if (stored) return JSON.parse(stored);
    return [
      { id: '1', name: 'مدرج A' },
      { id: '2', name: 'مدرج B' },
      { id: '3', name: 'قاعة 101' },
      { id: '4', name: 'معمل الحاسب' },
    ];
  };

  // --- Global State for Settings ---
  const [subjects, setSubjects] = useState<Subject[]>(loadInitialSubjects);
  const [halls, setHalls] = useState<Hall[]>(loadInitialHalls);
  const [globalScriptUrl, setGlobalScriptUrl] = useState(() => localStorage.getItem(STORAGE_KEY_GLOBAL_SCRIPT) || '');
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(() => localStorage.getItem(STORAGE_KEY_N8N_WEBHOOK) || '');
  const [masterSheetGid, setMasterSheetGid] = useState(() => localStorage.getItem(STORAGE_KEY_MASTER_GID) || '1040601765');
  const [targetCell, setTargetCell] = useState(() => localStorage.getItem(STORAGE_KEY_TARGET_CELL) || 'A2');

  // Refs to hold latest state for interval
  const subjectsRef = useRef(subjects);
  const hallsRef = useRef(halls);
  const globalScriptUrlRef = useRef(globalScriptUrl);
  const n8nWebhookUrlRef = useRef(n8nWebhookUrl);
  const masterSheetGidRef = useRef(masterSheetGid);
  const targetCellRef = useRef(targetCell);

  useEffect(() => {
    subjectsRef.current = subjects;
  }, [subjects]);

  useEffect(() => {
    hallsRef.current = halls;
  }, [halls]);

  useEffect(() => {
    globalScriptUrlRef.current = globalScriptUrl;
  }, [globalScriptUrl]);

  useEffect(() => {
    n8nWebhookUrlRef.current = n8nWebhookUrl;
  }, [n8nWebhookUrl]);

  useEffect(() => {
    masterSheetGidRef.current = masterSheetGid;
  }, [masterSheetGid]);

  useEffect(() => {
    targetCellRef.current = targetCell;
  }, [targetCell]);

  // Stats
  const activeSessionsCount = sessions.filter(s => s.status === 'active').length;
  const totalSessionsCount = sessions.length;
  const totalAttendance = sessions.reduce((acc, curr) => acc + curr.attendedCount, 0);

  useEffect(() => {
    loadSessions();
  }, [view]);

  // Auto Save Interval
  useEffect(() => {
    const interval = setInterval(() => {
        handleSaveAll(true);
    }, 60000); // 60 seconds (1 minute)
    return () => clearInterval(interval);
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const data = await api.getSessions();
    setSessions(data);
    setLoading(false);
  };

  const handleSaveAll = (isAuto = false) => {
    setSaveStatus('saving');
    
    // Save React State
    localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(subjectsRef.current));
    localStorage.setItem(STORAGE_KEY_HALLS, JSON.stringify(hallsRef.current));
    localStorage.setItem(STORAGE_KEY_GLOBAL_SCRIPT, globalScriptUrlRef.current);
    localStorage.setItem(STORAGE_KEY_N8N_WEBHOOK, n8nWebhookUrlRef.current);
    localStorage.setItem(STORAGE_KEY_MASTER_GID, masterSheetGidRef.current);
    localStorage.setItem(STORAGE_KEY_TARGET_CELL, targetCellRef.current);
    
    // Save API State
    api.persistData();

    // Visual feedback
    setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);

    if (!isAuto) {
        console.log("Manual save completed");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setView('dashboard');
  };

  const handleCreateSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Strict Validation
    if (!n8nWebhookUrl) {
        alert("لا يمكن بدء الجلسة: رابط Webhook غير موجود.");
        return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const subjectId = formData.get('subjectId') as string;
    const subject = subjects.find(s => s.id === subjectId);
    
    if (!subject) {
        setLoading(false);
        return;
    }

    const tempSessionId = Math.floor(Math.random() * 10000).toString(); 

    // 1. Trigger n8n Webhook
    try {
        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'session_started',
                sessionId: tempSessionId, 
                lectureName: subject.name,
                hall: formData.get('hall') as string,
                weekNumber: Number(formData.get('weekNumber')),
                professor: 'Dr. Ahmed', 
                timestamp: new Date().toISOString(),
                targetCell: targetCell 
            })
        });

        if (!response.ok) {
            throw new Error(`خطأ من الخادم: ${response.status}`);
        }
    } catch (error: any) {
        alert(`فشل إرسال Webhook: ${error.message}`);
        setLoading(false);
        return; 
    }

    // 2. Create Session in App
    const newSession = await api.createSession(
      subject.name,
      formData.get('hall') as string,
      Number(formData.get('weekNumber')),
      globalScriptUrl
    );

    setLoading(false);
    setPrefillSession(null); // Clear prefill
    setSelectedSessionId(newSession.id);
    setView('session-details');
  };

  const handleSessionClick = (id: string) => {
    setSelectedSessionId(id);
    setView('session-details');
  };

  const handleSubjectClick = (subject: Subject) => {
      setSelectedSubject(subject);
      setView('subject-weeks');
  };

  // --- Views ---

  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-slate-950">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#1e293b,transparent)] opacity-70"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-sm w-full bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/10 relative z-10">
        <div className="p-8 pb-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <Users className="text-white w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">أهلاً بك</h2>
          <p className="text-slate-400 text-sm">نظام تسجيل الحضور الذكي NFC</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-8 pt-2 space-y-5">
          <div className="space-y-4">
            <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1 uppercase tracking-wider">البريد الإلكتروني</label>
                <input required type="email" defaultValue="dr.ahmed@university.edu" className="w-full px-5 py-3.5 bg-slate-950/50 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-slate-600 text-base" />
            </div>
            <div className="group">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 mr-1 uppercase tracking-wider">كلمة المرور</label>
                <input required type="password" defaultValue="password" className="w-full px-5 py-3.5 bg-slate-950/50 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-slate-600 text-base" />
            </div>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-900/40 text-lg mt-4 active:scale-[0.98]">
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );

  const SubjectsListView = () => {
    return (
        <div className="space-y-6">
             <header>
                <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">المواد الدراسية</h1>
                <p className="text-slate-400 text-sm font-medium">اختر المادة لعرض تفاصيل الأسابيع</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {subjects.map(subject => {
                    const subSessions = sessions.filter(s => s.lectureName === subject.name);
                    const lastSession = subSessions[0];
                    
                    return (
                        <div key={subject.id} onClick={() => handleSubjectClick(subject)} className="group cursor-pointer relative overflow-hidden bg-slate-900/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl hover:bg-slate-800/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/0 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                             <div className="flex items-start justify-between mb-8 relative z-10">
                                 <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg text-white font-bold text-2xl">
                                     {subject.name.charAt(0)}
                                 </div>
                                 <div className="bg-white/5 p-2 rounded-xl text-slate-400 group-hover:bg-white/10 transition-colors">
                                     <ArrowRight size={20} className="rtl:rotate-180" />
                                 </div>
                             </div>
                             <div className="relative z-10">
                                 <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{subject.name}</h3>
                                 <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                                     <span className="flex items-center gap-1.5"><BookOpen size={14}/> {subSessions.length} محاضرات</span>
                                     {lastSession && <span className="flex items-center gap-1.5 text-emerald-400"><Clock size={14}/> آخر نشاط: أسبوع {lastSession.weekNumber}</span>}
                                 </div>
                             </div>
                        </div>
                    );
                })}
                <button onClick={() => setView('settings')} className="group flex flex-col items-center justify-center p-6 rounded-3xl border-2 border-dashed border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/40 transition-all duration-300">
                    <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 group-hover:text-blue-400 mb-3 transition-colors">
                        <PlusCircle size={28} />
                    </div>
                    <span className="text-slate-500 font-bold group-hover:text-white transition-colors">إضافة مادة جديدة</span>
                </button>
            </div>
        </div>
    );
  };

  const SubjectWeeksView = () => {
      if (!selectedSubject) return <div className="p-10 text-center">لم يتم اختيار مادة</div>;

      const weeks = Array.from({length: 15}, (_, i) => i + 1);
      const subjectSessions = sessions.filter(s => s.lectureName === selectedSubject.name);

      const handleWeekClick = (weekNum: number, existingSession?: Session) => {
          if (existingSession) {
              handleSessionClick(existingSession.id);
          } else {
              setPrefillSession({ subjectId: selectedSubject.id, weekNumber: weekNum });
              setView('create-session');
          }
      };

      const handleExportSubjectReport = async () => {
        if (!selectedSubject) return;
        setGeneratingPDF(true);
        try {
            // 1. Gather all sessions for this subject
            const allSubjectSessions = sessions.filter(s => s.lectureName === selectedSubject.name);
            
            // 2. Gather all attendance logs for these sessions
            let allLogs: AttendanceRecord[] = [];
            // We use Promise.all to fetch details if we didn't have them in state (though mockApi returns promises)
            for (const s of allSubjectSessions) {
                const { logs } = await api.getSessionDetails(s.id);
                allLogs = [...allLogs, ...logs];
            }

            // 3. Build Unique Student Roster
            const studentsMap = new Map<string, string>(); // ID -> Name
            allLogs.forEach(l => {
                if (l.studentId && l.studentId !== 'N/A') {
                    studentsMap.set(l.studentId, l.studentName);
                }
            });
            const uniqueStudents = Array.from(studentsMap.entries()).map(([id, name]) => ({ id, name }));

            if (uniqueStudents.length === 0) {
                alert("لا توجد بيانات حضور لهذه المادة حتى الآن.");
                setGeneratingPDF(false);
                return;
            }

            // 4. Generate HTML
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
                setGeneratingPDF(false);
                return;
            }

            const headerWeeks = weeks.map(w => `<th class="week-col">W${w}</th>`).join('');
            
            const rows = uniqueStudents.sort((a, b) => a.name.localeCompare(b.name)).map((student, idx) => {
                const weekCells = weeks.map(w => {
                    // Find session for this week
                    const session = allSubjectSessions.find(s => s.weekNumber === w);
                    if (!session) return '<td class="empty-cell">-</td>'; // No session held

                    // Check if student attended
                    const attended = allLogs.some(l => l.sessionId === session.id && l.studentId === student.id);
                    return attended 
                        ? '<td class="present">✓</td>' 
                        : '<td class="absent">✗</td>';
                }).join('');

                return `
                    <tr>
                        <td>${idx + 1}</td>
                        <td class="name-cell">${student.name}</td>
                        <td class="id-cell">${student.id}</td>
                        ${weekCells}
                    </tr>
                `;
            }).join('');

            const htmlContent = `
                <html dir="rtl" lang="ar">
                <head>
                    <title>تقرير حضور شامل - ${selectedSubject.name}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Cairo', sans-serif; padding: 20px; color: #1e293b; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
                        h1 { margin: 0; color: #0f172a; font-size: 24px; }
                        p { margin: 5px 0 0; color: #64748b; }
                        
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: center; }
                        th { background: #f1f5f9; font-weight: bold; }
                        .week-col { width: 30px; font-size: 10px; }
                        .name-cell { text-align: right; font-weight: 600; min-width: 150px; }
                        .id-cell { font-family: monospace; letter-spacing: 1px; }
                        .present { color: #16a34a; font-weight: bold; font-size: 14px; background-color: #f0fdf4; }
                        .absent { color: #dc2626; font-weight: bold; font-size: 14px; background-color: #fef2f2; }
                        .empty-cell { color: #94a3b8; background-color: #f8fafc; }
                        
                        @media print {
                            @page { size: landscape; }
                            th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
                            .present { background-color: #f0fdf4 !important; -webkit-print-color-adjust: exact; }
                            .absent { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>سجل الحضور الشامل</h1>
                        <p>المادة: ${selectedSubject.name} | التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px">م</th>
                                <th>اسم الطالب</th>
                                <th>رقم القيد</th>
                                ${headerWeeks}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                    <script>window.onload=function(){window.print()}</script>
                </body>
                </html>
            `;

            printWindow.document.write(htmlContent);
            printWindow.document.close();

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء إنشاء التقرير");
        } finally {
            setGeneratingPDF(false);
        }
      };

      return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('subjects-list')} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-colors"><ChevronLeft/></button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{selectedSubject.name}</h2>
                        <p className="text-slate-400 text-sm">سجل الأسابيع والمحاضرات</p>
                    </div>
                </div>
                
                <button 
                    onClick={handleExportSubjectReport}
                    disabled={generatingPDF}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl border border-white/10 transition-all active:scale-95 font-bold text-sm"
                >
                    {generatingPDF ? <RefreshCw size={18} className="animate-spin"/> : <Printer size={18} />}
                    <span>تقرير المادة</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {weeks.map(weekNum => {
                    const session = subjectSessions.find(s => s.weekNumber === weekNum);
                    const isActive = session?.status === 'active';

                    return (
                        <div key={weekNum} onClick={() => handleWeekClick(weekNum, session)} className={`relative group p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${session ? 'bg-slate-900/60 border-slate-700 hover:border-slate-500' : 'bg-slate-950 border-slate-800/50 border-dashed hover:bg-slate-900 hover:border-blue-500/50'}`}>
                            {session && (
                                <div className={`absolute top-0 right-0 w-20 h-20 blur-2xl rounded-full -mr-10 -mt-10 pointer-events-none ${isActive ? 'bg-emerald-500/20' : 'bg-blue-500/10'}`}></div>
                            )}

                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <span className={`text-sm font-bold uppercase tracking-wider ${session ? 'text-white' : 'text-slate-600'}`}>Week {weekNum}</span>
                                {session ? (
                                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
                                ) : (
                                    <PlusCircle size={18} className="text-slate-600 group-hover:text-blue-500 transition-colors" />
                                )}
                            </div>

                            <div className="relative z-10">
                                {session ? (
                                    <>
                                        <div className="text-2xl font-bold text-white mb-1">{session.attendedCount} <span className="text-xs font-normal text-slate-400">طالب</span></div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar size={10} />
                                            {new Date(session.createdAt).toLocaleDateString('ar-EG')}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-10 flex items-center text-slate-600 text-sm font-medium group-hover:text-blue-400 transition-colors">
                                        بدء الجلسة
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      );
  };

  const SettingsView = () => {
    // (Settings Logic same as before)
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newHallName, setNewHallName] = useState('');
    const [pasteUrlInput, setPasteUrlInput] = useState('');
    
    const [localScriptUrl, setLocalScriptUrl] = useState(globalScriptUrl);
    const [localN8nUrl, setLocalN8nUrl] = useState(n8nWebhookUrl);
    const [localGid, setLocalGid] = useState(masterSheetGid);
    const [localTargetCell, setLocalTargetCell] = useState(targetCell);

    const handlePasteUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value;
        setPasteUrlInput(url);
        const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
        if (gidMatch && gidMatch[1]) setLocalGid(gidMatch[1]);
        const rangeMatch = url.match(/[&?]range=([A-Za-z0-9:]+)/);
        if (rangeMatch && rangeMatch[1]) setLocalTargetCell(rangeMatch[1]);
    };

    const saveSettings = () => {
        setGlobalScriptUrl(localScriptUrl);
        setN8nWebhookUrl(localN8nUrl);
        setMasterSheetGid(localGid);
        setTargetCell(localTargetCell);
        localStorage.setItem(STORAGE_KEY_GLOBAL_SCRIPT, localScriptUrl);
        localStorage.setItem(STORAGE_KEY_N8N_WEBHOOK, localN8nUrl);
        localStorage.setItem(STORAGE_KEY_MASTER_GID, localGid);
        localStorage.setItem(STORAGE_KEY_TARGET_CELL, localTargetCell);
        handleSaveAll(false);
    };

    const addSubject = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSubjectName) return;
      setSubjects([...subjects, { id: Date.now().toString(), name: newSubjectName }]);
      setNewSubjectName('');
    };

    const addHall = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHallName) return;
      setHalls([...halls, { id: Date.now().toString(), name: newHallName }]);
      setNewHallName('');
    };

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="px-1">
          <h2 className="text-2xl font-bold text-white mb-1">الإعدادات</h2>
        </div>

        {/* Integration Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <Network size={20} className="text-emerald-400" />
                <h3 className="font-bold text-slate-200">الربط والاتصال</h3>
            </div>
            <div className="p-5 space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Google Apps Script URL</label>
                    <input type="text" value={localScriptUrl} onChange={(e) => setLocalScriptUrl(e.target.value)} className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl focus:border-blue-500 outline-none text-sm dir-ltr text-slate-300 font-mono" placeholder="https://script.google.com/..." />
                </div>
                
                <div className="bg-slate-950/30 p-4 rounded-xl border border-white/5 space-y-4">
                    <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2"><Sheet size={14}/> إعدادات الشيت الرئيسي</label>
                    <input type="text" value={pasteUrlInput} onChange={handlePasteUrl} placeholder="الصق رابط الخلية هنا لاستخراج ID..." className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-xs text-blue-200 outline-none" />
                    <div className="flex gap-4">
                        <input type="text" value={localGid} onChange={(e) => setLocalGid(e.target.value)} className="w-1/2 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-center font-mono text-sm" placeholder="GID" />
                        <input type="text" value={localTargetCell} onChange={(e) => setLocalTargetCell(e.target.value)} className="w-1/2 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-center font-mono text-sm text-yellow-400 font-bold" placeholder="Cell" />
                    </div>
                </div>

                <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-400 uppercase">n8n Webhook</label>
                     <input type="text" value={localN8nUrl} onChange={(e) => setLocalN8nUrl(e.target.value)} className="w-full px-4 py-3 bg-slate-950/50 border border-white/10 rounded-xl focus:border-blue-500 outline-none text-sm dir-ltr text-slate-300 font-mono" placeholder="https://..." />
                </div>

                <button onClick={saveSettings} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-all">
                    حفظ التغييرات
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-5">
                 <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2"><BookOpen size={18} className="text-blue-400"/> المواد الدراسية</h3>
                 <form onSubmit={addSubject} className="flex gap-2 mb-4">
                     <input type="text" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} placeholder="اسم المادة" className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500"/>
                     <button className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-blue-500"><PlusCircle size={20}/></button>
                 </form>
                 <div className="space-y-2 max-h-48 overflow-y-auto">
                     {subjects.map(s => (
                         <div key={s.id} className="flex justify-between items-center bg-slate-950/30 p-3 rounded-lg border border-white/5">
                             <span className="text-sm">{s.name}</span>
                             <button onClick={() => setSubjects(subjects.filter(x => x.id !== s.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                         </div>
                     ))}
                 </div>
             </div>
             <div className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 p-5">
                 <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2"><Building2 size={18} className="text-purple-400"/> القاعات</h3>
                 <form onSubmit={addHall} className="flex gap-2 mb-4">
                     <input type="text" value={newHallName} onChange={e => setNewHallName(e.target.value)} placeholder="اسم القاعة" className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-purple-500"/>
                     <button className="bg-purple-600 w-10 h-10 rounded-xl flex items-center justify-center text-white hover:bg-purple-500"><PlusCircle size={20}/></button>
                 </form>
                 <div className="space-y-2 max-h-48 overflow-y-auto">
                     {halls.map(h => (
                         <div key={h.id} className="flex justify-between items-center bg-slate-950/30 p-3 rounded-lg border border-white/5">
                             <span className="text-sm">{h.name}</span>
                             <button onClick={() => setHalls(halls.filter(x => x.id !== h.id))} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                         </div>
                     ))}
                 </div>
             </div>
        </div>
      </div>
    );
  };

  const CreateSessionView = () => {
    // (Existing Create Session View Logic)
    const [selectedSubjectId, setSelectedSubjectId] = useState(prefillSession ? prefillSession.subjectId : (subjects.length > 0 ? subjects[0].id : ''));
    const [selectedWeek, setSelectedWeek] = useState(prefillSession ? prefillSession.weekNumber : 1);
    const isWebhookReady = !!n8nWebhookUrl;
    
    useEffect(() => {
        if (!prefillSession && !subjects.find(s => s.id === selectedSubjectId) && subjects.length > 0) {
            setSelectedSubjectId(subjects[0].id);
        }
    }, [subjects, prefillSession]);

    if(subjects.length === 0) return <div className="text-center p-10 text-slate-500">الرجاء إضافة مواد أولاً</div>;

    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
            <button onClick={() => {
                if(prefillSession && selectedSubject) {
                    setView('subject-weeks');
                } else {
                    setView('dashboard');
                }
            }} className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 transition-colors"><ChevronLeft/></button>
            <h2 className="text-2xl font-bold text-white">جلسة جديدة</h2>
        </div>
        
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <form onSubmit={handleCreateSession} className="space-y-6 relative z-10">
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">المادة الدراسية</label>
                <div className="relative group">
                    <select name="subjectId" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} disabled={!!prefillSession} className={`w-full px-5 py-4 bg-slate-950/50 border border-slate-700/50 text-white rounded-2xl appearance-none focus:ring-2 focus:ring-blue-500/50 outline-none text-lg transition-all ${prefillSession ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <BookOpen size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-blue-400 transition-colors"/>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">القاعة</label>
                    <div className="relative group">
                        <select name="hall" className="w-full px-4 py-4 bg-slate-950/50 border border-slate-700/50 text-white rounded-2xl appearance-none focus:ring-2 focus:ring-purple-500/50 outline-none transition-all">
                        {halls.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                        </select>
                        <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-purple-400 transition-colors"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">الأسبوع</label>
                    <div className="relative group">
                        <select name="weekNumber" value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} disabled={!!prefillSession} className={`w-full px-4 py-4 bg-slate-950/50 border border-slate-700/50 text-white rounded-2xl appearance-none focus:ring-2 focus:ring-amber-500/50 outline-none transition-all ${prefillSession ? 'opacity-70 cursor-not-allowed' : ''}`}>
                        {Array.from({length: 15}, (_, i) => i + 1).map(num => <option key={num} value={num}>{num}</option>)}
                        </select>
                        <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-amber-400 transition-colors"/>
                    </div>
                  </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
                 <div className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase py-2 rounded-lg border ${globalScriptUrl ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    <Radio size={12} className={globalScriptUrl ? "animate-pulse" : ""} /> Script
                 </div>
                 <div className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase py-2 rounded-lg border ${isWebhookReady ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                    <Network size={12} /> n8n
                 </div>
            </div>

            <button 
                disabled={loading || !isWebhookReady} 
                type="submit" 
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-bold shadow-xl transition-all active:scale-[0.98] group relative overflow-hidden
                    ${loading || !isWebhookReady ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/30'}`
                }
              >
                {!loading && isWebhookReady && <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>}
                {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Play size={24} fill="currentColor" /> بدء الجلسة</>}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const SessionDetailsView = () => {
    // (Existing Session Details Logic - preserved)
    const [details, setDetails] = useState<{ session?: Session, logs: AttendanceRecord[] } | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pdfExporting, setPdfExporting] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [fetchIdStatus, setFetchIdStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const autoFetchAttempted = useRef(false);

    useEffect(() => {
      if (!selectedSessionId) return;
      const fetchData = async () => {
          const data = await api.getSessionDetails(selectedSessionId);
          setDetails(data);
          if (data.session?.status === 'active' && data.session.scriptUrl && data.session.targetSheetId) {
              const res = await api.syncExternalAttendance(selectedSessionId, data.session.scriptUrl, data.session.targetSheetId, false);
              if (res.success && res.count && res.count > 0) setDetails(await api.getSessionDetails(selectedSessionId));
          }
      };
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }, [selectedSessionId]);

    const fetchSheetIdFromMaster = async () => {
        if (!details?.session?.scriptUrl) return;
        setFetchIdStatus('loading');
        const result = await api.fetchLatestSheetId(details.session.scriptUrl);
        if (result.success && result.id) {
            await api.updateSessionSheetId(details.session.id, result.id);
            setDetails(await api.getSessionDetails(details.session.id));
            setFetchIdStatus('success');
            setTimeout(() => setFetchIdStatus('idle'), 3000);
        } else {
            setFetchIdStatus('error');
            setSyncError(result.message || "فشل");
        }
    };

    useEffect(() => {
        if (!details?.session) return;
        const { status, targetSheetId, createdAt, scriptUrl, id } = details.session;
        const isFresh = (Date.now() - new Date(createdAt).getTime()) < 30000;
        if (status === 'active' && !targetSheetId && scriptUrl && isFresh && !autoFetchAttempted.current) {
            autoFetchAttempted.current = true;
            setFetchIdStatus('loading');
            const timer = setTimeout(() => {
                (async () => {
                    try {
                        const result = await api.fetchLatestSheetId(scriptUrl);
                        if (result.success && result.id) {
                            await api.updateSessionSheetId(id, result.id);
                            setDetails(await api.getSessionDetails(id));
                            setFetchIdStatus('success');
                            setTimeout(() => setFetchIdStatus('idle'), 3000);
                        } else { setFetchIdStatus('error'); }
                    } catch (e) { setFetchIdStatus('error'); }
                })();
            }, 7000);
            return () => clearTimeout(timer);
        }
    }, [details?.session]);

    const handleManualSync = async () => {
        if (!details?.session?.scriptUrl || !details?.session?.targetSheetId) return;
        setIsSyncing(true);
        setSyncError(null);
        const result = await api.syncExternalAttendance(details.session.id, details.session.scriptUrl, details.session.targetSheetId, true);
        if (result.success) setDetails(await api.getSessionDetails(details.session.id));
        else setSyncError(result.message || "فشل");
        setIsSyncing(false);
    };

    const closeSession = async () => {
        if (selectedSessionId && confirm('إغلاق الجلسة؟')) {
             await api.closeSession(selectedSessionId);
             setDetails(await api.getSessionDetails(selectedSessionId));
        }
    };

    const exportToPDF = async () => {
      if (!details?.session) return;
      setPdfExporting(true);
      
      try {
        const session = details.session;
        
        // 1. Determine "Absent" students.
        // Logic: Get ALL unique students from ALL sessions of this specific subject.
        // This set represents the "Class Roster".
        const subjectSessions = sessions.filter(s => s.lectureName === session.lectureName);
        let allLogs: AttendanceRecord[] = [];
        for (const s of subjectSessions) {
            const { logs } = await api.getSessionDetails(s.id);
            allLogs = [...allLogs, ...logs];
        }
        
        const roster = new Map<string, string>(); // ID -> Name
        allLogs.forEach(l => {
            if (l.studentId && l.studentId !== 'N/A') {
                roster.set(l.studentId, l.studentName);
            }
        });

        // Current Attendees
        const presentIds = new Set(details.logs.map(l => l.studentId));
        const absentStudents = Array.from(roster.entries())
            .filter(([id]) => !presentIds.has(id))
            .map(([id, name]) => ({ id, name }));

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = `
            <html dir="rtl" lang="ar">
            <head>
                <title>تقرير الجلسة - ${session.lectureName}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    body{font-family:'Cairo',sans-serif;padding:30px;color:#1e293b}
                    .header{text-align:center;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:30px}
                    .stats-box{display:flex;justify-content:space-around;margin-bottom:30px}
                    .stat{text-align:center;padding:15px;border:1px solid #e2e8f0;border-radius:10px;width:30%}
                    .stat h3{margin:0;font-size:32px;color:#0f172a}
                    .stat span{color:#64748b;font-size:14px}
                    
                    table{width:100%;border-collapse:collapse;margin-top:10px;margin-bottom:30px}
                    th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}
                    th{background:#f1f5f9}
                    
                    .section-title{font-size:18px;font-weight:bold;margin-bottom:10px;display:flex;align-items:center;gap:10px}
                    .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
                    .green{background:#22c55e}
                    .red{background:#ef4444}
                    
                    @media print {
                        .stat { border: 1px solid #94a3b8; }
                        th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${session.lectureName}</h1>
                    <p>الأسبوع: ${session.weekNumber} | القاعة: ${session.hall} | التاريخ: ${new Date(session.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
                
                <div class="stats-box">
                    <div class="stat">
                        <h3>${details.logs.length}</h3>
                        <span>حضور</span>
                    </div>
                    <div class="stat">
                        <h3>${absentStudents.length}</h3>
                        <span>غياب</span>
                    </div>
                    <div class="stat">
                        <h3>${details.logs.length + absentStudents.length}</h3>
                        <span>الإجمالي</span>
                    </div>
                </div>
                
                <div class="section-title">
                    <span class="dot green"></span> قائمة الحضور (${details.logs.length})
                </div>
                <table>
                    <thead><tr><th>م</th><th>الاسم</th><th>الرقم</th><th>وقت الحضور</th></tr></thead>
                    <tbody>
                    ${details.logs.map((l, i) => `<tr><td>${i+1}</td><td>${l.studentName}</td><td style="font-family:monospace">${l.studentId}</td><td>${new Date(l.timestamp).toLocaleTimeString('ar-EG')}</td></tr>`).join('')}
                    </tbody>
                </table>
                
                <div class="section-title" style="margin-top: 40px">
                    <span class="dot red"></span> قائمة الغياب (${absentStudents.length})
                </div>
                <table>
                    <thead><tr><th>م</th><th>الاسم</th><th>الرقم</th></tr></thead>
                    <tbody>
                    ${absentStudents.length > 0 
                        ? absentStudents.map((s, i) => `<tr><td>${i+1}</td><td>${s.name}</td><td style="font-family:monospace">${s.id}</td></tr>`).join('')
                        : '<tr><td colspan="3" style="text-align:center;color:#94a3b8">لا يوجد غياب (أو لم يتم تحديد القائمة الكاملة بعد)</td></tr>'
                    }
                    </tbody>
                </table>
                <script>window.onload=function(){window.print()}</script>
            </body>
            </html>`;
            
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      } catch (e) {
          console.error(e);
          alert("خطأ أثناء إنشاء التقرير");
      } finally {
          setPdfExporting(false);
      }
    };

    if (!details?.session) return <div className="flex h-64 items-center justify-center text-slate-500">جاري التحميل...</div>;
    const isActive = details.session.status === 'active';

    return (
      <div className="space-y-5">
        {/* Sticky Header with Blur */}
        <div className="bg-slate-900/80 backdrop-blur-xl p-4 -mx-4 md:mx-0 md:rounded-2xl border-b md:border border-white/5 sticky top-0 z-30 transition-all">
          <div className="flex justify-between items-start gap-3">
             <div className="flex-1">
                <button onClick={() => setView('dashboard')} className="flex items-center gap-1 text-slate-400 mb-1 text-xs font-bold uppercase tracking-wider"><ChevronLeft size={14}/> عودة</button>
                <h2 className="text-xl font-bold text-white leading-tight">{details.session.lectureName}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {isActive ? 'Active' : 'Closed'}
                    </span>
                    <span className="text-xs text-slate-400">Week {details.session.weekNumber}</span>
                </div>
             </div>
             {isActive && (
                <button onClick={closeSession} className="bg-red-500/10 text-red-400 p-3 rounded-xl border border-red-500/20 active:scale-90 transition-transform">
                    <StopCircle size={24} />
                </button>
             )}
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-3">
             {isActive && !details.session.targetSheetId && (
                 <button onClick={fetchSheetIdFromMaster} disabled={fetchIdStatus === 'loading'} className={`col-span-2 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${fetchIdStatus === 'success' ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {fetchIdStatus === 'loading' ? <RefreshCw size={20} className="animate-spin"/> : <Link2 size={20}/>}
                    {fetchIdStatus === 'loading' ? 'جاري الربط...' : `جلب رابط الغياب (${targetCell})`}
                 </button>
             )}
             {details.session.targetSheetId && (
                <>
                    <button onClick={handleManualSync} disabled={isSyncing} className="bg-slate-800/50 text-blue-300 p-3 rounded-xl border border-white/5 flex items-center justify-center gap-2 active:scale-95">
                        <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} /> تحديث
                    </button>
                    <a href={`https://docs.google.com/spreadsheets/d/${details.session.targetSheetId}`} target="_blank" rel="noreferrer" className="bg-green-600/10 text-green-400 p-3 rounded-xl border border-green-500/20 flex items-center justify-center gap-2 active:scale-95">
                        <Sheet size={18} /> فتح الشيت
                    </a>
                </>
             )}
        </div>
        
        {syncError && <div className="bg-red-900/20 text-red-300 text-xs p-3 rounded-xl border border-red-500/20">{syncError}</div>}

        {/* Student List */}
        <div>
            <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="font-bold text-slate-200 flex items-center gap-2"><Users size={18} className="text-blue-400"/> الحضور ({details.logs.length})</h3>
                <button 
                    onClick={exportToPDF} 
                    disabled={pdfExporting}
                    className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1 active:scale-95 transition-all hover:bg-slate-700"
                >
                    {pdfExporting ? <RefreshCw size={14} className="animate-spin"/> : <Printer size={14}/>} 
                    PDF
                </button>
            </div>
            
            <div className="space-y-3">
                {details.logs.map((log) => (
                    <div key={log.id} className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-4 flex items-center gap-4 transition-all hover:bg-slate-800/50">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-900/20">
                            {log.studentName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold truncate">{log.studentName}</h4>
                            <p className="text-slate-400 text-xs font-mono tracking-wider">{log.studentId}</p>
                        </div>
                        <div className="text-right">
                             <div className="text-xs text-slate-500 font-medium bg-slate-950/50 px-2 py-1 rounded-lg border border-white/5">
                                {new Date(log.timestamp).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                             </div>
                        </div>
                    </div>
                ))}
                {details.logs.length === 0 && (
                    <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                             <Users size={32} className="text-slate-600 opacity-50"/>
                        </div>
                        <p>لم يتم تسجيل حضور بعد</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  };

  if (view === 'login') return <LoginView />;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-['Cairo'] selection:bg-blue-500/30" dir="rtl">
      {/* Background Gradient Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]"></div>
      </div>
      
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between safe-area-top">
           <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                   <Activity size={20} className="text-white"/>
               </div>
               <div>
                   <h1 className="font-bold text-lg leading-tight">الحضور الذكي</h1>
                   <p className="text-[10px] text-blue-400 font-mono tracking-widest uppercase">NFC SYSTEM</p>
               </div>
           </div>

           <div className="flex items-center gap-2">
               <button onClick={() => handleSaveAll(false)} className="p-2.5 rounded-xl text-emerald-400 hover:bg-emerald-500/10 active:scale-95 transition-all border border-transparent hover:border-emerald-500/20" title="حفظ البيانات">
                    <Save size={20} />
               </button>
               <div className="w-px h-6 bg-white/10 mx-1"></div>
               <button onClick={() => setView('login')} className="p-2.5 rounded-xl text-red-400 hover:bg-red-500/10 active:scale-95 transition-all border border-transparent hover:border-red-500/20" title="تسجيل الخروج">
                   <LogOut size={20} />
               </button>
           </div>
      </header>

      {/* Floating Bottom Dock (Replaces Sidebar) */}
      <Sidebar currentView={view} onChangeView={setView} />
      
      <main className="flex-1 overflow-y-auto relative z-10 scroll-smooth no-scrollbar pt-24 pb-32">
        {/* Global Toast */}
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ${saveStatus === 'idle' ? 'translate-y-10 opacity-0 scale-90 pointer-events-none' : 'translate-y-0 opacity-100 scale-100'}`}>
            <div className="bg-emerald-500/90 backdrop-blur-md text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-emerald-400/20">
                {saveStatus === 'saving' ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <Check size={18} className="drop-shadow-sm" />}
                <span className="font-bold text-xs tracking-wide">{saveStatus === 'saving' ? 'جاري الحفظ...' : 'تم الحفظ'}</span>
            </div>
        </div>

        <div className="px-4 md:px-8 max-w-5xl mx-auto">
          {view === 'dashboard' && (
            <div className="space-y-8 animate-fade-in-up">
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">لوحة التحكم</h1>
                  <p className="text-slate-400 text-sm font-medium">نظرة عامة على المحاضرات والطلاب</p>
                </div>
              </header>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DashboardCard title="الجلسات النشطة" value={activeSessionsCount} icon={<Activity size={24} className="text-emerald-400" />} colorClass="bg-emerald-500/10" />
                <DashboardCard title="إجمالي الطلاب" value={totalAttendance} icon={<Users size={24} className="text-blue-400" />} colorClass="bg-blue-500/10" />
                <DashboardCard title="المحاضرات" value={totalSessionsCount} icon={<BookOpen size={24} className="text-purple-400" />} colorClass="bg-purple-500/10" />
                <DashboardCard title="متوسط الحضور" value="85%" icon={<UserCheck size={24} className="text-amber-400" />} colorClass="bg-amber-500/10" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-xl font-bold text-white">آخر الجلسات</h3>
                    <button onClick={() => setView('subjects-list')} className="text-xs text-blue-400 font-medium hover:text-blue-300">عرض كل المواد</button>
                </div>
                
                <div className="space-y-3">
                    {sessions.map((session, idx) => (
                        <div key={session.id} onClick={() => handleSessionClick(session.id)} className="group bg-slate-900/40 backdrop-blur-md p-5 rounded-3xl border border-white/5 cursor-pointer hover:bg-slate-800/60 transition-all duration-300 hover:scale-[1.01] hover:shadow-xl relative overflow-hidden">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             
                             <div className="flex justify-between items-center relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner ${session.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-white/5'}`}>
                                        {session.lectureName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg mb-1">{session.lectureName}</h4>
                                        <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(session.createdAt).toLocaleDateString('ar-EG')}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                            <span>Week {session.weekNumber}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${session.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {session.status === 'active' ? 'Active' : 'Closed'}
                                    </div>
                                    <div className="text-slate-300 font-mono text-sm">{session.attendedCount} <span className="text-[10px] text-slate-500">Student</span></div>
                                </div>
                             </div>
                        </div>
                    ))}
                    {sessions.length === 0 && !loading && (
                        <div className="text-center py-16 bg-slate-900/30 rounded-3xl border border-dashed border-slate-800/50">
                            <p className="text-slate-500">لا توجد جلسات حديثة</p>
                            <button onClick={() => setView('create-session')} className="mt-4 text-blue-400 text-sm font-bold hover:underline">ابدأ أول محاضرة</button>
                        </div>
                    )}
                </div>
              </div>
            </div>
          )}
          {view === 'subjects-list' && <SubjectsListView />}
          {view === 'subject-weeks' && <SubjectWeeksView />}
          {view === 'create-session' && <CreateSessionView />}
          {view === 'session-details' && <SessionDetailsView />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
    </div>
  );
}