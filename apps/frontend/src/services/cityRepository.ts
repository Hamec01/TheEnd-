import type { City, CityLocation } from '../types/city';

const CITY_STORAGE_KEY = 'theend.admin.cities.v1';

function nowIso(): string {
  return new Date().toISOString();
}

function createStarterLocation(cityId: string, id: string, name: string, type: CityLocation['type']): CityLocation {
  return {
    id,
    cityId,
    name,
    type,
    description: '',
    shapeType: 'rectangle',
    shape: { x: 120, y: 120, width: 120, height: 80 },
    npcIds: [],
    questIds: [],
    shopIds: [],
    isVisible: true,
    isUnlocked: true,
    markerIcon: type,
  };
}

function seedCities(): City[] {
  const createdAt = nowIso();

  return [
    {
      id: 'argos_arklein',
      name: 'Арклейн',
      kingdomId: 'argos',
      regionId: 'teramor',
      worldZoneId: 'zone_argos_arklein',
      status: 'active',
      shortDescription: 'Пограничный город-крепость Аргоса.',
      fullDescription: 'Арклейн стоит на напряжённой границе и служит военным, торговым и политическим узлом.',
      history: '',
      loreNotes: '',
      populationTotal: 12000,
      racePopulation: [
        { raceId: 'human', percent: 82, role: 'citizens, soldiers, merchants' },
        { raceId: 'dwarf', percent: 10, role: 'smiths, engineers' },
        { raceId: 'wood_elf', percent: 8, role: 'scouts, healers' },
      ],
      rulerName: 'Барон Арклейна',
      rulerTitle: 'baron',
      governmentType: 'military border rule',
      economyTags: ['fortress', 'trade', 'blacksmith'],
      cultureTags: ['military', 'border', 'human'],
      dangerLevel: 4,
      recommendedLevel: 1,
      climate: 'temperate',
      visualTheme: 'dark medieval fortress',
      locations: [
        createStarterLocation('argos_arklein', 'gate_main', 'Главные ворота', 'gate'),
        createStarterLocation('argos_arklein', 'market_square', 'Рыночная площадь', 'market'),
        createStarterLocation('argos_arklein', 'blacksmith_old', 'Старая кузница', 'blacksmith'),
        createStarterLocation('argos_arklein', 'tavern_wolf', 'Таверна Волчий Дым', 'tavern'),
      ],
      connectedCityIds: [],
      connectedZoneIds: [],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'argos_razugar',
      name: 'Разу’гар',
      kingdomId: 'argos',
      regionId: 'teramor',
      status: 'active',
      shortDescription: 'Топкий город наёмников и пограничных людей.',
      fullDescription: 'Разу’гар вырос из старого поселения среди болот, где торговля, слухи и клинки стоят почти одинаково.',
      populationTotal: 7000,
      racePopulation: [
        { raceId: 'human', percent: 70, role: 'citizens, mercenaries' },
        { raceId: 'orc', percent: 10, role: 'rare outsiders, fighters' },
        { raceId: 'dwarf', percent: 20, role: 'smiths, traders' },
      ],
      rulerName: 'Совет старших домов',
      rulerTitle: 'council',
      governmentType: 'council',
      economyTags: ['mercenaries', 'swamp trade', 'weapons'],
      cultureTags: ['rough', 'border', 'trade'],
      dangerLevel: 6,
      recommendedLevel: 2,
      climate: 'swamp',
      visualTheme: 'wet dark wooden city',
      locations: [
        createStarterLocation('argos_razugar', 'tavern_shadow_cliff', 'Таверна Тень Обрыва', 'tavern'),
        createStarterLocation('argos_razugar', 'mud_market', 'Грязевой рынок', 'market'),
        createStarterLocation('argos_razugar', 'old_docks', 'Старые причалы', 'harbor'),
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'luminor_soleymar',
      name: 'Солеймар',
      kingdomId: 'luminor',
      status: 'active',
      shortDescription: 'Светлый порт и торговая столица Луминора.',
      fullDescription: 'Солеймар богат ремёслами, гаванями, купцами и солнечными башнями.',
      populationTotal: 42000,
      racePopulation: [{ raceId: 'human', percent: 90, role: 'citizens, merchants, sailors' }],
      rulerName: 'Король Солеймара',
      rulerTitle: 'king',
      governmentType: 'monarchy',
      economyTags: ['port', 'trade', 'craft'],
      cultureTags: ['sun', 'merchant', 'human'],
      dangerLevel: 2,
      recommendedLevel: 1,
      visualTheme: 'white stone port',
      locations: [
        createStarterLocation('luminor_soleymar', 'golden_harbor', 'Золотая гавань', 'harbor'),
        createStarterLocation('luminor_soleymar', 'sun_market', 'Солнечный рынок', 'market'),
        createStarterLocation('luminor_soleymar', 'royal_castle', 'Королевская цитадель', 'castle'),
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'kriantar_veridal',
      name: 'Веридал',
      kingdomId: 'kriantar',
      status: 'active',
      shortDescription: 'Столица людей и высших эльфов.',
      fullDescription: 'Веридал хранит холодную красоту высоких башен, древние союзы и опасные интриги.',
      populationTotal: 35000,
      racePopulation: [
        { raceId: 'human', percent: 55, role: 'citizens, soldiers' },
        { raceId: 'high_elf', percent: 40, role: 'nobles, mages' },
        { raceId: 'dwarf', percent: 5, role: 'craftsmen' },
      ],
      rulerName: 'Совет Веридала',
      rulerTitle: 'council',
      governmentType: 'council monarchy',
      economyTags: ['magic', 'trade', 'nobility'],
      cultureTags: ['high elf', 'human', 'political'],
      dangerLevel: 3,
      recommendedLevel: 3,
      visualTheme: 'cold white and blue towers',
      locations: [
        createStarterLocation('kriantar_veridal', 'crystal_gate', 'Кристальные врата', 'gate'),
        createStarterLocation('kriantar_veridal', 'council_hall', 'Зал совета', 'castle'),
        createStarterLocation('kriantar_veridal', 'mage_district', 'Квартал магов', 'guild'),
      ],
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'terimia_breinhold',
      name: 'Брейнхольд',
      kingdomId: 'terimia',
      status: 'active',
      shortDescription: 'Мрачная военная столица Теримии.',
      fullDescription: 'Брейнхольд известен военной дисциплиной, закрытыми школами и тёмными ритуалами.',
      populationTotal: 28000,
      racePopulation: [{ raceId: 'human', percent: 95, role: 'soldiers, citizens, adepts' }],
      rulerName: 'Маршал Брейнхольда',
      rulerTitle: 'marshal',
      governmentType: 'military rule',
      economyTags: ['military', 'forge', 'necromancy'],
      cultureTags: ['dark', 'discipline', 'necromancy'],
      dangerLevel: 8,
      recommendedLevel: 6,
      visualTheme: 'dark military necromancy capital',
      locations: [
        createStarterLocation('terimia_breinhold', 'black_barracks', 'Чёрные казармы', 'barracks'),
        createStarterLocation('terimia_breinhold', 'bone_temple', 'Костяной храм', 'temple'),
        createStarterLocation('terimia_breinhold', 'war_square', 'Площадь войны', 'district'),
      ],
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

function readRawCities(): City[] | null {
  const raw = window.localStorage.getItem(CITY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as City[] : null;
  } catch {
    return null;
  }
}

function writeCities(cities: City[]): void {
  window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(cities));
}

export const cityService = {
  async getCities(): Promise<City[]> {
    const existing = readRawCities();
    if (existing && existing.length > 0) return existing;

    const seeded = seedCities();
    writeCities(seeded);
    return seeded;
  },

  async getCityById(id: string): Promise<City | null> {
    const cities = await this.getCities();
    return cities.find((city) => city.id === id) ?? null;
  },

  async createCity(city: City): Promise<City> {
    const cities = await this.getCities();
    if (cities.some((entry) => entry.id === city.id)) {
      throw new Error(`City id already exists: ${city.id}`);
    }
    const next = { ...city, createdAt: city.createdAt || nowIso(), updatedAt: nowIso() };
    writeCities([...cities, next]);
    return next;
  },

  async updateCity(city: City): Promise<City> {
    const cities = await this.getCities();
    const next = { ...city, updatedAt: nowIso() };
    writeCities(cities.map((entry) => entry.id === city.id ? next : entry));
    return next;
  },

  async deleteCity(id: string): Promise<void> {
    const cities = await this.getCities();
    writeCities(cities.filter((city) => city.id !== id));
  },

  async duplicateCity(id: string): Promise<City> {
    const source = await this.getCityById(id);
    if (!source) throw new Error(`City not found: ${id}`);

    const cities = await this.getCities();
    const createdAt = nowIso();
    let copyId = `${source.id}_copy`;
    let index = 2;
    while (cities.some((city) => city.id === copyId)) {
      copyId = `${source.id}_copy_${index}`;
      index += 1;
    }

    const copy: City = {
      ...source,
      id: copyId,
      name: `${source.name} Copy`,
      locations: source.locations.map((location) => ({
        ...location,
        cityId: copyId,
        id: `${location.id}_copy`,
      })),
      createdAt,
      updatedAt: createdAt,
    };

    writeCities([...cities, copy]);
    return copy;
  },

  exportCities(): string {
    return JSON.stringify(readRawCities() ?? [], null, 2);
  },

  importCities(json: string): void {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Cities import must be an array.');
    writeCities(parsed as City[]);
  },
};

