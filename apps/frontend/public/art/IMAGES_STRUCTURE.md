# Структура изображений игры TheEnd

## Пути для загрузки картинок:

### Оружие (Weapons)
📁 `/public/art/weapons/`

Файлы по названиям предметов (без расширения, добавьте .png или .jpg):
- `iron-sword.png` - железный меч
- `steel-sword.png` - стальной меч
- `fireball.png` - огненный шар (для скилла Fireball)
- `frost-lance.png` - ледяное копьё (для скилла FrostLance)
- `shield-bash.png` - щитовой удар (для скилла ShieldBash)

### Броня (Armor)
📁 `/public/art/armor/`

- `iron-helmet.png` - железный шлем
- `iron-chest.png` - железная кираса
- `iron-gloves.png` - железные перчатки
- `iron-boots.png` - железные сапоги
- `steel-helmet.png` - стальной шлем
- `steel-chest.png` - стальная кираса

### Расходники (Consumables)
📁 `/public/art/consumables/`

- `health-potion.png` - зелье здоровья
- `stamina-potion.png` - зелье выносливости
- `mana-potion.png` - зелье маны

### Локации (Locations)
📁 `/public/art/locations/`

- `arklein-city.png` - город Арклейн (большая карта)
- `arena.png` - арена боёв

### Предметы (Items) - общие
📁 `/public/art/items/`

Здесь хранятся иконки и спрайты общего назначения для UI

---

## Как загружать:

1. Сохраните картинки в соответствующих папках выше
2. Используйте пути вида `/art/weapons/iron-sword.png` в коде
3. После загрузки картинок вот команда для проверки:
   ```bash
   npm run dev:frontend
   ```

## Требования к картинкам:

- **Формат:** PNG или JPG
- **Оружие/Броня:** 64x64px или 128x128px (для иконок)
- **Локации:** 1280x720px или больше (для фона)
- **Расходники:** 48x48px или 64x64px (для иконок)
