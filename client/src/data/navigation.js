const crowdPenalty = (crowd) => {
  if (crowd >= 70) return 1.9;
  if (crowd >= 40) return 1.35;
  return 1.0;
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const crowdLevel = (crowd) => {
  if (crowd >= 70) return 'high';
  if (crowd >= 40) return 'medium';
  return 'low';
};

export const crowdColor = (crowd) => {
  if (crowd >= 70) return '#e05252';
  if (crowd >= 40) return '#ffcf5c';
  return '#50c878';
};

export function nearestNode(point, nodes) {
  return nodes.reduce((best, node) => {
    const d = distance(point, node);
    return d < best.distance ? { node, distance: d } : best;
  }, { node: nodes[0], distance: Number.POSITIVE_INFINITY }).node;
}

export function computePath({ startPoint, destinationId, nodes, edges, zoneCrowdLookup }) {
  const start = nearestNode(startPoint, nodes).id;
  const target = destinationId;
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));

  const adjacency = {};
  nodes.forEach((n) => { adjacency[n.id] = []; });

  edges.forEach(([a, b]) => {
    const nodeA = nodeById[a];
    const nodeB = nodeById[b];
    const base = distance(nodeA, nodeB);
    const avgCrowd = ((zoneCrowdLookup[a] ?? 35) + (zoneCrowdLookup[b] ?? 35)) / 2;
    const weight = base * crowdPenalty(avgCrowd);
    adjacency[a].push({ to: b, weight });
    adjacency[b].push({ to: a, weight });
  });

  const costs = {};
  const prev = {};
  const unvisited = new Set(nodes.map((n) => n.id));

  nodes.forEach((n) => { costs[n.id] = Number.POSITIVE_INFINITY; });
  costs[start] = 0;

  while (unvisited.size) {
    let current = null;
    let bestCost = Number.POSITIVE_INFINITY;

    unvisited.forEach((id) => {
      if (costs[id] < bestCost) {
        bestCost = costs[id];
        current = id;
      }
    });

    if (!current || current === target) break;
    unvisited.delete(current);

    adjacency[current].forEach(({ to, weight }) => {
      if (!unvisited.has(to)) return;
      const nextCost = costs[current] + weight;
      if (nextCost < costs[to]) {
        costs[to] = nextCost;
        prev[to] = current;
      }
    });
  }

  const nodePath = [];
  let cursor = target;
  while (cursor) {
    nodePath.push(cursor);
    cursor = prev[cursor];
    if (cursor === start) {
      nodePath.push(start);
      break;
    }
  }

  const ordered = nodePath.reverse();
  if (!ordered.length || ordered[0] !== start) {
    return { points: [startPoint], distance: 0, nodePath: [] };
  }

  const points = ordered.map((id) => nodeById[id]);
  const routeDistance = points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);

  return {
    points,
    distance: Math.round(routeDistance),
    nodePath: ordered,
  };
}

export function findBestGate({ userPoint, zones }) {
  const gates = zones.filter((z) => z.type === 'gate');
  let best = null;

  gates.forEach((gate) => {
    const d = Math.hypot(userPoint.x - gate.x, userPoint.y - gate.y);
    const score = d * 0.6 + gate.crowd * 2.3 + gate.wait * 9;
    if (!best || score < best.score) {
      best = { gate, score, d: Math.round(d) };
    }
  });

  return best;
}

export function nearestByType({ zones, userPoint, type }) {
  return zones
    .filter((z) => z.type === type)
    .map((z) => ({
      ...z,
      distance: Math.round(Math.hypot(userPoint.x - z.x, userPoint.y - z.y)),
      level: crowdLevel(z.crowd),
    }))
    .sort((a, b) => a.distance - b.distance || a.crowd - b.crowd)[0];
}
