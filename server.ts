import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Database configuration
const rawServer = process.env.DB_SERVER || "appimss-server.database.windows.net";
const cleanServer = rawServer.replace(/^tcp:/, "").split(",")[0];

const dbConfig: sql.config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: cleanServer,
  database: process.env.DB_NAME || "IMSS",
  port: 1433,
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: false,
  },
};

async function getDbConnection() {
  try {
    return await sql.connect(dbConfig);
  } catch (err) {
    console.error("Database connection failed:", err);
    throw err;
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV,
    database: cleanServer.includes("azure") ? "azure-sql" : "unknown"
  });
});

// Mock Auth for testing (In a real app, this would be more secure)
app.post("/api/auth/login", async (req, res) => {
  const { identifier, role } = req.body; // role can be 'patient' or 'doctor'
  try {
    const pool = await getDbConnection();
    let result;
    if (role === 'patient') {
      result = await pool.request()
        .input('id', sql.Int, parseInt(identifier))
        .query('SELECT * FROM Paciente WHERE NSS = @id');
    } else {
      result = await pool.request()
        .input('id', sql.Int, parseInt(identifier))
        .query('SELECT * FROM Medico WHERE Matricula = @id');
    }

    if (result.recordset.length > 0) {
      res.json({ success: true, user: result.recordset[0], role });
    } else {
      res.status(401).json({ success: false, message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Units
app.get("/api/units", async (req, res) => {
  try {
    const pool = await getDbConnection();
    const result = await pool.request().query('SELECT * FROM UnidadMedica');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Patient Dashboard Data
app.get("/api/patient/:nss/dashboard", async (req, res) => {
  const { nss } = req.params;
  try {
    const pool = await getDbConnection();
    
    // Next Appointment
    const appointments = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT TOP 1 c.*, u.Nombre as UnidadNombre, cons.especialidad 
        FROM Cita c
        JOIN UnidadMedica u ON c.id_unidad = u.id_unidad
        JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
        WHERE c.NSS = @nss AND c.fecha_hora >= GETDATE()
        ORDER BY c.fecha_hora ASC
      `);

    // Recent Prescriptions (Medicines)
    // Note: The schema has Tiene (id_medicamento, id_receta) and Receta(id_receta, fecha)
    // We need to link this to the patient. Cita has NSS. Consulta has id_receta and id_consultorio.
    // Let's find Consulta by Cita's datetime/consultorio/NSS (approx) or assume Consulta links to Receta.
    // Actually, Consulta has id_receta. We can find Consultas for a doctor, but for a patient?
    // Let's look for Consultas where the doctor (Matricula) saw the patient (NSS).
    // Wait, the schema doesn't have NSS in Consulta. It has id_consultorio and fecha_hora.
    // Cita has NSS, id_consultorio, fecha_hora. They should match.
    
    const prescriptions = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT m.nombre, t.dosis, t.frecuencia, t.duracion, r.fecha
        FROM Receta r
        JOIN Tiene t ON r.id_receta = t.id_receta
        JOIN Medicamento m ON t.id_medicamento = m.id_medicamento
        JOIN Consulta co ON r.id_receta = co.id_receta
        JOIN Cita ci ON (ci.id_consultorio = co.id_consultorio AND ci.fecha_hora = co.fecha_hora)
        WHERE ci.NSS = @nss
        ORDER BY r.fecha DESC
      `);

    // Assigned Unit
    const patientUnit = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT u.* 
        FROM Paciente p
        JOIN UnidadMedica u ON p.id_unidad = u.id_unidad
        WHERE p.NSS = @nss
      `);

    res.json({
      nextAppointment: appointments.recordset[0],
      prescriptions: prescriptions.recordset,
      assignedUnit: patientUnit.recordset[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Create Appointment
app.post("/api/appointments", async (req, res) => {
  const { fecha_hora, id_consultorio, NSS, id_unidad, motivo } = req.body;
  try {
    const pool = await getDbConnection();
    await pool.request()
      .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
      .input('id_consultorio', sql.Int, id_consultorio)
      .input('NSS', sql.Int, NSS)
      .input('id_unidad', sql.Int, id_unidad)
      .input('motivo', sql.VarChar(50), motivo)
      .query('INSERT INTO Cita (fecha_hora, id_consultorio, NSS, id_unidad, motivo) VALUES (@fecha_hora, @id_consultorio, @NSS, @id_unidad, @motivo)');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Consultations for Doctor
app.get("/api/doctor/:matricula/appointments", async (req, res) => {
  const { matricula } = req.params;
  try {
    const pool = await getDbConnection();
    // In this schema, Cita doesn't have Matricula directly.
    // But Medico has id_unidad. A doctor works at a unit.
    // For simplicity, let's say a doctor sees appointments in their unit that match their specialty.
    const result = await pool.request()
      .input('matricula', sql.Int, parseInt(matricula))
      .query(`
        SELECT c.*, p.primer_nombre, p.primer_apellido, cons.especialidad
        FROM Cita c
        JOIN Paciente p ON c.NSS = p.NSS
        JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
        JOIN Medico m ON m.especialidad = cons.especialidad AND m.id_unidad = c.id_unidad
        WHERE m.Matricula = @matricula
        ORDER BY c.fecha_hora ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Vite middleware and fallbacks
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
