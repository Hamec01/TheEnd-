export var Race;
(function (Race) {
    Race["Human"] = "HUMAN";
    Race["Dwarf"] = "DWARF";
    Race["HighElf"] = "HIGH_ELF";
    Race["WoodElf"] = "WOOD_ELF";
})(Race || (Race = {}));
export const RACE_DEFINITIONS = {
    [Race.Human]: {
        race: Race.Human,
        label: 'Human',
        description: 'Универсальная раса с доступом к магии и стихиям.',
        bonuses: ['+10% к опыту', 'Может использовать магию', 'Может использовать стихии'],
        restrictions: ['Стихии тратят x2 MP по сравнению с эльфами'],
        baseStats: {
            hp: 6,
            mp: 6,
            stamina: 6,
            strength: 5,
            constitution: 5,
            dexterity: 5,
            intelligence: 6,
            luck: 5,
            perception: 5,
            willpower: 5,
        },
        modifiers: {
            expGainMultiplier: 1.1,
            canUseMagic: true,
            canUseElements: true,
            magicDamageTakenMultiplier: 1,
            elementDamageTakenMultiplier: 1,
            elementMpCostMultiplier: 2,
        },
    },
    [Race.Dwarf]: {
        race: Race.Dwarf,
        label: 'Dwarf',
        description: 'Выносливый воин с высокой устойчивостью к магии.',
        bonuses: ['-70% входящего магического урона'],
        restrictions: ['Не может использовать магию', 'Не может использовать стихии'],
        baseStats: {
            hp: 8,
            mp: 3,
            stamina: 7,
            strength: 6,
            constitution: 8,
            dexterity: 4,
            intelligence: 4,
            luck: 5,
            perception: 4,
            willpower: 7,
        },
        modifiers: {
            expGainMultiplier: 1,
            canUseMagic: false,
            canUseElements: false,
            magicDamageTakenMultiplier: 0.3,
            elementDamageTakenMultiplier: 1,
            elementMpCostMultiplier: 999,
        },
    },
    [Race.HighElf]: {
        race: Race.HighElf,
        label: 'High Elf',
        description: 'Боевой эльф с упором на атакующие стихии.',
        bonuses: ['Врождённое владение стихиями', 'Приоритет: ветер, холод, мерзлота'],
        restrictions: [],
        baseStats: {
            hp: 5,
            mp: 8,
            stamina: 6,
            strength: 6,
            constitution: 4,
            dexterity: 5,
            intelligence: 8,
            luck: 5,
            perception: 6,
            willpower: 6,
        },
        modifiers: {
            expGainMultiplier: 1,
            canUseMagic: true,
            canUseElements: true,
            magicDamageTakenMultiplier: 1,
            elementDamageTakenMultiplier: 1,
            elementMpCostMultiplier: 1,
        },
    },
    [Race.WoodElf]: {
        race: Race.WoodElf,
        label: 'Wood Elf',
        description: 'Ловкий эльф контроля, усиления и мобильности.',
        bonuses: ['Врождённое владение стихиями', 'Ускорение, усиления, контроль природы'],
        restrictions: [],
        baseStats: {
            hp: 5,
            mp: 7,
            stamina: 7,
            strength: 4,
            constitution: 4,
            dexterity: 8,
            intelligence: 6,
            luck: 5,
            perception: 8,
            willpower: 6,
        },
        modifiers: {
            expGainMultiplier: 1,
            canUseMagic: true,
            canUseElements: true,
            magicDamageTakenMultiplier: 1,
            elementDamageTakenMultiplier: 1,
            elementMpCostMultiplier: 1,
        },
    },
};
export function getRaceDefinition(race) {
    return RACE_DEFINITIONS[race];
}
