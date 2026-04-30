import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';
import { useState } from 'react';

interface AdminLoginProps {
  onLogin: (password: string, persist: boolean) => boolean;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [persist, setPersist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const ok = onLogin(password, persist);
    if (!ok) {
      setError(translateAdminErrorMessage('Invalid password'));
      return;
    }
    setError(null);
  }

  return (
    <div className="admin-login-page">
      <form className="card admin-login-card" onSubmit={submit}>
        <h2>Вход в админку</h2>
        <p className="muted">Защищённая зона управления контентом.</p>
        <label>
          <AdminFieldLabel label="Пароль" hint="Секретный код для входа в панель управления контентом." />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={persist} onChange={(event) => setPersist(event.target.checked)} />
          <span>Запомнить вход в этом браузере</span>
        </label>
        {error ? <p className="admin-error">{error}</p> : null}
        <button type="submit">Войти</button>
      </form>
    </div>
  );
}
