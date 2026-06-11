import type { ItemEffect, ItemInstance } from '../../services/content/models';
import {
  formatCarpenterComponentKind,
  formatQualityBand,
  formatSourceTreeLabel,
  formatWoodTraitTag,
  hasCarpenterMetadata,
} from './carpenterItemMetadataDisplay';

interface CarpenterItemMetadataPanelProps {
  carpenterComponent?: ItemInstance['carpenterComponent'];
  carpenterComponentsUsed?: ItemInstance['carpenterComponentsUsed'];
  showDebugJson?: boolean;
}

function renderTraitChips(traits: string[] | null | undefined): JSX.Element | null {
  if (!traits || traits.length === 0) {
    return null;
  }

  return (
    <div className="carpenter-metadata-chip-list">
      {traits.map((trait) => (
        <span key={trait} className="carpenter-metadata-chip">{formatWoodTraitTag(trait)}</span>
      ))}
    </div>
  );
}

function renderEffectsDisclaimer(inheritedEffects?: ItemEffect[] | null): JSX.Element | null {
  if (!inheritedEffects || inheritedEffects.length === 0) {
    return null;
  }

  return (
    <p className="carpenter-metadata-warning">
      Унаследованные свойства сохранены как metadata для будущего крафта. Они не являются активными боевыми эффектами.
    </p>
  );
}

export function CarpenterItemMetadataPanel({
  carpenterComponent,
  carpenterComponentsUsed,
  showDebugJson = false,
}: CarpenterItemMetadataPanelProps): JSX.Element | null {
  const hasMetadata = hasCarpenterMetadata({
    carpenterComponent,
    carpenterComponentsUsed,
  });
  if (!hasMetadata) {
    return null;
  }

  return (
    <section className="character-item-carpenter-metadata">
      {carpenterComponent ? (
        <article>
          <h4>Компонент плотника</h4>
          <p className="muted">Тип: {formatCarpenterComponentKind(carpenterComponent.componentKind)}</p>
          <p className="muted">Шаблон: {carpenterComponent.templateName?.trim() || carpenterComponent.templateId}</p>
          {(() => {
            const source = formatSourceTreeLabel(carpenterComponent);
            return (
              <>
                <p className="muted">Источник древесины: {source.label}</p>
                <p className="muted">Качество: {carpenterComponent.qualityScore}/100 — {formatQualityBand(carpenterComponent.qualityScore)}</p>
                <p className="muted">Сохранение свойств древесины: {carpenterComponent.traitRetentionPercent}%</p>
                {renderTraitChips(carpenterComponent.inheritedTraitTags)}
                {renderEffectsDisclaimer(carpenterComponent.inheritedEffects)}
                {source.isLost ? <p className="carpenter-metadata-warning">⚠ Происхождение потеряно. {source.warning}</p> : null}
              </>
            );
          })()}
        </article>
      ) : null}

      {carpenterComponentsUsed && carpenterComponentsUsed.length > 0 ? (
        <article>
          <h4>Компоненты плотника в составе</h4>
          <div className="carpenter-metadata-collection">
            {carpenterComponentsUsed.map((component) => {
              const source = formatSourceTreeLabel(component);
              return (
                <section key={`${component.componentItemId}-${component.consumedAtIso}`} className="carpenter-metadata-component-card">
                  <h5>{formatCarpenterComponentKind(component.componentKind)}</h5>
                  <p className="muted">Шаблон: {component.templateName?.trim() || component.templateId}</p>
                  <p className="muted">Источник: {source.label}</p>
                  <p className="muted">Качество: {component.qualityScore}/100 — {formatQualityBand(component.qualityScore)}</p>
                  <p className="muted">Сохранение свойств: {component.traitRetentionPercent}%</p>
                  {renderTraitChips(component.inheritedTraitTags)}
                  {renderEffectsDisclaimer(component.inheritedEffects)}
                  {source.isLost ? <p className="carpenter-metadata-warning">⚠ Происхождение потеряно. {source.warning}</p> : null}
                </section>
              );
            })}
          </div>
        </article>
      ) : null}

      {showDebugJson ? (
        <details>
          <summary>Показать технические данные</summary>
          <pre>{JSON.stringify({ carpenterComponent, carpenterComponentsUsed }, null, 2)}</pre>
        </details>
      ) : null}
    </section>
  );
}
