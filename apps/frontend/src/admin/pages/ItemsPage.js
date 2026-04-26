import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { itemsService, validateItem } from '../../services/content/itemsService';
import { uid } from '../../services/content/storage';
import { AdminImageField } from '../AdminImageField';
import { AdminFieldLabel, translateAdminErrorMessage, translateDamageCategory, translateElementType, translateEnabledState, translateHandsRequired, translateItemSlot, translateItemType, translateMagicSchool, translatePhysicalType, translateRarity, translateStatKey, } from '../adminUi';
const STAT_KEYS = ['hp', 'mp', 'stamina', 'strength', 'constitution', 'dexterity', 'intelligence', 'luck', 'perception', 'willpower'];
const ITEM_TYPES = ['weapon', 'armor', 'potion', 'material', 'quest', 'misc'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'forbidden'];
const SLOTS = ['head', 'necklace', 'chest', 'cloak', 'belt', 'leftHand', 'rightHand', 'gloves', 'knees', 'boots', 'ring', 'trinket', 'charm', 'quick', 'none'];
const DAMAGE_CATEGORIES = ['physical', 'elemental', 'magic', 'shamanic', 'runic', 'poison', 'bleed', 'true'];
const PHYSICAL_TYPES = ['slash', 'pierce', 'blunt', 'cleave', 'unarmed'];
const ELEMENT_TYPES = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
const MAGIC_SCHOOLS = ['blood', 'death', 'life', 'mind', 'illusion', 'curse', 'arcane'];
function emptyItem() {
    const now = new Date().toISOString();
    return {
        id: '',
        name: '',
        type: 'weapon',
        subtype: '',
        slot: 'rightHand',
        handsRequired: 1,
        rarity: 'common',
        price: 0,
        stackable: false,
        maxStack: 1,
        requiredStats: {},
        bonuses: {},
        gameplayDescription: '',
        loreDescription: '',
        imagePath: '',
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
    };
}
function parseNumber(value) {
    if (value.trim() === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
export function ItemsPage() {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [rarityFilter, setRarityFilter] = useState('all');
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(emptyItem());
    const [status, setStatus] = useState('Готово');
    async function refresh() {
        const all = await itemsService.getAll();
        setItems(all);
        if (selectedId && !all.some((item) => item.id === selectedId)) {
            setSelectedId(null);
            setDraft(emptyItem());
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    const visibleItems = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            if (q && !item.id.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) {
                return false;
            }
            if (typeFilter !== 'all' && item.type !== typeFilter) {
                return false;
            }
            if (rarityFilter !== 'all' && item.rarity !== rarityFilter) {
                return false;
            }
            return true;
        });
    }, [items, query, rarityFilter, typeFilter]);
    function select(item) {
        setSelectedId(item.id);
        setDraft(item);
    }
    function patch(next) {
        setDraft((current) => ({ ...current, ...next }));
    }
    function patchStatBucket(bucket, key, rawValue) {
        setDraft((current) => {
            const parsed = parseNumber(rawValue);
            const nextBucket = { ...(current[bucket] ?? {}) };
            if (parsed === undefined) {
                delete nextBucket[key];
            }
            else {
                nextBucket[key] = parsed;
            }
            return {
                ...current,
                [bucket]: nextBucket,
            };
        });
    }
    useEffect(() => {
        if (draft.type === 'material') {
            patch({ slot: 'none' });
            return;
        }
        if (draft.type === 'potion' && (!draft.slot || draft.slot === 'none')) {
            patch({ slot: 'quick' });
            return;
        }
        if (draft.type === 'weapon' && draft.slot !== 'rightHand') {
            patch({ slot: 'rightHand' });
        }
    }, [draft.type, draft.slot]);
    useEffect(() => {
        if (draft.type !== 'weapon' && draft.handsRequired !== 1) {
            patch({ handsRequired: 1 });
        }
    }, [draft.handsRequired, draft.type]);
    async function createOrUpdate() {
        const id = draft.id.trim() || uid('item');
        const normalized = {
            ...draft,
            id,
            handsRequired: draft.type === 'weapon' && draft.handsRequired === 2 ? 2 : 1,
            maxStack: draft.stackable ? Math.max(2, draft.maxStack ?? 2) : 1,
            updatedAt: new Date().toISOString(),
        };
        const errors = validateItem(normalized);
        if (errors.length > 0) {
            setStatus(`Проверка: ${translateAdminErrorMessage(errors.join(', '))}`);
            return;
        }
        try {
            if (selectedId) {
                await itemsService.update(selectedId, normalized);
                setStatus(`Предмет обновлён: ${selectedId}`);
            }
            else {
                await itemsService.create(normalized);
                setStatus(`Предмет создан: ${id}`);
                setSelectedId(id);
            }
            await refresh();
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function duplicateSelected() {
        if (!selectedId) {
            return;
        }
        const copy = {
            ...draft,
            id: `${draft.id || 'item'}_copy_${Math.floor(Math.random() * 10000)}`,
            name: `${draft.name} Копия`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        try {
            await itemsService.create(copy);
            setStatus(`Создана копия предмета: ${selectedId}`);
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
        await itemsService.disable(selectedId);
        await refresh();
        setStatus(`Предмет отключён: ${selectedId}`);
    }
    async function deleteSelected() {
        if (!selectedId) {
            return;
        }
        await itemsService.delete(selectedId);
        setSelectedId(null);
        setDraft(emptyItem());
        await refresh();
        setStatus(`Предмет удалён: ${selectedId}`);
    }
    return (_jsxs("div", { className: "admin-two-col", children: [_jsxs("section", { className: "admin-list-panel", children: [_jsxs("div", { className: "admin-list-tools", children: [_jsx("input", { placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E ID \u0438\u043B\u0438 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E", value: query, onChange: (event) => setQuery(event.target.value) }), _jsxs("select", { value: typeFilter, onChange: (event) => setTypeFilter(event.target.value), children: [_jsx("option", { value: "all", children: "\u0412\u0441\u0435 \u0442\u0438\u043F\u044B" }), ITEM_TYPES.map((type) => _jsx("option", { value: type, children: translateItemType(type) }, type))] }), _jsxs("select", { value: rarityFilter, onChange: (event) => setRarityFilter(event.target.value), children: [_jsx("option", { value: "all", children: "\u041B\u044E\u0431\u0430\u044F \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u044C" }), RARITIES.map((rarity) => _jsx("option", { value: rarity, children: translateRarity(rarity) }, rarity))] }), _jsx("button", { onClick: () => { setSelectedId(null); setDraft(emptyItem()); }, children: "\u041D\u043E\u0432\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442" })] }), _jsx("div", { className: "admin-scroll-list", children: visibleItems.map((item) => (_jsxs("button", { className: selectedId === item.id ? 'is-active' : '', onClick: () => select(item), children: [_jsx("strong", { children: item.name }), _jsxs("span", { children: [item.id, " | ", translateItemType(item.type), " | ", translateRarity(item.rarity), " | ", translateEnabledState(item.isEnabled)] })] }, item.id))) })] }), _jsxs("section", { className: "admin-form-panel", children: [_jsxs("div", { className: "admin-form-grid", children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "ID", hint: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0432 \u043A\u043E\u0434\u0435, \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430\u0445, \u043B\u0443\u0442\u0435 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F\u0445. \u041F\u043E\u0441\u043B\u0435 \u043F\u0443\u0431\u043B\u0438\u043A\u0430\u0446\u0438\u0438 \u043B\u0443\u0447\u0448\u0435 \u043D\u0435 \u043C\u0435\u043D\u044F\u0442\u044C." }), _jsx("input", { value: draft.id, onChange: (event) => patch({ id: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", hint: "\u0418\u043C\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0443\u0432\u0438\u0434\u0438\u0442 \u0438\u0433\u0440\u043E\u043A." }), _jsx("input", { value: draft.name, onChange: (event) => patch({ name: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0422\u0438\u043F", hint: "\u0413\u043B\u0430\u0432\u043D\u0430\u044F \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430. \u041E\u043D\u0430 \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0432 \u0438\u0433\u0440\u0435." }), _jsx("select", { value: draft.type, onChange: (event) => patch({ type: event.target.value }), children: ITEM_TYPES.map((type) => _jsx("option", { value: type, children: translateItemType(type) }, type)) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041F\u043E\u0434\u0442\u0438\u043F", hint: "\u0423\u0442\u043E\u0447\u043D\u0435\u043D\u0438\u0435 \u0432\u043D\u0443\u0442\u0440\u0438 \u0442\u0438\u043F\u0430: \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 \u043C\u0435\u0447, \u0442\u043E\u043F\u043E\u0440, \u043B\u0435\u0447\u0435\u0431\u043D\u043E\u0435 \u0437\u0435\u043B\u044C\u0435 \u0438\u043B\u0438 \u0440\u0443\u0434\u0430." }), _jsx("input", { value: draft.subtype ?? '', onChange: (event) => patch({ subtype: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0421\u043B\u043E\u0442", hint: "\u041A\u0443\u0434\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043C\u043E\u0436\u043D\u043E \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C. \u0414\u043B\u044F \u0440\u0430\u0441\u0445\u043E\u0434\u043D\u0438\u043A\u043E\u0432 \u043E\u0431\u044B\u0447\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0431\u044B\u0441\u0442\u0440\u044B\u0439 \u0441\u043B\u043E\u0442, \u0434\u043B\u044F \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u2014 \u043D\u0435 \u044D\u043A\u0438\u043F\u0438\u0440\u0443\u0435\u0442\u0441\u044F." }), _jsx("select", { value: draft.slot ?? 'none', onChange: (event) => patch({ slot: event.target.value }), children: SLOTS.map((slot) => _jsx("option", { value: slot, children: translateItemSlot(slot) }, slot)) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0420\u0435\u0434\u043A\u043E\u0441\u0442\u044C", hint: "\u0420\u0435\u0434\u043A\u043E\u0441\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430. \u041F\u043E\u043C\u043E\u0433\u0430\u0435\u0442 \u0431\u0430\u043B\u0430\u043D\u0441\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0446\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0438 \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u044C \u0432\u044B\u043F\u0430\u0434\u0435\u043D\u0438\u044F." }), _jsx("select", { value: draft.rarity, onChange: (event) => patch({ rarity: event.target.value }), children: RARITIES.map((rarity) => _jsx("option", { value: rarity, children: translateRarity(rarity) }, rarity)) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0426\u0435\u043D\u0430", hint: "\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u0446\u0435\u043D\u0430 \u043F\u043E\u043A\u0443\u043F\u043A\u0438 \u0443 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430 \u0432 \u0437\u043E\u043B\u043E\u0442\u0435." }), _jsx("input", { type: "number", min: 0, value: draft.price, onChange: (event) => patch({ price: Number(event.target.value) || 0 }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0425\u0432\u0430\u0442", hint: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0443\u043A \u043D\u0443\u0436\u043D\u043E, \u0447\u0442\u043E\u0431\u044B \u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043E\u0440\u0443\u0436\u0438\u0435. \u0414\u043B\u044F \u0434\u0432\u0443\u0440\u0443\u0447\u043D\u043E\u0433\u043E \u043E\u0440\u0443\u0436\u0438\u044F \u043B\u0435\u0432\u0430\u044F \u0440\u0443\u043A\u0430 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043E\u0441\u0432\u043E\u0431\u043E\u0436\u0434\u0430\u0435\u0442\u0441\u044F." }), _jsxs("select", { value: draft.handsRequired ?? 1, onChange: (event) => patch({ handsRequired: Number(event.target.value) }), disabled: draft.type !== 'weapon', children: [_jsx("option", { value: 1, children: translateHandsRequired(1) }), _jsx("option", { value: 2, children: translateHandsRequired(2) })] })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.stackable, onChange: (event) => patch({ stackable: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u0421\u043A\u043B\u0430\u0434\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0432 \u0441\u0442\u043E\u043F\u043A\u0443", hint: "\u0415\u0441\u043B\u0438 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E, \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043F\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043C\u043E\u0433\u0443\u0442 \u043B\u0435\u0436\u0430\u0442\u044C \u0432 \u043E\u0434\u043D\u043E\u043C \u0441\u043B\u043E\u0442\u0435 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F." })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u0430\u043A\u0441. \u0432 \u0441\u0442\u043E\u043F\u043A\u0435", hint: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043F\u0438\u0439 \u044D\u0442\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u043C\u043E\u0436\u043D\u043E \u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u043E\u0434\u043D\u043E\u0439 \u0441\u0442\u043E\u043F\u043A\u0435." }), _jsx("input", { type: "number", min: 1, value: draft.maxStack ?? 1, onChange: (event) => patch({ maxStack: Number(event.target.value) || 1 }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u0438\u043D. \u0443\u0440\u043E\u043D", hint: "\u041D\u0438\u0436\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0443\u0440\u043E\u043D\u0430 \u043E\u0440\u0443\u0436\u0438\u044F \u0438\u043B\u0438 \u0430\u0442\u0430\u043A\u0443\u044E\u0449\u0435\u0433\u043E \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430." }), _jsx("input", { type: "number", value: draft.damageMin ?? '', onChange: (event) => patch({ damageMin: parseNumber(event.target.value) }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041C\u0430\u043A\u0441. \u0443\u0440\u043E\u043D", hint: "\u0412\u0435\u0440\u0445\u043D\u044F\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u0430 \u0443\u0440\u043E\u043D\u0430. \u041D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043D\u0438\u0436\u0435 \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0443\u0440\u043E\u043D\u0430." }), _jsx("input", { type: "number", value: draft.damageMax ?? '', onChange: (event) => patch({ damageMax: parseNumber(event.target.value) }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F \u0443\u0440\u043E\u043D\u0430", hint: "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u0435\u0442, \u043A \u043A\u0430\u043A\u043E\u043C\u0443 \u0442\u0438\u043F\u0443 \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u0443\u0440\u043E\u043D \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430: \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439, \u043C\u0430\u0433\u0438\u0447\u0435\u0441\u043A\u0438\u0439, \u0441\u0442\u0438\u0445\u0438\u044F \u0438 \u0442\u0430\u043A \u0434\u0430\u043B\u0435\u0435." }), _jsxs("select", { value: draft.damageCategory ?? '', onChange: (event) => patch({ damageCategory: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u0430" }), DAMAGE_CATEGORIES.map((entry) => _jsx("option", { value: entry, children: translateDamageCategory(entry) }, entry))] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0424\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0442\u0438\u043F", hint: "\u0423\u0442\u043E\u0447\u043D\u044F\u0435\u0442 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0432\u0438\u0434 \u0443\u0440\u043E\u043D\u0430: \u0440\u0435\u0436\u0443\u0449\u0438\u0439, \u043A\u043E\u043B\u044E\u0449\u0438\u0439, \u0434\u0440\u043E\u0431\u044F\u0449\u0438\u0439 \u0438 \u0442.\u0434." }), _jsxs("select", { value: draft.physicalType ?? '', onChange: (event) => patch({ physicalType: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D" }), PHYSICAL_TYPES.map((entry) => _jsx("option", { value: entry, children: translatePhysicalType(entry) }, entry))] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0421\u0442\u0438\u0445\u0438\u044F", hint: "\u0415\u0441\u043B\u0438 \u0443\u0440\u043E\u043D \u0441\u0442\u0438\u0445\u0438\u0439\u043D\u044B\u0439, \u0437\u0434\u0435\u0441\u044C \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430\u044F \u0441\u0442\u0438\u0445\u0438\u044F." }), _jsxs("select", { value: draft.elementType ?? '', onChange: (event) => patch({ elementType: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u0430" }), ELEMENT_TYPES.map((entry) => _jsx("option", { value: entry, children: translateElementType(entry) }, entry))] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0428\u043A\u043E\u043B\u0430 \u043C\u0430\u0433\u0438\u0438", hint: "\u0415\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0441\u0432\u044F\u0437\u0430\u043D \u0441 \u043C\u0430\u0433\u0438\u0435\u0439, \u0437\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0443\u043A\u0430\u0437\u0430\u0442\u044C \u0448\u043A\u043E\u043B\u0443 \u043C\u0430\u0433\u0438\u0438." }), _jsxs("select", { value: draft.magicSchool ?? '', onChange: (event) => patch({ magicSchool: (event.target.value || undefined) }), children: [_jsx("option", { value: "", children: "\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u0430" }), MAGIC_SCHOOLS.map((entry) => _jsx("option", { value: entry, children: translateMagicSchool(entry) }, entry))] })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0411\u0440\u043E\u043D\u044F", hint: "\u041F\u043B\u043E\u0441\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0437\u0430\u0449\u0438\u0442\u044B, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0434\u0430\u0451\u0442 \u043F\u0440\u0435\u0434\u043C\u0435\u0442." }), _jsx("input", { type: "number", value: draft.armorValue ?? '', onChange: (event) => patch({ armorValue: parseNumber(event.target.value) }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041F\u0443\u0442\u044C / ID \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F", hint: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 ID \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0431\u0443\u0434\u0435\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0435." }), _jsx("input", { value: draft.imagePath ?? '', onChange: (event) => patch({ imagePath: event.target.value }) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: draft.isEnabled, onChange: (event) => patch({ isEnabled: event.target.checked }) }), _jsx(AdminFieldLabel, { label: "\u0412\u043A\u043B\u044E\u0447\u0451\u043D", hint: "\u0415\u0441\u043B\u0438 \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C, \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u043E\u0441\u0442\u0430\u043D\u0435\u0442\u0441\u044F \u0432 \u0431\u0430\u0437\u0435, \u043D\u043E \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0438\u0433\u0440\u043E\u0432\u043E\u043C \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0435." })] })] }), _jsx(AdminImageField, { value: draft.imagePath, onChange: (nextValue) => patch({ imagePath: nextValue }), onStatus: setStatus, presetId: "item-icon", suggestedName: `${draft.id || draft.name || 'item'}-icon`, label: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430", hint: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u0438\u043A\u043E\u043D\u043A\u0443 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043F\u043E\u0434\u0433\u043E\u043D\u044F\u0435\u0442 \u0435\u0451 \u043F\u043E\u0434 \u0435\u0434\u0438\u043D\u044B\u0439 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0439 \u0440\u0430\u0437\u043C\u0435\u0440 \u0434\u043B\u044F \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430, \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044F \u0438 \u0441\u043B\u043E\u0442\u043E\u0432." }), _jsxs("div", { className: "admin-stat-grid", children: [_jsx("h4", { title: "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0443\u0436\u043D\u044B, \u0447\u0442\u043E\u0431\u044B \u044D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0438\u043B\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442.", children: "\u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F" }), STAT_KEYS.map((key) => (_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: translateStatKey(key), hint: `Минимальное значение характеристики "${translateStatKey(key)}", которое требуется для использования или экипировки предмета.` }), _jsx("input", { type: "number", value: draft.requiredStats?.[key] ?? '', onChange: (event) => patchStatBucket('requiredStats', key, event.target.value) })] }, `required-${key}`)))] }), _jsxs("div", { className: "admin-stat-grid", children: [_jsx("h4", { title: "\u0411\u043E\u043D\u0443\u0441\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0434\u0430\u0451\u0442 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0443, \u043F\u043E\u043A\u0430 \u043D\u0430\u0434\u0435\u0442 \u0438\u043B\u0438 \u0430\u043A\u0442\u0438\u0432\u0435\u043D.", children: "\u0411\u043E\u043D\u0443\u0441\u044B" }), STAT_KEYS.map((key) => (_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: translateStatKey(key), hint: `Прибавка к характеристике "${translateStatKey(key)}", которую предмет даёт персонажу.` }), _jsx("input", { type: "number", value: draft.bonuses?.[key] ?? '', onChange: (event) => patchStatBucket('bonuses', key, event.target.value) })] }, `bonus-${key}`)))] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0418\u0433\u0440\u043E\u0432\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435", hint: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430 \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u0430: \u0447\u0442\u043E \u0434\u0435\u043B\u0430\u0435\u0442, \u043A\u0430\u043A\u0438\u0435 \u0431\u043E\u043D\u0443\u0441\u044B \u0434\u0430\u0451\u0442, \u0437\u0430\u0447\u0435\u043C \u043D\u0443\u0436\u0435\u043D." }), _jsx("textarea", { rows: 3, value: draft.gameplayDescription, onChange: (event) => patch({ gameplayDescription: event.target.value }) })] }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041B\u043E\u0440 / \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0438\u0440\u0430", hint: "\u0425\u0443\u0434\u043E\u0436\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430: \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435, \u043B\u0435\u0433\u0435\u043D\u0434\u0430, \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0430." }), _jsx("textarea", { rows: 3, value: draft.loreDescription, onChange: (event) => patch({ loreDescription: event.target.value }) })] }), _jsxs("div", { className: "admin-actions-row", children: [_jsx("button", { onClick: () => { void createOrUpdate(); }, children: selectedId ? 'Сохранить' : 'Создать' }), _jsx("button", { disabled: !selectedId, onClick: () => { void duplicateSelected(); }, children: "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C" }), _jsx("button", { disabled: !selectedId, onClick: () => { void disableSelected(); }, children: "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C" }), _jsx("button", { disabled: !selectedId, onClick: () => { void deleteSelected(); }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsxs("section", { className: "card admin-item-preview", children: [_jsx("h4", { children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430" }), draft.imagePath ? _jsxs("p", { className: "muted", children: ["\u0418\u043A\u043E\u043D\u043A\u0430: ", draft.imagePath] }) : null, _jsxs("p", { children: [_jsx("strong", { children: draft.name || '(без названия)' }), " (", draft.id || 'ID ещё не задан', ")"] }), _jsxs("p", { children: [translateItemType(draft.type), " / ", draft.subtype || 'без подтипа', " / ", translateRarity(draft.rarity)] }), _jsxs("p", { children: ["\u0426\u0435\u043D\u0430: ", draft.price] }), _jsx("p", { children: draft.gameplayDescription || 'Игровое описание пока не заполнено.' }), _jsx("p", { className: "muted", children: draft.loreDescription || 'Лоровое описание пока не заполнено.' })] }), _jsx("p", { className: "muted", children: status })] })] }));
}
