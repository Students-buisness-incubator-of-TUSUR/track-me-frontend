export const initialMeetingReportSort = () => ({
  teamNameDir: "asc",
  secondary: { field: "startDate", direction: "desc" },
  selectedField: null,
  sortStep: 0,
});

export const nextMeetingReportSort = (previous, field) => {
  const nextStep = previous.selectedField === field ? previous.sortStep + 1 : 1;
  if (nextStep === 3) return initialMeetingReportSort();

  if (field === "teamName") {
    return {
      ...previous,
      teamNameDir: nextStep === 1 ? "desc" : "asc",
      selectedField: field,
      sortStep: nextStep,
    };
  }

  return {
    ...previous,
    secondary: { field, direction: nextStep === 1 ? "asc" : "desc" },
    selectedField: field,
    sortStep: nextStep,
  };
};
