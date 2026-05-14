import { useState } from 'react';
import { translateAdminErrorMessage } from '../adminUi';
import { seedDefaultContentIfEmpty } from '../../services/content/seedService';
import {
  DEFAULT_WORLD_MAP_RUNTIME_SETTINGS,
  clearWorldMapRuntimeSettings,
  loadWorldMapRuntimeSettings,
  saveWorldMapRuntimeSettings,
} from '../../worldmap/worldMapRuntimeSettings';

export function DashboardPage() {
  const [status, setStatus] = useState('Готово');
  const initialMapSettings = loadWorldMapRuntimeSettings();
  const [playZoom, setPlayZoom] = useState(String(initialMapSettings.playZoom));
  const [playerSpeed, setPlayerSpeed] = useState(String(initialMapSettings.playerSpeed));
  const [mapSettingsStatus, setMapSettingsStatus] = useState('Не сохранено');

  async function handleSeed() {
    try {
      const result = await seedDefaultContentIfEmpty();
      setStatus(translateAdminErrorMessage(result.message));
    } catch (error) {
      setStatus(`Ошибка импорта: ${translateAdminErrorMessage((error as Error).message)}`);
    }
  }

  function handleSaveMapSettings() {
    const zoom = Number(playZoom);
    const speed = Number(playerSpeed);
    if (!Number.isFinite(zoom) || !Number.isFinite(speed)) {
      setMapSettingsStatus('Ошибка: zoom и speed должны быть числами.');
      return;
    }

    const saved = saveWorldMapRuntimeSettings({
      playZoom: zoom,
      playerSpeed: speed,
    });

    setPlayZoom(String(saved.playZoom));
    setPlayerSpeed(String(saved.playerSpeed));
    setMapSettingsStatus('Сохранено. Применится при следующем входе на карту.');
  }

  function handleResetMapSettings() {
    clearWorldMapRuntimeSettings();
    setPlayZoom(String(DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playZoom));
    setPlayerSpeed(String(DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playerSpeed));
    setMapSettingsStatus('Сброшено к значениям по умолчанию.');
  }

  return (
    <div className="admin-page-grid">
      <section>
        <h3>Управление контентом</h3>
        <p>Здесь можно управлять предметами, торговцами, материалами, таблицами добычи и изображениями прямо из браузера.</p>
      </section>
      <section>
        <button onClick={handleSeed}>Импортировать базовый контент</button>
        <p className="muted">Загрузит текущие захардкоженные предметы и торговцев, если база контента ещё пустая.</p>
      </section>
      <section>
        <strong>Статус:</strong> {status}
      </section>
      <section>
        <h3>Настройки карты мира</h3>
        <p className="muted">Управление приближением и скоростью игрока в режиме карты (play).</p>
        <div className="admin-page-grid admin-map-settings-grid">
          <label>
            Приближение карты (zoom)
            <input
              type="number"
              step="0.1"
              min="1"
              max="20"
              value={playZoom}
              onChange={(event) => setPlayZoom(event.target.value)}
            />
          </label>
          <label>
            Скорость игрока
            <input
              type="number"
              step="0.00001"
              min="0.00005"
              max="0.002"
              value={playerSpeed}
              onChange={(event) => setPlayerSpeed(event.target.value)}
            />
          </label>
          <div className="admin-map-settings-actions">
            <button type="button" onClick={handleSaveMapSettings}>Сохранить настройки карты</button>
            <button type="button" onClick={handleResetMapSettings}>Сбросить по умолчанию</button>
          </div>
          <p className="muted">Статус карты: {mapSettingsStatus}</p>
        </div>
      </section>
    </div>
  );
}
