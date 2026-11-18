import { http } from './api';
import type { FinanceBi, OperationsBi, PartenairesBi } from '../../mobile/packages/shared/src/bi';
export const biApi = {
  finance: (query: string) => http.request<FinanceBi>('GET', '/api/admin/finance/bi?' + query),
  operations: (query: string) => http.request<OperationsBi>('GET', '/api/admin/bi/operations?' + query),
  partenaires: (query: string) => http.request<PartenairesBi>('GET', '/api/admin/bi/partenaires?' + query),
};
