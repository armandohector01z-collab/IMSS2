import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

// Get Specialties for a specific unit
app.get("/api/units/:id_unidad/specialties", async (req, res) => {
  const { id_unidad } = req.params;
  const unitId = parseInt(id_unidad);
  if (isNaN(unitId)) return res.status(400).json({ success: false, message: "Invalid unit ID" });

  try {
    const pool = await getDbConnection();
    const result = await pool.request()
      .input('id_unidad', sql.Int, unitId)
      .query('SELECT DISTINCT especialidad FROM Consultorio WHERE id_unidad = @id_unidad');
    
    const specialties = result.recordset.map(r => {
       const key = Object.keys(r).find(k => k.toLowerCase() === 'especialidad');
       return key ? r[key] : null;
    }).filter(s => s !== null);

    res.json(specialties);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Available Slots
app.get("/api/available-slots", async (req, res) => {
  const { id_unidad, especialidad, fecha } = req.query;
  const unitId = parseInt(id_unidad as string);
  if (isNaN(unitId) || !especialidad || !fecha) {
    return res.status(400).json({ success: false, message: "Missing required parameters" });
  }

  try {
    const pool = await getDbConnection();
    
    // 1. Get all consultorios for this specialty in this unit
    const consultoriosResult = await pool.request()
      .input('id_unidad', sql.Int, unitId)
      .input('especialidad', sql.VarChar, especialidad)
      .query('SELECT id_consultorio FROM Consultorio WHERE id_unidad = @id_unidad AND especialidad = @especialidad');
    
    const consultorioIds = consultoriosResult.recordset.map(c => {
       const key = Object.keys(c).find(k => k.toLowerCase() === 'id_consultorio');
       return key ? c[key] : null;
    }).filter(id => id !== null);

    if (consultorioIds.length === 0) return res.json([]);

    // 2. Get existing appointments for these consultorios on this date
    const dateStart = new Date(fecha as string);
    dateStart.setHours(0,0,0,0);
    const dateEnd = new Date(fecha as string);
    dateEnd.setHours(23,59,59,999);

    const appointmentsResult = await pool.request()
      .input('dateStart', sql.DateTime2, dateStart)
      .input('dateEnd', sql.DateTime2, dateEnd)
      .query(`
        SELECT fecha_hora, id_consultorio 
        FROM Cita 
        WHERE id_consultorio IN (${consultorioIds.join(',')})
        AND fecha_hora BETWEEN @dateStart AND @dateEnd
      `);

    // Normalize keys for appointments
    const appointments = appointmentsResult.recordset.map(a => {
       const fhKey = Object.keys(a).find(k => k.toLowerCase() === 'fecha_hora');
       const icKey = Object.keys(a).find(k => k.toLowerCase() === 'id_consultorio');
       return {
         fecha_hora: fhKey ? a[fhKey] : null,
         id_consultorio: icKey ? a[icKey] : null
       };
    }).filter(a => a.fecha_hora && a.id_consultorio);

    // 3. Generate theoretical slots (8:00 AM to 4:00 PM, every 30 mins)
    const availableSlots = [];
    const workStart = 8; // 8 AM
    const workEnd = 16;  // 4 PM

    for (let hour = workStart; hour < workEnd; hour++) {
      for (let min of [0, 30]) {
        const slotTime = new Date(fecha as string);
        slotTime.setHours(hour, min, 0, 0);
        
        // Find which consultorios are free at this exact time
        const busyConsultorios = appointments
          .filter(a => new Date(a.fecha_hora).getTime() === slotTime.getTime())
          .map(a => a.id_consultorio);
        
        const freeConsultorio = consultorioIds.find(id => !busyConsultorios.includes(id));
        
        if (freeConsultorio) {
          availableSlots.push({
            time: slotTime.toISOString(),
            id_consultorio: freeConsultorio
          });
        }
      }
    }

    res.json(availableSlots);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
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
      // Normalize user object
      const user: any = {};
      Object.keys(result.recordset[0]).forEach(key => {
        user[key.toLowerCase()] = result.recordset[0][key];
      });
      res.json({ success: true, user, role });
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
    const result = await pool.request().query('SELECT id_unidad, Nombre, calle, colonia, tipo FROM UnidadMedica');
    
    // Normalize keys to lowercase
    const normalized = result.recordset.map(r => {
      const obj: any = {};
      Object.keys(r).forEach(key => {
        obj[key.toLowerCase()] = r[key];
      });
      return obj;
    });
    
    res.json(normalized);
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
    const appointmentsResult = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT TOP 1 c.*, u.Nombre as UnidadNombre, cons.especialidad 
        FROM Cita c
        JOIN UnidadMedica u ON c.id_unidad = u.id_unidad
        JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
        WHERE c.NSS = @nss AND c.fecha_hora >= GETDATE()
        ORDER BY c.fecha_hora ASC
      `);

    // Normalized next appointment
    const nextAppointment = appointmentsResult.recordset[0] ? (() => {
      const obj: any = {};
      Object.keys(appointmentsResult.recordset[0]).forEach(key => {
        obj[key.toLowerCase()] = appointmentsResult.recordset[0][key];
      });
      // specific mapping for names used in frontend
      obj.UnidadNombre = appointmentsResult.recordset[0].UnidadNombre;
      return obj;
    })() : null;

    // Recent Prescriptions
    const prescriptionsResult = await pool.request()
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

    const prescriptions = prescriptionsResult.recordset.map(r => {
      const obj: any = {};
      Object.keys(r).forEach(key => {
        obj[key.toLowerCase()] = r[key];
      });
      return obj;
    });

    // Assigned Unit
    const patientUnitResult = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT u.* 
        FROM Paciente p
        JOIN UnidadMedica u ON p.id_unidad = u.id_unidad
        WHERE p.NSS = @nss
      `);

    const assignedUnit = patientUnitResult.recordset[0] ? (() => {
      const obj: any = {};
      Object.keys(patientUnitResult.recordset[0]).forEach(key => {
        obj[key.toLowerCase()] = patientUnitResult.recordset[0][key];
      });
      return obj;
    })() : null;

    res.json({
      nextAppointment,
      prescriptions,
      assignedUnit
    });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Get Medicines for search
app.get("/api/medicines", async (req, res) => {
  const { q } = req.query;
  try {
    const pool = await getDbConnection();
    const result = await pool.request()
      .input('query', sql.VarChar, `%${q}%`)
      .query('SELECT TOP 10 * FROM Medicamento WHERE nombre LIKE @query');
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Create Prescription and Consultation
app.post("/api/doctor/prescribe", async (req, res) => {
  const { nss, matricula, id_consultorio, fecha_hora, diagnosis, medicines } = req.body;
  // medicines: [{id_medicamento, dosis, frecuencia, duracion}]
  
  try {
    const pool = await getDbConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Create Receta
      const recetaResult = await transaction.request()
        .input('fecha', sql.DateTime2, new Date())
        .query('INSERT INTO Receta (fecha) OUTPUT INSERTED.id_receta VALUES (@fecha)');
      
      const id_receta = recetaResult.recordset[0].id_receta;

      // 2. Add Medicines (Tiene)
      for (const med of medicines) {
        await transaction.request()
          .input('id_receta', sql.Int, id_receta)
          .input('id_med', sql.Int, med.id_medicamento)
          .input('dosis', sql.VarChar(50), med.dosis)
          .input('frecuencia', sql.VarChar(50), med.frecuencia)
          .input('duracion', sql.VarChar(50), med.duracion || '7 días')
          .query('INSERT INTO Tiene (id_receta, id_medicamento, dosis, frecuencia, duracion) VALUES (@id_receta, @id_med, @dosis, @frecuencia, @duracion)');
      }

      // 3. Create Consulta linked to Cita and Receta
      await transaction.request()
        .input('id_consultorio', sql.Int, id_consultorio)
        .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
        .input('id_receta', sql.Int, id_receta)
        .input('matricula', sql.Int, matricula)
        // Add diagnosis if there's a field for it, otherwise we're just linking
        .query('INSERT INTO Consulta (id_consultorio, fecha_hora, id_receta, Matricula) VALUES (@id_consultorio, @fecha_hora, @id_receta, @matricula)');

      await transaction.commit();
      res.json({ success: true, id_receta });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Create Appointment
app.post("/api/appointments", async (req, res) => {
  const { fecha_hora, id_consultorio, nss, id_unidad, motivo } = req.body;
  try {
    const pool = await getDbConnection();
    await pool.request()
      .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
      .input('id_consultorio', sql.Int, id_consultorio)
      .input('NSS', sql.Int, nss)
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
    
    // Normalize keys to lowercase
    const normalized = result.recordset.map(r => {
      const obj: any = {};
      Object.keys(r).forEach(key => {
        obj[key.toLowerCase()] = r[key];
      });
      return obj;
    });

    res.json(normalized);
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
