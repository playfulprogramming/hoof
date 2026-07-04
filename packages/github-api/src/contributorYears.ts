// All calendar years from FIRST_CONTRIBUTOR_YEAR through the current year.
// A year is included in the contributor achievement only when the author had
// actual GitHub activity that year — it is not granted to everyone for every year.
export const FIRST_CONTRIBUTOR_YEAR = 2019;

export function contributorYears(): number[] {
	const years: number[] = [];
	for (let y = FIRST_CONTRIBUTOR_YEAR; y <= new Date().getFullYear(); y++) {
		years.push(y);
	}
	return years;
}
