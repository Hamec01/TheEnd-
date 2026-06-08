const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'apps', 'backend', 'data', 'theend_content.local.json');
const raw = fs.readFileSync(filePath, 'utf8');
const parsed = JSON.parse(raw);
const root = parsed && typeof parsed === 'object' && parsed.content && typeof parsed.content === 'object' ? parsed.content : parsed;

const profiles = [
  { id: 'smelting_metal', name: 'лавка металла', description: 'рофиль обложки для плавки и металлургии.', recipeTypes: ['smelting','material_processing'], materialFamilies: ['metal','alloy'], coverImageRef: '/art/crafting/recipes/recipe_smelting_metal.png', iconImageRef: '/art/crafting/recipes/recipe_smelting_metal.png', animationImageRef: '/art/crafting/recipes/recipe_smelting_metal.png', backgroundStyle: 'smelting', accentColor: '#b0682f', isEnabled: true },
  { id: 'material_wood', name: 'бработка дерева', description: 'рофиль для деревообработки.', recipeTypes: ['material_processing','carpentry_craft'], materialFamilies: ['wood'], coverImageRef: '/art/crafting/recipes/recipe_material_wood.png', iconImageRef: '/art/crafting/recipes/recipe_material_wood.png', animationImageRef: '/art/crafting/recipes/recipe_material_wood.png', backgroundStyle: 'processing', accentColor: '#7a5a2d', isEnabled: true },
  { id: 'material_cloth', name: 'бработка ткани', description: 'рофиль для ткацких и швейных рецептов.', recipeTypes: ['weaving','material_processing'], materialFamilies: ['cloth','leather'], coverImageRef: '/art/crafting/recipes/recipe_material_cloth.png', iconImageRef: '/art/crafting/recipes/recipe_material_cloth.png', animationImageRef: '/art/crafting/recipes/recipe_material_cloth.png', backgroundStyle: 'processing', accentColor: '#927552', isEnabled: true },
  { id: 'food_basic', name: 'азовая кулинария', description: 'рофиль для простых пищевых рецептов.', recipeTypes: ['cooking','baking'], materialFamilies: ['food'], coverImageRef: '/art/crafting/recipes/recipe_food_basic.png', iconImageRef: '/art/crafting/recipes/recipe_food_basic.png', animationImageRef: '/art/crafting/recipes/recipe_food_basic.png', backgroundStyle: 'cooking', accentColor: '#b37f42', isEnabled: true },
  { id: 'alchemy_basic', name: 'азовая алхимия', description: 'рофиль для алхимических рецептов.', recipeTypes: ['alchemy'], materialFamilies: ['alchemy'], coverImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png', iconImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png', animationImageRef: '/art/crafting/recipes/recipe_alchemy_basic.png', backgroundStyle: 'alchemy', accentColor: '#4f8d7a', isEnabled: true },
  { id: 'forging_weapon', name: 'овка оружия', description: 'рофиль для оружейных рецептов кузнеца.', recipeTypes: ['blacksmith_craft'], materialFamilies: ['metal'], coverImageRef: '/art/crafting/recipes/recipe_forging_weapon.png', iconImageRef: '/art/crafting/recipes/recipe_forging_weapon.png', animationImageRef: '/art/crafting/recipes/recipe_forging_weapon.png', backgroundStyle: 'forging', accentColor: '#b35a39', isEnabled: true },
  { id: 'forging_armor', name: 'овка доспеха', description: 'рофиль для бронных рецептов кузнеца.', recipeTypes: ['blacksmith_craft'], materialFamilies: ['metal'], coverImageRef: '/art/crafting/recipes/recipe_forging_armor.png', iconImageRef: '/art/crafting/recipes/recipe_forging_armor.png', animationImageRef: '/art/crafting/recipes/recipe_forging_armor.png', backgroundStyle: 'forging', accentColor: '#8f6c4d', isEnabled: true },
  { id: 'rare_alloy', name: 'едкие сплавы', description: 'рофиль для рецептов редких сплавов.', recipeTypes: ['smelting','blacksmith_craft'], materialFamilies: ['alloy','metal'], coverImageRef: '/art/crafting/recipes/recipe_rare_alloy.png', iconImageRef: '/art/crafting/recipes/recipe_rare_alloy.png', animationImageRef: '/art/crafting/recipes/recipe_rare_alloy.png', backgroundStyle: 'refinement', accentColor: '#8792a6', isEnabled: true },
  { id: 'rune_work', name: 'унная обработка', description: 'рофиль для рунических и зачаровательных работ.', recipeTypes: ['runecrafting','enchantment'], materialFamilies: ['rune','alchemy'], coverImageRef: '/art/crafting/recipes/recipe_rune_work.png', iconImageRef: '/art/crafting/recipes/recipe_rune_work.png', animationImageRef: '/art/crafting/recipes/recipe_rune_work.png', backgroundStyle: 'refinement', accentColor: '#7a62b5', isEnabled: true }
];

root.recipeVisualProfiles = profiles;

const byId = new Map(profiles.map((p) => [p.id, p]));
const styleByProfile = {
  smelting_metal: 'smelting',
  material_wood: 'processing',
  material_cloth: 'processing',
  food_basic: 'cooking',
  alchemy_basic: 'alchemy',
  forging_weapon: 'forging',
  forging_armor: 'forging',
  rare_alloy: 'refinement',
  rune_work: 'refinement',
};
const familyByProfile = {
  smelting_metal: 'metal',
  material_wood: 'wood',
  material_cloth: 'cloth',
  food_basic: 'food',
  alchemy_basic: 'alchemy',
  forging_weapon: 'metal',
  forging_armor: 'metal',
  rare_alloy: 'alloy',
  rune_work: 'rune',
};

function chooseProfile(recipe) {
  const type = String(recipe.recipeType || '').toLowerCase();
  const profession = String(recipe.professionId || '').toLowerCase();
  const name = String(recipe.name || '').toLowerCase();
  const outputs = [
    ...((recipe.outputItems || []).map((e) => String(e.itemId || '').toLowerCase())),
    ...((recipe.outputMaterials || []).map((e) => String(e.materialId || '').toLowerCase())),
  ].join(' ');
  if (type === 'cooking' || type === 'baking') return 'food_basic';
  if (type === 'alchemy') return 'alchemy_basic';
  if (type === 'runecrafting' || type === 'enchantment' || type === 'rune_identification') return 'rune_work';
  if (type === 'smelting') {
    if (name.includes('alloy') || outputs.includes('alloy')) return 'rare_alloy';
    return 'smelting_metal';
  }
  if (type === 'blacksmith_craft' || profession === 'blacksmithing') {
    if (name.includes('armor') || name.includes('досп') || outputs.includes('armor') || outputs.includes('helmet') || outputs.includes('shield') || outputs.includes('chest') ) {
      return 'forging_armor';
    }
    return 'forging_weapon';
  }
  if (profession === 'carpentry' || profession === 'carpenter') return 'material_wood';
  if (profession === 'leatherworking' || type === 'weaving' || type === 'tanning') return 'material_cloth';
  if (type === 'material_processing') {
    if (name.includes('wood') || outputs.includes('wood')) return 'material_wood';
    if (name.includes('cloth') || name.includes('leather') || outputs.includes('cloth') || outputs.includes('leather')) return 'material_cloth';
    return 'smelting_metal';
  }
  return 'smelting_metal';
}

const recipes = Array.isArray(root.craftingRecipes) ? root.craftingRecipes : [];
for (const recipe of recipes) {
  const profileId = chooseProfile(recipe);
  const profile = byId.get(profileId);
  recipe.visualProfileId = profileId;
  if (!recipe.visualImageRef || !String(recipe.visualImageRef).trim()) {
    recipe.visualImageRef = profile ? profile.coverImageRef : undefined;
  }
  if (!recipe.visualIconRef || !String(recipe.visualIconRef).trim()) {
    recipe.visualIconRef = profile ? profile.iconImageRef : undefined;
  }
  if (recipe.visualAnimationRef === undefined) {
    recipe.visualAnimationRef = profile ? profile.animationImageRef : null;
  }
  if (!recipe.visualMaterialFamily || !String(recipe.visualMaterialFamily).trim()) {
    recipe.visualMaterialFamily = familyByProfile[profileId] || 'generic';
  }
  if (!recipe.visualStyle || !String(recipe.visualStyle).trim()) {
    recipe.visualStyle = styleByProfile[profileId] || 'processing';
  }
}

if (parsed && typeof parsed === 'object' && parsed.content && typeof parsed.content === 'object') {
  parsed.content = root;
}

fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
console.log(`Updated recipeVisualProfiles=${profiles.length}, recipes=${recipes.length}`);
