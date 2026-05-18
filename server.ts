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

// Get Available Slots
app.get("/api/available-slots", async (req, res) => {
  const { id_unidad, fecha } = req.query;
  if (!id_unidad || !fecha) {
    return res.status(400).json({ success: false, message: "Missing required parameters" });
  }

  try {
    const pool = await getDbConnection();
    
    // Query Agenda_Horarios for available slots on the specific date and unit
    const dateStart = new Date(fecha as string);
    dateStart.setHours(0,0,0,0);
    const dateEnd = new Date(fecha as string);
    dateEnd.setHours(23,59,59,999);

    const result = await pool.request()
      .input('id_unidad', sql.Int, parseInt(id_unidad as string))
      .input('dateStart', sql.DateTime2, dateStart)
      .input('dateEnd', sql.DateTime2, dateEnd)
      .query(`
        SELECT fecha_hora, id_consultorio 
        FROM Agenda_Horarios 
        WHERE id_unidad = @id_unidad 
        AND estado = 'Disponible'
        AND fecha_hora BETWEEN @dateStart AND @dateEnd
        ORDER BY fecha_hora ASC
      `);

    const slots = result.recordset.map(r => {
      const obj: any = {};
      Object.keys(r).forEach(key => {
        obj[key.toLowerCase()] = r[key];
      });
      return {
        time: obj.fecha_hora,
        id_consultorio: obj.id_consultorio
      };
    });

    res.json(slots);
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

// Register Patient
app.post("/api/auth/register", async (req, res) => {
  const { 
    nss, 
    primer_nombre, 
    primer_apellido, 
    segundo_apellido, 
    fecha_nacimiento, 
    sexo, 
    calle, 
    colonia, 
    cp, 
    id_unidad 
  } = req.body;

  try {
    const pool = await getDbConnection();
    
    // Check if NSS already exists
    const checkUser = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query('SELECT NSS FROM Paciente WHERE NSS = @nss');
    
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "El NSS ya está registrado." });
    }

    await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .input('p_nom', sql.VarChar(50), primer_nombre)
      .input('p_ape', sql.VarChar(50), primer_apellido)
      .input('s_ape', sql.VarChar(50), segundo_apellido || '')
      .input('fecha', sql.Date, new Date(fecha_nacimiento))
      .input('sexo', sql.Char(1), sexo)
      .input('calle', sql.VarChar(100), calle)
      .input('colonia', sql.VarChar(100), colonia)
      .input('cp', sql.Int, parseInt(cp))
      .input('id_u', sql.Int, parseInt(id_unidad))
      .query(`
        INSERT INTO Paciente (NSS, Primer_Nombre, Primer_Apellido, Segundo_Apellido, Fecha_Nacimiento, Sexo, Calle, Colonia, CP, id_unidad)
        VALUES (@nss, @p_nom, @p_ape, @s_ape, @fecha, @sexo, @calle, @colonia, @cp, @id_u)
      `);

    res.json({ success: true, message: "Registro exitoso" });
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
    
    // Upcoming Appointments
    const appointmentsResult = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT c.*, u.Nombre as UnidadNombre, cons.especialidad 
        FROM Cita c
        JOIN UnidadMedica u ON c.id_unidad = u.id_unidad
        LEFT JOIN Consultorio cons ON c.id_consultorio = cons.id_consultorio
        WHERE c.NSS = @nss AND c.fecha_hora >= GETDATE()
        ORDER BY c.fecha_hora ASC
      `);

    const upcomingAppointments = appointmentsResult.recordset.map(apt => {
      const obj: any = {};
      Object.keys(apt).forEach(key => {
        obj[key.toLowerCase()] = apt[key];
      });
      obj.unidadnombre = apt.UnidadNombre;
      return obj;
    });

    // Recent Prescriptions - Robust query that works even if NSS is in Cita or directly in Receta
    // We try to find recipes linked via Cita/Consulta OR direct NSS link if column exists
    const prescriptionsResult = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query(`
        SELECT DISTINCT m.nombre, t.dosis, t.frecuencia, t.duracion, r.fecha, r.id_receta
        FROM Receta r
        JOIN Tiene t ON r.id_receta = t.id_receta
        JOIN Medicamento m ON t.id_medicamento = m.id_medicamento
        LEFT JOIN Consulta co ON r.id_receta = co.id_receta
        LEFT JOIN Cita ci ON (ci.id_consultorio = co.id_consultorio AND ci.fecha_hora = co.fecha_hora)
        WHERE ci.NSS = @nss OR (EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Receta') AND name = 'NSS') AND EXISTS (SELECT 1 FROM Receta WHERE id_receta = r.id_receta AND NSS = @nss))
        ORDER BY r.fecha DESC
      `).catch(async () => {
        // Fallback if the complex EXISTS check fails or if we want simplified logic
        return await pool.request()
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
      });

    const prescriptions = prescriptionsResult.recordset.map((r: any) => {
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
      upcomingAppointments,
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

// Get Patient for Doctor Search
app.get("/api/patient/search/:nss", async (req, res) => {
  const { nss } = req.params;
  try {
    const pool = await getDbConnection();
    const result = await pool.request()
      .input('nss', sql.Int, parseInt(nss))
      .query('SELECT NSS, primer_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, sexo FROM Paciente WHERE NSS = @nss');
    
    if (result.recordset.length > 0) {
      const patient: any = {};
      Object.keys(result.recordset[0]).forEach(key => {
        patient[key.toLowerCase()] = result.recordset[0][key];
      });
      res.json({ success: true, patient });
    } else {
      res.status(404).json({ success: false, message: "Paciente no encontrado" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Create Prescription and Consultation
app.post("/api/doctor/prescribe", async (req, res) => {
  const { nss, matricula, id_consultorio, fecha_hora, diagnosis, medicines } = req.body;
  
  try {
    const pool = await getDbConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Create Receta (Assigning NSS directly if column exists, otherwise we rely on Consulta)
      // I'll try to insert NSS into Receta if the user wants "assigned to NSS"
      const recetaResult = await transaction.request()
        .input('fecha', sql.DateTime2, new Date())
        .input('nss', sql.Int, parseInt(nss))
        .query('INSERT INTO Receta (fecha, NSS) OUTPUT INSERTED.id_receta VALUES (@fecha, @nss)');
      
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

      // 3. Create Consulta linked to Cita and Receta (Only if appointment info is present)
      if (id_consultorio && fecha_hora) {
        await transaction.request()
          .input('id_consultorio', sql.Int, id_consultorio)
          .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
          .input('id_receta', sql.Int, id_receta)
          .input('matricula', sql.Int, matricula)
          .query('INSERT INTO Consulta (id_consultorio, fecha_hora, id_receta, Matricula) VALUES (@id_consultorio, @fecha_hora, @id_receta, @matricula)');
      }

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
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert into Cita
      await transaction.request()
        .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
        .input('id_consultorio', sql.Int, id_consultorio)
        .input('NSS', sql.Int, nss)
        .input('id_unidad', sql.Int, parseInt(id_unidad))
        .input('motivo', sql.VarChar(50), motivo)
        .query('INSERT INTO Cita (fecha_hora, id_consultorio, NSS, id_unidad, motivo) VALUES (@fecha_hora, @id_consultorio, @NSS, @id_unidad, @motivo)');

      // 2. Update Agenda_Horarios
      await transaction.request()
        .input('fecha_hora', sql.DateTime2, new Date(fecha_hora))
        .input('id_consultorio', sql.Int, id_consultorio)
        .input('id_unidad', sql.Int, parseInt(id_unidad))
        .query(`
          UPDATE Agenda_Horarios 
          SET estado = 'Ocupado' 
          WHERE fecha_hora = @fecha_hora 
          AND id_consultorio = @id_consultorio 
          AND id_unidad = @id_unidad
        `);

      await transaction.commit();
      res.json({ success: true });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
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
