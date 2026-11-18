import { http } from './api';
import type { FinanceBi } from '../../mobile/packages/shared/src/bi';
export const biApi = {
  finance: (query: string) => http.request<FinanceBi>('GET', '/api/admin/finance/bi?' + query),
};
