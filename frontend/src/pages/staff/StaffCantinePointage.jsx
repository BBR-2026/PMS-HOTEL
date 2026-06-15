import { useState, useRef, useEffect } from "react";
import {
  Loader2, CheckCircle2, AlertTriangle, UtensilsCrossed, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";

export default function StaffCantinePointage() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // resultState: { kind: "success"|"not_reserved", user, message, exception?, exception_reason? }
  const [resultState, setResultState] = useState(null);
  const [supervisorMode, setSupervisorMode] = useState(false);
  const inputRef = useRef(null);

  const focus = () => setTimeout(() => inputRef.current?.focus(), 50);
  useEffect(() => { focus(); }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      toast.error("Code à 6 caractères requis");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/staff/cantine/pointage", {
        code: c, supervisor_override: false,
      });
      // success path
      setResultState({ kind: "success", ...data });
      setCode("");
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 422 && detail?.code === "not_reserved") {
        // user exists but wasn't reserved — show override flow
        setResultState({
          kind: "not_reserved",
          user: detail.user,
          message: detail.message,
        });
      } else {
        const msg = (typeof detail === "string" ? detail : detail?.message) || "Échec du pointage";
        toast.error(msg);
        setResultState({ kind: "error", message: msg });
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const overrideSubmit = async (reason) => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/staff/cantine/pointage", {
        code: resultState.user.code,
        supervisor_override: true,
        exception_reason: reason || "Autorisation superviseur",
      });
      setResultState({ kind: "success", ...data, exception: true });
      setCode("");
      setSupervisorMode(false);
    } catch (err) {
      toast.error(err.response?.data?.detail?.message
        || err.response?.data?.detail
        || "Échec de l'exception");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResultState(null);
    setSupervisorMode(false);
    setCode("");
    focus();
  };

  // Auto-clear success after 5s
  useEffect(() => {
    if (resultState?.kind === "success") {
      const t = setTimeout(reset, 5000);
      return () => clearTimeout(t);
    }
  }, [resultState]); // eslint-disable-line

  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center" data-testid="cantine-pointage-page">
      <div className="w-full max-w-lg">
        <div className="text-center mb-7">
          <div className="text-[0.62rem] uppercase tracking-[0.3em] text-[#B8922A] mb-1.5 inline-flex items-center gap-1.5">
            <UtensilsCrossed size={11} /> Pointage cantine
          </div>
          <h1 className="font-display-serif text-3xl sm:text-4xl text-[#0A0A0A] mb-1">
            Bon appétit !
          </h1>
          <p className="text-sm text-[#0A0A0A]/55">
            Saisissez le code Cantine à 6 caractères pour valider le repas.
          </p>
        </div>

        {/* RESULT — SUCCESS */}
        {resultState?.kind === "success" && (
          <div className="bg-emerald-50 border-2 border-emerald-500 p-6 text-center mb-5 animate-in fade-in slide-in-from-bottom-3"
               data-testid="cantine-pointage-success">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={56} strokeWidth={1.5} />
            <div className="text-[0.62rem] uppercase tracking-[0.25em] text-emerald-700 mb-1">
              {resultState.exception ? "Exception autorisée" : "Repas validé"}
            </div>
            <h2 className="font-display-serif text-3xl text-[#0A0A0A] mb-2">
              {resultState.message}
            </h2>
            <div className="text-sm text-[#0A0A0A]/70">
              {resultState.user.service} · {resultState.user.position}
            </div>
            <button
              onClick={reset}
              className="mt-5 text-[0.7rem] uppercase tracking-[0.22em] text-emerald-700 hover:text-emerald-900"
              data-testid="cantine-pointage-next"
            >
              Suivant →
            </button>
          </div>
        )}

        {/* RESULT — NOT RESERVED → supervisor override */}
        {resultState?.kind === "not_reserved" && (
          <div className="bg-amber-50 border-2 border-amber-500 p-5 mb-5 animate-in fade-in slide-in-from-bottom-3"
               data-testid="cantine-pointage-not-reserved">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={28} />
              <div>
                <div className="font-display-serif text-xl text-[#0A0A0A] mb-0.5">
                  {resultState.user.first_name} {resultState.user.last_name}
                </div>
                <p className="text-sm text-[#0A0A0A]/70">{resultState.message}</p>
              </div>
            </div>
            {!supervisorMode ? (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setSupervisorMode(true)}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-1.5"
                  data-testid="cantine-pointage-allow-exception"
                >
                  <ShieldCheck size={13} /> Autoriser
                </button>
                <button
                  onClick={reset}
                  className="flex-1 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
                  data-testid="cantine-pointage-reject"
                >
                  Refuser
                </button>
              </div>
            ) : (
              <ExceptionForm
                submitting={submitting}
                onCancel={() => setSupervisorMode(false)}
                onConfirm={overrideSubmit}
              />
            )}
          </div>
        )}

        {/* INPUT FORM */}
        {!resultState && (
          <form onSubmit={submit} className="bg-white border border-[#0A0A0A]/10 p-7">
            <label className="text-[0.6rem] uppercase tracking-[0.22em] text-[#B8922A] block mb-2">
              Code Cantine
            </label>
            <input
              ref={inputRef}
              type="text"
              autoFocus
              required
              maxLength={6}
              value={code}
              placeholder="FRA428"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-5 border border-[#0A0A0A]/15 focus:border-[#B8922A] focus:outline-none text-3xl font-mono tracking-[0.4em] text-center bg-[#FAF7F2] uppercase"
              data-testid="cantine-pointage-code-input"
            />
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className="w-full mt-4 bg-[#B8922A] hover:bg-[#9d7a23] disabled:opacity-40 text-white py-4 text-[0.78rem] uppercase tracking-[0.25em] inline-flex items-center justify-center gap-2 font-medium"
              data-testid="cantine-pointage-submit"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Vérification…</>
              ) : (
                <>Valider le repas</>
              )}
            </button>
            <p className="text-[0.7rem] text-[#0A0A0A]/45 mt-4 text-center">
              Un seul repas autorisé par personne et par jour.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

function ExceptionForm({ submitting, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  return (
    <div className="bg-white border border-amber-300 p-4 mt-3">
      <label className="text-[0.6rem] uppercase tracking-[0.22em] text-amber-700 block mb-1.5">
        Motif de l'exception (optionnel)
      </label>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex. réunion impromptue, oubli d'inscription…"
        className="w-full px-3 py-2.5 border border-[#0A0A0A]/15 focus:border-amber-500 focus:outline-none text-sm bg-white"
        data-testid="cantine-pointage-exception-reason"
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onConfirm(reason)}
          disabled={submitting}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2.5 text-[0.7rem] uppercase tracking-[0.22em] inline-flex items-center justify-center gap-1.5"
          data-testid="cantine-pointage-confirm-exception"
        >
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          Confirmer l'exception
        </button>
        <button
          onClick={onCancel}
          className="px-4 bg-white hover:bg-[#FAF7F2] border border-[#0A0A0A]/15 text-[#0A0A0A]/70 py-2.5 text-[0.7rem] uppercase tracking-[0.22em]"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
