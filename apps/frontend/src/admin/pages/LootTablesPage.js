import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { itemsService } from '../../services/content/itemsService';
import { lootTablesService, validateLootTable } from '../../services/content/lootTablesService';
import { uid } from '../../services/content/storage';
import { AdminFieldLabel, translateAdminErrorMessage, translateItemType, translateLootSourceType, } from '../adminUi';
const LOOT_SOURCE_TYPES = ['npc', 'monster', 'chest', 'region', 'quest', 'merchant_special'];
function emptyLootTable() {
    const now = new Date().toISOString();
    return {
        id: '',
        name: '',
        sourceType: 'monster',
        sourceId: '',
        entries: [],
        createdAt: now,
        updatedAt: now,
    };
}
export function LootTablesPage() {
    const [tables, setTables] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(emptyLootTable());
    const [status, setStatus] = useState('Готово');
    async function refresh() {
        const [allTables, allItems] = await Promise.all([lootTablesService.getAll(), itemsService.getAll()]);
        setTables(allTables);
        setItems(allItems.filter((item) => item.isEnabled));
        if (selectedId && !allTables.some((table) => table.id === selectedId)) {
            setSelectedId(null);
            setDraft(emptyLootTable());
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    const expectedDrops = useMemo(() => {
        return draft.entries.map((entry) => {
            const item = items.find((candidate) => candidate.id === entry.itemId);
            const avgQty = (entry.minQuantity + entry.maxQuantity) / 2;
            const expectation = entry.chance * avgQty;
            return {
                itemName: item?.name ?? entry.itemId,
                expectation,
            };
        }).sort((left, right) => right.expectation - left.expectation);
    }, [draft.entries, items]);
    function patch(next) {
        setDraft((current) => ({ ...current, ...next }));
    }
    function addEntry(itemId) {
        if (!itemId || draft.entries.some((entry) => entry.itemId === itemId)) {
            return;
        }
        setDraft((current) => ({
            ...current,
            entries: [...current.entries, { itemId, chance: 0.15, minQuantity: 1, maxQuantity: 1, isEnabled: true }],
        }));
    }
    function patchEntry(itemId, patchData) {
        setDraft((current) => ({
            ...current,
            entries: current.entries.map((entry) => (entry.itemId === itemId ? { ...entry, ...patchData } : entry)),
        }));
    }
    function removeEntry(itemId) {
        setDraft((current) => ({ ...current, entries: current.entries.filter((entry) => entry.itemId !== itemId) }));
    }
    async function createOrUpdate() {
        const id = draft.id.trim() || uid('loot');
        const normalized = {
            ...draft,
            id,
            updatedAt: new Date().toISOString(),
        };
        const errors = validateLootTable(normalized);
        if (errors.length > 0) {
            setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
            return;
        }
        try {
            if (selectedId) {
                await lootTablesService.update(selectedId, normalized);
                setStatus(`Таблица добычи обновлена: ${selectedId}`);
            }
            else {
                await lootTablesService.create(normalized);
                setSelectedId(id);
                setStatus(`Таблица добычи создана: ${id}`);
            }
            await refresh();
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function deleteSelected() {
        if (!selectedId) {
            return;
        }
        await lootTablesService.delete(selectedId);
        setSelectedId(null);
        setDraft(emptyLootTable());
        await refresh();
        setStatus(`Таблица добычи удалена: ${selectedId}`);
    }
    return (_jsxs("div", { className: "admin-two-col", children: [_jsxs("section", { className: "admin-list-panel", children: [_jsx("div", { className: "admin-list-tools", children: _jsx("button", { onClick: () => { setSelectedId(null); setDraft(emptyLootTable()); }, children: "\u041D\u043E\u0432\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u0434\u043E\u0431\u044B\u0447\u0438" }) }), _jsx("div", { className: "admin-scroll-list", children: tables.map((table) => (_jsxs("button", { className: selectedId === table.id ? 'is-active' : '', onClick: () => { setSelectedId(table.id); setDraft(table); }, children: [_jsx("strong", { children: table.name || table.id }), _jsxs("span", { children: [translateLootSourceType(table.sourceType), ": ", table.sourceId || 'не указан', " | ", table.entries.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439"] })] }, table.id))) })] }), _jsxs("section", { className: "admin-form-panel", children: [_jsxs("div", { className: "admin-form-grid", children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "ID", hint: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0442\u0430\u0431\u043B\u0438\u0446\u044B \u0434\u043E\u0431\u044B\u0447\u0438. \u041D\u0430 \u043D\u0435\u0433\u043E \u043C\u043E\u0433\u0443\u0442 \u0441\u0441\u044B\u043B\u0430\u0442\u044C\u0441\u044F \u043C\u043E\u043D\u0441\u0442\u0440\u044B, \u0441\u0443\u043D\u0434\u0443\u043A\u0438, \u0440\u0435\u0433\u0438\u043E\u043D\u044B \u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u044F." }), _jsx("input", { value: draft.id, onChange: (event) => patch({ id: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", hint: "\u0427\u0435\u043B\u043E\u0432\u0435\u043A\u043E-\u0447\u0438\u0442\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u044B. \u0423\u0434\u043E\u0431\u043D\u043E \u0434\u043B\u044F \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0430\u0434\u043C\u0438\u043D\u043A\u0438." }), _jsx("input", { value: draft.name, onChange: (event) => patch({ name: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A", hint: "\u041E\u0442\u043A\u0443\u0434\u0430 \u0431\u0435\u0440\u0451\u0442\u0441\u044F \u0434\u043E\u0431\u044B\u0447\u0430: \u043C\u043E\u043D\u0441\u0442\u0440, \u0441\u0443\u043D\u0434\u0443\u043A, \u043A\u0432\u0435\u0441\u0442, \u0440\u0435\u0433\u0438\u043E\u043D \u0438 \u0442.\u0434." }), _jsx("select", { value: draft.sourceType, onChange: (event) => patch({ sourceType: event.target.value }), children: LOOT_SOURCE_TYPES.map((sourceType) => (_jsx("option", { value: sourceType, children: translateLootSourceType(sourceType) }, sourceType))) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "ID \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0430", hint: "ID \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u043C\u043E\u043D\u0441\u0442\u0440\u0430, \u0441\u0443\u043D\u0434\u0443\u043A\u0430, \u0440\u0435\u0433\u0438\u043E\u043D\u0430 \u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430, \u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0438\u0442 \u044D\u0442\u0430 \u0442\u0430\u0431\u043B\u0438\u0446\u0430." }), _jsx("input", { value: draft.sourceId ?? '', onChange: (event) => patch({ sourceId: event.target.value }) })] })] }), _jsx("h4", { title: "\u0417\u0430\u043F\u0438\u0441\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0442\u0430\u0431\u043B\u0438\u0446\u044B: \u043A\u0430\u043A\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043C\u043E\u0433\u0443\u0442 \u0432\u044B\u043F\u0430\u0441\u0442\u044C, \u0441 \u043A\u0430\u043A\u0438\u043C \u0448\u0430\u043D\u0441\u043E\u043C \u0438 \u0432 \u043A\u0430\u043A\u043E\u043C \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0435.", children: "\u0417\u0430\u043F\u0438\u0441\u0438 \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435" }), _jsxs("select", { onChange: (event) => { addEntry(event.target.value); event.currentTarget.selectedIndex = 0; }, children: [_jsx("option", { value: "", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442..." }), items.map((item) => _jsxs("option", { value: item.id, children: [item.name, " (", item.id, ")"] }, item.id))] }), _jsx("div", { className: "admin-scroll-list merchant-item-pick", children: draft.entries.map((entry) => {
                            const item = items.find((candidate) => candidate.id === entry.itemId);
                            const itemName = item?.name ?? entry.itemId;
                            return (_jsxs("div", { className: "merchant-item-row is-active", children: [_jsx("button", { onClick: () => removeEntry(entry.itemId), children: "\u0423\u0431\u0440\u0430\u0442\u044C" }), _jsxs("div", { children: [_jsx("strong", { children: itemName }), _jsxs("span", { children: [entry.itemId, item ? ` | ${translateItemType(item.type)}` : ''] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0428\u0430\u043D\u0441", hint: "\u0412\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0432\u044B\u043F\u0430\u0434\u0435\u043D\u0438\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043E\u0442 0 \u0434\u043E 1. \u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 0.25 = 25%." }), _jsx("input", { type: "number", step: "0.01", min: 0, max: 1, value: entry.chance, onChange: (event) => patchEntry(entry.itemId, { chance: Number(event.target.value) || 0 }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u0438\u043D. \u043A\u043E\u043B-\u0432\u043E", hint: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0432\u044B\u043F\u0430\u0434\u0435\u0442 \u043F\u0440\u0438 \u0443\u0441\u043F\u0435\u0448\u043D\u043E\u043C \u0440\u043E\u043B\u043B\u0435." }), _jsx("input", { type: "number", min: 1, value: entry.minQuantity, onChange: (event) => patchEntry(entry.itemId, { minQuantity: Number(event.target.value) || 1 }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u0430\u043A\u0441. \u043A\u043E\u043B-\u0432\u043E", hint: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u043F\u0430\u0441\u0442\u044C. \u041D\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E." }), _jsx("input", { type: "number", min: 1, value: entry.maxQuantity, onChange: (event) => patchEntry(entry.itemId, { maxQuantity: Number(event.target.value) || 1 }) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: entry.isEnabled, onChange: (event) => patchEntry(entry.itemId, { isEnabled: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E", hint: "\u0415\u0441\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0432 \u0442\u0430\u0431\u043B\u0438\u0446\u0435, \u043D\u043E \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u0435\u0442 \u0443\u0447\u0430\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0432 \u0432\u044B\u043F\u0430\u0434\u0435\u043D\u0438\u0438." })] })] }, entry.itemId));
                        }) }), _jsxs("div", { className: "admin-actions-row", children: [_jsx("button", { onClick: () => { void createOrUpdate(); }, children: selectedId ? 'Сохранить' : 'Создать' }), _jsx("button", { disabled: !selectedId, onClick: () => { void deleteSelected(); }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsxs("section", { className: "card admin-item-preview", children: [_jsx("h4", { children: "\u041E\u0436\u0438\u0434\u0430\u0435\u043C\u0430\u044F \u0434\u043E\u0431\u044B\u0447\u0430 (\u0441\u0440\u0435\u0434\u043D\u0435\u0435 \u0437\u0430 \u043E\u0434\u0438\u043D \u0437\u0430\u043F\u0443\u0441\u043A)" }), expectedDrops.length === 0 ? _jsx("p", { className: "muted", children: "\u0417\u0430\u043F\u0438\u0441\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." }) : null, expectedDrops.slice(0, 12).map((row) => (_jsxs("p", { children: [row.itemName, ": ", row.expectation.toFixed(2)] }, row.itemName)))] }), _jsx("p", { className: "muted", children: status })] })] }));
}
