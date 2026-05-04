import type { AdminSaveViewModel } from './adminSaveTools';

interface AdminSaveStatusProps {
  value: AdminSaveViewModel;
}

const STATE_COLOR: Record<AdminSaveViewModel['state'], string> = {
  idle: 'var(--text-secondary, #9f8f75)',
  saving: '#d5b47a',
  saved: '#7ed28f',
  error: '#ff8f8f',
  warning: '#f6d680',
};

export function AdminSaveStatus({ value }: AdminSaveStatusProps) {
  return (
    <p
      className="admin-save-status"
      aria-live="polite"
      style={{
        marginTop: 8,
        fontWeight: 600,
        color: STATE_COLOR[value.state],
      }}
    >
      {value.message}
    </p>
  );
}
