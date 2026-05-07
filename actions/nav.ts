import { getUserRoles, hasPermission } from "@/actions/rbac";
import { getPendingOrderReviewCountForCurrentUser } from "@/actions/orders";

export interface NavSubItem {
  title: string;
  url: string;
  badgeCount?: number;
}

export interface NavService {
  key: string;
  title: string;
  url: string;
  basePaths: string[];
  items: NavSubItem[];
  badgeCount?: number;
}

export async function getNavServices(): Promise<NavService[]> {
  const roles = await getUserRoles();
  const hasDiningAccess = await hasPermission("dining", "access");
  const hasEmployeeAccess = await hasPermission("employee", "read");
  const hasPolicyCreate = await hasPermission("policy", "create");
  const hasJobDescriptionAccess = await hasPermission(
    "job_description",
    "access",
  );
  const hasJobDescriptionCreate = await hasPermission(
    "job_description",
    "create",
  );
  const hasCreateOrder = await hasPermission("order", "create");
  const hasOrderAccess = await hasPermission("order", "access");
  const hasOrderPurchase = await hasPermission("order", "purchase");
  const hasOrderReview = await hasPermission("order", "edit");
  const pendingOrderReviewCount = hasOrderReview
    ? await getPendingOrderReviewCountForCurrentUser()
    : 0;

  const services: NavService[] = [];

  services.push({
    key: "dashboard",
    title: "Хяналтын самбар",
    url: "/dashboard",
    basePaths: ["/dashboard"],
    items: [],
  });

  services.push({
    key: "attendance",
    title: "Ирц",
    url: "/attendance",
    basePaths: ["/attendance"],
    items: [],
  });

  services.push({
    key: "eelj",
    title: "Ээлж",
    url: "/eelj",
    basePaths: ["/eelj"],
    items: [],
  });

  const orderItems: NavSubItem[] = [];
  if (hasOrderPurchase) {
    orderItems.push({ title: "Худалдан авалт", url: "/orders/purchase" });
  }
  if (hasOrderReview) {
    orderItems.push({
      title: "Хяналт",
      url: "/orders/review",
      badgeCount: pendingOrderReviewCount,
    });
  }
  if (roles.some((r) => ["super_admin"].includes(r))) {
    orderItems.push({ title: "Захиалгын төрөл", url: "/order-processes" });
  }
  if (hasCreateOrder) {
    orderItems.push({ title: "+ Захиалга үүсгэх", url: "/orders/add" });
  }
  if (hasOrderAccess || hasCreateOrder || orderItems.length > 0) {
    services.push({
      key: "orders",
      title: "Захиалга",
      url: "/orders",
      basePaths: ["/orders", "/order-processes"],
      items: orderItems,
      badgeCount: pendingOrderReviewCount,
    });
  }

  if (hasDiningAccess) {
    const dineService: NavService = {
      key: "dine",
      title: "Хоол",
      url: "/dine",
      basePaths: ["/dine"],
      items: [
        { title: "Гал тогоо", url: "/dine/list" },
        { title: "Түр зуурын гал тогоо", url: "/dine/temp-kitchen" },
        { title: "Сарын тайлан", url: "/dine/monthly-report" },
      ],
    };

    if (roles.some((r) => ["super_admin", "Kiosk_manager"].includes(r))) {
      dineService.items.push({ title: "QR үүсгэх", url: "/dine/sub" });
    }

    services.push(dineService);
  }

  if (hasEmployeeAccess) {
    services.push({
      key: "employees",
      title: "Ажилтан",
      url: "/employees",
      basePaths: ["/employees"],
      items: [],
    });
  }

  if (
    roles.some((r) => ["super_admin", "hr_emp", "monitoring_emp"].includes(r))
  ) {
    const policyItems: NavSubItem[] = [
      { title: "Журмын жагсаалт", url: "/policy/list" },
    ];

    if (hasPolicyCreate) {
      policyItems.push({ title: "+ Журам нэмэх", url: "/policy/new" });
    }

    services.push({
      key: "policy",
      title: "Журам",
      url: "/policy",
      basePaths: ["/policy"],
      items: policyItems,
    });
  }

  if (
    hasJobDescriptionAccess &&
    roles.some((r) => ["super_admin", "hr_emp"].includes(r))
  ) {
    const jobDescriptionItems: NavSubItem[] = [
      { title: "Тодорхойлолтын жагсаалт", url: "/job-descriptions" },
    ];

    if (hasJobDescriptionCreate) {
      jobDescriptionItems.push({
        title: "+ Тодорхойлолт нэмэх",
        url: "/job-descriptions/new",
      });
    }

    services.push({
      key: "job-descriptions",
      title: "Албан тушаалын тодорхойлолт",
      url: "/job-descriptions",
      basePaths: ["/job-descriptions"],
      items: jobDescriptionItems,
    });
  }

  if (roles.some((r) => ["super_admin", "it_engineer"].includes(r))) {
    services.push({
      key: "devices",
      title: "IT Тоног төхөөрөмж",
      url: "/devices",
      basePaths: ["/devices"],
      items: [
        { title: "Бүртгэл", url: "/devices" },
        { title: "Хүсэлт гаргах", url: "/devices/request" },
        { title: "Хүсэлтүүд", url: "/devices/requests" },
        { title: "Тайлан", url: "/devices/report" },
      ],
    });
  }

  if (roles.includes("super_admin")) {
    services.push({
      key: "admin",
      title: "Админ",
      url: "/admin",
      basePaths: ["/admin"],
      items: [],
    });
  }

  return services;
}
