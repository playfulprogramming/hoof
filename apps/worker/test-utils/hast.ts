/**
 * Remove all `position` properties from a HAST tree for easier comparison in snapshots.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removePositions(obj: any) {
	if (obj.position) delete obj.position;
	if (obj.children) obj.children = obj.children.map(removePositions);
	return obj;
}
