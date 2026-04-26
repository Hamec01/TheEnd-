export function getRaceSilhouette(race) {
    switch (race) {
        case 'HUMAN':
            return '/Resurse/Human.png';
        case 'HIGH_ELF':
            return '/Resurse/ELF.png';
        case 'WOOD_ELF':
            return '/Resurse/ELF.png';
        case 'DWARF':
            return '/Resurse/Dwarf.png';
        default:
            return '/Resurse/Human.png';
    }
}
export function getRaceSilhouetteFallback(race) {
    switch (race) {
        case 'HUMAN':
            return '/art/races/human.png';
        case 'HIGH_ELF':
            return '/art/races/elf.png';
        case 'WOOD_ELF':
            return '/art/races/elf.png';
        case 'DWARF':
            return '/art/races/dwarf.png';
        default:
            return '/art/races/human.png';
    }
}
export function getRaceSilhouetteScale(race) {
    switch (race) {
        case 'DWARF':
            return 0.85;
        case 'HIGH_ELF':
        case 'WOOD_ELF':
            return 1.05;
        case 'HUMAN':
        default:
            return 1;
    }
}
export function getRaceSilhouetteGlowClass(race) {
    switch (race) {
        case 'HIGH_ELF':
        case 'WOOD_ELF':
            return 'race-glow-elf';
        case 'DWARF':
            return 'race-glow-dwarf';
        case 'HUMAN':
        default:
            return 'race-glow-human';
    }
}
