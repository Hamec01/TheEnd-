export function augmentMissingOrDisabledReason(): string {
  return 'Предмет-аугмент не найден или отключён';
}

export function augmentMissingPayloadReason(augmentName: string): string {
  return `${augmentName} вставлен, но не содержит augment-данных`;
}

export function augmentTypeMismatchReason(augmentName: string, augmentType: string): string {
  return `${augmentName} вставлен, но тип ${augmentType} несовместим с сокетом`;
}

export function augmentContextMismatchReason(augmentName: string, requiredContexts: string[]): string {
  return `${augmentName} вставлен, но не активен (требуется один из контекстов: ${requiredContexts.join(', ')})`;
}
