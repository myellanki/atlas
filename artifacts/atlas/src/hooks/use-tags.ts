import { useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface CustomTag {
  id: number;
  category: "data_source" | "cohort";
  name: string;
  color: string | null;
  position: number;
}

export function useTagsByCategory(category: "data_source" | "cohort") {
  return useQuery<CustomTag[]>({
    queryKey: ["tags", category],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/tags?category=${category}`);
      return r.json();
    },
    staleTime: 30_000,
  });
}

export function useAllTags() {
  return useQuery<CustomTag[]>({
    queryKey: ["tags"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/tags`);
      return r.json();
    },
    staleTime: 30_000,
  });
}

export const TAG_QUERY_KEY = (category?: string) =>
  category ? ["tags", category] : ["tags"];
