import { getPrimaryTeamStream, getTeamCardSortQuery } from "./teamCardOrder";

test("uses the shared server order for all teams and keeps the existing order for other lists", () => {
    expect(getTeamCardSortQuery(true)).toBe("sort=streamEndDate,desc");
    expect(getTeamCardSortQuery(false)).toContain("sort=streams.startDate,desc");
});

test("chooses a dated stream before undated streams and breaks equal dates by id without mutation", () => {
    const streams = [
        { id: "c", endDate: null },
        { id: "b", endDate: "2026-12-30" },
        { id: "a", endDate: "2026-12-30" },
    ];
    const card = { streams };

    expect(getPrimaryTeamStream(card)).toBe(streams[2]);
    expect(card.streams.map((stream) => stream.id)).toEqual(["c", "b", "a"]);
    expect(getPrimaryTeamStream({})).toBeUndefined();
});
