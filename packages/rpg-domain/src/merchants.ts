import { getItemById, type ItemDefinition } from './items';

export type MerchantType = 'weaponsmith' | 'armorer' | 'supplier';

export interface Merchant {
  id: string;
  name: string;
  merchantType: MerchantType;
  kingdomId?: string;
  itemIds: string[];
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'merchant_weaponsmith',
    name: 'Гаррик Оружейник',
    merchantType: 'weaponsmith',
    kingdomId: 'argos',
    itemIds: [
      'iron_sword',
      'raider_axe',
      'hunter_bow',
      'initiate_staff',
      'ash_longbow',
      'steel_spear',
      'war_hammer',
      'twin_daggers',
      'knight_blade',
      'bonebreaker_maul',
      'ranger_shortbow',
      'battlemage_rod',
    ],
  },
  {
    id: 'merchant_armorer',
    name: 'Бруна Бронник',
    merchantType: 'armorer',
    kingdomId: 'argos',
    itemIds: [
      'leather_helmet',
      'plated_helm',
      'chain_armor',
      'brigandine_armor',
      'traveler_boots',
      'scout_boots',
      'iron_gloves',
      'duelist_gloves',
      'tower_shield',
      'kite_shield',
    ],
  },
  {
    id: 'merchant_supplier',
    name: 'Селла Припасы',
    merchantType: 'supplier',
    kingdomId: 'argos',
    itemIds: ['potion_hp_small', 'potion_mp_small', 'tonic_focus', 'tonic_ironhide', 'potion_stamina_large'],
  },
];

export function getMerchantById(merchantId: string): Merchant {
  const merchant = MERCHANTS.find((item) => item.id === merchantId);
  if (!merchant) {
    throw new Error(`Unknown merchant id: ${merchantId}`);
  }
  return merchant;
}

export function getMerchantItems(merchantId: string): ItemDefinition[] {
  return getMerchantById(merchantId).itemIds.map((itemId) => getItemById(itemId));
}
