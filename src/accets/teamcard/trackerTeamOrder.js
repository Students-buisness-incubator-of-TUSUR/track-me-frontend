const datePart = (value) => String(value || "").slice(0, 10);

const isActiveStream = (stream, today) => {
  const start = datePart(stream.startDate);
  const end = datePart(stream.endDate);
  return Boolean(start && end && start <= today && today <= end);
};

const streamKey = (stream) => String(stream.id || stream.name || "");

const scriptPriority = (name) => {
  const firstLetter = String(name || "").match(/\p{L}/u)?.[0] || "";
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
    teamStreams.sort((first, second) =>
      Number(isActiveStream(second, today)) - Number(isActiveStream(first, today)) ||
      datePart(second.startDate).localeCompare(datePart(first.startDate)) ||
      compareNames(first.name, second.name)
    );
    return { card, stream: teamStreams[0] || null };
  });

  const activeStreams = entries
    .map(({ stream }) => stream)
    .filter((stream) => stream && isActiveStream(stream, today));
  activeStreams.sort((first, second) =>
    datePart(second.startDate).localeCompare(datePart(first.startDate)) ||
    compareNames(first.name, second.name)
  );
  const activeStreamKey = activeStreams.length ? streamKey(activeStreams[0]) : null;

  entries.sort((first, second) => {
    const firstPrimary = activeStreamKey && streamKey(first.stream || {}) === activeStreamKey;
    const secondPrimary = activeStreamKey && streamKey(second.stream || {}) === activeStreamKey;
    if (firstPrimary !== secondPrimary) return firstPrimary ? -1 : 1;

    const firstActive = first.stream && isActiveStream(first.stream, today);
    const secondActive = second.stream && isActiveStream(second.stream, today);
    if (firstActive !== secondActive) return firstActive ? -1 : 1;

    const streamDateOrder = datePart(second.stream?.startDate).localeCompare(datePart(first.stream?.startDate));
    if (streamDateOrder) return streamDateOrder;

    const streamNameOrder = compareNames(first.stream?.name, second.stream?.name);
    if (streamNameOrder) return streamNameOrder;

    const streamIdOrder = streamKey(first.stream || {}).localeCompare(streamKey(second.stream || {}));
    if (streamIdOrder) return streamIdOrder;

    const ratingOrder = Number(second.card.averageGrade ?? 0) - Number(first.card.averageGrade ?? 0);
    return ratingOrder || compareNames(first.card.name, second.card.name);
  });

  return {
    activeStreamKey,
    cards: entries.map(({ card, stream }) => ({
      ...card,
      _streamKey: streamKey(stream || {}),
    })),
  };
};
