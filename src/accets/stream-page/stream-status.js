const STATUSES = {
    planned: { key: 'planned', label: 'Планируется' },
    active: { key: 'active', label: 'Активно' },
    completed: { key: 'completed', label: 'Завершён' },
};

// Stream dates are calendar dates (LocalDate), not UTC instants.
export function getStreamStatus(startDate, endDate, now = new Date()) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (startDate && startDate > today) return STATUSES.planned;
    if (endDate && endDate < today) return STATUSES.completed;
    return STATUSES.active;
}
