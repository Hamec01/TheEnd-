# THEEND Runtime Audit - Session Summary

Этот файл синхронизирован с основным session summary.

Основная версия: [RUNTIME_AUDIT_SESSION_README.md](../RUNTIME_AUDIT_SESSION_README.md)

Ключевой апдейт по совместимости:
- `giveQuest` поддерживается в runtime (backward compatibility).
- `actions[].type = "startQuest"` поддерживается и является рекомендуемым форматом.
- `effects[].type = "start_quest" | "startQuest"` поддерживается через compatibility-bridge для старта квеста.

Для точных деталей и примеров:
- [THEEND_RUNTIME_JSON_GUIDE.md](THEEND_RUNTIME_JSON_GUIDE.md)
- [RUNTIME_AUDIT_REPORT.md](RUNTIME_AUDIT_REPORT.md)
