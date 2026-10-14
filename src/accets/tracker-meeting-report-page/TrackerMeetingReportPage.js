import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../meeting-report-page/MeetingReportPage.css";

import IconOpen from "../meeting-report-page/icon-open.png";
import IconClose from "../meeting-report-page/icon-close.png";
import {
  fetchMyTrackerMeetingReport,
  fetchMyTrackerMeetingReportExcel,
  fetchTeams,
} from "../../services/requests";
import { useGetUserInfo } from "../../services/util";
import { initialMeetingReportSort, nextMeetingReportSort } from "../../services/meetingReportSort";
import { passiveTeamsLast } from "../../services/passiveTeamsLast";
import Header from "../header/header";

const COMBINED_STATUS_OPTIONS = {
  OK: { label: "Всё ок", isTeamStatus: true },
  WITH_ISSUES: { label: "Есть проблемы", isTeamStatus: true },
  MANY_ISSUES: { label: "Есть большие проблемы", isTeamStatus: true },
  SCHEDULED: { label: "Запланирована", isTeamStatus: false },
  COMPLETED_AS_NOT_HAPPENED: { label: "Не состоялась", isTeamStatus: false },
};

const isStreamActive = (stream, today = new Date().toISOString().slice(0, 10)) =>
  stream.startDate <= today && stream.endDate >= today;

const sortStreams = (streams) => [...streams].sort((left, right) => {
  const activityDifference = Number(isStreamActive(right)) - Number(isStreamActive(left));
  if (activityDifference) return activityDifference;
  const endDateDifference = (right.endDate || "").localeCompare(left.endDate || "");
  return endDateDifference || left.name.localeCompare(right.name, "ru", { numeric: true });
});

function getStatusInfo(item) {
  if (item.status === "SCHEDULED") {
    const teamStatusLabel = item.teamStatus
      ? COMBINED_STATUS_OPTIONS[item.teamStatus]?.label
      : null;

    return {
      text: teamStatusLabel ? `Запланирована (${teamStatusLabel})` : "Запланирована",
      className: "mrep-status-lavender",
    };
  }

  if (item.status === "COMPLETED_AS_NOT_HAPPENED") {
    return { text: "Не состоялась", className: "" };
  }

  const statusClassByTeamStatus = {
    OK: "mrep-status-green",
    WITH_ISSUES: "mrep-status-yellow",
    MANY_ISSUES: "mrep-status-red",
  };

  return {
    text: COMBINED_STATUS_OPTIONS[item.teamStatus]?.label || "—",
    className: statusClassByTeamStatus[item.teamStatus] || "",
  };
}

export default function TrackerMeetingReportPage() {
  const navigate = useNavigate();
  const user = useGetUserInfo();
  const userRole = user?.roles?.[0] || "";

  const [reports, setReports] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [streams, setStreams] = useState([]);
  const [teamStreams, setTeamStreams] = useState(new Map());
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [streamsError, setStreamsError] = useState(false);
  const [includeInactiveStreams, setIncludeInactiveStreams] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenu, setOpenMenu] = useState({ stream: false, team: false, status: false });
  const [filters, setFilters] = useState({ stream: null, team: null, status: null });
  const [sortConfig, setSortConfig] = useState(initialMeetingReportSort);

  const apiFilters = useMemo(() => {
    const result = [];

    if (filters.team) {
      result.push({ fieldName: "teamName", type: "EQ", value: filters.team });
    }

    if (filters.status) {
      const config = COMBINED_STATUS_OPTIONS[filters.status];
      if (config.isTeamStatus) {
        result.push(
          { fieldName: "teamStatus", type: "EQ", value: filters.status },
          { fieldName: "status", type: "EQ", value: "COMPLETED" }
        );
      } else {
        result.push({ fieldName: "status", type: "EQ", value: filters.status });
      }
    }

    return result;
  }, [filters]);

  const effectiveSortParams = useMemo(() => [
    `teamName,${sortConfig.teamNameDir}`,
    `${sortConfig.secondary.field},${sortConfig.secondary.direction}`,
  ], [sortConfig]);

  const visibleReports = useMemo(() => reports.filter((report) => {
    const assignedStreamIds = teamStreams.get(String(report.teamId));
    if (!assignedStreamIds) return !filters.stream;
    if (filters.stream && !assignedStreamIds.has(String(filters.stream.id))) return false;
    if (includeInactiveStreams) return true;
    return streams.some((stream) => assignedStreamIds.has(String(stream.id)) && isStreamActive(stream));
  }), [reports, teamStreams, filters.stream, includeInactiveStreams, streams]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchMyTrackerMeetingReport({
        filters: apiFilters,
        streamId: filters.stream?.id,
        includeInactiveStreams,
        page: 0,
        size: 10000,
        sort: effectiveSortParams,
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content || [];
      setReports(passiveTeamsLast(content));
      setAvailableTeams((previousTeams) => [...new Map([
        ...previousTeams,
        ...content.filter((item) => item.teamId && item.teamName).map((item) => ({
          id: String(item.teamId),
          name: item.teamName,
        })),
      ].map((team) => [team.id, team])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "ru", { numeric: true })));
    } catch (requestError) {
      console.error(requestError);
      setError("Не удалось загрузить отчёт. Попробуйте обновить страницу.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [apiFilters, effectiveSortParams, filters.stream, includeInactiveStreams]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    let cancelled = false;
    const loadStreams = async () => {
      try {
        const firstResponse = await fetchTeams({ page: 0, size: 1000, filters: [] });
        if (!firstResponse.ok) throw new Error(`Ошибка HTTP: ${firstResponse.status}`);
        const firstPage = await firstResponse.json();
        const remainingPages = Array.from(
          { length: Math.max(0, (firstPage.page?.totalPages || 1) - 1) },
          (_, index) => index + 1
        );
        const pages = await Promise.all(remainingPages.map(async (page) => {
          const response = await fetchTeams({ page, size: 1000, filters: [] });
          if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
          return response.json();
        }));
        if (cancelled) return;
        const cards = [firstPage, ...pages].flatMap((page) => page.content || []);
        const allStreams = cards.flatMap((card) => card.streams || []);
        setStreams(sortStreams([...new Map(allStreams.map((stream) => [String(stream.id), stream])).values()]));
        setTeamStreams(new Map(cards.map((card) => [
          String(card.id),
          new Set((card.streams || []).map((stream) => String(stream.id))),
        ])));
      } catch (requestError) {
        console.error(requestError);
        if (!cancelled) setStreamsError(true);
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    };
    void loadStreams();
    return () => { cancelled = true; };
  }, []);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "stream" ? { team: null } : {}),
    }));
    if (key === "stream") setAvailableTeams([]);
    setOpenMenu({ stream: false, team: false, status: false });
  };

  const toggleMenu = (key) => {
    setOpenMenu((previous) => ({
      stream: false,
      team: false,
      status: false,
      [key]: !previous[key],
    }));
  };

  const requestSort = (field) => {
    setSortConfig((previous) => nextMeetingReportSort(previous, field));
  };

  const handleExportExcel = async () => {
    try {
      const response = await fetchMyTrackerMeetingReportExcel({
        filters: apiFilters,
        streamId: filters.stream?.id,
        includeInactiveStreams,
        sort: effectiveSortParams,
      });

      if (!response.ok) {
        throw new Error(`Ошибка HTTP: ${response.status}`);
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "отчёт-трекера-по-встречам.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      console.error(requestError);
      setError("Не удалось выгрузить отчёт. Попробуйте ещё раз.");
    }
  };

  const renderTableContent = () => {
    if (loading || teamsLoading) {
      return <tr><td colSpan="6">Загрузка...</td></tr>;
    }

    if (streamsError) {
      return <tr><td colSpan="6">Не удалось загрузить потоки команд. Попробуйте обновить страницу.</td></tr>;
    }

    if (error) {
      return <tr><td colSpan="6">{error}</td></tr>;
    }

    if (visibleReports.length === 0) {
      return <tr><td colSpan="6">Нет данных</td></tr>;
    }

    return visibleReports.map((item, index) => {
      const isFirstInGroup = index === 0 || visibleReports[index - 1].teamName !== item.teamName;
      const isLastInGroup = index === visibleReports.length - 1 || visibleReports[index + 1].teamName !== item.teamName;
      const isNotHappened = item.status === "COMPLETED_AS_NOT_HAPPENED";
      const { text: statusText, className: statusClassName } = getStatusInfo(item);
      const showTasks = item.status === "COMPLETED";
      const rowClassName = [
        isNotHappened ? "mrep-row-not-happened" : "",
        isFirstInGroup ? "mrep-group-start" : "",
        isLastInGroup ? "mrep-group-end" : "",
      ].filter(Boolean).join(" ");

      return (
        <tr key={`${item.teamId}-${item.startDate}`} className={rowClassName}>
          <td className="mrep-cell-left">{index + 1}</td>
          <td
            style={{ cursor: "pointer", color: "#843AEB", textDecoration: "underline" }}
            onClick={() => navigate(`/teamcard/${item.teamId}`)}
          >
            {item.teamName}{item.passive ? " (отчислена)" : ""}
          </td>
          <td>{item.startDate ? new Date(item.startDate).toLocaleDateString("ru-RU") : "—"}</td>
          <td className="mrep-text-wrap">{showTasks ? item.tasksNextMeeting || "—" : "—"}</td>
          <td className="mrep-text-wrap">{showTasks ? item.tasksCurrentMeeting || "—" : "—"}</td>
          <td className={`${statusClassName} mrep-cell-right`}>{statusText}</td>
        </tr>
      );
    });
  };

  return (
    <div className="mrep-page">
      <Header userRole={userRole} />
      <main className="mrep-main">
        <div className="mrep-header">
          <button className="mrep-btn-back" onClick={() => navigate(-1)}>← Назад</button>
          <div className="mrep-filters-container">
            <label className="mrep-inactive-toggle">
              <input
                type="checkbox"
                checked={includeInactiveStreams}
                onChange={(event) => {
                  const showInactive = event.target.checked;
                  setIncludeInactiveStreams(showInactive);
                  if (!showInactive && filters.stream && !isStreamActive(filters.stream)) {
                    updateFilter("stream", null);
                  }
                }}
              />
              Показывать неактивные
            </label>
            <Dropdown label={filters.stream?.name || "Потоки"} isOpen={openMenu.stream} onToggle={() => toggleMenu("stream")}>
              <button className="mrep-dropdown-item" onClick={() => updateFilter("stream", null)}>— Все —</button>
              {streamsError && <span className="mrep-dropdown-item">Не удалось загрузить потоки</span>}
              {streams.map((stream) => (
                <button
                  key={stream.id}
                  className="mrep-dropdown-item mrep-stream-option"
                  onClick={() => {
                    if (!isStreamActive(stream)) setIncludeInactiveStreams(true);
                    updateFilter("stream", stream);
                  }}
                >
                  {isStreamActive(stream) && <span className="mrep-active-stream-dot" aria-hidden="true" />}
                  {stream.name}
                </button>
              ))}
            </Dropdown>
            <Dropdown label={filters.team || "Команда"} isOpen={openMenu.team} onToggle={() => toggleMenu("team")}>
              <button className="mrep-dropdown-item" onClick={() => updateFilter("team", null)}>— Все —</button>
              {availableTeams.filter((team) => !filters.stream ||
                teamStreams.get(team.id)?.has(String(filters.stream.id))
              ).map((team) => (
                <button key={team.id} className="mrep-dropdown-item" onClick={() => updateFilter("team", team.name)}>
                  {team.name}
                </button>
              ))}
            </Dropdown>
            <Dropdown
              label={filters.status ? COMBINED_STATUS_OPTIONS[filters.status].label : "Статус"}
              isOpen={openMenu.status}
              onToggle={() => toggleMenu("status")}
            >
              <button className="mrep-dropdown-item" onClick={() => updateFilter("status", null)}>— Все —</button>
              {Object.entries(COMBINED_STATUS_OPTIONS).map(([key, option]) => (
                <button key={key} className="mrep-dropdown-item" onClick={() => updateFilter("status", key)}>
                  {option.label}
                </button>
              ))}
            </Dropdown>
          </div>
          <button className="mrep-btn-export" onClick={handleExportExcel}>Выгрузить отчёт</button>
        </div>

        <div className="mrep-table-container">
          <table className="mrep-table">
            <thead>
              <tr>
                <th>№</th>
                <SortableHeader title="Название команды" dir={sortConfig.teamNameDir} onSort={() => requestSort("teamName")} />
                <SortableHeader title="Дата встречи" currentSort={sortConfig.secondary} field="startDate" onSort={() => requestSort("startDate")} />
                <th>Выполнение задач / инфо по команде</th>
                <th>Задачи к следующей встрече</th>
                <SortableHeader title="Статус встречи" currentSort={sortConfig.secondary} field="teamStatusValue" onSort={() => requestSort("teamStatusValue")} />
              </tr>
            </thead>
            <tbody>{renderTableContent()}</tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Dropdown({ label, isOpen, onToggle, children }) {
  return (
    <div className="mrep-dropdown">
      <button className={`mrep-dropdown-btn ${isOpen ? "open" : ""}`} onClick={onToggle}>
        {label}
        <img src={isOpen ? IconClose : IconOpen} alt="" className="mrep-dropdown-arrow" />
      </button>
      {isOpen && <div className="mrep-dropdown-menu"><div className="mrep-dropdown-menu-inner">{children}</div></div>}
    </div>
  );
}

function SortableHeader({ title, dir, currentSort, field, onSort }) {
  const isActive = currentSort ? currentSort.field === field : true;
  let icon;

  if (currentSort) {
    icon = currentSort.direction === "asc" ? "↑" : "↓";
  } else {
    icon = dir === "asc" ? "А→Я" : "Я→А";
  }

  return (
    <th onClick={onSort} className="mrep-th-sortable">
      {title} <span className={isActive ? "mrep-icon-active" : "mrep-icon-inactive"}>{isActive ? icon : "↕"}</span>
    </th>
  );
}
