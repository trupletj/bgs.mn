import { createClient } from "@/utils/supabase/client";
import { OrganizationWithJobRelations } from "@/types/types";

export async function getOrganizations(): Promise<
  OrganizationWithJobRelations[]
> {
  const supabase = createClient();

  try {
    const { data: organizations, error: orgError } = await supabase
      .from("organization")
      .select(
        `
        *,
        job_position!job_position_organization_id_fkey(
          *
        ),
        heltes(
          *,
          job_position!job_position_heltes_id_fkey(*),
          alba(
            *,
            job_position!job_position_alba_id_fkey(*)
          )
        ),
        alba!alba_organization_id_fkey(
          *,
          job_position!job_position_alba_id_fkey(*)
        )
      `
      )
      .in("bteg_id", ["1", "2", "20"])
      .order("name", { ascending: true });

    if (orgError) {
      console.error("Deep query error:", orgError);
      throw orgError;
    }

    if (!organizations) return [];

    // Prisma query-тэй ЯГ ИЖИЛ шүүлтүүр хийх
    const filteredOrganizations = organizations.map((org) => {
      // Organization-ийн шууд job positions шүүлтүүр
      const filteredDirectPositions = (org.job_position || []).filter(
        (pos: any) =>
          pos.is_active === true &&
          pos.alba_id === null &&
          pos.heltes_id === null
      );

      // Heltes шүүлтүүр
      const filteredHeltes = (org.heltes || [])
        .filter((helt: any) => helt.is_active === true) // Active heltes
        .sort((a: any, b: any) => a.name.localeCompare(b.name)) // orderBy: { name: "asc" }
        .map((helt: any) => {
          // Heltes-ийн шууд job positions шүүлтүүр
          const heltDirectPositions = (helt.job_position || []).filter(
            (pos: any) => pos.is_active === true && pos.alba_id === null
          );

          // Heltes-ийн alba шүүлтүүр
          const filteredHeltesAlba = (helt.alba || []).map((alb: any) => {
            // Alba-гийн job positions шүүлтүүр
            const albaPositions = (alb.job_position || []).filter(
              (pos: any) => pos.is_active === true
            );

            return {
              ...alb,
              job_position: albaPositions,
            };
          });

          return {
            ...helt,
            job_position: heltDirectPositions,
            alba: filteredHeltesAlba,
          };
        });

      // Organization-ийн шууд alba шүүлтүүр
      const filteredDirectAlba = (org.alba || []).map((alb: any) => {
        // Direct alba-гийн job positions шүүлтүүр
        const albaPositions = (alb.job_position || []).filter(
          (pos: any) => pos.is_active === true && pos.heltes_id === null
        );

        return {
          ...alb,
          job_position: albaPositions,
        };
      });

      return {
        ...org,
        job_position: filteredDirectPositions,
        heltes: filteredHeltes,
        alba: filteredDirectAlba,
      };
    });

    return filteredOrganizations as OrganizationWithJobRelations[];
  } catch (error) {
    console.error("Get organizations error:", error);
    return [];
  }
}
