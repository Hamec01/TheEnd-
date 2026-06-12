import type { City, CityLocation } from '../types/city';
import { createContentEntry, deleteContentEntry, getContentCollection, updateContentEntry } from './content/contentApi';

const LEGACY_ARKLEIN_IDS = new Set(['argos_arklein', 'arklein', 'arclein', 'arkea', 'аркея', 'аркейн', 'арклейн']);

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
    workshopIds: [],
    services: [],
    isVisible: true,
    isUnlocked: true,
    markerIcon: type,
  };
}

function seedCities(): City[] {
  const createdAt = nowIso();
  const arkleinId = 'city_arklein';

  return [
    {
      id: arkleinId,
      slug: 'arklein',
      name: 'Арклейн',
      kingdomId: 'argos',
      regionId: 'teramor',
      worldZoneId: arkleinId,
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
        createStarterLocation(arkleinId, 'gate_main', 'Главные ворота', 'gate'),
        createStarterLocation(arkleinId, 'market_square', 'Рыночная площадь', 'market'),
        createStarterLocation(arkleinId, 'blacksmith_old', 'Старая кузница', 'blacksmith'),
        createStarterLocation(arkleinId, 'tavern_wolf', 'Таверна Волчий Дым', 'tavern'),
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

function normalizeCityId(id: string): string {
  const normalized = id.trim().toLowerCase().replace(/ё/g, 'е');
  return LEGACY_ARKLEIN_IDS.has(normalized) ? 'city_arklein' : id.trim();
}

function normalizeCity(city: City): City {
  const id = normalizeCityId(city.id);
  const worldZoneId = city.worldZoneId && LEGACY_ARKLEIN_IDS.has(city.worldZoneId.trim().toLowerCase().replace(/ё/g, 'е'))
    ? 'city_arklein'
    : city.worldZoneId === 'zone_argos_arklein'
      ? 'city_arklein'
      : city.worldZoneId;

  return {
    ...city,
    id,
    slug: city.slug || (id === 'city_arklein' ? 'arklein' : undefined),
    worldZoneId,
    backgroundImageUrl: city.backgroundImageUrl?.trim() || undefined,
    locations: city.locations.map((location) => ({
      ...location,
      cityId: id,
      workshopIds: Array.isArray(location.workshopIds)
        ? location.workshopIds.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      services: Array.isArray(location.services)
        ? location.services.map((entry) => String(entry).trim()).filter(Boolean)
        : [],
      linkedBattleMapId: location.linkedBattleMapId?.trim() || undefined,
    })),
  };
}

async function hydrateBackendCities(): Promise<City[]> {
  const existing = (await getContentCollection<City>('cities')).map(normalizeCity);
  if (existing.length > 0) {
    return existing;
  }

  const initialCities = seedCities().map(normalizeCity);
  const persisted: City[] = [];
  for (const city of initialCities) {
    persisted.push(await createContentEntry<City>('cities', city));
  }
  return persisted.map(normalizeCity);
}

export const cityService = {
  async getCities(): Promise<City[]> {
    return hydrateBackendCities();
  },

  async getCityById(id: string): Promise<City | null> {
    const cities = await this.getCities();
    const normalizedId = normalizeCityId(id);
    return cities.find((city) => city.id === normalizedId) ?? null;
  },

  async createCity(city: City): Promise<City> {
    const cities = await this.getCities();
    const normalized = normalizeCity(city);
    if (cities.some((entry) => entry.id === normalized.id)) {
      throw new Error(`City id already exists: ${normalized.id}`);
    }
    return createContentEntry<City>('cities', {
      ...normalized,
      createdAt: normalized.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
  },

  async updateCity(city: City): Promise<City> {
    const normalized = normalizeCity(city);
    return updateContentEntry<City>('cities', normalized.id, {
      ...normalized,
      updatedAt: nowIso(),
    });
  },

  async deleteCity(id: string): Promise<void> {
    await deleteContentEntry('cities', normalizeCityId(id));
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
      slug: `${source.slug ?? source.id}-copy`,
      locations: source.locations.map((location) => ({
        ...location,
        cityId: copyId,
        id: `${location.id}_copy`,
      })),
      createdAt,
      updatedAt: createdAt,
    };

    return createContentEntry<City>('cities', copy);
  },

  async exportCities(): Promise<string> {
    return JSON.stringify(await this.getCities(), null, 2);
  },

  async importCities(
    json: string,
    mode: 'upsert' | 'addOnly' = 'upsert',
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('Cities import must be an array.');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of parsed as City[]) {
      const normalized = normalizeCity(entry);
      const existing = await this.getCityById(normalized.id);
      if (existing) {
        if (mode === 'addOnly') {
          skipped += 1;
          continue;
        }
        await updateContentEntry<City>('cities', normalized.id, normalized);
        updated += 1;
      } else {
        await createContentEntry<City>('cities', normalized);
        created += 1;
      }
    }

    return { created, updated, skipped };
  },
};

