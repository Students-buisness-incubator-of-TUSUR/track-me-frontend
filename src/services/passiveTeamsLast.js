export const passiveTeamsLast = (reports) => [
  ...reports.filter((report) => !report.passive),
  ...reports.filter((report) => report.passive),
];
