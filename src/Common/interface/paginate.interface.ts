export interface IPaginate<T> {
  count: number;
  limit: number;
  pages: number;
  currentPage: number;
  docs: T[];
}
