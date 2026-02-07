export const BACKEND_CODE = `
// server.js (Node.js + Express)
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL
const app = express();

app.use(cors());
app.use(express.json());

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// 1. Create Session
app.post('/api/session', async (req, res) => {
  const { lectureName, hall, professorId, materialLink } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO lecture_sessions (lecture_name, hall, professor_id, material_link, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [lectureName, hall, professorId, materialLink, 'active']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Close Session
app.patch('/api/session/:id/close', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE lecture_sessions SET status = $1 WHERE id = $2 RETURNING *',
      ['closed', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Attendance (Called by ESP32 or n8n)
app.post('/api/attendance', async (req, res) => {
  const { nfcId, sessionId } = req.body;
  
  // Check if session is active
  const sessionCheck = await pool.query('SELECT status FROM lecture_sessions WHERE id = $1', [sessionId]);
  if (sessionCheck.rows.length === 0 || sessionCheck.rows[0].status !== 'active') {
    return res.status(403).json({ message: "Session is closed or invalid" });
  }

  // Find Student
  const studentRes = await pool.query('SELECT * FROM students WHERE nfc_id = $1', [nfcId]);
  if (studentRes.rows.length === 0) return res.status(404).json({ message: "Student not found" });
  
  const student = studentRes.rows[0];

  // Log Attendance
  await pool.query(
    'INSERT INTO attendance_log (session_id, student_id, timestamp) VALUES ($1, $2, NOW())',
    [sessionId, student.id]
  );

  // OPTIONAL: Trigger n8n Webhook here to update Google Sheet
  // fetch('https://your-n8n-instance.com/webhook/...', { method: 'POST', body: ... });

  res.json({ message: "Attendance recorded", student: student.name });
});

app.listen(3000, () => console.log('Server running on port 3000'));
`;

export const ESP32_CODE = `
// ESP32 Arduino Code
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASS";
const char* serverUrl = "http://your-server-ip:3000/api/attendance";
// Or use n8n webhook URL directly

#define SS_PIN 5
#define RST_PIN 22
MFRC522 rfid(SS_PIN, RST_PIN);

// Current Session ID (Set via Serial or Hardcoded for demo)
String currentSessionId = "123"; 

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to WiFi");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String nfcId = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    nfcId += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
    nfcId += String(rfid.uid.uidByte[i], HEX);
  }
  
  sendAttendance(nfcId);
  
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void sendAttendance(String nfcId) {
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    String jsonPayload = "{\"nfcId\": \"" + nfcId + "\", \"sessionId\": \"" + currentSessionId + "\"}";
    int httpResponseCode = http.POST(jsonPayload);
    
    if(httpResponseCode > 0){
      String response = http.getString();
      Serial.println(httpResponseCode);
      Serial.println(response);
      // Blink Green LED
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpResponseCode);
      // Blink Red LED
    }
    http.end();
  }
}
`;

export const SQL_SCHEMA = `
-- PostgreSQL Schema

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100)
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    student_university_id VARCHAR(20) UNIQUE,
    nfc_id VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE lecture_sessions (
    id SERIAL PRIMARY KEY,
    professor_id INT REFERENCES users(id),
    lecture_name VARCHAR(100) NOT NULL,
    hall VARCHAR(10) NOT NULL,
    material_link TEXT,
    status VARCHAR(10) CHECK (status IN ('active', 'closed')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance_log (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES lecture_sessions(id),
    student_id INT REFERENCES students(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, student_id) -- Prevent double scanning
);
`;

export const N8N_GUIDE = `
n8n Workflow Steps:

1. **Webhook Node (POST):**
   - Listen on URL: /webhook/attendance
   - Method: POST
   - Accepts JSON: { "nfcId": "...", "sessionId": "..." }

2. **Postgres Node (Check Session):**
   - Query: SELECT status FROM lecture_sessions WHERE id = $json["sessionId"]
   - If status != 'active', Stop Workflow.

3. **Postgres Node (Lookup Student):**
   - Query: SELECT * FROM students WHERE nfc_id = $json["nfcId"]

4. **Postgres Node (Insert Attendance):**
   - INSERT INTO attendance_log ...

5. **Google Sheets Node (Append):**
   - Select Sheet via ID
   - Map fields: Student Name, Lecture Name, Time
   - Operation: Append Row

6. **Response Node:**
   - Return 200 OK to ESP32.
`;
