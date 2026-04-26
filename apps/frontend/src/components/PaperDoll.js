import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { PAPER_DOLL_ASSETS } from './paperDollSlots';
function toRenderedRect(slot, naturalWidth, naturalHeight, renderedWidth, renderedHeight) {
    const scaleX = renderedWidth / naturalWidth;
    const scaleY = renderedHeight / naturalHeight;
    return {
        left: slot.x * scaleX,
        top: slot.y * scaleY,
        width: slot.w * scaleX,
        height: slot.h * scaleY,
    };
}
export function PaperDoll({ race, imageSrc, slotItems, slotLabels, resolveItemImage, onSlotClick, onSlotDrop, onSlotContextMenu, debug = false, onImageError, }) {
    const imageRef = useRef(null);
    const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });
    const asset = PAPER_DOLL_ASSETS[race];
    useEffect(() => {
        const image = imageRef.current;
        if (!image) {
            return;
        }
        const updateSize = () => {
            const rect = image.getBoundingClientRect();
            setRenderedSize({
                width: rect.width,
                height: rect.height,
            });
        };
        updateSize();
        const observer = new ResizeObserver(() => {
            updateSize();
        });
        observer.observe(image);
        return () => {
            observer.disconnect();
        };
    }, [imageSrc, race]);
    const renderedRects = useMemo(() => {
        if (renderedSize.width <= 0 || renderedSize.height <= 0) {
            return new Map();
        }
        return new Map(asset.slots.map((slot) => [
            slot.id,
            toRenderedRect(slot, asset.naturalWidth, asset.naturalHeight, renderedSize.width, renderedSize.height),
        ]));
    }, [asset, renderedSize.height, renderedSize.width]);
    return (_jsx("div", { className: "paper-doll-stage", children: _jsxs("div", { className: "paper-doll-image-shell", children: [_jsx("img", { ref: imageRef, src: imageSrc, alt: "", "aria-hidden": "true", className: "paper-doll-image", onLoad: () => {
                        const rect = imageRef.current?.getBoundingClientRect();
                        if (rect) {
                            setRenderedSize({ width: rect.width, height: rect.height });
                        }
                    }, onError: onImageError }), _jsx("div", { className: "paper-doll-overlay", "aria-hidden": false, children: asset.slots.map((slot) => {
                        const rect = renderedRects.get(slot.id);
                        if (!rect) {
                            return null;
                        }
                        const equippedItem = slotItems[slot.id] ?? null;
                        const label = slotLabels[slot.id] ?? slot.id;
                        return (_jsxs("button", { type: "button", className: `paper-doll-slot ${debug ? 'is-debug' : ''} ${equippedItem ? 'is-equipped' : 'is-empty'}`, style: {
                                left: `${rect.left}px`,
                                top: `${rect.top}px`,
                                width: `${rect.width}px`,
                                height: `${rect.height}px`,
                            }, onClick: () => {
                                if (debug) {
                                    console.info('paper-doll-slot', {
                                        id: slot.id,
                                        x: slot.x,
                                        y: slot.y,
                                        w: slot.w,
                                        h: slot.h,
                                    });
                                }
                                onSlotClick(slot.id);
                            }, onContextMenu: (event) => {
                                event.preventDefault();
                                onSlotContextMenu?.(slot.id);
                            }, onDragOver: (event) => event.preventDefault(), onDrop: (event) => {
                                event.preventDefault();
                                const itemId = event.dataTransfer.getData('text/theend-item-id');
                                if (!itemId) {
                                    return;
                                }
                                onSlotDrop(slot.id, itemId);
                            }, title: equippedItem ? `${label}: ${equippedItem.name}` : label, "data-slot-id": slot.id, children: [debug ? _jsx("span", { className: "paper-doll-slot-id", children: slot.id }) : null, equippedItem ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "paper-doll-slot-item-wrap", children: [_jsx("img", { src: resolveItemImage?.(equippedItem) ?? `/art/items/${equippedItem.icon}.png`, alt: equippedItem.name, className: "paper-doll-slot-item-icon", draggable: false, onError: (event) => {
                                                        event.currentTarget.style.display = 'none';
                                                    } }), _jsx("span", { className: "paper-doll-slot-item-fallback", children: equippedItem.name.charAt(0).toUpperCase() })] }), _jsxs("span", { className: "paper-doll-slot-tooltip", role: "tooltip", children: [_jsx("strong", { children: label }), _jsx("span", { children: equippedItem.name }), _jsxs("small", { children: [equippedItem.itemType, " / ", equippedItem.itemSubType] })] })] })) : null] }, slot.id));
                    }) })] }) }));
}
