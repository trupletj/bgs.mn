import { AssignRoles } from "@/components/admin/assign-roles";
import { RolesList } from "@/components/admin/roles-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionsList } from "@/components/admin/permission-list";

export default async function RBACAdminPage() {
  //   const isAdmin = await hasRole("super_admin");

  //   if (!isAdmin) {
  //     redirect("/unauthorized");
  //   }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">RBAC Удирдлага</h1>
        <p className="text-muted-foreground">
          Permissions, Roles болон Profile-уудыг удирдах
        </p>
      </div>

      <Tabs defaultValue="assign-roles" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assign-roles">Role Оноох</TabsTrigger>
          {/* <TabsTrigger value="create-role">Role Үүсгэх</TabsTrigger> */}
          {/* <TabsTrigger value="create-permission">Permission Үүсгэх</TabsTrigger> */}
          <TabsTrigger value="roles-list">Role-ууд</TabsTrigger>
          <TabsTrigger value="permissions-list">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="assign-roles" className="space-y-6">
          <AssignRoles />
        </TabsContent>

        {/* <TabsContent value="create-role" className="space-y-6">
          <CreateRoleForm />
        </TabsContent> */}

        {/* <TabsContent value="create-permission" className="space-y-6">
          <CreatePermissionForm />
        </TabsContent> */}

        <TabsContent value="roles-list" className="space-y-6">
          <RolesList />
        </TabsContent>

        <TabsContent value="permissions-list" className="space-y-6">
          <PermissionsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
