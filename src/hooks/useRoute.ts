import { useEffect, useState } from 'react';
import { METALS, type Metal } from '../domain/types';

/** Tiny hash router; hash URLs keep working inside Tauri/Capacitor wrappers. */
export type Route =
  | { name: 'overview' }
  | { name: 'collection' }
  | { name: 'coin'; id: string }
  | { name: 'prices'; metal: Metal }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'coins' && parts[1]) return { name: 'coin', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'coins') return { name: 'collection' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'prices') return { name: 'prices', metal: METALS.includes(parts[1] as Metal) ? (parts[1] as Metal) : 'silver' };
  return { name: 'overview' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'overview':
      return '#/';
    case 'collection':
      return '#/coins';
    case 'coin':
      return `#/coins/${encodeURIComponent(route.id)}`;
    case 'prices':
      return `#/prices/${route.metal}`;
    case 'settings':
      return '#/settings';
  }
}

export function navigate(route: Route) {
  location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
