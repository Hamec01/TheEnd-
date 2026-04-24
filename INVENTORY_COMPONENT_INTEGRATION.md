# Инструкция по использованию новых компонентов инвентаря и торговца

## Что добавлено:

✅ **InventoryGrid.tsx** - сетка слотов для инвентаря
✅ **TradeModal.tsx** - модаль подтверждения покупки/продажи  
✅ **ItemSlot.tsx** - карточка предмета с drag-and-drop поддержкой
✅ **Стили** - CSS для сеток, hover-tooltip, drag-and-drop

## Где использовать в App.tsx:

### 1. Инвентарь (вместо текущего после строки ~1050)

```tsx
{overlayPanel === 'inventory' && (
  <div className="battle-overlay" role="dialog" aria-modal="true">
    <section className="card battle-window wm-modal">
      <div className="battle-window-head">
        <h2>Inventory</h2>
        <button onClick={() => setOverlayPanel(null)}>✕</button>
      </div>
      <p className="gold">🪙 {inventory.gold}</p>

      <InventoryGrid
        title="Your Inventory"
        items={inventory.items.map(entry => getItemById(entry.itemId))}
        columns={4}
        onItemClick={(item) => {
          setTradeItem(item);
          setTradeAction('sell');
          setTradeModalOpen(true);
        }}
        onDragStart={(item) => {
          setDraggedItem(item);
          setDragSource('inventory');
        }}
      />

      <TradeModal
        isOpen={tradeModalOpen && tradeAction === 'sell'}
        action="sell"
        item={tradeItem}
        playerGold={inventory.gold}
        onConfirm={() => {
          if (tradeItem) {
            handleSellItem(tradeItem.id);
            setTradeModalOpen(false);
          }
        }}
        onCancel={() => setTradeModalOpen(false)}
      />
    </section>
  </div>
)}
```

### 2. Торговец (вместо текущего после строки ~1140)

```tsx
{overlayPanel === 'merchant' && selectedMerchant && (
  <div className="battle-overlay" role="dialog" aria-modal="true">
    <section className="card battle-window wm-modal">
      <div className="battle-window-head">
        <h2>{selectedMerchant.name}</h2>
        <button onClick={() => setOverlayPanel(null)}>✕</button>
      </div>
      <p className="gold">🪙 Your Gold: {inventory.gold}</p>

      <InventoryGrid
        title={`${selectedMerchant.name} - Available Items`}
        items={merchantItems}
        columns={4}
        onItemClick={(item) => {
          setTradeItem(item);
          setTradeAction('buy');
          setTradeModalOpen(true);
        }}
        onDragStart={(item) => {
          setDraggedItem(item);
          setDragSource('merchant');
        }}
      />

      <TradeModal
        isOpen={tradeModalOpen && tradeAction === 'buy'}
        action="buy"
        item={tradeItem}
        playerGold={inventory.gold}
        onConfirm={() => {
          if (tradeItem) {
            handleBuyItem(tradeItem.id);
            setTradeModalOpen(false);
          }
        }}
        onCancel={() => setTradeModalOpen(false)}
      />
    </section>
  </div>
)}
```

### 3. Handler функции (добавьте перед return())

```tsx
const handleBuyItem = async (itemId: string) => {
  if (!character) return;
  try {
    const updated = await buyArenaItem(character.id, itemId);
    setInventory(updated.inventory);
    setStatus(`Bought ${getItemById(itemId)?.name}!`);
  } catch (err) {
    setStatus(`Failed to buy: ${err}`);
  }
};

const handleSellItem = async (itemId: string) => {
  if (!character) return;
  try {
    const updated = await sellArenaItem(character.id, itemId);
    setInventory(updated.inventory);
    setStatus(`Sold ${getItemById(itemId)?.name}!`);
  } catch (err) {
    setStatus(`Failed to sell: ${err}`);
  }
};
```

## Папки для картинок:

```
/apps/frontend/public/art/
├── weapons/
├── armor/
├── consumables/
├── items/
└── locations/  (город Арклейн уже загружен как 1.png в /public/map/)
```

## Откуда загружать картинки:

Путь на вашем компьютере:
```
c:\Users\Ham_h\Downloads\TheEnd--main\apps\frontend\public\art\
```

Картинки уже в проекте в `/public/map/` (1-12.png/.gif) - это ваш город Арклейн!

## Что дальше:

1. Замените блоки инвентаря/торговца в App.tsx на код выше
2. Добавьте handler функции
3. Загрузите картинки в папки /art/weapons/, /art/armor/ и т.д.
4. В ItemSlot передавайте iconImage={`/art/weapons/${item.id}.png`} для отображения картинок

Сейчас все готово, компоненты создании и типы чистые! ✅
