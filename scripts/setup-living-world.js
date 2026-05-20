#!/usr/bin/env node

/**
 * LIVING WORLD SYSTEM - SETUP & TEST SCRIPT
 * 
 * Этот скрипт поможет вам:
 * 1. Проверить что всё установлено
 * 2. Создать примеры данных
 * 3. Протестировать систему
 * 4. Вывести информацию для отладки
 */

const fs = require('fs');
const path = require('path');

console.log(`
╔════════════════════════════════════════════════════════════╗
║     🌍 LIVING WORLD SYSTEM - SETUP VERIFICATION 🌍       ║
╚════════════════════════════════════════════════════════════╝
`);

// Проверка файлов
console.log('\n📋 Checking required files...\n');

const requiredFiles = [
  'apps/backend/src/worldsim/world-simulation.service.ts',
  'apps/backend/src/worldsim/world-simulation.controller.ts',
  'apps/backend/src/worldsim/world-simulation.module.ts',
  'apps/backend/src/worldsim/types/world-simulation.types.ts',
  'apps/frontend/src/services/useWorldSimulation.ts',
  'apps/frontend/src/worldmap/components/ActiveWorldEntitiesLayer.tsx',
  'apps/frontend/src/admin/pages/WorldSimulationAdmin.tsx',
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, '../../', file);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
}

// Проверка интеграции
console.log('\n🔗 Checking integrations...\n');

const appModulePath = path.join(__dirname, '../../apps/backend/src/app.module.ts');
const appModuleContent = fs.readFileSync(appModulePath, 'utf-8');
const hasWorldSimModule = appModuleContent.includes('WorldSimulationModule');
console.log(`${hasWorldSimModule ? '✓' : '✗'} Backend app.module.ts has WorldSimulationModule`);

const adminAppPath = path.join(__dirname, '../../apps/frontend/src/admin/AdminApp.tsx');
const adminAppContent = fs.readFileSync(adminAppPath, 'utf-8');
const hasWorldSimAdmin = adminAppContent.includes('WorldSimulationAdmin');
console.log(`${hasWorldSimAdmin ? '✓' : '✗'} Frontend AdminApp.tsx has WorldSimulationAdmin`);

const worldMapPath = path.join(__dirname, '../../apps/frontend/src/worldmap/WorldMapScreen.tsx');
const worldMapContent = fs.readFileSync(worldMapPath, 'utf-8');
const hasActiveLayer = worldMapContent.includes('ActiveWorldEntitiesLayer');
console.log(`${hasActiveLayer ? '✓' : '✗'} Frontend WorldMapScreen.tsx has ActiveWorldEntitiesLayer`);

// Проверка примеров
console.log('\n📚 Checking example data files...\n');

const exampleFiles = [
  'docs/examples/living-world-merchants.json',
  'docs/examples/living-world-bandits.json',
  'docs/LIVING_WORLD_TUTORIAL.md',
  'docs/LIVING_WORLD_INTEGRATION.md',
  'docs/LIVING_WORLD_QUICK_START.md',
];

for (const file of exampleFiles) {
  const fullPath = path.join(__dirname, '../../', file);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
}

// Final status
console.log(`
╔════════════════════════════════════════════════════════════╗
║                    🎮 NEXT STEPS 🎮                        ║
╚════════════════════════════════════════════════════════════╝
`);

if (allFilesExist && hasWorldSimModule && hasWorldSimAdmin && hasActiveLayer) {
  console.log(`
✅ ALL SYSTEMS GO!

1. Start development:
   $ cd apps/backend && npm run dev    # Terminal 1
   $ cd apps/frontend && npm run dev   # Terminal 2

2. Open admin panel:
   http://localhost:5173/admin/world-sim

3. Create first merchant:
   - Tab: "Архетипы"
   - Button: "➕ Создать архетип"
   - Fill form and save

4. Create merchant route:
   - Tab: "Маршруты"
   - Button: "➕ Создать маршрут"
   - Define cities and timing

5. Enable spawning:
   - Tab: "Правила спавна"
   - Button: "➕ Создать правило спавна"
   - Set time interval and probability

6. Monitor action:
   - Tab: "Монитор"
   - Watch active entities on the map

📖 Full documentation:
   - docs/LIVING_WORLD_QUICK_START.md (5-minute start)
   - docs/LIVING_WORLD_TUTORIAL.md (complete guide in Russian)
   - docs/examples/living-world-merchants.json (merchant examples)
   - docs/examples/living-world-bandits.json (bandit examples)
`);
} else {
  console.log(`
⚠️  SOMETHING IS MISSING!

Please ensure:
- All files listed above exist
- Backend module is registered in app.module.ts
- Frontend admin component is imported
- Active layer is added to WorldMapScreen
- Run: npm install && npm run build
`);
}

console.log(`
📞 Support:
   - Check browser console (F12) for logs
   - Check backend console for simulation updates
   - Use admin panel "Монитор" tab to inspect entities

🔬 Testing API directly:
   # Get snapshot
   curl http://localhost:3000/api/world-simulation/snapshot

   # List archetypes
   curl http://localhost:3000/api/world-simulation/archetypes

   # List routes
   curl http://localhost:3000/api/world-simulation/routes

   # List spawn rules
   curl http://localhost:3000/api/world-simulation/spawn-rules

   # List active entities
   curl http://localhost:3000/api/world-simulation/active-entities
`);

process.exit(0);
