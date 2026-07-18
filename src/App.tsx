import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cloud,
  X,
  FileText,
  FolderKanban,
  Lock,
  MessageCircle,
  Mic,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { trackEvent } from './api/analytics';
import { loadSettings, processBrainDump, saveSettings, type BackendSettings } from './api/client';
import { getPublicAdminBackupPlan, getPublicAdminMetrics, getPublicAdminReadiness } from './api/publicClient';
import {
  connectPublicWorkspace,
  deletePublicAccountRecords,
  disconnectPublicWorkspace,
  redeemPublicBetaAccess,
  refreshPublicBetaAccess,
  refreshPublicWorkspace
} from './api/publicConnection';
import { loadWorkspace } from './api/workspace';
import { parseBrainDump } from './lib/parser';
import { betaAccessMailto, betaFeedbackMailto, feedbackMailto, supportEmail, supportRequestMailto } from './lib/support';
import type { BrainDumpResponse, ParsedAction, UserWorkspace } from './lib/types';
import type { BetaAccessStatus } from './api/publicContract';
import type { AnalyticsMetrics } from './server/analyticsStore';
import type { BackupPlan } from './server/backupPlan';
import type { ReadinessReport } from './server/readinessReport';

const groups = [
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'work_task', label: 'Work Tasks', icon: ClipboardList },
  { key: 'personal_task', label: 'Personal Tasks', icon: CheckCircle2 },
  { key: 'project', label: 'Projects', icon: FolderKanban },
  { key: 'waiting', label: 'Waiting On', icon: UserCheck },
  { key: 'needs_review', label: 'Needs Review', icon: AlertTriangle },
  { key: 'error', label: 'Errors', icon: AlertTriangle }
] as const;

export function App() {
  const route = useRoute();

  if (route === '/privacy') return <PrivacyPage />;
  if (route === '/terms') return <TermsPage />;
  if (route === '/support') return <SupportPage />;
  if (route === '/data-deletion') return <DataDeletionPage />;
  if (route === '/feedback') return <FeedbackPage />;
  if (route === '/beta') return <BetaPage />;
  if (route === '/operator') return <OperatorPage />;
  if (route === '/app') return <ProductApp />;
  return <HomePage />;
}

function useRoute() {
  const [route, setRoute] = useState(() => normalizedPath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(normalizedPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return route;
}

function ProductApp() {
  const [text, setText] = useState(() => localStorage.getItem('brain-dump-draft') ?? '');
  const [result, setResult] = useState<BrainDumpResponse | null>(null);
  const [preview, setPreview] = useState<BrainDumpResponse | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BackendSettings>(() => loadSettings());
  const [workspace, setWorkspace] = useState<UserWorkspace>(() => loadWorkspace());
  const [connectionNotice, setConnectionNotice] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccountData, setDeletingAccountData] = useState(false);
  const [betaAccess, setBetaAccess] = useState<BetaAccessStatus>({ required: false, granted: true });
  const [betaAccessCode, setBetaAccessCode] = useState('');
  const [isRedeemingBetaAccess, setRedeemingBetaAccess] = useState(false);
  const refreshGeneration = useRef(0);

  useEffect(() => {
    if (settings.backendMode !== 'public' || !settings.publicApiBaseUrl) return;
    const generation = ++refreshGeneration.current;

    trackEvent({ name: 'app_opened', mode: settings.backendMode });

    Promise.all([refreshPublicBetaAccess(settings), refreshPublicWorkspace(settings)])
      .then(([refreshedAccess, refreshedWorkspace]) => {
        if (generation !== refreshGeneration.current) return;
        if (refreshedAccess) setBetaAccess(refreshedAccess);
        if (refreshedWorkspace) setWorkspace(refreshedWorkspace);
      })
      .catch(() => {
        if (generation !== refreshGeneration.current) return;
        setWorkspace({ status: 'not_connected', destinations: [] });
      });
  }, [settings]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const connected = url.searchParams.get('connected');
    const connection = url.searchParams.get('connection');
    const reason = url.searchParams.get('reason');
    if (!connected && !connection) return;

    if (connected === 'google') {
      setConnectionNotice('Google connected. Your workspace is ready for reviewed actions.');
      trackEvent({ name: 'connect_completed', mode: 'public' });
    } else if (connection === 'error') {
      setError(reason ? `Google connection failed: ${reason}` : 'Google connection failed. Try connecting again.');
      trackEvent({ name: 'connect_failed', mode: 'public', errorCount: 1 });
    }

    url.searchParams.delete('connected');
    url.searchParams.delete('connection');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const groupedActions = useMemo(() => {
    const map = new Map<string, ParsedAction[]>();
    groups.forEach((group) => map.set(group.key, []));
    (result ?? preview)?.actions.forEach((action) => {
      const groupKey = action.status === 'error' || action.status === 'needs_review' ? action.status : action.type;
      map.get(groupKey)?.push(action);
    });
    return map;
  }, [preview, result]);

  function handleReview() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Add something to your brain dump first.');
      return;
    }
    setError('');
    setResult(null);
    const parsed = parseBrainDump(trimmed, crypto.randomUUID());
    setPreview(parsed);
    trackEvent({
      name: 'review_created',
      requestId: parsed.requestId,
      mode: settings.backendMode,
      summary: parsed.summary,
      actionCount: parsed.actions.length
    });
  }

  async function handleCreate() {
    const trimmed = text.trim();
    const reviewed = preview;
    if (!trimmed || !reviewed) {
      handleReview();
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await processBrainDump({
        requestId: reviewed.requestId,
        text: trimmed,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        approvedActions: reviewed.actions
      });
      setResult(response);
      setPreview(null);
      setText('');
      localStorage.removeItem('brain-dump-draft');
      trackEvent({
        name: 'create_completed',
        requestId: response.requestId,
        mode: settings.backendMode,
        summary: response.summary,
        actionCount: response.actions.length,
        errorCount: response.errors.length
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Brain Dump could not process that.');
      localStorage.setItem('brain-dump-draft', text);
      trackEvent({
        name: 'create_failed',
        requestId: reviewed.requestId,
        mode: settings.backendMode,
        actionCount: reviewed.actions.length,
        errorCount: 1
      });
    } finally {
      setProcessing(false);
    }
  }

  function handleDraft(value: string) {
    setText(value);
    setPreview(null);
    setResult(null);
    localStorage.setItem('brain-dump-draft', value);
  }

  function handleRemovePreviewAction(actionToRemove: ParsedAction) {
    setPreview((current) => (current ? removePreviewAction(current, actionToRemove) : current));
  }

  function handleSettingsSubmit(event: FormEvent) {
    event.preventDefault();
    saveSettings(settings);
    setShowSettings(false);
  }

  async function handleConnectPublic() {
    setError('');
    if (settings.backendMode === 'public' && settings.publicApiBaseUrl && betaAccess.required && !betaAccess.granted) {
      setError('Enter your beta access code before connecting Google.');
      return;
    }
    trackEvent({ name: 'connect_started', mode: settings.backendMode });
    try {
      const connectedWorkspace = await connectPublicWorkspace(settings);
      if (connectedWorkspace) setWorkspace(connectedWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google connection.');
    }
  }

  async function handleRedeemBetaAccess(event: FormEvent) {
    event.preventDefault();
    const code = betaAccessCode.trim();
    if (!code) {
      setError('Enter your beta access code.');
      return;
    }

    setRedeemingBetaAccess(true);
    setError('');
    try {
      const access = await redeemPublicBetaAccess(settings, code);
      if (access) setBetaAccess(access);
      setBetaAccessCode('');
      setConnectionNotice('Beta access confirmed. You can connect Google when ready.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm beta access.');
    } finally {
      setRedeemingBetaAccess(false);
    }
  }

  async function handleDisconnectPublic() {
    setError('');
    try {
      refreshGeneration.current += 1;
      setWorkspace(await disconnectPublicWorkspace(settings));
      trackEvent({ name: 'disconnect_completed', mode: settings.backendMode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect Google.');
    }
  }

  async function handleDeleteAccountData() {
    if (deleteConfirmation !== 'DELETE') return;

    setDeletingAccountData(true);
    setError('');
    try {
      refreshGeneration.current += 1;
      setWorkspace(await deletePublicAccountRecords(settings));
      setPreview(null);
      setResult(null);
      setConnectionNotice('Stored Brain Dump account records were deleted for this browser session.');
      setShowSettings(false);
      setDeleteConfirmation('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete stored account records.');
    } finally {
      setDeletingAccountData(false);
    }
  }

  return (
    <main className="appShell">
      <header className="brandHeader">
        <img src="/icons/brain-dump-icon-180.png" alt="" />
        <div>
          <h1>Brain Dump</h1>
          <p>Get it out. We'll handle the rest.</p>
        </div>
        <button className="iconButton" type="button" aria-label="Settings" onClick={() => setShowSettings(true)}>
          <Settings size={22} />
        </button>
      </header>

      <section className="capturePanel">
        <h2>What's on your mind?</h2>
        <SetupPanel
          mode={settings.backendMode}
          hasPublicApi={Boolean(settings.publicApiBaseUrl)}
          betaAccess={betaAccess}
          workspace={workspace}
          onConnect={handleConnectPublic}
          onDisconnect={handleDisconnectPublic}
          onOpenSettings={() => setShowSettings(true)}
        />
        {settings.backendMode === 'public' && settings.publicApiBaseUrl && betaAccess.required && !betaAccess.granted && (
          <BetaAccessPanel
            code={betaAccessCode}
            isSubmitting={isRedeemingBetaAccess}
            onCodeChange={setBetaAccessCode}
            onSubmit={handleRedeemBetaAccess}
          />
        )}
        {connectionNotice && <div className="successCard">{connectionNotice}</div>}
        <textarea
          value={text}
          onChange={(event) => handleDraft(event.target.value)}
          placeholder="Put everything here. Do not organize it."
          disabled={isProcessing}
        />
        <div className="actionRow">
          <button className="secondaryButton" type="button" onClick={() => document.querySelector('textarea')?.focus()}>
            <Mic size={19} />
            Dictate
          </button>
          {preview ? (
            <button
              className="processButton"
              type="button"
              onClick={handleCreate}
              disabled={isProcessing || preview.actions.length === 0}
            >
              <Sparkles size={20} />
              {isProcessing ? 'Creating' : 'Create'}
            </button>
          ) : (
            <button className="processButton" type="button" onClick={handleReview} disabled={isProcessing}>
              <Sparkles size={20} />
              Review
            </button>
          )}
        </div>
      </section>

      {(error || preview || result) && (
        <section className="resultsPanel" aria-live="polite">
          {error && (
            <>
              <div className="errorCard">{error}</div>
              <RecoveryPanel
                canRetry={Boolean(preview)}
                isProcessing={isProcessing}
                onRetry={handleCreate}
                context="Processing error"
              />
            </>
          )}
          {(preview || result) && (
            <>
              {preview && (
                <div className="reviewBanner">
                  <strong>Review before creating</strong>
                  <span>Nothing has been sent to Google yet. Edit the text above or create these actions.</span>
                </div>
              )}
              <div className="summaryGrid">
                <Summary label="Calendar" value={(result ?? preview)?.summary.calendar ?? 0} />
                <Summary label="Work" value={(result ?? preview)?.summary.workTasks ?? 0} />
                <Summary label="Personal" value={(result ?? preview)?.summary.personalTasks ?? 0} />
                <Summary label="Projects" value={(result ?? preview)?.summary.projects ?? 0} />
                <Summary label="Waiting" value={(result ?? preview)?.summary.waiting ?? 0} />
                <Summary label="Review" value={(result ?? preview)?.summary.needsReview ?? 0} />
              </div>

              {groups.map((group) => {
                const actions = groupedActions.get(group.key) ?? [];
                if (!actions.length) return null;
                const Icon = group.icon;
                return (
                  <article className="resultGroup" key={group.key}>
                    <h3>
                      <Icon size={18} />
                      {group.label}
                    </h3>
                    {actions.map((action) => (
                      <div className="resultItem" key={`${action.type}-${action.title}-${action.sourceText}`}>
                        <strong>{action.title}</strong>
                        <span>{action.notes}</span>
                        {preview && (
                          <button
                            className="removeActionButton"
                            type="button"
                            aria-label={`Remove ${action.title}`}
                            onClick={() => handleRemovePreviewAction(action)}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </article>
                );
              })}
              {result?.errors.length ? <ResultRecoveryPanel result={result} /> : null}
              {result && <FeedbackPanel result={result} />}
            </>
          )}
        </section>
      )}

      <footer>
        <Lock size={15} />
        Your data stays private and secure.
      </footer>

      {showSettings && (
        <div className="modalBackdrop" role="presentation">
          <form className="settingsModal" onSubmit={handleSettingsSubmit}>
            <h2>Settings</h2>
            <fieldset>
              <legend>Backend mode</legend>
              <label className="radioOption">
                <input
                  checked={settings.backendMode === 'mock'}
                  onChange={() => setSettings({ ...settings, backendMode: 'mock' })}
                  name="backendMode"
                  type="radio"
                />
                Mock preview
              </label>
              <label className="radioOption">
                <input
                  checked={settings.backendMode === 'public'}
                  onChange={() => setSettings({ ...settings, backendMode: 'public' })}
                  name="backendMode"
                  type="radio"
                />
                Public Google account setup
              </label>
              <label className="radioOption">
                <input
                  checked={settings.backendMode === 'private_apps_script'}
                  onChange={() => setSettings({ ...settings, backendMode: 'private_apps_script' })}
                  name="backendMode"
                  type="radio"
                />
                Private CSOS Apps Script bridge
              </label>
            </fieldset>
            <label>
              Public API URL
              <input
                value={settings.publicApiBaseUrl}
                onChange={(event) => setSettings({ ...settings, publicApiBaseUrl: event.target.value })}
                disabled={settings.backendMode !== 'public'}
                placeholder="https://api.example.com"
              />
            </label>
            <label>
              Private bridge URL
              <input
                value={settings.backendUrl}
                onChange={(event) => setSettings({ ...settings, backendUrl: event.target.value })}
                disabled={settings.backendMode !== 'private_apps_script'}
                placeholder="Apps Script web app URL"
              />
            </label>
            <label>
              Private shared secret
              <input
                value={settings.sharedSecret}
                onChange={(event) => setSettings({ ...settings, sharedSecret: event.target.value })}
                disabled={settings.backendMode !== 'private_apps_script'}
                type="password"
                placeholder="Optional during development"
              />
            </label>
            {settings.backendMode === 'public' && (
              <section className="dangerZone" aria-label="Account data deletion">
                <h3>Account data</h3>
                <p>
                  Delete stored Brain Dump records for the signed-in Google account. This does not delete Google Tasks or
                  Calendar events already created.
                </p>
                <label>
                  Type DELETE to confirm
                  <input
                    value={deleteConfirmation}
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    placeholder="DELETE"
                  />
                </label>
                <button
                  type="button"
                  className="dangerButton"
                  disabled={deleteConfirmation !== 'DELETE' || isDeletingAccountData}
                  onClick={handleDeleteAccountData}
                >
                  {isDeletingAccountData ? 'Deleting' : 'Delete account data'}
                </button>
              </section>
            )}
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button type="submit" className="processButton">
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function removePreviewAction(response: BrainDumpResponse, actionToRemove: ParsedAction): BrainDumpResponse {
  const actions = response.actions.filter((action) => action !== actionToRemove);
  return {
    ...response,
    summary: {
      calendar: actions.filter((action) => action.type === 'calendar').length,
      workTasks: actions.filter((action) => action.type === 'work_task').length,
      personalTasks: actions.filter((action) => action.type === 'personal_task').length,
      projects: actions.filter((action) => action.type === 'project').length,
      waiting: actions.filter((action) => action.type === 'waiting').length,
      needsReview: actions.filter((action) => action.type === 'needs_review').length
    },
    actions
  };
}

function HomePage() {
  return (
    <main className="publicShell">
      <PublicNav />
      <section className="homeHero">
        <div className="homeHeroCopy">
          <img className="heroLogo" src="/icons/brain-dump-icon-180.png" alt="" />
          <h1>Brain Dump</h1>
          <p className="heroTagline">Get it out. We'll handle the rest.</p>
          <p className="heroLead">
            Turn messy thoughts into Google Tasks, calendar events, projects, and follow-ups in your own connected
            workspace.
          </p>
          <div className="heroActions">
            <a className="processButton linkButton" href="/app">
              Open app
              <ArrowRight size={19} />
            </a>
            <a className="secondaryButton linkButton" href="/beta">
              Join beta
            </a>
            <a className="secondaryButton linkButton" href="/privacy">
              Privacy
            </a>
          </div>
        </div>
        <div className="productPreview" aria-label="Brain Dump preview">
          <div className="previewInput">
            <span>Pay employees tomorrow.</span>
            <span>Lunch with Jack Thursday at noon; put on calendar.</span>
            <span>Waiting on Aaron to send estimate.</span>
          </div>
          <div className="previewResults">
            <PreviewRow icon={ClipboardList} label="Work task" value="Pay employees" />
            <PreviewRow icon={CalendarDays} label="Calendar" value="Lunch with Jack" />
            <PreviewRow icon={UserCheck} label="Waiting on" value="Aaron estimate" />
          </div>
        </div>
      </section>

      <section className="publicBand">
        <article>
          <ClipboardList size={26} />
          <h2>Capture first</h2>
          <p>Drop in scattered thoughts without sorting them first.</p>
        </article>
        <article>
          <CalendarDays size={26} />
          <h2>Route clearly</h2>
          <p>Explicit tasks and events go to the places users already check.</p>
        </article>
        <article>
          <ShieldCheck size={26} />
          <h2>Stay private</h2>
          <p>Each user connects their own Google account and can disconnect it.</p>
        </article>
      </section>

      <section className="publicContent">
        <h2>Built for beta</h2>
        <p>
          Brain Dump is preparing for a private beta with Google Tasks and Google Calendar. Email sending is not part of
          beta; ambiguous items are held for review instead of being sent or scheduled automatically.
        </p>
        <div className="publicLinkGrid">
          <a href="/privacy">
            <ShieldCheck size={20} />
            Privacy policy
          </a>
          <a href="/terms">
            <FileText size={20} />
            Terms of service
          </a>
          <a href="/app">
            <Sparkles size={20} />
            Try preview mode
          </a>
          <a href="/support">
            <MessageCircle size={20} />
            Beta support
          </a>
          <a href="/feedback">
            <UserCheck size={20} />
            Feedback form
          </a>
          <a href="/beta">
            <ArrowRight size={20} />
            Join beta
          </a>
        </div>
      </section>
    </main>
  );
}

function PrivacyPage() {
  return (
    <PublicDocument
      title="Privacy Policy"
      subtitle="Draft for beta planning. Final public launch language should be reviewed before broad release."
    >
      <h2>Overview</h2>
      <p>
        Brain Dump helps users turn free-form notes into tasks, calendar events, projects, and waiting-on reminders. The
        app connects to a user's Google account only after the user grants permission.
      </p>
      <h2>Information collected</h2>
      <ul>
        <li>Email address and basic Google profile information.</li>
        <li>Brain dump text submitted by the user and parsed actions created from that text.</li>
        <li>OAuth tokens needed to keep the user's Google account connected.</li>
        <li>Execution logs showing what Brain Dump attempted to create.</li>
      </ul>
      <h2>Google user data</h2>
      <p>
        Brain Dump uses Google user data only to provide user-facing app functionality. It does not sell Google user
        data, use it for advertising, or share it with unrelated third parties.
      </p>
      <h2>Current Google access</h2>
      <ul>
        <li>Sign-in profile and email.</li>
        <li>Google Tasks access to create task lists and tasks.</li>
        <li>Google Calendar event access to create requested events.</li>
      </ul>
      <h2>User controls</h2>
      <p>
        Users can disconnect Google, stop using the app, request deletion of stored account records, and delete tasks or
        calendar events directly in their Google account.
      </p>
      <p>
        Data deletion instructions are available at <a href="/data-deletion">/data-deletion</a>.
      </p>
      <h2>Contact</h2>
      <p>
        Support email: <a href={supportRequestMailto('Privacy policy')}>{supportEmail}</a>.
      </p>
    </PublicDocument>
  );
}

function TermsPage() {
  return (
    <PublicDocument
      title="Terms of Service"
      subtitle="Draft for beta planning. Final public launch language should be reviewed before broad release."
    >
      <h2>Service</h2>
      <p>
        Brain Dump helps users organize free-form text into tasks, calendar events, projects, and waiting-on reminders.
      </p>
      <h2>Beta status</h2>
      <p>
        During beta, Brain Dump is experimental. Features may change, fail, or be removed. Users should review created
        tasks and calendar events for accuracy.
      </p>
      <h2>User responsibilities</h2>
      <ul>
        <li>Review created tasks and calendar events.</li>
        <li>Keep their Google account secure.</li>
        <li>Disconnect Brain Dump if they no longer want it connected.</li>
      </ul>
      <h2>Google account access</h2>
      <p>
        Brain Dump connects to Google only after the user grants permission. Users can revoke access through Brain Dump
        or their Google Account settings.
      </p>
      <h2>No automatic email sending</h2>
      <p>
        Brain Dump does not send email during beta. Email-like requests should be captured for review instead of being
        sent automatically.
      </p>
      <h2>Contact</h2>
      <p>
        Support email: <a href={supportRequestMailto('Terms of service')}>{supportEmail}</a>.
      </p>
    </PublicDocument>
  );
}

function SupportPage() {
  return (
    <PublicDocument
      title="Support"
      subtitle="Help for beta users, Google account connection, and data requests."
    >
      <h2>Contact</h2>
      <p>
        Email <a href={supportRequestMailto('Support page')}>{supportEmail}</a> with what happened and what you expected.
        Include screenshots only if you are comfortable sharing them.
      </p>
      <h2>What to include</h2>
      <ul>
        <li>Your Google account email used with Brain Dump.</li>
        <li>Approximate time of the issue.</li>
        <li>Whether you were connecting Google, reviewing actions, creating items, or disconnecting.</li>
        <li>The expected result and the actual result.</li>
      </ul>
      <h2>Account and data requests</h2>
      <p>
        You can disconnect Google inside the app. For stored account deletion or privacy questions, email support with
        "Data request" in the subject.
      </p>
      <p>
        Full deletion instructions are available at <a href="/data-deletion">/data-deletion</a>.
      </p>
      <h2>Security</h2>
      <p>
        Never send Google passwords, OAuth tokens, or unredacted private calendar screenshots. Brain Dump support will
        not ask for your Google password.
      </p>
    </PublicDocument>
  );
}

function DataDeletionPage() {
  return (
    <PublicDocument
      title="Data Deletion"
      subtitle="How beta users can disconnect Google and request deletion of stored Brain Dump records."
    >
      <h2>Disconnect Google</h2>
      <p>
        Open Brain Dump, go to the setup panel, and choose Disconnect. Disconnecting removes the stored OAuth tokens and
        workspace connection records Brain Dump uses for future writes.
      </p>
      <h2>Request stored record deletion</h2>
      <p>
        Email <a href={supportRequestMailto('Data deletion request')}>{supportEmail}</a> with "Data deletion request" in
        the subject and include the Google account email you used with Brain Dump.
      </p>
      <p>
        The public backend also supports signed-in account deletion at <code>/api/account/delete</code>. This clears the
        stored Brain Dump records associated with the current session.
      </p>
      <h2>What can be deleted</h2>
      <ul>
        <li>Stored session records associated with your account.</li>
        <li>Stored OAuth tokens and workspace connection records.</li>
        <li>Execution logs, idempotency records, and beta analytics associated with your account where technically available.</li>
      </ul>
      <h2>What Brain Dump cannot delete</h2>
      <p>
        Disconnecting or deleting Brain Dump records does not remove tasks or calendar events already created in your
        Google account. You can delete those directly in Google Tasks or Google Calendar.
      </p>
    </PublicDocument>
  );
}

function FeedbackPage() {
  return (
    <PublicDocument
      title="Beta Feedback"
      subtitle="Three quick questions for first-run testers after they try Brain Dump."
    >
      <h2>What to send</h2>
      <ol>
        <li>What looked right?</li>
        <li>What looked wrong or confusing?</li>
        <li>What did you expect Brain Dump to do instead?</li>
      </ol>
      <h2>Helpful context</h2>
      <p>
        Include your Google account email and the approximate time of your test if you connected Google. Do not send
        passwords, OAuth tokens, or private screenshots unless you are comfortable sharing them.
      </p>
      <h2>Send feedback</h2>
      <p>
        Email <a href={betaFeedbackMailto()}>{supportEmail}</a> with your answers. The app also adds a feedback link
        after each completed run with the request ID and action summary already filled in.
      </p>
    </PublicDocument>
  );
}

function BetaPage() {
  return (
    <PublicDocument
      title="Join The Beta"
      subtitle="A small first-user beta for people who want messy notes turned into reviewed Google tasks and calendar events."
    >
      <h2>Who it is for</h2>
      <p>
        Brain Dump beta is for people who already use Google Tasks or Google Calendar and want a faster way to capture
        scattered thoughts before sorting them.
      </p>
      <h2>What beta users can expect</h2>
      <ul>
        <li>Preview mode works before connecting Google.</li>
        <li>Google connection is per user; Brain Dump does not use the founder's workspace.</li>
        <li>Tasks and clear calendar events are reviewed before creation.</li>
        <li>Ambiguous items stay in Needs Review instead of being created automatically.</li>
        <li>Email sending is not part of the beta.</li>
      </ul>
      <h2>Request access</h2>
      <p>
        Email <a href={betaAccessMailto()}>{supportEmail}</a> with your name, the task/calendar tools you use now, and
        whether you are comfortable connecting Google Tasks and Google Calendar during beta.
      </p>
    </PublicDocument>
  );
}

type OperatorSnapshot = {
  metrics: AnalyticsMetrics;
  readiness: ReadinessReport;
  backupPlan: BackupPlan;
};

function OperatorPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('brain-dump-admin-token') ?? '');
  const [snapshot, setSnapshot] = useState<OperatorSnapshot | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(false);

  async function handleLoad(event: FormEvent) {
    event.preventDefault();
    const publicApiBaseUrl = settings.publicApiBaseUrl.trim();
    const token = adminToken.trim();
    if (!publicApiBaseUrl) {
      setError('Add the public API URL first.');
      return;
    }
    if (!token) {
      setError('Add the admin token first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [metrics, readiness, backupPlan] = await Promise.all([
        getPublicAdminMetrics(publicApiBaseUrl, token),
        getPublicAdminReadiness(publicApiBaseUrl, token),
        getPublicAdminBackupPlan(publicApiBaseUrl, token)
      ]);
      localStorage.setItem('brain-dump-admin-token', token);
      saveSettings(settings);
      setSnapshot({ metrics, readiness, backupPlan });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load operator dashboard.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="operatorShell">
      <header className="operatorHeader">
        <a className="navBrand" href="/">
          <img src="/icons/brain-dump-icon-180.png" alt="" />
          <span>Brain Dump</span>
        </a>
        <a href="/app">Open app</a>
      </header>

      <section className="operatorIntro">
        <div>
          <h1>Operator Dashboard</h1>
          <p>Launch readiness, beta analytics, and backup posture from protected backend endpoints.</p>
        </div>
        {snapshot?.readiness.ready ? <span className="operatorBadge ready">Ready</span> : <span className="operatorBadge">Not ready</span>}
      </section>

      <form className="operatorControls" onSubmit={handleLoad}>
        <label>
          Public API URL
          <input
            value={settings.publicApiBaseUrl}
            onChange={(event) => setSettings({ ...settings, publicApiBaseUrl: event.target.value })}
            placeholder="https://api.braindump.app"
          />
        </label>
        <label>
          Admin token
          <input
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            type="password"
            placeholder="BRAIN_DUMP_ADMIN_TOKEN"
          />
        </label>
        <button className="processButton" type="submit" disabled={isLoading}>
          <ShieldCheck size={18} />
          {isLoading ? 'Loading' : 'Refresh'}
        </button>
      </form>

      {error && <div className="errorCard">{error}</div>}

      {snapshot ? (
        <section className="operatorGrid" aria-live="polite">
          <OperatorMetric label="Events" value={snapshot.metrics.totalEvents} />
          <OperatorMetric label="Users" value={snapshot.metrics.uniqueUsers} />
          <OperatorMetric label="Requests" value={snapshot.metrics.uniqueRequests} />
          <OperatorMetric label="Actions" value={snapshot.metrics.totalActions} />
          <OperatorMetric label="Errors" value={snapshot.metrics.totalErrors} warning={snapshot.metrics.totalErrors > 0} />
          <OperatorMetric label="Latest Event" value={snapshot.metrics.latestEventAt ? shortDateTime(snapshot.metrics.latestEventAt) : 'None'} />

          <article className="operatorPanel widePanel">
            <h2>Readiness</h2>
            <div className="readinessList">
              {snapshot.readiness.checks.map((check) => (
                <div className={check.ready ? 'readyItem' : 'blockedItem'} key={check.key}>
                  <CheckCircle2 size={17} />
                  <div>
                    <strong>{check.label}</strong>
                    <span>{check.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="operatorPanel">
            <h2>Event Mix</h2>
            <div className="eventMix">
              {Object.entries(snapshot.metrics.byName).length ? (
                Object.entries(snapshot.metrics.byName).map(([name, value]) => (
                  <div key={name}>
                    <span>{operatorEventLabel(name)}</span>
                    <strong>{value}</strong>
                  </div>
                ))
              ) : (
                <p>No beta events yet.</p>
              )}
            </div>
          </article>

          <article className="operatorPanel">
            <h2>Backup</h2>
            <p>Storage prefix: {snapshot.backupPlan.storagePrefix}</p>
            <ul>
              {snapshot.backupPlan.sections.map((section) => (
                <li key={section.name}>{section.name}</li>
              ))}
            </ul>
          </article>

          <article className="operatorPanel widePanel">
            <h2>Operator Checklist</h2>
            <ol>
              {snapshot.backupPlan.operatorChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </article>
        </section>
      ) : (
        <section className="operatorEmpty">
          <Lock size={24} />
          <p>Enter the production API URL and admin token to load launch readiness.</p>
        </section>
      )}
    </main>
  );
}

function OperatorMetric({ label, value, warning = false }: { label: string; value: number | string; warning?: boolean }) {
  return (
    <article className={warning ? 'operatorMetric warningMetric' : 'operatorMetric'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function shortDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function operatorEventLabel(name: string): string {
  return name.replaceAll('_', ' ');
}

function PublicDocument({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="publicShell">
      <PublicNav />
      <article className="legalDocument">
        <h1>{title}</h1>
        <p className="documentSubtitle">{subtitle}</p>
        {children}
      </article>
    </main>
  );
}

function PublicNav() {
  return (
    <header className="publicNav">
      <a className="navBrand" href="/">
        <img src="/icons/brain-dump-icon-180.png" alt="" />
        <span>Brain Dump</span>
      </a>
      <nav aria-label="Public navigation">
        <a href="/app">App</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/beta">Beta</a>
        <a href="/data-deletion">Data deletion</a>
        <a href="/feedback">Feedback</a>
        <a href="/support">Support</a>
      </nav>
    </header>
  );
}

function PreviewRow({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function normalizedPath(path: string): string {
  if (
    path === '/privacy' ||
    path === '/terms' ||
    path === '/support' ||
    path === '/data-deletion' ||
    path === '/feedback' ||
    path === '/beta' ||
    path === '/operator' ||
    path === '/app'
  ) return path;
  return '/';
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="summaryCard">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}

function FeedbackPanel({ result }: { result: BrainDumpResponse }) {
  return (
    <div className="feedbackPanel">
      <div>
        <strong>Help shape the beta</strong>
        <span>Tell us what Brain Dump routed well, what it missed, and what you expected instead.</span>
      </div>
      <a href={feedbackMailto(result)}>
        <MessageCircle size={17} />
        Send feedback
      </a>
    </div>
  );
}

function RecoveryPanel({
  canRetry,
  isProcessing,
  onRetry,
  context
}: {
  canRetry: boolean;
  isProcessing: boolean;
  onRetry: () => void;
  context: string;
}) {
  return (
    <div className="feedbackPanel">
      <div>
        <strong>{canRetry ? 'Nothing was created yet' : 'Need help?'}</strong>
        <span>
          {canRetry
            ? 'Your reviewed actions are still here. Try again, or send support the error and what you expected.'
            : 'Send what happened and what you expected. Include screenshots only if you are comfortable.'}
        </span>
      </div>
      <div className="feedbackActions">
        {canRetry && (
          <button className="secondaryButton smallButton" type="button" disabled={isProcessing} onClick={onRetry}>
            <Sparkles size={17} />
            {isProcessing ? 'Retrying' : 'Retry'}
          </button>
        )}
        <a href={supportRequestMailto(context)}>
          <MessageCircle size={17} />
          Contact support
        </a>
      </div>
    </div>
  );
}

function ResultRecoveryPanel({ result }: { result: BrainDumpResponse }) {
  return (
    <div className="feedbackPanel warningPanel">
      <div>
        <strong>Some items need attention</strong>
        <span>
          Brain Dump finished the request, but Google or the workspace reported an issue. Check the Errors section before
          trying those items again.
        </span>
      </div>
      <a href={feedbackMailto(result)}>
        <MessageCircle size={17} />
        Send report
      </a>
    </div>
  );
}

function SetupPanel({
  mode,
  hasPublicApi,
  betaAccess,
  workspace,
  onConnect,
  onDisconnect,
  onOpenSettings
}: {
  mode: BackendSettings['backendMode'];
  hasPublicApi: boolean;
  betaAccess: BetaAccessStatus;
  workspace: UserWorkspace;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}) {
  const isConnected = workspace.status === 'connected';
  const statusLabel = setupStatusLabel(mode, hasPublicApi, workspace, betaAccess);
  const steps = setupSteps(mode, hasPublicApi, workspace, betaAccess);
  const needsBetaAccess = mode === 'public' && hasPublicApi && betaAccess.required && !betaAccess.granted;

  if (mode === 'mock') {
    return (
      <OnboardingPanel
        title="Preview mode"
        description="Brain Dump will show where items would go without touching Google."
        statusLabel={statusLabel}
        steps={steps}
        action={
          <button type="button" onClick={onOpenSettings}>
            <Settings size={16} />
            Setup
          </button>
        }
      />
    );
  }

  if (mode === 'public') {
    return (
      <OnboardingPanel
        title={
          needsBetaAccess
            ? 'Beta access required'
            : isConnected
              ? hasPublicApi
                ? 'Google workspace connected'
                : 'Demo Google workspace connected'
              : 'Connect Google'
        }
        description={
          needsBetaAccess
            ? 'Enter your beta access code before connecting a Google account.'
            : isConnected
            ? workspace.email ?? 'Ready to create reviewed actions.'
            : hasPublicApi
              ? 'Each user connects their own Google account before Brain Dump creates anything.'
              : 'Use a safe demo workspace now, then add the public API URL before inviting real users.'
        }
        statusLabel={statusLabel}
        steps={steps}
        destinations={isConnected ? workspace.destinations.map((destination) => destination.name) : []}
        action={
          needsBetaAccess ? undefined : isConnected ? (
            <button type="button" onClick={onDisconnect}>
              <Cloud size={16} />
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={onConnect}>
              <Cloud size={16} />
              {hasPublicApi ? 'Connect' : 'Demo'}
            </button>
          )
        }
      />
    );
  }

  return (
    <OnboardingPanel
      title="Private bridge mode"
      description="Routes to one configured Apps Script bridge for CSOS testing."
      statusLabel={statusLabel}
      steps={steps}
      action={
        <button type="button" onClick={onOpenSettings}>
          <Settings size={16} />
          Edit
        </button>
      }
    />
  );
}

function BetaAccessPanel({
  code,
  isSubmitting,
  onCodeChange,
  onSubmit
}: {
  code: string;
  isSubmitting: boolean;
  onCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="betaAccessPanel" onSubmit={onSubmit}>
      <div>
        <strong>Private beta access</strong>
        <span>Enter the access code from your invitation before connecting Google.</span>
      </div>
      <label>
        Access code
        <input
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="Beta access code"
          autoComplete="one-time-code"
        />
      </label>
      <button className="processButton smallButton" type="submit" disabled={isSubmitting}>
        <Lock size={16} />
        {isSubmitting ? 'Checking' : 'Unlock'}
      </button>
    </form>
  );
}

function OnboardingPanel({
  title,
  description,
  statusLabel,
  steps,
  destinations = [],
  action
}: {
  title: string;
  description: string;
  statusLabel: string;
  steps: Array<{ label: string; complete: boolean }>;
  destinations?: string[];
  action?: ReactNode;
}) {
  return (
    <div className="setupPanel">
      <div className="setupPanelTop">
        <div>
          <span className="setupEyebrow">Setup progress</span>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        {action}
      </div>
      <ol className="setupSteps" aria-label="Setup progress">
        {steps.map((step) => (
          <li className={step.complete ? 'complete' : ''} key={step.label}>
            <CheckCircle2 size={15} />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <div className="setupStatus">
        <ShieldCheck size={15} />
        <span>{statusLabel}</span>
      </div>
      {destinations.length > 0 && (
        <div className="destinationList" aria-label="Google destinations">
          {destinations.map((destination) => (
            <small key={destination}>{destination}</small>
          ))}
        </div>
      )}
    </div>
  );
}

function setupStatusLabel(
  mode: BackendSettings['backendMode'],
  hasPublicApi: boolean,
  workspace: UserWorkspace,
  betaAccess: BetaAccessStatus
): string {
  if (mode === 'mock') return 'Safe preview only. No Google account is connected.';
  if (mode === 'private_apps_script') return 'Private CSOS bridge is for founder testing, not public beta users.';
  if (hasPublicApi && betaAccess.required && !betaAccess.granted) return 'Beta access code needed before Google sign-in.';
  if (workspace.status === 'connected') {
    return hasPublicApi ? 'Ready for reviewed actions in this user account.' : 'Demo-ready. Add the public API URL before inviting users.';
  }
  return hasPublicApi ? 'Ready to start Google sign-in.' : 'Public backend URL needed before real Google sign-in.';
}

function setupSteps(
  mode: BackendSettings['backendMode'],
  hasPublicApi: boolean,
  workspace: UserWorkspace,
  betaAccess: BetaAccessStatus
) {
  if (mode === 'mock') {
    return [
      { label: 'Preview parser', complete: true },
      { label: 'Review actions', complete: true },
      { label: 'Connect Google when ready', complete: false }
    ];
  }

  if (mode === 'private_apps_script') {
    return [
      { label: 'Private bridge selected', complete: true },
      { label: 'Public user account setup', complete: false },
      { label: 'Per-user Google workspace', complete: false }
    ];
  }

  const connected = workspace.status === 'connected';
  return [
    { label: hasPublicApi ? 'Public backend configured' : 'Public backend configured', complete: hasPublicApi },
    {
      label: betaAccess.required ? 'Beta access confirmed' : 'Beta gate open',
      complete: !hasPublicApi || !betaAccess.required || betaAccess.granted
    },
    { label: connected ? 'Google account connected' : 'Connect Google account', complete: connected },
    { label: connected ? 'Workspace destinations ready' : 'Workspace destinations created after sign-in', complete: connected }
  ];
}
