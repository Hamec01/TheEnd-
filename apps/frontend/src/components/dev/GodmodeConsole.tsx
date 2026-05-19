import { useEffect, useMemo, useRef, useState } from 'react';

export interface GodmodeConsoleResult {
  ok: boolean;
  lines: string[];
}

interface GodmodeConsoleEntry {
  id: string;
  kind: 'command' | 'success' | 'error' | 'info';
  text: string;
}

interface GodmodeConsoleProps {
  enabled: boolean;
  accountLogin: string | null;
  characterName?: string | null;
  tutorialPath: string;
  onExecute: (commandLine: string) => Promise<GodmodeConsoleResult>;
}

function isToggleConsoleKey(event: KeyboardEvent): boolean {
  return event.code === 'Backquote'
    || event.key === '`'
    || event.key === 'ё'
    || event.key === 'Ё';
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
}

function createEntry(kind: GodmodeConsoleEntry['kind'], text: string): GodmodeConsoleEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    kind,
    text,
  };
}

export function GodmodeConsole({
  enabled,
  accountLogin,
  characterName,
  tutorialPath,
  onExecute,
}: GodmodeConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<GodmodeConsoleEntry[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const didShowWelcomeRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false);
      setInput('');
      setRunning(false);
      didShowWelcomeRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (isToggleConsoleKey(event)) {
        if (!isOpen && isTypingTarget(event.target)) {
          return;
        }

        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);

    if (!didShowWelcomeRef.current) {
      didShowWelcomeRef.current = true;
      setHistory((current) => [
        ...current,
        createEntry('info', 'GODMODE console ready. Type "help" to list commands.'),
        createEntry('info', `Tutorial: ${tutorialPath}`),
      ]);
    }
  }, [isOpen, tutorialPath]);

  const title = useMemo(() => {
    const parts = ['GODMODE'];
    if (accountLogin) {
      parts.push(accountLogin);
    }
    if (characterName) {
      parts.push(characterName);
    }
    return parts.join(' · ');
  }, [accountLogin, characterName]);

  async function runCommand(commandLine: string): Promise<void> {
    const trimmed = commandLine.trim();
    if (!trimmed || running) {
      return;
    }

    setRunning(true);
    setHistory((current) => [...current, createEntry('command', `> ${trimmed}`)]);
    setInput('');

    try {
      const result = await onExecute(trimmed);
      const nextEntries = result.lines.length > 0 ? result.lines : [result.ok ? 'OK' : 'Command failed.'];
      setHistory((current) => [
        ...current,
        ...nextEntries.map((line) => createEntry(result.ok ? 'success' : 'error', line)),
      ]);
    } catch (error) {
      setHistory((current) => [
        ...current,
        createEntry('error', (error as Error).message || 'Unknown GODMODE error.'),
      ]);
    } finally {
      setRunning(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="godmode-console-toggle"
        onClick={() => setIsOpen((current) => !current)}
      >
        GODMODE
      </button>

      {isOpen ? (
        <div className="godmode-console-overlay" role="dialog" aria-modal="false" aria-label="Godmode console">
          <section className="godmode-console">
            <header className="godmode-console__header">
              <div>
                <strong>{title}</strong>
                <p className="godmode-console__hint">Open/close: <code>`</code> or <code>ё</code></p>
              </div>
              <div className="godmode-console__actions">
                <button type="button" onClick={() => void runCommand('help')} disabled={running}>Help</button>
                <button type="button" onClick={() => setHistory([])} disabled={running}>Clear</button>
                <button type="button" onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </header>

            <div className="godmode-console__history">
              {history.length > 0 ? history.map((entry) => (
                <div key={entry.id} className={`godmode-console__line godmode-console__line--${entry.kind}`}>
                  {entry.text}
                </div>
              )) : (
                <div className="godmode-console__line godmode-console__line--info">
                  Type <code>help</code> to list commands.
                </div>
              )}
            </div>

            <form
              className="godmode-console__form"
              onSubmit={(event) => {
                event.preventDefault();
                void runCommand(input);
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="quest start feralas_followers_path_start"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={running || !input.trim()}>
                {running ? '...' : 'Run'}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
