/**
 * Скрипт для загрузки примеров данных живого мира (торговцы и бандиты)
 * 
 * Использование:
 * 1. Откройте админку в браузере (localhost:5173/admin/world-sim)
 * 2. Вкладка "Архетипы" → нажмите "Создать архетип"
 * 3. Или используйте этот скрипт для прямого импорта через API
 * 
 * curl -X POST http://localhost:3000/api/world-simulation/archetypes \
 *   -H "Content-Type: application/json" \
 *   -d @examples/merchant-1.json
 */

import merchantsData from './living-world-merchants.json';
import banditsData from './living-world-bandits.json';

async function loadLivingWorldExamples() {
  const baseUrl = 'http://localhost:3000/api/world-simulation';
  
  console.log('🏪 Loading merchant archetypes...');
  for (const archetype of merchantsData.archetypes) {
    try {
      const response = await fetch(`${baseUrl}/archetypes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archetype),
      });
      if (response.ok) {
        console.log(`✓ Created archetype: ${archetype.name}`);
      } else {
        console.error(`✗ Failed to create archetype: ${archetype.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating archetype: ${archetype.id}`, err);
    }
  }

  console.log('🛣️  Loading merchant routes...');
  for (const route of merchantsData.routes) {
    try {
      const response = await fetch(`${baseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });
      if (response.ok) {
        console.log(`✓ Created route: ${route.name}`);
      } else {
        console.error(`✗ Failed to create route: ${route.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating route: ${route.id}`, err);
    }
  }

  console.log('🎲 Loading merchant spawn rules...');
  for (const rule of merchantsData.spawnRules) {
    try {
      const response = await fetch(`${baseUrl}/spawn-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (response.ok) {
        console.log(`✓ Created spawn rule: ${rule.name}`);
      } else {
        console.error(`✗ Failed to create spawn rule: ${rule.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating spawn rule: ${rule.id}`, err);
    }
  }

  console.log('🏴 Loading bandit archetypes...');
  for (const archetype of banditsData.archetypes) {
    try {
      const response = await fetch(`${baseUrl}/archetypes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archetype),
      });
      if (response.ok) {
        console.log(`✓ Created archetype: ${archetype.name}`);
      } else {
        console.error(`✗ Failed to create archetype: ${archetype.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating archetype: ${archetype.id}`, err);
    }
  }

  console.log('🛣️  Loading bandit routes...');
  for (const route of banditsData.routes) {
    try {
      const response = await fetch(`${baseUrl}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });
      if (response.ok) {
        console.log(`✓ Created route: ${route.name}`);
      } else {
        console.error(`✗ Failed to create route: ${route.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating route: ${route.id}`, err);
    }
  }

  console.log('🎲 Loading bandit spawn rules...');
  for (const rule of banditsData.spawnRules) {
    try {
      const response = await fetch(`${baseUrl}/spawn-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (response.ok) {
        console.log(`✓ Created spawn rule: ${rule.name}`);
      } else {
        console.error(`✗ Failed to create spawn rule: ${rule.id}`);
      }
    } catch (err) {
      console.error(`✗ Error creating spawn rule: ${rule.id}`, err);
    }
  }

  console.log('✅ All examples loaded!');
  console.log('\n📊 Current state:');
  
  try {
    const snapshot = await fetch(`${baseUrl}/snapshot`).then(r => r.json());
    console.log(`- Active entities: ${snapshot.activeEntities.length}`);
    console.log(`- City markets: ${snapshot.cityMarkets.length}`);
    console.log(`- Recent events: ${snapshot.events.length}`);
  } catch (err) {
    console.error('Error fetching snapshot:', err);
  }
}

// Call it when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadLivingWorldExamples);
} else {
  loadLivingWorldExamples();
}
