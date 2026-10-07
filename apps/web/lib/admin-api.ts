import { authClient } from "./auth-client";

export async function listUsers({
  search = "",
  role = "",
  offset = 0,
  limit = 20,
}: { search?: string; role?: string; offset?: number; limit?: number } = {}) {
  const result = await authClient.admin.listUsers({
    query: {
      limit,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
      ...(search
        ? ({
            searchValue: search,
            searchField: "email",
            searchOperator: "contains",
          } as const)
        : {}),
      ...(role
        ? ({
            filterField: "role",
            filterValue: role,
            filterOperator: "eq",
          } as const)
        : {}),
    },
  });
  if (result.error)
    throw new Error(result.error.message ?? "User list unavailable");
  return result.data;
}

export async function promoteMerchant(userId: string) {
  const result = await authClient.admin.setRole({ userId, role: "merchant" });
  if (result.error)
    throw new Error(result.error.message ?? "Role change failed");
  return result.data;
}
