import { Race } from './races';
export const BINDING_RUNE_IDS = ['hald', 'elgar', 'kragnor', 'nurrak', 'feldr', 'orkann', 'harran'];
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function mergeCost(a, b) {
    return {
        hp: (a.hp ?? 0) + (b.hp ?? 0),
        stamina: (a.stamina ?? 0) + (b.stamina ?? 0),
        mp: (a.mp ?? 0) + (b.mp ?? 0),
        memoryLossRisk: (a.memoryLossRisk ?? 0) + (b.memoryLossRisk ?? 0),
        soulDamageRisk: (a.soulDamageRisk ?? 0) + (b.soulDamageRisk ?? 0),
        selfDebuffId: b.selfDebuffId ?? a.selfDebuffId,
        riskChance: (a.riskChance ?? 0) + (b.riskChance ?? 0),
    };
}
function createRune(definition) {
    return definition;
}
const BINDING_RUNES = [
    createRune({
        id: 'hald',
        name: 'Хальд',
        originalName: 'Hald',
        category: 'binding',
        signDescription: 'Две острые линии, перекрещённые как копья.',
        description: 'Связывает действие и жертву, удерживает энергию в пределах носителя.',
        cost: { hp: 2 },
        effects: [{ type: 'stabilize', value: 10 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'elgar',
        name: 'Элгар',
        originalName: 'Elgar',
        category: 'binding',
        signDescription: 'Кольцо с разомкнутым северным сегментом.',
        description: 'Фиксирует поток сил и закрывает разрывы контуров.',
        cost: { hp: 1, stamina: 4 },
        effects: [{ type: 'stabilize', value: 8 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'kragnor',
        name: 'Крагнор',
        originalName: 'Kragnor',
        category: 'binding',
        signDescription: 'Три зарубки вокруг вертикальной оси.',
        description: 'Удерживает сложные цепочки рун в боевом ритме.',
        cost: { hp: 2, stamina: 5 },
        effects: [{ type: 'stabilize', value: 11 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'nurrak',
        name: 'Нуррак',
        originalName: 'Nurrak',
        category: 'binding',
        signDescription: 'Перекошенный треугольник с нижним зубцом.',
        description: 'Тормозит рост нестабильности в запретных формулах.',
        cost: { hp: 3, riskChance: 0.02 },
        effects: [{ type: 'stabilize', value: 12 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'galmor',
        name: 'Галмор',
        originalName: 'Galmor',
        category: 'binding',
        signDescription: 'Широкая дуга с боковым шипом.',
        description: 'Стабилизирует ритуальные контуры и снижает откат.',
        cost: { stamina: 6, riskChance: 0.02 },
        effects: [{ type: 'stabilize', value: 9 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'shorrg',
        name: 'Шоррг',
        originalName: 'Shorrg',
        category: 'binding',
        signDescription: 'Зигзаг в квадратной рамке.',
        description: 'Сглаживает колебания мощных боевых печатей.',
        cost: { stamina: 8 },
        effects: [{ type: 'stabilize', value: 7 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'feldr',
        name: 'Фелдр',
        originalName: 'Feldr',
        category: 'binding',
        signDescription: 'Двойной угол с центральной меткой.',
        description: 'Закрепляет канал передачи силы и смягчает цену ошибки.',
        cost: { hp: 2, stamina: 3 },
        effects: [{ type: 'stabilize', value: 10 }, { type: 'focus', value: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'orkann',
        name: 'Орканн',
        originalName: 'Orkann',
        category: 'binding',
        signDescription: 'Пара сходящихся линий с верхним разломом.',
        description: 'Связывает и усиливает контур, повышая мощь ценой риска.',
        cost: { hp: 4, stamina: 6, riskChance: 0.06 },
        effects: [{ type: 'amplify', value: 12 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'drung',
        name: 'Друнг',
        originalName: 'Drung',
        category: 'binding',
        signDescription: 'Глухой ромб с горизонтальной чертой.',
        description: 'Снижает мощность узла, но уменьшает риск отката.',
        cost: { stamina: 4 },
        effects: [{ type: 'reduce_power', value: 10 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'kavragg',
        name: 'Каврагг',
        originalName: 'Kavragg',
        category: 'binding',
        signDescription: 'Пара параллельных штрихов с внутренним надрезом.',
        description: 'Синхронизирует соседние руны в один пульс.',
        cost: { stamina: 5 },
        effects: [{ type: 'sync', value: 6 }, { type: 'stabilize', value: 6 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'zulhet',
        name: 'Зулхет',
        originalName: 'Zulhet',
        category: 'binding',
        signDescription: 'Волнистая черта, зажатая между двумя опорами.',
        description: 'Замедляет всплеск силы, предотвращая мгновенный срыв.',
        cost: { stamina: 5 },
        effects: [{ type: 'delay', value: 5 }, { type: 'stabilize', value: 5 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'morhunn',
        name: 'Морхунн',
        originalName: 'Morhunn',
        category: 'binding',
        signDescription: 'Тяжёлая петля с двойным основанием.',
        description: 'Переводит нестабильный поток в управляемый канал.',
        cost: { hp: 3, riskChance: 0.03 },
        effects: [{ type: 'stabilize', value: 13 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'harran',
        name: 'Харран',
        originalName: 'Harran',
        category: 'binding',
        signDescription: 'Окружность с отсеченным западным сегментом.',
        description: 'Скрепляет многослойные ритуальные узлы.',
        cost: { hp: 4, stamina: 4 },
        effects: [{ type: 'stabilize', value: 14 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
];
const COMBAT_RUNES = [
    createRune({
        id: 'uragg',
        name: 'Урагг',
        originalName: 'Uragg',
        category: 'combat',
        signDescription: 'Зигзаг, как молния.',
        description: 'Пробуждает ярость и укрепляет дух.',
        cost: { hp: 5, stamina: 10, riskChance: 0.05 },
        effects: [
            { type: 'stat_bonus', target: 'strength', value: 2, durationTurns: 3 },
            { type: 'stat_bonus', target: 'willpower', value: 1, durationTurns: 3 },
        ],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'drakn',
        name: 'Дракн',
        originalName: 'Drakn',
        category: 'combat',
        signDescription: 'Ломаная линия с крюком на конце.',
        description: 'Усиливает рубящий урон оружия ближнего боя.',
        cost: { hp: 4, stamina: 8, riskChance: 0.04 },
        effects: [{ type: 'damage_bonus', target: 'melee', value: 12, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'skharn',
        name: 'Схарн',
        originalName: 'Skharn',
        category: 'combat',
        signDescription: 'Три острых штриха, сходящихся в точке.',
        description: 'Поднимает пробивную мощь удара и давление на защиту.',
        cost: { stamina: 9, riskChance: 0.04 },
        effects: [{ type: 'damage_bonus', target: 'armor_break', value: 10, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'kregg',
        name: 'Крегг',
        originalName: 'Kregg',
        category: 'combat',
        signDescription: 'Пара зигзагов, замкнутых в нижней части.',
        description: 'Даёт короткий всплеск силы следующей атаке.',
        cost: { hp: 3, stamina: 7, riskChance: 0.03 },
        effects: [{ type: 'damage_bonus', target: 'next_hit', value: 15, durationTurns: 1 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'skragg',
        name: 'Скрагг',
        originalName: 'Skragg',
        category: 'combat',
        signDescription: 'Ломаный крест с удлиненным южным лучом.',
        description: 'Перенаправляет силу в кровавый импульс.',
        cost: { hp: 8, stamina: 6, riskChance: 0.06 },
        effects: [{ type: 'damage_bonus', target: 'bleed_like', value: 14, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'tarn',
        name: 'Тарн',
        originalName: 'Tarn',
        category: 'combat',
        signDescription: 'Острый угол, направленный вперёд.',
        description: 'Ускоряет подготовку и ритм боевых печатей.',
        cost: { stamina: 5, riskChance: 0.02 },
        effects: [{ type: 'accelerate', value: 6, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'vorr',
        name: 'Ворр',
        originalName: 'Vorr',
        category: 'combat',
        signDescription: 'Горизонтальный штрих с двойным зацепом.',
        description: 'Сдвигает нагрузку в выносливость, усиливая напор.',
        cost: { stamina: 12, riskChance: 0.05 },
        effects: [{ type: 'stat_bonus', target: 'stamina', value: 20, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'trogg',
        name: 'Трогг',
        originalName: 'Trogg',
        category: 'combat',
        signDescription: 'Три коротких рубца в дуге.',
        description: 'Прижимает цель силой, повышая шанс контроля.',
        cost: { stamina: 8, riskChance: 0.04 },
        effects: [{ type: 'bind', value: 1, durationTurns: 1 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'irn',
        name: 'Ирн',
        originalName: 'Irn',
        category: 'combat',
        signDescription: 'Короткая вертикаль с нижней петлей.',
        description: 'Фокусирует урон в одну точку.',
        cost: { hp: 2, stamina: 6, riskChance: 0.03 },
        effects: [{ type: 'focus', value: 8, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
];
const PROTECTIVE_RUNES = [
    createRune({
        id: 'farn',
        name: 'Фарн',
        originalName: 'Farn',
        category: 'protective',
        signDescription: 'Дуга над опорной чертой.',
        description: 'Укрепляет телесную защиту.',
        cost: { stamina: 5 },
        effects: [{ type: 'resistance_bonus', target: 'physical', value: 10, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'gort',
        name: 'Горт',
        originalName: 'Gort',
        category: 'protective',
        signDescription: 'Квадрат с центральной точкой.',
        description: 'Снижает магическое давление на носителя.',
        cost: { stamina: 4 },
        effects: [{ type: 'resistance_bonus', target: 'magic', value: 8, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'ilm',
        name: 'Ильм',
        originalName: 'Ilm',
        category: 'protective',
        signDescription: 'Вертикаль, рассечённая на три части.',
        description: 'Даёт иммунитет к краткому ослеплению.',
        cost: { stamina: 3 },
        effects: [{ type: 'status_immunity', statusEffectId: 'blind', durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'varkh',
        name: 'Варкх',
        originalName: 'Varkh',
        category: 'protective',
        signDescription: 'Ломаный щит из трёх соединённых линий.',
        description: 'Временно ослабляет входящий урон.',
        cost: { stamina: 6 },
        effects: [{ type: 'reduce_power', target: 'incoming_damage', value: 12, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'olgr',
        name: 'Олгр',
        originalName: 'Olgr',
        category: 'protective',
        signDescription: 'Короткая спираль с верхним шипом.',
        description: 'Переводит часть урона в усталость.',
        cost: { stamina: 7 },
        effects: [{ type: 'transfer', target: 'damage_to_stamina', value: 8, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'zrung',
        name: 'Зрунг',
        originalName: 'Zrung',
        category: 'protective',
        signDescription: 'Сдвоенный крюк под короткой чертой.',
        description: 'Снижает шанс вражеского контроля.',
        cost: { stamina: 5 },
        effects: [{ type: 'resistance_bonus', target: 'control', value: 9, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'tulg',
        name: 'Тулг',
        originalName: 'Tulg',
        category: 'protective',
        signDescription: 'Широкая горизонталь с двойной подпоркой.',
        description: 'Поддерживает устойчивость к кровопотере.',
        cost: { stamina: 4 },
        effects: [{ type: 'resistance_bonus', target: 'bleed', value: 10, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'orn',
        name: 'Орн',
        originalName: 'Orn',
        category: 'protective',
        signDescription: 'Кольцо с коротким внутренним штрихом.',
        description: 'Связывает защитные печати и выравнивает отклик.',
        cost: { stamina: 4 },
        effects: [{ type: 'sync', value: 4, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'skharug',
        name: 'Схаруг',
        originalName: 'Skharug',
        category: 'protective',
        signDescription: 'Тяжёлая зигзагообразная дуга.',
        description: 'Усиливает защиту от рунического отката.',
        cost: { hp: 2, stamina: 6, riskChance: 0.02 },
        effects: [{ type: 'resistance_bonus', target: 'rune_backlash', value: 12, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'kulg',
        name: 'Кулг',
        originalName: 'Kulg',
        category: 'protective',
        signDescription: 'Укороченный крест с тупыми концами.',
        description: 'Делает руну мягче, но слабее.',
        cost: { stamina: 3 },
        effects: [{ type: 'reduce_power', value: 8 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
];
const RITUAL_AND_FORBIDDEN_RUNES = [
    createRune({
        id: 'mordr',
        name: 'Мордр',
        originalName: 'Mordr',
        category: 'ritual',
        signDescription: 'Двойная спираль в ломаной рамке.',
        description: 'Ритуальная печать переноса силы между узлами.',
        cost: { hp: 10, mp: 10, riskChance: 0.12 },
        effects: [{ type: 'transfer', target: 'power_channel', value: 1 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
        unstableWithoutBindingRune: true,
    }),
    createRune({
        id: 'zagrann',
        name: 'Загранн',
        originalName: 'Zagrann',
        category: 'forbidden',
        signDescription: 'Квадрат с вписанной перевёрнутой спиралью.',
        description: 'Вызов теней и демонов из иных слоёв мира.',
        cost: {
            hp: 20,
            stamina: 20,
            memoryLossRisk: 0.15,
            soulDamageRisk: 0.1,
            riskChance: 0.35,
        },
        effects: [{ type: 'summon', target: 'demon_or_shadow', value: 1 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'harrok',
        name: 'Харрок',
        originalName: 'Harrok',
        category: 'forbidden',
        signDescription: 'Пилообразный круг с внутренним надрезом.',
        description: 'Срывает печати вражеского духа, но травмирует носителя.',
        cost: { hp: 14, stamina: 12, soulDamageRisk: 0.08, riskChance: 0.24 },
        effects: [{ type: 'curse', target: 'spirit', value: 2, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'varnhul',
        name: 'Варнхул',
        originalName: 'Varnhul',
        category: 'forbidden',
        signDescription: 'Треугольник с рваным основанием.',
        description: 'Подчиняет волю слабых духов.',
        cost: { hp: 12, mp: 8, memoryLossRisk: 0.1, riskChance: 0.22 },
        effects: [{ type: 'bind', target: 'spirit_entity', value: 1, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'lurn',
        name: 'Лурн',
        originalName: 'Lurn',
        category: 'ritual',
        signDescription: 'Окружность с двойным штрихом на юге.',
        description: 'Временный канал для группового ритуала.',
        cost: { hp: 6, mp: 6, riskChance: 0.1 },
        effects: [{ type: 'sync', value: 7 }, { type: 'focus', value: 4 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
        unstableWithoutBindingRune: true,
    }),
    createRune({
        id: 'dorgul',
        name: 'Доргул',
        originalName: 'Dorgul',
        category: 'forbidden',
        signDescription: 'Зубчатая дуга с двойной спиралью.',
        description: 'Открывает путь к изнанке для тёмного ритуала.',
        cost: { hp: 18, stamina: 10, soulDamageRisk: 0.12, riskChance: 0.3 },
        effects: [{ type: 'summon', target: 'hostile_echo', value: 1 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'grimr',
        name: 'Гримр',
        originalName: 'Grimr',
        category: 'forbidden',
        signDescription: 'Длинная вертикаль с ломаными лучами.',
        description: 'Усиливает проклятия и вытягивает силу из носителя.',
        cost: { hp: 16, mp: 12, memoryLossRisk: 0.08, riskChance: 0.27 },
        effects: [{ type: 'curse', target: 'all_enemies', value: 1, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'faragg',
        name: 'Фарагг',
        originalName: 'Faragg',
        category: 'ritual',
        signDescription: 'Широкий ромб с внутренней точкой.',
        description: 'Ритуал переноса урона и силы между целями.',
        cost: { hp: 9, stamina: 8, riskChance: 0.15 },
        effects: [{ type: 'transfer', target: 'damage_link', value: 1, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
        unstableWithoutBindingRune: true,
    }),
    createRune({
        id: 'falgort',
        name: 'Фалгорт',
        originalName: 'Falgort',
        category: 'forbidden',
        signDescription: 'Ломаная спираль с наружным контуром.',
        description: 'Печать распада, ослабляющая защиту и рассудок.',
        cost: { hp: 17, stamina: 9, memoryLossRisk: 0.12, soulDamageRisk: 0.09, riskChance: 0.29 },
        effects: [{ type: 'reduce_power', target: 'enemy_resistance', value: 14, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        forbidden: true,
        unstableWithoutBindingRune: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'morrg',
        name: 'Моррг',
        originalName: 'Morrg',
        category: 'ritual',
        signDescription: 'Короткая спираль с двойным хвостом.',
        description: 'Старый ритуальный узел переноса боли.',
        cost: { hp: 11, riskChance: 0.17 },
        effects: [{ type: 'transfer', target: 'pain_echo', value: 1, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
        unstableWithoutBindingRune: true,
    }),
];
const UTILITY_RUNES = [
    createRune({
        id: 'rung',
        name: 'Рунг',
        originalName: 'Rung',
        category: 'ritual',
        signDescription: 'Короткая дуга над двойной опорой.',
        description: 'Стабилизирует связь с природными потоками.',
        cost: { stamina: 4, mp: 2, riskChance: 0.05 },
        effects: [{ type: 'focus', target: 'nature_channel', value: 6, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'hemr',
        name: 'Хемр',
        originalName: 'Hemr',
        category: 'ritual',
        signDescription: 'Короткая волна, пересечённая штрихом.',
        description: 'Открывает духовное зрение на короткое время.',
        cost: { mp: 5, riskChance: 0.05 },
        effects: [{ type: 'vision', value: 1, durationTurns: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'garuk',
        name: 'Гарук',
        originalName: 'Garuk',
        category: 'ritual',
        signDescription: 'Две симметричные дуги с центральной точкой.',
        description: 'Ускоряет передачу рунического сигнала.',
        cost: { stamina: 3, riskChance: 0.04 },
        effects: [{ type: 'accelerate', value: 5, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'suggrat',
        name: 'Сугграт',
        originalName: 'Suggrat',
        category: 'ritual',
        signDescription: 'Сдвоенная спираль с нижним крюком.',
        description: 'Усиливает ритуальную фокусировку на цели.',
        cost: { mp: 6, riskChance: 0.06 },
        effects: [{ type: 'focus', target: 'ritual_target', value: 7, durationTurns: 2 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'eshtar',
        name: 'Эштар',
        originalName: 'Eshtar',
        category: 'ritual',
        signDescription: 'Линия с тройным разветвлением.',
        description: 'Упорядочивает язык и смысл древних формул.',
        cost: { mp: 4, riskChance: 0.03 },
        effects: [{ type: 'language', value: 1, durationTurns: 4 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'okr',
        name: 'Окр',
        originalName: 'Okr',
        category: 'ritual',
        signDescription: 'Квадрат с открытой верхней гранью.',
        description: 'Снимает часть чужих рунических печатей.',
        cost: { mp: 5, stamina: 3, riskChance: 0.06 },
        effects: [{ type: 'dispel', value: 1 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'drognar',
        name: 'Дрогнар',
        originalName: 'Drognar',
        category: 'ritual',
        signDescription: 'Зигзаг в короткой горизонтальной рамке.',
        description: 'Сдвигает эффект по времени и снижает всплеск.',
        cost: { stamina: 4, riskChance: 0.04 },
        effects: [{ type: 'delay', value: 4 }, { type: 'reduce_power', value: 4 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
    createRune({
        id: 'turhan',
        name: 'Турхан',
        originalName: 'Turhan',
        category: 'ritual',
        signDescription: 'Ромб с внутренним штрихом вверх.',
        description: 'Делает канал устойчивым к внешним шумам.',
        cost: { stamina: 4, mp: 2, riskChance: 0.05 },
        effects: [{ type: 'stabilize', value: 4 }, { type: 'focus', value: 3 }],
        requiresShamanKnowledge: true,
        canBeCarvedByDwarf: true,
    }),
];
export const RUNE_DEFINITIONS = [
    ...BINDING_RUNES,
    ...COMBAT_RUNES,
    ...PROTECTIVE_RUNES,
    ...RITUAL_AND_FORBIDDEN_RUNES,
    ...UTILITY_RUNES,
].reduce((acc, rune) => {
    acc[rune.id] = rune;
    return acc;
}, {});
function hasRunePrice(cost) {
    return (cost.hp ?? 0) > 0
        || (cost.stamina ?? 0) > 0
        || (cost.mp ?? 0) > 0
        || (cost.riskChance ?? 0) > 0
        || (cost.memoryLossRisk ?? 0) > 0
        || (cost.soulDamageRisk ?? 0) > 0
        || typeof cost.selfDebuffId === 'string';
}
function isPowerfulRune(rune) {
    if (rune.category === 'forbidden') {
        return true;
    }
    const hasHighValueEffect = rune.effects.some((effect) => (effect.value ?? 0) >= 12);
    const hasHighImpactEffect = rune.effects.some((effect) => ['amplify', 'summon', 'curse', 'transfer'].includes(effect.type));
    return hasHighValueEffect || hasHighImpactEffect;
}
export function ensureRuneDesignSafety(definitions = RUNE_DEFINITIONS) {
    for (const rune of Object.values(definitions)) {
        if (isPowerfulRune(rune) && !hasRunePrice(rune.cost)) {
            throw new Error(`Powerful rune ${rune.id} has no sacrifice or risk price.`);
        }
        if ((rune.category === 'forbidden' || rune.forbidden === true) && (rune.cost.riskChance ?? 0) <= 0) {
            throw new Error(`Forbidden rune ${rune.id} must always have non-zero riskChance.`);
        }
    }
}
function isBindingRune(runeId) {
    return BINDING_RUNE_IDS.includes(runeId);
}
function resolveRunes(runeDefinitions, runeIds) {
    const byId = new Map(runeDefinitions.map((rune) => [rune.id, rune]));
    return runeIds.map((id) => byId.get(id)).filter((rune) => Boolean(rune));
}
function getPowerModifier(runes) {
    const amplifyScore = runes.flatMap((rune) => rune.effects).filter((effect) => effect.type === 'amplify').reduce((sum, effect) => sum + (effect.value ?? 8), 0);
    const reduceScore = runes.flatMap((rune) => rune.effects).filter((effect) => effect.type === 'reduce_power').reduce((sum, effect) => sum + (effect.value ?? 8), 0);
    return clamp(1 + amplifyScore / 100 - reduceScore / 120, 0.45, 2.2);
}
export function calculateRuneComplex(runeDefinitions, runeIds) {
    const runes = resolveRunes(runeDefinitions, runeIds);
    const filteredIds = runes.map((rune) => rune.id);
    const hasBindingRune = filteredIds.some((id) => isBindingRune(id));
    const ritualOrForbiddenRunes = runes.filter((rune) => rune.category === 'ritual' || rune.category === 'forbidden');
    const forbiddenRunes = runes.filter((rune) => rune.category === 'forbidden' || rune.forbidden === true);
    const combatOrForbiddenCount = runes.filter((rune) => rune.category === 'combat' || rune.category === 'forbidden').length;
    const totalCost = runes.reduce((cost, rune) => mergeCost(cost, rune.cost), {});
    const isComplexSystem = filteredIds.length >= 3;
    let risk = totalCost.riskChance ?? 0;
    risk += (totalCost.memoryLossRisk ?? 0) * 0.5;
    risk += (totalCost.soulDamageRisk ?? 0) * 0.75;
    if (ritualOrForbiddenRunes.length > 0 && !hasBindingRune) {
        risk += 0.35;
    }
    const unstableWithoutBinding = runes.some((rune) => rune.unstableWithoutBindingRune);
    if (unstableWithoutBinding && !hasBindingRune) {
        risk += 0.22;
    }
    if (combatOrForbiddenCount >= 4 && !hasBindingRune) {
        risk += 0.2;
    }
    // Complex rune systems must include at least one binding rune.
    if (isComplexSystem && !hasBindingRune) {
        risk += 0.25;
    }
    const bindingCount = filteredIds.filter((id) => isBindingRune(id)).length;
    const stabilizePower = runes
        .flatMap((rune) => rune.effects)
        .filter((effect) => effect.type === 'stabilize')
        .reduce((sum, effect) => sum + (effect.value ?? 0), 0);
    const amplifyCount = runes.flatMap((rune) => rune.effects).filter((effect) => effect.type === 'amplify').length;
    const reducePowerCount = runes.flatMap((rune) => rune.effects).filter((effect) => effect.type === 'reduce_power').length;
    risk -= bindingCount * 0.08;
    risk -= stabilizePower / 250;
    risk -= reducePowerCount * 0.05;
    risk += amplifyCount * 0.07;
    // Forbidden runes must always stay risky, even with stabilizers.
    if (forbiddenRunes.length > 0) {
        const forbiddenRiskFloor = 0.2 + forbiddenRunes.length * 0.08;
        risk = Math.max(risk, forbiddenRiskFloor);
    }
    if (isComplexSystem && !hasBindingRune) {
        risk = Math.max(risk, 0.75);
    }
    risk = clamp(risk, 0, 0.98);
    const powerModifier = getPowerModifier(runes);
    const combinedEffects = runes
        .flatMap((rune) => rune.effects)
        .map((effect) => {
        if (typeof effect.value !== 'number') {
            return effect;
        }
        return {
            ...effect,
            value: Math.round(effect.value * powerModifier),
        };
    });
    const stability = clamp(Math.round(100 - risk * 100 + bindingCount * 8 + stabilizePower * 0.4 - amplifyCount * 6 - Math.max(0, combatOrForbiddenCount - 3) * 5), 0, 100);
    const isUnstable = stability < 45
        || risk >= 0.6
        || (isComplexSystem && !hasBindingRune)
        || ((forbiddenRunes.length > 0 || unstableWithoutBinding) && !hasBindingRune);
    return {
        id: `complex:${filteredIds.join('+') || 'empty'}`,
        name: filteredIds.length > 0 ? `Rune Complex ${filteredIds.join(' + ')}` : 'Rune Complex (empty)',
        runeIds: filteredIds,
        stability,
        riskChance: risk,
        totalCost,
        combinedEffects,
        isUnstable,
    };
}
export function getDefaultRunePermissionsForRace(race) {
    if (race === Race.Dwarf || race === 'DWARF') {
        return {
            knowsRuneCraft: false,
            canCarveRunes: true,
            canUseRuneItems: true,
        };
    }
    return {
        knowsRuneCraft: false,
        canCarveRunes: false,
        canUseRuneItems: true,
    };
}
export function canCharacterCreateRuneComplex(character) {
    return character.knowsRuneCraft === true;
}
export function canCharacterUseRune(character, rune) {
    if (rune.forbidden && character.hasForbiddenRunePermission !== true) {
        return false;
    }
    if (rune.requiresShamanKnowledge && character.knowsRuneCraft !== true && character.canUseRuneItems !== true) {
        return false;
    }
    return character.canUseRuneItems !== false;
}
export function applyRuneCost(character, cost) {
    return {
        ...character,
        currentHp: Math.max(0, character.currentHp - (cost.hp ?? 0)),
        currentStamina: Math.max(0, character.currentStamina - (cost.stamina ?? 0)),
        currentMp: Math.max(0, character.currentMp - (cost.mp ?? 0)),
    };
}
export function calculateRuneBacklashChance(complex, userWillpower) {
    const willpowerFactor = clamp(userWillpower / 200, 0, 0.7);
    const chance = complex.riskChance * (1 - willpowerFactor);
    return clamp(chance, 0, 0.98);
}
export function rollRuneBacklash(complex, userWillpower) {
    const chance = calculateRuneBacklashChance(complex, userWillpower);
    if (Math.random() > chance) {
        return null;
    }
    if ((complex.totalCost.soulDamageRisk ?? 0) >= 0.12) {
        return {
            type: 'soul_damage',
            amount: 1,
            description: 'Руна повредила духовный слой носителя.',
        };
    }
    if ((complex.totalCost.memoryLossRisk ?? 0) >= 0.1) {
        return {
            type: 'memory_loss',
            amount: 1,
            description: 'Часть памяти выжжена руническим откатом.',
        };
    }
    if (complex.isUnstable) {
        return {
            type: 'rune_burnout',
            durationTurns: 2,
            description: 'Рунический контур выгорел и перестал отвечать.',
        };
    }
    if (chance >= 0.4) {
        return {
            type: 'summon_hostile_entity',
            amount: 1,
            description: 'Откат привёл к враждебному призыву.',
        };
    }
    if (chance >= 0.25) {
        return {
            type: 'madness',
            durationTurns: 1,
            description: 'Ментальный срыв из-за нестабильной формулы.',
        };
    }
    return {
        type: 'hp_loss',
        amount: Math.max(1, Math.round((complex.totalCost.hp ?? 4) * 0.5)),
        description: 'Носитель получил урон от рунического отката.',
    };
}
