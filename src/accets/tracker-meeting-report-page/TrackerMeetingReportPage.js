import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../meeting-report-page/MeetingReportPage.css";

import IconOpen from "../meeting-report-page/icon-open.png";
import IconClose from "../meeting-report-page/icon-close.png";
import {
  fetchMyTrackerMeetingReport,
  fetchMyTrackerMeetingReportExcel,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMenu, setOpenMenu] = useState({ team: false, status: false });
  const [filters, setFilters] = useState({ team: null, status: null });
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

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetchMyTrackerMeetingReport({
        filters: apiFilters,
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
      setAvailableTeams((previousTeams) => previousTeams.length > 0
        ? previousTeams
        : [...new Set(content.map((item) => item.teamName))]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }))
      );
    } catch (requestError) {
      console.error(requestError);
      setError("Не удалось загрузить отчёт. Попробуйте обновить страницу.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [apiFilters, effectiveSortParams]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setOpenMenu({ team: false, status: false });
  };

  const toggleMenu = (key) => {
    setOpenMenu((previous) => ({
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
    if (loading) {
      return <tr><td colSpan="6">Загрузка...</td></tr>;
    }

    if (error) {
      return <tr><td colSpan="6">{error}</td></tr>;
    }

    if (reports.length === 0) {
      return <tr><td colSpan="6">Нет данных</td></tr>;
    }

    return reports.map((item, index) => {
      const isFirstInGroup = index === 0 || reports[index - 1].teamName !== item.teamName;
      const isLastInGroup = index === reports.length - 1 || reports[index + 1].teamName !== item.teamName;
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
            <Dropdown label={filters.team || "Команда"} isOpen={openMenu.team} onToggle={() => toggleMenu("team")}>
              <button className="mrep-dropdown-item" onClick={() => updateFilter("team", null)}>— Все —</button>
              {availableTeams.map((teamName) => (
                <button key={teamName} className="mrep-dropdown-item" onClick={() => updateFilter("team", teamName)}>
                  {teamName}
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
