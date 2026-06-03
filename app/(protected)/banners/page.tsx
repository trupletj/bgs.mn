import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { getBannersList } from "@/actions/banners";
import { getNewsList } from "@/actions/news";
import { BannerManager } from "@/components/banners/banner-manager";

export default async function BannersPage() {
  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission("banner", "create"),
    hasPermission("banner", "edit"),
    hasPermission("banner", "delete"),
  ]);

  if (!canCreate && !canEdit && !canDelete) return <UnauthorizedPage />;

  const [banners, news] = await Promise.all([getBannersList(), getNewsList()]);
  const newsOptions = news.map((n) => ({ id: n.id, title: n.title }));

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Контент
        </p>
        <h1 className="text-2xl font-bold">Баннер</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mobile нүүрний carousel-д зурагтай баннер нэмж, холбоостой мэдээ эсвэл
          URL рүү чиглүүлнэ.
        </p>
      </header>

      <BannerManager
        initialBanners={banners}
        newsOptions={newsOptions}
        perms={{ canCreate, canEdit, canDelete }}
      />
    </div>
  );
}
