/** Сервер сортирует весь набор до пагинации; клиент сохраняет порядок ответа. */
export const getTeamCardSortQuery = (allTeamsView) => allTeamsView
    ? "sort=streamEndDate,desc"
    : "sort=enabled,desc&sort=streams.startDate,desc&sort=averageGrade,desc&sort=name,asc";

/** Поток, используемый сервером для группировки старых карточек с несколькими потоками. */
export const getPrimaryTeamStream = (card) => [...(card.streams || [])].sort((first, second) => {
    const firstDate = String(first.endDate || "").slice(0, 10);
    const secondDate = String(second.endDate || "").slice(0, 10);
    if (firstDate !== secondDate) return firstDate > secondDate ? -1 : 1;
    const firstId = String(first.id || "");
    const secondId = String(second.id || "");
    return firstId < secondId ? -1 : firstId > secondId ? 1 : 0;
})[0];
