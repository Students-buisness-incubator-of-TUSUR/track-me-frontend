import { getStreamStatus } from './stream-status';

const today = new Date(2026, 9, 15, 12);
test.each([
    ['2026-10-16', '2026-12-01', 'planned'],
    ['2026-10-15', '2026-12-01', 'active'],
    ['2026-10-01', '2026-10-15', 'active'],
    ['2026-10-01', '2026-10-14', 'completed'],
    [null, null, 'active'],
    [null, '2026-10-14', 'completed'],
    ['2026-10-16', null, 'planned'],
])('dates %s to %s yield %s', (start, end, expected) => {
    expect(getStreamStatus(start, end, today).key).toBe(expected);
});

test('uses calendar day including the last millisecond of the end date', () => {
    expect(getStreamStatus('2026-10-15', '2026-10-15', new Date(2026, 9, 15, 23, 59, 59)).key).toBe('active');
    expect(getStreamStatus('2026-10-15', '2026-10-15', new Date(2026, 9, 16, 0, 0, 0)).key).toBe('completed');
});
