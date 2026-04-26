import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { AdminImageField } from '../AdminImageField';
import { itemsService } from '../../services/content/itemsService';
import { merchantsService, validateMerchant } from '../../services/content/merchantsService';
import { uid } from '../../services/content/storage';
import { AdminFieldLabel, translateAdminErrorMessage, translateEnabledState, translateItemType, translateMerchantType, } from '../adminUi';
const MERCHANT_TYPES = ['blacksmith', 'alchemist', 'general', 'rune_master', 'material_trader', 'rare_goods', 'other'];
function emptyMerchant() {
    const now = new Date().toISOString();
    return {
        id: '',
        name: '',
        city: '',
        location: '',
        type: 'general',
        description: '',
        portraitPath: '',
        priceMultiplier: 1,
        isEnabled: true,
        items: [],
        createdAt: now,
        updatedAt: now,
    };
}
export function MerchantsPage() {
    const [merchants, setMerchants] = useState([]);
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(emptyMerchant());
    const [itemSearch, setItemSearch] = useState('');
    const [status, setStatus] = useState('Готово');
    async function refresh() {
        const [allMerchants, allItems] = await Promise.all([merchantsService.getAll(), itemsService.getAll()]);
        setMerchants(allMerchants);
        setItems(allItems.filter((item) => item.isEnabled));
        if (selectedId && !allMerchants.some((merchant) => merchant.id === selectedId)) {
            setSelectedId(null);
            setDraft(emptyMerchant());
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    const visibleMerchants = useMemo(() => {
        const q = query.trim().toLowerCase();
        return merchants.filter((merchant) => {
            if (!q) {
                return true;
            }
            return merchant.id.toLowerCase().includes(q)
                || merchant.name.toLowerCase().includes(q)
                || merchant.city.toLowerCase().includes(q);
        });
    }, [merchants, query]);
    const selectedItemIds = useMemo(() => new Set(draft.items.map((entry) => entry.itemId)), [draft.items]);
    const visibleItems = useMemo(() => {
        const q = itemSearch.trim().toLowerCase();
        return items
            .filter((item) => !q || item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q))
            .sort((left, right) => {
            const leftSelected = selectedItemIds.has(left.id);
            const rightSelected = selectedItemIds.has(right.id);
            if (leftSelected !== rightSelected) {
                return leftSelected ? -1 : 1;
            }
            const leftTime = Date.parse(left.updatedAt || left.createdAt || '');
            const rightTime = Date.parse(right.updatedAt || right.createdAt || '');
            if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
                return rightTime - leftTime;
            }
            return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
        });
    }, [itemSearch, items, selectedItemIds]);
    function select(merchant) {
        setSelectedId(merchant.id);
        setDraft(merchant);
    }
    function patch(next) {
        setDraft((current) => ({ ...current, ...next }));
    }
    function toggleItem(itemId) {
        setDraft((current) => {
            const exists = current.items.some((entry) => entry.itemId === itemId);
            if (exists) {
                return { ...current, items: current.items.filter((entry) => entry.itemId !== itemId) };
            }
            return {
                ...current,
                items: [...current.items, { itemId, stock: 10, infiniteStock: false, isEnabled: true }],
            };
        });
    }
    function patchItem(itemId, patchData) {
        setDraft((current) => ({
            ...current,
            items: current.items.map((entry) => (entry.itemId === itemId ? { ...entry, ...patchData } : entry)),
        }));
    }
    async function createOrUpdate() {
        const id = draft.id.trim() || uid('merchant');
        const normalized = {
            ...draft,
            id,
            priceMultiplier: Number.isFinite(draft.priceMultiplier) ? draft.priceMultiplier : 1,
            updatedAt: new Date().toISOString(),
        };
        const errors = validateMerchant(normalized);
        if (errors.length > 0) {
            setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
            return;
        }
        try {
            if (selectedId) {
                await merchantsService.update(selectedId, normalized);
                setStatus(`Торговец обновлён: ${selectedId}`);
            }
            else {
                await merchantsService.create(normalized);
                setSelectedId(id);
                setStatus(`Торговец создан: ${id}`);
            }
            await refresh();
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function disableSelected() {
        if (!selectedId) {
            return;
        }
        await merchantsService.disable(selectedId);
        await refresh();
        setStatus(`Торговец отключён: ${selectedId}`);
    }
    async function deleteSelected() {
        if (!selectedId) {
            return;
        }
        await merchantsService.delete(selectedId);
        setSelectedId(null);
        setDraft(emptyMerchant());
        await refresh();
        setStatus(`Торговец удалён: ${selectedId}`);
    }
    return (_jsxs("div", { className: "admin-two-col", children: [_jsxs("section", { className: "admin-list-panel", children: [_jsxs("div", { className: "admin-list-tools", children: [_jsx("input", { placeholder: "\u041F\u043E\u0438\u0441\u043A \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0435\u0432", value: query, onChange: (event) => setQuery(event.target.value) }), _jsx("button", { onClick: () => { setSelectedId(null); setDraft(emptyMerchant()); }, children: "\u041D\u043E\u0432\u044B\u0439 \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446" })] }), _jsx("div", { className: "admin-scroll-list", children: visibleMerchants.map((merchant) => (_jsxs("button", { className: selectedId === merchant.id ? 'is-active' : '', onClick: () => select(merchant), children: [_jsx("strong", { children: merchant.name }), _jsxs("span", { children: [merchant.id, " | ", merchant.city, " | ", merchant.items.length, " \u043F\u043E\u0437\u0438\u0446\u0438\u0439 | ", translateEnabledState(merchant.isEnabled)] })] }, merchant.id))) })] }), _jsxs("section", { className: "admin-form-panel", children: [_jsxs("div", { className: "admin-form-grid", children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "ID", hint: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430. \u041D\u0430 \u043D\u0435\u0433\u043E \u0441\u0441\u044B\u043B\u0430\u044E\u0442\u0441\u044F \u0433\u043E\u0440\u043E\u0434\u0441\u043A\u0438\u0435 \u0442\u043E\u0447\u043A\u0438 \u0438 \u0438\u0433\u0440\u043E\u0432\u044B\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u044B." }), _jsx("input", { value: draft.id, onChange: (event) => patch({ id: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", hint: "\u0418\u043C\u044F \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0443\u0432\u0438\u0434\u0438\u0442 \u0438\u0433\u0440\u043E\u043A." }), _jsx("input", { value: draft.name, onChange: (event) => patch({ name: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0413\u043E\u0440\u043E\u0434", hint: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0433\u043E\u0440\u043E\u0434\u0430. \u0414\u043B\u044F \u043F\u043E\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0432 \u0410\u0440\u043A\u043B\u0435\u0439\u043D\u0435 \u0443\u043A\u0430\u0436\u0438 \u0437\u0434\u0435\u0441\u044C: \u0410\u0440\u043A\u043B\u0435\u0439\u043D." }), _jsx("input", { value: draft.city, onChange: (event) => patch({ city: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041B\u043E\u043A\u0430\u0446\u0438\u044F", hint: "\u0411\u043E\u043B\u0435\u0435 \u0442\u043E\u0447\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E \u0432\u043D\u0443\u0442\u0440\u0438 \u0433\u043E\u0440\u043E\u0434\u0430: \u0440\u044B\u043D\u043E\u043A, \u043A\u0443\u0437\u043D\u044F, \u0442\u0430\u0432\u0435\u0440\u043D\u0430, \u043A\u0432\u0430\u0440\u0442\u0430\u043B \u0438 \u0442.\u0434. \u041F\u043E \u044D\u0442\u043E\u043C\u0443 \u043F\u043E\u043B\u044E \u0438\u0433\u0440\u0430 \u0441\u0442\u0430\u0440\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430 \u0432 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0443\u044E \u0447\u0430\u0441\u0442\u044C \u0433\u043E\u0440\u043E\u0434\u0430." }), _jsx("input", { value: draft.location ?? '', onChange: (event) => patch({ location: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0422\u0438\u043F", hint: "\u0420\u043E\u043B\u044C \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430. \u041F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u043F\u043E\u043D\u044F\u0442\u044C, \u0447\u0435\u043C \u0438\u043C\u0435\u043D\u043D\u043E \u043E\u043D \u0442\u043E\u0440\u0433\u0443\u0435\u0442." }), _jsx("select", { value: draft.type, onChange: (event) => patch({ type: event.target.value }), children: MERCHANT_TYPES.map((type) => (_jsx("option", { value: type, children: translateMerchantType(type) }, type))) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u0446\u0435\u043D\u044B", hint: "\u041D\u0430\u0446\u0435\u043D\u043A\u0430 \u0438\u043B\u0438 \u0441\u043A\u0438\u0434\u043A\u0430 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430. 1 \u2014 \u043E\u0431\u044B\u0447\u043D\u0430\u044F \u0446\u0435\u043D\u0430, 1.2 \u2014 \u043D\u0430 20% \u0434\u043E\u0440\u043E\u0436\u0435, 0.8 \u2014 \u043D\u0430 20% \u0434\u0435\u0448\u0435\u0432\u043B\u0435." }), _jsx("input", { type: "number", step: "0.05", min: "0.1", value: draft.priceMultiplier, onChange: (event) => patch({ priceMultiplier: Number(event.target.value) || 1 }) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.isEnabled, onChange: (event) => patch({ isEnabled: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u0412\u043A\u043B\u044E\u0447\u0451\u043D", hint: "\u0415\u0441\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0432 \u0431\u0430\u0437\u0435, \u043D\u043E \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0438\u0433\u0440\u0435." })] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", hint: "\u041A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430: \u0447\u0435\u043C \u0438\u0437\u0432\u0435\u0441\u0442\u0435\u043D, \u0447\u0442\u043E \u043F\u0440\u043E\u0434\u0430\u0451\u0442, \u043A\u0430\u043A\u043E\u0439 \u0443 \u043D\u0435\u0433\u043E \u0441\u0442\u0438\u043B\u044C." }), _jsx("textarea", { rows: 3, value: draft.description ?? '', onChange: (event) => patch({ description: event.target.value }) })] }), _jsx(AdminImageField, { value: draft.portraitPath, onChange: (nextValue) => patch({ portraitPath: nextValue }), onStatus: setStatus, presetId: "merchant-portrait", suggestedName: draft.name || draft.id || 'merchant-portrait', label: "\u041F\u043E\u0440\u0442\u0440\u0435\u0442 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430", hint: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u043F\u043E\u0440\u0442\u0440\u0435\u0442 NPC, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u0431\u0443\u0434\u0435\u0442 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0433\u043E\u0440\u043E\u0434\u0435 \u0438 \u0432 \u043E\u043A\u043D\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u043B\u0438." }), _jsx("h4", { title: "\u0421\u043F\u0438\u0441\u043E\u043A \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446 \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u043E\u0434\u0430\u0432\u0430\u0442\u044C \u0438\u0433\u0440\u043E\u043A\u0443.", children: "\u0410\u0441\u0441\u043E\u0440\u0442\u0438\u043C\u0435\u043D\u0442 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430" }), _jsx("input", { placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0434\u043B\u044F \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u044F", value: itemSearch, onChange: (event) => setItemSearch(event.target.value) }), _jsxs("p", { className: "muted", children: ["\u0414\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432: ", visibleItems.length, ". \u041D\u043E\u0432\u044B\u0435 \u0438 \u0443\u0436\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u0432\u044B\u0448\u0435."] }), _jsx("div", { className: "admin-scroll-list merchant-item-pick", children: visibleItems.map((item) => {
                            const assigned = draft.items.find((entry) => entry.itemId === item.id);
                            return (_jsxs("div", { className: `merchant-item-row ${assigned ? 'is-active' : ''}`, children: [_jsx("button", { onClick: () => toggleItem(item.id), children: assigned ? 'Убрать' : 'Добавить' }), _jsxs("div", { children: [_jsx("strong", { children: item.name }), _jsxs("span", { children: [item.id, " | ", translateItemType(item.type)] })] }), assigned ? (_jsxs(_Fragment, { children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0417\u0430\u043F\u0430\u0441", hint: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0435\u0434\u0438\u043D\u0438\u0446 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E \u0443 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430. \u0415\u0441\u043B\u0438 \u0432\u043A\u043B\u044E\u0447\u0451\u043D \u0431\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0437\u0430\u043F\u0430\u0441, \u0447\u0438\u0441\u043B\u043E \u043C\u043E\u0436\u043D\u043E \u0438\u0433\u043D\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C." }), _jsx("input", { type: "number", min: 0, value: assigned.stock ?? 0, onChange: (event) => patchItem(item.id, { stock: Number(event.target.value) || 0 }) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: assigned.infiniteStock ?? false, onChange: (event) => patchItem(item.id, { infiniteStock: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u0411\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u044B\u0439 \u0437\u0430\u043F\u0430\u0441", hint: "\u0415\u0441\u043B\u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u044D\u0442\u043E\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u0442\u0441\u044F \u0443 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430." })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: assigned.isEnabled ?? true, onChange: (event) => patchItem(item.id, { isEnabled: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C", hint: "\u0415\u0441\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0443, \u043D\u043E \u0438\u0433\u0440\u043E\u043A \u043D\u0435 \u0443\u0432\u0438\u0434\u0438\u0442 \u0435\u0433\u043E \u0432 \u043F\u0440\u043E\u0434\u0430\u0436\u0435." })] })] })) : null] }, item.id));
                        }) }), _jsxs("div", { className: "admin-actions-row", children: [_jsx("button", { onClick: () => { void createOrUpdate(); }, children: selectedId ? 'Сохранить' : 'Создать' }), _jsx("button", { disabled: !selectedId, onClick: () => { void disableSelected(); }, children: "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C" }), _jsx("button", { disabled: !selectedId, onClick: () => { void deleteSelected(); }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsx("p", { className: "muted", children: status })] })] }));
}
