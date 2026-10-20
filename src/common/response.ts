export interface IPagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ErrorDetail {
  field?: string;
  messages: string[];
}

export class ApiResponse<T> {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly data?: T | null;
  readonly pagination?: IPagination;
  readonly errors?: ErrorDetail[];

  constructor(
    status: number,
    code: string,
    message: string,
    data?: T | null,
    pagination?: IPagination,
    errors?: ErrorDetail[],
  ) {
    this.code = code;
    this.data = data;
    this.status = status;
    this.message = message;
    this.pagination = pagination;
    this.errors = errors;
  }

  static success<T>(
    status: number,
    code: string,
    message: string,
    data: T,
    pagination?: IPagination,
  ): ApiResponse<T> {
    return new ApiResponse(status, code, message, data, pagination);
  }

  static error<T = null>(
    status: number,
    code: string,
    message: string,
    errors?: ErrorDetail[],
  ): ApiResponse<T> {
    return new ApiResponse<T>(
      status,
      code,
      message,
      undefined,
      undefined,
      errors,
    );
  }
}

export type IApiResponse<T> = Promise<ApiResponse<T>>;
