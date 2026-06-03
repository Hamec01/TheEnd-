import type { PlayerProfessionState } from '@theend/rpg-domain';

interface BlacksmithStatsTabProps {
  professionState: PlayerProfessionState;
}

export function BlacksmithStatsTab({ professionState }: BlacksmithStatsTabProps) {
  const stats = professionState.stats ?? {};
  const totalCrafts = Math.max(0, Math.round(Number(stats.blacksmithTotalCrafts ?? 0)));
  const successfulCrafts = Math.max(0, Math.round(Number(stats.blacksmithSuccessfulCrafts ?? 0)));
  const failedCrafts = Math.max(0, Math.round(Number(stats.blacksmithFailedCrafts ?? 0)));
  const bestScore = Math.max(0, Math.round(Number(stats.blacksmithBestScore ?? 0)));
  const avgQuality = Math.max(0, Math.round(Number(stats.blacksmithAverageQuality ?? 0)));
  const qualityCrafts = Math.max(0, Math.round(Number(stats.blacksmithQualityCrafts ?? 0)));

  const successRate = totalCrafts > 0
    ? Math.round((successfulCrafts / totalCrafts) * 100)
    : 0;

  return (
    <div className="profession-overview-grid">
      <div className="profession-overview-item"><span>Всего ковок</span><strong>{totalCrafts}</strong></div>
      <div className="profession-overview-item"><span>Успешных ковок</span><strong>{successfulCrafts}</strong></div>
      <div className="profession-overview-item"><span>Провалов</span><strong>{failedCrafts}</strong></div>
      <div className="profession-overview-item"><span>Успех</span><strong>{successRate}%</strong></div>
      <div className="profession-overview-item"><span>Лучший результат</span><strong>{bestScore}</strong></div>
      <div className="profession-overview-item"><span>Среднее качество</span><strong>{avgQuality}</strong></div>
      <div className="profession-overview-item"><span>Качественных изделий</span><strong>{qualityCrafts}</strong></div>
    </div>
  );
}
