import { useState } from 'react';
import { translateAdminErrorMessage } from '../adminUi';
import { seedDefaultContentIfEmpty } from '../../services/content/seedService';

export function DashboardPage() {
  const [status, setStatus] = useState('Готово');

  async function handleSeed() {
    try {
      const result = await seedDefaultContentIfEmpty();
      setStatus(translateAdminErrorMessage(result.message));
    } catch (error) {
      setStatus(`Ошибка импорта: ${translateAdminErrorMessage((error as Error).message)}`);
    }
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
    </div>
  );
}
