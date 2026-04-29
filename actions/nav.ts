import { getUserRoles, hasPermission } from "@/actions/rbac";

export interface NavSubItem {
  title: string;
  url: string;
}

export interface NavService {
  key: string;
  title: string;
  url: string;
  basePaths: string[];
  items: NavSubItem[];
}

export async function getNavServices(): Promise<NavService[]> {
  const roles = await getUserRoles();
  const hasDiningAccess = await hasPermission("dining", "access");
  const hasEmployeeAccess = await hasPermission("employee", "read");

  const services: NavService[] = [];

  services.push({
    key: "dashboard",
    title: "Хяналтын самбар",
    url: "/dashboard",
    basePaths: ["/dashboard"],
    items: [],
  });

  const orderItems: NavSubItem[] = [];
  if (roles.some((r) => ["hr_emp", "monitoring_emp", "super_admin", "order_system"].includes(r))) {
    orderItems.push({ title: "Миний захиалгууд", url: "/orders/list" });
  }
  if (roles.some((r) => ["hr_emp", "super_admin", "order_system"].includes(r))) {
    orderItems.push({ title: "Худалдан авалт", url: "/orders/purchase" });
  }
  if (roles.some((r) => ["hr_emp", "monitoring_emp", "super_admin", "order_system"].includes(r))) {
    orderItems.push({ title: "Хяналт", url: "/orders/review" });
  }
  if (roles.some((r) => ["monitoring_emp", "super_admin", "order_system"].includes(r))) {
    orderItems.push({ title: "Захиалгын төрөл", url: "/order-processes" });
  }
  if (orderItems.length > 0) {
    services.push({
      key: "orders",
      title: "Захиалга",
      url: "/orders",
      basePaths: ["/orders", "/order-processes"],
      items: orderItems,
    });
  }

  if (hasDiningAccess) {
    services.push({
      key: "dine",
      title: "Хоол",
      url: "/dine",
      basePaths: ["/dine"],
      items: [
        { title: "Гал тогоо", url: "/dine/list" },
        { title: "Хоолны бүртгэл", url: "/dine/food-log" },
        { title: "Түр зуурын гал тогоо", url: "/dine/temp-kitchen" },
      ],
    });
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

  if (roles.some((r) => ["super_admin", "hr_emp", "monitoring_emp"].includes(r))) {
    services.push({
      key: "policy",
      title: "Журам",
      url: "/policy",
      basePaths: ["/policy"],
      items: [{ title: "Журамын жагсаалт", url: "/policy" }],
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
