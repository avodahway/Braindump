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
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadSettings, processBrainDump, saveSettings, type BackendSettings } from './api/client';
import { connectPublicWorkspace, disconnectPublicWorkspace, refreshPublicWorkspace } from './api/publicConnection';
import { loadWorkspace } from './api/workspace';
import { parseBrainDump } from './lib/parser';
import { feedbackMailto, supportEmail, supportRequestMailto } from './lib/support';
import type { BrainDumpResponse, ParsedAction, UserWorkspace } from './lib/types';

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

  useEffect(() => {
    if (settings.backendMode !== 'public' || !settings.publicApiBaseUrl) return;

    refreshPublicWorkspace(settings)
      .then((refreshedWorkspace) => {
        if (refreshedWorkspace) setWorkspace(refreshedWorkspace);
      })
      .catch(() => {
        setWorkspace({ status: 'not_connected', destinations: [] });
      });
  }, [settings]);

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
    setPreview(parseBrainDump(trimmed, crypto.randomUUID()));
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Brain Dump could not process that.');
      localStorage.setItem('brain-dump-draft', text);
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
    try {
      const connectedWorkspace = await connectPublicWorkspace(settings);
      if (connectedWorkspace) setWorkspace(connectedWorkspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google connection.');
    }
  }

  async function handleDisconnectPublic() {
    setError('');
    try {
      setWorkspace(await disconnectPublicWorkspace(settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disconnect Google.');
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
          workspace={workspace}
          onConnect={handleConnectPublic}
          onDisconnect={handleDisconnectPublic}
          onOpenSettings={() => setShowSettings(true)}
        />
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
              <SupportPrompt context="Processing error" />
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
          <a href={supportRequestMailto('Public home page')}>
            <MessageCircle size={20} />
            Beta support
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
        <a href={supportRequestMailto('Public navigation')}>Support</a>
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
  if (path === '/privacy' || path === '/terms' || path === '/app') return path;
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

function SupportPrompt({ context }: { context: string }) {
  return (
    <div className="feedbackPanel">
      <div>
        <strong>Need help?</strong>
        <span>Send what happened and what you expected. Include screenshots only if you are comfortable.</span>
      </div>
      <a href={supportRequestMailto(context)}>
        <MessageCircle size={17} />
        Contact support
      </a>
    </div>
  );
}

function SetupPanel({
  mode,
  hasPublicApi,
  workspace,
  onConnect,
  onDisconnect,
  onOpenSettings
}: {
  mode: BackendSettings['backendMode'];
  hasPublicApi: boolean;
  workspace: UserWorkspace;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}) {
  if (mode === 'mock') {
    return (
      <div className="setupPanel">
        <div>
          <strong>Preview mode</strong>
          <span>Brain Dump will show where items would go without touching Google.</span>
        </div>
        <button type="button" onClick={onOpenSettings}>
          <Settings size={16} />
          Setup
        </button>
      </div>
    );
  }

  if (mode === 'public') {
    if (workspace.status === 'connected') {
      return (
        <div className="setupPanel connectedPanel">
          <div>
            <strong>{hasPublicApi ? 'Google workspace connected' : 'Demo Google workspace connected'}</strong>
            <span>{workspace.email}</span>
            <div className="destinationList" aria-label="Demo destinations">
              {workspace.destinations.map((destination) => (
                <small key={destination.id}>{destination.name}</small>
              ))}
            </div>
          </div>
          <button type="button" onClick={onDisconnect}>
            <Cloud size={16} />
            Disconnect
          </button>
        </div>
      );
    }

    return (
      <div className="setupPanel">
        <div>
          <strong>Connect Google</strong>
          <span>{hasPublicApi ? 'Start Google OAuth through your public backend.' : 'Use a safe demo workspace now.'}</span>
        </div>
        <button type="button" onClick={onConnect}>
          <Cloud size={16} />
          Connect
        </button>
      </div>
    );
  }

  return (
    <div className="setupPanel">
      <div>
        <strong>Private bridge mode</strong>
        <span>Routes to one configured Apps Script bridge for CSOS testing.</span>
      </div>
      <button type="button" onClick={onOpenSettings}>
        <Settings size={16} />
        Edit
      </button>
    </div>
  );
}
