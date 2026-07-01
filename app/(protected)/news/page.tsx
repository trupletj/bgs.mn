import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { getNewsList } from "@/actions/news";
import { NewsManager } from "@/components/news/news-manager";

export default async function NewsPage() {
  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission("news", "create"),
    hasPermission("news", "edit"),
    hasPermission("news", "delete"),
  ]);

  if (!canCreate && !canEdit && !canDelete) return <UnauthorizedPage />;

  const news = await getNewsList();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Контент
        </p>
        <h1 className="text-2xl font-bold">Мэдээ</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Компанийн мэдээ, зарлалыг үүсгэж, нийтлэх төлөвийг удирдана. Mobile апп
          нийтэлсэн мэдээг харуулна.
        </p>
      </header>

      <NewsManager
        initialNews={news}
        perms={{ canCreate, canEdit, canDelete }}
      />
    </div>
  );
}
