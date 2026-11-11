const datePart = (value) => String(value || "").slice(0, 10);

const isActiveStream = (stream, today) => {
  const start = datePart(stream.startDate);
  const end = datePart(stream.endDate);
  return Boolean(start && end && start <= today && today <= end);
};

const streamKey = (stream) => String(stream.id || stream.name || "");

const scriptPriority = (name) => {
  const firstLetter = /\p{L}/u.exec(String(name || ""))?.[0] || "";
  if (/[А-ЯЁа-яё]/u.test(firstLetter)) return 0;
  if (/[A-Za-z]/u.test(firstLetter)) return 1;
  return 2;
};

const compareNames = (first, second) => {
  const priority = scriptPriority(first) - scriptPriority(second);
  return priority || String(first || "").localeCompare(String(second || ""), "ru", {
    sensitivity: "base",
    numeric: true,
  });
};

const compareStreamSelection = (first, second, today) => {
  const firstActive = isActiveStream(first, today);
  const secondActive = isActiveStream(second, today);
  const activeEndDateOrder = firstActive && secondActive
    ? datePart(second.endDate).localeCompare(datePart(first.endDate)) : 0;
  return Number(secondActive) - Number(firstActive) || activeEndDateOrder ||
    datePart(second.startDate).localeCompare(datePart(first.startDate)) ||
    compareNames(first.name, second.name) ||
    streamKey(first).localeCompare(streamKey(second));
};

const compareTeamDetails = (first, second) =>
  Number(second.card.averageGrade ?? 0) - Number(first.card.averageGrade ?? 0) ||
  compareNames(first.card.name, second.card.name) ||
  String(first.card.id || "").localeCompare(String(second.card.id || ""));

const compareActiveTeams = (first, second) =>
  Number(first.card.passive === true) - Number(second.card.passive === true) ||
  datePart(second.stream.endDate).localeCompare(datePart(first.stream.endDate)) ||
  compareTeamDetails(first, second);

const compareInactiveTeams = (first, second) =>
  datePart(second.stream?.startDate).localeCompare(datePart(first.stream?.startDate)) ||
  compareNames(first.stream?.name, second.stream?.name) ||
  streamKey(first.stream || {}).localeCompare(streamKey(second.stream || {})) ||
  compareTeamDetails(first, second);

/** Сначала обычные команды активных потоков, затем отчисленные и команды неактивных потоков. */
export const orderTrackerTeams = (cards, streams, today) => {
  const catalog = new Map(streams.flatMap((stream) => [
    stream.id && [String(stream.id), stream],
    stream.name && [stream.name, stream],
  ].filter(Boolean)));

  const entries = cards.map((card) => {
    const teamStreams = (card.streams || []).map((stream) => ({
      ...catalog.get(streamKey(stream)),
      ...stream,
    }));
    teamStreams.sort((first, second) => compareStreamSelection(first, second, today));
    const stream = teamStreams[0] || null;
    return { card, stream, active: Boolean(stream && isActiveStream(stream, today)) };
  });

  const activeStreams = entries
    .filter(({ active }) => active)
    .map(({ stream }) => stream)
    .sort((first, second) => compareStreamSelection(first, second, today));
  const activeStreamKey = activeStreams.length ? streamKey(activeStreams[0]) : null;

  entries.sort((first, second) =>
    Number(second.active) - Number(first.active) ||
    (first.active ? compareActiveTeams(first, second) : compareInactiveTeams(first, second))
  );

  return {
    activeStreamKey,
    cards: entries.map(({ card, stream, active }) => ({
      ...card,
      _streamKey: streamKey(stream || {}),
      _streamActive: active,
      _primaryStream: stream,
    })),
  };
};
