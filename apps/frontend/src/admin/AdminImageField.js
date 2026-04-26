import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { imageService } from '../services/content/imageService';
import { IMAGE_PRESETS } from '../services/content/imagePresets';
import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';
function isDirectImageSource(value) {
    return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}
export function AdminImageField({ value, onChange, onStatus, presetId, suggestedName, label = 'Быстрая загрузка картинки', hint = 'Загружает файл и сразу ужимает его под нужный размер для игрового интерфейса.', }) {
    const [storedImage, setStoredImage] = useState(null);
    const [isUploading, setUploading] = useState(false);
    const preset = IMAGE_PRESETS[presetId];
    useEffect(() => {
        const normalized = value?.trim();
        if (!normalized || isDirectImageSource(normalized)) {
            setStoredImage(null);
            return;
        }
        let disposed = false;
        void imageService.get(normalized).then((image) => {
            if (!disposed) {
                setStoredImage(image);
            }
        });
        return () => {
            disposed = true;
        };
    }, [value]);
    const previewSrc = useMemo(() => {
        const normalized = value?.trim();
        if (!normalized) {
            return null;
        }
        if (isDirectImageSource(normalized)) {
            return normalized;
        }
        return storedImage?.dataUrl ?? null;
    }, [storedImage, value]);
    async function handleUpload(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        setUploading(true);
        try {
            const uploaded = await imageService.uploadPreset(file, presetId, {
                name: suggestedName?.trim() || file.name,
            });
            setStoredImage(uploaded);
            onChange(uploaded.id);
            onStatus?.(`Картинка загружена и приведена к размеру ${uploaded.width}x${uploaded.height}: ${uploaded.name}`);
        }
        catch (error) {
            onStatus?.(translateAdminErrorMessage(error.message));
        }
        finally {
            setUploading(false);
        }
    }
    return (_jsxs("section", { className: "card admin-inline-image-field", children: [_jsxs("div", { className: "admin-inline-image-field-head", children: [_jsx(AdminFieldLabel, { label: label, hint: `${hint} Пресет: ${preset.label}, размер ${preset.width}x${preset.height}px.` }), _jsxs("span", { className: "muted", children: [preset.width, "x", preset.height, "px"] })] }), _jsxs("div", { className: "admin-inline-image-field-body", children: [_jsxs("label", { className: "admin-inline-image-upload", children: [_jsx("span", { children: isUploading ? 'Загрузка...' : 'Выбрать файл' }), _jsx("input", { type: "file", accept: "image/*", onChange: handleUpload, disabled: isUploading })] }), _jsx("button", { type: "button", disabled: !value, onClick: () => onChange(''), children: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C" })] }), value ? (_jsxs("p", { className: "muted", children: ["\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: ", _jsx("strong", { children: value })] })) : (_jsx("p", { className: "muted", children: "\u041A\u0430\u0440\u0442\u0438\u043D\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u0430." })), previewSrc ? (_jsxs("div", { className: "admin-inline-image-preview", children: [_jsx("img", { src: previewSrc, alt: suggestedName || 'preview' }), storedImage ? (_jsxs("p", { className: "muted", children: ["ID: ", storedImage.id, " \u00B7 ", storedImage.width, "x", storedImage.height] })) : null] })) : null] }));
}
