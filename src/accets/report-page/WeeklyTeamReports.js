import React, { useState } from "react";
import { backendURLBackend } from "../../services/constants";

const reports = [
  { type: "low-grade", label: "Скачать список с низким рейтингом" },
  { type: "missed-meetings", label: "Скачать список с пропущенными встречами" },
];

export default function WeeklyTeamReports() {
  const [period, setPeriod] = useState("CURRENT");
  const [loadingReport, setLoadingReport] = useState(null);
  const [notice, setNotice] = useState(null);

  async function downloadReport(type) {
    setLoadingReport(type);
    setNotice(null);

    try {
      const response = await fetch(
        `${backendURLBackend}/api/v1/admin/reports/${type}?${new URLSearchParams({ period })}`,
        { credentials: "include", headers: { Accept: "text/csv, application/problem+json" } }
      );

      if (response.status === 204) {
        setNotice({ text: "За выбранную неделю список пуст." });
        return;
      }
      if (response.status === 404 && period === "PREVIOUS") {
        setNotice({ text: "Отчёт за прошлую неделю ещё не сохранён." });
        return;
      }
      if (!response.ok || !response.headers.get("Content-Type")?.toLowerCase().startsWith("text/csv")) {
        setNotice({ error: true, text: "Не удалось скачать отчёт. Попробуйте ещё раз." });
        return;
      }

      const file = await response.blob();
      if (file.size === 0) {
        setNotice({ text: "За выбранную неделю список пуст." });
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-${period.toLowerCase()}.csv`;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setNotice({ error: true, text: "Не удалось скачать отчёт. Попробуйте ещё раз." });
    } finally {
      setLoadingReport(null);
    }
  }

  return (
    <section className="weekly-team-reports" aria-label="Еженедельные отчёты по командам">
      <div className="weekly-team-reports__controls">
        <label className="weekly-team-reports__period">
          Период
          <select value={period} disabled={Boolean(loadingReport)} onChange={(event) => {
            setPeriod(event.target.value);
            setNotice(null);
          }}>
            <option value="CURRENT">Текущая неделя</option>
            <option value="PREVIOUS">Прошлая неделя</option>
          </select>
        </label>
        {reports.map(({ type, label }) => (
          <button key={type} type="button" className="report-btn"
            disabled={Boolean(loadingReport)} onClick={() => { void downloadReport(type); }}>
            {label}
          </button>
        ))}
      </div>
      {loadingReport && <output className="weekly-team-reports__notice">Формируем отчёт…</output>}
      {notice?.error && <p className="weekly-team-reports__notice weekly-team-reports__error" role="alert">{notice.text}</p>}
      {notice && !notice.error && <output className="weekly-team-reports__notice">{notice.text}</output>}
    </section>
  );
}
