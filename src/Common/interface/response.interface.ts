export interface IResponse<T=any, Z=any> {
  message?: boolean | string;
  data?: T;
  extra?:Z;
  status?: number;
}
