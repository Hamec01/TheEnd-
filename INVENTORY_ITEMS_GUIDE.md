# Структура игры TheEnd - Предметы и Инвентарь

## ✅ Завершено:

### 1. Компонент ItemSlot с Tooltip
- **Файл компонента:** `/apps/frontend/src/components/ItemSlot.tsx` (и `.js`)
- **Функции:**
  - Отображение карточки предмета со значком
  - Hover-подсказка (tooltip) с полной информацией
  - Показ урона, защиты, характеристик, цены
  - Поддержка редкости (common/uncommon/rare/legendary)

### 2. Стили для карточек
- **Файл стилей:** `/apps/frontend/src/styles.css`
- **Классы:** `.item-slot`, `.item-tooltip`, `.tooltip-*`
- **Цвета:** Используют переменные темы (--accent, --panel и т.д.)

### 3. Папки для изображений
```
/apps/frontend/public/art/
├── weapons/        → для оружия
├── armor/          → для брони
├── consumables/    → для расходников
├── items/          → для общих предметов
└── locations/      → для локаций (+ город Арклейн уже загружен)
```

---

## 📁 Полный путь для загрузки файлов:

### Абсолютный путь на вашей машине:
```
c:\Users\Ham_h\Downloads\TheEnd--main\apps\frontend\public\art\
```

### Структура папок:
```
c:\Users\Ham_h\Downloads\TheEnd--main\apps\frontend\public\art\
├── weapons/
│   ├── iron-sword.png
│   ├── steel-sword.png
│   ├── fireball.png
│   ├── frost-lance.png
│   └── shield-bash.png
├── armor/
│   ├── iron-helmet.png
│   ├── iron-chest.png
│   ├── iron-gloves.png
│   ├── iron-boots.png
│   ├── steel-helmet.png
│   └── steel-chest.png
├── consumables/
│   ├── health-potion.png
│   ├── stamina-potion.png
│   └── mana-potion.png
├── locations/
│   ├── arklein-city.png  ✅ (загруженo)
│   └── arena.png
└── items/
    └── (другие предметы)
```

---

## 🎮 Использование компонента ItemSlot:

### В инвентаре (PlayerQuickPanel или аналог):
```tsx
import { ItemSlot } from '../components/ItemSlot';

<ItemSlot 
  item={item}
  iconEmoji="⚔️"
  onClick={() => handleEquip(item)}
/>
```

### У торговца (Merchant):
```tsx
<ItemSlot 
  item={item}
  iconEmoji="💰"
  showPrice={true}
  price={item.sellPrice}
  onClick={() => handleBuy(item)}
/>
```

---

## 📸 Требования к картинкам:

| Тип | Размер | Формат |
|-----|--------|--------|
| **Оружие/Броня** | 128x128px | PNG/JPG |
| **Расходники** | 64x64px | PNG/JPG |
| **Локации** | 1280x720px | PNG/JPG |

---

## 🔄 Как использовать после загрузки картинок:

1. Сохраните картинки в соответствующие папки
2. Используйте пути вида: `/art/weapons/iron-sword.png`
3. В компоненте ItemSlot передайте `iconEmoji` для placeholder, или используйте `backgroundImage` CSS

### Пример с картинкой:
```tsx
<div 
  className="item-slot-icon"
  style={{backgroundImage: `url('/art/weapons/iron-sword.png')`}}
/>
```

---

## ✨ Что осталось сделать:

1. **Загрузить картинки:**
   - Откройте папки в проводнике (см. путь выше)
   - Разместите PNG/JPG файлы в нужные подпапки

2. **Обновить инвентарь/торговца:**
   - Подключите компонент `ItemSlot` в места отображения предметов
   - Передавайте prop `iconEmoji` или используйте background-image

3. **Проверить отображение:**
   ```bash
   npm run dev:frontend
   ```
   Откройте http://localhost:5174 и проверьте hover на карточках

---

## 📍 Справочник файлов:

- **Компонент:** [/apps/frontend/src/components/ItemSlot.tsx](/apps/frontend/src/components/ItemSlot.tsx)
- **Компонент JS:** [/apps/frontend/src/components/ItemSlot.js](/apps/frontend/src/components/ItemSlot.js)
- **Стили:** [/apps/frontend/src/styles.css](/apps/frontend/src/styles.css)
- **Папки картинок:** [/apps/frontend/public/art/](/apps/frontend/public/art/)
