/** Map stored registration values onto Schedule B options for selects and display. */
export function disabilityFromRegistration(
  category: string | null | undefined,
  other: string | null | undefined,
  scheduleB: string[],
): { category: string; other: string; display: string; unknownCategory: boolean } {
  const rawCat = (category || "").trim();
  const rawOther = (other || "").trim();
  const otherOption = scheduleB.find((d) => d.startsWith("Other")) || "Other (specify)";

  if (rawCat && scheduleB.includes(rawCat)) {
    const isOther = rawCat.startsWith("Other");
    const display = isOther && rawOther ? `${rawCat} — ${rawOther}` : rawCat;
    return { category: rawCat, other: isOther ? rawOther : "", display, unknownCategory: false };
  }

  if (rawCat) {
    const match = scheduleB.find((d) => d.toLowerCase() === rawCat.toLowerCase());
    if (match) {
      const isOther = match.startsWith("Other");
      return {
        category: match,
        other: isOther ? rawOther : "",
        display: isOther && rawOther ? `${match} — ${rawOther}` : match,
        unknownCategory: false,
      };
    }
    const display = rawOther ? `${rawCat} — ${rawOther}` : rawCat;
    return { category: rawCat, other: rawOther, display, unknownCategory: !scheduleB.includes(rawCat) };
  }

  if (rawOther) {
    return {
      category: otherOption,
      other: rawOther,
      display: `${otherOption} — ${rawOther}`,
      unknownCategory: false,
    };
  }

  return { category: "", other: "", display: "", unknownCategory: false };
}

export function scheduleBOptions(scheduleB: string[], selectedCategory: string): string[] {
  if (!selectedCategory || scheduleB.includes(selectedCategory)) {
    return scheduleB;
  }
  return [...scheduleB, selectedCategory];
}
