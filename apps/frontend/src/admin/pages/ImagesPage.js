import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { imageService } from '../../services/content/imageService';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';
export function ImagesPage() {
    const [images, setImages] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [resizeTo, setResizeTo] = useState(256);
    const [status, setStatus] = useState('Готово');
    async function refresh() {
        const all = await imageService.getAll();
        setImages(all);
        if (selectedId && !all.some((image) => image.id === selectedId)) {
            setSelectedId(null);
        }
    }
    useEffect(() => {
        void refresh();
    }, []);
    async function upload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const stored = await imageService.upload(file);
            setStatus(`Изображение загружено: ${stored.name}`);
            setSelectedId(stored.id);
            await refresh();
        }
        catch (error) {
            setStatus(translateAdminErrorMessage(error.message));
        }
    }
    async function resizeSelected() {
        if (!selectedId) {
            return;
        }
        try {
            const resized = await imageService.resize(selectedId, resizeTo, resizeTo);
            setStatus(`Создана копия ${resized.name} размером ${resizeTo}x${resizeTo}`);
            setSelectedId(resized.id);
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
        await imageService.delete(selectedId);
        setStatus(`Изображение удалено: ${selectedId}`);
        setSelectedId(null);
        await refresh();
    }
    const selected = images.find((image) => image.id === selectedId) ?? null;
    return (_jsxs("div", { className: "admin-two-col", children: [_jsxs("section", { className: "admin-list-panel", children: [_jsx("div", { className: "admin-list-tools", children: _jsxs("label", { className: "card", children: [_jsx(AdminFieldLabel, { label: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435", hint: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u0442 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0443 \u0432 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0435 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0430\u0434\u043C\u0438\u043D\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0442\u043E\u043C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0435\u0451 \u0432 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430\u0445, \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u0445 \u0438 \u0434\u0440\u0443\u0433\u0438\u0445 \u0441\u0443\u0449\u043D\u043E\u0441\u0442\u044F\u0445." }), _jsx("input", { type: "file", accept: "image/*", onChange: upload })] }) }), _jsx("div", { className: "admin-scroll-list image-list", children: images.map((image) => (_jsxs("button", { className: selectedId === image.id ? 'is-active' : '', onClick: () => setSelectedId(image.id), children: [_jsx("img", { src: image.dataUrl, alt: image.name }), _jsx("span", { children: image.name }), _jsx("span", { children: image.id })] }, image.id))) })] }), _jsxs("section", { className: "admin-form-panel", children: [_jsx("h3", { children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }), selected ? (_jsxs(_Fragment, { children: [_jsx("img", { className: "admin-image-preview", src: selected.dataUrl, alt: selected.name }), _jsx("p", { children: selected.name }), _jsxs("p", { className: "muted", title: "\u0422\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F. \u0415\u0433\u043E \u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0432 \u043F\u043E\u043B\u044F\u0445 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u0443 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432 \u0438 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432.", children: ["ID \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F: ", selected.id] }), _jsxs("p", { className: "muted", children: ["\u0420\u0430\u0437\u043C\u0435\u0440: ", selected.width, "x", selected.height] })] })) : (_jsx("p", { className: "muted", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430." })), _jsxs("div", { className: "admin-actions-row", children: [_jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u0420\u0430\u0437\u043C\u0435\u0440 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u043E\u0439 \u043A\u043E\u043F\u0438\u0438", hint: "\u0421\u043E\u0437\u0434\u0430\u0451\u0442 \u043D\u043E\u0432\u0443\u044E \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u0443\u044E \u043A\u043E\u043F\u0438\u044E \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0438 \u0441 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u0448\u0438\u0440\u0438\u043D\u043E\u0439 \u0438 \u0432\u044B\u0441\u043E\u0442\u043E\u0439." }), _jsx("input", { type: "number", min: 32, max: 1024, value: resizeTo, onChange: (event) => setResizeTo(Number(event.target.value) || 256) })] }), _jsx("button", { disabled: !selectedId, onClick: () => { void resizeSelected(); }, children: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0440 \u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u043E\u043F\u0438\u044E" }), _jsx("button", { disabled: !selectedId, onClick: () => { void deleteSelected(); }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] }), _jsx("p", { className: "muted", children: status })] })] }));
}
