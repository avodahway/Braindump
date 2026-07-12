import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, FolderKanban, Lock, Mic, Settings, Sparkles, UserCheck } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { loadSettings, processBrainDump, saveSettings, type BackendSettings } from './api/client';
import type { BrainDumpResponse, ParsedAction } from './lib/types';

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
  const [text, setText] = useState(() => localStorage.getItem('brain-dump-draft') ?? '');
  const [result, setResult] = useState<BrainDumpResponse | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<BackendSettings>(() => loadSettings());

  const groupedActions = useMemo(() => {
    const map = new Map<string, ParsedAction[]>();
    groups.forEach((group) => map.set(group.key, []));
    result?.actions.forEach((action) => map.get(action.type)?.push(action));
    return map;
  }, [result]);

  async function handleProcess() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Add something to your brain dump first.');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const response = await processBrainDump({
        requestId: crypto.randomUUID(),
        text: trimmed,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      setResult(response);
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
    localStorage.setItem('brain-dump-draft', value);
  }

  function handleSettingsSubmit(event: FormEvent) {
    event.preventDefault();
    saveSettings(settings);
    setShowSettings(false);
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
        {settings.backendMode === 'public' && (
          <div className="setupNotice">
            <strong>Public account setup is next.</strong>
            <span>For now, Brain Dump can preview routing in mock mode without touching anyone's Google account.</span>
          </div>
        )}
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
          <button className="processButton" type="button" onClick={handleProcess} disabled={isProcessing}>
            <Sparkles size={20} />
            {isProcessing ? 'Processing' : 'Process'}
          </button>
        </div>
      </section>

      {(error || result) && (
        <section className="resultsPanel" aria-live="polite">
          {error && <div className="errorCard">{error}</div>}
          {result && (
            <>
              <div className="summaryGrid">
                <Summary label="Calendar" value={result.summary.calendar} />
                <Summary label="Work" value={result.summary.workTasks} />
                <Summary label="Personal" value={result.summary.personalTasks} />
                <Summary label="Projects" value={result.summary.projects} />
                <Summary label="Waiting" value={result.summary.waiting} />
                <Summary label="Review" value={result.summary.needsReview} />
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
                      </div>
                    ))}
                  </article>
                );
              })}
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

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="summaryCard">
      <span>{value}</span>
      <small>{label}</small>
    </div>
  );
}
