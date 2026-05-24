import { useEffect, useState } from 'react';
import type { StoredImage } from '../../services/content/models';
import { imageService } from '../../services/content/imageService';
import { buildUploadFolder } from '../../services/content/uploadFolders';
import { AdminHelpTooltip } from '../help/AdminHelpTooltip';
import { AdminFieldLabel, translateAdminErrorMessage } from '../adminUi';

export function ImagesPage() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resizeTo, setResizeTo] = useState(256);
  const [status, setStatus] = useState('Готово');

  async function refresh() {
    const all = await imageService.getAll();
    setImages(all);
    if (selectedId && !all.some((image) => image.id === selectedId)) {
      setSelectedId(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const stored = await imageService.upload(file, {
        name: file.name,
        folder: buildUploadFolder('images', 'library'),
      });
      setStatus(`Изображение загружено: ${stored.name}`);
      setSelectedId(stored.id);
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function resizeSelected() {
    if (!selectedId) {
      return;
    }

    try {
      const resized = await imageService.resize(selectedId, resizeTo, resizeTo);
      setStatus(`Создана копия ${resized.name} размером ${resizeTo}x${resizeTo}`);
      setSelectedId(resized.id);
      await refresh();
    } catch (error) {
      setStatus(translateAdminErrorMessage((error as Error).message));
    }
  }

  async function deleteSelected() {
    if (!selectedId) {
      return;
    }

    await imageService.delete(selectedId);
    setStatus(`Изображение удалено: ${selectedId}`);
    setSelectedId(null);
    await refresh();
  }

  const selected = images.find((image) => image.id === selectedId) ?? null;

  return (
    <div className="images-admin-layout">
      <section className="admin-list-panel">
        <div className="admin-list-tools">
          <label className="card">
            <AdminFieldLabel label="Загрузить изображение" hint="Картинка попадёт в общую библиотеку изображений и потом будет доступна в предметах, навыках, локациях и других сущностях." />
            <AdminHelpTooltip section="images" field="upload" />
            <input type="file" accept="image/*" onChange={upload} />
          </label>
        </div>

        <div className="admin-image-browser">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className={`admin-image-card ${selectedId === image.id ? 'is-active' : ''}`}
              onClick={() => setSelectedId(image.id)}
            >
              <div className="admin-image-thumb">
                <img src={image.dataUrl} alt={image.name} />
              </div>
              <strong>{image.name || image.id}</strong>
              <small>{image.id}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-form-panel admin-image-preview-panel">
        <h3>Предпросмотр</h3>
        {selected ? (
          <>
            <img className="admin-image-preview" src={selected.dataUrl} alt={selected.name} />
            <p><strong>{selected.name || selected.id}</strong></p>
            <p className="muted" title="Технический идентификатор изображения. Его можно использовать в полях imageId и icon.">
              ID изображения: {selected.id} <AdminHelpTooltip section="images" field="id" />
            </p>
            <p className="muted">Размер: {selected.width}x{selected.height}</p>
          </>
        ) : (
          <p className="muted">Выберите изображение слева.</p>
        )}

        <div className="admin-actions-row">
          <label>
            <AdminFieldLabel label="Размер квадратной копии" hint="Создаёт новую квадратную копию выбранной картинки." />
            <AdminHelpTooltip section="images" field="resize" />
            <input type="number" min={32} max={1024} value={resizeTo} onChange={(event) => setResizeTo(Number(event.target.value) || 256)} />
          </label>
          <button disabled={!selectedId} onClick={() => { void resizeSelected(); }}>Изменить размер и сохранить копию</button>
          <button disabled={!selectedId} onClick={() => { void deleteSelected(); }}>Удалить</button>
        </div>

        <p className="muted">{status}</p>
      </section>
    </div>
  );
}
