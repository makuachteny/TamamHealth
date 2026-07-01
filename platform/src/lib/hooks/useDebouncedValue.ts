import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * quiet. Replaces the hand-rolled setTimeout/clearTimeout debounce repeated
 * across the search/list screens.
 *
 * @example
 *   const debounced = useDebouncedValue(search, 300);
 *   const results = useMemo(() => filter(debounced), [debounced]);
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
