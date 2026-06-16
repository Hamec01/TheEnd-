import type { SpriteStudioValidationResult } from '../../sprite-studio-core';

interface SpriteStudioValidationPanelProps {
  validation: SpriteStudioValidationResult;
}

export function SpriteStudioValidationPanel({ validation }: SpriteStudioValidationPanelProps) {
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    return (
      <section className="card admin-item-preview">
        <h4>Validation</h4>
        <p className="muted">Ошибок и предупреждений не найдено.</p>
      </section>
    );
  }

  return (
    <section className="card admin-item-preview">
      <h4>Validation</h4>
      {validation.errors.length > 0 ? (
        <>
          <p style={{ color: '#ff9f9f', fontWeight: 700, marginBottom: 8 }}>Errors</p>
          <ul>
            {validation.errors.map((entry, index) => (
              <li key={`error-${index}`} style={{ color: '#ffb3b3' }}>{entry}</li>
            ))}
          </ul>
        </>
      ) : null}
      {validation.warnings.length > 0 ? (
        <>
          <p style={{ color: '#e0c27a', fontWeight: 700, marginBottom: 8 }}>Warnings</p>
          <ul>
            {validation.warnings.map((entry, index) => (
              <li key={`warning-${index}`} style={{ color: '#e7d0a0' }}>{entry}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

