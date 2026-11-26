import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';
import { settingsAPI } from '../api';
import { cacheTaxRate, getTaxRate } from './orderHelpers';

// Current shared tax rate: fetched from the server, refreshed every 30 seconds and when the window regains focus.
export function useTaxRate() {
  const [cached, setCached] = useState(getTaxRate);
  useEffect(() => {
    const refresh = () => setCached(getTaxRate());
    window.addEventListener('taxRateChanged', refresh);
    return () => window.removeEventListener('taxRateChanged', refresh);
  }, []);
  const { data } = useQuery('settings', async () => (await settingsAPI.get()).data, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    onSuccess: (settings) => cacheTaxRate(settings?.taxRate),
  });
  const fromServer = Number(data?.taxRate);
  return Number.isFinite(fromServer) ? fromServer : cached;
}
