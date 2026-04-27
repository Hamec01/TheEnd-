import { useState } from 'react';
import { BattleMapEditor } from '../../components/BattleMapEditor';

export function BattleMapsPage() {
  const [status, setStatus] = useState('Выберите или создайте tactical map.');

  return (
    <div className="admin-editor-page">
      <BattleMapEditor onStatusMessage={setStatus} />
      <div className="admin-editor-status">{status}</div>
    </div>
  );
}
