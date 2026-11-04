import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Non connecté");
    const { data: me, error } = await supabase
      .from("users")
      .select("*, account:accounts(*)")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!me) throw new Error("Profil introuvable");
    return me;
  },
});

export const useMe = () => useSuspenseQuery(meQuery).data;
