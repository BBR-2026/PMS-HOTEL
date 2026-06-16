import { useEffect, useState, useCallback } from "react";
import {
  Users, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Plus,
  Loader2, FileSpreadsheet, FileText, Printer, Trash2, Pencil, X,
  RefreshCw, ClipboardList, BadgeCheck, KeyRound, Copy, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function currentWeekIso() {
  const d = new Date();
  // ISO week — using simple algo (Thursday in current week determines year)
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function shiftWeek(iso, delta) {
  const [y, w] = iso.split("-W").map(Number);
  // Convert to date via ISO week (Thursday)
  const jan4 = new Date(y, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (w - 1) * 7 + delta * 7);
  // Re-compute ISO from new date
  const target = new Date(monday.valueOf());
  target.setDate(target.getDate() + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const newW = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-W${String(newW).padStart(2, "0")}`;
}

export default function StaffPlanning() {
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState("");
  const [weekIso, setWeekIso] = useState(currentWeekIso());
  const [week, setWeek] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hrSummary, setHrSummary] = useState(null);
  const [newEmpModal, setNewEmpModal] = useState(false);

  const loadDepts = useCallback(async () => {
    try {
      const { data } = await api.get("/staff/planning/departments");
      setDepartments(data.items || []);
      if (!deptId && data.items?.length) setDeptId(data.items[0].id);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    }
    try {
      const { data: s } = await api.get("/staff/planning/hr/summary");
      setHrSummary(s);
    } catch {}
  }, [deptId]);

  const loadWeek = useCallback(async () => {
    if (!deptId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/staff/planning/week", {
        params: { dept_id: deptId, week_iso: weekIso },
      });
      setWeek(data);
      setEmployees(data.employees || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement de la semaine");
    } finally {
      setLoading(false);
    }
  }, [deptId, weekIso]);

  useEffect(() => { loadDepts(); }, [loadDepts]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  const toggleCell = async (emp_id, day) => {
    if (!week?.can_edit) {
      toast.error("Lecture seule");
      return;
    }
    const current = week.cells?.[emp_id]?.[day] || "T";
    const next = current === "T" ? "R" : "T";
    // Optimistic update
    setWeek((w) => ({
      ...w,
      cells: { ...w.cells, [emp_id]: { ...(w.cells[emp_id] || {}), [day]: next } },
    }));
    try {
      await api.post("/staff/planning/week/cell", {
        dept_id: deptId, week_iso: weekIso, employee_id: emp_id, day, status: next,
      });
    } catch (err) {
      // Rollback
      setWeek((w) => ({
        ...w,
        cells: { ...w.cells, [emp_id]: { ...(w.cells[emp_id] || {}), [day]: current } },
      }));
      toast.error(err.response?.data?.detail || "Échec de la mise à jour");
    }
  };

  const validateWeek = async () => {
    try {
      await api.post("/staff/planning/week/validate", { dept_id: deptId, week_iso: weekIso });
      toast.success("Planning validé — les RH peuvent désormais le consulter");
      loadDepts();
      loadWeek();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    }
  };

  const addEmployee = async (payload) => {
    try {
      await api.post(`/staff/planning/departments/${deptId}/employees`, payload);
      toast.success("Employé ajouté");
      setNewEmpModal(false);
      loadWeek();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    }
  };

  const deleteEmployee = async (emp_id) => {
    if (!window.confirm("Supprimer cet employé du département ?")) return;
    try {
      await api.delete(`/staff/planning/employees/${emp_id}`);
      toast.success("Employé supprimé");
      loadWeek();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    }
  };

  const downloadFile = async (type) => {
    try {
      const res = await api.get(`/staff/planning/exports/${type}`, {
        params: { dept_id: deptId, week_iso: weekIso },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `planning_${weekIso}.${type === "xlsx" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Échec du téléchargement");
    }
  };

  const dept = departments.find((d) => d.id === deptId);

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl" data-testid="staff-planning">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.32em] text-[#B8922A] mb-1 inline-flex items-center gap-1.5">
            <ClipboardList size={11} /> Planning des équipes
          </div>
          <h1 className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">
            Planning hebdomadaire
          </h1>
          <p className="text-sm text-[#0A0A0A]/60 mt-1">
            Cliquez une cellule pour basculer entre Travail et Repos.
            Validez quand le planning est prêt pour les RH.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/Manuel_Planning_BBr.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#B8922A]/40 hover:bg-[#FAF7F2] text-[0.7rem] uppercase tracking-[0.18em] text-[#B8922A]"
            data-testid="planning-manual-pdf"
            title="Télécharger le manuel de formation (PDF)"
          >
            <FileText size={12} /> Manuel
          </a>
          <button
            onClick={() => { setRefreshing(true); loadDepts(); loadWeek().finally(() => setRefreshing(false)); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/10 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70"
            data-testid="planning-refresh"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} /> Rafraîchir
          </button>
        </div>
      </div>

      {/* HR KPIs (only visible for HR/admin roles by virtue of the endpoint returning 200) */}
      {hrSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="planning-hr-kpis">
          <Kpi label="Départements" value={hrSummary.total_departments} icon={ClipboardList} />
          <Kpi label="Collaborateurs" value={hrSummary.total_employees} icon={Users} />
          <Kpi label="Plannings validés (semaine)" value={hrSummary.validated_count} icon={BadgeCheck} tone="success" />
          <Kpi label="En attente" value={hrSummary.pending_count} icon={Calendar} tone="warning" />
        </div>
      )}

      {/* Department & week selectors */}
      <div className="bg-white border border-[#0A0A0A]/10 p-3 sm:p-4 flex items-center gap-2 flex-wrap">
        <select
          value={deptId}
          onChange={(e) => setDeptId(e.target.value)}
          className="px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white min-w-[200px]"
          data-testid="planning-dept-select"
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.employee_count} {d.current_week_validated ? "✓" : ""}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center bg-white border border-[#0A0A0A]/10">
          <button onClick={() => setWeekIso(shiftWeek(weekIso, -1))}
                  className="px-3 py-2 hover:bg-[#FAF7F2]" data-testid="planning-prev-week">
            <ChevronLeft size={14} />
          </button>
          <span className="px-3 text-sm font-medium" data-testid="planning-week-label">
            {weekIso}
          </span>
          <button onClick={() => setWeekIso(shiftWeek(weekIso, 1))}
                  className="px-3 py-2 hover:bg-[#FAF7F2]" data-testid="planning-next-week">
            <ChevronRight size={14} />
          </button>
        </div>

        <button onClick={() => setWeekIso(currentWeekIso())}
                className="px-3 py-2 text-[0.7rem] uppercase tracking-[0.18em] text-[#B8922A] hover:underline">
          Semaine en cours
        </button>

        <div className="flex-1" />

        <button onClick={() => downloadFile("xlsx")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
                data-testid="planning-export-xlsx">
          <FileSpreadsheet size={12} /> Excel
        </button>
        <button onClick={() => downloadFile("pdf")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
                data-testid="planning-export-pdf">
          <FileText size={12} /> PDF
        </button>
        <button onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A] print:hidden"
                data-testid="planning-print">
          <Printer size={12} /> Imprimer
        </button>
      </div>

      {/* Department header & validate button */}
      {dept && (
        <div className="bg-white border border-[#0A0A0A]/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-display-serif text-xl text-[#0A0A0A]">{dept.name}</div>
            {week?.validated_at && (
              <div className="text-[0.7rem] text-emerald-700 mt-1 inline-flex items-center gap-1">
                <CheckCircle2 size={11} /> Validé le {week.validated_at.slice(0, 16).replace("T", " ")} par {week.validated_by}
              </div>
            )}
          </div>
          {week?.can_edit && (
            <div className="flex gap-2">
              <button onClick={() => setNewEmpModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[0.7rem] uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#B8922A]"
                      data-testid="planning-add-employee">
                <Plus size={12} /> Ajouter un employé
              </button>
              <button onClick={validateWeek}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#B8922A] hover:bg-[#9d7a23] text-white text-[0.7rem] uppercase tracking-[0.18em]"
                      data-testid="planning-validate">
                <BadgeCheck size={12} /> Valider le planning
              </button>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="bg-white border border-[#0A0A0A]/10 overflow-x-auto">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#B8922A]" size={24} />
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="planning-grid">
            <thead>
              <tr className="bg-[#FAF7F2] text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 text-left">
                <th className="px-4 py-2.5 sticky left-0 bg-[#FAF7F2] min-w-[160px]">Employé</th>
                <th className="px-3 py-2.5 hidden sm:table-cell">Poste</th>
                {DAY_LABELS.map((d, i) => (
                  <th key={d} className="px-2 py-2.5 text-center min-w-[70px]">
                    {d}<br />
                    <span className="text-[0.6rem] text-[#0A0A0A]/40">
                      {week?.week_dates?.[i]?.slice(5)}
                    </span>
                  </th>
                ))}
                {week?.can_edit && <th className="px-3 py-2.5"></th>}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-[#0A0A0A]/45">
                  Aucun employé dans ce département. Cliquez "Ajouter un employé" pour commencer.
                </td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="border-t border-[#0A0A0A]/5" data-testid={`planning-row-${emp.id}`}>
                  <td className="px-4 py-2.5 sticky left-0 bg-white font-medium text-[#0A0A0A]">
                    {emp.last_name} {emp.first_name}
                  </td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-[0.78rem] text-[#0A0A0A]/70">{emp.position}</td>
                  {DAYS.map((day) => {
                    const v = week?.cells?.[emp.id]?.[day] || "T";
                    return (
                      <td key={day} className="px-1 py-1 text-center">
                        <button
                          onClick={() => toggleCell(emp.id, day)}
                          disabled={!week?.can_edit}
                          data-testid={`planning-cell-${emp.id}-${day}`}
                          className={`w-full py-2 text-[0.7rem] uppercase tracking-[0.18em] font-medium transition-colors ${
                            v === "R"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-white text-[#0A0A0A]/70 hover:bg-[#FAF7F2] border border-[#0A0A0A]/8"
                          } ${!week?.can_edit ? "cursor-not-allowed opacity-90" : ""}`}
                        >
                          {v === "R" ? "Repos" : "T"}
                        </button>
                      </td>
                    );
                  })}
                  {week?.can_edit && (
                    <td className="px-2 py-2.5 text-right">
                      <button onClick={() => deleteEmployee(emp.id)}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-[0.7rem] text-[#0A0A0A]/45">
        <span className="inline-block w-3 h-3 bg-emerald-100 border border-emerald-300 mr-1.5 align-middle"></span>
        Repos
        <span className="inline-block w-3 h-3 bg-white border border-[#0A0A0A]/15 mr-1.5 ml-4 align-middle"></span>
        Travail
      </div>

      {newEmpModal && (
        <EmployeeModal onClose={() => setNewEmpModal(false)} onSave={addEmployee} />
      )}

      {/* iter-47: HR-only chefs management section */}
      {hrSummary && <ChefsManagement />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HR-only: generate & manage chef_dept accounts
// ─────────────────────────────────────────────────────────────────────────
function ChefsManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // dept_id during generate / user_id during regen / delete
  const [credsModal, setCredsModal] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/staff/planning/hr/chefs");
      setRows(data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec du chargement");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generate = async (dept) => {
    setBusy(dept.id);
    try {
      const { data } = await api.post("/staff/planning/hr/chefs/generate",
        null, { params: { dept_id: dept.id } });
      setCredsModal({ ...data, kind: "generated" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    } finally { setBusy(null); }
  };

  const regen = async (dept) => {
    if (!dept.chef) return;
    if (!window.confirm(`Régénérer le mot de passe de ${dept.chef.email} ?\n\nL'ancien mot de passe deviendra immédiatement invalide.`)) return;
    setBusy(dept.chef.id);
    try {
      const { data } = await api.post(`/staff/planning/hr/chefs/${dept.chef.id}/regenerate-password`);
      setCredsModal({ ...data, department: dept.name, kind: "regenerated" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    } finally { setBusy(null); }
  };

  const remove = async (dept) => {
    if (!dept.chef) return;
    if (!window.confirm(`Supprimer le compte ${dept.chef.email} ?\n\nLe chef ne pourra plus se connecter.`)) return;
    setBusy(dept.chef.id);
    try {
      await api.delete(`/staff/planning/hr/chefs/${dept.chef.id}`);
      toast.success("Compte supprimé");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Échec");
    } finally { setBusy(null); }
  };

  return (
    <div className="bg-white border border-[#0A0A0A]/10 overflow-hidden" data-testid="chefs-management">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#0A0A0A]/8 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display-serif text-lg text-[#0A0A0A] inline-flex items-center gap-2">
            <UserCog size={16} className="text-[#B8922A]" />
            Comptes Chefs de département
          </h3>
          <p className="text-[0.7rem] text-[#0A0A0A]/55 mt-0.5">
            Générez un identifiant + mot de passe par département. Le chef se connecte
            sur <code className="bg-[#FAF7F2] px-1">/staff/login</code> et accède à son planning.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#B8922A]" size={20} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF7F2] text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/55 text-left">
                <th className="px-4 py-2.5">Département</th>
                <th className="px-4 py-2.5">Compte chef</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Créé le</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t border-[#0A0A0A]/5" data-testid={`chef-row-${d.id}`}>
                  <td className="px-4 py-2.5 font-medium text-[#0A0A0A]">{d.name}</td>
                  <td className="px-4 py-2.5">
                    {d.chef ? (
                      <span className="font-mono text-[0.78rem] text-[#0A0A0A]" data-testid={`chef-email-${d.id}`}>
                        {d.chef.email}
                      </span>
                    ) : (
                      <span className="text-[0.78rem] text-[#0A0A0A]/40 italic">Aucun compte</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-[0.78rem] text-[#0A0A0A]/55">
                    {d.chef?.created_at?.slice(0, 10) || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!d.chef ? (
                      <button
                        onClick={() => generate(d)}
                        disabled={busy === d.id}
                        data-testid={`chef-generate-${d.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white text-[0.65rem] uppercase tracking-[0.18em]"
                      >
                        {busy === d.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Générer un compte
                      </button>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => regen(d)}
                          disabled={busy === d.chef.id}
                          title="Régénérer le mot de passe"
                          data-testid={`chef-regen-${d.id}`}
                          className="p-1.5 border border-[#0A0A0A]/15 hover:border-[#B8922A] text-[#0A0A0A]/55 hover:text-[#B8922A]"
                        >
                          {busy === d.chef.id ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                        </button>
                        <button
                          onClick={() => remove(d)}
                          disabled={busy === d.chef.id}
                          title="Supprimer le compte"
                          data-testid={`chef-delete-${d.id}`}
                          className="p-1.5 border border-[#0A0A0A]/15 hover:border-red-500 text-[#0A0A0A]/55 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {credsModal && (
        <CredentialsModal data={credsModal} onClose={() => setCredsModal(null)} />
      )}
    </div>
  );
}

function CredentialsModal({ data, onClose }) {
  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };
  const both = `Email : ${data.email}\nMot de passe : ${data.password}`;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="creds-modal">
      <div className="bg-white shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-[#FAF7F2]">
          <X size={16} />
        </button>
        <div className="text-[0.62rem] uppercase tracking-[0.28em] text-[#B8922A] mb-1">
          {data.kind === "generated" ? "Nouveau compte créé" : "Mot de passe régénéré"}
        </div>
        <h3 className="font-display-serif text-2xl text-[#0A0A0A] mb-1">
          Chef {data.department}
        </h3>
        <p className="text-[0.78rem] text-[#0A0A0A]/55 mb-5">
          ⚠ {data.warning}
        </p>

        <div className="bg-[#FAF7F2] border border-[#0A0A0A]/10 p-4 mb-4">
          <div className="flex items-baseline justify-between py-2 border-b border-[#0A0A0A]/8">
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 mb-1">
                Identifiant (email)
              </div>
              <code className="text-sm text-[#0A0A0A]" data-testid="creds-email">{data.email}</code>
            </div>
            <button onClick={() => copy(data.email, "Email")} className="text-[#B8922A] hover:text-[#9d7a23]">
              <Copy size={14} />
            </button>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[#0A0A0A]/50 mb-1">
                Mot de passe
              </div>
              <code className="text-lg font-bold tracking-wider text-[#0A0A0A]" data-testid="creds-password">
                {data.password}
              </code>
            </div>
            <button onClick={() => copy(data.password, "Mot de passe")} className="text-[#B8922A] hover:text-[#9d7a23]">
              <Copy size={14} />
            </button>
          </div>
        </div>

        <p className="text-[0.78rem] text-[#0A0A0A]/65 mb-4">
          Le chef se connecte sur <code className="bg-[#FAF7F2] px-1">/staff/login</code>
          {" "}avec ces identifiants et accède directement au menu « Planning hebdomadaire ».
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => copy(both, "Identifiants")}
            className="flex-1 bg-[#B8922A] hover:bg-[#9d7a23] text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-1.5"
            data-testid="creds-copy-both"
          >
            <Copy size={12} /> Copier les 2 identifiants
          </button>
          <button onClick={onClose}
            className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "primary" }) {
  const tones = {
    primary: { bg: "#FAF3DC", color: "#B8922A" },
    success: { bg: "#D1FAE5", color: "#16A34A" },
    warning: { bg: "#FEF3C7", color: "#D97706" },
  };
  const t = tones[tone] || tones.primary;
  return (
    <div className="bg-white border border-[#0A0A0A]/10 p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[0.62rem] uppercase tracking-[0.18em] text-[#0A0A0A]/50">{label}</span>
        <div className="w-7 h-7 flex items-center justify-center rounded-full" style={{ backgroundColor: t.bg, color: t.color }}>
          <Icon size={13} />
        </div>
      </div>
      <div className="font-display-serif text-2xl sm:text-3xl text-[#0A0A0A]">{value}</div>
    </div>
  );
}

function EmployeeModal({ onClose, onSave }) {
  const [f, setF] = useState({ last_name: "", first_name: "", position: "" });
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="planning-emp-modal">
      <div className="bg-white shadow-xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-[#FAF7F2]">
          <X size={16} />
        </button>
        <h3 className="font-display-serif text-xl text-[#0A0A0A] mb-4">Ajouter un employé</h3>
        <div className="space-y-3">
          <Input label="Nom" v={f.last_name} onChange={(v) => setF({ ...f, last_name: v })} testid="emp-last-name" />
          <Input label="Prénom" v={f.first_name} onChange={(v) => setF({ ...f, first_name: v })} testid="emp-first-name" />
          <Input label="Poste" v={f.position} onChange={(v) => setF({ ...f, position: v })} testid="emp-position" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => { setSaving(true); onSave(f); }} disabled={saving || !f.last_name || !f.first_name || !f.position}
                  className="flex-1 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-50 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
                  data-testid="emp-save">
            {saving ? <Loader2 size={13} className="animate-spin inline" /> : "Ajouter"}
          </button>
          <button onClick={onClose}
                  className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, v, onChange, testid }) {
  return (
    <div>
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-1">{label}</label>
      <input value={v} onChange={(e) => onChange(e.target.value)}
             className="w-full px-3 py-2 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-sm bg-white"
             data-testid={testid} />
    </div>
  );
}
