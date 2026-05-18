import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  FileText, 
  UserCircle, 
  Settings, 
  HelpCircle, 
  LogOut,
  Bell,
  Search,
  PlusCircle,
  History,
  Trash2,
  ChevronRight,
  Info,
  QrCode
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Interfaces
interface User {
  NSS?: number;
  Matricula?: number;
  primer_nombre: string;
  primer_apellido: string;
}

interface AppState {
  user: User | null;
  role: 'patient' | 'doctor' | null;
  page: 'dashboard' | 'schedule' | 'consultation' | 'login';
}

// Current User Context (Simplistic for the demo)
const AppContext = React.createContext<{
  state: AppState;
  dispatch: React.Dispatch<any>;
} | null>(null);

// Sidebar Component
const Sidebar = () => {
  const context = React.useContext(AppContext);
  if (!context) return null;
  const { state, dispatch } = context;

  const items = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'schedule', label: 'Citas', icon: CalendarDays },
    { id: 'recetas', label: 'Recetas', icon: FileText },
    { id: 'expediente', label: 'Expediente', icon: UserCircle },
    { id: 'config', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-16 h-[calc(100vh-64px)] w-72 p-8 z-40 bg-white border-r border-slate-200">
      <nav className="flex flex-col gap-2 flex-grow">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => dispatch({ type: 'SET_PAGE', payload: item.id === 'schedule' ? 'schedule' : 'dashboard' })}
            className={cn(
              "flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-wider",
              (state.page === item.id || (state.page === 'dashboard' && item.id === 'dashboard'))
                ? "bg-green-50 text-[#1b5e20]" 
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-slate-100 pt-8 flex flex-col gap-2">
        <button className="flex items-center gap-4 text-slate-400 px-4 py-3 hover:bg-slate-50 hover:text-slate-800 transition-all font-bold text-xs uppercase tracking-wider">
          <HelpCircle className="w-5 h-5" />
          Ayuda
        </button>
        <button 
          onClick={() => dispatch({ type: 'LOGOUT' })}
          className="flex items-center gap-4 text-slate-400 px-4 py-3 hover:bg-slate-50 hover:text-slate-800 transition-all font-bold text-xs uppercase tracking-wider"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

// TopBar Component
const TopBar = () => {
  const context = React.useContext(AppContext);
  if (!context) return null;
  const { state } = context;

  return (
    <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16 w-full bg-white border-b border-slate-200">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#1b5e20] rounded-lg flex items-center justify-center">
            <div className="text-white font-bold text-xl uppercase">I</div>
        </div>
        <div>
            <h1 className="text-lg font-bold tracking-tight text-[#1b5e20]">IMSS Digital</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Seguridad Social Digital</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {state.user && (
          <div className="hidden md:flex items-center gap-4 pl-6 border-l border-slate-200">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">
                 {state.user.primer_nombre} {state.user.primer_apellido}
              </p>
              <p className="text-xs text-slate-400">
                {state.role === 'patient' ? `NSS: ${state.user.NSS}` : `Matrícula: ${state.user.Matricula}`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
              {(state.user.primer_nombre?.[0] || 'U')}{(state.user.primer_apellido?.[0] || '')}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// Login Page
const LoginPage = () => {
  const context = React.useContext(AppContext);
  const [loading, setLoading] = React.useState(false);
  const [identifier, setIdentifier] = React.useState('');
  const [role, setRole] = React.useState<'patient' | 'doctor'>('patient');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, role }),
      });
      const data = await response.json();
      if (data.success) {
        context?.dispatch({ type: 'LOGIN', payload: { user: data.user, role: data.role } });
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px]"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 bg-[#1b5e20] rounded-2xl flex items-center justify-center mb-6 text-white text-3xl font-bold">I</div>
          <h1 className="text-3xl font-bold text-[#1b5e20] tracking-tight mb-1">IMSS Digital</h1>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Portal de Salud Institucional</p>
        </div>

        <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
          <div className="flex gap-4 mb-8">
             <button 
                onClick={() => setRole('patient')}
                className={cn("flex-1 py-3 text-xs font-bold uppercase rounded-xl border transition-all", role === 'patient' ? "bg-[#1b5e20] text-white border-[#1b5e20]" : "border-slate-200 text-slate-400 hover:border-slate-300")}
             >
                Paciente
             </button>
             <button 
                onClick={() => setRole('doctor')}
                className={cn("flex-1 py-3 text-xs font-bold uppercase rounded-xl border transition-all", role === 'doctor' ? "bg-[#1b5e20] text-white border-[#1b5e20]" : "border-slate-200 text-slate-400 hover:border-slate-300")}
             >
                Médico
             </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-wider">{role === 'patient' ? 'NSS' : 'Matrícula'}</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={`Ingresa tu ${role === 'patient' ? 'NSS' : 'Matrícula'}`}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm font-medium"
                  required
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-wider">Contraseña</label>
                <a href="#" className="text-[10px] font-bold text-[#1b5e20] hover:underline uppercase tracking-wider">¿La olvidaste?</a>
              </div>
              <input 
                type="password" 
                defaultValue="password123"
                className="w-full px-4 py-4 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm font-medium"
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#1b5e20] text-white py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-green-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-sm"
            >
              {loading ? "Iniciando sesión..." : "Ingresar al Portal"}
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-300 font-bold uppercase">O</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>
            <button type="button" className="w-full bg-white border border-slate-200 text-slate-600 py-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all">
              Crear cuenta nueva
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// Patient Dashboard
const PatientDashboard = () => {
  const context = React.useContext(AppContext);
  const [data, setData] = React.useState<any>(null);

  React.useEffect(() => {
    const nss = context?.state.user?.NSS;
    if (nss) {
      fetch(`/api/patient/${nss}/dashboard`)
        .then(res => res.json())
        .then(setData);
    }
  }, [context?.state.user?.NSS]);

  if (!data) return <div className="p-12 text-center text-[#1b5e20] font-bold uppercase tracking-widest animate-pulse text-xs">Sincronizando Expediente...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hola, {context?.state.user?.primer_nombre}</h1>
          <p className="text-sm text-slate-400 font-medium">Bienvenido a tu portal de salud IMSS Digital.</p>
        </div>
        <button 
          onClick={() => context?.dispatch({ type: 'SET_PAGE', payload: 'schedule' })}
          className="bg-[#1b5e20] text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-green-800 transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Agendar Cita
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Next Appointment Card */}
        <section className="md:col-span-8 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            <p className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest">Próxima Cita</p>
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#1b5e20]">
                    <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-sm font-bold text-slate-900">
                     {data.nextAppointment ? new Date(data.nextAppointment.fecha_hora).toLocaleDateString([], { month: 'long', day: 'numeric' }) : "Sin citas"}
                   </p>
                   <p className="text-xs text-slate-400 font-medium">
                     {data.nextAppointment ? new Date(data.nextAppointment.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Ver calendario"}
                   </p>
                </div>
            </div>
            {data.nextAppointment ? (
                <div className="mt-4 pt-4 border-t border-slate-50 space-y-3">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Especialidad</p>
                        <p className="text-sm font-bold text-slate-800">{data.nextAppointment.especialidad}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Unidad</p>
                        <p className="text-sm font-bold text-slate-800">{data.nextAppointment.UnidadNombre}</p>
                    </div>
                    <button className="w-full mt-4 py-2 bg-[#1b5e20] text-white text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-green-800 transition-all">Ver Detalles</button>
                </div>
            ) : (
                <div className="mt-4 pt-4 border-t border-slate-50 flex-1 flex items-center justify-center text-xs text-slate-300 italic">No tienes citas programadas.</div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col gap-6 pl-0 md:pl-8 border-l border-none md:border-slate-50">
             <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Consultas 2024</p>
                    <p className="text-xl font-bold text-slate-900">04</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Recetas Activas</p>
                    <p className="text-xl font-bold text-slate-900">01</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Unidad</p>
                    <p className="text-xl font-bold text-[#1b5e20] uppercase">{data.assignedUnit?.Nombre || "--"}</p>
                </div>
             </div>
             <div className="flex-1 bg-green-50 rounded-2xl p-6 flex flex-col justify-center items-start">
                <h3 className="text-sm font-bold text-[#1b5e20] mb-2">Asistencia Virtual</h3>
                <p className="text-[11px] text-[#1b5e20]/70 font-medium leading-relaxed mb-4">Resuelve dudas sobre tus trámites y vigencia de derechos sin salir de casa.</p>
                <button className="bg-white text-[#1b5e20] px-6 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-green-50 transition-all">Iniciar Chat</button>
             </div>
          </div>
        </section>

        {/* PreventIMSS Card */}
        <section className="md:col-span-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <p className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest mb-6">Seguimiento Preventivo</p>
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl mb-8">
             <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
                    <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 0.75)} className="text-[#1b5e20] transition-all duration-1000" />
                </svg>
                <span className="absolute text-xl font-bold text-slate-900">75%</span>
             </div>
             <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase">Estado General</p>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800">Check-up General</span>
                <span className="px-2 py-0.5 bg-green-50 text-[#1b5e20] rounded text-[9px] font-bold uppercase tracking-widest">Finalizado</span>
            </div>
            <button className="w-full mt-4 bg-[#1b5e20] text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-green-800 transition-all shadow-sm">
              Ver Plan Preventivo
            </button>
          </div>
        </section>

        {/* Recent Prescriptions */}
        <section className="md:col-span-12 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
           <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-[#1b5e20]" />
                 Historial de Recetas
              </h3>
              <div className="flex gap-2">
                 <span className="px-3 py-1 bg-green-50 rounded-full text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest">Vigentes</span>
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-50">
                    <tr>
                       <th className="py-4 px-8">Medicamento / Dosis</th>
                       <th className="py-4 px-8">Frecuencia</th>
                       <th className="py-4 px-8 text-center">Estado</th>
                       <th className="py-4 px-8 text-right">Vencimiento</th>
                    </tr>
                 </thead>
                 <tbody className="text-sm text-slate-600 font-medium divide-y divide-slate-50">
                    {data.prescriptions.length > 0 ? data.prescriptions.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-6 px-8">
                                <div>
                                    <p className="font-bold text-slate-900">{p.nombre}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{p.dosis}</p>
                                </div>
                            </td>
                            <td className="py-6 px-8 text-sm">{p.frecuencia}</td>
                            <td className="py-6 px-8 text-center">
                                <span className="px-3 py-1 bg-green-50 text-[#1b5e20] rounded-full text-[9px] font-bold uppercase tracking-widest">Vigente</span>
                            </td>
                            <td className="py-6 px-8 text-right text-xs text-slate-400 font-bold">
                                {new Date(new Date(p.fecha).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                            </td>
                        </tr>
                    )) : (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-300 italic text-sm">No hay registros de medicamentos.</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
           <div className="p-4 bg-slate-50 text-[10px] text-center text-slate-400 uppercase tracking-widest font-bold">
               Presenta tu Carnet y Código QR en la farmacia de tu unidad
           </div>
        </section>
      </div>
    </div>
  );
};

// Schedule Appointment Page
const ScheduleAppointment = () => {
  const context = React.useContext(AppContext);
  const [units, setUnits] = React.useState<any[]>([]);
  const [selectedUnit, setSelectedUnit] = React.useState<any>(null);
  const [specialties, setSpecialties] = React.useState<string[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState<string>("");
  const [availableSlots, setAvailableSlots] = React.useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = React.useState<any>(null);
  const [step, setStep] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/units')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUnits(data);
        else console.error("Units is not an array:", data);
      })
      .catch(err => console.error("Error fetching units:", err));
  }, []);

  React.useEffect(() => {
    if (selectedUnit && selectedUnit.id_unidad) {
      fetch(`/api/units/${selectedUnit.id_unidad}/specialties`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSpecialties(data);
          else {
            console.error("Specialties is not an array:", data);
            setSpecialties([]);
          }
        })
        .catch(err => {
          console.error("Error fetching specialties:", err);
          setSpecialties([]);
        });
    }
  }, [selectedUnit]);

  React.useEffect(() => {
    if (selectedUnit && selectedUnit.id_unidad && selectedSpecialty && selectedDate) {
      fetch(`/api/available-slots?id_unidad=${selectedUnit.id_unidad}&especialidad=${selectedSpecialty}&fecha=${selectedDate}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAvailableSlots(data);
          else {
             console.error("Slots is not an array:", data);
             setAvailableSlots([]);
          }
        })
        .catch(err => {
          console.error("Error fetching slots:", err);
          setAvailableSlots([]);
        });
    }
  }, [selectedUnit, selectedSpecialty, selectedDate]);

  const handleNext = () => {
    if (step === 3 && selectedSlot) {
      handleConfirm();
    } else {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_hora: selectedSlot.time,
          id_consultorio: selectedSlot.id_consultorio,
          NSS: context?.state.user?.NSS,
          id_unidad: selectedUnit.id_unidad,
          motivo: 'Consulta general agendada desde portal digital'
        })
      });
      const data = await res.json();
      if (data.success) {
        context?.dispatch({ type: 'SET_PAGE', payload: 'dashboard' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Agendar Nueva Cita</h1>
        <p className="text-sm text-slate-400 font-medium">Complete los pasos para solicitar su atención médica.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Progress Indicator */}
          <div className="bg-white border border-slate-200 p-6 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase transition-all", step >= 1 ? "bg-[#1b5e20] text-white" : "bg-slate-100 text-slate-400")}>1</span>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest hidden sm:inline", step >= 1 ? "text-[#1b5e20]" : "text-slate-400")}>Unidad</span>
            </div>
            <div className="h-px flex-1 mx-4 bg-slate-100"></div>
            <div className="flex items-center gap-2">
              <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase transition-all", step >= 2 ? "bg-[#1b5e20] text-white" : "bg-slate-100 text-slate-400")}>2</span>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest hidden sm:inline", step >= 2 ? "text-[#1b5e20]" : "text-slate-400")}>Especialidad</span>
            </div>
            <div className="h-px flex-1 mx-4 bg-slate-100"></div>
            <div className="flex items-center gap-2">
              <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase transition-all", step >= 3 ? "bg-[#1b5e20] text-white" : "bg-slate-100 text-slate-400")}>3</span>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest hidden sm:inline", step >= 3 ? "text-[#1b5e20]" : "text-slate-400")}>Fecha</span>
            </div>
          </div>

          {step === 1 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">Seleccione su Unidad Médica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray(units) && units.map(unit => (
                  <button 
                    key={unit.id_unidad}
                    onClick={() => setSelectedUnit(unit)}
                    className={cn(
                      "flex flex-col text-left p-6 border-2 rounded-2xl transition-all",
                      selectedUnit?.id_unidad === unit.id_unidad ? "border-[#1b5e20] bg-green-50" : "border-slate-50 hover:bg-slate-50"
                    )}
                  >
                    <span className="text-[10px] font-bold text-green-600 mb-1 uppercase tracking-tighter">{unit.tipo}</span>
                    <span className="text-lg font-bold text-slate-900">{unit.Nombre}</span>
                    <span className="text-xs text-slate-400 mt-1 font-medium">{unit.calle}, {unit.colonia}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">Elija la Especialidad y Fecha</h2>
              <div className="space-y-6">
                 <div>
                    <label className="block text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest mb-3">Especialidad Requerida</label>
                    <select 
                      value={selectedSpecialty}
                      onChange={(e) => setSelectedSpecialty(e.target.value)}
                      className="w-full h-14 px-4 border-none bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-100 font-bold text-sm text-slate-700"
                    >
                        <option value="">Seleccione una especialidad...</option>
                        {Array.isArray(specialties) && specialties.map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest mb-3">Fecha de Consulta (Lunes a Viernes)</label>
                    <input 
                      type="date"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full h-14 px-6 border-none bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-green-100 font-bold text-sm text-slate-700"
                    />
                 </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-6 tracking-tight">Seleccione su Horario</h2>
              {Array.isArray(availableSlots) && availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "py-3 rounded-xl font-bold text-xs transition-all border-2",
                        selectedSlot?.time === slot.time 
                          ? "bg-[#1b5e20] text-white border-[#1b5e20]" 
                          : "bg-white text-slate-600 border-slate-100 hover:border-green-200"
                      )}
                    >
                      {new Date(slot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center bg-slate-50 rounded-2xl">
                   {(!selectedSpecialty || !selectedDate) 
                     ? <p className="text-slate-400 text-xs italic">Complete el paso anterior para ver horarios.</p>
                     : <div className="space-y-2">
                        <p className="text-slate-900 font-bold text-sm">No hay horarios disponibles.</p>
                        <p className="text-slate-400 text-[10px] uppercase">Intente con otra fecha o especialidad.</p>
                       </div>
                   }
                </div>
              )}
            </section>
          )}

          <div className="flex justify-between items-center pt-4">
             <button 
              onClick={() => step === 1 ? context?.dispatch({ type: 'SET_PAGE', payload: 'dashboard' }) : setStep(s => s - 1)}
              className="px-8 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-800 transition-all"
             >
                {step === 1 ? 'Cancelar' : 'Regresar'}
             </button>
             <button 
              onClick={handleNext}
              disabled={
                (step === 1 && !selectedUnit) || 
                (step === 2 && (!selectedSpecialty || !selectedDate)) ||
                (step === 3 && !selectedSlot) ||
                submitting
              }
              className="px-8 py-3 bg-[#1b5e20] text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-sm hover:bg-green-800 disabled:opacity-50 transition-all"
             >
                {step === 3 ? (submitting ? 'Reservando...' : 'Confirmar Cita') : 'Siguiente Paso'}
             </button>
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="sticky top-24 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-50">
               <h3 className="font-bold text-slate-800">Resumen de Cita</h3>
            </div>
            <div className="p-6 space-y-6">
               <div className="border-b border-slate-50 pb-6">
                  <p className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest mb-1">Derechohabiente</p>
                  <p className="font-bold text-slate-900">{context?.state.user?.primer_nombre} {context?.state.user?.primer_apellido}</p>
                  <p className="text-xs text-slate-400 font-medium">NSS: {context?.state.user?.NSS}</p>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-start">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Unidad</p>
                        <p className="text-sm font-bold text-slate-900">{selectedUnit?.Nombre || "Pendiente"}</p>
                     </div>
                     {selectedUnit && <span className="text-[#1b5e20] bg-green-50 p-1 rounded-lg"><PlusCircle className="w-4 h-4" /></span>}
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Especialidad</p>
                     <p className="text-sm font-bold text-slate-900">{selectedSpecialty || "Pendiente"}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Fecha y Hora</p>
                     <p className="text-sm font-bold text-slate-900">
                        {selectedSlot 
                          ? `${new Date(selectedSlot.time).toLocaleDateString()} ${new Date(selectedSlot.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
                          : (selectedDate ? `${selectedDate} (Elegir hora)` : "No seleccionado")
                        }
                     </p>
                  </div>
               </div>
               <div className="mt-4 p-4 bg-slate-50 rounded-2xl flex gap-3 items-center">
                  <Info className="w-5 h-5 text-slate-400" />
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Presentarse con carnet original 15 min antes.</p>
               </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// Doctor Consultation Page (The one from the image)
const DoctorConsultation = () => {
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const context = React.useContext(AppContext);

  React.useEffect(() => {
    const matricula = context?.state.user?.Matricula;
    if (matricula) {
      fetch(`/api/doctor/${matricula}/appointments`)
        .then(res => res.json())
        .then(setAppointments);
    }
  }, [context?.state.user?.Matricula]);

  const selectedPatient = appointments[0] || null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-[#1b5e20] tracking-tight">Evaluación Médica</h1>
        <p className="text-sm text-slate-400 font-medium">Bienvenido, Dr. {context?.state.user?.primer_apellido}. Expediente digital abierto.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Agenda */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800">Agenda Activa</h2>
            <span className="bg-green-50 text-[#1b5e20] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Hoy</span>
          </div>
          <div className="divide-y divide-slate-50">
            {appointments.map((apt, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "p-6 transition-all",
                  idx === 0 ? "bg-slate-50 border-l-4 border-[#1b5e20]" : "hover:bg-slate-50 cursor-pointer"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn("text-[9px] font-bold uppercase tracking-widest", idx === 0 ? "text-[#1b5e20]" : "text-slate-400")}>
                    {new Date(apt.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {idx === 0 ? 'EN CONSULTA' : 'PROGRAMADA'}
                  </span>
                </div>
                <p className="font-bold text-slate-900">{apt.primer_nombre} {apt.primer_apellido}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">NSS: {apt.NSS}</p>
              </div>
            ))}
          </div>
          <button className="w-full py-4 text-[#1b5e20] font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all border-t border-slate-50">
            Ver Calendario Completo
          </button>
        </section>

        {/* Right Column: Consultation Detail */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {selectedPatient ? (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 text-xl font-bold">
                    {selectedPatient.primer_nombre[0]}{selectedPatient.primer_apellido[0]}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedPatient.primer_nombre} {selectedPatient.primer_apellido}</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">NSS: {selectedPatient.NSS} • 45 AÑOS • MASCULINO</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 bg-[#1b5e20] text-white px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-800 transition-all shadow-sm">
                  <History className="w-4 h-4" /> Historial
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Peso</p>
                  <p className="text-xl font-bold text-slate-900">82 kg</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Talla</p>
                  <p className="text-xl font-bold text-slate-900">1.78 m</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Presión</p>
                  <p className="text-xl font-bold text-slate-900">120/80</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Temperatura</p>
                  <p className="text-xl font-bold text-slate-900">36.5°C</p>
                </div>
              </div>

              <form className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest mb-4">Nota Médica / Diagnóstico</label>
                  <textarea 
                    className="w-full bg-slate-50 border-none rounded-2xl p-6 min-h-[160px] focus:ring-2 focus:ring-green-100 outline-none transition-all text-sm font-medium placeholder:text-slate-300"
                    placeholder="Redacte el diagnóstico clínico detallado..."
                  ></textarea>
                </div>

                <div>
                   <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-bold text-[#1b5e20] uppercase tracking-widest">Tratamiento Recomendado</label>
                      <button type="button" className="text-[#1b5e20] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:underline">
                        <PlusCircle className="w-4 h-4" /> Añadir Medicamento
                      </button>
                   </div>
                   <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                         <thead className="bg-slate-50 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            <tr>
                               <th className="py-4 px-6">Medicamento</th>
                               <th className="py-4 px-6">Dosis</th>
                               <th className="py-4 px-6">Frecuencia</th>
                               <th className="py-4 px-6"></th>
                            </tr>
                         </thead>
                         <tbody className="text-sm text-slate-600 font-medium divide-y divide-slate-50">
                            <tr className="hover:bg-slate-50 transition-colors">
                               <td className="py-6 px-6 font-bold text-slate-900">Paracetamol 500mg</td>
                               <td className="py-6 px-6">1 Tableta</td>
                               <td className="py-6 px-6">Cada 8 hrs / 3 días</td>
                               <td className="py-6 px-6 text-right"><button className="text-slate-300 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button></td>
                            </tr>
                            <tr className="bg-white">
                               <td className="py-6 px-6"><input className="w-full bg-transparent border-none p-0 outline-none placeholder:text-slate-200 text-xs font-medium" placeholder="Especifique medicina..." /></td>
                               <td className="py-6 px-6"><input className="w-full bg-transparent border-none p-0 outline-none placeholder:text-slate-200 text-xs font-medium" placeholder="Cantidad..." /></td>
                               <td className="py-6 px-6"><input className="w-full bg-transparent border-none p-0 outline-none placeholder:text-slate-200 text-xs font-medium" placeholder="Horario..." /></td>
                               <td className="py-6 px-6"></td>
                            </tr>
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="flex flex-col md:flex-row justify-end gap-4 pt-8 border-t border-slate-50">
                  <button type="button" className="px-8 py-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-slate-800 transition-all">
                    Borrador
                  </button>
                  <button type="submit" className="px-10 py-3 bg-[#1b5e20] text-white font-bold uppercase text-[10px] tracking-widest rounded-xl shadow-sm hover:bg-green-800 transition-all">
                    Firmar y Finalizar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="p-12 text-center text-slate-300 italic text-sm">Seleccione un paciente de la agenda para iniciar la consulta.</div>
          )}
        </section>
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [state, dispatch] = React.useReducer((state: AppState, action: any) => {
    switch (action.type) {
      case 'LOGIN':
        return { 
          ...state, 
          user: action.payload.user, 
          role: action.payload.role, 
          page: action.payload.role === 'doctor' ? 'consultation' : 'dashboard' 
        };
      case 'LOGOUT':
        return { ...state, user: null, role: null, page: 'login' };
      case 'SET_PAGE':
        return { ...state, page: action.payload };
      default:
        return state;
    }
  }, {
    user: null,
    role: null,
    page: 'login'
  });

  const renderPage = () => {
    if (!state.user) return <LoginPage />;
    
    switch (state.page) {
      case 'dashboard':
        return <PatientDashboard />;
      case 'schedule':
        return <ScheduleAppointment />;
      case 'consultation':
        return <DoctorConsultation />;
      default:
        return <PatientDashboard />;
    }
  };

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <div className="min-h-screen flex flex-col">
        {state.user && <TopBar />}
        <div className="flex flex-1">
          {state.user && <Sidebar />}
          <main className={cn("flex-1 p-6 md:p-12", state.user && "lg:ml-64")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={state.page}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
        
        <footer className="w-full py-8 px-8 mt-auto border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start">
              <span className="font-bold text-[#1b5e20] text-lg tracking-tight">IMSS Digital</span>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">© 2024 Instituto Mexicano del Seguro Social</p>
            </div>
            <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               <a href="#" className="hover:text-[#1b5e20] transition-colors">Aviso de Privacidad</a>
               <a href="#" className="hover:text-[#1b5e20] transition-colors">Términos de Uso</a>
               <a href="#" className="hover:text-[#1b5e20] transition-colors">Contacto</a>
            </div>
          </div>
        </footer>
      </div>
    </AppContext.Provider>
  );
}
