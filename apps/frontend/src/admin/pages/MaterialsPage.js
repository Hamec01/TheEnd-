import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { itemsService } from '../../services/content/itemsService';
import { materialsService, validateMaterial } from '../../services/content/materialsService';
import { uid } from '../../services/content/storage';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel, translateAdminErrorMessage, translateEnabledState, translateMaterialCategory, translateRarity, } from '../adminUi';
const MATERIAL_CATEGORIES = ['metal', 'wood', 'leather', 'cloth', 'herb', 'stone', 'crystal', 'bone', 'other'];
const MATERIAL_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];
function emptyMaterial() {
    const now = new Date().toISOString();
    return {
        id: '',
        name: '',
        category: 'other',
        region: '',
        rarity: 'common',
        properties: [],
        gameplayDescription: '',
        loreDescription: '',
        imagePath: '',
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
    };
}
export function MaterialsPage() {
    const [materials, setMaterials] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(emptyMaterial());
    const [status, setStatus] = useState('Готово');
    async function refresh() {
        const all = await materialsService.getAll();
        setMaterials(all);
        if (selectedId && !all.some((entry) => entry.id === selectedId)) {
            setSelectedId(null);
            setDraft(emptyMaterial());
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    async function createOrUpdate() {
        const id = draft.id.trim() || uid('mat');
        const normalized = {
            ...draft,
            id,
            updatedAt: new Date().toISOString(),
        };
        const errors = validateMaterial(normalized);
        if (errors.length > 0) {
            setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
            return;
        }
        try {
            if (selectedId) {
                await materialsService.update(selectedId, normalized);
                setStatus(`Материал обновлён: ${selectedId}`);
            }
            else {
                await materialsService.create(normalized);
                setSelectedId(id);
                setStatus(`Материал создан: ${id}`);
            }
            await refresh();
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function createLinkedItem() {
        if (!draft.name.trim()) {
            setStatus(translateAdminErrorMessage('Material name is required to create linked item.'));
            return;
        }
        const itemId = `mat_${(draft.id || uid('mat')).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        try {
            await itemsService.create({
                id: itemId,
                name: draft.name,
                type: 'material',
                rarity: draft.rarity,
                price: 1,
                stackable: true,
                maxStack: 999,
                gameplayDescription: draft.gameplayDescription || `Материал: ${draft.name}`,
                loreDescription: draft.loreDescription || draft.gameplayDescription || '',
                imagePath: draft.imagePath,
                isEnabled: true,
            });
            setStatus(`Создан связанный предмет-материал: ${itemId}`);
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function disableSelected() {
        if (!selectedId) {
            return;
        }
        await materialsService.disable(selectedId);
        await refresh();
        setStatus(`Материал отключён: ${selectedId}`);
    }
    async function deleteSelected() {
        if (!selectedId) {
            return;
        }
        await materialsService.delete(selectedId);
        setSelectedId(null);
        setDraft(emptyMaterial());
        await refresh();
        setStatus(`Материал удалён: ${selectedId}`);
    }
    return (_jsxs("div", { className: "admin-two-col", children: [_jsxs("section", { className: "admin-list-panel", children: [_jsx("div", { className: "admin-list-tools", children: _jsx("button", { onClick: () => { setSelectedId(null); setDraft(emptyMaterial()); }, children: "\u041D\u043E\u0432\u044B\u0439 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" }) }), _jsx("div", { className: "admin-scroll-list", children: materials.map((material) => (_jsxs("button", { className: selectedId === material.id ? 'is-active' : '', onClick: () => { setSelectedId(material.id); setDraft(material); }, children: [_jsx("strong", { children: material.name }), _jsxs("span", { children: [material.id, " | ", translateMaterialCategory(material.category), " | ", translateRarity(material.rarity), " | ", translateEnabledState(material.isEnabled)] })] }, material.id))) })] }), _jsxs("section", { className: "admin-form-panel", children: [_jsxs("div", { className: "admin-form-grid", children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "ID", hint: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430. \u041D\u0430 \u043D\u0435\u0433\u043E \u043C\u043E\u0433\u0443\u0442 \u0441\u0441\u044B\u043B\u0430\u0442\u044C\u0441\u044F \u043A\u0440\u0430\u0444\u0442, \u043B\u0443\u0442 \u0438 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B." }), _jsx("input", { value: draft.id, onChange: (event) => setDraft((current) => ({ ...current, id: event.target.value })) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", hint: "\u041E\u0442\u043E\u0431\u0440\u0430\u0436\u0430\u0435\u043C\u043E\u0435 \u0438\u043C\u044F \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u0430." }), _jsx("input", { value: draft.name, onChange: (event) => setDraft((current) => ({ ...current, name: event.target.value })) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", hint: "\u041A \u043A\u0430\u043A\u043E\u043C\u0443 \u0432\u0438\u0434\u0443 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B: \u043C\u0435\u0442\u0430\u043B\u043B, \u0434\u0435\u0440\u0435\u0432\u043E, \u0442\u043A\u0430\u043D\u044C, \u043A\u0440\u0438\u0441\u0442\u0430\u043B\u043B \u0438 \u0442.\u0434." }), _jsx("select", { value: draft.category, onChange: (event) => setDraft((current) => ({ ...current, category: event.target.value })), children: MATERIAL_CATEGORIES.map((category) => (_jsx("option", { value: category, children: translateMaterialCategory(category) }, category))) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0420\u0435\u0434\u043A\u043E\u0441\u0442\u044C", hint: "\u0420\u0435\u0434\u043A\u043E\u0441\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430. \u041E\u0431\u044B\u0447\u043D\u043E \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0438 \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u044F." }), _jsx("select", { value: draft.rarity, onChange: (event) => setDraft((current) => ({ ...current, rarity: event.target.value })), children: MATERIAL_RARITIES.map((rarity) => (_jsx("option", { value: rarity, children: translateRarity(rarity) }, rarity))) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0420\u0435\u0433\u0438\u043E\u043D", hint: "\u0413\u0434\u0435 \u044D\u0442\u043E\u0442 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u043E\u0431\u044B\u0447\u043D\u043E \u0434\u043E\u0431\u044B\u0432\u0430\u0435\u0442\u0441\u044F: \u0440\u0435\u0433\u0438\u043E\u043D, \u0431\u0438\u043E\u043C \u0438\u043B\u0438 \u0442\u0435\u0440\u0440\u0438\u0442\u043E\u0440\u0438\u044F." }), _jsx("input", { value: draft.region, onChange: (event) => setDraft((current) => ({ ...current, region: event.target.value })) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0421\u0432\u043E\u0439\u0441\u0442\u0432\u0430", hint: "\u0421\u043F\u0438\u0441\u043E\u043A \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0445 \u0441\u0432\u043E\u0439\u0441\u0442\u0432 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E: \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 '\u0433\u0438\u0431\u043A\u0438\u0439, \u0436\u0430\u0440\u043E\u0441\u0442\u043E\u0439\u043A\u0438\u0439, \u0440\u0435\u0434\u043A\u0438\u0439'." }), _jsx("input", { value: draft.properties.join(', '), onChange: (event) => setDraft((current) => ({ ...current, properties: event.target.value.split(',').map((v) => v.trim()).filter(Boolean) })) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041F\u0443\u0442\u044C / ID \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F", hint: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443 \u0438\u043B\u0438 ID \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0438\u0437 \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u043A\u0430\u0440\u0442\u0438\u043D\u043E\u043A." }), _jsx("input", { value: draft.imagePath ?? '', onChange: (event) => setDraft((current) => ({ ...current, imagePath: event.target.value })) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.isEnabled, onChange: (event) => setDraft((current) => ({ ...current, isEnabled: event.target.checked })) }), _jsx(AdminFieldLabel, { label: "\u0412\u043A\u043B\u044E\u0447\u0451\u043D", hint: "\u0415\u0441\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0432 \u0431\u0430\u0437\u0435, \u043D\u043E \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u043C \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u043E\u043C." })] })] }), _jsx(AdminImageField, { value: draft.imagePath, onChange: (nextValue) => setDraft((current) => ({ ...current, imagePath: nextValue })), onStatus: setStatus, presetId: "item-icon", suggestedName: `${draft.id || draft.name || 'material'}-icon`, label: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430", hint: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u0438\u043A\u043E\u043D\u043A\u0443 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430 \u0438 \u0441\u0440\u0430\u0437\u0443 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u0435\u0451 \u0434\u043E \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u0440\u0430\u0437\u043C\u0435\u0440\u0430 \u0434\u043B\u044F \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430." }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0418\u0433\u0440\u043E\u0432\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", hint: "\u041F\u0440\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u0430: \u0433\u0434\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u0438 \u0437\u0430\u0447\u0435\u043C \u043E\u043D \u043D\u0443\u0436\u0435\u043D." }), _jsx("textarea", { rows: 4, value: draft.gameplayDescription ?? '', onChange: (event) => setDraft((current) => ({ ...current, gameplayDescription: event.target.value })) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041B\u043E\u0440 / \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0438\u0440\u0430", hint: "\u0425\u0443\u0434\u043E\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u043F\u0440\u043E \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435, \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0443 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430." }), _jsx("textarea", { rows: 3, value: draft.loreDescription ?? '', onChange: (event) => setDraft((current) => ({ ...current, loreDescription: event.target.value })) })] }), _jsxs("div", { className: "admin-actions-row", children: [_jsx("button", { onClick: () => { void createOrUpdate(); }, children: selectedId ? 'Сохранить' : 'Создать' }), _jsx("button", { onClick: () => { void createLinkedItem(); }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" }), _jsx("button", { disabled: !selectedId, onClick: () => { void disableSelected(); }, children: "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C" }), _jsx("button", { disabled: !selectedId, onClick: () => { void deleteSelected(); }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsx("p", { className: "muted", children: status })] })] }));
}
