"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowRight, Archive, CheckCircle2, Download, FilePenLine, FlaskConical, HeartPulse, Info, LogOut, Plus, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import Image from "next/image";
import RuleEditor, { type RuleDefinition } from "@/components/RuleEditor";
import { API_BASE_URL, ApiError, api, splitRuleDraft, environmentFields, type User, type LoginResponse, type SavedRule, type RuleCatalog, type RuleVersion, type RuleImportResponse, type RulePayload, type EvaluationRequest, type EvaluationResponse, type EnvironmentResponse } from "@/lib/api";

import { LanguageProvider, LanguageSwitcher, useLanguage } from "@/lib/i18n";
import { translateCatalog, type Language, type Translate } from "@/lib/language";

type Request = <T>(path: string, options?: RequestInit) => Promise<T>;
type Message = string | { de: string; en: string };
const message = (de: string, en: string): Message => ({ de, en });
const renderMessage = (value: Message, t: Translate) => typeof value === "string" ? value : t(value.de, value.en);
class LocalizedError extends Error {
  constructor(public de: string, public en: string) { super(de); }
}
const messageOf = (error: unknown): Message => error instanceof LocalizedError ? message(error.de, error.en) : error instanceof Error ? error.message : message("Unbekannter Fehler", "Unknown error");
const errorWithPrefix = (de: string, en: string, error: unknown): Message => {
  const detail = messageOf(error);
  return message(de + renderMessage(detail, (german) => german), en + renderMessage(detail, (_, english) => english));
};
const ruleStatusLabels = (t: Translate) => ({ draft: t("Entwurf", "Draft"), approved: t("Veröffentlicht", "Published"), archived: t("Archiviert", "Archived") });
const severityLabels = (t: Translate) => ({ green: t("Grün", "Green"), yellow: t("Gelb", "Yellow"), red: t("Rot", "Red") });
const formatDate = (value: string, language: Language) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language === "de" ? "de-DE" : "en-GB");
};
const historyAction = (action: string, t: Translate) => ({
  CREATE: t("Erstellt", "Created"), CREATED: t("Erstellt", "Created"),
  UPDATE: t("Bearbeitet", "Updated"), UPDATED: t("Bearbeitet", "Updated"),
  PUBLISH: t("Veröffentlicht", "Published"), PUBLISHED: t("Veröffentlicht", "Published"),
  ARCHIVE: t("Archiviert", "Archived"), ARCHIVED: t("Archiviert", "Archived"),
}[action.toUpperCase()] ?? action);
function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={`api-notice ${error ? "api-error" : ""}`} role={error ? "alert" : "status"}><Info size={18} aria-hidden="true" /><div>{children}</div></div>;
}
function InstitutionLogos() {
  return <div className="api-institution-logos">
    <Image className="api-institution-logo" src="/assets/IDM_Logo_recreated.png" alt="IDM – Institut für Digitale Medizin" width={1880} height={760} unoptimized />
    <Image className="api-institution-logo" src="/assets/Uni_Marburg_Logo.svg" alt="Philipps-Universität Marburg" width={1908} height={659} unoptimized />
  </div>;
}
function JsonDetail({ value, label }: { value: unknown; label: string }) {
  return <details><summary>{label}</summary><pre className="api-json">{JSON.stringify(value, null, 2)}</pre></details>;
}

export default function ExpertDashboard() {
  return <LanguageProvider><AuthenticatedDashboard /></LanguageProvider>;
}

function AuthenticatedDashboard() {
  const { language, t } = useLanguage();
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);
  const [session, setSession] = useState<{ token: string; user: User; expires: number } | null>(null);
  const [error, setError] = useState<Message>("");
  const [busy, setBusy] = useState(false);
  const logout = useCallback((expired = false) => {
    setSession(null);
    setError(expired ? message("Sitzung abgelaufen. Bitte erneut anmelden. Nicht gespeicherte Eingaben wurden verworfen.", "Session expired. Please sign in again. Unsaved input has been discarded.") : "");
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => logout(true), Math.max(0, Math.min(session.expires - Date.now(), 2147483647)));
    return () => clearTimeout(timer);
  }, [session, logout]);
  const request = useCallback<Request>(async <T,>(path: string, options?: RequestInit) => {
    if (!session) throw new LocalizedError("Anmeldung erforderlich.", "Sign-in required.");
    try { return await api<T>(path, session.token, options, languageRef.current); }
    catch (error) { if (error instanceof ApiError && error.status === 401) logout(true); throw error; }
  }, [session, logout]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError("");
    try {
      const auth = await api<LoginResponse>("/auth/login", undefined, { method: "POST", body: JSON.stringify({ email: String(values.get("email")).trim(), password: values.get("password") }) }, languageRef.current);
      if (!auth.accessToken || !Number.isFinite(auth.expiresInSeconds) || auth.expiresInSeconds <= 0) throw new LocalizedError("Ungültige Anmeldung vom Server.", "Invalid sign-in response from the server.");
      const user = await api<User>("/auth/me", auth.accessToken, undefined, languageRef.current);
      form.reset();
      setSession({ token: auth.accessToken, user, expires: Date.now() + auth.expiresInSeconds * 1000 });
    } catch (error) { setError(messageOf(error)); const password = form.elements.namedItem("password") as HTMLInputElement; password.value = ""; }
    finally { setBusy(false); }
  }
  if (!session) return <main className="api-login">
    <section className="api-login-story">
      <div className="api-brand"><span className="api-brand-mark"><HeartPulse size={26} aria-hidden="true" /></span><span>HABITAT<small>EXPERT WORKSPACE</small></span></div>
      <div className="api-login-intro"><p className="eyebrow">{t("UMWELT TRIFFT GESUNDHEIT", "ENVIRONMENT MEETS HEALTH")}</p><h2>{t("Klare Regeln.\nGezielte Warnungen.", "Clear rules.\nPersonalized warnings.")}</h2><p>{t("Ein gemeinsamer Arbeitsbereich für medizinische Regeln, Umweltdaten und nachvollziehbare Entscheidungen.", "A dedicated workspace for medical rules, environmental data, and traceable decisions.")}</p>
        <div className="api-login-features"><span><FilePenLine size={20} aria-hidden="true" />{t("Regeln strukturiert gestalten", "Design structured rules")}</span><span><FlaskConical size={20} aria-hidden="true" />{t("Szenarien vorab simulieren", "Simulate before publishing")}</span><span><ShieldCheck size={20} aria-hidden="true" />{t("Jede Version nachvollziehen", "Trace every version")}</span></div>
      </div><p className="api-login-footnote">{t("Für medizinische Fachteams entwickelt", "Built for medical teams")}</p>
    </section>
    <section className="card api-login-card">
      <LanguageSwitcher />
      <div className="api-login-heading"><span className="api-kicker">{t("IHR EXPERTENBEREICH", "YOUR EXPERT WORKSPACE")}</span><h1>{t("Willkommen zurück", "Welcome back")}</h1><p>{t("Melden Sie sich an, um medizinische Regeln zu verwalten und Szenarien zu prüfen.", "Sign in to manage medical rules and explore environmental scenarios.")}</p></div>
      {error && <Notice error>{renderMessage(error, t)}</Notice>}
      <form onSubmit={login} className="api-grid">
        <label>{t("E-Mail", "Email")}<input name="email" type="email" autoComplete="username" placeholder="name@example.org" required disabled={busy} /></label>
        <label>{t("Passwort", "Password")}<input name="password" type="password" autoComplete="current-password" required disabled={busy} /></label>
        <button className="primary" disabled={busy}>{busy ? t("Anmeldung …", "Signing in …") : t("Anmelden", "Sign in")}<ArrowRight size={18} aria-hidden="true" /></button>
      </form>
      <p className="api-login-security"><ShieldCheck size={17} aria-hidden="true" />{t("Zugriff nur für autorisierte medizinische Editoren", "Access for authorized medical editors only")}</p>
      <details className="api-connection"><summary>{t("Verbindungsdetails", "Connection details")}</summary><p className="api-muted">API: {API_BASE_URL}. {t("Zugriffstoken bleiben nur im Arbeitsspeicher; nach Neuladen ist eine Anmeldung nötig.", "Access tokens are kept in memory only; reloading requires signing in again.")}</p></details>
      <InstitutionLogos />
    </section>
  </main>;
  if (!session.user.medicalEditor) return <main className="api-login"><section className="card api-login-card">
    <LanguageSwitcher />
    <h1>{t("Keine Zugriffsberechtigung", "Access denied")}</h1><Notice error>{t("Die Regelverwaltung und Simulation erfordern eine medizinische Editorberechtigung. Diese muss durch die Administration vergeben werden.", "Rule management and simulation require medical editor permission, which must be granted by an administrator.")}</Notice>
    <button className="outline" onClick={() => logout()}>{t("Abmelden", "Sign out")}</button>
  </section></main>;
  return <Dashboard key={session.token} user={session.user} request={request} logout={() => logout()} />;
}

function Dashboard({ user, request, logout }: { user: User; request: Request; logout: () => void }) {
  const { language, t } = useLanguage();
  const statusLabels = ruleStatusLabels(t);
  const [tab, setTab] = useState<"rules" | "simulation">("rules");
  const [rules, setRules] = useState<SavedRule[]>([]);
  const [catalog, setCatalog] = useState<RuleCatalog | null>(null);
  const displayCatalog = useMemo(() => catalog ? translateCatalog(catalog, language) : null, [catalog, language]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Message>("");
  const [notice, setNotice] = useState<Message>("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<SavedRule | "new" | null>(null);
  const [history, setHistory] = useState<{ name: string; versions: RuleVersion[] } | null>(null);
  const [batch, setBatch] = useState<{ payloads: RulePayload[]; saved: SavedRule[]; updateId?: string } | null>(null);
  const mutationLock = useRef(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const [nextRules, nextCatalog] = await Promise.all([request<SavedRule[]>("/rules"), request<RuleCatalog>("/rules/catalog")]);
    setRules(nextRules); setCatalog(nextCatalog);
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([request<SavedRule[]>("/rules", { signal: controller.signal }), request<RuleCatalog>("/rules/catalog", { signal: controller.signal })])
      .then(([nextRules, nextCatalog]) => { setRules(nextRules); setCatalog(nextCatalog); })
      .catch((error) => { if (!controller.signal.aborted) setError(messageOf(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);
  async function run(action: () => Promise<void>) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (error) { setError(messageOf(error)); }
    finally { mutationLock.current = false; setBusy(false); }
  }
  async function reloadAfterWrite() {
    try { await refresh(); } catch (error) { setError(errorWithPrefix("Änderung gespeichert; Übersicht konnte nicht aktualisiert werden: ", "Change saved; the overview could not be refreshed: ", error)); }
  }
  async function saveBatch(plan: NonNullable<typeof batch>) {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setError(""); setNotice("");
    let saved = [...plan.saved];
    setBatch({ ...plan, saved });
    try {
      for (let index = saved.length; index < plan.payloads.length; index++) {
        const updateId = index === 0 ? plan.updateId : undefined;
        const rule = await request<SavedRule>(updateId ? `/rules/${updateId}` : "/rules", { method: updateId ? "PUT" : "POST", body: JSON.stringify(plan.payloads[index]) });
        saved = [...saved, rule];
        setRules((current) => [...current.filter((item) => item.id !== rule.id), rule]);
        setBatch({ ...plan, saved });
      }
      setNotice(message(`${saved.length} Entwurf/Entwürfe auf dem Server gespeichert, noch nicht veröffentlicht.`, `${saved.length} draft(s) saved on the server, not yet published.`));
      setBatch(null); setEditor(null);
      await reloadAfterWrite();
    } catch (error) {
      const text = errorWithPrefix(`${saved.length} von ${plan.payloads.length} gespeichert. Nicht bestätigte Zweige bleiben offen. `, `${saved.length} of ${plan.payloads.length} saved. Unconfirmed branches remain pending. `, error);
      setError(text);
      // Revision conflicts need a fresh GET, not resubmission with a stale revision.
      if (error instanceof ApiError && error.status === 409) setBatch(null);
      throw new Error(renderMessage(text, t));
    } finally { mutationLock.current = false; setBusy(false); }
  }
  async function save(rule: RuleDefinition) {
    if (!catalog || !user.medicalEditor) throw new Error(t("Keine Bearbeitungsberechtigung.", "No editing permission."));
    const payloads = splitRuleDraft(rule, catalog, language);
    const updateId = editor && editor !== "new" ? editor.id : undefined;
    if (updateId && editor !== "new" && editor) payloads[0].revision = editor.revision;
    await saveBatch({ payloads, saved: [], updateId });
  }
  async function importCsv(file: File) {
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) throw new LocalizedError("Bitte eine CSV-Datei auswählen.", "Select a CSV file.");
    const form = new FormData();
    form.append("file", file);
    const result = await request<RuleImportResponse>("/rules/import", { method: "POST", body: form });
    setNotice(message(`${result.importedCount} Regel(n) als Entwurf importiert.`, `${result.importedCount} rule(s) imported as drafts.`));
    await reloadAfterWrite();
  }
  const visible = rules.filter((rule) => (filter === "all" || rule.status === filter) && `${rule.name} ${rule.description} ${rule.groups.join(" ")} ${rule.groups.map((id) => displayCatalog?.groups.find((group) => group.id === id)?.label ?? id).join(" ")}`.toLocaleLowerCase(language).includes(query.toLocaleLowerCase(language)));
  const existingRecommendations = Array.from(new Map(rules.flatMap((rule) => rule.recommendations).map((item) => [item.id, item])).values());
  const existingSources = Array.from(new Map(rules.flatMap((rule) => rule.sources).map((item) => [item.id, item])).values());
  return <main className="api-dashboard">
    <aside className="api-sidebar">
      <div className="api-workspace-brand"><div className="api-brand"><span className="api-brand-mark"><HeartPulse size={25} aria-hidden="true" /></span><span>HABITAT<small>EXPERT WORKSPACE</small></span></div></div>
      <p className="api-nav-caption">{t("ARBEITSBEREICH", "WORKSPACE")}</p>
      <nav aria-label={t("Hauptnavigation", "Main navigation")}><button className={tab === "rules" ? "selected" : ""} aria-current={tab === "rules" ? "page" : undefined} onClick={() => setTab("rules")}><Activity size={19} aria-hidden="true" />{t("Regelverwaltung", "Rule management")}</button><button className={tab === "simulation" ? "selected" : ""} aria-current={tab === "simulation" ? "page" : undefined} onClick={() => setTab("simulation")}><FlaskConical size={19} aria-hidden="true" />{t("Simulation", "Simulation")}</button></nav>
      <div className="api-sidebar-note"><ShieldCheck size={21} aria-hidden="true" /><b>{t("Kontrolliert veröffentlichen", "Publish with confidence")}</b><p>{t("Entwürfe zuerst prüfen. Nur veröffentlichte Regeln werden für Patienten ausgewertet.", "Test drafts first. Only published rules are evaluated for patients.")}</p></div>
      <div className="api-sidebar-bottom"><InstitutionLogos /><LanguageSwitcher />
      <div className="api-profile"><span className="api-avatar" aria-hidden="true">{user.email.slice(0, 2).toUpperCase()}</span><div><b>{user.email}</b><p>{t("Medizinischer Editor", "Medical editor")}</p></div><button className="outline" disabled={busy} onClick={logout}><LogOut size={16} aria-hidden="true" />{t("Abmelden", "Sign out")}</button></div></div>
    </aside>
    <div className="content api-content"><header className="api-page-header"><div><p className="eyebrow">{t("HABITAT / EXPERTENBEREICH", "HABITAT / EXPERT WORKSPACE")}</p><h1>{tab === "rules" ? t("Regelverwaltung", "Rule management") : t("Simulation", "Simulation")}</h1><p className="api-page-description">{tab === "rules" ? t("Medizinische Regeln gestalten, prüfen und gezielt veröffentlichen.", "Design, review, and publish personalized health rules.") : t("Umweltszenarien prüfen, bevor Regeln für Patienten aktiv werden.", "Explore environmental scenarios before rules reach patients.")}</p></div><button className="outline" disabled={busy || loading} onClick={() => void run(refresh)}><RefreshCw size={16} className={busy || loading ? "api-spinning" : ""} aria-hidden="true" />{t("Aktualisieren", "Refresh")}</button></header>
      {error && <Notice error>{renderMessage(error, t)}</Notice>}{notice && <Notice>{renderMessage(notice, t)}</Notice>}
      {loading ? <p role="status">{t("Katalog und Regeln werden geladen …", "Loading catalog and rules …")}</p> : !catalog || !displayCatalog ? <Notice error>{t("Katalog nicht verfügbar. Über „Aktualisieren“ erneut laden; keine lokalen Ersatzdaten.", "Catalog unavailable. Use ‘Refresh’ to try again; no local fallback data is used.")}</Notice> : <>
        <div hidden={tab !== "rules"}>
          {!editor && <div className="api-overview" aria-label={t("Regelübersicht", "Rule overview")}>
            <div className="api-stat"><span className="api-stat-icon"><Activity size={22} aria-hidden="true" /></span><div><span>{t("Alle Regeln", "Total rules")}</span><strong>{rules.length}</strong></div></div>
            <div className="api-stat"><span className="api-stat-icon api-stat-live"><CheckCircle2 size={22} aria-hidden="true" /></span><div><span>{t("Aktive Veröffentlichungen", "Live publications")}</span><strong>{rules.filter((rule) => rule.publishedVersion != null && rule.status !== "archived").length}</strong></div></div>
            <div className="api-stat"><span className="api-stat-icon api-stat-draft"><FilePenLine size={22} aria-hidden="true" /></span><div><span>{t("Entwürfe", "Drafts")}</span><strong>{rules.filter((rule) => rule.status === "draft").length}</strong></div></div>
            <div className="api-stat"><span className="api-stat-icon api-stat-archive"><Archive size={22} aria-hidden="true" /></span><div><span>{t("Archiviert", "Archived")}</span><strong>{rules.filter((rule) => rule.status === "archived").length}</strong></div></div>
          </div>}
          {batch && <Notice error><p>{batch.saved.length}/{batch.payloads.length} {t("bestätigt. Bereits bestätigte Zweige werden nicht erneut angelegt. Bei unklarer Netzwerkantwort zuerst die Übersicht aktualisieren und nach Duplikaten suchen.", "confirmed. Confirmed branches will not be created again. If the network response is ambiguous, refresh the overview and check for duplicates first.")}</p>
            <div className="api-actions"><button className="outline" disabled={busy} onClick={() => { if (window.confirm(t("Nicht bestätigte Anfragen erneut senden? Bei Netzwerkabbruch kann der Server sie bereits gespeichert haben. Zuerst Übersicht prüfen.", "Resend unconfirmed requests? The server may already have saved them if the connection was interrupted. Check the overview first."))) void saveBatch(batch).catch(() => undefined); }}>{t("Offene Zweige erneut senden", "Resend pending branches")}</button><button className="outline" disabled={busy} onClick={() => { if (window.confirm(t("Offene Zweige verwerfen? Bereits gespeicherte Entwürfe bleiben bestehen. Sie bilden möglicherweise nur einen Teil des ODER-Ausdrucks ab und sollten nicht einzeln veröffentlicht werden.", "Discard pending branches? Saved drafts will remain. They may represent only part of the OR expression and should not be published individually."))) { setBatch(null); setEditor(null); setNotice(message("Teilvorgang beendet. Bereits gespeicherte ODER-Zweige vor Veröffentlichung auf Vollständigkeit prüfen.", "Partial operation ended. Check saved OR branches for completeness before publishing.")); } }}>{t("Vorgang beenden", "End operation")}</button></div>
          </Notice>}
          {editor && <section className="api-editor-section"><div className="api-actions"><button className="outline" disabled={busy || !!batch} onClick={() => { if (window.confirm(t("Editor schließen und nicht gespeicherte Eingaben verwerfen?", "Close the editor and discard unsaved input?"))) setEditor(null); }}>{t("Editor schließen", "Close editor")}</button>{editor !== "new" && <><span>{t("Revision", "Revision")} {editor.revision} · {statusLabels[editor.status]}{editor.publishedVersion != null ? t(` · Live-Version ${editor.publishedVersion} bleibt aktiv`, ` · Live version ${editor.publishedVersion} remains active`) : ""}</span><button className="outline" disabled={busy || !!batch} onClick={() => { if (window.confirm(t("Serverstand neu laden? Nicht gespeicherte Änderungen gehen verloren.", "Reload the server version? Unsaved changes will be lost."))) void run(async () => setEditor(await request<SavedRule>(`/rules/${editor.id}`))); }}>{t("Serverstand laden", "Load server version")}</button></>}</div>
            <RuleEditor key={editor === "new" ? "new" : `${editor.id}-${editor.revision}`} initialValue={editor === "new" ? undefined : editor} catalog={displayCatalog} existingRecommendations={existingRecommendations} existingSources={existingSources} onSave={save} disabled={busy || !!batch} />
          </section>}
          <div hidden={!!editor}>
          <div className="api-actions api-toolbar"><label className="api-grow">{t("Suche", "Search")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Name, Beschreibung oder Gruppe", "Name, description or group")} /></label><label>{t("Status", "Status")}<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{t("Alle", "All")}</option>{Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><a className="outline" href="/rule-import-template.csv" download><Download size={16} />{t("CSV-Vorlage", "CSV template")}</a><input ref={csvInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void run(() => importCsv(file)); }} /><button className="outline" disabled={!user.medicalEditor || busy || !!editor || !!batch} onClick={() => csvInput.current?.click()}><Upload size={16} />{t("CSV importieren", "Import CSV")}</button><button className="primary" disabled={!user.medicalEditor || busy || !!editor} onClick={() => { setEditor("new"); setError(""); setNotice(""); }}><Plus size={16} />{t("Neue Regel", "New rule")}</button></div>
          <section className="card api-rule-library"><div className="cardhead"><div><h2>{t("Regelbibliothek", "Rule library")} <span className="api-count">{visible.length}</span></h2><p>{t("Bearbeiten → Entwurf speichern → direkt veröffentlichen. Archivieren entfernt auch die aktive Veröffentlichung; kein endgültiges Löschen.", "Edit → save draft → publish directly. Archiving also removes the active publication; it does not permanently delete the rule.")}</p></div></div><div className="scroll"><table className="api-table"><thead><tr><th>{t("Regel / Gruppen", "Rule / Groups")}</th><th>{t("Status / Version", "Status / Version")}</th><th>{t("Aktionen", "Actions")}</th></tr></thead><tbody>
            {visible.map((rule) => <tr key={rule.id}><td><b className="api-rule-name">{rule.name}</b><p>{rule.description}</p><div className="api-group-tags">{rule.groups.map((id) => <span key={id}>{displayCatalog.groups.find((group) => group.id === id)?.label ?? id}</span>)}</div></td><td><span className={`api-status api-status-${rule.status}`}>{statusLabels[rule.status]}</span><small className="api-rule-version">{t("Revision", "Revision")} {rule.revision}{rule.publishedVersion != null && rule.status !== "archived" ? ` · Live ${rule.publishedVersion}` : t(" · Nicht live", " · Not live")}</small></td><td><div className="api-actions">
              <button className="outline" disabled={!user.medicalEditor || busy || !!editor || rule.status === "archived"} onClick={() => void run(async () => setEditor(await request<SavedRule>(`/rules/${rule.id}`)))}>{t("Bearbeiten", "Edit")}</button>
              <button className="outline" disabled={busy} onClick={() => void run(async () => setHistory({ name: rule.name, versions: await request<RuleVersion[]>(`/rules/${rule.id}/versions`) }))}>{t("Historie", "History")}</button>
              <button className="primary" disabled={!user.medicalEditor || busy || !!batch || rule.status !== "draft"} onClick={() => { if (window.confirm(t(`„${rule.name}“ Revision ${rule.revision} direkt veröffentlichen? Diese Version wird produktiv ausgewertet.`, `Publish ‘${rule.name}’ revision ${rule.revision} directly? This version will be evaluated in production.`))) void run(async () => { await request(`/rules/${rule.id}/publish`, { method: "POST", body: JSON.stringify({ revision: rule.revision }) }); setNotice(message("Regel veröffentlicht.", "Rule published.")); await reloadAfterWrite(); }); }}>{t("Veröffentlichen", "Publish")}</button>
              <button className="outline" disabled={!user.medicalEditor || busy || !!batch || rule.status === "archived"} onClick={() => { if (window.confirm(t(`„${rule.name}“ archivieren? Auch eine frühere Live-Version wird deaktiviert.`, `Archive ‘${rule.name}’? Any previous live version will also be deactivated.`))) void run(async () => { await request(`/rules/${rule.id}/archive`, { method: "POST", body: JSON.stringify({ revision: rule.revision }) }); setNotice(message("Regel archiviert.", "Rule archived.")); await reloadAfterWrite(); }); }}>{t("Archivieren", "Archive")}</button>
            </div><JsonDetail value={rule} label={t("Gespeicherte Definition", "Saved definition")} /></td></tr>)}
            {!visible.length && <tr><td colSpan={3}><div className="api-empty"><FilePenLine size={30} aria-hidden="true" /><h3>{rules.length ? t("Keine passenden Regeln", "No matching rules") : t("Ihre erste Regel beginnt hier", "Your first rule starts here")}</h3><p>{rules.length ? t("Passen Sie Suche oder Statusfilter an.", "Try a different search or status filter.") : t("Erstellen Sie einen Entwurf und prüfen Sie ihn in der Simulation. Nichts wird automatisch veröffentlicht.", "Create a draft and test it in simulation. Nothing is published automatically.")}</p></div></td></tr>}
          </tbody></table></div></section>
          {history && <section className="card api-history"><div className="cardhead"><h2>{t("Historie", "History")}: {history.name}</h2><button className="outline" onClick={() => setHistory(null)}>{t("Schließen", "Close")}</button></div>{history.versions.map((version, index) => <article key={`${version.version}-${index}`}><b>{t("Version", "Version")} {version.version} · {historyAction(version.action, t)}</b><p>{formatDate(version.createdAt, language)} · {t("Autor", "Author")} {version.authorId}</p><JsonDetail value={version.rule} label={t("Version vollständig anzeigen", "Show full version")} /></article>)}{!history.versions.length && <p>{t("Keine Historie vorhanden.", "No history available.")}</p>}</section>}
          <details className="api-workspace-note"><summary>{t("Hinweise zu Daten und Veröffentlichung", "About data and publishing")}</summary><p>{t("CSV-Initialinhalte sind nicht veröffentlicht und werden nicht automatisch importiert. Ausschließlich gespeicherte Java-Regeln sind maßgeblich. COPD ist eine separate Gruppe; „lung“ steht für Asthma.", "Initial CSV content is unpublished and is not imported automatically. Only saved Java rules are authoritative. COPD is a separate group; ‘lung’ represents asthma.")}</p></details>
          </div>
        </div>
        <div hidden={tab !== "simulation"}><Simulation request={request} catalog={catalog} rules={rules} canTestDrafts={user.medicalEditor} /></div>
      </>}
    </div>
  </main>;
}

function Simulation({ request, catalog: rawCatalog, rules, canTestDrafts }: { request: Request; catalog: RuleCatalog; rules: SavedRule[]; canTestDrafts: boolean }) {
  const { language, t } = useLanguage();
  const catalog = useMemo(() => translateCatalog(rawCatalog, language), [rawCatalog, language]);
  const statusLabels = ruleStatusLabels(t);
  const severities = severityLabels(t);
  const evaluationStatus = {
    NO_RULES: t("Keine Regeln", "No rules"), NO_APPLICABLE_RULES: t("Keine anwendbaren Regeln", "No applicable rules"),
    INCOMPLETE: t("Unvollständig", "Incomplete"), COMPLETE: t("Vollständig", "Complete"),
  };
  const missingParameterLabel = (id: string) => catalog.parameters.find((parameter) => parameter.id === id)?.label
    ?? ({ age: t("Alter", "Age"), gender: t("Geschlecht", "Gender"), groups: t("Zielgruppen", "Target groups") }[id] ?? id);
  const [groups, setGroups] = useState<string[]>([]);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<EvaluationRequest["gender"]>("unknown");
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"published" | "selected">("published");
  const [ruleIds, setRuleIds] = useState<string[]>([]);
  const [lat, setLat] = useState(""); const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<Message>("");
  const [environment, setEnvironment] = useState<EnvironmentResponse | null>(null);
  const environmentTimestamp = (value: number | string | null | undefined) => value == null ? t("unbekannt", "unknown") : formatDate(String(value), language);
  const [result, setResult] = useState<{ response: EvaluationResponse; input: EvaluationRequest; timestamp: string } | null>(null);
  const [stale, setStale] = useState(false);
  const [ruleSnapshot, setRuleSnapshot] = useState("");
  const currentRules = rules.map((rule) => `${rule.id}:${rule.revision}`).sort().join("|");
  const markChanged = () => { setStale(true); setError(""); };
  const toggle = (values: string[], id: string) => values.includes(id) ? values.filter((value) => value !== id) : [...values, id];
  async function evaluate(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      if (!groups.length) throw new LocalizedError("Mindestens eine Zielgruppe wählen.", "Select at least one target group.");
      if (age && (!/^\d+$/.test(age) || Number(age) > 120)) throw new LocalizedError("Alter muss ganzzahlig zwischen 0 und 120 liegen; leer bedeutet unbekannt.", "Age must be an integer between 0 and 120; leave blank if unknown.");
      if (mode === "selected" && (!ruleIds.length || ruleIds.some((id) => !rules.some((rule) => rule.id === id && rule.status !== "archived")))) throw new LocalizedError("Mindestens eine nicht archivierte Regel auswählen; Auswahl nach Änderungen prüfen.", "Select at least one non-archived rule; review your selection after changes.");
      const values: Record<string, number | null> = {};
      for (const parameter of catalog.parameters) {
        const raw = measurements[parameter.id]?.trim() ?? "";
        const value = raw === "" ? null : Number(raw.replace(",", "."));
        if (value !== null && !Number.isFinite(value)) throw new LocalizedError(
          `Ungültiger Messwert: ${rawCatalog.parameters.find((item) => item.id === parameter.id)?.label ?? parameter.id}`,
          `Invalid measurement: ${translateCatalog(rawCatalog, "en").parameters.find((item) => item.id === parameter.id)?.label ?? parameter.id}`,
        );
        values[parameter.id] = value;
      }
      const input: EvaluationRequest = { groups, ...(age ? { age: Number(age) } : {}), gender, measurements: values, ...(mode === "selected" ? { ruleIds } : {}) };
      const response = await request<EvaluationResponse>("/rules/evaluate", { method: "POST", body: JSON.stringify(input) });
      setResult({ response, input, timestamp: new Date().toISOString() }); setRuleSnapshot(currentRules); setStale(false);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function loadEnvironment() {
    if (busy) return;
    setBusy(true); setError(""); setEnvironment(null); setStale(true);
    try {
      const latitude = Number(lat.replace(",", ".")); const longitude = Number(lon.replace(",", "."));
      if (!lat.trim() || !lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new LocalizedError("Gültige Koordinaten eingeben (Breite −90…90, Länge −180…180).", "Enter valid coordinates (latitude −90…90, longitude −180…180).");
      const data = await request<EnvironmentResponse>(`/environment?lat=${latitude}&lon=${longitude}`);
      const next: Record<string, string> = {};
      for (const parameter of catalog.parameters) { const value = data.current[environmentFields[parameter.id]]; next[parameter.id] = parameter.live && typeof value === "number" && Number.isFinite(value) ? String(value) : ""; }
      setMeasurements(next); setEnvironment(data);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <section className="api-simulation">
    <Notice>{t("Nur die Java-API wertet aus. Leere Messwerte und unbekannte Profildaten können UNKNOWN ergeben — niemals automatisch „grün“ oder „sicher“. Standardmäßig werden ausschließlich veröffentlichte Versionen geprüft.", "Only the Java API evaluates rules. Empty measurements and unknown profile data can yield UNKNOWN — never automatically ‘green’ or ‘safe’. Only published versions are checked by default.")}</Notice>
    {error && <Notice error>{renderMessage(error, t)}</Notice>}
    <form onSubmit={evaluate}><fieldset disabled={busy} className="api-fieldset">
      <section className="card api-panel"><div className="api-section-heading"><span className="api-step">01</span><div><h2>{t("Profil und Regelumfang", "Profile and rule scope")}</h2><p>{t("Zielgruppen auswählen und den Testumfang festlegen.", "Choose target groups and define what to evaluate.")}</p></div></div><div className="api-checks">{catalog.groups.map((group) => <label key={group.id}><input type="checkbox" checked={groups.includes(group.id)} onChange={() => { setGroups(toggle(groups, group.id)); markChanged(); }} />{group.label}</label>)}</div>
        <div className="api-grid api-grid-3"><label>{t("Alter (leer = unbekannt)", "Age (blank = unknown)")}<input type="number" min="0" max="120" step="1" value={age} onChange={(event) => { setAge(event.target.value); markChanged(); }} /></label><label>{t("Geschlecht", "Gender")}<select value={gender} onChange={(event) => { setGender(event.target.value as EvaluationRequest["gender"]); markChanged(); }}><option value="unknown">{t("Unbekannt", "Unknown")}</option><option value="all">{t("Alle", "All")}</option><option value="female">{t("Weiblich", "Female")}</option><option value="male">{t("Männlich", "Male")}</option><option value="diverse">{t("Divers", "Diverse")}</option></select></label><label>{t("Auswertungsmodus", "Evaluation mode")}<select value={mode} onChange={(event) => { setMode(event.target.value as typeof mode); markChanged(); }}><option value="published">{t("Nur veröffentlichte Regeln", "Published rules only")}</option>{canTestDrafts && <option value="selected">{t("Explizite Auswahl (inklusive Entwürfe)", "Explicit selection (including drafts)")}</option>}</select></label></div>
        {mode === "selected" && <><Notice>{t("Testmodus: ausgewählte aktuelle Definitionen, auch unveröffentlichte Entwürfe. Kein produktives Ergebnis.", "Test mode: selected current definitions, including unpublished drafts. Not a production result.")}</Notice><div className="api-checks">{rules.filter((rule) => rule.status !== "archived").map((rule) => <label key={rule.id}><input type="checkbox" checked={ruleIds.includes(rule.id)} onChange={() => { setRuleIds(toggle(ruleIds, rule.id)); markChanged(); }} />{rule.name} · {statusLabels[rule.status]}</label>)}</div></>}
      </section>
      <section className="card api-panel"><div className="api-section-heading"><span className="api-step">02</span><div><h2>{t("Messwerte", "Measurements")}</h2><p>{t("Alle Felder sind optional. Fehlende Werte bleiben unbekannt.", "All fields are optional. Missing values remain unknown.")}</p></div></div>
        <div className="api-measurement-groups">{[true, false].map((live) => <section className="api-measurement-group" key={String(live)}><div className="api-measurement-heading"><h3>{live ? t("Mit Datenquelle verbunden", "Provider-connected parameters") : t("Manuelle Testparameter", "Manual test parameters")}</h3><span className={`api-status ${live ? "api-status-approved" : "api-status-archived"}`}>{catalog.parameters.filter((parameter) => parameter.live === live).length}</span></div><p>{live ? t("Werte importieren oder für dieses Szenario überschreiben. Verfügbarkeit hängt vom Anbieter ab.", "Import values or override them for this scenario. Availability depends on the provider.") : t("Keine Live-Anbindung. Diese Werte gelten nur für die Simulation.", "No live connection. These values apply only to the simulation.")}</p><div className="api-grid api-grid-3">{catalog.parameters.filter((parameter) => parameter.live === live).map((parameter) => <label className="api-measurement" key={parameter.id}><span>{parameter.label} <span className="api-unit">({parameter.unit})</span></span><input inputMode="decimal" value={measurements[parameter.id] ?? ""} placeholder={t("Unbekannt", "Unknown")} onChange={(event) => { setMeasurements({ ...measurements, [parameter.id]: event.target.value }); setEnvironment(null); markChanged(); }} /></label>)}</div></section>)}</div>
        <p className="api-muted">{t("Numerische Werte in Katalog-Einheiten; Pollen in grains/m³, nicht als Gefahrenstufe.", "Use catalog units; pollen in grains/m³, not as a risk level.")}</p>
        <div className="api-actions api-toolbar"><label>{t("Breitengrad", "Latitude")}<input value={lat} inputMode="decimal" onChange={(event) => setLat(event.target.value)} placeholder={t("z. B. 50.8", "e.g. 50.8")} /></label><label>{t("Längengrad", "Longitude")}<input value={lon} inputMode="decimal" onChange={(event) => setLon(event.target.value)} placeholder={t("z. B. 8.77", "e.g. 8.77")} /></label><button type="button" className="outline" onClick={() => void loadEnvironment()}>{t("Umwelt-Rohdaten für Szenario laden", "Load raw environmental data for scenario")}</button><button type="button" className="outline" onClick={() => { setMeasurements({}); setEnvironment(null); markChanged(); }}>{t("Alle Werte leeren", "Clear all values")}</button></div>{environment && <Notice>
          {t("Rohdaten für Simulation", "Raw data for simulation")}: {environment.lat}, {environment.lon}. {t("Wetter", "Weather")}: {environmentTimestamp(environment.current.weatherTimestamp)}; {t("Luft", "Air")}: {environmentTimestamp(environment.current.airTimestamp)}; {t("Pollen", "Pollen")}: {environmentTimestamp(environment.current.pollenTimestamp)}. {t("Keine Aktualitätsprüfung beim Import: Werte vor dem Test prüfen. Keine Patientenwarnung. Fehlende Werte bleiben unbekannt.", "No freshness check on import: verify values before testing. Not a patient warning. Missing values remain unknown.")}
        </Notice>}
      </section>
      <div className="api-simulation-submit"><p><ShieldCheck size={18} aria-hidden="true" />{t("Simulation verändert keine Patientenprofile und veröffentlicht keine Regeln.", "Simulation does not change patient profiles or publish rules.")}</p><button type="submit" className="primary"><FlaskConical size={18} aria-hidden="true" />{busy ? t("Java-Anfrage läuft …", "Java request in progress …") : t("Auf Java-Server simulieren", "Simulate on Java server")}</button></div>
    </fieldset></form>
    {result && <section className="card api-panel" aria-live="polite"><h2>{t("Java-Ergebnis", "Java result")} · {formatDate(result.timestamp, language)}</h2>{(stale || currentRules !== ruleSnapshot) && <Notice error>{t("Eingaben oder Regelstand geändert. Dieses Ergebnis gehört zur vorherigen Anfrage; erneut simulieren.", "Inputs or rules have changed. This result belongs to the previous request; run the simulation again.")}</Notice>}
      <p><b>{result.input.ruleIds ? t("ENTWURFSTEST", "DRAFT TEST") : t("VERÖFFENTLICHTE VERSIONEN", "PUBLISHED VERSIONS")}</b> · {t("Status", "Status")}: {evaluationStatus[result.response.status]}</p>
      <p>{result.response.coverage.applicableRules} {t("anwendbar", "applicable")} · {result.response.coverage.matchedRules} {t("ausgelöst", "matched")} · {result.response.coverage.unknownRules} {t("unbekannt", "unknown")} · {result.response.coverage.totalRules} {t("Regeln insgesamt", "rules in total")}</p>
      {(result.response.status === "NO_RULES" || result.response.status === "NO_APPLICABLE_RULES") && <Notice error>{t("Keine anwendbaren Regeln vorhanden. Das ist keine Entwarnung.", "No applicable rules available. This is not an all-clear.")}</Notice>}
      {!result.response.complete && <Notice error>{t("Keine vollständige Beurteilung möglich. Auch eine gemeldete grüne Teilbelastung ist keine Entwarnung.", "A complete assessment is not possible. Even a reported partial green burden is not an all-clear.")}</Notice>}
      <p>{t("Gemeldete Gesamtbelastung", "Reported overall burden")}: <b>{result.response.overallSeverity === null ? t("Nicht bestimmt — keine Entwarnung", "Not determined — not an all-clear") : severities[result.response.overallSeverity]}</b></p>
      {!result.response.results.length && <Notice>{t("Keine Regeln ausgewertet. Daraus lässt sich keine sichere oder grüne Situation ableiten.", "No rules were evaluated. This cannot establish a safe or green situation.")}</Notice>}
      <div className="scroll"><table className="api-table"><thead><tr><th>{t("Regel / Version", "Rule / Version")}</th><th>{t("Ergebnis", "Result")}</th><th>{t("Fehlende Werte / Details", "Missing values / Details")}</th></tr></thead><tbody>{result.response.results.map((item, index) => <tr key={`${item.ruleId}-${index}`}><td>{item.name}<br /><small>{t("Version", "Version")} {item.version}</small></td><td><b>{item.outcome === "UNKNOWN" ? t("UNKNOWN — unbekannt", "UNKNOWN — unknown") : item.outcome === "MATCH" ? t("MATCH — zutreffend", "MATCH — matches") : t("NO_MATCH — nicht zutreffend", "NO_MATCH — does not match")}</b><br />{item.severity === null ? t("Keine Belastung bestimmt", "No burden determined") : severities[item.severity]}</td><td>{item.missingParameters?.map(missingParameterLabel).join(", ") || "—"}<JsonDetail value={item.conditions} label={t("Bedingungsdetails vom Server", "Condition details from the server")} /></td></tr>)}</tbody></table></div>
      <h3>{t("Warnungen", "Warnings")} ({result.response.warnings.length})</h3>{result.response.warnings.map((item, index) => <JsonDetail key={index} value={item} label={`${t("Warnung", "Warning")} ${index + 1}`} />)}
      <h3>{t("Empfehlungen", "Recommendations")} ({result.response.recommendations.length})</h3>{result.response.recommendations.map((item, index) => <pre className="api-json" key={index}>{typeof item === "string" ? item : JSON.stringify(item, null, 2)}</pre>)}
      <JsonDetail value={result.input} label={t("Ausgewertete Anfrage", "Evaluated request")} /><JsonDetail value={result.response} label={t("Vollständige Java-Antwort", "Full Java response")} />
    </section>}
  </section>;
}
