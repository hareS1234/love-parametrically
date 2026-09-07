import type { NormalizedLandmark } from './coordinates';

export interface HandObservation { landmarks: NormalizedLandmark[]; handedness?: string; handednessScore?: number }
export interface HandTrack extends HandObservation { id: string; lastSeenMs: number }
export interface TrackResult { tracks: HandTrack[]; ambiguousActive: boolean }

const palmCenter = (hand: HandObservation): readonly [number, number] => {
  const indices = [0, 5, 9, 13, 17];
  return [indices.reduce((sum, index) => sum + (hand.landmarks[index]?.x ?? 0), 0) / indices.length, indices.reduce((sum, index) => sum + (hand.landmarks[index]?.y ?? 0), 0) / indices.length];
};
const displacement = (a: HandObservation, b: HandObservation) => {
  const [ax, ay] = palmCenter(a); const [bx, by] = palmCenter(b);
  return Math.hypot(ax - bx, ay - by);
};
const associationCost = (a: HandObservation, b: HandObservation) => displacement(a, b)
  + (a.handedness && b.handedness && a.handedness !== b.handedness ? 0.015 : 0);

export class TrackAssociator {
  private previous: HandTrack[] = [];
  private counter = 0;

  update(observations: HandObservation[], timeMs: number, activeId: string | null): TrackResult {
    const recent = this.previous.filter((track) => timeMs - track.lastSeenMs <= 150);
    const candidates = observations.slice(0, 2);
    const assignments: Array<{ track: HandTrack; observation: HandObservation; cost: number }> = [];
    let ambiguousActive = false;
    const activeTrack = recent.find((track) => track.id === activeId);
    if (activeTrack && candidates.length > 1) {
      const candidateCosts = candidates.map((candidate) => associationCost(activeTrack, candidate)).sort((a, b) => a - b);
      ambiguousActive = candidateCosts[0] > 0.2 || candidateCosts[1] - candidateCosts[0] < 0.025;
    }
    if (recent.length === 2 && candidates.length === 2) {
      const direct = associationCost(recent[0], candidates[0]) + associationCost(recent[1], candidates[1]);
      const swapped = associationCost(recent[0], candidates[1]) + associationCost(recent[1], candidates[0]);
      if (activeId && Math.abs(direct - swapped) < 0.025) ambiguousActive = true;
      const mapping = direct <= swapped ? [0, 1] : [1, 0];
      recent.forEach((track, index) => assignments.push({ track, observation: candidates[mapping[index]], cost: associationCost(track, candidates[mapping[index]]) }));
    } else if (recent.length && candidates.length) {
      const pairs = recent.flatMap((track) => candidates.map((observation) => ({ track, observation, cost: associationCost(track, observation) }))).sort((a, b) => a.cost - b.cost);
      const usedTracks = new Set<string>(); const usedObservations = new Set<HandObservation>();
      for (const pair of pairs) if (!usedTracks.has(pair.track.id) && !usedObservations.has(pair.observation)) { assignments.push(pair); usedTracks.add(pair.track.id); usedObservations.add(pair.observation); }
    }
    const assignedObservations = new Set(assignments.filter((pair) => pair.cost <= 0.2).map((pair) => pair.observation));
    const tracks = assignments.filter((pair) => pair.cost <= 0.2).map((pair) => ({ ...pair.observation, id: pair.track.id, lastSeenMs: timeMs }));
    for (const observation of candidates) if (!assignedObservations.has(observation)) tracks.push({ ...observation, id: `hand-${++this.counter}`, lastSeenMs: timeMs });
    const activePairs = assignments.filter((pair) => pair.track.id === activeId).sort((a, b) => a.cost - b.cost);
    ambiguousActive ||= Boolean(activeId && (activePairs.length === 0 || activePairs[0].cost > 0.2));
    const matchedIds = new Set(tracks.map((track) => track.id));
    this.previous = [...tracks, ...recent.filter((track) => !matchedIds.has(track.id))];
    return { tracks, ambiguousActive };
  }

  reset(): void { this.previous = []; this.counter = 0; }
}
