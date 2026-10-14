export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: Pagination;
};

export type ErrorResponse<Code extends string = string> = {
  success: false;
  error: {
    code: Code;
    message: string;
  };
};

export type PageQuery = {
  page: number;
  limit: number;
  total: number;
};

export const defaultPage = 1;
export const defaultPageLimit = 20;
export const maxPageLimit = 100;

export function ok<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function paginated<T>(
  data: T[],
  query: PageQuery,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: query.total,
      totalPages: totalPages(query.total, query.limit),
    },
  };
}

export function fail<Code extends string>(
  code: Code,
  message: string,
): ErrorResponse<Code> {
  return {
    success: false,
    error: { code, message },
  };
}

function totalPages(total: number, limit: number): number {
  if (total <= 0 || limit <= 0) {
    return 0;
  }

  return Math.ceil(total / limit);
}

const successFlag = { type: "boolean", const: true } as const;

export function successSchema<Data>(data: Data) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["success", "data"],
    properties: {
      success: successFlag,
      data,
    },
  } as const;
}

export function errorResponseSchema(
  codes: readonly string[],
  description: string,
) {
  return {
    description,
    type: "object",
    additionalProperties: false,
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", const: false },
      error: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: codes },
          message: { type: "string" },
        },
      },
    },
  } as const;
}

export function paginatedSchema<Item>(item: Item) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["success", "data", "pagination"],
    properties: {
      success: successFlag,
      data: {
        type: "array",
        items: item,
      },
      pagination: {
        type: "object",
        additionalProperties: false,
        required: ["page", "limit", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
    },
  } as const;
}
